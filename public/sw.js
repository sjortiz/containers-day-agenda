/* Service worker de Mi Agenda · Containers Day.
 * - Cachea el app shell para uso offline (network-first en navegaciones).
 * - Muestra notificaciones (se invocan desde la app vía registration.showNotification).
 * - Al hacer clic en una notificación, enfoca o abre la PWA.
 *
 * El scope/base lo derivamos de la ubicación del propio SW, así funciona igual
 * en "/" o en "/<repo>/" (GitHub Pages project page).
 */
const CACHE = 'cd-agenda-v1';
const BASE = new URL('./', self.location).pathname; // ej. "/containers-day-agenda/"

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones: network-first con fallback al shell cacheado (offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match(BASE);
        }),
    );
    return;
  }

  // El horario publicado debe estar siempre fresco: network-first con fallback
  // a la copia cacheada cuando no hay conexión. La app lo re-pide al avisar
  // antes de cada charla, así que no queremos servir una versión vieja.
  if (url.pathname.endsWith('/agenda.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Resto de assets (_next, iconos, json): stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;
      const all = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of all) {
        if (client.url.startsWith(scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(scope);
    })(),
  );
});
