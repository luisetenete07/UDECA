/*
 * Que los vídeos se puedan VER en el móvil, y que sigan sin sacar de la app.
 *
 * POR QUÉ EXISTE
 *
 * En iPhone y Android los vídeos de técnica y de los cursos se veían en negro.
 * En el ordenador funcionaban, así que no se notaba: ahí el vídeo va en un
 * `iframe` y nadie le pregunta nada. En el móvil va en un WebView, y el WebView
 * pasa cada dirección por `seQuedaDentro` / `seQuedaDentroDelBlindaje` antes de
 * cargarla.
 *
 * Esas dos funciones bloqueaban el dominio `youtube.com` ENTERO. Y en ese
 * dominio viven dos cosas muy distintas:
 *
 *   - Las PIEZAS del reproductor: `/iframe_api`, `/s/player/…/base.js`,
 *     `/youtubei/v1/…`. Sin ellas no hay vídeo, solo un rectángulo negro.
 *   - Las PÁGINAS: `/watch`, `/@canal`, `/results`. Ahí llevan el logo y el
 *     "Ver en YouTube", y ahí es donde no se puede ir.
 *
 * Bloquear las dos por igual mataba el reproductor para proteger algo que se
 * podía proteger sin matarlo.
 *
 * Es un fallo silencioso y caro: no da error, no aparece en el navegador, y en
 * el móvil se ve como una app rota. De ahí este guion, que comprueba LAS DOS
 * COSAS a la vez —que el reproductor arranca y que no se sale— porque arreglar
 * una rompiendo la otra es muy fácil.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-video-movil.mjs
 */
import { seQuedaDentro, seQuedaDentroDelBlindaje } from '../lib/video.ts';

let fallos = 0;
/** El porqué solo se imprime cuando falla; si pasa, sobra y despista. */
const ok = (n, c, porQue = '') => {
  if (!c) fallos++;
  console.log(`  ${c ? '✔' : '✖'} ${n}${!c && porQue ? ` — ${porQue}` : ''}`);
};

/** El embed que se usa de verdad, para el guardián del reproductor normal. */
const EMBED = 'https://www.youtube-nocookie.com/embed/ID?rel=0&modestbranding=1&playsinline=1';

/**
 * Lo que el reproductor pide para poder reproducir. Si algo de esto se
 * bloquea, el vídeo se queda en negro.
 */
const NECESITA = [
  ['https://www.youtube.com/iframe_api', 'la API que monta el reproductor'],
  ['https://www.youtube.com/s/player/abc123/base.js', 'el código del reproductor'],
  ['https://www.youtube.com/youtubei/v1/player', 'los datos del vídeo'],
  ['https://www.youtube-nocookie.com/embed/ID', 'el marco del vídeo'],
  ['https://i.ytimg.com/vi/ID/hqdefault.jpg', 'la miniatura'],
  ['https://rr1.googlevideo.com/videoplayback?x=1', 'el vídeo en sí'],
  ['https://fonts.gstatic.com/s/roboto.woff2', 'la tipografía del reproductor'],
  ['https://player.vimeo.com/video/123', 'el reproductor de Vimeo'],
];

/**
 * Lo que saca al usuario de UDECA. Un alumno se ha metido en una lección de su
 * curso, no en un navegador — y el vídeo del curso no puede acabar abierto en
 * la app de YouTube, a la vista de cualquiera.
 */
const NO_DEBE_PASAR = [
  ['https://www.youtube.com/watch?v=ID', 'la página del vídeo'],
  ['https://m.youtube.com/watch?v=ID', 'la página del vídeo, en móvil'],
  ['https://youtu.be/ID', 'el enlace corto'],
  ['https://www.youtube.com/@uncanal', 'el canal'],
  ['https://www.youtube.com/channel/UC123', 'el canal, en la forma vieja'],
  ['https://www.youtube.com/results?search_query=x', 'la búsqueda'],
  ['https://www.youtube.com/playlist?list=X', 'una lista'],
  ['https://www.youtube.com/share?v=ID', 'compartir'],
  ['https://music.youtube.com/watch?v=ID', 'YouTube Music'],
  // La razón de ser de la lista de permitidos: una ruta que hoy no existe, o
  // que existe y yo no conozco, se queda fuera sola.
  ['https://www.youtube.com/algo-que-aun-no-existe', 'una ruta que no conozco'],
  ['https://ejemplo.com/cualquier-cosa', 'cualquier otra web'],
];

console.log('\nLo que el reproductor necesita para arrancar');
for (const [url, que] of NECESITA) {
  const blindado = seQuedaDentroDelBlindaje(url);
  const normal = seQuedaDentro(url, EMBED);
  ok(
    que,
    blindado && normal,
    blindado ? 'lo bloquea el reproductor normal' : 'lo bloquea el blindado'
  );
}

console.log('\nLo que NO puede cargarse, porque saca de la app');
for (const [url, que] of NO_DEBE_PASAR) {
  const blindado = seQuedaDentroDelBlindaje(url);
  const normal = seQuedaDentro(url, EMBED);
  ok(que, !blindado && !normal, blindado ? 'pasa en el blindado' : 'pasa en el normal');
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
