// Endpoint serverless de Vercel para el formulario de "pedir una charla" (/entrevista/).
//
// Recibe { nombre, email, whatsapp, mayorEdad } desde main.js y envía un
// email a la logia con los datos, usando la API de Resend. No guarda nada
// en ningún servidor propio ni en una base de datos: el mail es el único
// destino de los datos. La RESEND_API_KEY vive solo acá (variable de
// entorno del servidor) y nunca se expone al navegador.
//
// Requiere, en Vercel:
//   RESEND_API_KEY   → clave de la cuenta de Resend.
//   RESEND_FROM      → remitente verificado en Resend (ej. "Logia Savio <formulario@lasavio.com.ar>").
//                       El dominio tiene que estar verificado en Resend antes de que esto funcione.
//   CONTACTO_EMAIL   → casilla de la logia que recibe el pedido (default: info@lasavio.com.ar).
//
// Contrato:
//   POST /api/entrevista
//   body:  { nombre: string, email: string, whatsapp: string, mayorEdad: boolean }
//   200:   { ok: true }
//   4xx/5xx: { error: string }

const RESEND_URL = 'https://api.resend.com/emails';
const CONTACTO_EMAIL_DEFAULT = 'info@lasavio.com.ar';

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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.error('RESEND_API_KEY o RESEND_FROM no están configuradas.');
    return res.status(500).json({ error: 'El formulario no está disponible en este momento.' });
  }
  const contacto = process.env.CONTACTO_EMAIL || CONTACTO_EMAIL_DEFAULT;

  const body = req.body || {};
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';
  const mayorEdad = body.mayorEdad === true;

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

  let resendResponse;
  try {
    resendResponse = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [contacto],
        reply_to: email,
        subject: asunto,
        text: texto,
        html,
      }),
    });
  } catch (err) {
    console.error('Error de red llamando a Resend:', err.message);
    return res.status(502).json({ error: 'No se pudo enviar el pedido. Probá de nuevo en un momento.' });
  }

  if (!resendResponse.ok) {
    const errorBody = await resendResponse.text().catch(() => '');
    console.error('Resend respondió con error:', resendResponse.status, errorBody);
    return res.status(502).json({ error: 'No se pudo enviar el pedido. Probá de nuevo en un momento.' });
  }

  return res.status(200).json({ ok: true });
};
