const CACHE_NAME = 'salvador-v6'; // Incrementá este número cuando hagas cambios grandes

const urlsToCache = [
  '/index.html',
  '/css/styles.css',
  '/js/menu.js',
  '/js/carrito.js',
  '/js/firebase.js',
  '/js/utils/format.js',
  '/js/utils/escapeHTML.js',
  '/js/utils/dom.js',
  '/js/utils/storage.js',
  '/js/utils/toast.js'
];

// Instalación
self.addEventListener('install', event => {
  self.skipWaiting(); // Activa el nuevo SW inmediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activación: limpia cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
});

// Estrategia: Network First (primero red, si falla, caché)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});