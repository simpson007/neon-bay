// Neon Bay — sound, synthesised only. No audio files: an engine hum that
// follows the car's speed, a two-tone siren while the law is after you, and
// one-shot blips, thuds, crashes and a mission jingle, all from WebAudio
// oscillators and a little filtered noise. M mutes the master gain.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let sirenPhase = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, volume, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, volume) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    /** Called every frame: engine follows speed, siren follows the wanted level. */
    update(dt, state) {
      if (!ctx) return;
      const speed = state.player.car ? Math.abs(state.player.car.speed) : 0;
      const norm = Math.min(1, speed / 430);
      engineGain.gain.value = state.player.car ? 0.05 + norm * 0.06 : 0;
      engineOsc.frequency.value = 55 + norm * 145;
      if (state.wanted > 0 && state.policeCars.length > 0) {
        sirenPhase += dt;
        const high = Math.floor(sirenPhase * 1.6) % 2 === 0;
        sirenOsc.frequency.value = high ? 880 : 660;
        sirenGain.gain.value = 0.045;
      } else {
        sirenGain.gain.value = 0;
      }
    },
    blip() { tone(880, 0.09, 'sine', 0.25); tone(1320, 0.08, 'sine', 0.18, 0.07); },
    thud() { tone(120, 0.12, 'sine', 0.4); noise(0.08, 0.2); },
    crash() { noise(0.25, 0.5); tone(90, 0.2, 'sawtooth', 0.2); },
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.25, i * 0.11));
    },
    fail() { tone(220, 0.3, 'sawtooth', 0.25); tone(165, 0.4, 'sawtooth', 0.25, 0.18); },
    stopAll() {
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
    },
  };
}
