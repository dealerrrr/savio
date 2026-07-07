# Herramientas

Registro de scripts/herramientas del proyecto. Antes de automatizar algo nuevo, revisar si ya existe acá.

## Scripts existentes

### `scripts/build-corpus.js` — regenerar el corpus del Guardián
Convierte el documento 14 (base de conocimiento aprobada por la logia) en `lib/guardian-corpus.js`, el corpus que el Guardián usa como única fuente de respuesta. Determinista: mismo doc 14 → mismo corpus. Valida estructura, tamaño y que no se filtre texto meta; aborta si las dos copias del doc 14 (repo y Obsidian) difieren.

## Actualizar corpus del Guardián

Cuándo usarlo: conseguiste material nuevo (histórico, institucional, corrección) y querés que el Guardián lo sepa. El único archivo que se edita a mano es el doc 14; todo lo demás se regenera.

1. **Editar el doc 14**: `documentos/14_Base_Conocimiento_Guardian.md` (misma copia que ves en Obsidian en `Notas/Masoneria/Proyectos/lasavio.com.ar/`). Agregar el material en la PARTE que corresponda, como sección `### x.x Título` nueva o ampliando una existente. Solo material verificado y aprobado por la logia; redactar cada sección como fragmento autónomo.
2. **Regenerar el corpus**: desde la raíz del repo, `node scripts/build-corpus.js`. Reescribe `lib/guardian-corpus.js`. No hay que tocar el prompt (`lib/guardian-system-prompt.js`) ni `api/chat.js`.
3. **Revisar el cambio**: `git diff lib/guardian-corpus.js` muestra exactamente qué conocimiento entra o sale.
4. **Publicar**: commit + push a `main`. Vercel despliega solo.
5. **Probar**: abrir el chat del sitio y hacer 2-3 preguntas sobre el material nuevo; verificar que responde con eso y que ante algo no cubierto deriva a la charla en persona.

Reglas fijas: nunca editar `lib/guardian-corpus.js` a mano (se pisa en la próxima regeneración); las secciones "Cómo se usa este corpus" y "Lista de control" del doc 14 son instrucciones internas y el script las excluye solo.

## Candidatos a automatizar

| Candidato | Estado | Nota |
|---|---|---|
| Script que regenere `lib/guardian-system-prompt.js` a partir de `documentos/05_Guardian_IA_Conversacional.md` y `documentos/14_Base_Conocimiento_Guardian.md` | ✅ hecho (parcial, 2026-07-06) | La mitad del corpus quedó resuelta con `scripts/build-corpus.js`. El prompt maestro (doc 05) sigue copiado a mano en `lib/guardian-system-prompt.js`: cambia muy poco y requiere juicio de la logia, queda en el modelo. |
| Batería automática de "preguntas doradas" contra el Guardián (llama a `/api/chat` en preview o producción y chequea respuestas clave: contacto, mujer, Savio no masón, Taxil, negativa a secretos) | 🟡 candidato | Hoy la verificación post-deploy es manual en el navegador. Automatizarla conviene si el corpus empieza a cambiar seguido. |
| Router de corpus por tema (inyectar solo las secciones relevantes por conversación) | ⚪ descartado (2026-07-06) | Evaluado y descartado: con ~12k tokens de corpus y caching implícito de Gemini el ahorro es de centavos y agrega riesgo de falsos "no sé". Reconsiderar solo si el corpus crece ~10x. |
| Script de verificación estática (balance de tags HTML, llaves/paréntesis JS/CSS) antes de cada commit | 🟡 candidato | Se reescribe a mano en Python cada vez que se agrega una página o script (ya van dos: `/privacidad/`, `/entrevista/`). Es determinista y no depende de Node (que no está disponible en este entorno). Conviene guardarlo como `scripts/verificar.py` versionado en vez de reescribirlo cada sesión. No urgente mientras sean pocas páginas. |
| Script de revisión + purga trimestral de `guardian:conversaciones` en Upstash | 🟡 candidato | Proceso manual descrito en `REVISION-GUARDIAN.md`: exportar a texto legible y después `DEL guardian:conversaciones`. Es determinista y se repite cada 3 meses de forma idéntica. Pendiente de construir a pedido del usuario (2026-07-03); no automatizar sin confirmación previa. |
| Chequeo "¿hay cambios sin commitear/pushear?" antes de marcar una tarea como completada | 🟡 candidato | En esta sesión se marcaron tareas como "completadas" cuando en realidad el commit no se había hecho (quedó detectado y corregido recién en una revisión posterior). Es una verificación determinista (`git status --short` + comparar con remoto) que podría correr automáticamente antes de cerrar cualquier tarea de código. No urgente para un proyecto de un solo colaborador, pero evita el mismo error a futuro. |
| Script de medición de ángulo de líneas horizontales en imágenes (`scripts/medir_angulo.py`) | 🟡 candidato | Usado dos veces en la sesión 2026-07-05 para medir la inclinación del friso en `templo_hero.webp` (fit robusto sobre el gradiente vertical, PIL + numpy, ~15 líneas). Determinista (misma imagen + banda → mismo ángulo). Conviene versionarlo si vuelve a haber ajustes de encuadre/rotación de fotos. |
