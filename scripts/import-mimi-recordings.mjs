import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { SPOKEN } from '../public/mimi/audio-catalog.js';

const run = promisify(execFile);
const root = path.resolve('public/mimi/audio');
const dropFolder = path.resolve('recordings/mimi');
const requested = process.argv.slice(2).filter(value => !value.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
const ids = requested.length ? requested : Object.keys(SPOKEN);
const unknown = ids.filter(id => !SPOKEN[id]);
if (unknown.length) throw new Error(`Unknown recording id: ${unknown.join(', ')}`);

let files = [];
try { files = await readdir(dropFolder); } catch { throw new Error(`Create or open ${dropFolder} and add recordings named like word-ma.m4a.`); }
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const records = new Map(manifest.entries.map(entry => [entry.id, entry]));
const extensions = ['.m4a', '.wav', '.mp3', '.aac'];
const imports = [];
for (const id of ids) {
  const sourceName = extensions.map(extension => `${id}${extension}`).find(name => files.includes(name));
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
  await run('ffmpeg', ['-y', '-i', recording.source, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', temporary], { stdio: 'ignore' });
  await rename(temporary, recording.output);
  const bytes = await readFile(recording.output);
  records.set(recording.id, {
    ...records.get(recording.id), id: recording.id, text: SPOKEN[recording.id], filename: `${recording.id}.mp3`,
    source: 'human', provider: 'local-recording', originalFilename: path.basename(recording.source),
    sha256: createHash('sha256').update(bytes).digest('hex'), importedAt: new Date().toISOString(), qaStatus: 'needs-listening-review'
  });
  await writeFile(manifestPath, JSON.stringify({ version: 1, entries: Object.keys(SPOKEN).map(id => records.get(id)) }, null, 2) + '\n');
}
console.log(`${imports.length} recording${imports.length === 1 ? '' : 's'} ready. Run npm run build before publishing.`);
