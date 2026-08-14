/**
 * El diccionario tiene que seguir siendo un diccionario.
 *
 * QUÉ SE COMPRUEBA Y POR QUÉ
 *
 *  - Que no haya dos veces la misma clave. En un objeto literal la segunda
 *    gana en silencio, así que un duplicado es una traducción que alguien
 *    escribió y que no se usa. TypeScript ya lo caza, pero aquí sale con la
 *    frase concreta.
 *  - Que ninguna traducción esté vacía. Una cadena vacía SÍ pasa el `??` de
 *    `traducir`, y entonces el inglés ve un hueco donde el español veía una
 *    frase: es el único fallo de este diseño que no se degrada a español.
 *  - Que los huecos numerados cuadren. Si el español dice `{0}` y `{1}` y el
 *    inglés solo pone `{0}`, en inglés desaparece un dato —una fecha, un
 *    importe— sin que nadie se entere. Y si el inglés inventa un `{2}` que no
 *    existe, el usuario ve "{2}" en la pantalla.
 *  - Que `frase` no se use para nada que se guarde. Traducir un dato al
 *    escribirlo deja inglés dentro de los datos de alguien que mañana vuelve
 *    al español.
 */
import { readFileSync } from 'node:fs';
import { EN, traducir } from '../lib/i18n.ts';

let fallos = 0;
const mal = (m) => {
  console.error('  ✗', m);
  fallos++;
};

// --- Claves repetidas ---
const fuente = readFileSync(new URL('../lib/i18n.ts', import.meta.url), 'utf8');
const vistas = new Set();
const re = /^ {2}(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-zÀ-ÿ_][\w]*)):/gm;
let m;
while ((m = re.exec(fuente))) {
  const clave = m[1] ?? m[2] ?? m[3];
  if (vistas.has(clave)) mal(`clave repetida: ${JSON.stringify(clave)}`);
  vistas.add(clave);
}

// --- Traducciones vacías ---
for (const [es, en] of Object.entries(EN)) {
  if (!en.trim()) mal(`traducción vacía: ${JSON.stringify(es)}`);
}

// --- Huecos numerados ---
const huecos = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((h) => h[1]).sort();
for (const [es, en] of Object.entries(EN)) {
  const a = huecos(es).join(',');
  const b = huecos(en).join(',');
  if (a !== b) mal(`huecos distintos en ${JSON.stringify(es)}: [${a}] vs [${b}]`);
}

// --- Lo que se guarda no se traduce ---
// `newDay` y `addDay` escriben el nombre del día EN LOS DATOS del alumno.
for (const f of ['app/(client)/my-plan.tsx', 'app/(trainer)/clients/[id]/routine.tsx']) {
  const s = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  for (const linea of s.split('\n')) {
    if (/name:\s*frase`/.test(linea)) mal(`${f}: se traduce un nombre que se guarda — ${linea.trim()}`);
  }
}

// --- Que lo básico traduzca de verdad ---
const casos = [
  ['Iniciar sesión', 'Sign in'],
  ['Mi entrenamiento', 'My training'],
  ['Cobro pendiente', 'Payment due'],
];
for (const [es, en] of casos) {
  if (traducir(es, 'en') !== en) mal(`traducir("${es}", "en") no da "${en}"`);
  if (traducir(es, 'es') !== es) mal(`traducir("${es}", "es") debería devolver el español`);
}

// Una frase que no está en el diccionario sale en español, nunca en blanco.
const inventada = 'Esta frase no existe en el diccionario';
if (traducir(inventada, 'en') !== inventada) mal('una frase sin traducir no cae al español');

// Los huecos se rellenan DESPUÉS de traducir, para que un dato no dependa del idioma.
if (traducir('Día {0} de {1}', 'en', { 0: 3, 1: 5 }) !== 'Day 3 of 5') {
  mal('los huecos no se rellenan bien al traducir');
}

console.log(
  fallos === 0
    ? `check-i18n: OK · ${Object.keys(EN).length} frases traducidas`
    : `check-i18n: ${fallos} fallo(s)`
);
process.exit(fallos === 0 ? 0 : 1);
