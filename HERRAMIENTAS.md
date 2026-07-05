# Herramientas

Registro de scripts/herramientas del proyecto. Antes de automatizar algo nuevo, revisar si ya existe acá.

## Scripts existentes

Ninguno todavía.

## Candidatos a automatizar

| Candidato | Estado | Nota |
|---|---|---|
| Script que regenere `lib/guardian-system-prompt.js` a partir de `documentos/05_Guardian_IA_Conversacional.md` y `documentos/14_Base_Conocimiento_Guardian.md` | 🟡 candidato | Hoy el archivo se arma copiando el texto a mano. Es determinista (mismos docs → mismo output), así que un cambio futuro en el corpus o el prompt maestro debería regenerarlo con un script en vez de copiar y pegar de nuevo. No urgente mientras el corpus no cambie. |
| Script de verificación estática (balance de tags HTML, llaves/paréntesis JS/CSS) antes de cada commit | 🟡 candidato | Se reescribe a mano en Python cada vez que se agrega una página o script (ya van dos: `/privacidad/`, `/entrevista/`). Es determinista y no depende de Node (que no está disponible en este entorno). Conviene guardarlo como `scripts/verificar.py` versionado en vez de reescribirlo cada sesión. No urgente mientras sean pocas páginas. |
| Script de revisión + purga trimestral de `guardian:conversaciones` en Upstash | 🟡 candidato | Proceso manual descrito en `REVISION-GUARDIAN.md`: exportar a texto legible y después `DEL guardian:conversaciones`. Es determinista y se repite cada 3 meses de forma idéntica. Pendiente de construir a pedido del usuario (2026-07-03); no automatizar sin confirmación previa. |
| Chequeo "¿hay cambios sin commitear/pushear?" antes de marcar una tarea como completada | 🟡 candidato | En esta sesión se marcaron tareas como "completadas" cuando en realidad el commit no se había hecho (quedó detectado y corregido recién en una revisión posterior). Es una verificación determinista (`git status --short` + comparar con remoto) que podría correr automáticamente antes de cerrar cualquier tarea de código. No urgente para un proyecto de un solo colaborador, pero evita el mismo error a futuro. |
| Script de medición de ángulo de líneas horizontales en imágenes (`scripts/medir_angulo.py`) | 🟡 candidato | Usado dos veces en la sesión 2026-07-05 para medir la inclinación del friso en `templo_hero.webp` (fit robusto sobre el gradiente vertical, PIL + numpy, ~15 líneas). Determinista (misma imagen + banda → mismo ángulo). Conviene versionarlo si vuelve a haber ajustes de encuadre/rotación de fotos. |
