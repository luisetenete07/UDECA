/*
 * Enlaces de vídeo y sus miniaturas (lib/video.ts).
 *
 * Aquí se pega lo que el entrenador copia del navegador, que nunca es un
 * formato solo: vimeo.com/123, el enlace con hash de un vídeo oculto, un
 * youtu.be acortado, un Short. Si uno de esos no se reconoce, la lección se
 * queda sin reproducirse y sin miniatura, y el entrenador no tiene forma de
 * saber que el problema era la forma del enlace.
 *
 *   node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-video.mjs
 */
import {
  miniaturaDelEnlace,
  miniaturaDeYouTube,
  parseVimeoUrl,
  parseYouTubeId,
  urlDeOEmbedVimeo,
  vimeoEmbedUrl,
} from '../lib/video.ts';

let fallos = 0;
function comprueba(nombre, condicion, detalle = '') {
  if (condicion) console.log(`  ✔ ${nombre}`);
  else {
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
    fallos++;
  }
}

console.log('\nLo que se copia de Vimeo');
{
  comprueba('el enlace normal', parseVimeoUrl('https://vimeo.com/123456789')?.id === '123456789');
  const oculto = parseVimeoUrl('https://vimeo.com/123456789/a1b2c3d4e5');
  comprueba('el de un vídeo oculto trae su hash', oculto?.hash === 'a1b2c3d4e5');
  const player = parseVimeoUrl('https://player.vimeo.com/video/123456789?h=abc123');
  comprueba('el del reproductor también', player?.id === '123456789' && player?.hash === 'abc123');
  comprueba('un enlace de otro sitio, no', parseVimeoUrl('https://ejemplo.com/123') === null);
  comprueba('texto que no es una URL, no', parseVimeoUrl('mi vídeo') === null);

  // El hash tiene que viajar al embed: sin él, un vídeo oculto contesta que no
  // existe y el alumno ve un reproductor en negro.
  comprueba('el hash llega al reproductor', vimeoEmbedUrl(oculto).includes('h=a1b2c3d4e5'));
  comprueba('y sin hash no se inventa uno', !vimeoEmbedUrl({ id: '1' }).includes('h='));
}

console.log('\nLo que se copia de YouTube');
{
  comprueba('watch?v=', parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
  comprueba('youtu.be acortado', parseYouTubeId('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
  comprueba('un Short', parseYouTubeId('https://www.youtube.com/shorts/abc123XYZ_-') === 'abc123XYZ_-');
  comprueba('un embed', parseYouTubeId('https://www.youtube.com/embed/abc123XYZ_-') === 'abc123XYZ_-');
  comprueba(
    'pegado sin https, que es como se pega de verdad',
    parseYouTubeId('youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ'
  );
  comprueba('con espacios de sobra', parseYouTubeId('  https://youtu.be/abc123XYZ_-  ') === 'abc123XYZ_-');
  comprueba('otro sitio, no', parseYouTubeId('https://vimeo.com/123') === null);
}

console.log('\nLa miniatura, sin pedirle nada a nadie');
{
  // Es lo que hace que las mini clases no necesiten foto subida: la de YouTube
  // se saca de la propia dirección.
  comprueba(
    'la de YouTube se deduce del enlace',
    miniaturaDelEnlace('https://youtu.be/dQw4w9WgXcQ') ===
      'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
  );
  comprueba(
    'hqdefault y no maxres: esa existe para todos los vídeos',
    miniaturaDeYouTube('x').endsWith('/hqdefault.jpg')
  );
  comprueba('la de Vimeo hay que preguntarla, así que aquí no sale',
    miniaturaDelEnlace('https://vimeo.com/123456789') === null);
  comprueba('un .mp8 suelto no tiene portada', miniaturaDelEnlace('https://x.com/v.mp4') === null);
  comprueba('sin enlace, nada', miniaturaDelEnlace(undefined) === null);
  comprueba('con enlace vacío, nada', miniaturaDelEnlace('') === null);
}

console.log('\nA Vimeo se le pregunta por la dirección correcta');
{
  const sin = urlDeOEmbedVimeo({ id: '123456789' });
  comprueba('va a su oembed', sin.startsWith('https://vimeo.com/api/oembed.json?url='));
  comprueba('con el vídeo dentro', sin.includes(encodeURIComponent('https://vimeo.com/123456789')));

  // Un vídeo oculto sin su hash contesta que no existe: se quedaría sin
  // miniatura justo en los cursos privados, que son todos.
  const con = urlDeOEmbedVimeo({ id: '123456789', hash: 'a1b2c3' });
  comprueba(
    'el hash va en la pregunta',
    con.includes(encodeURIComponent('https://vimeo.com/123456789/a1b2c3'))
  );
}

console.log(fallos === 0 ? '\nTodo correcto ✔' : `\n${fallos} fallo(s)`);
process.exit(fallos === 0 ? 0 : 1);
