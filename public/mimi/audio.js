export class Narrator {
  constructor() { this.context = null; this.buffers = new Map(); this.current = null; this.generation = 0; }
  async unlock() {
    this.context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state !== 'running') await this.context.resume();
  }
  async load(id) {
    if (!this.buffers.has(id)) this.buffers.set(id, (async () => {
      const response = await fetch(new URL(`./audio/${id}.mp3`, import.meta.url));
      if (!response.ok || !response.headers.get('content-type')?.includes('audio')) throw new Error(`Brakuje nagrania: ${id}`);
      return this.context.decodeAudioData(await response.arrayBuffer());
    })().catch(error => { this.buffers.delete(id); throw error; }));
    return this.buffers.get(id);
  }
  stop() {
    this.generation++;
    if (this.current) { const playing = this.current; playing.finish(false); try { playing.source.stop(); } catch {} }
  }
  async play(id, { onProgress } = {}) {
    this.stop();
    const generation = this.generation;
    await this.unlock();
    const buffer = await this.load(id);
    if (generation !== this.generation) return false;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    return new Promise(resolve => {
      let frame = null, settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        cancelAnimationFrame(frame);
        source.onended = null;
        if (this.current?.source === source) this.current = null;
        source.disconnect();
        resolve(result);
      };
      this.current = { source, finish };
      source.onended = () => { onProgress?.(1); finish(true); };
      const started = this.context.currentTime;
      const animate = () => {
        if (settled) return;
        onProgress?.(Math.min(1, (this.context.currentTime - started) / buffer.duration));
        frame = requestAnimationFrame(animate);
      };
      source.start();
      if (onProgress) animate();
    });
  }
}
