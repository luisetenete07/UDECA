/**
 * Que Gradle siga teniendo memoria de sobra para compilar Android.
 *
 * El build de Android falló varias veces seguidas por esto, y el mensaje que
 * llegaba era "Gradle build failed with unknown error": el de verdad estaba
 * enterrado en los registros de EAS y decía OutOfMemoryError en el metaspace,
 * analizando expo-modules-core con Lint.
 *
 * Lo arregla plugins/memoria-de-gradle.js. Esta comprobación existe porque ese
 * plugin es fácil de perder sin enterarse —basta con quitarlo de la lista de
 * app.json al tocar otra cosa— y lo que pasaría entonces no es un aviso: es
 * media hora de compilación para volver al mismo error indescifrable.
 *
 *   node scripts/check-gradle.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const plugins = (app.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
ok('el plugin de memoria sigue en app.json', plugins.includes('./plugins/memoria-de-gradle'));

const plugin = readFileSync(new URL('../plugins/memoria-de-gradle.js', import.meta.url), 'utf8');
const memoria = /const MEMORIA = '([^']+)'/.exec(plugin)?.[1] ?? '';
ok('y sigue diciendo cuánta memoria', Boolean(memoria), memoria);

const metaspace = /MaxMetaspaceSize=(\d+)m/.exec(memoria);
ok(
  'el metaspace da margen (2 GB o más)',
  Boolean(metaspace) && Number(metaspace[1]) >= 2048,
  `ahora: ${metaspace?.[1] ?? '?'}m — con 512m es con lo que fallaba`
);

const heap = /Xmx(\d+)m/.exec(memoria);
ok(
  'y el montón también (4 GB o más)',
  Boolean(heap) && Number(heap[1]) >= 4096,
  `ahora: ${heap?.[1] ?? '?'}m`
);

console.log(fallos === 0 ? 'check-gradle: OK' : `check-gradle: ${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
