/*
 * Que la app se pueda instalar desde el navegador.
 *
 * Maestría en Calistenia ya no está en App Store ni en Google Play: la única
 * forma de tenerla es app.udeca.app, instalada desde el navegador. Si el
 * manifiesto se rompe, instalarla pasa a ser un acceso directo a una página, y
 * eso no lo nota nadie hasta que un alumno nuevo pregunta dónde está la app.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-app-instalable.mjs
 */
import { existsSync, readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

console.log('\nQue la app se pueda instalar en el ordenador');
{
  /*
   * Lo que pidió Luis —"que se actualice sola y obligue a todos"— ya lo hace
   * la app web: el service worker detecta la versión nueva y el muro de
   * app/+html.tsx tapa la pantalla hasta que se recarga. Lo que le faltaba era
   * PARECER una aplicación: sin esto, instalarla es un acceso directo y el
   * diálogo de Chrome es una línea con el nombre.
   */
  const m = JSON.parse(lee('public/manifest.json'));
  ok('se abre en su propia ventana', m.display === 'standalone');
  ok('tiene identidad estable', typeof m.id === 'string' && m.id.length > 0);
  // Sin capturas, el diálogo de instalar en escritorio es el mínimo.
  const anchas = (m.screenshots ?? []).filter((c) => c.form_factor === 'wide');
  const estrechas = (m.screenshots ?? []).filter((c) => c.form_factor === 'narrow');
  ok('el diálogo de instalar enseña la app', anchas.length > 0 && estrechas.length > 0);
  for (const c of m.screenshots ?? []) {
    ok(`${c.src} existe`, !!lee(`public/${c.src}`).length);
  }
  // Un icono de 512 con relleno es lo que pide Android para no recortarlo mal.
  ok('hay icono grande y adaptable',
    (m.icons ?? []).some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  /*
   * NO se fija la orientación. Estaba en "portrait", que en un móvil se
   * entiende, pero una ventana de escritorio es apaisada: dejarla bloqueada es
   * pedirle a la app que se vea de canto en el sitio donde más ancho hay.
   */
  ok('no se bloquea la orientación', !('orientation' in m), 'una ventana de ordenador es apaisada');

  for (const i of m.icons ?? []) {
    ok(`${i.src} existe`, existsSync(new URL(`../public/${i.src}`, import.meta.url)));
  }
  ok('con el nombre de la app', m.name === 'Maestría en Calistenia' && m.short_name === 'MASTERY');
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
