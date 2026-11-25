// Procedural Web Audio: no MP3 files. Whooshes are band-passed noise with
// pitch envelopes, impacts are sub-bass thump + noise crack, clashes and
// parries are resonant FM metallic rings. A soft wind bed and a minimalist
// taiko pulse run underneath and intensify at low HP / final round.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('sf-muted') === '1';
    this.volume = parseFloat(localStorage.getItem('sf-vol') || '0.8');
    this.ambience = null;
    this.intensity = 0;
    this._beat = 0;
    this._nextBeat = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('sf-muted', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  setVolume(v) {
    this.volume = v;
    localStorage.setItem('sf-vol', String(v));
    if (this.master && !this.muted) this.master.gain.value = v;
  }

  _noiseBuffer(dur = 0.5) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _noise(dur, filterType, freq, q, gain, sweepTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }

  _tone(freq, dur, type = 'sine', gain = 0.3, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  whoosh(pitch = 1) { this._noise(0.16, 'bandpass', 900 * pitch, 1.2, 0.25, 2400 * pitch); }
  swingHeavy() { this._noise(0.28, 'bandpass', 500, 1.0, 0.35, 1800); }
  impact(kind = 'light') {
    if (kind === 'light') { this._tone(140, 0.12, 'sine', 0.5, 55); this._noise(0.06, 'highpass', 1800, 1, 0.22); }
    else if (kind === 'heavy') { this._tone(90, 0.22, 'sine', 0.8, 38); this._noise(0.12, 'lowpass', 900, 1, 0.5); this._tone(60, 0.3, 'triangle', 0.4, 30); }
    else { this._tone(110, 0.16, 'sine', 0.6, 45); this._noise(0.1, 'bandpass', 700, 1, 0.35); }
  }
  clash() {
    // resonant FM metallic ring
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const car = this.ctx.createOscillator(); car.type = 'sine'; car.frequency.value = 1240;
    const mod = this.ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = 620;
    const mg = this.ctx.createGain(); mg.gain.setValueAtTime(900, t); mg.gain.exponentialRampToValueAtTime(60, t + 0.3);
    mod.connect(mg); mg.connect(car.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    car.connect(g); g.connect(this.master);
    car.start(t); mod.start(t); car.stop(t + 0.4); mod.stop(t + 0.4);
    this._noise(0.08, 'highpass', 3000, 1, 0.18);
  }
  parry() { this.clash(); this._tone(1560, 0.3, 'sine', 0.2, 1560); }
  jump() { this._noise(0.12, 'bandpass', 600, 1, 0.12, 1400); }
  ko() { this._tone(70, 0.5, 'sine', 0.9, 28); this._noise(0.3, 'lowpass', 500, 1, 0.5); }
  uiClick() { this._tone(660, 0.06, 'square', 0.08); }
  special() { this._noise(0.4, 'bandpass', 300, 1.5, 0.3, 3200); this._tone(220, 0.4, 'sawtooth', 0.12, 880); }
  roundStart() { this._tone(440, 0.1, 'square', 0.12); this._tone(660, 0.18, 'square', 0.12); }
  block() { this._noise(0.05, 'bandpass', 1200, 2, 0.15); }

  startAmbience() {
    this.ensure();
    if (!this.ctx || this.ambience) return;
    // soft wind: looped filtered noise
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.4;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = this.ctx.createGain(); lg.gain.value = 120;
    lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); lfo.start();
    this.ambience = { src, lfo, gain: g };
    this._nextBeat = this.ctx.currentTime + 0.5;
  }

  stopAmbience() {
    if (!this.ambience) return;
    try { this.ambience.src.stop(); this.ambience.lfo.stop(); } catch (e) { void e; }
    this.ambience = null;
  }

  // Call once per logic tick. Schedules a minimalist taiko pulse whose
  // rate rises with intensity (low HP / final round).
  tick() {
    if (!this.ctx || !this.ambience) return;
    const now = this.ctx.currentTime;
    if (now < this._nextBeat) return;
    const interval = this.intensity > 0.6 ? 0.42 : this.intensity > 0.3 ? 0.62 : 0.95;
    this._nextBeat = now + interval;
    this._beat += 1;
    // low drum on the beat, soft tick on the off-beat when intense
    this._tone(72, 0.22, 'sine', 0.5, 36);
    if (this.intensity > 0.3 && this._beat % 2 === 0) this._noise(0.05, 'bandpass', 2400, 3, 0.08);
    if (this.intensity > 0.6 && this._beat % 4 === 3) this._tone(180, 0.1, 'triangle', 0.15, 90);
  }
}
