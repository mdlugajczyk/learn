import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { SPOKEN } from '../public/mimi/audio-catalog.js';

if (!process.argv.includes('--generate')) throw new Error('Use --generate to authorize synthesis of the Mimi audio pack.');
const keyFile = process.env.ELEVENLABS_API_KEY_FILE;
const key = process.env.ELEVENLABS_API_KEY || (keyFile && (await readFile(keyFile, 'utf8')).trim());
if (!key) throw new Error('Set ELEVENLABS_API_KEY_FILE. Keys are never written to assets.');
const root = path.resolve('public/mimi/audio');
await mkdir(root, { recursive: true });
const voice = process.env.ELEVENLABS_VOICE_ID || 'Xb7hH8MSUJpSbSDYk0k2';
const settings = { stability: .65, similarity_boost: .84, style: 0, use_speaker_boost: true, speed: .9 };
const manifestPath = path.join(root, 'manifest.json');
let previous;
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { previous = { entries: [] }; }
const records = new Map(previous.entries.map(e => [e.id, e]));
const selected = Object.entries(SPOKEN).filter(([id]) => !process.env.MIMI_AUDIO_IDS || process.env.MIMI_AUDIO_IDS.split(',').includes(id));
console.log(`Mimi: ${selected.length} Polish clips, ${selected.reduce((n, [,text]) => n + text.length, 0)} source characters.`);
for (const [id, text] of selected) {
  const hash = createHash('sha256').update(JSON.stringify({ text, voice, settings })).digest('hex');
  if (records.get(id)?.source === 'human') continue;
  if (records.get(id)?.contentHash === hash) { try { await access(path.join(root, `${id}.mp3`)); continue; } catch {} }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', language_code: 'pl', voice_settings: settings, seed: 1705 })
  });
  if (!response.ok) throw new Error(`${id}: ElevenLabs ${response.status} ${(await response.text()).slice(0, 250)}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error(`Empty clip: ${id}`);
  await writeFile(path.join(root, `${id}.mp3`), bytes);
  records.set(id, { id, text, filename: `${id}.mp3`, source: 'ai', provider: 'elevenlabs', model: 'eleven_multilingual_v2', voiceId: voice, voice: 'Alice', language: 'pl', contentHash: hash, sha256: createHash('sha256').update(bytes).digest('hex'), generatedAt: new Date().toISOString(), qaStatus: 'pending-listening-review' });
  await writeFile(manifestPath, JSON.stringify({ version: 1, entries: [...records.values()] }, null, 2) + '\n');
  console.log(`Generated ${id}`);
}
