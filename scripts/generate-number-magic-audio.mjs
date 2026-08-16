import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { enumeratePartitions } from '../public/numberblocks/engine.js';

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'public', 'numberblocks', 'audio');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'number-magic-audio-'));
const numberNames = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const voice = process.env.NUMBER_MAGIC_VOICE || 'Samantha';

function sentenceName(number) {
  const name = numberNames[number] || String(number);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function listWords(parts) {
  const words = parts.map(number => numberNames[number]);
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`;
}

const entries = [
  {
    filename: 'welcome.m4a',
    text: "Hello, number maker! I'm Ten. Ready for some number magic?"
  }
];

for (let target = 2; target <= 10; target += 1) {
  entries.push(
    {
      filename: `play-${target}.m4a`,
      text: `Pull some of ${numberNames[target]}'s blocks away. Bump the number friends together, or flick them up!`
    },
    {
      filename: `together-${target}.m4a`,
      text: `All together again. ${sentenceName(target)} is still ${numberNames[target]}!`
    },
    {
      filename: `new-way-${target}.m4a`,
      text: `Can you make ${numberNames[target]} a different way?`
    }
  );

  for (const parts of enumeratePartitions(target, { includeWhole: false })) {
    entries.push({
      filename: `composition-${target}-${parts.join('-')}.m4a`,
      text: `${sentenceName(target)} is made of ${listWords(parts)}!`
    });
  }
}

await mkdir(outputRoot, { recursive: true });
const selectedEntries = process.argv.includes('--play-prompts-only')
  ? entries.filter(entry => entry.filename.startsWith('play-'))
  : entries;
try {
  for (let index = 0; index < selectedEntries.length; index += 1) {
    const entry = selectedEntries[index];
    const aiffPath = path.join(temporaryRoot, `${String(index).padStart(3, '0')}.aiff`);
    const outputPath = path.join(outputRoot, entry.filename);
    await execFileAsync('/usr/bin/say', ['-v', voice, '-r', '177', '-o', aiffPath, entry.text]);
    await execFileAsync('/usr/local/bin/ffmpeg', [
      '-loglevel', 'error', '-y', '-i', aiffPath,
      '-af', 'highpass=f=120,lowpass=f=9000,loudnorm=I=-18:LRA=7:TP=-2',
      '-c:a', 'aac', '-b:a', '56k', '-ar', '44100', '-ac', '1', outputPath
    ]);
    if ((index + 1) % 25 === 0 || index + 1 === selectedEntries.length) {
      console.log(`Generated ${index + 1}/${selectedEntries.length} narration clips.`);
    }
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
