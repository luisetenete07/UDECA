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

/**
 * EN EL DOMINIO DE YOUTUBE VIVEN DOS COSAS QUE NO SE PARECEN EN NADA
 *
 *  - Las PIEZAS del reproductor: `/iframe_api`, `/s/player/…/base.js`,
 *    `/youtubei/v1/…`. Sin ellas no hay vídeo, solo un rectángulo negro.
 *  - Las PÁGINAS: `/watch`, `/@alguien`, `/results`, `/share`. Ahí es donde
 *    llevan el logo y el "Ver en YouTube", y ahí es donde no se va.
 *
 * Bloquear el dominio entero, que es lo que se hacía, dejaba los vídeos en
 * negro en iPhone y en Android: la API no cargaba nunca y el reproductor no
 * llegaba a montarse. En el ordenador no se notaba porque ahí el vídeo va en un
 * iframe normal y nadie le pregunta a estas funciones.
 *
 * POR QUÉ ESTO ES UNA LISTA DE LO QUE SÍ, Y NO DE LO QUE NO
 *
 * El primer intento fue al revés: una lista de las páginas a bloquear
 * (`/watch`, `/channel`, `/@…`). Duró lo que tardó la prueba en recordarme
 * `/share`, que no estaba en la lista y se colaba. Y esa es la naturaleza del
 * problema: las rutas de YouTube las decide YouTube, y cualquiera que yo no
 * conozca se convierte en una salida abierta.
 *
 * Las piezas que el reproductor necesita, en cambio, sí son un conjunto
 * cerrado y conocido. Enumerar ESO y negar el resto convierte un olvido mío en
 * un vídeo que no carga —visible al instante— en vez de en una puerta de salida
 * que nadie ve hasta que un alumno se encuentra el curso abierto en YouTube.
 */
const RUTAS_DEL_REPRODUCTOR = [
  '/iframe_api', // el guion que monta el reproductor
  '/s/', // su código y sus recursos (/s/player/…/base.js)
  '/yts/', // los mismos, en la forma antigua
  '/youtubei/', // de dónde saca los datos del vídeo
  '/embed/', // el marco del vídeo
  '/api/stats/', // los avisos de "va bien / va a tirones"
  '/api/timedtext', // los subtítulos
  '/ptracking',
  '/generate_204', // comprobaciones de red, sin contenido
  '/player_204',
  '/error_204',
  '/videoplayback', // el vídeo, cuando no viene por googlevideo.com
];

function esRutaDelReproductor(ruta: string): boolean {
  return RUTAS_DEL_REPRODUCTOR.some((r) =>
    r.endsWith('/') ? ruta.startsWith(r) : ruta === r || ruta.startsWith(`${r}?`)
  );
}

/**
 * Dominios que solo sirven piezas: no tienen páginas donde perderse, así que
 * se admiten enteros.
 */
const DOMINIOS_DE_PIEZAS = [
  'youtube-nocookie.com',
  'googlevideo.com',
  'ytimg.com',
  'gstatic.com',
  'player.vimeo.com',
  'vimeocdn.com',
];

/**
 * ¿Esta dirección es una pieza del reproductor, y no una página?
 *
 * `youtu.be` no aparece por ningún lado a propósito: ese dominio solo sirve
 * para mandarte a la página del vídeo.
 */
function esPiezaDelReproductor(destino: string): boolean {
  try {
    const u = new URL(destino);
    const host = u.hostname.replace(/^www\./, '');
    if (DOMINIOS_DE_PIEZAS.some((d) => host === d || host.endsWith(`.${d}`))) return true;
    // En youtube.com se mira la ruta, porque ahí conviven las dos cosas.
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      return esRutaDelReproductor(u.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * ¿Puede el WebView cargar esta dirección?
 *
 * Solo el propio reproductor y los dominios que necesita para funcionar. Todo
 * lo demás —la página de YouTube, la de Vimeo, un enlace de un comentario— se
 * queda fuera: el alumno se ha metido en una lección de su curso, no en un
 * navegador.
 */
export function seQuedaDentro(destino: string, embedUrl: string): boolean {
  if (destino === embedUrl || destino === 'about:blank') return true;
  if (esPiezaDelReproductor(destino)) return true;
  /*
   * El mismo sitio del que salió el vídeo, para lo que no sea YouTube ni Vimeo
   * (un .mp4 alojado en cualquier parte). En YouTube esto NO vale como permiso
   * —lo de arriba ya ha decidido, mirando la ruta—, porque el embed vive en el
   * mismo dominio que la página del vídeo.
   */
  try {
    const host = new URL(destino).hostname.replace(/^www\./, '');
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return false;
    return host === new URL(embedUrl).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
}

/**
 * Lo mismo, para el reproductor blindado.
 *
 * Ahí la página es NUESTRA y el reproductor de la plataforma va dentro, en un
 * marco. Se le deja cargar su propio reproductor y lo que necesite para
 * funcionar; todo lo demás —y en particular youtube.com, que es donde llevan
 * "Ver en YouTube" y el logo— se queda fuera. El cristal ya impide pulsarlos;
 * esto es la segunda cerradura, por si algún día el cristal falla.
 */
export function seQuedaDentroDelBlindaje(destino: string): boolean {
  if (destino === 'about:blank' || destino.startsWith('data:')) return true;
  try {
    const u = new URL(destino);
    // La propia página del reproductor se carga con un origen prestado
    // (youtube.com o player.vimeo.com) para que la API de la plataforma pueda
    // hablar con ella. Ese origen se admite A SECAS: sin ruta, que es como
    // llega.
    if (u.pathname === '' || u.pathname === '/') return true;
  } catch {
    return false;
  }
  return esPiezaDelReproductor(destino);
}
