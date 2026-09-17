// Reuse one media element on iOS's media playback route. No test sound and no
// await before play(): Safari must receive the request directly from the tap.
export class Narrator {
  constructor({ media = new Audio(), stallMs = 8000, pollMs = 250 } = {}) {
    this.media = media;
    this.media.preload = 'auto';
    this.current = null;
    this.stallMs = stallMs;
    this.pollMs = pollMs;
  }
  stop() {
    this.current?.finish(false);
    this.media.pause();
  }
  play(id, { onProgress } = {}) {
    this.stop();
    try { if (globalThis.navigator?.audioSession) navigator.audioSession.type = 'playback'; } catch { /* Older Safari uses the default media route. */ }
    const media = this.media;
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
        if (error) { media.pause(); reject(error); } else resolve(result);
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
