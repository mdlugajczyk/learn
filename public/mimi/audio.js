// Each clip gets its own media element. Reassigning src on a just-ended element
// is unreliable in Mobile Safari: the next short syllable can be silently
// skipped. No test sound and no await before play(): Safari must receive the
// first request directly from the tap.
export class Narrator {
  constructor({ createMedia = () => new Audio(), stallMs = 8000, pollMs = 250 } = {}) {
    this.createMedia = createMedia;
    this.current = null;
    this.stallMs = stallMs;
    this.pollMs = pollMs;
  }
  stop() {
    this.current?.finish(false);
  }
  play(id, { onProgress } = {}) {
    this.stop();
    try { if (globalThis.navigator?.audioSession) navigator.audioSession.type = 'playback'; } catch { /* Older Safari uses the default media route. */ }
    const media = this.createMedia();
    media.preload = 'auto';
    media.src = new URL(`./audio/${id}.mp3`, import.meta.url).href;
    media.muted = false;
    media.volume = 1;
    return new Promise((resolve, reject) => {
      let settled = false, timer, lastTime = 0, lastAdvance = Date.now();
      const started = lastAdvance;
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        media.removeEventListener('ended', ended);
        media.removeEventListener('error', failed);
        if (this.current?.finish === finish) this.current = null;
        // A cancellation must silence the old element before the next clip
        // starts; a natural `ended` event needs no pause.
        if (!result) media.pause();
        if (error) reject(error); else resolve(result);
      };
      const ended = () => { onProgress?.(1); finish(true); };
      const failed = () => finish(false, new Error(`Nie można odtworzyć nagrania: ${id}`));
      this.current = { finish };
      media.addEventListener('ended', ended);
      media.addEventListener('error', failed);
      timer = setInterval(() => {
        if (media.currentTime > lastTime + .01) { lastTime = media.currentTime; lastAdvance = Date.now(); }
        if (Number.isFinite(media.duration) && media.duration > 0) onProgress?.(Math.min(1, media.currentTime / media.duration));
        if (Date.now() - lastAdvance > this.stallMs || Date.now() - started > 45000) finish(false, new Error('Odtwarzanie zatrzymało się. Dotknij, aby spróbować ponownie.'));
      }, this.pollMs);
      try { media.play()?.catch(error => finish(false, error)); } catch (error) { finish(false, error); }
    });
  }
}
