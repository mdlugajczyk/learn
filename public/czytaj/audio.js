import { audioEntry } from './data/audio-manifest.js';

export class AudioQueue extends EventTarget {
  constructor() {
    super();
    this.audio = new Audio();
    this.currentId = null;
    this.unlocked = false;
    this.enabled = true;
    this.pendingResolve = null;
    this.audio.preload = 'auto';
  }

  async unlock() {
    if (this.unlocked) return true;
    this.audio.muted = true;
    this.audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    try {
      await this.audio.play();
      this.audio.pause();
      this.unlocked = true;
    } catch {
      this.unlocked = false;
    } finally {
      this.audio.muted = false;
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    return this.unlocked;
  }

  stop() {
    if (this.pendingResolve) {
      this.pendingResolve({ played: false, cancelled: true });
      this.pendingResolve = null;
    }
    this.audio.pause();
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
    this.audio.src = new URL(entry.filename, import.meta.url).href.replace('/data/audio/', '/audio/');
    try {
      await this.audio.play();
      const result = await new Promise((resolve) => {
        this.pendingResolve = resolve;
        this.audio.onended = () => resolve({ played: true, cancelled: false });
        this.audio.onerror = () => resolve({ played: false, cancelled: false });
      });
      this.pendingResolve = null;
      if (result.cancelled) return false;
      if (!result.played) throw new Error(`Audio unavailable: ${id}`);
      return true;
    } catch {
      if (required) this.dispatchEvent(new CustomEvent('requiredmissing', { detail: { id } }));
      return false;
    }
  }

  preload(id) {
    const entry = audioEntry(id);
    if (!entry) return;
    const probe = new Audio(new URL(entry.filename, import.meta.url).href.replace('/data/audio/', '/audio/'));
    probe.preload = 'auto';
  }
}
