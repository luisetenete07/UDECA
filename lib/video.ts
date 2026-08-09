/**
 * Detección y normalización de enlaces de Vimeo para las lecciones.
 *
 * Formatos aceptados (los que copia el usuario desde Vimeo):
 *  - https://vimeo.com/123456789
 *  - https://vimeo.com/123456789/a1b2c3d4e5      (vídeo oculto, con hash)
 *  - https://player.vimeo.com/video/123456789?h=a1b2c3d4e5
 */
export interface VimeoRef {
  id: string;
  hash?: string;
}

export function parseVimeoUrl(url: string): VimeoRef | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)vimeo\.com$/.test(u.hostname)) return null;

    // player.vimeo.com/video/{id}?h={hash}
    let m = u.pathname.match(/^\/video\/(\d+)/);
    if (m) {
      return { id: m[1], hash: u.searchParams.get('h') ?? undefined };
    }

    // vimeo.com/{id}[/{hash}]
    m = u.pathname.match(/^\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (m) {
      return { id: m[1], hash: m[2] ?? u.searchParams.get('h') ?? undefined };
    }
    return null;
  } catch {
    return null;
  }
}

/** URL de embed del reproductor de Vimeo, con descarga y PiP desactivados. */
export function vimeoEmbedUrl(ref: VimeoRef): string {
  const params = new URLSearchParams({
    dnt: '1', // sin cookies de seguimiento
    pip: '0',
    byline: '0',
    title: '0',
    portrait: '0',
  });
  if (ref.hash) params.set('h', ref.hash);
  return `https://player.vimeo.com/video/${ref.id}?${params.toString()}`;
}

/** Extrae el id de un vídeo de YouTube de sus formatos habituales. */
export function parseYouTubeId(url: string): string | null {
  try {
    // Tolerante a enlaces pegados sin protocolo ("youtube.com/watch?v=...").
    const raw = url.trim();
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * URL de embed de YouTube para reproducir DENTRO de la app. Dominio
 * youtube-nocookie.com (menos avisos de cookies en la UE) y playsinline para
 * que en iPhone se reproduzca en la propia pantalla, sin salir de la app.
 */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}


/*
 * LA MINIATURA LA PONE LA PLATAFORMA
 *
 * Las mini clases no llevan miniatura propia: se usa la del sitio donde está
 * el vídeo. No es solo por ahorrar trabajo —que también—, es que un curso
 * entero vive en UN documento de Firestore y cada miniatura subida va dentro,
 * en base64. Con tres mini clases por lección, las fotos se comían el
 * documento antes que el contenido.
 *
 * Las lecciones sí la llevan, porque son las que se enseñan en la lista y las
 * que merecen una portada elegida. Las mini clases van dentro de una lección
 * que ya tiene cara.
 */

/** La miniatura pública de un vídeo de YouTube. Se deduce del id, sin pedir nada. */
export function miniaturaDeYouTube(id: string): string {
  // `hqdefault` y no `maxresdefault`: esta existe para TODOS los vídeos, y la
  // otra falta en los subidos en baja resolución y deja el hueco en gris.
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/**
 * La dirección donde Vimeo cuenta los datos de un vídeo, su miniatura incluida.
 *
 * Vimeo no deja deducir la miniatura de la URL como YouTube: hay que
 * preguntársela. Para los vídeos ocultos el hash va en la dirección, o
 * contesta que no existe.
 */
export function urlDeOEmbedVimeo(ref: VimeoRef): string {
  const video = ref.hash ? `https://vimeo.com/${ref.id}/${ref.hash}` : `https://vimeo.com/${ref.id}`;
  return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video)}`;
}

/**
 * La miniatura que se puede saber SIN pedir nada por la red.
 *
 * YouTube sí, porque va en la propia dirección. Vimeo no (hay que preguntarle,
 * ver `urlDeOEmbedVimeo`) y un .mp4 suelto tampoco: un archivo de vídeo no
 * trae portada, y sacarla habría que descargarlo entero.
 */
export function miniaturaDelEnlace(url: string | undefined): string | null {
  if (!url) return null;
  const yt = parseYouTubeId(url);
  return yt ? miniaturaDeYouTube(yt) : null;
}
