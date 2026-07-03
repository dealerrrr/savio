// Endpoint serverless de Vercel para el Guardián del Templo.
//
// Recibe { message, history } desde main.js, arma el pedido a la API de
// Gemini con la system instruction de lib/guardian-system-prompt.js y
// devuelve la respuesta del modelo. La GEMINI_API_KEY vive solo acá
// (variable de entorno del servidor) y nunca se expone al navegador.
//
// Contrato:
//   POST /api/chat
//   body:  { message: string, history: Array<{ role: 'user' | 'model', text: string }> }
//   200:   { reply: string }
//   4xx/5xx: { error: string }

const { SYSTEM_INSTRUCTION } = require('../lib/guardian-system-prompt');

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 40;

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
  const { message, history } = body;

  if (typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Falta el mensaje.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `El mensaje supera los ${MAX_MESSAGE_LENGTH} caracteres.` });
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

  let geminiResponse;
  try {
    geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
      }),
    });
  } catch (err) {
    console.error('Error de red llamando a Gemini:', err.message);
    return res.status(502).json({ error: 'No se pudo contactar al Guardián. Probá de nuevo en un momento.' });
  }

  if (!geminiResponse.ok) {
    const errorBody = await geminiResponse.text().catch(() => '');
    console.error('Gemini respondió con error:', geminiResponse.status, errorBody);
    return res.status(502).json({ error: 'El Guardián tuvo un problema para responder. Probá de nuevo en un momento.' });
  }

  let data;
  try {
    data = await geminiResponse.json();
  } catch (err) {
    console.error('Respuesta de Gemini no es JSON válido:', err.message);
    return res.status(502).json({ error: 'El Guardián tuvo un problema para responder. Probá de nuevo en un momento.' });
  }

  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== 'string' || reply.trim().length === 0) {
    console.error('Respuesta de Gemini sin texto utilizable:', JSON.stringify(data).slice(0, 500));
    return res.status(502).json({ error: 'El Guardián no pudo generar una respuesta. Probá reformular tu pregunta.' });
  }

  return res.status(200).json({ reply });
};
