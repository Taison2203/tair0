/** Gesture-safe audio mixer with bounded polyphony and persistent volume controls. */
const AC = window.AudioContext || window.webkitAudioContext;
const SR = 44100;
const PREF_KEY = 'inspector.audio.preferences.v2';
const DEFAULTS = { effects: 0.8, music: 0.75 };
const clamp = (n, fallback) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback);

export class AudioEngine extends EventTarget {
  constructor(defs) {
    super();
    this.defs = defs;
    this.buffers = new Map();
    this.lastPlayed = new Map();
    this.voices = new Set();
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.supported = !!AC;
    this.volume = { ...DEFAULTS };
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY));
      for (const key of Object.keys(DEFAULTS)) this.volume[key] = clamp(saved?.[key], DEFAULTS[key]);
    } catch {
      /* Storage restrictions must not prevent starting a shift. */
    }
  }

  async preload(onProgress = () => {}) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!this.supported || !Offline) return;
    const queue = Object.entries(this.defs);
    let finished = 0;
    // Small batches keep boot responsive on phones while avoiding forty serial renders.
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const [name, def] = queue.shift();
          try {
            const offline = new Offline(1, Math.ceil(def.dur * SR), SR);
            def.build(offline, offline.destination, 0);
            const buffer = await offline.startRendering();
            const samples = buffer.getChannelData(0);
            let peak = 0;
            for (const value of samples) peak = Math.max(peak, Math.abs(value));
            const scale = peak ? Math.min(3, 0.74 / peak) : 1;
            for (let i = 0; i < samples.length; i++) samples[i] *= scale;
            this.buffers.set(name, buffer);
          } catch (error) {
            console.warn('[audio] Could not render', name, error);
          }
          onProgress(++finished / Object.keys(this.defs).length);
        }
      }),
    );
  }

  async unlock({ muted = false } = {}) {
    if (!this.supported) return false;
    this.muted = muted;
    if (!this.ctx) {
      const c = (this.ctx = new AC({ latencyHint: 'interactive' }));
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = this.volume.effects;
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0; // The score owns its entrance/exit envelope.
      this.musicVolumeBus = c.createGain();
      this.musicVolumeBus.gain.value = this.volume.music;
      this.duckBus = c.createGain();
      this.master = c.createGain();
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -5;
      limiter.knee.value = 6;
      limiter.ratio.value = 8;
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.duckBus).connect(this.musicVolumeBus).connect(this.master);
      this.master.connect(limiter).connect(c.destination);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopEffects();
          c.suspend();
        } else if (!this.muted) c.resume();
      });
      document.addEventListener(
        'pointerdown',
        () => {
          if (!this.muted && !document.hidden && c.state !== 'running') c.resume();
        },
        { passive: true },
      );
    }
    this.master.gain.value = muted ? 0 : 1;
    if (!muted) await this.ctx.resume();
    const silent = this.ctx.createBufferSource();
    silent.buffer = this.ctx.createBuffer(1, 1, 22050);
    silent.connect(this.ctx.destination);
    silent.onended = () => silent.disconnect();
    silent.start();
    this.ready = true;
    this.dispatchEvent(new Event('change'));
    return true;
  }

  play(name, { gain = 1, rate = 1, pan, preview = false } = {}) {
    const c = this.ctx,
      def = this.defs[name];
    if (!def || !this.ready || this.muted || !c || c.state !== 'running' || document.hidden) return false;
    const now = performance.now();
    if (!preview && now - (this.lastPlayed.get(name) ?? -Infinity) < def.cooldown) return false;
    this.lastPlayed.set(name, now);
    if (this.volume.effects === 0) return false;
    if (preview) this.stopEffects();
    // Drop an old minor sound before a stamp/notification; never stack unlimited clicks.
    if (this.voices.size >= 8) {
      const old = [...this.voices].find((voice) => !voice.important) || this.voices.values().next().value;
      old.stop();
    }
    const amp = c.createGain(),
      panner = c.createStereoPanner?.();
    amp.gain.value = clamp(gain, 1) * def.level;
    const target = panner || amp;
    if (panner) {
      panner.pan.value = Math.max(-0.7, Math.min(0.7, pan ?? def.pan ?? 0));
      amp.connect(panner);
    }
    target.connect(this.sfxBus);
    const buffer = this.buffers.get(name);
    let source,
      timer,
      ended = false;
    const cleanup = () => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      source?.disconnect();
      amp.disconnect();
      panner?.disconnect();
      this.voices.delete(voice);
    };
    const voice = {
      important: !!def.duck,
      stop: () => {
        if (source) {
          try {
            source.stop();
          } catch {}
        }
        cleanup();
      },
    };
    this.voices.add(voice);
    if (buffer) {
      source = c.createBufferSource();
      source.buffer = buffer;
      const variation = preview ? 0 : (Math.random() * 2 - 1) * def.variation;
      source.playbackRate.value = Math.max(0.6, Math.min(1.5, rate * (1 + variation)));
      source.connect(amp);
      source.onended = cleanup;
      source.start();
    } else {
      // Live fallback still releases its gain graph; synthesis nodes clean up onended.
      def.build(c, amp, c.currentTime);
      timer = setTimeout(cleanup, (def.dur + 0.1) * 1000);
    }
    if (def.duck) {
      const t = c.currentTime,
        duck = this.duckBus.gain;
      duck.cancelScheduledValues(t);
      duck.setValueAtTime(duck.value, t);
      duck.linearRampToValueAtTime(0.62, t + 0.035);
      duck.setValueAtTime(0.62, t + def.dur * 0.65);
      duck.linearRampToValueAtTime(1, t + def.dur + 0.22);
    }
    return true;
  }

  stopEffects() {
    for (const voice of [...this.voices]) voice.stop();
  }

  setVolume(channel, value) {
    if (!Object.hasOwn(DEFAULTS, channel)) return;
    this.volume[channel] = clamp(value, DEFAULTS[channel]);
    const node = channel === 'effects' ? this.sfxBus : this.musicVolumeBus;
    node?.gain.setTargetAtTime(this.volume[channel], this.ctx.currentTime, 0.025);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(this.volume));
    } catch {}
    this.dispatchEvent(new Event('change'));
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.02);
    if (muted) {
      setTimeout(() => {
        if (this.muted) {
          this.stopEffects();
          this.ctx.suspend();
        }
      }, 180);
    } else this.ctx.resume();
    this.dispatchEvent(new Event('change'));
  }
}
