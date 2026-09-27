import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { SPOKEN } from '../public/mimi/audio-catalog.js';

const run = promisify(execFile);
const root = path.resolve('public/mimi/audio');
const dropFolder = path.resolve(process.env.MIMI_RECORDINGS_DIR || 'recordings/mimi');
const requested = process.argv.slice(2).filter(value => !value.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
const ids = requested.length ? requested : Object.keys(SPOKEN);
const unknown = ids.filter(id => !SPOKEN[id]);
if (unknown.length) throw new Error(`Unknown recording id: ${unknown.join(', ')}`);

let files = [];
try { files = await readdir(dropFolder); } catch { throw new Error(`Create or open ${dropFolder} and add recordings named like ma.m4a.`); }
const fileByLowercaseName = new Map(files.map(file => [file.toLowerCase(), file]));
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const records = new Map(manifest.entries.map(entry => [entry.id, entry]));
const extensions = ['.m4a', '.wav', '.mp3', '.aac'];
// Friendly names are intentionally short for Voice Memos. The technical names
// remain accepted too, so existing recordings never need to be renamed.
const friendlyNames = {
  'sound-a': 'a', 'sound-i': 'i', 'sound-m': 'm', 'sound-l': 'l', 'sound-o': 'o', 'sound-n': 'n', 'sound-s': 's',
  'blend-ma': 'ma-blend', 'blend-mi': 'mi-blend', 'blend-la': 'la-blend', 'blend-li': 'li-blend',
  'blend-ta': 'ta-blend', 'blend-to': 'to-blend', 'blend-ko': 'ko-blend', 'blend-no': 'no-blend', 'blend-ga': 'ga-blend',
  'word-ma': 'ma', 'word-mi': 'mi', 'word-la': 'la', 'word-li': 'li', 'word-ta': 'ta', 'word-to': 'to', 'word-ko': 'ko', 'word-no': 'no', 'word-ga': 'ga',
  'word-mama': 'mama', 'word-mimi': 'mimi', 'word-lala': 'lala', 'word-tata': 'tata', 'word-oko': 'oko', 'word-nos': 'nos', 'word-noga': 'noga'
};
const imports = [];
for (const id of ids) {
  const candidates = [friendlyNames[id], id].filter(Boolean);
  const sourceName = candidates
    .flatMap(name => extensions.map(extension => `${name}${extension}`))
    .map(name => fileByLowercaseName.get(name.toLowerCase()))
    .find(Boolean);
  if (!sourceName) continue;
  imports.push({ id, source: path.join(dropFolder, sourceName), output: path.join(root, `${id}.mp3`) });
}
if (!imports.length) {
  console.log('No matching recordings found. See recordings/mimi/README.md for the exact names.');
  process.exit(0);
}
for (const recording of imports) {
  console.log(`${dryRun ? 'Would import' : 'Importing'} ${path.basename(recording.source)} → audio/${recording.id}.mp3`);
  if (dryRun) continue;
  await mkdir(root, { recursive: true });
  const temporary = `${recording.output}.new.mp3`;
  // Strip only clearly empty edges, then restore a tiny natural margin so
  // consonants do not feel clipped when a letter or syllable lights up.
  const filter = 'silenceremove=start_periods=1:start_duration=0.04:start_threshold=-50dB:stop_periods=1:stop_duration=0.12:stop_threshold=-50dB,adelay=50,apad=pad_dur=0.15,loudnorm=I=-16:TP=-1.5:LRA=11';
  await run('ffmpeg', ['-y', '-i', recording.source, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', '-af', filter, temporary], { stdio: 'ignore' });
  await rename(temporary, recording.output);
  const bytes = await readFile(recording.output);
  records.set(recording.id, {
    ...records.get(recording.id), id: recording.id, text: SPOKEN[recording.id], filename: `${recording.id}.mp3`,
    source: 'human', provider: 'local-recording', originalFilename: path.basename(recording.source), trim: { leadingMs: 50, trailingMs: 150, silenceThresholdDb: -50 },
    sha256: createHash('sha256').update(bytes).digest('hex'), importedAt: new Date().toISOString(), qaStatus: 'needs-listening-review'
  });
  await writeFile(manifestPath, JSON.stringify({ version: 1, entries: Object.keys(SPOKEN).map(id => records.get(id)) }, null, 2) + '\n');
}
// When there is no separately recorded blend, derive a gentle “sound →
// syllable” demonstration from the parent's own clips. A later *-blend file
// always wins, because it imports directly as a human recording.
const blendRecipes = [
  ['blend-ma', 'sound-m', 'word-ma'], ['blend-mi', 'sound-m', 'word-mi'],
  ['blend-la', 'sound-l', 'word-la'], ['blend-li', 'sound-l', 'word-li'],
  ['blend-no', 'sound-n', 'word-no'],
  ['blend-ta', null, 'word-ta'], ['blend-to', null, 'word-to'], ['blend-ko', null, 'word-ko'], ['blend-ga', null, 'word-ga']
];
const isHuman = id => records.get(id)?.source === 'human';
const isExplicitRecording = id => records.get(id)?.provider === 'local-recording';
for (const [blendId, soundId, wordId] of blendRecipes) {
  if (isExplicitRecording(blendId) || !isHuman(wordId)) continue;
  const output = path.join(root, `${blendId}.mp3`);
  const temporary = `${output}.derived.mp3`;
  const args = soundId && isHuman(soundId)
    ? ['-y', '-i', path.join(root, `${soundId}.mp3`), '-i', path.join(root, `${wordId}.mp3`), '-filter_complex', '[0:a]atrim=start=0:end=0.45,asetpts=PTS-STARTPTS[a];[1:a]asetpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=0:a=1,apad=pad_dur=0.15,loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '44100', '-b:a', '128k', temporary]
    : ['-y', '-i', path.join(root, `${wordId}.mp3`), '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', '-af', 'apad=pad_dur=0.15,loudnorm=I=-16:TP=-1.5:LRA=11', temporary];
  if (!dryRun) {
    await run('ffmpeg', args, { stdio: 'ignore' });
    await rename(temporary, output);
    const bytes = await readFile(output);
    records.set(blendId, {
      ...records.get(blendId), id: blendId, text: SPOKEN[blendId], filename: `${blendId}.mp3`, source: 'human', provider: 'derived-local-recording',
      derivedFrom: soundId ? [soundId, wordId] : [wordId], sha256: createHash('sha256').update(bytes).digest('hex'), importedAt: new Date().toISOString(), qaStatus: 'needs-listening-review'
    });
  }
  console.log(`${dryRun ? 'Would build' : 'Built'} ${blendId}.mp3 from ${soundId ? `${soundId} + ` : ''}${wordId}`);
}
if (!dryRun) await writeFile(manifestPath, JSON.stringify({ version: 1, entries: Object.keys(SPOKEN).map(id => records.get(id)) }, null, 2) + '\n');
console.log(`${imports.length} recording${imports.length === 1 ? '' : 's'} ready. Run npm run build before publishing.`);
