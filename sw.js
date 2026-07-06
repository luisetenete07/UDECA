/*
 * Service worker de UDECA.
 *
 * Estrategia:
 *  - Bundles de /_expo/ (llevan hash en el nombre): cache-first permanente,
 *    la app instalada abre al instante sin red.
 *  - Navegaciones (HTML): network-first con respaldo en caché, para que las
 *    actualizaciones lleguen en cuanto se publican pero la app funcione
 *    también sin conexión.
 *  - Iconos/manifest/fuentes propias: stale-while-revalidate.
 *  - Nunca toca peticiones a otros dominios (Firebase, etc.).
 */

const CACHE = 'udeca-v1';

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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firebase y demás: siempre red.

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
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match('/')) ||
            Response.error()
          );
        })
    );
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
