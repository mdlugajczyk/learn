const VERSION = '7c3ad1e92082';
const PREFIX = 'mimi-reading-';
const CACHE = `${PREFIX}${VERSION}`;
const base = new URL('./', self.location.href);
const absolute = path => new URL(path, base).href;
async function notify(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.filter(client => client.url.startsWith(base.href)).forEach(client => client.postMessage(message));
}
async function verify(response, asset) {
  if (!response.ok) throw new Error(`Missing ${asset.path}`);
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== asset.bytes) throw new Error(`Size mismatch ${asset.path}`);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== asset.sha256) throw new Error(`Hash mismatch ${asset.path}`);
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const response = await fetch(absolute('offline-pack.json'), { cache: 'no-store' });
  if (!response.ok) throw new Error('Pack unavailable');
  const pack = await response.json();
  if (VERSION !== pack.version) throw new Error('Pack version mismatch');
  const cache = await caches.open(CACHE);
  let done = 0;
  for (let start = 0; start < pack.assets.length; start += 4) {
    await Promise.all(pack.assets.slice(start, start + 4).map(async asset => {
      if (asset.path.startsWith('/') || asset.path.includes('..') || asset.path.includes(':')) throw new Error('Invalid asset path');
      const cached = await fetch(absolute(asset.path), { cache: 'no-store' });
      await verify(cached, asset);
      // Pages redirects /index.html to /. Store a fresh response so offline
      // navigations do not reject the cached response's redirected flag.
      const headers = new Headers(cached.headers);
      headers.delete('content-encoding');
      headers.delete('content-length');
      await cache.put(absolute(asset.path), new Response(await cached.arrayBuffer(), { status: cached.status, headers }));
      done++;
      await notify({ type: 'MIMI_PACK_PROGRESS', done, total: pack.assets.length });
    }));
  }
  await cache.put(absolute('offline-pack.json'), new Response(JSON.stringify(pack), { headers: { 'Content-Type': 'application/json' } }));
  // Default waiting behavior keeps an in-progress lesson on its existing version.
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
  await notify({ type: 'MIMI_OFFLINE_READY' });
})()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_PACK') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await cache.match(absolute('offline-pack.json'));
    if (!response) return;
    const pack = await response.json();
    const entries = await Promise.all(pack.assets.map(asset => cache.match(absolute(asset.path))));
    if (entries.every(Boolean)) event.source?.postMessage({ type: 'MIMI_OFFLINE_READY' });
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const path = event.request.mode === 'navigate' ? absolute('index.html') : event.request;
    const cached = await cache.match(path, { ignoreSearch: true });
    if (!cached) return fetch(event.request);
    // Safari's media element requests byte ranges, even for tiny local MP3s.
    // Serve these from the full verified file so narration also works offline.
    const range = event.request.headers.get('range');
    if (!range || !url.pathname.endsWith('.mp3')) return cached;
    const bytes = await cached.arrayBuffer();
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, bytes.byteLength - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
    if (start > end || start >= bytes.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`, 'Content-Length': String(end - start + 1)
    } });
  })());
});
