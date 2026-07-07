#!/usr/bin/env node
// Regenera lib/guardian-corpus.js a partir del documento 14 (base de
// conocimiento del Guardián). El doc 14 es la única fuente de verdad del
// corpus: NUNCA editar lib/guardian-corpus.js a mano.
//
// Uso:
//   node scripts/build-corpus.js            (usa documentos/14_Base_Conocimiento_Guardian.md)
//   node scripts/build-corpus.js <ruta.md>  (usa otro archivo fuente)
//
// Flujo completo de actualización del corpus: ver HERRAMIENTAS.md,
// sección "Actualizar corpus del Guardián".
//
// Qué hace:
//   1. Lee el doc 14 y valida su estructura (encabezados esperados).
//   2. Excluye las secciones meta ("Cómo se usa este corpus", "Lista de
//      control" y el preámbulo), que son instrucciones de implementación,
//      no material que el Guardián deba citar.
//   3. Escribe lib/guardian-corpus.js con el corpus verbatim y una cabecera
//      de trazabilidad (fecha, SHA-256 y tamaño de la fuente).
//
// El script es determinista: mismo doc 14 → mismo corpus generado.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');
const FUENTE_DEFAULT = path.join(RAIZ, 'documentos', '14_Base_Conocimiento_Guardian.md');
// Copia de trabajo en Obsidian; debe estar sincronizada con documentos/.
const FUENTE_NOTAS =
  '/home/dealerrr/Documentos/Notas/Masoneria/Proyectos/lasavio.com.ar/14_Base_Conocimiento_Guardian.md';
const SALIDA = path.join(RAIZ, 'lib', 'guardian-corpus.js');

const MIN_CHARS = 20000;
const MAX_CHARS = 80000;

// Frases que solo aparecen en las secciones meta: si se filtran al corpus
// generado, algo salió mal.
const FRASES_META = ['capa de RAG', 'Lista de control', 'quien implemente el RAG'];

function fallar(mensaje) {
  console.error(`ERROR: ${mensaje}`);
  process.exit(1);
}

const fuente = process.argv[2] ? path.resolve(process.argv[2]) : FUENTE_DEFAULT;
if (!fs.existsSync(fuente)) fallar(`No existe el archivo fuente: ${fuente}`);

const md = fs.readFileSync(fuente, 'utf8');

// Guarda anti-divergencia: si existen las dos copias del doc 14 (repo y
// Obsidian) y no son idénticas, abortar para no publicar una versión vieja.
if (fuente === FUENTE_DEFAULT && fs.existsSync(FUENTE_NOTAS)) {
  const notas = fs.readFileSync(FUENTE_NOTAS, 'utf8');
  if (notas !== md) {
    fallar(
      'Las dos copias del doc 14 difieren.\n' +
        `  repo:    ${FUENTE_DEFAULT}\n` +
        `  Obsidian: ${FUENTE_NOTAS}\n` +
        'Sincronizalas (quedate con la buena) y volvé a correr el script.'
    );
  }
}

// Validación de estructura: el doc 14 debe tener estos encabezados.
const ENCABEZADOS_REQUERIDOS = [
  '## Documento 14.',
  '### Cómo se usa este corpus',
  '## PARTE 1.',
  '## Lista de control',
];
for (const encabezado of ENCABEZADOS_REQUERIDOS) {
  if (!md.includes(encabezado)) {
    fallar(`El doc fuente no parece ser el doc 14: falta el encabezado «${encabezado}».`);
  }
}

// Recorte: el corpus va desde "## PARTE 1." hasta "## Lista de control"
// (exclusive). Todo lo anterior es preámbulo + instrucciones de uso.
const inicio = md.indexOf('## PARTE 1.');
const fin = md.indexOf('## Lista de control');
if (inicio === -1 || fin === -1 || fin <= inicio) fallar('No se pudo delimitar el corpus.');

let corpus = md
  .slice(inicio, fin)
  .replace(/^---\s*$/gm, '') // separadores decorativos, no aportan al modelo
  .replace(/\n{3,}/g, '\n\n')
  .trim();

if (corpus.length < MIN_CHARS || corpus.length > MAX_CHARS) {
  fallar(
    `El corpus mide ${corpus.length} caracteres, fuera del rango esperado ` +
      `(${MIN_CHARS}-${MAX_CHARS}). ¿Es el archivo correcto?`
  );
}
for (const frase of FRASES_META) {
  if (corpus.includes(frase)) {
    fallar(`Se filtró texto meta al corpus: «${frase}». Revisar la estructura del doc 14.`);
  }
}

const sha = crypto.createHash('sha256').update(md).digest('hex').slice(0, 12);
const fecha = new Date().toISOString().slice(0, 10);
const secciones = (corpus.match(/^###?#? /gm) || []).length;

const salida = `// ARCHIVO GENERADO - NO EDITAR A MANO.
//
// Corpus de conocimiento del Guardián del Templo, extraído verbatim del
// documento 14 (base de conocimiento aprobada por la logia).
// Para actualizarlo: editar el doc 14 y correr \`node scripts/build-corpus.js\`.
// Instructivo completo: HERRAMIENTAS.md, sección "Actualizar corpus del Guardián".
//
// Trazabilidad:
//   Fuente:    documentos/14_Base_Conocimiento_Guardian.md
//   Generado:  ${fecha}
//   SHA-256 (fuente, 12 primeros): ${sha}
//   Tamaño:    ${corpus.length} caracteres, ${secciones} encabezados

const MATERIAL_REFERENCIA = ${JSON.stringify(corpus)};

module.exports = { MATERIAL_REFERENCIA };
`;

fs.writeFileSync(SALIDA, salida);
console.log(`OK: ${path.relative(RAIZ, SALIDA)} regenerado.`);
console.log(`    Fuente: ${path.relative(RAIZ, fuente)} (sha ${sha})`);
console.log(`    Corpus: ${corpus.length} caracteres, ${secciones} encabezados.`);
console.log('Siguiente paso: revisar el diff (git diff lib/guardian-corpus.js) y commitear.');
