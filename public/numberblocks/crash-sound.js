// Layered Web Audio foley: generated locally, available offline, no media delay.
export function playCrashSound(context, volume, phase, scene) {
  if (!context || volume <= 0) return () => {};
  const nodes = [];
  const output = context.createGain();
  output.gain.value = Math.min(1, volume) * .38;
  output.connect(context.destination);
  const now = context.currentTime;
  function tone(from, to, duration, offset = 0, level = .25, type = 'sine') {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now + offset);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + offset + duration);
    envelope.gain.setValueAtTime(.0001, now + offset);
    envelope.gain.exponentialRampToValueAtTime(level, now + offset + .015);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
    oscillator.connect(envelope).connect(output);
    oscillator.start(now + offset); oscillator.stop(now + offset + duration + .02);
    nodes.push(oscillator);
  }
  function noise(duration, cutoff, offset, level, highpass = false) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 187;
    for (let i = 0; i < data.length; i += 1) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741824 - 1; }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = highpass ? 'highpass' : 'lowpass'; filter.frequency.value = cutoff;
    envelope.gain.setValueAtTime(.0001, now + offset);
    envelope.gain.exponentialRampToValueAtTime(level, now + offset + .025);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
    source.connect(filter).connect(envelope).connect(output);
    source.start(now + offset); nodes.push(source);
  }
  if (phase === 'approach') {
    if (scene === 'runner') for (let i = 0; i < 5; i += 1) tone(180, 80, .09, i * .15, .2);
    else { tone(scene === 'plane' ? 135 : 65, scene === 'plane' ? 270 : 155, .95, 0, .16, 'triangle'); noise(.85, 1100, .1, .13); }
  } else if (phase === 'brake') {
    tone(900, 420, .22, 0, .09, 'triangle'); noise(.2, 1600, 0, .08, true);
  } else if (phase === 'impact') {
    tone(145, 48, .28, 0, .65); // Soft low thump under a woody clack.
    noise(.18, 1450, 0, .48);
    tone(540, 95, .48, .055, .24, 'triangle');
  } else if (phase === 'scatter') {
    noise(.4, 1700, 0, .16);
    [520, 660, 790, 990].forEach((pitch, i) => tone(pitch, pitch * .68, .13, .25 + i * .11, .11, 'triangle'));
  } else if (phase === 'land') {
    [230, 300, 370].forEach((pitch, i) => tone(pitch, 90, .12, i * .09, .15));
  }
  // Cleanup still runs if the scene is cancelled, paused, or navigated away.
  const cleanup = setTimeout(() => output.disconnect(), 2200);
  return () => { clearTimeout(cleanup); nodes.forEach(node => { try { node.stop(); } catch {} }); output.disconnect(); };
}
