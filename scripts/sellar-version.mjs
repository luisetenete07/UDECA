/**
 * Le pone a cada despliegue su número de versión.
 *
 * EL PROBLEMA
 *
 * El muro de "Hay una versión nueva" (app/+html.tsx) dependía de que el
 * navegador encontrara un service worker distinto. Pero `public/sw.js` es el
 * mismo fichero en cada despliegue: byte a byte igual, así que el navegador
 * nunca veía nada nuevo y el muro no salía jamás. La versión nueva solo
 * llegaba cuando alguien cerraba la app del todo y la volvía a abrir; en un
 * iPhone, que la deja dormida en segundo plano, eso podía tardar días.
 *
 * LO QUE SE HACE AQUÍ
 *
 * Se cambia la marca `__VERSION_WEB__` por el identificador del despliegue en:
 *
 *  - todos los HTML: la página sabe qué versión es ella;
 *  - sw.js: cada despliegue estrena service worker y caché, y se tira la de
 *    antes (con el icono viejo dentro, entre otras cosas);
 *  - version.json, que se crea aquí: es lo que la app pregunta para saber cuál
 *    es la última publicada.
 *
 * Si la página dice una versión y version.json otra, sale el muro.
 *
 * Si falta la marca en algún sitio, falla: un despliegue sin sellar no se nota
 * a simple vista, solo en que el muro deja de salir.
 *
 *   node scripts/sellar-version.mjs dist <identificador>
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARCA = '__VERSION_WEB__';
const [, , dir = 'dist', idArg] = process.argv;
const version = (idArg || `local-${Date.now()}`).trim();

if (!/^[\w.-]{4,64}$/.test(version) || version.startsWith('__')) {
  console.error(`✖ versión no válida: "${version}"`);
  process.exit(1);
}

const htmls = [];
const recorre = (d) => {
  for (const n of readdirSync(d)) {
    const ruta = join(d, n);
    if (statSync(ruta).isDirectory()) recorre(ruta);
    else if (n.endsWith('.html')) htmls.push(ruta);
  }
};
recorre(dir);

let sellados = 0;
for (const f of htmls) {
  const html = readFileSync(f, 'utf8');
  if (!html.includes(MARCA)) continue;
  writeFileSync(f, html.split(MARCA).join(version));
  sellados++;
}

const sw = join(dir, 'sw.js');
const codigoSw = readFileSync(sw, 'utf8');
if (!codigoSw.includes(MARCA)) {
  console.error('✖ sw.js no lleva la marca de versión: el navegador no verá que hay uno nuevo');
  process.exit(1);
}
writeFileSync(sw, codigoSw.split(MARCA).join(version));

if (!readFileSync(join(dir, 'index.html'), 'utf8').includes(version)) {
  console.error('✖ index.html no lleva la marca de versión: el muro no sabría qué versión es');
  process.exit(1);
}

writeFileSync(join(dir, 'version.json'), JSON.stringify({ version }) + '\n');
console.log(`✔ versión ${version}: ${sellados} páginas, sw.js y version.json`);
