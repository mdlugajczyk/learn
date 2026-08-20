const BUILD_VERSION = '__PACK_VERSION__';
const CACHE_PREFIX = 'tens-number-magic-';
const PACK_URL = './offline-pack.json';
let activeCacheName = `${CACHE_PREFIX}${BUILD_VERSION}`;
let cleanupPromise = null;

async function loadPack() {
  const response = await fetch(PACK_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Offline pack unavailable: ${response.status}`);
  const pack = await response.json();
  if (!pack.version || !Array.isArray(pack.assets)) throw new Error('Offline pack is invalid.');
  activeCacheName = `${CACHE_PREFIX}${pack.version}`;
  return pack;
}

async function notifyReady() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach(client => client.postMessage({ type: 'OFFLINE_READY', version: activeCacheName }));
}

async function cleanOldCaches() {
  if (!cleanupPromise) {
    cleanupPromise = caches.keys().then(keys => Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== activeCacheName)
      .map(key => caches.delete(key))));
  }
  return cleanupPromise;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const pack = await loadPack();
    const cache = await caches.open(activeCacheName);
    const assetUrls = pack.assets.map(asset => `./${asset.path}`);
    await cache.addAll([...new Set(['./', './index.html', PACK_URL, ...assetUrls])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  // Let pages that began under the previous worker finish with that same app
  // version. The new worker takes control atomically on the next navigation.
  event.waitUntil(notifyReady());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'CHECK_READY') event.waitUntil(notifyReady());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') event.waitUntil(cleanOldCaches());

  event.respondWith((async () => {
    const cache = await caches.open(activeCacheName);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      if (event.request.mode === 'navigate') {
        return (await cache.match('./index.html')) || Response.error();
      }
      return Response.error();
    }
  })());
});
