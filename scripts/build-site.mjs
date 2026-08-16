import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateCzytaj } from './validate-czytaj.mjs';

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, 'public');
const outputRoot = path.join(projectRoot, 'dist');
const clientRoot = path.join(outputRoot, 'client');
const workerPath = path.join(outputRoot, 'server', 'index.js');

const tracked = execFileSync('git', ['ls-files', '-z', 'public'], { cwd: projectRoot, encoding: 'utf8' }).split('\0').filter(Boolean);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && entry.name !== '.DS_Store') files.push(absolute);
  }
  return files;
}

const czytajFiles = (await walk(path.join(publicRoot, 'czytaj'))).map((file) => path.relative(projectRoot, file));
const sourceFiles = [...new Set([...tracked, ...czytajFiles])].filter((file) => !file.endsWith('.DS_Store'));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(clientRoot, { recursive: true });
for (const relativeFile of sourceFiles) {
  const destination = path.join(clientRoot, relativeFile.replace(/^public\//, ''));
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(projectRoot, relativeFile), destination);
}

const packFiles = (await walk(path.join(clientRoot, 'czytaj'))).filter((file) => !file.endsWith('offline-pack.json'));
const packRoot = path.join(clientRoot, 'czytaj');
const packAssets = [];
for (const file of packFiles) {
  const contents = await readFile(file);
  packAssets.push({
    path: path.relative(packRoot, file).split(path.sep).join('/'),
    bytes: contents.byteLength,
    sha256: createHash('sha256').update(contents).digest('hex')
  });
}
packAssets.sort((a, b) => a.path.localeCompare(b.path));
const packManifest = {
  schemaVersion: 1,
  version: `czytaj-${createHash('sha256').update(JSON.stringify(packAssets)).digest('hex').slice(0, 12)}`,
  assetCount: packAssets.length,
  totalBytes: packAssets.reduce((total, asset) => total + asset.bytes, 0),
  assets: packAssets
};
const packManifestJson = `${JSON.stringify(packManifest, null, 2)}\n`;
await Promise.all([
  writeFile(path.join(clientRoot, 'czytaj', 'offline-pack.json'), packManifestJson),
  writeFile(path.join(publicRoot, 'czytaj', 'offline-pack.json'), packManifestJson)
]);
await validateCzytaj({ strictAudio: true });

const workerSource = `
export default {
  async fetch(request, env) {
    if (!env?.ASSETS?.fetch) return new Response('Static asset binding unavailable', { status: 503 });
    let response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    if (response.status === 404 && request.method === 'GET' && url.pathname.startsWith('/czytaj/') && request.headers.get('accept')?.includes('text/html')) {
      response = await env.ASSETS.fetch(new Request(new URL('/czytaj/index.html', url), request));
    }
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('sw.js')) headers.set('Cache-Control', 'no-cache');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
`;
await mkdir(path.dirname(workerPath), { recursive: true });
await writeFile(workerPath, workerSource);

const workerBytes = (await stat(workerPath)).size;
if (workerBytes >= 1024 * 1024) throw new Error(`Worker exceeds 1 MB budget: ${workerBytes} bytes`);
if (packManifest.totalBytes >= 60 * 1024 * 1024) throw new Error(`Offline pack exceeds 60 MB budget: ${packManifest.totalBytes} bytes`);
if (packManifest.assetCount >= 900) throw new Error(`Offline pack exceeds 900 file budget: ${packManifest.assetCount}`);
console.log(`Built ${sourceFiles.length} static files, ${formatBytes(packManifest.totalBytes)} Czytaj pack, ${formatBytes(workerBytes)} Worker.`);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
