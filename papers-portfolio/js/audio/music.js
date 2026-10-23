/**
 * music.js — Original dark 8-bit background theme.
 * Lookahead sequencer: setInterval pushes notes into the future,
 * Web Audio scheduling provides sample-accurate timing.
 * A-minor progression, march-like, sparse — NOT a copy of any game music.
 */

const BPM = 76;
const STEPS = 64;
const SPS = 60 / BPM / 4; /* seconds per sixteenth note */

const PROG = [
  { bass: 45, arp: [57, 60, 64, 60] },   /* Am */
  { bass: 41, arp: [57, 60, 65, 60] },   /* F  */
  { bass: 48, arp: [55, 60, 64, 60] },   /* C  */
  { bass: 40, arp: [56, 59, 64, 59] },   /* E  */
];

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function makePulse(c, duty) {
  const N = 32;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  }
  return c.createPeriodicWave(re, im);
}

export class Music {
  constructor(engine) {
    this.e = engine;
    this.step = 0;
    this.timer = null;
    this.wave = null;
    this.next = 0;
  }

  start() {
    const { ctx, musicBus } = this.e;
    if (!ctx || this.timer) return;

    this.wave = makePulse(ctx, 0.25);
    this.next = ctx.currentTime + 0.15;

    musicBus.gain.setValueAtTime(0, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 2);

    this.timer = setInterval(() => this.pump(), 40);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pump() {
    if (!this.e.ctx) return;
    const { ctx } = this.e;
    if (ctx.state !== 'running') {
      this.next = ctx.currentTime + 0.15;
      return;
    }
    if (ctx.currentTime - this.next > 0.5) {
      const skipped = Math.ceil((ctx.currentTime - this.next) / SPS);
      this.step = (this.step + skipped) % STEPS;
      this.next = ctx.currentTime + 0.15;
    }
    while (this.next < ctx.currentTime + 0.2) {
      this.playStep(this.step, this.next);
      this.next += SPS;
      this.step = (this.step + 1) % STEPS;
    }
  }

  playStep(step, t) {
    const ch = PROG[step >> 4];
    const s = step & 15;

    /* Bass line — triangle */
    if (s === 0) this.tri(mtof(ch.bass), t, SPS * 6, 0.50);
    if (s === 8) this.tri(mtof(ch.bass), t, SPS * 3, 0.40);
    if (s === 11) this.tri(mtof(ch.bass + 12), t, SPS * 2, 0.25);

    /* Arpeggio — pulse wave */
    if (s % 2 === 0) this.pulse(mtof(ch.arp[(s >> 1) % 4]), t, SPS * 1.6, 0.07);

    /* Percussion */
    if (s === 4 || s === 12) this.hit(t, 0.09, 1100, 0.10); /* snare */
    if (s % 4 === 2) this.hit(t, 0.025, 6000, 0.035);       /* hihat */
  }

  tri(freq, t, dur, vol) {
    const c = this.e.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.e.musicBus);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  pulse(freq, t, dur, vol) {
    const c = this.e.ctx;
    const o = c.createOscillator();
    o.setPeriodicWave(this.wave);
    o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.e.musicBus);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  hit(t, dur, freq, vol) {
    const c = this.e.ctx;
    const len = Math.max(1, (c.sampleRate * (dur + 0.02)) | 0);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource();
    s.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = freq;
    flt.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt).connect(g).connect(this.e.musicBus);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
}
