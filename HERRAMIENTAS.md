# Herramientas

Registro de scripts/herramientas del proyecto. Antes de automatizar algo nuevo, revisar si ya existe acá.

## Scripts existentes

### `scripts/build-corpus.js` — regenerar el corpus del Guardián
Convierte el documento 12 (base de conocimiento aprobada por la logia) en `lib/guardian-corpus.js`, el corpus que el Guardián usa como única fuente de respuesta. Determinista: mismo doc 12 → mismo corpus. Valida estructura, tamaño y que no se filtre texto meta; aborta si las dos copias del doc 12 (repo y Obsidian) difieren.

## Actualizar corpus del Guardián

Cuándo usarlo: conseguiste material nuevo (histórico, institucional, corrección) y querés que el Guardián lo sepa. El único archivo que se edita a mano es el doc 12; todo lo demás se regenera.

1. **Editar el doc 12**: `documentos/12_Base_Conocimiento_Guardian.md` (misma copia que ves en Obsidian en `Notas/Masoneria/Proyectos/lasavio.com.ar/`). Agregar el material en la PARTE que corresponda, como sección `### x.x Título` nueva o ampliando una existente. Solo material verificado y aprobado por la logia; redactar cada sección como fragmento autónomo.
2. **Regenerar el corpus**: desde la raíz del repo, `node scripts/build-corpus.js`. Reescribe `lib/guardian-corpus.js`. No hay que tocar el prompt (`lib/guardian-system-prompt.js`) ni `api/chat.js`.
3. **Revisar el cambio**: `git diff lib/guardian-corpus.js` muestra exactamente qué conocimiento entra o sale.
4. **Publicar**: commit + push a `main`. Vercel despliega solo.
5. **Probar**: abrir el chat del sitio y hacer 2-3 preguntas sobre el material nuevo; verificar que responde con eso y que ante algo no cubierto deriva a la charla en persona.

Reglas fijas: nunca editar `lib/guardian-corpus.js` a mano (se pisa en la próxima regeneración); las secciones "Cómo se usa este corpus" y "Lista de control" del doc 12 son instrucciones internas y el script las excluye solo.

## Candidatos a automatizar

| Candidato | Estado | Nota |
|---|---|---|
| Script de verificación estática (balance de tags HTML, llaves/paréntesis JS/CSS) antes de cada commit | 🟡 candidato | Se reescribe a mano en Python cada vez que se agrega una página o script (ya van dos: `/privacidad/`, `/entrevista/`). Es determinista y no depende de Node (que no está disponible en este entorno). Conviene guardarlo como `scripts/verificar.py` versionado en vez de reescribirlo cada sesión. No urgente mientras sean pocas páginas. Repetido otra vez el 2026-07-13 (sesión de limpieza de código muerto), esta vez ampliado con: selectores CSS vs uso en HTML/JS, variables CSS definidas vs usadas, y detección de `var()` huérfanas. Si se versiona, incluir esos chequeos. |
| Script de revisión + purga trimestral de `guardian:conversaciones` en Upstash | 🟡 candidato | Proceso manual descrito en `REVISION-GUARDIAN.md`: exportar a texto legible y después `DEL guardian:conversaciones`. Es determinista y se repite cada 3 meses de forma idéntica. Pendiente de construir a pedido del usuario (2026-07-03); no automatizar sin confirmación previa. |
| Chequeo "¿hay cambios sin commitear/pushear?" antes de marcar una tarea como completada | 🟡 candidato | En esta sesión se marcaron tareas como "completadas" cuando en realidad el commit no se había hecho (quedó detectado y corregido recién en una revisión posterior). Es una verificación determinista (`git status --short` + comparar con remoto) que podría correr automáticamente antes de cerrar cualquier tarea de código. No urgente para un proyecto de un solo colaborador, pero evita el mismo error a futuro. |
| Chequeo de consistencia cross-página (menú, footer y JSON-LD válido) | 🟡 candidato | En la sesión 2026-07-10 se revisó a mano que home, `/privacidad/` y `/admision/` compartan las mismas etiquetas de menú y el mismo footer, y que los JSON-LD parseen (se validó con Python ad-hoc). Determinista: parsear las páginas, comparar bloques header/footer y correr `json.loads` sobre cada `application/ld+json`. Adyacente a la fila "verificación estática de tags HTML"; podría fusionarse en un único `scripts/verificar.py`. Conviene al agregar la 4.ª página. |
| Script que genere variantes responsive (`-360w`/`-480w`/`-800w`) de una imagen `.webp` con `cwebp -resize` y arme el `srcset`/`sizes` para pegar en el HTML | 🟡 candidato | Hecho a mano dos veces en la sesión 2026-07-10: variantes 480/800 y después 360 para `teatro.webp` y `templo_fachada.webp`. Determinista: mismo archivo + anchos → mismas variantes. Ya van 2 repeticiones del mismo procedimiento; a la próxima imagen conviene versionarlo. 3.ª repetición del patrón el 2026-07-13: variante mobile del hero (`templo_hero-480.webp`), esta vez con `crop` centrado (dwebp → PIL crop → cwebp) en lugar de resize. Si se versiona, incluir modo `--crop WxH` además de `--resize`. |
| Script `scripts/lighthouse.sh` que corra Lighthouse mobile local (PATH de nvm, `CHROME_PATH=brave-browser`, flags headless) contra una URL y extraiga puntuaciones + métricas clave + fases del LCP del JSON | 🟢 automatizar ya (pendiente de tu OK) | En la sesión 2026-07-10 el mismo comando y el mismo parseo Python se repitieron 8+ veces entre las dos rondas (producción antes/después, local base, local con cambios, 3 pasadas finales). La API pública de PSI tiene cuota 0 sin key, así que esta es la vía de medición del proyecto. Determinista dado el entorno; se reusa tras cada deploy. |