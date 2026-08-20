import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { NUMBER_MAGIC_AUDIO_ENTRIES } from '../scripts/number-magic-audio-catalog.mjs';

const appSource = await readFile(new URL('../public/numberblocks/app.js', import.meta.url), 'utf8');
const missionsSource = await readFile(new URL('../public/numberblocks/missions.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../public/numberblocks/audio/manifest.json', import.meta.url), 'utf8'));

test('Number Magic uses only bundled English ElevenLabs MP3 narration', () => {
  assert.equal(manifest.provider, 'elevenlabs');
  assert.equal(manifest.language, 'en');
  assert.equal(manifest.entries.length, NUMBER_MAGIC_AUDIO_ENTRIES.length);
  assert.ok(manifest.entries.every(entry => entry.provider === 'elevenlabs' && entry.filename.endsWith('.mp3')));
  assert.doesNotMatch(appSource, /speechSynthesis|SpeechSynthesisUtterance|\.m4a/);
  assert.doesNotMatch(missionsSource, /\.m4a/);
});

test('Number Magic catalog has one unique file for every spoken line', () => {
  const filenames = NUMBER_MAGIC_AUDIO_ENTRIES.map(entry => entry.filename);
  assert.equal(new Set(filenames).size, filenames.length);
  assert.equal(filenames.length, 271);
  assert.ok(NUMBER_MAGIC_AUDIO_ENTRIES.every(entry => entry.text && entry.filename.endsWith('.mp3')));
});
