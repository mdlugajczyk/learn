import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NUMBER_MAGIC_V1_AUDIO_ENTRIES } from './number-magic-v1-audio-catalog.mjs';

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'public', 'numberblocks', 'audio');
const args = process.argv.slice(2);
const requestedLocale = args.includes('--all') ? 'all' : args.includes('--locale') ? args[args.indexOf('--locale') + 1] : null;
const force = args.includes('--force');
const keyFile = process.env.ELEVENLABS_API_KEY_FILE;
const apiKey = process.env.ELEVENLABS_API_KEY || (keyFile ? (await readFile(keyFile, 'utf8')).trim() : '');
const voiceId = process.env.NUMBER_MAGIC_ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';
const voiceName = process.env.NUMBER_MAGIC_ELEVENLABS_VOICE_NAME || 'Jessica - Playful, Bright, Warm';
const modelId = process.env.NUMBER_MAGIC_ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const outputFormat = 'mp3_44100_128';
const voiceSettings = { stability: 0.58, similarity_boost: 0.82, style: 0.08, use_speaker_boost: true, speed: 0.96 };

if (!apiKey) throw new Error('Set ELEVENLABS_API_KEY or ELEVENLABS_API_KEY_FILE. The key is never written to browser assets.');
if (!['all', 'en', 'pl'].includes(requestedLocale)) throw new Error('Pass --all or --locale en|pl.');

const selected = requestedLocale === 'all'
  ? NUMBER_MAGIC_V1_AUDIO_ENTRIES
  : NUMBER_MAGIC_V1_AUDIO_ENTRIES.filter(entry => entry.locale === requestedLocale);
const existingManifestPath = path.join(outputRoot, 'v1-manifest.json');
let existingRecords = [];
try { existingRecords = JSON.parse(await readFile(existingManifestPath, 'utf8')).assets || []; } catch {}
const records = new Map(existingRecords.map(record => [record.filename, record]));

function contentHash(entry) {
  return createHash('sha256').update(JSON.stringify({ text: entry.text, locale: entry.locale, voiceId, modelId, outputFormat, voiceSettings })).digest('hex');
}

async function generate(entry) {
  const hash = contentHash(entry);
  const existing = records.get(entry.filename);
  if (!force && existing?.contentHash === hash) return;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${outputFormat}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: entry.text,
      model_id: modelId,
      language_code: entry.locale,
      voice_settings: voiceSettings,
      seed: 1010
    })
  });
  if (!response.ok) throw new Error(`${entry.filename}: ElevenLabs returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const payload = await response.json();
  const bytes = Buffer.from(payload.audio_base64, 'base64');
  if (bytes.byteLength < 1000) throw new Error(`${entry.filename}: audio response is unexpectedly small`);
  await writeFile(path.join(outputRoot, entry.filename), bytes);
  const alignment = payload.alignment || payload.normalized_alignment || {};
  const ends = alignment.character_end_times_seconds || [];
  records.set(entry.filename, {
    id: entry.id,
    locale: entry.locale,
    text: entry.text,
    src: `audio/${entry.filename}`,
    filename: entry.filename,
    durationMs: Math.round((ends.at(-1) || 0) * 1000),
    cues: entry.cues,
    contentHash: hash,
    provider: 'elevenlabs',
    model: modelId,
    voice: voiceName,
    voiceId,
    outputFormat,
    voiceSettings,
    generatedAt: new Date().toISOString(),
    qaStatus: 'pending-listening-review'
  });
}

await mkdir(outputRoot, { recursive: true });
let completed = 0;
for (const entry of selected) {
  await generate(entry);
  completed += 1;
  if (completed % 10 === 0 || completed === selected.length) console.log(`Prepared ${completed}/${selected.length} clips`);
}

const assets = [...records.values()].sort((left, right) => left.filename.localeCompare(right.filename));
await writeFile(existingManifestPath, `${JSON.stringify({
  schemaVersion: 1,
  provider: 'elevenlabs',
  model: modelId,
  voice: voiceName,
  voiceId,
  outputFormat,
  generatedAt: new Date().toISOString(),
  assets
}, null, 2)}\n`);
console.log(`Wrote ${assets.length} curated Number Magic v1 audio records.`);
