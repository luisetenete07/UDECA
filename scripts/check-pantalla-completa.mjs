/**
 * Los vídeos se abren a PANTALLA COMPLETA y empiezan solos, en la mejor
 * calidad que se pueda pedir: los de técnica y las clases de los cursos.
 *
 * Pantalla completa NUESTRA (components/VisorDeVideo), no la del sistema: la
 * del sistema pinta el vídeo por encima de la marca de agua.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-pantalla-completa.mjs
 */
import { readFileSync } from 'node:fs';
import { margenesDelLienzo, pantallaCompleta, RELACION, RELACION_VERTICAL, sePuedeGirar } from '../lib/visorDeVideo.ts';
import { CALIDAD_VIMEO, paraPantallaCompleta, vimeoEmbedUrl, youTubeEmbedUrl } from '../lib/video.ts';
import { fuenteBlindada } from '../lib/reproductorBlindado.ts';

let fallos = 0;
const ok = (desc, bien, extra = '') => {
  console.log(`  ${bien ? '✔' : '✖'} ${desc}${bien || !extra ? '' : ` — ${extra}`}`);
  if (!bien) fallos++;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lee = (f) => sinComentarios(readFileSync(f, 'utf8'));

console.log('\nOcupa la pantalla entera');
{
  // El motivo de todo: en un móvil de pie, un 16:9 sin girar es una franja de
  // 390×219. Girado, 693×390: el triple de vídeo.
  const movil = pantallaCompleta(390, 844, RELACION);
  ok('en el móvil de pie, un vídeo apaisado se gira', movil.girado);
  ok('y llena el alto del móvil tumbado (693×390)', movil.video.width === 693 && movil.video.height === 390,
    `${movil.video.width}×${movil.video.height}`);
  const antes = (390 * 0.96) * (390 * 0.96 / RELACION);
  ok('es mucho más vídeo que el visor de antes (×2,5 o más)', (movil.video.width * movil.video.height) / antes > 2.5,
    `×${((movil.video.width * movil.video.height) / antes).toFixed(1)}`);
  ok('el lienzo girado mide lo que la pantalla tumbada', movil.ancho === 844 && movil.alto === 390);

  const pc = pantallaCompleta(1440, 900, RELACION);
  ok('en un ordenador no se gira', !pc.girado);
  ok('y llega de borde a borde (1440 de ancho)', pc.video.width === 1440 && pc.video.height === 810,
    `${pc.video.width}×${pc.video.height}`);
  const bajita = pantallaCompleta(1600, 400, RELACION);
  ok('en una ventana bajita manda el alto', bajita.video.height === 400 && bajita.video.width <= 1600);
  const tumbado = pantallaCompleta(844, 390, RELACION);
  ok('con la pantalla ya tumbada, tal cual', !tumbado.girado && tumbado.video.height === 390);
}

console.log('\nLo que no se gira');
{
  const short = pantallaCompleta(390, 844, RELACION_VERTICAL);
  ok('un vertical (Short) se ve de pie', !short.girado);
  ok('y a todo lo ancho', short.video.width === 390, `${short.video.width}×${short.video.height}`);
  ok('quien no quiere girar el móvil, no lo gira', !pantallaCompleta(390, 844, RELACION, true).girado);
  ok('el botón de girar solo sale donde sirve', sePuedeGirar(390, 844) && !sePuedeGirar(1440, 900) && !sePuedeGirar(390, 844, RELACION_VERTICAL));
  const raro = pantallaCompleta(0, 0, 0);
  ok('nada raro rompe la cuenta', raro.video.width === 0 && raro.video.height === 0);
}

console.log('\nLa muesca y la barra de inicio, vistas desde el lienzo girado');
{
  const iphone = { top: 47, right: 0, bottom: 34, left: 0 };
  const g = margenesDelLienzo(iphone, true);
  // Girado a la derecha: la derecha del lienzo es el borde de abajo del móvil.
  ok('la barra de inicio queda a la derecha del lienzo', g.right === 34);
  ok('y la muesca a la izquierda', g.left === 47);
  ok('sin girar, los de siempre', margenesDelLienzo(iphone, false) === iphone);
}

console.log('\nEmpieza solo y pide la mejor calidad');
{
  const yt = paraPantallaCompleta(youTubeEmbedUrl('aBcD1234xyz'));
  ok('YouTube empieza solo', /[?&]autoplay=1/.test(yt));
  ok('y no se le inventa una calidad que YouTube no deja pedir', !/vq=|quality=/.test(yt));
  ok('sin perder lo que ya llevaba (sin sugerencias, dentro del móvil)', /rel=0/.test(yt) && /playsinline=1/.test(yt));
  const vi = paraPantallaCompleta(vimeoEmbedUrl({ id: '123456789', hash: 'abc123' }));
  ok(`Vimeo empieza solo y en ${CALIDAD_VIMEO}`, /[?&]autoplay=1/.test(vi) && new URL(vi).searchParams.get('quality') === CALIDAD_VIMEO);
  ok('y conserva el hash de los vídeos ocultos', new URL(vi).searchParams.get('h') === 'abc123');
  const drive = 'https://drive.google.com/file/d/xyz/preview';
  ok('un enlace de otro sitio se queda como está', paraPantallaCompleta(drive) === drive);
  ok('uno roto, también', paraPantallaCompleta('no soy un enlace') === 'no soy un enlace');
  const bl = fuenteBlindada('https://youtu.be/aBcD1234xyz', 'https://app.udeca.app');
  const blpc = paraPantallaCompleta(bl.src);
  ok('el blindado sigue blindado (sin controles suyos ni pantalla completa del sistema)', /controls=0/.test(blpc) && /fs=0/.test(blpc) && /autoplay=1/.test(blpc));
}

console.log('\nDónde se usa');
{
  const visor = lee('components/VisorDeVideo.tsx');
  ok('el visor pide al reproductor la pantalla completa', /<VideoPlayer url=\{url\} protectedContent=\{protegido\} pantallaCompleta \/>/.test(visor));
  ok('con la marca de agua encima del vídeo', /<MarcaDeAgua profile=\{profile\}>\s*<VideoPlayer/.test(visor));
  ok('girado cuando toca', /transform: pc\.girado \? \[\{ rotate: '90deg' \}\] : \[\]/.test(visor));
  ok('de borde a borde, sin barra de estado', /statusBarTranslucent/.test(visor) && /navigationBarTranslucent/.test(visor) && /<StatusBar hidden \/>/.test(visor));
  ok('en el navegador, la PÁGINA a pantalla completa', /const raiz = document\.documentElement/.test(visor) && /raiz\s*\.requestFullscreen\(/.test(visor));

  const vp = lee('components/VideoPlayer.tsx');
  ok('el reproductor aplica la pantalla completa a YouTube, Vimeo y el blindado',
    /embed\(youTubeEmbedUrl\(youtubeId\)\)/.test(vp) && /embed\(vimeoEmbedUrl\(vimeo\)\)/.test(vp) && /src: embed\(fuente\.src\)/.test(vp));
  ok('y un archivo suelto empieza solo', /if \(solo\) p\.play\(\)/.test(vp) && /autoPlay: solo/.test(vp));
  ok('sin el botón de pantalla completa del navegador en un .mp4 (taparía la marca)', /\$\{solo \? ' nofullscreen' : ''\}/.test(vp));
  ok('y de borde a borde, con las esquinas rectas', /value=\{props\.pantallaCompleta \? 0 : radius\.md\}/.test(vp) && !/borderRadius: radius\.md \}/.test(vp));
  ok('fuera del visor, nada cambia', /pantallaCompleta = false/.test(vp));
  // La del sistema no: ahí el vídeo se pinta por encima de la marca de agua.
  ok('y nunca la pantalla completa del sistema sobre el vídeo', !/requestFullscreen|enterFullscreen|presentFullscreenPlayer/.test(vp));

  const curso = lee('app/(client)/courses/[id].tsx');
  ok('al entrar en una clase, el vídeo se abre solo a pantalla completa', /setAmpliado\(mostrada && conVideo\)/.test(curso));
  ok('pero cuando su ventana ya está abierta (en iPhone, si no, no sale)', /onShow=\{\(\) => setMostrada\(true\)\}/.test(curso));
  ok('y en la clase queda la portada para volver a verlo, no otro reproductor', /onPress=\{\(\) => setAmpliado\(true\)\}/.test(curso) && !/<VideoPlayer url=\{contenido\.videoUrl\}/.test(curso));
  ok('una captura cierra la pantalla completa (la tapa va debajo)', /setPillado\(true\);\s*setAmpliado\(false\);/.test(curso));

  for (const [f, donde] of [
    ['app/(client)/workout.tsx', 'del entreno'],
    ['components/RutinaDiariaDelDia.tsx', 'de la rutina diaria'],
  ]) {
    ok(`la técnica ${donde} se abre en el mismo visor`, /<VisorDeVideo/.test(lee(f)));
  }
}

console.log(fallos === 0 ? '\n✔ Vídeos a pantalla completa' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
