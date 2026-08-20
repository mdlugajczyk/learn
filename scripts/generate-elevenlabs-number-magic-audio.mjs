import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NUMBER_MAGIC_AUDIO_ENTRIES, NUMBER_MAGIC_MISSION_AUDIO_ENTRIES } from './number-magic-audio-catalog.mjs';

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'public', 'numberblocks', 'audio');
const args = process.argv.slice(2);
const all = args.includes('--all');
const missionOnly = args.includes('--mission-only');
const force = args.includes('--force');
const keyFile = process.env.ELEVENLABS_API_KEY_FILE;
const apiKey = process.env.ELEVENLABS_API_KEY || (keyFile ? (await readFile(keyFile, 'utf8')).trim() : '');
const voiceId = process.env.NUMBER_MAGIC_ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';
const voiceName = process.env.NUMBER_MAGIC_ELEVENLABS_VOICE_NAME || 'Jessica - Playful, Bright, Warm';
const modelId = process.env.NUMBER_MAGIC_ELEVENLABS_MODEL_ID || 'eleven_flash_v2';
const outputFormat = 'mp3_44100_128';
const concurrency = Math.max(1, Math.min(4, Number(process.env.NUMBER_MAGIC_AUDIO_JOBS) || 3));
const voiceSettings = { stability: 0.58, similarity_boost: 0.82, style: 0.08, use_speaker_boost: true, speed: 0.96 };

if (!apiKey) {
  console.error('Set ELEVENLABS_API_KEY or ELEVENLABS_API_KEY_FILE. The key is never written to browser assets.');
  process.exit(1);
}
if (!all && !missionOnly) {
  console.error('Pass --all or --mission-only. Refusing to spend ElevenLabs credits accidentally.');
  process.exit(1);
}

const selected = missionOnly ? NUMBER_MAGIC_MISSION_AUDIO_ENTRIES : NUMBER_MAGIC_AUDIO_ENTRIES;
const characterCount = selected.reduce((total, entry) => total + entry.text.length, 0);
const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'number-magic-elevenlabs-'));
const records = new Array(selected.length);
const queue = selected.map((entry, index) => ({ entry, index }));
let completed = 0;

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function requestSpeech(entry) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: entry.text,
        model_id: modelId,
        language_code: 'en',
        voice_settings: voiceSettings,
        seed: 1010
      })
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const message = (await response.text()).slice(0, 500);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 4) {
      throw new Error(`${entry.filename}: ElevenLabs returned ${response.status}: ${message}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    await pause(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * (2 ** attempt));
  }
  throw new Error(`${entry.filename}: ElevenLabs generation failed`);
}

async function generate({ entry, index }) {
  const target = path.join(outputRoot, entry.filename);
  const contentHash = createHash('sha256').update(JSON.stringify({ text: entry.text, modelId, voiceId, outputFormat, voiceSettings })).digest('hex');
  if (!force) {
    try {
      const existing = await readFile(target);
      if (existing.byteLength >= 1000) {
        records[index] = { ...entry, provider: 'elevenlabs', source: 'ai', model: modelId, voice: voiceName, voiceId, outputFormat, voiceSettings, contentHash, generatedAt: null, qaStatus: 'existing-unverified' };
        completed += 1;
        return;
      }
    } catch {}
  }
  const bytes = await requestSpeech(entry);
  if (bytes.byteLength < 1000) throw new Error(`${entry.filename}: unexpectedly small audio file (${bytes.byteLength} bytes)`);
  await writeFile(path.join(stagingRoot, entry.filename), bytes);
  records[index] = {
    ...entry,
    provider: 'elevenlabs', source: 'ai', model: modelId, voice: voiceName, voiceId,
    outputFormat, voiceSettings, contentHash, generatedAt: new Date().toISOString(), qaStatus: 'pending-listening-review'
  };
  completed += 1;
  if (completed % 20 === 0 || completed === selected.length) console.log(`Generated ${completed}/${selected.length} clips`);
}

async function worker() {
  while (queue.length) await generate(queue.shift());
}

console.log(`Generating ${selected.length} English clips (${characterCount} source characters) with ${voiceName} / ${modelId}.`);
await mkdir(outputRoot, { recursive: true });
try {
  await Promise.all(Array.from({ length: concurrency }, worker));
  for (const [index, entry] of selected.entries()) {
    const staged = path.join(stagingRoot, entry.filename);
    try { await rename(staged, path.join(outputRoot, entry.filename)); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!records[index].generatedAt) records[index].generatedAt = new Date().toISOString();
  }

  if (all) {
    await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify({
      version: 1,
      language: 'en',
      provider: 'elevenlabs',
      model: modelId,
      voice: voiceName,
      voiceId,
      releaseStatus: 'pending-listening-review',
      characterCount,
      entries: records
    }, null, 2)}\n`);

    // Only remove the superseded system-voice files after every ElevenLabs MP3
    // exists and the new manifest has been written successfully.
    for (const entry of NUMBER_MAGIC_AUDIO_ENTRIES) {
      const oldFile = path.join(outputRoot, entry.filename.replace(/\.mp3$/, '.m4a'));
      try { await unlink(oldFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  console.log(`Number Magic ElevenLabs pack ready: ${records.length} clips.`);
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
