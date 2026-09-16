import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LESSONS, makeLesson, promptFor, unitAudio, WORDS } from '../public/mimi/course.js';
import { SPOKEN, AUDIO_IDS } from '../public/mimi/audio-catalog.js';

export async function validateMimi() {
  const root = path.resolve('public/mimi');
  const known = new Set();
  for (const [index, lesson] of LESSONS.entries()) {
    lesson.letters.forEach(letter => known.add(letter));
    for (const step of makeLesson(index)) {
      if (step.target) for (const letter of step.target.replaceAll(' ', '')) if (!known.has(letter)) throw new Error(`Untaught ${letter} in lesson ${index}: ${step.target}`);
      if (!SPOKEN[promptFor(step)]) throw new Error(`Missing instruction ${promptFor(step)}`);
      const required = [];
      if (step.type === 'letter' || step.type === 'contrast') required.push(unitAudio(step.target));
      if (step.type === 'blend') required.push(`blend-${step.target.toLowerCase()}`, `word-${step.target.toLowerCase()}`);
      if (step.type === 'word') required.push(...step.units.map(unitAudio), `word-${step.target.toLowerCase()}`);
      if (step.type === 'read' || step.type === 'body-demo') for (const word of step.target.split(' ')) required.push(`word-${word.toLowerCase()}`, ...(WORDS[word] || []).map(unitAudio));
      for (const id of required) if (!SPOKEN[id]) throw new Error(`Missing clip ${id}`);
      for (const name of step.characters || []) {
        await stat(path.join(root, 'assets', `${name.toLowerCase()}.webp`));
        for (const part of step.parts || []) await stat(path.join(root, 'assets', `${name.toLowerCase()}-${part.toLowerCase()}.webp`));
      }
    }
  }
  const manifest = JSON.parse(await readFile(path.join(root, 'audio/manifest.json'), 'utf8'));
  if (manifest.entries.length !== AUDIO_IDS.length || new Set(manifest.entries.map(entry => entry.id)).size !== AUDIO_IDS.length) throw new Error('Audio catalog mismatch');
  for (const id of AUDIO_IDS) {
    const record = manifest.entries.find(e => e.id === id);
    if (record?.text !== SPOKEN[id]) throw new Error(`Outdated recording ${id}`);
    const bytes = await readFile(path.join(root, 'audio', `${id}.mp3`));
    if (bytes.length < 1000 || bytes.length > 2 * 1024 * 1024) throw new Error(`Invalid audio size ${id}`);
    if (createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error(`Audio hash mismatch ${id}`);
  }
  console.log(`Mimi validated: ${LESSONS.length} lessons, ${AUDIO_IDS.length} Polish recordings.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await validateMimi();
