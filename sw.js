/*
 * Service worker de Maestría en Calistenia.
 *
 * Estrategia:
 *  - Bundles de /_expo/ (llevan hash en el nombre): cache-first, la app
 *    instalada abre al instante sin red.
 *  - Navegaciones (HTML): network-first con respaldo en caché, para que las
 *    actualizaciones lleguen en cuanto se publican pero la app funcione
 *    también sin conexión.
 *  - version.json: siempre a la red, nunca a la caché. Es lo que dice cuál es
 *    la última versión publicada; una copia guardada diría siempre "la tuya".
 *  - manifest.json: network-first. Es lo que el móvil lee al instalar la app;
 *    con una copia vieja se instalaba con el icono viejo.
 *  - Iconos y demás estáticos propios: stale-while-revalidate.
 *  - Nunca toca peticiones a otros dominios (Firebase, etc.).
 *
 * LA CACHÉ LLEVA LA VERSIÓN
 *
 * La marca que va en el nombre de la caché la cambia scripts/sellar-version.mjs
 * por el identificador de cada despliegue. Así este fichero cambia en cada
 * despliegue (si no, el
 * navegador no se entera de que hay uno nuevo) y al activarse tira la caché
 * del anterior entera, con lo que no queda ni un icono ni un bundle viejo.
 */

const CACHE = 'maestria-95528eef4885-598';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** A la red y, si no hay, lo que haya guardado. */
function redPrimero(request, respaldo) {
  return fetch(request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return res;
    })
    .catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(request)) || (respaldo && (await cache.match(respaldo))) || Response.error();
    });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firebase y demás: siempre red.

  // La versión publicada: ni se guarda ni se sirve de la caché.
  if (url.pathname.endsWith('/version.json')) return;

  // Bundles con hash: inmutables, cache-first.
  if (url.pathname.startsWith('/_expo/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Navegaciones: network-first, respaldo offline desde caché.
  if (request.mode === 'navigate') {
    event.respondWith(redPrimero(request, '/'));
    return;
  }

  // El manifiesto: lo último publicado, que es lo que se instala.
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(redPrimero(request));
    return;
  }

  // Resto de estáticos propios: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      const refresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
