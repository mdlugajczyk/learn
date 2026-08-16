const SHELL_CACHE = 'czytaj-shell-v11';
const PACK_PREFIX = 'czytaj-pack-';
const SCOPE_URL = self.registration.scope;
const SCOPE_PATH = new URL(SCOPE_URL).pathname;
const scoped = (path = '') => new URL(path, SCOPE_URL).href;
const SHELL = [
  '', 'index.html', 'styles.css', 'app.js', 'engine.js', 'store.js', 'audio.js',
  'data/curriculum.js', 'data/audio-manifest.js', 'manifest.webmanifest',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/AtkinsonHyperlegibleNext.woff2'
].map(scoped);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const packs = keys.filter((key) => key.startsWith(PACK_PREFIX)).sort().reverse();
    await Promise.all(keys.filter((key) => key.startsWith('czytaj-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key)));
    await Promise.all(packs.slice(2).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && request.method === 'GET') {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      if (request.mode === 'navigate') return (await caches.match(scoped('index.html'))) || Response.error();
      return Response.error();
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  const requestId = event.data?.requestId;
  const reply = (data) => event.source?.postMessage({ ...data, requestId });
  if (event.data?.type === 'VERIFY_PACK') event.waitUntil(verifyPack(event.data.manifest, reply));
  if (event.data?.type === 'DOWNLOAD_PACK') event.waitUntil(downloadPack(event.data.manifest, reply));
});

async function downloadPack(manifest, reply) {
  const cacheName = `${PACK_PREFIX}${manifest.version}`;
  const stagingName = `${cacheName}-staging`;
  await caches.delete(stagingName);
  const cache = await caches.open(stagingName);
  let completed = 0;
  try {
    for (const asset of manifest.assets) {
      const assetUrl = new URL(asset.path, SCOPE_URL).href;
      const response = await fetch(assetUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${asset.path}: ${response.status}`);
      const buffer = await response.clone().arrayBuffer();
      if (asset.bytes && buffer.byteLength !== asset.bytes) throw new Error(`${asset.path}: nieprawidłowy rozmiar`);
      if (asset.sha256 && await sha256(buffer) !== asset.sha256) throw new Error(`${asset.path}: nieprawidłowa suma kontrolna`);
      await cache.put(assetUrl, response);
      completed += 1;
      reply({ type: 'progress', completed, total: manifest.assets.length, bytes: manifest.totalBytes });
    }
    await caches.delete(cacheName);
    const destination = await caches.open(cacheName);
    for (const request of await cache.keys()) await destination.put(request, await cache.match(request));
    await caches.delete(stagingName);
    reply({ type: 'complete', completed, total: manifest.assets.length, bytes: manifest.totalBytes, version: manifest.version });
  } catch (error) {
    await caches.delete(stagingName);
    reply({ type: 'error', message: error.message });
  }
}

async function verifyPack(manifest, reply) {
  try {
    let completed = 0;
    for (const asset of manifest.assets) {
      const assetUrl = new URL(asset.path, SCOPE_URL).href;
      const response = await caches.match(assetUrl, { ignoreSearch: true });
      if (!response) return reply({ type: 'error', message: `Brakuje: ${asset.path}` });
      const buffer = await response.clone().arrayBuffer();
      if (asset.bytes && buffer.byteLength !== asset.bytes) return reply({ type: 'error', message: `Uszkodzony plik: ${asset.path}` });
      if (asset.sha256 && await sha256(buffer) !== asset.sha256) return reply({ type: 'error', message: `Niepoprawna suma kontrolna: ${asset.path}` });
      completed += 1;
      reply({ type: 'progress', completed, total: manifest.assets.length, bytes: manifest.totalBytes });
    }
    reply({ type: 'complete', completed, total: manifest.assets.length, bytes: manifest.totalBytes, version: manifest.version });
  } catch (error) {
    reply({ type: 'error', message: error.message });
  }
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
