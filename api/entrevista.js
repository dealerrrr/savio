// Endpoint serverless de Vercel para el formulario de "pedir una charla" (/entrevista/).
//
// Recibe { nombre, email, whatsapp, mayorEdad } desde main.js y envía un
// email a la logia con los datos, usando la API de Brevo. No guarda nada
// en ningún servidor propio ni en una base de datos: el mail es el único
// destino de los datos. La BREVO_API_KEY vive solo acá (variable de
// entorno del servidor) y nunca se expone al navegador.
//
// Requiere, en Vercel:
//   BREVO_API_KEY    → clave API transaccional de la cuenta de Brevo.
//   BREVO_FROM       → remitente verificado en Brevo (ej. "Logia Savio <formulario@lasavio.com.ar>").
//                       El dominio tiene que estar autenticado en Brevo antes de que esto funcione.
//   CONTACTO_EMAIL   → casilla de la logia que recibe el pedido (default: info@lasavio.com.ar).
//
// Contrato:
//   POST /api/entrevista
//   body:  { nombre: string, email: string, whatsapp: string, mayorEdad: boolean }
//   200:   { ok: true }
//   4xx/5xx: { error: string }

const { verificarTurnstile } = require('../lib/turnstile');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const CONTACTO_EMAIL_DEFAULT = 'info@lasavio.com.ar';

// Acepta tanto "Nombre <email@dominio.com>" como "email@dominio.com" a secas,
// para no atarse a un formato particular de la variable de entorno.
const parsearRemitente = (valor) => {
  const match = /^(.*)<(.+)>$/.exec(valor || '');
  if (match) {
    return { name: match[1].trim() || undefined, email: match[2].trim() };
  }
  return { email: (valor || '').trim() };
};

const MAX_NOMBRE = 100;
const MAX_WHATSAPP = 40;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escaparHtml = (texto) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM;
  if (!apiKey || !from) {
    console.error('BREVO_API_KEY o BREVO_FROM no están configuradas.');
    return res.status(500).json({ error: 'El formulario no está disponible en este momento.' });
  }
  const contacto = process.env.CONTACTO_EMAIL || CONTACTO_EMAIL_DEFAULT;

  const body = req.body || {};
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';
  const mayorEdad = body.mayorEdad === true;
  const turnstileToken = body.turnstileToken;

  if (!nombre || nombre.length > MAX_NOMBRE) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'El email no es válido.' });
  }
  if (!whatsapp || whatsapp.length > MAX_WHATSAPP) {
    return res.status(400).json({ error: 'El WhatsApp es obligatorio.' });
  }
  if (!mayorEdad) {
    return res.status(400).json({ error: 'Este espacio es para mayores de edad.' });
  }

  const remoteip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;
  const verificacion = await verificarTurnstile(turnstileToken, remoteip);
  if (!verificacion.ok) {
    return res.status(403).json({ error: verificacion.error });
  }

  const asunto = `Pedido de charla — ${nombre}`;
  const texto = [
    'Nuevo pedido de charla desde lasavio.com.ar/entrevista/',
    '',
    `Nombre: ${nombre}`,
    `Email: ${email}`,
    `WhatsApp: ${whatsapp}`,
    'Declaró ser mayor de edad: sí',
  ].join('\n');
  const html = `
    <p>Nuevo pedido de charla desde <strong>lasavio.com.ar/entrevista/</strong></p>
    <ul>
      <li><strong>Nombre:</strong> ${escaparHtml(nombre)}</li>
      <li><strong>Email:</strong> ${escaparHtml(email)}</li>
      <li><strong>WhatsApp:</strong> ${escaparHtml(whatsapp)}</li>
      <li><strong>Declaró ser mayor de edad:</strong> sí</li>
    </ul>
  `.trim();

  let brevoResponse;
  try {
    brevoResponse = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: parsearRemitente(from),
        to: [{ email: contacto }],
        replyTo: { email },
        subject: asunto,
        textContent: texto,
        htmlContent: html,
      }),
    });
  } catch (err) {
    console.error('Error de red llamando a Brevo:', err.message);
    return res.status(502).json({ error: 'No se pudo enviar el pedido. Probá de nuevo en un momento.' });
  }

  if (!brevoResponse.ok) {
    const errorBody = await brevoResponse.text().catch(() => '');
    console.error('Brevo respondió con error:', brevoResponse.status, errorBody);
    return res.status(502).json({ error: 'No se pudo enviar el pedido. Probá de nuevo en un momento.' });
  }

  return res.status(200).json({ ok: true });
};
