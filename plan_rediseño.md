# Plan de rediseño visual · Landing lasavio.com.ar

> **Ejecutor previsto:** Claude Sonnet en otra sesión. Este documento debe guardarse como `plan_rediseño.md` en la raíz del proyecto.
> **Objetivo:** rediseño visualmente exquisito, elegante y sobrio, con detalles de "alta relojería", manteniendo la identidad masónica, el 100 % del contenido actual y el sistema de diseño base (tokens, paleta noche/oro, Cormorant Garamond + Inter).

---

## Contexto

La landing actual (`index.html` + `styles.css` + `main.js`) es sólida en estructura, accesibilidad y performance, pero visualmente plana: todo el texto pesa igual, los separadores de sección son un `border-bottom` uniforme, el footer es una lista centrada sin carácter, y no hay movimiento ni microinteracciones que acompañen la narrativa ("entrar a un templo"). El rediseño trabaja exclusivamente la capa de presentación: no se toca contenido, SEO, analítica, API ni seguridad.

**Stack y restricciones duras (no negociables):**

- Sitio estático en Vercel. **Cero dependencias nuevas**: nada de librerías (ni ScrollReveal.js ni similares), nada de CDN adicionales. Todo el movimiento se hace con CSS + `IntersectionObserver` vanilla.
- Fuentes self-hosted existentes: Cormorant Garamond 600 y Inter variable 300–500. No agregar pesos ni familias.
- Paleta: solo los tokens existentes de `styles.css` (`--c-bg #0c0e13`, `--c-surface-1/2`, `--c-border`, `--c-text`, `--c-muted`, `--c-faint`, `--c-accent #b08d4f`, `--c-accent-2 #c9a868`). Se permiten **derivados con alpha** de esos mismos valores (ej. `rgba(176,141,79,.25)`).
- Todo el contenido textual queda **verbatim** (única excepción puntual y controlada: la cita de Savio, ver Paso 3.4, ya aprobada por el usuario).
- `main.js` usa selectores que NO deben romperse: `.fab-guardian`, `.scroll-hint`, `.hamburguesa`, `#panel-movil`, `#verdad/#legado/#guardian`, `.hero a.boton`, `details[name="faq"]`, `a[href="#guardian"]`, `.chat-pie`, `.chat-cuerpo`, `.burbuja*`, `#form-entrevista`. Los eventos Umami (`track(...)`) quedan intactos.
- Accesibilidad: mantener skip-link, `aria-*`, foco visible (se mejora, no se quita), y **todo movimiento anulado bajo `prefers-reduced-motion: reduce`**.
- El JSON-LD, los meta tags, Turnstile y Umami no se tocan.
- Las páginas `/entrevista/` y `/privacidad/` comparten `styles.css`: verificar que ningún cambio global las rompa (focus rings, botones, footer les aplican también, y está bien que hereden la mejora).

**Archivos a modificar:** `styles.css` (principal), `index.html` (marcado mínimo), `main.js` (bloque nuevo de reveal + indicador de escritura). Nada más.

---

## Paso 0 · En esta sesión, antes de ejecutar

1. Guardar este documento como `plan_rediseño.md` en la raíz del proyecto.

## Paso 1 · Preparación de tokens (styles.css, sección 1)

Agregar al bloque `:root` (sin borrar nada existente):

```css
/* --- Derivados de oro (alpha sobre --c-accent) --- */
--oro-08: rgba(176,141,79,.08);
--oro-15: rgba(176,141,79,.15);
--oro-25: rgba(176,141,79,.25);
--oro-40: rgba(176,141,79,.40);

/* --- Motion "alta relojería": lento, preciso, sin rebotes --- */
--ease-reloj: cubic-bezier(.22,.61,.36,1);
--dur-micro: .25s;   /* hovers, foco */
--dur-media: .5s;    /* despliegues, sheen */
--dur-lenta: .9s;    /* reveals de sección */

/* --- Filete dorado (gradiente que se desvanece a los lados) --- */
--filete-oro: linear-gradient(90deg, transparent, var(--oro-40) 18%, var(--c-accent) 50%, var(--oro-40) 82%, transparent);
```

Criterio general de movimiento: **una sola curva de easing en todo el sitio** (`--ease-reloj`), desplazamientos cortos (≤ 16 px), opacidades, nunca rebotes ni escalas mayores a 1.02. La elegancia sale de la consistencia, no de la variedad.

---

## Paso 2 · Ornamentación estructural

### 2.1 Separadores ornamentales entre secciones

Reemplazar el `border-bottom: 1px solid var(--c-border)` plano de `section` por un divisor ceremonial: línea fina que se desvanece hacia los lados con un **rombo dorado** en el centro (eco de la plomada del isotipo).

- En `section`: quitar `border-bottom`, agregar `position: relative` y un `::after` posicionado al fondo, centrado, `width: min(360px, 70%)`, `height: 9px`, con el ornamento como SVG inline en data-URI (línea + rombo, trazos en `#b08d4f`). SVG data-URI es autocontenido y pasa la CSP.
- El `.hero` conserva su `border-bottom` actual (la foto necesita el corte limpio) o recibe el mismo ornamento; decidir visualmente al verlo, empezar con el ornamento.
- La última sección (`#guardian`) no lleva ornamento (el footer trae el suyo, ver Fase 7).

SVG de referencia para el data-URI (ajustar al gusto):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 9">
  <line x1="0" y1="4.5" x2="150" y2="4.5" stroke="#b08d4f" stroke-width="1" opacity=".5"/>
  <line x1="210" y1="4.5" x2="360" y2="4.5" stroke="#b08d4f" stroke-width="1" opacity=".5"/>
  <rect x="175.5" y="0" width="9" height="9" transform="rotate(45 180 4.5)" fill="none" stroke="#b08d4f" stroke-width="1.2"/>
</svg>
```

(Para el desvanecido lateral, aplicar además una `mask-image: linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)` sobre el pseudo-elemento, o dibujar el fade dentro del propio SVG con gradientes.)

### 2.2 Filete bajo los títulos de sección

Bajo cada `.titulo-seccion`, un filete corto alineado a la izquierda que remata la jerarquía:

```css
.titulo-seccion::after{
  content:"";display:block;width:64px;height:1px;
  margin-top:var(--sp-4);
  background:linear-gradient(90deg, var(--c-accent), transparent);
}
```

En `#guardian` (texto centrado) el filete se centra: `margin-inline:auto` + gradiente simétrico.

### 2.3 Numeración de secciones en el overline

Toque masónico sobrio: numerar las tres secciones de contenido con romanos, integrados al overline existente. CSS puro con counters:

```css
main{counter-reset: seccion}
main section .overline{counter-increment: seccion}
main section .overline::before{
  content: counter(seccion, upper-roman) " · ";
  color: var(--c-faint);
  letter-spacing: 2.5px;
}
```

Nota: el overline del hero está fuera de `main > section`… verificar en el DOM real: el hero **sí** es `section` dentro de `main`, así que excluirlo con `section:not(.hero) .overline` y arrancar el counter en el hero o resetear después. Resultado esperado: `I · LA VERDAD SIN FILTROS`, `II · EL LEGADO`, `III · EL GUARDIÁN DEL TEMPLO`.

---

## Paso 3 · Jerarquía tipográfica y bloques de extracción

### 3.1 Los "puentes" como citas ceremoniales

Los `p.puente` ("Hasta acá, lo que no somos…", "Nuestra herencia está en las calles…") son los momentos de respiración narrativa. Elevarlos a bloque de extracción:

- Centrados, en Cormorant, cuerpo mayor (26–28 px), `line-height` amplio, color `--c-text`.
- Ornamento superior: una línea corta vertical dorada o el rombo pequeño del separador (`::before` centrado, 24 px de alto).
- Márgenes generosos (`--sp-8` arriba, `--sp-6` abajo) para que respiren.

### 3.2 Énfasis interior en Preguntas incómodas

Dentro de `.respuesta`, las frases-remate ya escritas ("No es un credo. Es un método.", "Para volverte un hombre mejor, este es el camino.", etc.) hoy se pierden en el gris `--c-muted`. Sin tocar el texto, envolver esas frases finales en `<em class="remate">` y estilar:

```css
.respuesta .remate{font-style:normal;color:var(--c-text);font-weight:400}
```

Frases a marcar (verificar contra el HTML, son los cierres de cada respuesta): "No es un credo. Es un método.", "Es un hecho histórico verificable." (si aparece en la landing; si no, omitir), "Para volverte un hombre mejor, este es el camino.", "Nosotros estamos en el centro, y si golpeás, quizás te abramos.", "No es para cualquiera, y esa es justamente la idea."

### 3.3 Cita destacada de Savio (única edición de marcado con reacomodo)

En el bloque Savio, extraer la cita a un `blockquote` para darle el peso que merece. El texto queda casi verbatim; solo se reacomoda la oración introductoria:

Antes:
```html
<p>San Nicolás creció con este ingeniero militar, que le dio su identidad de acero, convencido de que un país que no funde su propio metal queda a merced de otros. La industria del acero, dijo, «la necesitamos como hemos necesitado nuestra libertad política».</p>
```

Después:
```html
<p>San Nicolás creció con este ingeniero militar, que le dio su identidad de acero, convencido de que un país que no funde su propio metal queda a merced de otros. La industria del acero, dijo:</p>
<blockquote class="cita-savio">«La necesitamos como hemos necesitado nuestra libertad política.»</blockquote>
```

Estilo: Cormorant itálica 24 px, filete izquierdo dorado de 2 px, `padding-left: var(--sp-5)`, color `--c-text`. **Esta es la única alteración de texto del plan** (puntuación y mayúscula inicial) y está aprobada explícitamente por el usuario: ejecutarla tal cual.

---

## Paso 4 · Microinteracciones

### 4.1 Doble anillo de foco ("sello")

Sustituir el `outline` genérico por doble anillo: exterior dorado fino, interior oscuro (separa el anillo del contenido como un sello):

```css
a:focus-visible, button:focus-visible, summary:focus-visible,
input:focus-visible, [tabindex]:focus-visible{
  outline:none;
  box-shadow: 0 0 0 2px var(--c-bg), 0 0 0 3.5px var(--c-accent-2);
  border-radius:var(--r-sm);
}
```

Cuidado: elementos que ya tienen `box-shadow` propio (`.boton` en hover, `figure img`, `.chat`) necesitan la versión compuesta (`box-shadow: <anillos>, <sombra propia>`); revisar caso por caso. Aplica también a `/entrevista/` y `/privacidad/` (herencia deseada).

### 4.2 CTA con destello de metal pulido

Nuevo hover del `.boton` (reemplaza el simple cambio a `--c-accent-2`): el botón se eleva 1 px, gana un halo dorado tenue y un **sheen** (barrido de luz diagonal) lo recorre una vez, como luz sobre metal bruñido:

```css
.boton{position:relative;overflow:hidden}
.boton::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg, transparent 40%, rgba(236,233,226,.35) 50%, transparent 60%);
  transform:translateX(-130%);
}
.boton:hover{
  background:var(--c-accent-2);
  transform:translateY(-1px);
  box-shadow:0 8px 24px var(--oro-25);
}
.boton:hover::after{
  transform:translateX(130%);
  transition:transform var(--dur-media) var(--ease-reloj);
}
.boton:active{transform:translateY(0)}
```

(El `::after` sin transición en reposo hace que el sheen "resetee" instantáneo al salir y vuelva a barrer en el próximo hover.) La variante `.boton.linea` recibe solo el halo y el lift, sin sheen (sobre fondo transparente el barrido ensucia).

### 4.3 Acordeones: onda dorada y indicador giratorio

- El `+` del `summary::after` rota a `×`… no: mantener el lenguaje actual `+` → `–` pero con **transición de rotación** (el `+` gira 180° mientras funde al `–`): implementar cambiando el indicador a un par de barras CSS (dos pseudo-elementos o un solo `::after` con `background` de dos barras) donde la barra vertical rota 90° al abrir, con `transition: transform var(--dur-media) var(--ease-reloj)`. Resultado: el `+` se pliega en `–` de forma continua, sin salto de carácter.
- **Onda dorada al abrir** (sugerencia aceptada): al abrir un `details`, una onda radial tenue se expande desde el indicador y se disuelve:

```css
summary{position:relative}
summary::before{
  content:"";position:absolute;right:10px;top:50%;
  width:8px;height:8px;margin-top:-4px;border-radius:50%;
  background:radial-gradient(circle, var(--oro-40), transparent 70%);
  opacity:0;transform:scale(1);pointer-events:none;
}
details[open] summary::before{animation:onda-oro .7s var(--ease-reloj)}
@keyframes onda-oro{
  0%{opacity:.8;transform:scale(1)}
  100%{opacity:0;transform:scale(9)}
}
```

- Revelado del contenido: animar la apertura con la técnica moderna `interpolate-size: allow-keywords` + `transition: height` en `::details-content` (Chrome/Edge; degrada a apertura instantánea en el resto, aceptable), o fallback simple: `.respuesta{animation: aparecer .45s var(--ease-reloj)}` con fade + translateY(-4px) al abrir. Elegir la segunda si se quiere soporte parejo.
- Hover de `summary`: además del cambio de color actual, desplazamiento sutil `padding-left: 6px` con transición (el título "se acerca" al lector).

### 4.4 Enlaces de texto con subrayado vivo

Enlaces dentro de `.respuesta`, `.legado`, `.nota-fase` y footer: subrayado dorado que crece desde la izquierda:

```css
.respuesta a, .legado a, .nota-fase a, footer a{
  color:var(--c-accent-2);text-decoration:none;
  background-image:linear-gradient(var(--c-accent-2), var(--c-accent-2));
  background-size:0% 1px;background-position:0 100%;background-repeat:no-repeat;
  transition:background-size var(--dur-media) var(--ease-reloj);
}
.respuesta a:hover, .legado a:hover, .nota-fase a:hover, footer a:hover{
  background-size:100% 1px;
}
```

Los enlaces de la nav conservan el cambio de color actual (sobrio, correcto), pero se les agrega el mismo subrayado creciente en fino.

### 4.5 Imágenes

Hover sobre `figure img`: el borde dorado se intensifica (`border-color` de `--oro-40` al oro pleno) y la sombra crece apenas. Sin zoom ni escala: las fotos históricas piden quietud.

---

## Paso 5 · Movimiento: entrada al templo

### 5.1 Secuencia de apertura del hero (solo al cargar)

CSS puro, sin observer: overline → H1 → sub → CTA entran en cascada (fade + translateY(14px) → 0), duración `--dur-lenta`, delays escalonados 0 / 150 / 300 / 450 ms:

```css
.hero .overline, .hero h1, .hero .sub, .hero .boton{
  animation:entrada var(--dur-lenta) var(--ease-reloj) both;
}
.hero h1{animation-delay:.15s}
.hero .sub{animation-delay:.3s}
.hero .boton{animation-delay:.45s}
@keyframes entrada{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
```

### 5.2 Revelado por scroll (IntersectionObserver vanilla, sin librería)

Ritmo pausado, "como quien entra a un templo": cada sección revela sus piezas en secuencia lenta al entrar al viewport.

**main.js**, bloque nuevo (respetando el estilo del archivo: IIFE, comentarios en castellano, `reducedMotion` ya existe):

```js
// 8. Revelado por scroll: pausado y una sola vez, anulado con reduced-motion.
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
```

**styles.css:**

```css
.revelar{opacity:0;transform:translateY(16px);
  transition:opacity var(--dur-lenta) var(--ease-reloj), transform var(--dur-lenta) var(--ease-reloj)}
.revelar.revelado{opacity:1;transform:none}
```

Claves del enfoque:
- La clase `.revelar` se agrega **por JS**: sin JS (o con reduced-motion) todo es visible desde el primer render. Cero riesgo de contenido oculto.
- Elementos hermanos que entran juntos al viewport se escalonan solos por el orden natural del observer + un `transition-delay` incremental opcional vía `nth-child` en los `details` (0 / 90 / 180 / 270 / 360 ms). Mantenerlo ≤ 400 ms total: pausado, no lento.
- El ornamento separador (2.1) puede además "dibujarse" (scaleX 0 → 1 con `transform-origin: center`) cuando su sección se revela: mismo observer, misma clase.
- **No** observar elementos del hero (ya animan al cargar) ni el footer (siempre visible al llegar, animarlo se siente artificioso).
- Verificar que esto no interfiera con los `IntersectionObserver` de analítica existentes (son independientes, no comparten estado).

### 5.3 FAB del Guardián

Hoy aparece con fade de opacidad. Agregar `transform: translateY(8px)` en reposo → `none` en `.visible`, misma transición: aparece "subiendo" apenas. Dos líneas de CSS.

---

## Paso 6 · Chat del Guardián

El chat ya tiene burbujas y estados; se refina la orfebrería:

1. **Indicador de escritura**: reemplazar el texto pulsante "Escribiendo…" por tres puntos dorados con onda secuencial. En `main.js`, el indicador se crea con `agregarBurbuja('', 'burbuja--cargando')` y se le inyectan tres `<span class="punto">` + un `<span class="visually-hidden">El Guardián está escribiendo</span>` para lectores de pantalla (agregar utilidad `.visually-hidden` al CSS si no existe — no existe hoy). CSS:

```css
.burbuja--cargando{display:flex;gap:6px;align-items:center;padding:18px 16px}
.burbuja--cargando .punto{
  width:7px;height:7px;border-radius:50%;background:var(--c-accent);
  animation:punto-onda 1.3s var(--ease-reloj) infinite;
}
.burbuja--cargando .punto:nth-child(2){animation-delay:.18s}
.burbuja--cargando .punto:nth-child(3){animation-delay:.36s}
@keyframes punto-onda{0%,60%,100%{opacity:.35;transform:none}30%{opacity:1;transform:translateY(-4px)}}
```

Bajo reduced-motion: puntos estáticos al 100 % de opacidad (sin animación), el texto oculto sigue informando.

2. **Entrada de burbujas**: toda `.burbuja` nueva aparece con fade + translateY(8px) (`animation: entrada .4s var(--ease-reloj)`, reutilizando el keyframe del hero). La burbuja inicial del HTML no anima (llega con la página).
3. **Altura contenida**: `.chat-cuerpo{max-height:min(420px,55vh);overflow-y:auto}` para que la conversación scrollee dentro del panel (el `scrollTop = scrollHeight` de `main.js` ya lo contempla). Scrollbar fino heredado del global.
4. **Cabecera**: junto a "Asistente de la logia", un punto de presencia dorado de 6 px (estático, sin pulso: sobriedad) — un `::before` en el `small`.
5. **Marco**: al `.chat`, un filete superior dorado de 2 px (`border-top: 2px solid var(--c-accent)` o gradiente `--filete-oro` con `border-image`) que lo distinga como pieza central de la página.
6. **Input en foco**: hereda el doble anillo de 4.1; además el placeholder se aclara un paso (`color: var(--c-muted)`).
7. **Botón Enviar**: hereda el hover 4.2 (sheen incluido).

No tocar: lógica de `fetch`, historial, Turnstile, eventos Umami, mensajes de error.

---

## Paso 7 · Footer con carácter

Rediseño de presentación manteniendo contenido idéntico (marca, dirección, mail, teléfono, leyenda GLA). Composición vertical ceremonial:

1. **Remate superior**: el mismo ornamento separador de 2.1 (línea + rombo) centrado como apertura del footer; el footer se convierte en el cierre litúrgico de la página.
2. **Isotipo** centrado, 34–38 px (hoy 22), con un halo tenue (`drop-shadow(0 0 18px var(--oro-15))`).
3. **Nombre de la logia** en Cormorant 20–22 px, `letter-spacing` leve, color `--c-text`. Debajo, en overline pequeño (`--t-eyebrow`, tracking 2.5px, `--c-faint`): "SAN NICOLÁS DE LOS ARROYOS · MCMXLVIII"… **no inventar fechas**: usar solo "SAN NICOLÁS DE LOS ARROYOS" (dato ya presente en la dirección).
4. **Contacto** en una línea (la actual), con los separadores "·" reemplazados por el símbolo de tres puntos masónico "∴" en dorado (`color: var(--c-accent)`), detalle auténtico de la tradición: `De la Nación 80, San Nicolás de los Arroyos ∴ info@lasavio.com.ar ∴ +54 9 336 459 7001`. Los separadores van en `<span aria-hidden="true">` para no ensuciar lectores de pantalla.
5. **Leyenda GLA** igual que hoy (`--c-faint`, small), con `margin-top` mayor.
6. Fondo: gradiente sutil `linear-gradient(180deg, var(--c-bg), #0a0c10)` que oscurece hacia el borde inferior: la página "se apaga" al terminar.
7. Enlaces del footer con el subrayado vivo de 4.4.

Marcado: reordenar/envolver lo existente en `index.html` (footer actual: `.footer-marca`, `.footer-contacto`, `.logias`), sin agregar ni quitar texto salvo los separadores decorativos.

---

## Paso 8 · Detalles de relojería final

1. `::selection{background:var(--c-accent);color:var(--c-bg)}` — hasta seleccionar texto es dorado.
2. Scrollbar: ya tiene hover dorado; sin cambios.
3. `.overline` general: agregar un guion fino dorado antes del texto en las secciones… ya cubierto por la numeración romana (2.3); no duplicar ornamentos.
4. `figcaption`: anteponer un pequeño rombo dorado (`::before{content:"◆ ";color:var(--c-accent);font-size:8px;vertical-align:2px}`) — o descartarlo si compite con el resto; criterio del ejecutor al verlo.
5. Repasar `prefers-reduced-motion: reduce`: la regla global existente (`*{transition:none !important}`) cubre transiciones pero **no animaciones**; agregar `*{animation:none !important}` en ese bloque (verificando que no rompa el estado final de los elementos con `animation ... both` del hero: al anular la animación deben quedar visibles, por eso `.revelar` solo se aplica por JS y las animaciones del hero deben definirse de modo que sin animación el estado por defecto sea visible — es decir, el hero NO debe tener `opacity:0` en la regla base, solo dentro del keyframe con `both`; con `animation:none` el elemento queda en su estado natural, visible. Verificar este comportamiento explícitamente en el navegador).
6. Umami: los cambios no deben tocar ningún `track(...)` ni los selectores que los disparan.

---

## Qué NO hacer

- No agregar librerías, frameworks, fuentes ni requests externos nuevos.
- No cambiar textos (única excepción: 3.4, aprobada), estructura de secciones, IDs, anclas ni orden del contenido.
- No tocar `api/`, `lib/`, `vercel.json`, JSON-LD, meta tags, Turnstile, Umami.
- No introducir parallax, partículas, cursores custom ni efectos de "sitio de agencia": la estética es templo, no feria.
- No animar nada más de una vez por carga (reveals one-shot con `unobserve`).

---

## Verificación (obligatoria antes de commitear)

1. **Servidor local**: `python3 -m http.server 8080` en la raíz y revisar en navegador (o con las herramientas de Chrome de la sesión):
   - Desktop ≥ 1280 px y móvil 375 px (hamburguesa, panel móvil, FAB).
   - Secuencia del hero al cargar; reveals al scrollear las tres secciones; ornamentos entre secciones; footer.
   - Acordeones: apertura/cierre, onda dorada, indicador girando, un solo `details` abierto por vez (atributo `name="faq"`).
   - Chat: burbujas, indicador de tres puntos (se puede forzar visualmente agregando la clase a mano en DevTools; el fetch real requiere el backend), scroll interno del cuerpo.
   - Hover de CTA (sheen), enlaces (subrayado), imágenes, summary.
2. **Teclado**: Tab por toda la página; doble anillo visible en enlaces, botones, summaries, input del chat; skip-link operativo.
3. **Reduced motion**: en DevTools → Rendering → `prefers-reduced-motion: reduce`; **todo el contenido debe verse sin scroll trickery**: nada oculto, nada animado.
4. **Sin JS**: desactivar JavaScript; la página completa debe ser legible (ningún elemento con `opacity: 0` residual).
5. **Regresión en páginas hermanas**: abrir `/entrevista/` y `/privacidad/`; foco, botones y footer deben verse correctos.
6. **Consola limpia**: cero errores/warnings nuevos.
7. **Peso**: los cambios suman solo CSS/JS de texto (~4-6 KB); ninguna imagen nueva salvo data-URIs de ornamentos (< 1 KB).

## Commits sugeridos (uno por paso mayor)

1. `Tokens de motion y derivados de oro en el sistema de diseño`
2. `Separadores ornamentales, filetes y numeración romana de secciones`
3. `Jerarquía tipográfica: puentes como citas y remates`
4. `Microinteracciones: foco de doble anillo, sheen del CTA, acordeones y enlaces`
5. `Revelado por scroll y secuencia de apertura del hero`
6. `Refinamiento del chat del Guardián`
7. `Rediseño del footer`
