/*
 * La red de las direcciones con identificador.
 *
 * QUÉ SE PROTEGE
 *
 * En un sitio estático no hay fichero para `/clients/<alumno>`: se sirve
 * `404.html` y el enrutador resuelve dentro. Eso ya estaba. Lo que no estaba es
 * que esa copia NO PUEDE HIDRATAR: `index.html` trae dibujada la pantalla de
 * inicio, y si se le dice a React que la dé por buena mientras el enrutador
 * pinta la ficha de un alumno, salta un error de hidratación —el 418— en todas
 * esas pantallas, y se ve el parpadeo de la pantalla equivocada.
 *
 * Se rompe en silencio: la web sigue publicándose y de un vistazo se ve bien.
 * Solo se nota mirando la consola, o el parpadeo, en las cinco pantallas que
 * llevan un identificador en la dirección.
 *
 *   node scripts/check-fallback-404.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

const raiz = new URL('..', import.meta.url).pathname;

console.log('\nLa copia para las direcciones con identificador');
{
  const dir = mkdtempSync(join(tmpdir(), 'udeca-404-'));
  const indice =
    '<!DOCTYPE html><html><head><script>window.__EXPO_ROUTER_HYDRATE__=true;</script></head>' +
    '<body><div id="root"><div>inicio ya dibujado</div></div></body></html>';
  writeFileSync(join(dir, 'index.html'), indice);
  execFileSync('node', [join(raiz, 'scripts/fallback-404.mjs'), dir]);
  const cuatro = readFileSync(join(dir, '404.html'), 'utf8');

  ok('el 404 no hidrata', cuatro.includes('__EXPO_ROUTER_HYDRATE__=false;'));
  ok('y no queda rastro del true', !cuatro.includes('__EXPO_ROUTER_HYDRATE__=true;'));
  // Lo demás se copia tal cual: el 404 sigue siendo la app entera, con su
  // bundle y sus etiquetas. Vaciarlo lo dejaría sin nada que arrancar.
  ok('lo demás va tal cual', cuatro.includes('inicio ya dibujado'));
  ok('el index se queda como estaba', readFileSync(join(dir, 'index.html'), 'utf8') === indice);
}

console.log('\nSi Expo cambia la bandera, revienta aquí y no en producción');
{
  const dir = mkdtempSync(join(tmpdir(), 'udeca-404b-'));
  writeFileSync(join(dir, 'index.html'), '<html><body>sin bandera ninguna</body></html>');
  let peto = false;
  try {
    execFileSync('node', [join(raiz, 'scripts/fallback-404.mjs'), dir], { stdio: 'pipe' });
  } catch {
    peto = true;
  }
  ok('sin la bandera, falla en vez de callarse', peto);
}

console.log('\nEl despliegue lo usa de verdad');
{
  const flujo = readFileSync(join(raiz, '.github/workflows/deploy.yml'), 'utf8');
  ok('el despliegue llama al script', /node scripts\/fallback-404\.mjs dist/.test(flujo));
  // La copia a pelo era justo el fallo: si vuelve, esto lo caza.
  ok('y ya no copia el index a pelo', !/cp dist\/index\.html dist\/404\.html/.test(flujo));
  ok('comprueba que el 404 no hidrata', /grep -q "__EXPO_ROUTER_HYDRATE__=false" dist\/404\.html/.test(flujo));
  ok('y que el index sí', /grep -q "__EXPO_ROUTER_HYDRATE__=true" dist\/index\.html/.test(flujo));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
