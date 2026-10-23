/**
 * engine.js — Autoplay-safe Web Audio engine.
 * Step 1 (preload): pre-renders all SFX via OfflineAudioContext (no gesture needed).
 * Step 2 (unlock): creates live AudioContext from user gesture.
 */

const AC = window.AudioContext || window.webkitAudioContext;
const SR = 44100;

export class AudioEngine {
  constructor(defs) {
    this.defs = defs;
    this.buffers = new Map();
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.supported = !!AC;
    this.sfxBus = null;
    this.musicBus = null;
    this.master = null;
  }

  /**
   * STEP 1 — call WITHOUT a gesture.
   * OfflineAudioContext does not fall under Autoplay Policy.
   */
  async preload(onProgress = () => {}) {
    if (!this.supported || typeof OfflineAudioContext === 'undefined') return;
    const names = Object.keys(this.defs);
    for (let i = 0; i < names.length; i++) {
      const def = this.defs[names[i]];
      try {
        const frames = Math.max(1, Math.ceil(def.dur * SR));
        const oc = new OfflineAudioContext(1, frames, SR);
        def.build(oc, oc.destination, 0);
        this.buffers.set(names[i], await oc.startRendering());
      } catch (e) {
        console.warn('[audio] pre-render failed:', names[i], e);
      }
      onProgress((i + 1) / names.length);
    }
  }

  /**
   * STEP 2 — call as FIRST line inside a gesture handler.
   */
  async unlock({ muted = false } = {}) {
    if (!this.supported) return false;
    this.muted = muted;
    if (!this.ctx) {
      const c = (this.ctx = new AC({ latencyHint: 'interactive' }));

      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = 0.9;

      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0;

      this.master = c.createGain();

      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;

      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(limiter);
      limiter.connect(c.destination);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) c.suspend();
        else if (!this.muted) c.resume();
      });

      document.addEventListener('pointerdown', () => {
        if (!this.muted && !document.hidden && c.state !== 'running') c.resume();
      }, { passive: true });
    }

    this.master.gain.value = muted ? 0 : 1;
    if (!muted) await this.ctx.resume();

    /* 1-sample silent buffer to fully unlock iOS */
    const s = this.ctx.createBufferSource();
    s.buffer = this.ctx.createBuffer(1, 1, 22050);
    s.connect(this.ctx.destination);
    s.start(0);

    this.ready = true;
    return true;
  }

  play(name, { gain = 1, rate = 1 } = {}) {
    if (!this.ready || this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const buf = this.buffers.get(name);
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain;

    if (buf) {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(g).connect(this.sfxBus);
      src.onended = () => { src.disconnect(); g.disconnect(); };
      src.start();
    } else if (this.defs[name]) {
      g.connect(this.sfxBus);
      this.defs[name].build(c, g, c.currentTime);
    }
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 1, t, 0.02);
    if (m) {
      setTimeout(() => { if (this.muted && this.ctx) this.ctx.suspend(); }, 150);
    } else {
      this.ctx.resume();
    }
  }
}
