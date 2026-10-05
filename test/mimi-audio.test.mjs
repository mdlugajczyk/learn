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
  const media = new Media(), narrator = new Narrator({ createMedia: () => media });
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
  const clips = [], narrator = new Narrator({ createMedia: () => {
    const media = new Media();
    clips.push(media);
    return media;
  } });
  const first = narrator.play('word-ma');
  const second = narrator.play('word-mi');
  assert.equal(await first, false);
  assert.equal(clips[0].paused, true);
  assert.notEqual(clips[0], clips[1]);
  clips[1].dispatchEvent(new Event('ended'));
  assert.equal(await second, true);
  const third = narrator.play('word-mama');
  narrator.stop();
  assert.equal(await third, false);
  assert.equal(clips[2].paused, true);
});

test('the same syllable can play twice in a row before a complete word', async () => {
  const clips = [], narrator = new Narrator({ createMedia: () => {
    const media = new Media();
    clips.push(media);
    return media;
  } });
  const first = narrator.play('word-ma');
  clips[0].dispatchEvent(new Event('ended'));
  await first;
  const second = narrator.play('word-ma');
  clips[1].dispatchEvent(new Event('ended'));
  await second;
  const wholeWord = narrator.play('word-mama');
  clips[2].dispatchEvent(new Event('ended'));
  await wholeWord;
  assert.deepEqual(clips.map(({ src }) => src.split('/').at(-1)), ['word-ma.mp3', 'word-ma.mp3', 'word-mama.mp3']);
  assert.equal(new Set(clips).size, 3);
});

test('autoplay rejection and missing media fail promptly instead of locking the lesson', async () => {
  const media = new Media(), narrator = new Narrator({ createMedia: () => media });
  media.play = () => Promise.reject(new Error('NotAllowedError'));
  await assert.rejects(narrator.play('word-ma'), /NotAllowedError/);
  media.play = () => Promise.resolve();
  const missing = narrator.play('missing');
  media.dispatchEvent(new Event('error'));
  await assert.rejects(missing, /Nie można/);
  assert.equal(narrator.current, null);
});

test('a playing icon with no progressing audio reaches recovery instead of waiting forever', async () => {
  const media = new Media(), narrator = new Narrator({ createMedia: () => media, stallMs: 20, pollMs: 5 });
  await assert.rejects(narrator.play('word-ma'), /zatrzymało/);
  assert.equal(media.paused, true);
  assert.equal(narrator.current, null);
});
