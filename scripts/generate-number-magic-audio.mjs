import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NUMBER_MAGIC_AUDIO_ENTRIES, NUMBER_MAGIC_MISSION_AUDIO_ENTRIES } from './number-magic-audio-catalog.mjs';

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'public', 'numberblocks', 'audio');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'number-magic-audio-'));
const voice = process.env.NUMBER_MAGIC_VOICE || 'Samantha';
const selectedEntries = process.argv.includes('--play-prompts-only')
  ? NUMBER_MAGIC_AUDIO_ENTRIES.filter(entry => entry.filename.startsWith('play-'))
  : process.argv.includes('--mission-only')
    ? NUMBER_MAGIC_MISSION_AUDIO_ENTRIES
    : NUMBER_MAGIC_AUDIO_ENTRIES;

await mkdir(outputRoot, { recursive: true });
try {
  for (let index = 0; index < selectedEntries.length; index += 1) {
    const entry = selectedEntries[index];
    const aiffPath = path.join(temporaryRoot, `${String(index).padStart(3, '0')}.aiff`);
    const outputPath = path.join(outputRoot, entry.filename);
    await execFileAsync('/usr/bin/say', ['-v', voice, '-r', '177', '-o', aiffPath, entry.text]);
    await execFileAsync('/usr/local/bin/ffmpeg', [
      '-loglevel', 'error', '-y', '-i', aiffPath,
      '-af', 'highpass=f=120,lowpass=f=9000,loudnorm=I=-18:LRA=7:TP=-2',
      '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', '44100', '-ac', '1', outputPath
    ]);
    if ((index + 1) % 25 === 0 || index + 1 === selectedEntries.length) {
      console.log(`Generated ${index + 1}/${selectedEntries.length} temporary narration clips.`);
    }
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
