import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AUDIO_ENTRIES, AUDIO_PACK_VERSION } from '../public/czytaj/data/audio-manifest.js';

const root = process.cwd();
const audioRoot = path.join(root, 'public', 'czytaj', 'audio');
const outputManifest = path.join(audioRoot, 'manifest.json');
const args = process.argv.slice(2);
const force = args.includes('--force');
const firstLesson = args.includes('--first-lesson');
// Alice jest głosem premade dostępnym przez API również na planie Free.
// Po aktualizacji planu można wskazać natywną Asię przez ELEVENLABS_VOICE_ID=Bz1e1clEKwgN71Vx7cxj.
const voiceId = process.env.ELEVENLABS_VOICE_ID || 'Xb7hH8MSUJpSbSDYk0k2';
const voiceName = process.env.ELEVENLABS_VOICE_NAME || 'Alice - Clear, Engaging Educator';
const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const keyFile = process.env.ELEVENLABS_API_KEY_FILE;
const apiKey = process.env.ELEVENLABS_API_KEY || (keyFile ? (await readFile(keyFile, 'utf8')).trim() : '');
const outputFormat = 'mp3_44100_128';
const voiceSettings = { stability: 0.62, similarity_boost: 0.84, style: 0, use_speaker_boost: true, speed: 0.92 };

// Pierwsza testowa sekwencja obejmuje krótką misję „a” oraz następną misję,
// w której poznane m + a staje się ma, a potem ma + ma staje się mama.
const FIRST_LESSON_IDS = new Set([
  'welcome-home',
  'controls-speaker', 'controls-retry', 'controls-go',
  'mapping-new', 'review-choose', 'blend-swipe', 'build-word', 'read-first', 'choose-meaning',
  'correct-short', 'correct-choice', 'retry-gentle', 'mission-complete',
  'sound-a', 'sound-m', 'word-ma', 'word-mama'
]);

const explicitIds = new Set(args.filter((arg) => !arg.startsWith('--')));
const selectedIds = firstLesson ? FIRST_LESSON_IDS : explicitIds;

if (!apiKey) {
  console.error('Set ELEVENLABS_API_KEY or ELEVENLABS_API_KEY_FILE. The key is used only during generation and is never written to browser assets.');
  process.exit(1);
}
if (!selectedIds.size) {
  console.error('Pass --first-lesson or one or more audio IDs. Refusing to regenerate the entire course accidentally.');
  process.exit(1);
}

const byId = new Map(AUDIO_ENTRIES.map((entry) => [entry.id, entry]));
for (const id of selectedIds) if (!byId.has(id)) throw new Error(`Unknown audio ID: ${id}`);

await mkdir(audioRoot, { recursive: true });
const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'czytaj-elevenlabs-'));
let previous = { entries: [] };
try { previous = JSON.parse(await readFile(outputManifest, 'utf8')); } catch {}
const previousById = new Map(previous.entries.map((entry) => [entry.id, entry]));
const replacements = new Map();

function synthesisText(source) {
  // Pojedyncze „m” bywa czytane przez TTS jako nazwa litery „em”. Wydłużony
  // zapis wymusza czysty dźwięk, którego dziecko potrzebuje do łączenia.
  if (source.id === 'sound-m') return 'mmm';
  return source.text;
}

try {
  for (const id of selectedIds) {
    const source = byId.get(id);
    const existing = previousById.get(id);
    if (existing?.source === 'human') {
      console.log(`Preserved human clip ${id}`);
      continue;
    }
    const input = synthesisText(source);
    const contentHash = createHash('sha256').update(JSON.stringify({ text: source.text, input, modelId, voiceId, outputFormat, voiceSettings })).digest('hex');
    const target = path.join(root, 'public', 'czytaj', source.filename);
    if (!force && existing?.provider === 'elevenlabs' && existing.contentHash === contentHash) {
      try { await readFile(target); console.log(`Up to date ${id}`); continue; } catch {}
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${outputFormat}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: input, model_id: modelId, voice_settings: voiceSettings, seed: 1705 })
    });
    if (!response.ok) throw new Error(`${id}: ElevenLabs returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < 1000) throw new Error(`${id}: ElevenLabs returned an unexpectedly small audio file (${bytes.byteLength} bytes)`);
    const staged = path.join(stagingRoot, `${id}.mp3`);
    await writeFile(staged, bytes);
    replacements.set(id, {
      ...source,
      source: 'ai',
      provider: 'elevenlabs',
      model: modelId,
      voice: voiceName,
      voiceId,
      synthesisText: input === source.text ? undefined : input,
      outputFormat,
      voiceSettings,
      contentHash,
      generatedAt: new Date().toISOString(),
      qaStatus: 'pending-native-review'
    });
    console.log(`Generated ${id} (${bytes.byteLength} bytes)`);
  }

  for (const [id, record] of replacements) {
    const target = path.join(root, 'public', 'czytaj', byId.get(id).filename);
    await rename(path.join(stagingRoot, `${id}.mp3`), target);
    previousById.set(id, record);
  }
  const entries = AUDIO_ENTRIES.map((source) => previousById.get(source.id) ?? source).sort((a, b) => a.id.localeCompare(b.id, 'pl'));
  await writeFile(outputManifest, `${JSON.stringify({
    version: AUDIO_PACK_VERSION,
    releaseStatus: 'mixed-providers-pending-native-review',
    disclosure: 'Głos narratora został wygenerowany przez sztuczną inteligencję.',
    entries
  }, null, 2)}\n`);
  console.log(`ElevenLabs pack updated: ${replacements.size} generated, ${entries.length} manifest entries.`);
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
