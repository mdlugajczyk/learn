import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { NUMBER_MAGIC_AUDIO_ENTRIES } from './number-magic-audio-catalog.mjs';

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
    'index.html', 'styles.css', 'missions.css', 'app.js', 'engine.js', 'missions.js', 'sw.js',
    'manifest.webmanifest', 'offline-pack.json', 'icons/icon-192.png',
    'icons/icon-512.png', 'icons/icon-maskable-512.png'
  ];
  for (const relative of required) {
    if (!await exists(path.join(appRoot, relative))) errors.push(`Missing ${relative}`);
  }

  const html = await readFile(path.join(appRoot, 'index.html'), 'utf8');
  const appSource = await readFile(path.join(appRoot, 'app.js'), 'utf8');
  const styles = await readFile(path.join(appRoot, 'styles.css'), 'utf8');
  const missionStyles = await readFile(path.join(appRoot, 'missions.css'), 'utf8');
  const worker = await readFile(path.join(appRoot, 'sw.js'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(appRoot, 'manifest.webmanifest'), 'utf8'));
  const offlinePack = JSON.parse(await readFile(path.join(appRoot, 'offline-pack.json'), 'utf8'));

  if (/https?:\/\//i.test(html + appSource + styles + missionStyles)) errors.push('Runtime source contains a remote URL');
  if (appSource.includes('speechSynthesis') || appSource.includes('SpeechSynthesisUtterance')) errors.push('Runtime browser TTS fallback is forbidden; bundled ElevenLabs audio is required');
  if (appSource.includes('.m4a')) errors.push('Runtime still references superseded M4A narration');
  if (manifest.display !== 'standalone') errors.push('Manifest must use standalone display mode');
  if (manifest.orientation !== 'portrait-primary') errors.push('Manifest must prefer portrait orientation');
  if (!html.includes('viewport-fit=cover')) errors.push('Missing iPhone safe-area viewport support');
  if (!(styles + missionStyles).includes('safe-area-inset-bottom')) errors.push('Missing safe-area CSS');
  if (html.includes('splitButton') || html.includes('Split it!')) errors.push('The playground must not use a split button');
  if (!appSource.includes("addEventListener('pointerdown'") || !appSource.includes('attachSplitGesture')) {
    errors.push('Reverse missions must split through direct pointer gestures');
  }
  if (!appSource.includes('nextSplitStep(fact, state.splitCount)') || !appSource.includes("state.phase = 'split-reveal'")) {
    errors.push('Reverse missions must pull one block per step and pause for a split reveal');
  }
  if (!appSource.includes('attachLooseBlockGesture') || !appSource.includes('attachCombineGesture')) {
    errors.push('Forward missions must build and combine through direct gestures');
  }
  if (!html.includes('setupRangeChoices') || !html.includes('settingsRangeChoices')) {
    errors.push('Parent setup and settings must expose learning range controls');
  }
  if (!appSource.includes('recordFactResult') || !appSource.includes('advanceLearning')) {
    errors.push('Mission results must drive adaptive learning progression');
  }
  if (!missionStyles.includes('.drag-coach') || !missionStyles.includes('.reverse-coach')) {
    errors.push('The playground needs animated, visual gesture coaching');
  }
  if (!missionStyles.includes('--loose-unit: clamp(56px') || !missionStyles.includes('@media (min-width: 700px)')) {
    errors.push('Mission blocks must have large phone and iPad sizing rules');
  }
  if (!worker.includes("cache.addAll")) errors.push('Service worker must atomically cache the app pack');
  if (!worker.includes("mode === 'navigate'")) errors.push('Service worker needs an offline navigation fallback');
  if (worker.includes('clients.claim()')) errors.push('Service worker must not take over a page midway through loading');
  if (!worker.includes('cache.match(event.request')) errors.push('Service worker must read only from its active version cache');
  if (!Array.isArray(offlinePack.assets)) errors.push('Offline pack assets must be an array');

  const expectedAudio = NUMBER_MAGIC_AUDIO_ENTRIES.map(entry => entry.filename);
  if (strictAudio) {
    for (const filename of expectedAudio) {
      const audioPath = path.join(appRoot, 'audio', filename);
      if (!await exists(audioPath)) {
        errors.push(`Missing narration: audio/${filename}`);
        continue;
      }
      if ((await stat(audioPath)).size < 1000) errors.push(`Narration is too small: audio/${filename}`);
    }
    const actualAudio = (await readdir(path.join(appRoot, 'audio'))).filter(name => name.endsWith('.mp3'));
    if (actualAudio.length !== expectedAudio.length) {
      errors.push(`Expected ${expectedAudio.length} narration files, found ${actualAudio.length}`);
    }
    const oldAudio = (await readdir(path.join(appRoot, 'audio'))).filter(name => name.endsWith('.m4a'));
    if (oldAudio.length) errors.push(`Found ${oldAudio.length} superseded system-voice M4A files`);
    const audioManifestPath = path.join(appRoot, 'audio', 'manifest.json');
    if (!await exists(audioManifestPath)) errors.push('Missing ElevenLabs audio manifest');
    else {
      const audioManifest = JSON.parse(await readFile(audioManifestPath, 'utf8'));
      if (audioManifest.provider !== 'elevenlabs' || audioManifest.language !== 'en') errors.push('Number Magic audio manifest must identify English ElevenLabs narration');
      if (audioManifest.entries?.length !== expectedAudio.length) errors.push(`ElevenLabs manifest has ${audioManifest.entries?.length ?? 0}/${expectedAudio.length} entries`);
      if (!audioManifest.entries?.every(entry => expectedAudio.includes(entry.filename) && entry.provider === 'elevenlabs' && entry.model && entry.voiceId && entry.contentHash)) {
        errors.push('ElevenLabs manifest contains incomplete or unexpected records');
      }
    }
  }

  if (errors.length) throw new Error(`Number Magic validation failed:\n- ${errors.join('\n- ')}`);
  return { audioCount: expectedAudio.length, offlineAssetCount: offlinePack.assetCount || 0 };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = await validateNumberMagic({ strictAudio: process.argv.includes('--strict-audio') });
  console.log(`Number Magic validated: ${result.audioCount} narration clips, ${result.offlineAssetCount} offline assets.`);
}
