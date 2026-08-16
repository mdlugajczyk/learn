import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { enumeratePartitions } from '../public/numberblocks/engine.js';

const projectRoot = process.cwd();
const appRoot = path.join(projectRoot, 'public', 'numberblocks');

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function validateNumberMagic({ strictAudio = true } = {}) {
  const errors = [];
  const required = [
    'index.html', 'styles.css', 'app.js', 'engine.js', 'sw.js',
    'manifest.webmanifest', 'offline-pack.json', 'icons/icon-192.png',
    'icons/icon-512.png', 'icons/icon-maskable-512.png'
  ];
  for (const relative of required) {
    if (!await exists(path.join(appRoot, relative))) errors.push(`Missing ${relative}`);
  }

  const html = await readFile(path.join(appRoot, 'index.html'), 'utf8');
  const appSource = await readFile(path.join(appRoot, 'app.js'), 'utf8');
  const styles = await readFile(path.join(appRoot, 'styles.css'), 'utf8');
  const worker = await readFile(path.join(appRoot, 'sw.js'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(appRoot, 'manifest.webmanifest'), 'utf8'));
  const offlinePack = JSON.parse(await readFile(path.join(appRoot, 'offline-pack.json'), 'utf8'));

  if (/https?:\/\//i.test(html + appSource + styles)) errors.push('Runtime source contains a remote URL');
  if (manifest.display !== 'standalone') errors.push('Manifest must use standalone display mode');
  if (manifest.orientation !== 'portrait-primary') errors.push('Manifest must prefer portrait orientation');
  if (!html.includes('viewport-fit=cover')) errors.push('Missing iPhone safe-area viewport support');
  if (!styles.includes('safe-area-inset-bottom')) errors.push('Missing safe-area CSS');
  if (!worker.includes("cache.addAll")) errors.push('Service worker must atomically cache the app pack');
  if (!worker.includes("mode === 'navigate'")) errors.push('Service worker needs an offline navigation fallback');
  if (!Array.isArray(offlinePack.assets)) errors.push('Offline pack assets must be an array');

  const expectedAudio = ['welcome.m4a'];
  for (let target = 2; target <= 10; target += 1) {
    expectedAudio.push(`play-${target}.m4a`, `together-${target}.m4a`, `new-way-${target}.m4a`);
    for (const parts of enumeratePartitions(target, { includeWhole: false })) {
      expectedAudio.push(`composition-${target}-${parts.join('-')}.m4a`);
    }
  }
  if (strictAudio) {
    for (const filename of expectedAudio) {
      const audioPath = path.join(appRoot, 'audio', filename);
      if (!await exists(audioPath)) {
        errors.push(`Missing narration: audio/${filename}`);
        continue;
      }
      if ((await stat(audioPath)).size < 1000) errors.push(`Narration is too small: audio/${filename}`);
    }
    const actualAudio = (await readdir(path.join(appRoot, 'audio'))).filter(name => name.endsWith('.m4a'));
    if (actualAudio.length !== expectedAudio.length) {
      errors.push(`Expected ${expectedAudio.length} narration files, found ${actualAudio.length}`);
    }
  }

  if (errors.length) throw new Error(`Number Magic validation failed:\n- ${errors.join('\n- ')}`);
  return { audioCount: expectedAudio.length, offlineAssetCount: offlinePack.assetCount || 0 };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = await validateNumberMagic({ strictAudio: process.argv.includes('--strict-audio') });
  console.log(`Number Magic validated: ${result.audioCount} narration clips, ${result.offlineAssetCount} offline assets.`);
}
