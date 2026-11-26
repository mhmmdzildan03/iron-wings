// STEEL VIPER — procedural sound, no audio files.
// A jet's roar from detuned saws and filtered noise, wind, cannon bursts,
// plus the avionics voices: the seeker's rising lock tone, the RWR's
// missile warning, and the whoosh of a missile leaving the rail. Everything
// is synthesised, so the game ships as plain static files, no network.

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

  let lastBeep = 0;
  let lastRwr = 0;

  function beep(freq, dur, vol, when = 0) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /**
   * Called every frame, cheap. sys: { wep, lockProgress, locked, inbound } —
   * the avionics layer: a seeker tone that quickens as the lock firms up and
   * goes solid at LOCK, and the RWR's urgent double-beep while a hostile
   * missile is inbound. The burner adds a tearing roar over the engine.
   */
  function update(throttle, speedMph, firing, sys = {}) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const engineLevel = muted ? 0 : 0.02 + throttle * 0.075 + (sys.wep ? 0.05 : 0);
    engineGain.gain.setTargetAtTime(engineLevel, t, 0.12);
    const rpm = 42 + throttle * 68 + (sys.wep ? 26 : 0);
    engineOsc.frequency.setTargetAtTime(rpm, t, 0.1);
    engineOsc2.frequency.setTargetAtTime(rpm * 1.5 + 3, t, 0.1);
    windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.05, speedMph * 0.00022), t, 0.2);
    if (!muted && sys.lockProgress > 0.03) {
      const interval = sys.locked ? 0.09 : 0.42 - sys.lockProgress * 0.3;
      if (t - lastBeep > interval) {
        lastBeep = t;
        beep(sys.locked ? 1560 : 1180, sys.locked ? 0.07 : 0.045, 0.028);
      }
    }
    if (!muted && sys.inbound) {
      if (t - lastRwr > 0.34) {
        lastRwr = t;
        beep(880, 0.06, 0.05);
        beep(880, 0.06, 0.05, 0.1);
      }
    }
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

  /** The rail leaving: a breath of noise that tears away and dopplers down. */
  function launch() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.16);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.8);
  }

  /** A kill confirmed: a low, wide thump under the wind. */
  function explosion() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.6);
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { start, update, toggleMute, launch, explosion, get muted() { return muted; } };
}
