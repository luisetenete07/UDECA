/*
 * Los botones de descarga de la web pública.
 *
 * QUÉ SE PROTEGE
 *
 * Esa sección es lo último que mira alguien antes de decidir si se instala la
 * app, y tiene dos formas de romperse en silencio:
 *
 *  - PROMETER UNA DESCARGA QUE NO EXISTE. Un botón que lleva a un 404 en la
 *    App Store cuesta más credibilidad de lo que suma tenerlo puesto. Por eso
 *    la regla es que, sin dirección, la tarjeta se queda en "Próximamente" y no
 *    navega — y esa regla vive en `main.js`, lejos del HTML, así que es fácil
 *    quitarla sin darse cuenta.
 *  - QUEDARSE SIN LOGOS. Antes eran caracteres sueltos (▶, ⌘) haciendo de logo
 *    de Google Play y de Apple. Un carácter no es el logo de nadie: se dibuja
 *    distinto en cada sistema y de lejos parece una web a medio hacer.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-web-descargas.mjs
 */
import { readFileSync } from 'node:fs';

let fallos = 0;
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};
const lee = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

const html = lee('web/index.html');
const css = lee('web/styles.css');
const main = lee('web/main.js');
const config = lee('web/config.js');
const app = JSON.parse(lee('app.json')).expo;

console.log('\nCada tienda con su logo de verdad');
{
  const tarjetas = html.slice(html.indexOf('<div class="stores">'), html.indexOf('</section>', html.indexOf('<div class="stores">')));
  ok('hay cuatro sitios de donde bajarla', (tarjetas.match(/class="store"/g) ?? []).length === 4);
  // Dibujados en línea: escalan sin pesar y no son una petición más.
  ok('los logos son SVG, no imágenes', (tarjetas.match(/<svg /g) ?? []).length === 4, 'faltan logos');
  ok('y no quedan caracteres haciendo de logo', !/<span class="logo"[^>]*>\s*[▶⌘]/.test(tarjetas));
  // El triángulo de Play sin sus colores es una flecha cualquiera.
  ok('el de Play lleva sus cuatro colores',
    ['#00D3FF', '#FFCE00', '#FF3A44', '#00C853'].every((c) => tarjetas.includes(c)));
  ok('el hueco del logo mide igual para las cuatro', /\.store \.logo \{[^}]*width: 34px/.test(css));
}

console.log('\nA dónde lleva cada una');
{
  // El id del paquete lo decide app.json; si cambia allí y no aquí, el enlace
  // de Play lleva a una ficha que no existe.
  const paquete = app.android.package;
  ok('Play apunta al paquete de verdad',
    config.includes(`play.google.com/store/apps/details?id=${paquete}`), paquete);
  // Mientras Apple no publique, vacío: así la tarjeta se queda en Próximamente.
  ok('la App Store espera a estar publicada', /appStore: ''/.test(config));
  ok('y el ordenador va a la app web', /\[data-app\]/.test(main) && /appUrl: 'https:\/\//.test(config));
}

console.log('\nSin dirección, no se promete nada');
{
  ok('una descarga sin enlace no navega', /e\.preventDefault\(\)/.test(main));
  ok('y se anuncia como disponible solo si la hay', /estado\.textContent = 'Disponible'/.test(main));
  /*
   * La tarjeta del ordenador NO pasa por ahí: la web ya está publicada, así que
   * su distintivo va en verde desde el primer día y no depende de ninguna
   * tienda. Va por una clase aparte para no tener que inventarse una entrada
   * falsa en `descargas`.
   */
  ok('la del ordenador no depende de ninguna tienda', /ready-siempre/.test(html) && /ready-siempre/.test(css));
}

console.log('\nLas capturas de la portada');
{
  // Tres capturas de la app en la portada. Si alguien renombra una y no toca el
  // HTML, el hueco se queda en blanco y solo se ve entrando en la web.
  for (const n of ['app-entreno', 'app-inicio', 'app-coach']) {
    ok(`${n} está puesta y existe`, html.includes(`/assets/${n}.png`) && !!lee(`web/assets/${n}.png`).length);
  }
}


console.log('\nQue la app se pueda instalar en el ordenador');
{
  /*
   * Lo que pidió el CEO —"que se actualice sola y obligue a todos"— ya lo hace
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

  // Y que la web lo cuente: una app instalable que nadie sabe que lo es, no lo es.
  ok('la web dice que se puede instalar', /instalarla/.test(html));
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
