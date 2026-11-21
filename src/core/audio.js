/* Audio 100 % procédural (WebAudio) — vent, pluie, tonnerre, coups de feu, pas, battements de cœur.
   Aucun fichier son : cohérence artistique garantie et toute l'ambiance est générée localement. */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.wind = { gain: null, filter: null };
    this.rain = { gain: null };
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this._startWind();
    this._startRain();
    return this.ctx;
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  _noiseBuffer(seconds = 2) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(3);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    // dérive lente du vent
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.wind = { gain, filter, baseGain: 0.04 };
  }

  _startRain() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(hp).connect(gain).connect(this.master);
    src.start();
    this.rain = { gain };
  }

  /* Météo : intensités 0..1 */
  setWeather(wind01, rain01) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.wind.gain) {
      this.wind.gain.gain.setTargetAtTime(0.02 + wind01 * 0.25, t, 1.5);
      this.wind.filter.frequency.setTargetAtTime(300 + wind01 * 500, t, 2);
    }
    if (this.rain.gain) {
      this.rain.gain.gain.setTargetAtTime(rain01 * 0.16, t, 2);
    }
  }

  /* Distance atténuée générique. */
  _spatialGain(dist, radius) {
    return Math.max(0, 1 - dist / radius) ** 2;
  }

  gunshot(dist = 0, radius = 260) {
    return this._shot('outdoor', this._spatialGain(dist, radius));
  }

  playerGunshot() {
    return this._shot('outdoor', 1);
  }

  _shot(kind, gainMul) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    // craquement
    const crack = ctx.createBufferSource();
    crack.buffer = this._noiseBuffer(0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.8;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.9 * gainMul, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    crack.connect(bp).connect(cg).connect(this.master);
    crack.start(t);
    crack.stop(t + 0.2);
    // detonation grave
    const boom = ctx.createBufferSource();
    boom.buffer = this._noiseBuffer(0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(1.0 * gainMul, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    boom.connect(lp).connect(bg).connect(this.master);
    boom.start(t);
    boom.stop(t + 0.5);
    // écho de vallée
    const echo = ctx.createBufferSource();
    echo.buffer = this._noiseBuffer(0.8);
    const elp = ctx.createBiquadFilter();
    elp.type = 'lowpass';
    elp.frequency.value = 900;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0.001, t);
    eg.gain.setValueAtTime(0.3 * gainMul, t + 0.22);
    eg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    echo.connect(elp).connect(eg).connect(this.master);
    echo.start(t + 0.2);
    echo.stop(t + 1);
  }

  whizz(dist = 6) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(3800, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12 * this._spatialGain(dist, 14), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }

  step(dist = 0, heavy = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const g0 = (heavy ? 0.16 : 0.08) * this._spatialGain(dist, 26);
    if (g0 <= 0.001) return;
    const t = ctx.currentTime + Math.random() * 0.03;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = heavy ? 240 : 480;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(g0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.12);
  }

  heartbeat(stress01) {
    const ctx = this.ctx;
    if (!ctx || stress01 <= 0.02) return;
    const rate = 0.9 + stress01 * 1.3;
    const vol = 0.05 + stress01 * 0.22;
    for (const [offset, oVol] of [[0, vol], [0.16, vol * 0.6]]) {
      const t = ctx.currentTime + offset;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(58, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(oVol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.16);
    }
    void rate;
  }

  gasp() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.linearRampToValueAtTime(1600, t + 0.3);
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.5);
  }

  thunder(distance01 = 0.5) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + Math.random() * 0.4;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(120 + (1 - distance01) * 500, t);
    lp.frequency.exponentialRampToValueAtTime(40, t + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.5 * (1 - distance01 * 0.6), t + 0.15 + distance01 * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t); src.stop(t + 2.6);
  }

  impact(dist = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const g0 = this._spatialGain(dist, 40) * 0.25;
    if (g0 < 0.002) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.15);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 500;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(g0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.16);
  }

  ui(k = 'tick') {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    const freqs = { tick: 880, confirm: 440, select: 620, deny: 180, type: 1400 };
    o.frequency.value = freqs[k] ?? 620;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.08);
  }

  shout(dist = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const g0 = this._spatialGain(dist, 70) * 0.25;
    if (g0 < 0.005) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(240 + Math.random() * 120, t);
    o.frequency.linearRampToValueAtTime(160, t + 0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(g0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(bp).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.55);
  }
}
