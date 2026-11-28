import { THEMES, WINTER_THEMES } from './shiftScores.js?v=winter-1';

const BAR_STEPS = 16;
const LOOKAHEAD = .16;
const LEVEL = .27;
const FLOOR = .0001;

const CHORDS = {
  Dm: { bass: 38, arp: [50, 57, 62, 57] },
  Bb: { bass: 34, arp: [53, 58, 62, 58] },
  Gm: { bass: 43, arp: [55, 58, 62, 58] },
  A:  { bass: 33, arp: [52, 57, 61, 57] },
  F:  { bass: 41, arp: [53, 57, 60, 57] },
  C:  { bass: 36, arp: [52, 55, 60, 55] },
};

export const MUSIC_TRACKS = [...THEMES, ...WINTER_THEMES].map(({ id, title, titleEn, bpm, bars }) => ({
  id, title, titleEn, bpm, duration: bars.length * 240 / bpm,
}));
const trackById = new Map(MUSIC_TRACKS.map(track => [track.id, track]));
const mtof = midi => 440 * 2 ** ((midi - 69) / 12);

function makePulse(context, duty) {
  const real = new Float32Array(48);
  const imaginary = new Float32Array(48);
  for (let harmonic = 1; harmonic < real.length; harmonic++) {
    real[harmonic] = 2 * Math.sin(harmonic * Math.PI * duty) / (harmonic * Math.PI);
  }
  return context.createPeriodicWave(real, imaginary);
}

function makeNoise(context) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .5), context.sampleRate);
  const data = buffer.getChannelData(0);
  let register = 0x7fff;
  let phase = 0;
  let sample = 1;
  for (let i = 0; i < data.length; i++) {
    phase += 12000 / context.sampleRate;
    if (phase >= 1) {
      phase -= 1;
      const feedback = (register ^ (register >> 1)) & 1;
      register = (register >> 1) | (feedback << 14);
      sample = register & 1 ? 1 : -1;
    }
    data[i] = sample;
  }
  return buffer;
}

export class Music extends EventTarget {
  constructor(engine, { themes = THEMES } = {}) {
    super();
    this.e = engine;
    this.themes = themes;
    this.step = 0;
    this.next = 0;
    this.timer = null;
    this.voices = new Set();
    this.resources = null;
    this.themeIndex = Math.floor(Math.random() * this.themes.length);
    this.previewState = null;
    this.onTrackEnd = null;
    this.soundingIndex = this.themeIndex;
    this.pendingTrack = null;
  }

  get currentTrack() { return trackById.get(this.themes[this.soundingIndex].id); }
  get nextTrack() { return trackById.get(this.themes[(this.soundingIndex + 1) % this.themes.length].id); }
  get playing() { return this.timer !== null && !this.previewState; }

  skip() {
    if (this.previewState) return;
    const playing = this.playing;
    this.stop();
    this.themeIndex = (this.soundingIndex + 1) % this.themes.length;
    this.soundingIndex = this.themeIndex;
    this.step = 0;
    if (playing) this.start();
    else this.dispatchEvent(new Event('change'));
  }

  start() {
    if (this.previewState) {
      this.previewState.resumeShift = true;
      return;
    }
    const { ctx, musicBus } = this.e;
    if (!ctx || !musicBus || this.timer !== null) return;
    if (!this.resources) {
      this.resources = {
        lead: makePulse(ctx, .25),
        brass: makePulse(ctx, .5),
        reed: makePulse(ctx, .18),
        bell: ctx.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, .12, .3, 0, .15, .08])),
        harmony: makePulse(ctx, .125),
        noise: makeNoise(ctx),
      };
    }
    // Resume on a bar line, avoiding an isolated fragment of a held melody note.
    this.step -= this.step % BAR_STEPS;
    this.soundingIndex = this.themeIndex;
    this.next = ctx.currentTime + .08;
    this.startedAt = this.next;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + (this.onTrackEnd ? .14 : .38));
    this.pump();
    this.timer = setInterval(() => this.pump(), 30);
    this.dispatchEvent(new Event('change'));
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.pendingTrack = null;
    this.dispatchEvent(new Event('change'));
    const { ctx, musicBus } = this.e;
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(0, now + .08);
    // Cancel queued notes as well as sounding voices, so unmuting cannot double them.
    for (const voice of this.voices) voice.source.stop(now + .09);
  }

  async preview(id, { onEnd } = {}) {
    const library = [...THEMES, ...WINTER_THEMES];
    const themeIndex = library.findIndex(theme => theme.id === id);
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (themeIndex < 0 || !AudioContext) return false;
    let context;
    try {
      context = new AudioContext({ latencyHint: 'interactive' });
    } catch {
      return false;
    }
    const previous = this.previewState;
    const state = {
      context,
      duration: MUSIC_TRACKS[themeIndex].duration,
      resumeShift: previous?.resumeShift ?? (this.timer !== null),
      player: null,
    };
    this.previewState = state;
    this.dispatchEvent(new Event('change'));
    if (previous) this.closePreview(previous);
    else if (this.timer !== null) {
      this.stop();
      // Mute the old scheduler's tail before the independently clocked preview.
      this.e.musicBus.gain.cancelScheduledValues(this.e.ctx.currentTime);
      this.e.musicBus.gain.setValueAtTime(0, this.e.ctx.currentTime);
    }
    try {
      // Resume directly from the play gesture, including when shift audio is muted.
      await context.resume();
      if (this.previewState !== state) return false;
      if (context.state !== 'running') throw new Error('Preview audio did not start');
      const musicBus = context.createGain();
      const volume = context.createGain();
      volume.gain.value = this.e.volume?.music || .75;
      musicBus.connect(volume).connect(context.destination);
      const player = new Music({ ctx: context, musicBus }, { themes: library });
      state.player = player;
      player.themeIndex = themeIndex;
      player.onTrackEnd = () => {
        this.stopPreview();
        onEnd?.();
      };
      player.start();
      return true;
    } catch {
      if (this.previewState === state) this.stopPreview();
      return false;
    }
  }

  get previewElapsed() {
    const state = this.previewState;
    if (!state?.player) return 0;
    return Math.max(0, Math.min(state.duration, state.context.currentTime - state.player.startedAt));
  }

  closePreview(state) {
    state.player?.stop();
    if (state.context.state !== 'closed') void state.context.close().catch(() => {});
  }

  stopPreview({ resume = true } = {}) {
    const state = this.previewState;
    if (!state) return;
    this.previewState = null;
    this.closePreview(state);
    if (resume && state.resumeShift && !this.e.muted && !globalThis.document?.hidden) this.start();
    else this.dispatchEvent(new Event('change'));
  }

  pump() {
    const { ctx } = this.e;
    // A suspended AudioContext freezes its clock and all scheduled notes together.
    if (!ctx || ctx.state !== 'running') return;
    if (this.pendingTrack && ctx.currentTime >= this.pendingTrack.time) {
      this.soundingIndex = this.pendingTrack.index;
      this.pendingTrack = null;
      this.dispatchEvent(new Event('change'));
    }
    if (this.onTrackEnd && this.step === this.themes[this.themeIndex].bars.length * BAR_STEPS) {
      if (ctx.currentTime >= this.next) this.onTrackEnd();
      return;
    }
    if (ctx.currentTime - this.next > .1) {
      this.step -= this.step % BAR_STEPS;
      this.next = ctx.currentTime + .08;
    }
    while (this.next < ctx.currentTime + LOOKAHEAD) {
      const theme = this.themes[this.themeIndex];
      if (this.step === 0 && this.themeIndex !== this.soundingIndex && !this.pendingTrack) {
        this.pendingTrack = { index: this.themeIndex, time: this.next };
      }
      const nextTheme = this.themes[(this.themeIndex + 1) % this.themes.length];
      const remaining = theme.bars.length * BAR_STEPS - this.step;
      const cross = this.onTrackEnd ? 0 : Math.max(0, 1 - remaining / 9);
      const bpm = theme.bpm + (nextTheme.bpm - theme.bpm) * cross;
      const stepSeconds = 60 / bpm / 4;
      const fadeIn = this.onTrackEnd ? 1 : Math.min(1, .72 + this.step / 28);
      this.playStep(this.step, this.next, theme, stepSeconds, fadeIn * (1 - .43 * cross));
      if (!this.onTrackEnd && remaining === 2) {
        const outgoing = CHORDS[theme.bars.at(-1)[0]];
        const incoming = CHORDS[nextTheme.bars[0][0]];
        const pivot = incoming.arp.find(note => outgoing.arp.some(old => old % 12 === note % 12));
        // A shared note rings across the bar line. If the chords have no common
        // tone, introduce the new harmony just before the next downbeat.
        this.tone('harmony', pivot ?? incoming.arp[0], this.next + stepSeconds * (pivot === undefined ? 1.5 : 0),
          stepSeconds * 6, .049);
      }
      this.next += stepSeconds;
      if (++this.step === theme.bars.length * BAR_STEPS) {
        if (this.onTrackEnd) return;
        this.step = 0;
        this.themeIndex = (this.themeIndex + 1) % this.themes.length;
      }
    }
  }

  playStep(step, time, theme, stepSeconds, level = 1) {
    const bar = Math.floor(step / BAR_STEPS);
    const position = step % BAR_STEPS;
    const ending = bar >= theme.outroStart;
    const climax = bar >= theme.peakStart && !ending;
    if (ending) level *= .74 - .14 * (bar - theme.outroStart);
    const [chordName, melody] = theme.bars[bar];
    const chord = CHORDS[chordName];
    const march = theme.rhythm === 'march';
    const bounce = theme.rhythm === 'bounce';
    const quiet = theme.rhythm === 'sustain' || theme.rhythm === 'rail';

    const note = (voice, pitch, beats, gain) => this.tone(voice, pitch, time, beats * stepSeconds, gain * level);
    this.playBacking(theme.rhythm, chord, position, note);
    if (theme.id === 'lights-at-the-post' && (position === 6 || position === 14)) {
      note('bell', chord.arp[position === 6 ? 1 : 2] + 24, 2.4, .034);
    }
    for (const [at, length, pitch] of melody) {
      if (at !== position) continue;
      const accent = at % 4 === 0 ? 1 : .8;
      note(theme.lead, pitch, length, (quiet ? .081 : .093) * accent);
      if (climax && (at === 0 || at === 8)) note('harmony', pitch - 12, Math.min(length, 4), .024);
    }

    if (!quiet && !ending) {
      if (position === 0 || ((march || bounce) && position === 8)) this.kick(time, level * (march ? .85 : .57));
      if ((march || bounce) && (position === 4 || position === 12)) {
        this.noise(time, .08, 'bandpass', 1650, .06 * level);
      }
      if (bounce && position % 4 === 2) this.noise(time, .026, 'highpass', 4200, .018 * level);
    }
  }

  playBacking(style, chord, position, note) {
    if (style === 'sustain') {
      if (position === 0) note('triangle', chord.bass, 14, .20);
      if (position === 2) note('harmony', chord.arp[1], 12, .027);
      if (position === 8) note('harmony', chord.arp[2], 6.8, .023);
      return;
    }
    if (position === 0 || position === 8) note('triangle', chord.bass + (position === 8 ? 7 : 0), 4.5, .24);
    const offbeats = style === 'bounce' || style === 'march' || style === 'rail';
    if (offbeats && (position === 4 || position === 12)) {
      note('harmony', chord.arp[0], 2.6, .032);
      note('harmony', chord.arp[1], 2.6, .025);
    } else if (!offbeats && (position === 6 || position === 14)) {
      note('harmony', chord.arp[position === 6 ? 1 : 2], 1.8, .032);
    }
  }

  connectVoice(source, nodes) {
    const voice = { source, nodes };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      for (const node of nodes) node.disconnect();
      this.voices.delete(voice);
    };
  }

  tone(type, midi, time, duration, level) {
    const context = this.e.ctx;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const melody = type !== 'triangle' && type !== 'harmony';
    if (type === 'flute') oscillator.type = 'sine';
    else if (type === 'triangle') oscillator.type = 'triangle';
    else oscillator.setPeriodicWave(this.resources[type]);
    oscillator.frequency.setValueAtTime(mtof(midi), time);
    filter.type = 'lowpass';
    filter.frequency.value = melody ? 2600 : type === 'harmony' ? 1800 : 1400;
    filter.Q.value = .45;
    // Tiny stepped vibrato only on held lead notes; no detuned chorus or reverb.
    if (melody && type !== 'bell' && duration > .45) {
      for (let at = .24, i = 0; at < duration - .1; at += .09, i++) {
        oscillator.detune.setValueAtTime(i % 2 ? -5 : 5, time + at);
      }
    }
    const release = Math.min(.09, duration * .3);
    gain.gain.setValueAtTime(FLOOR, time);
    gain.gain.linearRampToValueAtTime(level, time + .006);
    gain.gain.setValueAtTime(level * .78, time + duration - release);
    gain.gain.exponentialRampToValueAtTime(FLOOR, time + duration);
    oscillator.connect(filter).connect(gain).connect(this.e.musicBus);
    this.connectVoice(oscillator, [filter, gain]);
    oscillator.start(time);
    oscillator.stop(time + duration + .012);
  }

  kick(time, level = 1) {
    const context = this.e.ctx;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(130, time);
    oscillator.frequency.exponentialRampToValueAtTime(43, time + .09);
    gain.gain.setValueAtTime(FLOOR, time);
    gain.gain.linearRampToValueAtTime(.19 * level, time + .003);
    gain.gain.exponentialRampToValueAtTime(FLOOR, time + .13);
    oscillator.connect(gain).connect(this.e.musicBus);
    this.connectVoice(oscillator, [gain]);
    oscillator.start(time);
    oscillator.stop(time + .15);
  }

  noise(time, duration, type, frequency, level) {
    const context = this.e.ctx;
    const source = context.createBufferSource();
    source.buffer = this.resources.noise;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = .65;
    const gain = context.createGain();
    gain.gain.setValueAtTime(FLOOR, time);
    gain.gain.linearRampToValueAtTime(level, time + .002);
    gain.gain.exponentialRampToValueAtTime(FLOOR, time + duration);
    source.connect(filter).connect(gain).connect(this.e.musicBus);
    this.connectVoice(source, [filter, gain]);
    source.start(time);
    source.stop(time + duration + .01);
  }
}
