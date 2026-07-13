export default function middleware(request) {
  if (process.env.SITE_PROTECTED === 'false') return; // para desactivar sin tocar código

  const auth = request.headers.get('authorization');

  if (auth?.startsWith('Basic ')) {
    try {
      const [user, pass] = atob(auth.slice(6)).split(':');
      if (user === process.env.SITE_USER && pass === process.env.SITE_PASSWORD) {
        return; // credenciales OK, sigue a la página normal
      }
    } catch {}
  }

  return new Response('Acceso restringido', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Acceso restringido"' },
  });
}

export const config = {
  matcher: ['/((?!api/).*)'],
};