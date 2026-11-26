// IRON WINGS — procedural sound, no audio files.
// A Merlin-ish growl from detuned saws through a low pass, wind from filtered
// noise, and short noise bursts for the guns. Everything is synthesised, so
// the game still ships as plain static files with no network request.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;
  let lastShot = 0;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    engineOsc = ctx.createOscillator();
    engineOsc2 = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc2.type = 'square';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter); engineOsc2.connect(filter);
    filter.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc.start(); engineOsc2.start();

    const noise = noiseSource();
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter); windFilter.connect(windGain); windGain.connect(ctx.destination);
    noise.start();
  }

  function noiseSource() {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    return src;
  }

  /** throttle 0..1, speedMph for wind, firing flag — called every frame, cheap. */
  function update(throttle, speedMph, firing) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const engineLevel = muted ? 0 : 0.02 + throttle * 0.075;
    engineGain.gain.setTargetAtTime(engineLevel, t, 0.12);
    const rpm = 42 + throttle * 68;
    engineOsc.frequency.setTargetAtTime(rpm, t, 0.1);
    engineOsc2.frequency.setTargetAtTime(rpm * 1.5 + 3, t, 0.1);
    windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.05, speedMph * 0.00022), t, 0.2);
    if (firing && !muted && t - lastShot > 0.09) {
      lastShot = t;
      const src = noiseSource();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1800;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start(t); src.stop(t + 0.08);
    }
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { start, update, toggleMute, get muted() { return muted; } };
}
