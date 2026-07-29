import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'dist');
const workerPath = path.join(outputRoot, 'server', 'index.js');
const trackedPublicFiles = execFileSync('git', ['ls-files', 'public'], {
  cwd: projectRoot,
  encoding: 'utf8'
})
  .split('\n')
  .filter(Boolean);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const assets = {};
for (const relativeFile of trackedPublicFiles) {
  const extension = path.extname(relativeFile).toLowerCase();
  if (!contentTypes[extension]) continue;
  const requestPath = `/${relativeFile.replace(/^public\//, '')}`;
  assets[requestPath] = {
    body: (await readFile(path.join(projectRoot, relativeFile))).toString('base64'),
    type: contentTypes[extension]
  };
}

const workerSource = `
const assets = ${JSON.stringify(assets)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let requestPath;
    try {
      requestPath = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    if (requestPath === '/') requestPath = '/index.html';
    const asset = assets[requestPath];
    if (!asset) return new Response('Not found', { status: 404 });

    const isDocument = requestPath.endsWith('.html') || requestPath.endsWith('.js');
    const headers = new Headers({
      'Content-Type': asset.type,
      'Cache-Control': isDocument ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(decodeBase64(asset.body), { headers });
  }
};
`;

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.dirname(workerPath), { recursive: true });
await writeFile(workerPath, workerSource);
console.log(`Built ${trackedPublicFiles.length} public files.`);
