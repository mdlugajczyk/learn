import assert from 'node:assert/strict';
import test from 'node:test';

test('an autoplay-policy rejection does not masquerade as a missing offline file', async () => {
  const OriginalAudio = globalThis.Audio;
  class BlockedAudio {
    constructor() {
      this.currentTime = 0;
      this.onended = null;
      this.onerror = null;
    }

    load() {}
    pause() {}
    play() {
      const error = new Error('Playback requires a user gesture');
      error.name = 'NotAllowedError';
      return Promise.reject(error);
    }
  }

  globalThis.Audio = BlockedAudio;
  try {
    const { AudioQueue } = await import(`../public/czytaj/audio.js?autoplay-test=${Date.now()}`);
    const queue = new AudioQueue();
    let missingEvents = 0;
    queue.addEventListener('requiredmissing', () => { missingEvents += 1; });
    assert.equal(await queue.play('welcome-home'), false);
    assert.equal(missingEvents, 0);
    assert.equal(queue.lastError?.name, 'NotAllowedError');
  } finally {
    if (OriginalAudio) globalThis.Audio = OriginalAudio;
    else delete globalThis.Audio;
  }
});
