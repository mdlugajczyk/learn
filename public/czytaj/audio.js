import { audioEntry } from './data/audio-manifest.js';

const sourceUrl = (entry) => new URL(`./${entry.filename}`, import.meta.url).href;

export class AudioQueue extends EventTarget {
  constructor() {
    super();
    this.audio = new Audio();
    this.currentId = null;
    this.unlocked = false;
    this.enabled = true;
    this.pendingResolve = null;
    this.lastError = null;
    this.audio.preload = 'auto';
  }

  stop() {
    if (this.pendingResolve) {
      this.pendingResolve({ played: false, cancelled: true });
      this.pendingResolve = null;
    }
    this.audio.pause();
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.currentTime = 0;
    this.currentId = null;
  }

  async play(id, { required = true } = {}) {
    if (!this.enabled) return !required;
    const entry = audioEntry(id);
    if (!entry) {
      if (required) this.dispatchEvent(new CustomEvent('requiredmissing', { detail: { id } }));
      return false;
    }
    this.stop();
    this.currentId = id;
    this.audio.src = sourceUrl(entry);
    this.audio.load();
    const result = await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        this.audio.onended = null;
        this.audio.onerror = null;
        if (this.pendingResolve === finish) this.pendingResolve = null;
        resolve(value);
      };
      this.pendingResolve = finish;
      this.audio.onended = () => finish({ played: true, cancelled: false });
      this.audio.onerror = () => finish({ played: false, cancelled: false, error: this.audio.error });
      this.audio.play().then(() => {
        this.unlocked = true;
        this.lastError = null;
      }).catch((error) => finish({ played: false, cancelled: false, error }));
    });
    if (result.cancelled) return false;
    if (result.played) {
      this.currentId = null;
      return true;
    }
    this.lastError = result.error ?? new Error(`Audio unavailable: ${id}`);
    const blockedByAutoplay = result.error?.name === 'NotAllowedError';
    if (required && !blockedByAutoplay) this.dispatchEvent(new CustomEvent('requiredmissing', { detail: { id } }));
    return false;
  }

  preload(id) {
    const entry = audioEntry(id);
    if (!entry) return;
    const probe = new Audio(sourceUrl(entry));
    probe.preload = 'auto';
  }
}
