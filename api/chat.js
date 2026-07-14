// Endpoint serverless de Vercel para el Guardián del Templo.
//
// Recibe { message, history } desde main.js, arma el pedido a la API de
// Gemini con la system instruction de lib/guardian-system-prompt.js y
// devuelve la respuesta del modelo. La GEMINI_API_KEY vive solo acá
// (variable de entorno del servidor) y nunca se expone al navegador.
//
// Contrato:
//   POST /api/chat
//   body:  { message: string, history: Array<{ role: 'user' | 'model', text: string }>, convId?: string }
//   200:   { reply: string }
//   4xx/5xx: { error: string }
//
// Registro anónimo: si están configuradas UPSTASH_REDIS_REST_URL y
// UPSTASH_REDIS_REST_TOKEN, cada turno (mensaje + respuesta) se agrega a una
// lista en Upstash Redis para poder revisar y mejorar al Guardián. No se
// guarda IP, cookie ni ningún dato que identifique al visitante; `convId` es
// un id aleatorio generado en el navegador, efímero (dura lo que dura la
// pestaña), que solo sirve para agrupar los turnos de una misma charla. Si
// Upstash no está configurado o falla, el registro se omite en silencio y no
// afecta la respuesta al visitante.

const { SYSTEM_INSTRUCTION } = require('../lib/guardian-system-prompt');
const { verificarTurnstile } = require('../lib/turnstile');

// Cadena de fallback multi-modelo (PLAN-GUARDIAN-WORLD-CLASS.md, capa 1 y
// sección 5.1). En vez de un solo modelo, se recorre esta lista ordenada
// hasta el primer éxito. Son modelos distintos del MISMO proyecto: no es
// eludir cuota (eso viola la ToS de Google), es aprovechar que cada modelo
// tiene su propio cupo. Si el primero está saturado (429) o caído (503), se
// pasa al siguiente sin que el visitante lo note.
const MODELOS_FALLBACK = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
const GEMINI_ENDPOINT = (modelo) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

// Timeout por llamada (PLAN, capa 1). Un fetch colgado del lado de Google no
// puede comerse toda la función: se aborta a los 12s y se prueba el siguiente
// modelo. 3 modelos x 12s = 36s de piso, dentro del maxDuration de vercel.json.
const TIMEOUT_GEMINI_MS = 12000;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 40;
const CONV_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// fetch con corte por tiempo vía AbortController. Al abortar, fetch lanza
// (AbortError), que el llamador trata como fallo transitorio y salta al
// siguiente modelo.
async function fetchConTimeout(url, opciones, timeoutMs) {
  const controlador = new AbortController();
  const id = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opciones, signal: controlador.signal });
  } finally {
    clearTimeout(id);
  }
}

async function registrarTurno(convId, mensaje, respuesta) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const entrada = JSON.stringify({
    ts: new Date().toISOString(),
    conv: typeof convId === 'string' && CONV_ID_PATTERN.test(convId) ? convId : null,
    mensaje,
    respuesta,
  });

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['RPUSH', 'guardian:conversaciones', entrada]),
    });
  } catch (err) {
    console.error('No se pudo registrar el turno en Upstash:', err.message);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY no está configurada.');
    return res.status(500).json({ error: 'El Guardián no está disponible en este momento.' });
  }

  const body = req.body || {};
  const { message, history, convId, turnstileToken } = body;

  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Falta el mensaje.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `El mensaje supera los ${MAX_MESSAGE_LENGTH} caracteres.` });
  }

  const remoteip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;
  const verificacion = await verificarTurnstile(turnstileToken, remoteip);
  if (!verificacion.ok) {
    return res.status(403).json({ error: verificacion.error });
  }

  let safeHistory = [];
  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'El historial es inválido.' });
    }
    // Recorte en vez de rechazo (PLAN, sección 5.4): si la charla superó el
    // límite de turnos, nos quedamos con los últimos N en lugar de cortarla
    // con un 400. La conversación nunca se muere por longitud.
    const recorte = history.length > MAX_HISTORY_TURNS ? history.slice(-MAX_HISTORY_TURNS) : history;
    for (const turn of recorte) {
      if (
        !turn ||
        (turn.role !== 'user' && turn.role !== 'model') ||
        typeof turn.text !== 'string' ||
        turn.text.length === 0 ||
        turn.text.length > MAX_MESSAGE_LENGTH
      ) {
        return res.status(400).json({ error: 'El historial es inválido.' });
      }
    }
    safeHistory = recorte;
  }

  const contents = [
    ...safeHistory.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  // Cadena de fallback (PLAN, sección 5.1). Se recorre MODELOS_FALLBACK y se
  // clasifica cada error en vez de reintentar a ciegas el mismo modelo (lo que
  // con la cuota diaria agotada solo aceleraba el colapso):
  //   - 429 (cuota/RPM) o 503 (modelo caído): failover inmediato al siguiente
  //     modelo. Si el cupo del día se agotó, esperar no sirve; y hay más modelos.
  //   - error de red o timeout (AbortError): fallo transitorio, siguiente modelo.
  //   - cualquier otra respuesta (ok, 400, 500): se toma como definitiva y se
  //     corta la cadena; la maneja el bloque de abajo.
  //
  // Nota: los errores se devuelven con status 500 (no 502/504) a propósito.
  // El dominio pasa por el proxy de Cloudflare, que reemplaza los 502/504 del
  // origen por su propia página HTML, y eso impide que el mensaje amable en
  // JSON llegue al navegador.
  const cuerpoPedido = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
  });

  let geminiResponse = null;
  let errorDeRed = null;
  let huboSaturacion = false;

  for (const modelo of MODELOS_FALLBACK) {
    let respuesta;
    try {
      respuesta = await fetchConTimeout(
        `${GEMINI_ENDPOINT(modelo)}?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: cuerpoPedido,
        },
        TIMEOUT_GEMINI_MS,
      );
    } catch (err) {
      // Incluye AbortError (timeout) y caídas de red: transitorio, siguiente modelo.
      errorDeRed = err;
      console.warn(`Fallo de red/timeout con ${modelo}:`, err.message);
      continue;
    }

    if (respuesta.status === 429 || respuesta.status === 503) {
      huboSaturacion = true;
      console.warn(`Modelo ${modelo} saturado (${respuesta.status}); failover al siguiente.`);
      continue;
    }

    // Respuesta utilizable (o error definitivo tipo 400/500): se corta la cadena.
    geminiResponse = respuesta;
    break;
  }

  if (!geminiResponse) {
    // Ningún modelo respondió. El mensaje amable de "muchos visitantes" solo
    // aparece acá, ante caída total y sostenida de Google (PLAN, sección 1),
    // nunca por cuota propia con modelos aún disponibles.
    if (huboSaturacion) {
      console.error('Todos los modelos saturados (429/503) tras el fallback.');
      return res.status(500).json({ error: 'El Guardián está atendiendo a muchos visitantes en este momento. Esperá un instante y volvé a intentar.' });
    }
    console.error('Error de red/timeout en todos los modelos:', errorDeRed && errorDeRed.message);
    return res.status(500).json({ error: 'No se pudo contactar al Guardián. Probá de nuevo en un momento.' });
  }

  if (!geminiResponse.ok) {
    const errorBody = await geminiResponse.text().catch(() => '');
    console.error('Gemini respondió con error:', geminiResponse.status, errorBody);
    return res.status(500).json({ error: 'El Guardián tuvo un problema para responder. Probá de nuevo en un momento.' });
  }

  let data;
  try {
    data = await geminiResponse.json();
  } catch (err) {
    console.error('Respuesta de Gemini no es JSON válido:', err.message);
    return res.status(500).json({ error: 'El Guardián tuvo un problema para responder. Probá de nuevo en un momento.' });
  }

  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== 'string' || reply.trim().length === 0) {
    console.error('Respuesta de Gemini sin texto utilizable:', JSON.stringify(data).slice(0, 500));
    return res.status(500).json({ error: 'El Guardián no pudo generar una respuesta. Probá reformular tu pregunta.' });
  }

  await registrarTurno(convId, message, reply);

  return res.status(200).json({ reply });
};
