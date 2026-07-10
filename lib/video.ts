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
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1) || null;
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(embed|shorts)\/([\w-]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

/** URL de embed de YouTube (sin vídeos relacionados, marca discreta). */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

/** Devuelve la URL de reproductor embebido (Vimeo o YouTube), o null. */
export function toEmbedUrl(url: string): string | null {
  const v = parseVimeoUrl(url);
  if (v) return vimeoEmbedUrl(v);
  const y = parseYouTubeId(url);
  if (y) return youTubeEmbedUrl(y);
  return null;
}
