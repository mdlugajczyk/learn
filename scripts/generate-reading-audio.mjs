import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AUDIO_ENTRIES, AUDIO_MODEL, AUDIO_PACK_VERSION, AUDIO_VOICE } from '../public/czytaj/data/audio-manifest.js';

const root = process.cwd();
const audioRoot = path.join(root, 'public', 'czytaj', 'audio');
const outputManifest = path.join(audioRoot, 'manifest.json');
const apiKey = process.env.OPENAI_API_KEY;
const onlyIds = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('--')));
const force = process.argv.includes('--force');

if (!apiKey) {
  console.error('OPENAI_API_KEY is required at build time. It is never written to browser assets.');
  process.exit(1);
}

await mkdir(audioRoot, { recursive: true });
let previous = { entries: [] };
try { previous = JSON.parse(await readFile(outputManifest, 'utf8')); } catch {}
const previousById = new Map(previous.entries.map((value) => [value.id, value]));
const generated = [];

for (const source of AUDIO_ENTRIES) {
  if (onlyIds.size && !onlyIds.has(source.id)) continue;
  const textHash = createHash('sha256').update(`${source.text}\n${source.direction}\n${AUDIO_MODEL}\n${AUDIO_VOICE}`).digest('hex');
  const existing = previousById.get(source.id);
  const target = path.join(root, 'public', 'czytaj', source.filename);
  if (!force && existing?.source === 'human') {
    generated.push(existing);
    continue;
  }
  if (!force && existing?.contentHash === textHash) {
    try { await readFile(target); generated.push(existing); continue; } catch {}
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: AUDIO_MODEL, voice: AUDIO_VOICE, input: source.text, response_format: 'mp3', instructions: source.direction })
  });
  if (!response.ok) throw new Error(`${source.id}: OpenAI TTS returned ${response.status} ${await response.text()}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  const record = { ...source, contentHash: textHash, generatedAt: new Date().toISOString() };
  generated.push(record);
  console.log(`Generated ${source.id}`);
}

for (const source of AUDIO_ENTRIES) {
  if (onlyIds.size && !onlyIds.has(source.id)) generated.push(previousById.get(source.id) ?? source);
}
generated.sort((a, b) => a.id.localeCompare(b.id, 'pl'));
await writeFile(outputManifest, `${JSON.stringify({ version: AUDIO_PACK_VERSION, model: AUDIO_MODEL, voice: AUDIO_VOICE, disclosure: 'Głos narratora został wygenerowany przez sztuczną inteligencję.', entries: generated }, null, 2)}\n`);
console.log(`Audio manifest: ${generated.length} entries.`);
