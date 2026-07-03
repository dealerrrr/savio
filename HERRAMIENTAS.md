# Herramientas

Registro de scripts/herramientas del proyecto. Antes de automatizar algo nuevo, revisar si ya existe acá.

## Scripts existentes

Ninguno todavía.

## Candidatos a automatizar

| Candidato | Estado | Nota |
|---|---|---|
| Script que regenere `lib/guardian-system-prompt.js` a partir de `documentos/05_Guardian_IA_Conversacional.md` y `documentos/14_Base_Conocimiento_Guardian.md` | 🟡 candidato | Hoy el archivo se arma copiando el texto a mano. Es determinista (mismos docs → mismo output), así que un cambio futuro en el corpus o el prompt maestro debería regenerarlo con un script en vez de copiar y pegar de nuevo. No urgente mientras el corpus no cambie. |
| Script de verificación estática (balance de tags HTML, llaves/paréntesis JS/CSS) antes de cada commit | 🟡 candidato | Se reescribe a mano en Python cada vez que se agrega una página o script (ya van dos: `/privacidad/`, `/entrevista/`). Es determinista y no depende de Node (que no está disponible en este entorno). Conviene guardarlo como `scripts/verificar.py` versionado en vez de reescribirlo cada sesión. No urgente mientras sean pocas páginas. |
