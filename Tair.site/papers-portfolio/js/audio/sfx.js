/**
 * sfx.js — All sound effect definitions (original procedural synthesis).
 * Each entry: { dur, build(context, destination, startTime) }
 * Works with both OfflineAudioContext (preload) and live AudioContext.
 */

function noise(c, dur) {
  const len = Math.max(1, (c.sampleRate * dur) | 0);
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function burst(c, dest, t, dur, { type = 'bandpass', f = 2000, f2 = null, q = 1, peak = 0.3, attack = 0.003 } = {}) {
  const s = c.createBufferSource();
  s.buffer = noise(c, dur + 0.05);
  const flt = c.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t);
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(flt).connect(g).connect(dest);
  s.start(t);
  s.stop(t + dur + 0.05);
}

function tone(c, dest, t, { type = 'sine', f = 440, f2 = null, dur = 0.2, peak = 0.5 } = {}) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const SFX = {
  hover: {
    dur: 0.08,
    build: (c, d, t) => burst(c, d, t, 0.06, { f: 3200, q: 0.8, peak: 0.07 }),
  },

  page: {
    dur: 0.34,
    build: (c, d, t) => {
      burst(c, d, t, 0.20, { f: 1200, f2: 4200, q: 0.7, peak: 0.38 });
      burst(c, d, t + 0.11, 0.20, { f: 4200, f2: 1500, q: 0.7, peak: 0.30 });
    },
  },

  paper: {
    dur: 0.3,
    build: (c, d, t) => burst(c, d, t, 0.25, { type: 'lowpass', f: 700, f2: 2200, q: 0.6, peak: 0.12 }),
  },

  stamp: {
    dur: 0.5,
    build: (c, d, t) => {
      burst(c, d, t, 0.012, { f: 2500, q: 0.9, peak: 0.5 });
      tone(c, d, t, { f: 170, f2: 42, dur: 0.22, peak: 1.0 });
      burst(c, d, t, 0.16, { type: 'lowpass', f: 900, q: 0.5, peak: 0.55 });
    },
  },

  approve: {
    dur: 0.7,
    build: (c, d, t) => {
      burst(c, d, t, 0.03, { type: 'highpass', f: 2200, q: 0.7, peak: 0.45 });
      const k = t + 0.09;
      tone(c, d, k, { f: 130, f2: 34, dur: 0.30, peak: 1.0 });
      tone(c, d, k, { type: 'square', f: 70, f2: 30, dur: 0.18, peak: 0.35 });
      burst(c, d, k, 0.22, { type: 'lowpass', f: 700, q: 0.5, peak: 0.7 });
    },
  },

  buzzer: {
    dur: 0.22,
    build: (c, d, t) => {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.005);
      g.gain.setValueAtTime(0.2, t + 0.15);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.17);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      lp.connect(g);
      g.connect(d);
      [110, 116].forEach((f) => {
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        o.connect(lp);
        o.start(t);
        o.stop(t + 0.18);
      });
    },
  },

  key: {
    dur: 0.05,
    build: (c, d, t) => {
      burst(c, d, t, 0.015, { f: 1800, q: 1.2, peak: 0.25 });
      tone(c, d, t, { f: 190, f2: 120, dur: 0.03, peak: 0.25 });
    },
  },

  ding: {
    dur: 0.5,
    build: (c, d, t) => tone(c, d, t, { f: 2093, dur: 0.45, peak: 0.18 }),
  },

  tick: {
    dur: 0.06,
    build: (c, d, t) => tone(c, d, t, { type: 'square', f: 1000, f2: 700, dur: 0.05, peak: 0.12 }),
  },

  ezic: {
    dur: 0.9,
    build: (c, d, t) => {
      [880, 740, 622, 523, 440, 330, 220, 110].forEach((f, i) =>
        tone(c, d, t + i * 0.07, { type: 'square', f, dur: 0.08, peak: 0.14 })
      );
      burst(c, d, t + 0.55, 0.3, { type: 'lowpass', f: 400, q: 0.5, peak: 0.5 });
    },
  },
};
