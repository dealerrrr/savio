(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hero = document.getElementById('hero');

  // 2. Botón flotante «Preguntale al Guardián».
  const fab = document.querySelector('.fab-guardian');
  const guardian = document.getElementById('guardian');
  if (fab && hero && guardian) {
    let heroVisible = true;
    let guardianVisible = false;

    const actualizarFab = () => {
      fab.classList.toggle('visible', !heroVisible && !guardianVisible);
    };

    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      actualizarFab();
    }, { threshold: 0 }).observe(hero);

    new IntersectionObserver(([entry]) => {
      guardianVisible = entry.isIntersecting;
      actualizarFab();
    }, { threshold: 0.2 }).observe(guardian);

    fab.addEventListener('click', (e) => {
      e.preventDefault();
      guardian.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      const input = guardian.querySelector('input');
      if (input) input.focus({ preventScroll: true });
    });
  }

  // 3. Indicador de scroll del hero: ancla + desvanecido al empezar a bajar.
  const scrollHint = document.querySelector('.scroll-hint');
  if (scrollHint) {
    const ocultarEnScroll = () => {
      scrollHint.classList.toggle('oculto', window.scrollY > 40);
    };
    window.addEventListener('scroll', ocultarEnScroll, { passive: true });
    ocultarEnScroll();
  }

  // 4. Menú móvil (hamburguesa) + desplegable «Legado» (desktop y móvil).
  const hamburguesa = document.querySelector('.hamburguesa');
  const panelMovil = document.getElementById('panel-movil');
  if (hamburguesa && panelMovil) {
    hamburguesa.addEventListener('click', () => {
      const abierto = hamburguesa.getAttribute('aria-expanded') === 'true';
      hamburguesa.setAttribute('aria-expanded', String(!abierto));
      panelMovil.hidden = abierto;
    });
  }

  document.querySelectorAll('.nav-desplegable__trigger').forEach((trigger) => {
    const panelId = trigger.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const alternar = () => {
      const abierto = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!abierto));
      panel.hidden = abierto;
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      alternar();
    });
  });

  document.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-desplegable__trigger[aria-expanded="true"]').forEach((trigger) => {
      if (trigger.contains(e.target)) return;
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (panel && !panel.contains(e.target)) {
        trigger.setAttribute('aria-expanded', 'false');
        panel.hidden = true;
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.nav-desplegable__trigger[aria-expanded="true"]').forEach((trigger) => {
      trigger.setAttribute('aria-expanded', 'false');
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (panel) panel.hidden = true;
    });
    if (hamburguesa && hamburguesa.getAttribute('aria-expanded') === 'true') {
      hamburguesa.setAttribute('aria-expanded', 'false');
      panelMovil.hidden = true;
    }
  });

  // 5. Chat del Guardián: habilita el formulario y conecta con /api/chat.
  const chatForm = document.querySelector('.chat-pie');
  const chatCuerpo = document.querySelector('.chat-cuerpo');
  if (chatForm && chatCuerpo) {
    const chatInput = chatForm.querySelector('input');
    const chatBoton = chatForm.querySelector('button');
    const historial = [];
    let enviando = false;

    // Id efímero de conversación: solo agrupa los turnos de esta charla para
    // poder revisarla; se genera de nuevo en cada carga de página, no se
    // guarda en cookie ni almacenamiento persistente y no identifica al
    // visitante.
    const convId = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const agregarBurbuja = (texto, clase) => {
      const burbuja = document.createElement('div');
      burbuja.className = clase ? `burbuja ${clase}` : 'burbuja';
      burbuja.textContent = texto;
      chatCuerpo.appendChild(burbuja);
      chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
      return burbuja;
    };

    const alternarEnvio = (activo) => {
      enviando = activo;
      if (chatInput) chatInput.disabled = activo;
      if (chatBoton) chatBoton.disabled = activo;
    };

    if (chatInput) chatInput.disabled = false;
    if (chatBoton) chatBoton.disabled = false;

    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (enviando || !chatInput) return;

      const mensaje = chatInput.value.trim();
      if (!mensaje) return;

      agregarBurbuja(mensaje, 'burbuja--visitante');
      chatInput.value = '';
      alternarEnvio(true);
      const indicador = agregarBurbuja('Escribiendo…', 'burbuja--cargando');

      try {
        const respuesta = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: mensaje, history: historial, convId }),
        });
        const datos = await respuesta.json().catch(() => ({}));
        indicador.remove();

        if (!respuesta.ok || typeof datos.reply !== 'string') {
          agregarBurbuja(datos.error || 'El Guardián no pudo responder. Probá de nuevo en un momento.');
          return;
        }

        agregarBurbuja(datos.reply);
        historial.push({ role: 'user', text: mensaje });
        historial.push({ role: 'model', text: datos.reply });
      } catch (err) {
        indicador.remove();
        agregarBurbuja('No se pudo conectar con el Guardián. Revisá tu conexión y probá de nuevo.');
      } finally {
        alternarEnvio(false);
        chatInput.focus({ preventScroll: true });
      }
    });
  }

  // 6. Formulario de /entrevista/: envía por fetch a /api/entrevista.
  const formEntrevista = document.getElementById('form-entrevista');
  if (formEntrevista) {
    const boton = formEntrevista.querySelector('button[type="submit"]');
    const mensaje = formEntrevista.querySelector('.mensaje-estado');
    let enviandoForm = false;

    const mostrarMensaje = (texto, clase) => {
      if (!mensaje) return;
      mensaje.textContent = texto;
      mensaje.className = clase ? `mensaje-estado ${clase}` : 'mensaje-estado';
      mensaje.hidden = false;
    };

    formEntrevista.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (enviandoForm) return;

      const nombre = formEntrevista.nombre.value.trim();
      const email = formEntrevista.email.value.trim();
      const whatsapp = formEntrevista.whatsapp.value.trim();
      const mayorEdad = formEntrevista.mayorEdad.checked;

      enviandoForm = true;
      if (boton) boton.disabled = true;
      mostrarMensaje('Enviando…');

      try {
        const respuesta = await fetch('/api/entrevista', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email, whatsapp, mayorEdad }),
        });
        const datos = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok || !datos.ok) {
          mostrarMensaje(datos.error || 'No se pudo enviar el pedido. Probá de nuevo en un momento.', 'mensaje-estado--error');
          return;
        }

        mostrarMensaje('Listo. Te vamos a contactar a la brevedad para coordinar la charla.', 'mensaje-estado--ok');
        formEntrevista.reset();
      } catch (err) {
        mostrarMensaje('No se pudo conectar. Revisá tu conexión y probá de nuevo.', 'mensaje-estado--error');
      } finally {
        enviandoForm = false;
        if (boton) boton.disabled = false;
      }
    });
  }

  // Enlaces externos: siempre en pestaña nueva.
  const host = window.location.hostname;
  document.querySelectorAll('a[href^="http"]').forEach((a) => {
    try {
      const url = new URL(a.href);
      if (url.hostname && url.hostname !== host) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    } catch (_) { /* href inválido, ignorar */ }
  });
})();
