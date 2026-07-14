(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Analítica (Umami, sin cookies): no-op si el script no cargó o está bloqueado.
  const track = (evento, datos) => {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(evento, datos);
    }
  };

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
    // La lectura inicial de scrollY va en un frame propio para no forzar un reflow durante la carga.
    requestAnimationFrame(ocultarEnScroll);
  }

  // 4. Menú móvil (hamburguesa).
  const hamburguesa = document.querySelector('.hamburguesa');
  const panelMovil = document.getElementById('panel-movil');
  if (hamburguesa && panelMovil) {
    const cerrarPanel = () => {
      hamburguesa.setAttribute('aria-expanded', 'false');
      panelMovil.hidden = true;
    };

    hamburguesa.addEventListener('click', () => {
      const abierto = hamburguesa.getAttribute('aria-expanded') === 'true';
      hamburguesa.setAttribute('aria-expanded', String(!abierto));
      panelMovil.hidden = abierto;
    });

    // Las anclas navegan dentro de la misma página: cerrar el panel al elegir.
    panelMovil.querySelectorAll('a').forEach((enlace) => {
      enlace.addEventListener('click', cerrarPanel);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && hamburguesa.getAttribute('aria-expanded') === 'true') {
        cerrarPanel();
      }
    });
  }

  // 5. Analítica del embudo de la landing.
  // Primera vista de cada sección: dónde llega y dónde abandona el visitante.
  // rootMargin en lugar de threshold: las secciones son más altas que el
  // viewport y nunca llegarían a un porcentaje de visibilidad de sí mismas.
  document.querySelectorAll('#verdad, #legado, #guardian').forEach((seccion) => {
    const observador = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        track('seccion_vista', { seccion: seccion.id });
        observador.disconnect();
      }
    }, { rootMargin: '0px 0px -30% 0px' });
    observador.observe(seccion);
  });

  const ctaHero = document.querySelector('.hero a.boton');
  if (ctaHero) {
    ctaHero.addEventListener('click', () => track('cta_hero'));
  }

  // Qué mito atrae más lecturas.
  const faqs = document.querySelectorAll('details[name="faq"]');
  faqs.forEach((faq) => {
    faq.addEventListener('toggle', () => {
      if (!faq.open) return;
      const resumen = faq.querySelector('summary');
      track('faq_abierta', { pregunta: resumen ? resumen.textContent.trim() : '' });
      // Fallback de acordeón exclusivo para navegadores sin soporte de `name`
      // en <details> (Safari < iOS 17.2, Firefox < 130): cerrar los demás al
      // abrir uno. En navegadores modernos es inocuo: el cierre nativo ya
      // ocurrió y no queda nada abierto que cerrar.
      faqs.forEach((otro) => {
        if (otro !== faq && otro.open) otro.open = false;
      });
    });
  });

  // Qué CTA lleva al Guardián.
  document.querySelectorAll('a[href="#guardian"], a[href="/#guardian"]').forEach((enlace) => {
    enlace.addEventListener('click', () => {
      track('guardian_cta_click', { origen: enlace.classList.contains('fab-guardian') ? 'flotante' : 'menu' });
    });
  });

  // Conversiones alternativas al formulario.
  document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach((enlace) => {
    enlace.addEventListener('click', () => {
      track('contacto_click', { tipo: enlace.getAttribute('href').startsWith('tel:') ? 'telefono' : 'email' });
    });
  });

  // 6. Turnstile diferido: el widget solo se usa en el chat (al final de la
  // página), así que el script (~490 KB con su challenge) no se carga en el
  // arranque sino cuando el visitante se acerca al chat o enfoca el input.
  // La página /admision/ mantiene su propia etiqueta <script> porque ahí el
  // formulario es el contenido principal.
  let turnstileCargado = false;
  const cargarTurnstile = () => {
    if (turnstileCargado) return;
    turnstileCargado = true;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    document.head.appendChild(s);
  };
  if (guardian && 'IntersectionObserver' in window) {
    const obsTurnstile = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        obsTurnstile.disconnect();
        cargarTurnstile();
      }
    }, { rootMargin: '1500px 0px' });
    obsTurnstile.observe(guardian);
  } else {
    // Sin IntersectionObserver: comportamiento previo, cargar de entrada.
    cargarTurnstile();
  }

  // 7. Chat del Guardián: habilita el formulario y conecta con /api/chat.
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
      burbuja.className = clase ? `burbuja burbuja--nueva ${clase}` : 'burbuja burbuja--nueva';
      burbuja.textContent = texto;
      chatCuerpo.appendChild(burbuja);
      chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
      return burbuja;
    };

    // Indicador de escritura: tres puntos dorados con onda secuencial (texto para lectores de pantalla).
    const agregarIndicador = () => {
      const burbuja = document.createElement('div');
      burbuja.className = 'burbuja burbuja--nueva burbuja--cargando';
      for (let i = 0; i < 3; i += 1) {
        const punto = document.createElement('span');
        punto.className = 'punto';
        burbuja.appendChild(punto);
      }
      const anuncio = document.createElement('span');
      anuncio.className = 'visually-hidden';
      anuncio.textContent = 'El Guardián está escribiendo';
      burbuja.appendChild(anuncio);
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

    // Refuerzo del diferido: si el visitante llega al input por cualquier
    // camino (teclado, enlace directo), asegura que Turnstile esté cargado.
    chatForm.addEventListener('focusin', cargarTurnstile, { once: true });

    // Burbujas de apertura pendientes (detalle + cierre): se revelan en
    // cadena con indicador de escritura cuando el chat entra en el viewport
    // (~40% visible), para que el visitante vea la transición al llegar.
    const pendientes = ['guardian-detalle', 'guardian-cierre']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (pendientes.length) {
      const revelarUna = (burbuja) => new Promise((resolve) => {
        if (reducedMotion) {
          burbuja.classList.remove('burbuja--pendiente');
          chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
          resolve();
          return;
        }
        const indicador = agregarIndicador();
        setTimeout(() => {
          indicador.remove();
          burbuja.classList.add('burbuja--nueva');
          burbuja.classList.remove('burbuja--pendiente');
          chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
          resolve();
        }, 900);
      });

      const revelarCadena = async () => {
        for (const burbuja of pendientes) {
          await revelarUna(burbuja);
          if (!reducedMotion) await new Promise((r) => setTimeout(r, 900));
        }
      };

      let cadenaIniciada = false;
      const iniciarCadena = () => {
        if (cadenaIniciada) return;
        cadenaIniciada = true;
        setTimeout(revelarCadena, 500);
      };

      const chatWidget = chatCuerpo.closest('.chat') || chatCuerpo;
      if ('IntersectionObserver' in window) {
        const observador = new IntersectionObserver((entradas) => {
          if (entradas.some((e) => e.isIntersecting)) {
            observador.disconnect();
            iniciarCadena();
          }
        }, { threshold: 0.4 });
        observador.observe(chatWidget);
      } else {
        // Fallback para navegadores sin IntersectionObserver: comportamiento
        // previo, revelar al cargar.
        iniciarCadena();
      }
    }

    // Capa 2 del PLAN-GUARDIAN-WORLD-CLASS.md (resiliencia de la conversación):
    // nunca perder el mensaje, auto-reintento en personaje, fix de la carrera
    // de Turnstile y degradación elegante al formulario.
    const TOPE_HISTORIAL = 40;      // debe coincidir con MAX_HISTORY_TURNS del server
    const MAX_INTENTOS = 2;         // reintentos automáticos antes de mostrar el fallo
    const ESPERA_REINTENTO_MS = 1200;
    const URL_ADMISION = 'https://lasavio.com.ar/admision/';
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

    // Fix de la carrera de Turnstile: tras cada envío reseteamos el widget para
    // pedir un token nuevo, pero getResponse() devuelve '' hasta que ese token
    // está listo. Leerlo a ciegas hacía que el 2.º mensaje rápido saliera sin
    // token y el server respondiera 403 "Falta verificación". Acá esperamos a
    // que haya token fresco (hasta 3s) antes de enviar.
    const esperarToken = async (timeoutMs = 3000) => {
      if (!window.turnstile) return undefined;
      const inicio = Date.now();
      let token = window.turnstile.getResponse();
      while (!token && Date.now() - inicio < timeoutMs) {
        await esperar(100);
        token = window.turnstile.getResponse();
      }
      return token || undefined;
    };

    // Degradación elegante: si toda la cadena falla, el Guardián no abandona.
    // Ofrece Reintentar (reenvía el mismo mensaje, que no se pierde) y el camino
    // alternativo al formulario de admisión. La conversión no depende de que el
    // modelo esté vivo.
    const mostrarFallo = (mensaje) => {
      const burbuja = document.createElement('div');
      burbuja.className = 'burbuja burbuja--nueva burbuja--fallo';

      const texto = document.createElement('p');
      texto.className = 'burbuja-texto';
      texto.textContent = 'El Guardián no pudo responder en este momento. Podés intentarlo de nuevo o dejar tu inquietud en el formulario de admisión.';
      burbuja.appendChild(texto);

      const acciones = document.createElement('div');
      acciones.className = 'burbuja-acciones';

      const reintentar = document.createElement('button');
      reintentar.type = 'button';
      reintentar.className = 'burbuja-reintentar';
      reintentar.textContent = 'Reintentar';
      reintentar.addEventListener('click', () => {
        burbuja.remove();
        // nuevaBurbuja:false porque la burbuja del visitante ya está en pantalla.
        enviarMensaje(mensaje, { nuevaBurbuja: false });
      });
      acciones.appendChild(reintentar);

      const alternativa = document.createElement('a');
      alternativa.className = 'burbuja-alternativa';
      alternativa.href = URL_ADMISION;
      alternativa.textContent = 'Ir al formulario';
      acciones.appendChild(alternativa);

      burbuja.appendChild(acciones);
      chatCuerpo.appendChild(burbuja);
      chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
    };

    // Envía un mensaje con reintentos automáticos "en personaje": el indicador
    // de escritura se mantiene entre intentos, así el visitante no ve los fallos
    // transitorios, solo una respuesta apenas más lenta. Tras MAX_INTENTOS sin
    // éxito, muestra la burbuja de fallo. El mensaje nunca se pierde.
    const enviarMensaje = async (mensaje, { nuevaBurbuja = true } = {}) => {
      if (nuevaBurbuja) agregarBurbuja(mensaje, 'burbuja--visitante');
      alternarEnvio(true);
      const indicador = agregarIndicador();

      let ok = false;
      let ultimoStatus = 0;

      for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        if (intento > 1) await esperar(ESPERA_REINTENTO_MS);

        const turnstileToken = await esperarToken();

        let respuesta;
        try {
          respuesta = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: mensaje, history: historial, convId, turnstileToken }),
          });
        } catch (err) {
          // Error de red: reintentar con token nuevo.
          ultimoStatus = 0;
          if (window.turnstile) window.turnstile.reset();
          continue;
        }

        if (respuesta.status === 403) {
          // Token vencido o ausente: pedimos uno nuevo y reintentamos.
          ultimoStatus = 403;
          if (window.turnstile) window.turnstile.reset();
          continue;
        }

        const datos = await respuesta.json().catch(() => ({}));

        if (respuesta.ok && typeof datos.reply === 'string') {
          indicador.remove();
          agregarBurbuja(datos.reply);
          historial.push({ role: 'user', text: mensaje });
          historial.push({ role: 'model', text: datos.reply });
          // Tope de historial en cliente (PLAN, sección 5.4): no crece sin fin.
          if (historial.length > TOPE_HISTORIAL) {
            historial.splice(0, historial.length - TOPE_HISTORIAL);
          }
          // Micro-conversión clave: el Guardián derivó al formulario de entrevista.
          if (/entrevista/i.test(datos.reply)) track('guardian_derivacion');
          ok = true;
          break;
        }

        // Error del server (500, 400, etc.): reintentar con token nuevo.
        ultimoStatus = respuesta.status;
        if (window.turnstile) window.turnstile.reset();
      }

      if (!ok) {
        indicador.remove();
        // Observabilidad (PLAN, capa 5): cada fallo visible queda medido para
        // poder calcular la disponibilidad real.
        track('guardian_error', { status: ultimoStatus });
        mostrarFallo(mensaje);
      }

      if (window.turnstile) window.turnstile.reset();
      alternarEnvio(false);
      if (chatInput) chatInput.focus({ preventScroll: true });
    };

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (enviando || !chatInput) return;

      const mensaje = chatInput.value.trim();
      if (!mensaje) return;

      if (historial.length === 0) track('guardian_primer_mensaje');
      track('guardian_mensaje');

      chatInput.value = '';
      enviarMensaje(mensaje);
    });
  }

  // 8. Formulario de /admision/: envía por fetch a /api/admision.
  const formAdmision = document.getElementById('form-admision');
  if (formAdmision) {
    // Empezó a completar: la brecha inicio→envío mide si el formulario espanta.
    formAdmision.addEventListener('focusin', () => track('form_inicio'), { once: true });

    const boton = formAdmision.querySelector('button[type="submit"]');
    const mensaje = formAdmision.querySelector('.mensaje-estado');
    let enviandoForm = false;

    const mostrarMensaje = (texto, clase) => {
      if (!mensaje) return;
      mensaje.textContent = texto;
      mensaje.className = clase ? `mensaje-estado ${clase}` : 'mensaje-estado';
      mensaje.hidden = false;
    };

    formAdmision.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (enviandoForm) return;

      const nombre = formAdmision.nombre.value.trim();
      const email = formAdmision.email.value.trim();
      const whatsapp = formAdmision.whatsapp.value.trim();
      const mayorEdad = formAdmision.mayorEdad.checked;

      const turnstileToken = window.turnstile ? window.turnstile.getResponse() : undefined;

      enviandoForm = true;
      if (boton) boton.disabled = true;
      mostrarMensaje('Enviando…');

      try {
        const respuesta = await fetch('/api/admision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email, whatsapp, mayorEdad, turnstileToken }),
        });
        const datos = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok || !datos.ok) {
          track('form_error');
          mostrarMensaje(datos.error || 'No se pudo enviar el pedido. Probá de nuevo en un momento.', 'mensaje-estado--error');
          return;
        }

        track('form_envio');
        mostrarMensaje('Listo, ahora solo queda esperar. Alguien de la logia te va a escribir a la brevedad posible.', 'mensaje-estado--ok');
        formAdmision.reset();
      } catch (err) {
        track('form_error');
        mostrarMensaje('No se pudo conectar. Revisá tu conexión y probá de nuevo.', 'mensaje-estado--error');
      } finally {
        if (window.turnstile) window.turnstile.reset();
        enviandoForm = false;
        if (boton) boton.disabled = false;
      }
    });
  }

  // 9. Revelado por scroll: pausado y una sola vez, anulado con reduced-motion.
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revelables = document.querySelectorAll(
      '#verdad .overline, #verdad .titulo-seccion, #verdad .bajada, #verdad details, #verdad .puente,' +
      '#legado .overline, #legado .titulo-seccion, #legado .bajada, #legado figure, #legado p, #legado .legado-sub, #legado blockquote,' +
      '#guardian .overline, #guardian .titulo-seccion, #guardian .bajada, #guardian .chat, #guardian .nota-fase'
    );
    revelables.forEach((el) => el.classList.add('revelar'));
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revelado');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    revelables.forEach((el) => obs.observe(el));
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
