import test from 'node:test';
import assert from 'node:assert/strict';
import { Narrator } from '../public/mimi/audio.js';

class Media extends EventTarget {
  currentTime = 0;
  duration = 1;
  playCalls = 0;
  pause() { this.paused = true; }
  play() { this.paused = false; this.playCalls++; return Promise.resolve(); }
}

test('narration starts on the same tap stack and finishes on media ended', async () => {
  const media = new Media(), narrator = new Narrator({ media });
  const progress = [];
  const playing = narrator.play('word-ma', { onProgress: p => progress.push(p) });
  assert.equal(media.playCalls, 1);
  assert.equal(media.muted, false);
  assert.equal(media.volume, 1);
  assert.ok(media.src.endsWith('/audio/word-ma.mp3'));
  media.dispatchEvent(new Event('ended'));
  assert.equal(await playing, true);
  assert.deepEqual(progress, [1]);
  assert.equal(narrator.current, null);
});

test('new narration cancels the previous clip without overlap or a pending promise', async () => {
  const media = new Media(), narrator = new Narrator({ media });
  const first = narrator.play('word-ma');
  const second = narrator.play('word-mi');
  assert.equal(await first, false);
  media.dispatchEvent(new Event('ended'));
  assert.equal(await second, true);
  const third = narrator.play('word-mama');
  narrator.stop();
  assert.equal(await third, false);
  assert.equal(media.paused, true);
});

test('autoplay rejection and missing media fail promptly instead of locking the lesson', async () => {
  const media = new Media(), narrator = new Narrator({ media });
  media.play = () => Promise.reject(new Error('NotAllowedError'));
  await assert.rejects(narrator.play('word-ma'), /NotAllowedError/);
  media.play = () => Promise.resolve();
  const missing = narrator.play('missing');
  media.dispatchEvent(new Event('error'));
  await assert.rejects(missing, /Nie można/);
  assert.equal(narrator.current, null);
});

test('a playing icon with no progressing audio reaches recovery instead of waiting forever', async () => {
  const media = new Media(), narrator = new Narrator({ media, stallMs: 20, pollMs: 5 });
  await assert.rejects(narrator.play('word-ma'), /zatrzymało/);
  assert.equal(media.paused, true);
  assert.equal(narrator.current, null);
});
