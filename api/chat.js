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

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 40;
const CONV_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

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
    if (history.length > MAX_HISTORY_TURNS) {
      return res.status(400).json({ error: 'El historial es demasiado largo.' });
    }
    for (const turn of history) {
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
    safeHistory = history;
  }

  const contents = [
    ...safeHistory.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  // Llamada a Gemini con reintentos silenciosos: si el modelo está saturado
  // (503) o nos limita (429), se espera 1s y luego 2s antes de reintentar,
  // hasta 2 veces. La mayoría de los picos de demanda se resuelven así y el
  // visitante solo nota una respuesta apenas más lenta.
  //
  // Nota: los errores se devuelven con status 500 (no 502/504) a propósito.
  // El dominio pasa por el proxy de Cloudflare, que reemplaza los 502/504 del
  // origen por su propia página HTML, y eso impide que el mensaje amable en
  // JSON llegue al navegador.
  const ESPERAS_MS = [1000, 2000];
  const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let geminiResponse = null;
  let errorDeRed = null;
  for (let intento = 0; intento <= ESPERAS_MS.length; intento++) {
    if (intento > 0) await esperar(ESPERAS_MS[intento - 1]);
    try {
      geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
        }),
      });
      errorDeRed = null;
    } catch (err) {
      errorDeRed = err;
      console.warn(`Error de red llamando a Gemini (intento ${intento + 1}):`, err.message);
      continue;
    }
    if (geminiResponse.status !== 503 && geminiResponse.status !== 429) break;
    console.warn(`Gemini saturado (${geminiResponse.status}), intento ${intento + 1} de ${ESPERAS_MS.length + 1}.`);
  }

  if (errorDeRed) {
    console.error('Error de red llamando a Gemini (todos los intentos):', errorDeRed.message);
    return res.status(500).json({ error: 'No se pudo contactar al Guardián. Probá de nuevo en un momento.' });
  }

  if (geminiResponse.status === 503 || geminiResponse.status === 429) {
    console.error('Gemini sigue saturado después de los reintentos:', geminiResponse.status);
    return res.status(500).json({ error: 'El Guardián está atendiendo a muchos visitantes en este momento. Esperá un instante y volvé a intentar.' });
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
