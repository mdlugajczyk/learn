import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { NUMBER_MAGIC_V1_AUDIO_ENTRIES } from '../scripts/number-magic-v1-audio-catalog.mjs';

const appSource = await readFile(new URL('../public/numberblocks/app.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../public/numberblocks/audio/v1-manifest.json', import.meta.url), 'utf8'));

test('Number Magic uses only bundled bilingual ElevenLabs MP3 narration', () => {
  assert.equal(manifest.provider, 'elevenlabs');
  assert.equal(manifest.assets.length, NUMBER_MAGIC_V1_AUDIO_ENTRIES.length);
  assert.deepEqual([...new Set(manifest.assets.map(entry => entry.locale))].sort(), ['en', 'pl']);
  assert.ok(manifest.assets.every(entry => entry.provider === 'elevenlabs' && entry.filename.endsWith('.mp3')));
  assert.doesNotMatch(appSource, /speechSynthesis|SpeechSynthesisUtterance|\.m4a/);
});

test('Number Magic catalog has one unique file for every spoken line', () => {
  const filenames = NUMBER_MAGIC_V1_AUDIO_ENTRIES.map(entry => entry.filename);
  assert.equal(new Set(filenames).size, filenames.length);
  assert.equal(filenames.length, 300);
  assert.ok(NUMBER_MAGIC_V1_AUDIO_ENTRIES.every(entry => entry.text && entry.filename.endsWith('.mp3')));
});
