// Verificación server-side de Cloudflare Turnstile, compartida por
// api/chat.js y api/admision.js.
//
// Fail-open: si TURNSTILE_SECRET_KEY no está configurada (por ejemplo,
// mientras se completa el alta en Vercel), la verificación se omite y la
// función deja pasar la solicitud, para no romper el sitio en producción
// antes de que la clave esté cargada. Una vez cargada la clave, cualquier
// token ausente o inválido rechaza la solicitud.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verificarTurnstile(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY no está configurada: se omite la verificación de Turnstile.');
    return { ok: true, omitido: true };
  }

  if (typeof token !== 'string' || token.length === 0) {
    return { ok: false, error: 'Falta la verificación de seguridad. Recargá la página e intentá de nuevo.' };
  }

  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteip) body.append('remoteip', remoteip);

  try {
    const respuesta = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    const datos = await respuesta.json().catch(() => ({}));

    if (!datos.success) {
      console.error('Turnstile rechazó el token:', JSON.stringify(datos['error-codes'] || datos));
      return { ok: false, error: 'No se pudo verificar que sos una persona. Recargá la página e intentá de nuevo.' };
    }

    return { ok: true, omitido: false };
  } catch (err) {
    console.error('Error de red verificando Turnstile:', err.message);
    // Si Cloudflare no responde, se prioriza no bloquear al visitante legítimo.
    return { ok: true, omitido: true };
  }
}

module.exports = { verificarTurnstile };
