const CACHE_NAME = 'alphabet-learning-app-cache';

// Listen for the `message` event to dynamically get the mapping
let letterToWordAndImage = {};

self.addEventListener('message', event => {
  if (event.data.type === 'init_data') {
    letterToWordAndImage = event.data.words;

    // Generate the assets to cache dynamically
    const STATIC_ASSETS = [
      '/',
      '/index.html',
      '/style.css',
      ...Object.values(letterToWordAndImage).map(word => `/img/${word}.png`),
    ];

    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(STATIC_ASSETS).catch(err => {
        console.error('Failed to cache some assets:', err);
      });
    });
  }
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return (
        cachedResponse ||
        fetch(event.request).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
      );
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
