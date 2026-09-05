/*
 * El reproductor blindado de los cursos (lib/reproductorBlindado.ts, lib/video.ts).
 *
 * Lo que hay que proteger: que en una clase de pago no quede a la vista NADA
 * del reproductor de la plataforma. Cada logo, cada título y cada "Ver en
 * YouTube" es una puerta para sacar el vídeo de UDECA, y con un parámetro no
 * se quitan: hay que taparlos y poner los controles propios.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-reproductor-blindado.mjs
 */
import {
  ESPERA_MS,
  SALTO,
  fuenteBlindada,
  paginaDelReproductor,
  tiempoCorto,
} from '../lib/reproductorBlindado.ts';
import { seQuedaDentro, seQuedaDentroDelBlindaje } from '../lib/video.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nQué enlaces se pueden blindar');
{
  const yt = fuenteBlindada('https://www.youtube.com/watch?v=abc123XYZ_-');
  comprueba('YouTube sí', yt?.dialecto === 'youtube');
  comprueba('y va por el dominio sin cookies', yt.src.includes('youtube-nocookie.com/embed/abc123XYZ_-'));
  comprueba('acorta también los enlaces youtu.be', fuenteBlindada('https://youtu.be/abc123XYZ_-')?.src === yt.src);
  comprueba('y los shorts', fuenteBlindada('https://youtube.com/shorts/abc123XYZ_-')?.dialecto === 'youtube');

  const vi = fuenteBlindada('https://vimeo.com/123456789/a1b2c3d4e5');
  comprueba('Vimeo sí', vi?.dialecto === 'vimeo');
  comprueba('con su id', vi.src.includes('player.vimeo.com/video/123456789'));
  comprueba('y el hash del vídeo oculto', vi.src.includes('h=a1b2c3d4e5'));

  // Lo que no obedece desde fuera no se blinda: taparle los controles dejaría
  // una clase que no se puede ni arrancar.
  comprueba('un Drive no se blinda', fuenteBlindada('https://drive.google.com/file/d/1/view') === null);
  comprueba('un mp4 suelto tampoco', fuenteBlindada('https://cdn.udeca.app/clase.mp4') === null);
  comprueba('sin enlace, nada', fuenteBlindada(undefined) === null);
  comprueba('basura, nada', fuenteBlindada('no soy una url') === null);
}

console.log('\nLo que se le pide al reproductor de la plataforma');
{
  const yt = fuenteBlindada('https://youtu.be/abc123XYZ_-');
  comprueba('sin sus controles', yt.src.includes('controls=0'));
  comprueba('con la API abierta para mandarle', yt.src.includes('enablejsapi=1'));
  comprueba('sin sugerencias al acabar', yt.src.includes('rel=0'));
  comprueba('sin anotaciones encima', yt.src.includes('iv_load_policy=3'));
  // La pantalla completa es donde el vídeo lo pinta el sistema, por encima de
  // la marca de agua y del cristal: ahí se acaban las protecciones.
  comprueba('sin pantalla completa', yt.src.includes('fs=0'));
  comprueba('sin teclado propio', yt.src.includes('disablekb=1'));
  comprueba('en la propia pantalla del móvil', yt.src.includes('playsinline=1'));
  /*
   * El paracaídas va DESNUDO: sin `enablejsapi`, sin `fs=0` y sin `disablekb`,
   * o sea, sin ninguno de los parámetros por los que el blindaje se puede haber
   * caído. Antes era el mismo enlace con `controls=1`, que es reintentar
   * exactamente lo que acaba de fallar.
   *
   * Sin `controls` en la dirección, YouTube pone los suyos, que es lo que se
   * quiere aquí: que la clase se pueda ver.
   */
  comprueba('el paracaídas no repite lo que falló', !yt.srcNormal.includes('enablejsapi'));
  comprueba('ni lleva el resto del blindaje', !/fs=0|disablekb/.test(yt.srcNormal));
  comprueba('y no le quita los controles', !yt.srcNormal.includes('controls=0'));
  comprueba('y es el mismo vídeo', yt.srcNormal.includes('abc123XYZ_-'));

  const vi = fuenteBlindada('https://vimeo.com/123456789');
  comprueba('Vimeo sin barra', vi.src.includes('controls=0'));
  comprueba('sin título', vi.src.includes('title=0'));
  comprueba('sin autor', vi.src.includes('byline=0'));
  comprueba('sin avatar', vi.src.includes('portrait=0'));
  comprueba('sin seguimiento', vi.src.includes('dnt=1'));
  comprueba('y su paracaídas con controles', vi.srcNormal.includes('controls=1'));
}

console.log('\nLa página que se monta');
{
  const html = paginaDelReproductor(fuenteBlindada('https://youtu.be/abc123XYZ_-'));
  comprueba('es una página entera', html.startsWith('<!doctype html>'));
  comprueba('lleva el marco del vídeo', /<iframe id="v"/.test(html));
  // El cristal: sin él, todo lo demás da igual.
  comprueba('lleva el cristal por encima', /id="escudo"/.test(html));
  comprueba('el cristal cubre TODO', /#escudo\{position:absolute;inset:0/.test(html));
  comprueba('con nuestros controles', /id="pp"/.test(html) && /id="linea"/.test(html));
  comprueba('y el tiempo', /id="tiempo"/.test(html));
  comprueba('el salto es de diez segundos', html.includes('var SALTO = 10;') && SALTO === 10);
  comprueba('sin menú del clic derecho', html.includes("'contextmenu'"));
  comprueba('sin arrastrar fuera', html.includes("'dragstart'"));
  comprueba('sin copiar', html.includes("'copy'"));
  comprueba('sin seleccionar', /user-select:none/.test(html));
  comprueba('sin el compartir del navegador', /navigator, 'share'/.test(html));
  comprueba('sin pantalla completa en el marco', /allowfullscreen="false"/.test(html));
  comprueba('carga la API de YouTube', html.includes('https://www.youtube.com/iframe_api'));
  comprueba('y NO la de Vimeo', !html.includes('player.vimeo.com/api/player.js'));

  const vimeo = paginaDelReproductor(fuenteBlindada('https://vimeo.com/123456789'));
  comprueba('la de Vimeo carga la suya', vimeo.includes('https://player.vimeo.com/api/player.js'));
  comprueba('y no la de YouTube', !vimeo.includes('https://www.youtube.com/iframe_api'));

  // Un acento grave dentro de la plantilla parte el archivo entero: pasó una
  // vez con el generador de carnés y no puede volver a pasar sin avisar.
  comprueba('sin acentos graves dentro', !html.includes('`'));

  // El paracaídas: una clase que no se puede ver es peor que una clase que se
  // puede compartir.
  comprueba('se desblinda solo si la API no contesta', html.includes('setTimeout(desblinda,'));
  // Cinco segundos y no ocho: son segundos mirando un rectángulo negro sin
  // saber que hay un plan B en marcha.
  comprueba('a los cinco segundos', html.includes('var ESPERA = 5000;') && ESPERA_MS === 5000);
  comprueba('recargando con los controles normales', html.includes('marco.src = NORMAL'));
}

console.log('\nA dónde puede navegar el reproductor');
{
  comprueba('a su propio reproductor sí',
    seQuedaDentroDelBlindaje('https://www.youtube-nocookie.com/embed/abc?controls=0'));
  comprueba('a los vídeos de Google sí', seQuedaDentroDelBlindaje('https://rr3---sn-x.googlevideo.com/videoplayback?x=1'));
  comprueba('al reproductor de Vimeo sí', seQuedaDentroDelBlindaje('https://player.vimeo.com/video/1'));
  comprueba('a la propia página en blanco sí', seQuedaDentroDelBlindaje('about:blank'));
  // El origen prestado con el que se carga la página: llega a secas, sin ruta.
  comprueba('al origen prestado sí', seQuedaDentroDelBlindaje('https://www.youtube.com/'));

  // Y aquí lo que importa: "Ver en YouTube" no lleva a ninguna parte.
  comprueba('a la página de YouTube NO', !seQuedaDentroDelBlindaje('https://www.youtube.com/watch?v=abc'));
  comprueba('a un canal NO', !seQuedaDentroDelBlindaje('https://www.youtube.com/@canal'));
  comprueba('a la página de Vimeo NO', !seQuedaDentroDelBlindaje('https://vimeo.com/123456789'));
  comprueba('a compartir NO', !seQuedaDentroDelBlindaje('https://www.youtube.com/share?v=abc'));
  // Y lo que NO saca de la app, pasa: ver el porqué del cambio de criterio en
  // lib/video.ts. Bloquear lo desconocido dejaba el vídeo en negro.
  comprueba('un sitio cualquiera ya no se bloquea', seQuedaDentroDelBlindaje('https://ejemplo.com/loquesea'));
  comprueba('lo que ni es una dirección, tampoco', seQuedaDentroDelBlindaje('vaya vaya'));
  // Lo que sí sigue bloqueado, que es lo que importa: abrir la app de YouTube.
  comprueba('la app de YouTube por esquema propio NO', !seQuedaDentroDelBlindaje('vnd.youtube://abc'));

  // El guardián de siempre, el de los enlaces que NO se blindan, sigue igual.
  const embed = 'https://www.youtube-nocookie.com/embed/abc';
  comprueba('el guardián de antes sigue funcionando', seQuedaDentro(embed, embed));
  comprueba('y sigue sin dejar salir', !seQuedaDentro('https://www.youtube.com/watch?v=abc', embed));
}

console.log('\nEl tiempo, como se lee en un vídeo');
{
  comprueba('cero', tiempoCorto(0) === '0:00');
  comprueba('segundos sueltos', tiempoCorto(9) === '0:09');
  comprueba('minutos', tiempoCorto(75) === '1:15');
  comprueba('una hora larga', tiempoCorto(3671) === '1:01:11');
  comprueba('se redondea hacia abajo', tiempoCorto(59.9) === '0:59');
  comprueba('nada raro con lo imposible', tiempoCorto(-5) === '0:00' && tiempoCorto(NaN) === '0:00');
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
