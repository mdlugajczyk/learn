import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { NUMBER_MAGIC_V1_AUDIO_ENTRIES } from './number-magic-v1-audio-catalog.mjs';

const projectRoot = process.cwd();
const appRoot = path.join(projectRoot, 'public', 'numberblocks');

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

export async function validateNumberMagic({ strictAudio = true } = {}) {
  const errors = [];
  const required = [
    'index.html', 'styles.css', 'missions.css', 'app.js', 'game-model.js', 'sw.js',
    'manifest.webmanifest', 'offline-pack.json', 'art/playground-stage.webp',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
  ];
  for (const relative of required) {
    if (!await exists(path.join(appRoot, relative))) errors.push(`Missing ${relative}`);
  }

  const html = await readFile(path.join(appRoot, 'index.html'), 'utf8');
  const appSource = await readFile(path.join(appRoot, 'app.js'), 'utf8');
  const modelSource = await readFile(path.join(appRoot, 'game-model.js'), 'utf8');
  const styles = await readFile(path.join(appRoot, 'styles.css'), 'utf8');
  const activityStyles = await readFile(path.join(appRoot, 'missions.css'), 'utf8');
  const worker = await readFile(path.join(appRoot, 'sw.js'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(appRoot, 'manifest.webmanifest'), 'utf8'));
  const offlinePack = JSON.parse(await readFile(path.join(appRoot, 'offline-pack.json'), 'utf8'));
  const runtime = html + appSource + modelSource + styles + activityStyles;

  if (/https?:\/\//i.test(runtime)) errors.push('Runtime source contains a remote URL');
  if (/speechSynthesis|SpeechSynthesisUtterance/.test(appSource)) errors.push('Runtime browser TTS is forbidden; only bundled narration may be used');
  if (/\.m4a/.test(appSource)) errors.push('Runtime references superseded M4A narration');
  if (manifest.display !== 'standalone') errors.push('Manifest must use standalone display mode');
  if (manifest.orientation !== 'portrait-primary') errors.push('Manifest must prefer portrait orientation');
  if (!html.includes('viewport-fit=cover')) errors.push('Missing iPhone safe-area viewport support');
  if (!(styles + activityStyles).includes('safe-area-inset-bottom')) errors.push('Missing safe-area CSS');
  if (!html.includes('Adventure') || !html.includes('Bump Together') || !html.includes('Share the Toys')) errors.push('Home must expose all three child modes');
  if (!html.includes('parentHoldButton') || !appSource.includes('}, 3000)')) errors.push('Parent settings must use a three-second hold guard');
  if (/drag(start|over)|drop|pointermove/i.test(appSource)) errors.push('Core learning loops must be tap-only');
  if (!appSource.includes("state.phase = 'evaluating'") || !appSource.includes("state.phase = 'resolving'")) errors.push('Answers must synchronously lock into explicit phases');
  if (!appSource.includes('sendNextToy') || !appSource.includes('returnOneToy') || !appSource.includes('undoToyMove')) errors.push('Sharing must support one-at-a-time send, return, and undo');
  if (!modelSource.includes('toyStateIsValid') || !modelSource.includes('validateShare') || !modelSource.includes('commitResolution')) errors.push('Missing sharing invariants or idempotent resolution');
  if (!modelSource.includes('slice(-8)') || !modelSource.includes('needsReducedDemand')) errors.push('Missing rolling evidence and demand reduction');
  if (!activityStyles.includes('grid-template-columns: repeat(2') || !activityStyles.includes('.answer-card')) errors.push('Answer cards must use a stable two-by-two grid');
  if (!runtime.includes('prefers-reduced-motion') || !appSource.includes('useReducedMotion')) errors.push('Reduced motion must preserve the experience');
  if (!styles.includes('min-height: 64px') && !activityStyles.includes('min-height: 64px')) errors.push('Primary controls need 64px minimum hit areas');
  if (!worker.includes('cache.addAll')) errors.push('Service worker must atomically cache the app pack');
  if (!worker.includes("mode === 'navigate'")) errors.push('Service worker needs an offline navigation fallback');
  if (worker.includes('clients.claim()')) errors.push('Service worker must not take over a page midway through loading');
  if (!worker.includes('cache.match(event.request')) errors.push('Service worker must read only from its active version cache');
  if (!Array.isArray(offlinePack.assets)) errors.push('Offline pack assets must be an array');

  if (strictAudio) {
    const v1Filenames = [...new Set(NUMBER_MAGIC_V1_AUDIO_ENTRIES.map(entry => entry.filename))];
    for (const filename of v1Filenames) {
      const audioPath = path.join(appRoot, 'audio', filename);
      if (!await exists(audioPath)) errors.push(`Missing narration: audio/${filename}`);
      else if ((await stat(audioPath)).size < 1000) errors.push(`Narration is too small: audio/${filename}`);
    }
    const oldAudio = (await readdir(path.join(appRoot, 'audio'))).filter(name => name.endsWith('.m4a'));
    if (oldAudio.length) errors.push(`Found ${oldAudio.length} superseded system-voice M4A files`);

    const v1ManifestPath = path.join(appRoot, 'audio', 'v1-manifest.json');
    if (!await exists(v1ManifestPath)) errors.push('Missing curated v1 ElevenLabs audio manifest');
    else {
      const v1Manifest = JSON.parse(await readFile(v1ManifestPath, 'utf8'));
      const records = new Map((v1Manifest.assets || []).map(asset => [asset.filename, asset]));
      if (v1Manifest.provider !== 'elevenlabs' || !v1Manifest.model) errors.push('V1 audio manifest must identify its ElevenLabs model');
      for (const entry of NUMBER_MAGIC_V1_AUDIO_ENTRIES) {
        const record = records.get(entry.filename);
        if (!record || record.locale !== entry.locale || record.text !== entry.text || !record.contentHash || !Array.isArray(record.cues)) errors.push(`Incomplete v1 audio record: ${entry.filename}`);
      }
    }
  }

  if (errors.length) throw new Error(`Number Magic validation failed:\n- ${errors.join('\n- ')}`);
  return { audioCount: new Set(NUMBER_MAGIC_V1_AUDIO_ENTRIES.map(entry => entry.filename)).size, offlineAssetCount: offlinePack.assetCount || 0 };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = await validateNumberMagic({ strictAudio: process.argv.includes('--strict-audio') });
  console.log(`Number Magic validated: ${result.audioCount} narration clips, ${result.offlineAssetCount} offline assets.`);
}
