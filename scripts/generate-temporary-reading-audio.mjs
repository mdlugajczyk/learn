import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { AUDIO_ENTRIES, AUDIO_PACK_VERSION } from '../public/czytaj/data/audio-manifest.js';

const run = promisify(execFile);
const root = process.cwd();
const audioRoot = path.join(root, 'public', 'czytaj', 'audio');
const outputManifest = path.join(audioRoot, 'manifest.json');
const voice = process.env.CZYTAJ_TEST_VOICE || 'Zosia';
const concurrency = Math.max(1, Math.min(8, Number(process.env.CZYTAJ_AUDIO_JOBS) || 4));
const force = process.argv.includes('--force');
const temporarySource = 'temporary-system';

if (process.platform !== 'darwin') {
  console.error('Temporary audio generation currently requires macOS `say`. Use ElevenLabs for the production pack.');
  process.exit(1);
}

await Promise.all([
  run('/usr/bin/say', ['-v', '?']),
  run('/usr/local/bin/ffmpeg', ['-version'])
]);

await mkdir(audioRoot, { recursive: true });
let previous = { entries: [] };
try { previous = JSON.parse(await readFile(outputManifest, 'utf8')); } catch {}
const previousById = new Map(previous.entries.map((value) => [value.id, value]));
const records = new Array(AUDIO_ENTRIES.length);
const queue = AUDIO_ENTRIES.map((source, index) => ({ source, index }));
let completed = 0;

async function generate({ source, index }) {
  const target = path.join(root, 'public', 'czytaj', source.filename);
  const rate = source.category === 'phoneme' ? 165 : source.category === 'story' || source.category === 'listening' ? 142 : 150;
  const contentHash = createHash('sha256').update(`${source.text}\nmacos-say\n${voice}\n${rate}`).digest('hex');
  const existing = previousById.get(source.id);

  if (existing && existing.source !== temporarySource) {
    try { await readFile(target); records[index] = existing; return; } catch {}
  }
  if (!force && existing?.source === temporarySource && existing.contentHash === contentHash) {
    try { await readFile(target); records[index] = existing; return; } catch {}
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'czytaj-audio-'));
  const aiff = path.join(temporaryDirectory, 'voice.aiff');
  try {
    await run('/usr/bin/say', ['-v', voice, '-r', String(rate), '-o', aiff, '--', source.text]);
    await run('/usr/local/bin/ffmpeg', [
      '-y', '-loglevel', 'error', '-i', aiff, '-codec:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', target
    ]);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  records[index] = {
    ...source,
    source: temporarySource,
    model: 'macos-say',
    voice,
    contentHash,
    generatedAt: new Date().toISOString(),
    qaStatus: 'temporary-not-approved-for-learning'
  };
  completed += 1;
  if (completed % 25 === 0 || completed === AUDIO_ENTRIES.length) {
    console.log(`Generated ${completed}/${AUDIO_ENTRIES.length} temporary clips`);
  }
}

async function worker() {
  while (queue.length) await generate(queue.shift());
}

await Promise.all(Array.from({ length: concurrency }, worker));
const entries = records.filter(Boolean).sort((a, b) => a.id.localeCompare(b.id, 'pl'));
await writeFile(outputManifest, `${JSON.stringify({
  version: AUDIO_PACK_VERSION,
  releaseStatus: 'temporary-testing-only',
  model: 'macos-say',
  voice,
  disclosure: 'Tymczasowy głos systemowy Zosia służy wyłącznie do testowania aplikacji. Izolowane dźwięki liter nie są zatwierdzone do nauki.',
  entries
}, null, 2)}\n`);
console.log(`Temporary test pack ready: ${entries.length} entries using ${voice}.`);
