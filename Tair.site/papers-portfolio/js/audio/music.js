/**
 * «Ночная смена»: an original 16-bar chiptune in D minor, 78 BPM.
 * Two pulse voices, triangle bass and LFSR noise preserve the small-console sound.
 * A quieter opening, answering melody and turnaround make the loop less tiring.
 * Notes use the Web Audio clock; timers only fill a short lookahead window.
 */

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

// Each melody event is [sixteenth-note position, length, MIDI pitch].
// Gaps are intentional: stamps, typing and paper sounds have room to be heard.
const SCORE = [
  ['Dm', [[0, 3, 62], [4, 2, 65], [8, 3, 69], [12, 1.5, 67], [14, 1.5, 65]]],
  ['Dm', [[0, 5, 64], [8, 3, 62], [12, 2.5, 57]]],
  ['Bb', [[0, 3, 62], [4, 3, 65], [8, 5, 70], [14, 1.5, 69]]],
  ['A',  [[0, 5, 64], [8, 3, 61], [12, 2.5, 57]]],
  ['Dm', [[0, 3, 62], [4, 2, 65], [8, 3, 69], [12, 1.5, 72], [14, 1.5, 69]]],
  ['Gm', [[0, 5, 67], [8, 3, 65], [12, 2.5, 62]]],
  ['Bb', [[0, 3, 65], [4, 3, 62], [8, 3, 60], [12, 2.5, 58]]],
  ['A',  [[0, 5, 57], [8, 2, 59], [12, 2.5, 61]]],
  ['F',  [[0, 5, 69], [8, 3, 72], [12, 2.5, 69]]],
  ['C',  [[0, 3, 67], [4, 3, 64], [8, 5, 60]]],
  ['Gm', [[0, 3, 62], [4, 3, 67], [8, 3, 70], [12, 2.5, 69]]],
  ['A',  [[0, 5, 67], [8, 3, 64], [12, 2.5, 61]]],
  ['Bb', [[0, 3, 65], [4, 3, 69], [8, 3, 70], [12, 2.5, 65]]],
  ['Gm', [[0, 3, 67], [4, 3, 65], [8, 5, 62]]],
  ['Dm', [[0, 3, 65], [4, 3, 64], [8, 5, 62]]],
  ['A',  [[0, 5, 57], [8, 2, 64], [12, 2.5, 61]]],
];
const THEMES = [
  {
    id: 'parade-ground', title: 'Парадный плац', titleEn: 'Parade Ground',
    bpm: 108, rhythm: 'march', lead: 'brass', bars: [
      ['Dm', [[0, 3, 62], [3, 1, 62], [4, 3, 65], [8, 3, 69], [12, 3, 74]]],
      ['Bb', [[0, 5, 70], [6, 2, 69], [8, 3, 65], [12, 3, 62]]],
      ['Gm', [[0, 3, 67], [3, 1, 67], [4, 3, 70], [8, 3, 74], [12, 3, 72]]],
      ['A',  [[0, 5, 69], [6, 2, 67], [8, 3, 64], [12, 3, 61]]],
      ['F',  [[0, 3, 65], [3, 1, 67], [4, 3, 69], [8, 3, 72], [12, 3, 77]]],
      ['C',  [[0, 5, 76], [6, 2, 72], [8, 3, 67], [12, 3, 64]]],
      ['Bb', [[0, 3, 70], [4, 3, 69], [8, 3, 65], [12, 2, 62], [14, 2, 65]]],
      ['A',  [[0, 3, 64], [4, 3, 61], [8, 6, 57]]],
    ],
  },
  {
    id: 'archive-signal', title: 'Сигнал из архива', titleEn: 'Signal from the Archive',
    bpm: 88, rhythm: 'sparse', lead: 'reed', bars: [
      ['Gm', [[2, 2, 74], [7, 3, 70], [12, 3, 67]]],
      ['Gm', [[0, 4, 62], [9, 2, 65], [13, 2, 67]]],
      ['Bb', [[2, 2, 77], [7, 3, 74], [12, 3, 70]]],
      ['A',  [[0, 4, 69], [10, 2, 64], [14, 2, 61]]],
      ['Dm', [[2, 2, 74], [7, 3, 72], [12, 3, 69]]],
      ['C',  [[0, 4, 67], [9, 2, 64], [13, 2, 60]]],
      ['Bb', [[2, 3, 65], [8, 3, 70], [12, 3, 72]]],
      ['Gm', [[0, 5, 74], [8, 5, 67]]],
    ],
  },
  {
    id: 'after-lights-out', title: 'После отбоя', titleEn: 'After Lights Out',
    bpm: 71, rhythm: 'sparse', lead: 'flute', bars: [
      ['F',  [[0, 6, 72], [8, 3, 69], [12, 3, 65]]],
      ['C',  [[0, 4, 67], [6, 2, 64], [10, 5, 60]]],
      ['Dm', [[0, 6, 69], [8, 3, 65], [12, 3, 62]]],
      ['A',  [[0, 4, 64], [6, 2, 61], [10, 5, 57]]],
      ['Bb', [[0, 4, 65], [4, 3, 70], [8, 6, 74]]],
      ['Gm', [[0, 6, 70], [8, 3, 67], [12, 3, 62]]],
      ['Dm', [[0, 5, 65], [8, 3, 64], [12, 3, 62]]],
      ['A',  [[0, 6, 61], [8, 5, 64]]],
    ],
  },
  {
    id: 'red-order', title: 'Красный приказ', titleEn: 'Red Order',
    bpm: 126, rhythm: 'march', lead: 'brass', bars: [
      ['Dm', [[0, 2, 62], [3, 1, 62], [6, 2, 68], [8, 2, 69], [12, 2, 62]]],
      ['A',  [[0, 2, 61], [4, 1, 64], [6, 1, 61], [8, 4, 57], [14, 1, 64]]],
      ['Bb', [[0, 2, 65], [3, 1, 65], [6, 2, 71], [8, 3, 70], [12, 2, 65]]],
      ['Gm', [[0, 2, 67], [4, 2, 62], [8, 2, 58], [12, 3, 55]]],
      ['Dm', [[0, 2, 74], [3, 1, 74], [6, 2, 68], [8, 2, 69], [12, 2, 74]]],
      ['Bb', [[0, 3, 70], [4, 2, 65], [8, 3, 62], [12, 2, 58]]],
      ['Gm', [[0, 2, 67], [3, 1, 62], [6, 2, 58], [8, 3, 55], [12, 2, 62]]],
      ['A',  [[0, 2, 64], [4, 2, 61], [8, 4, 57], [14, 1, 61]]],
    ],
  },
  {
    id: 'commandants-tea', title: 'Чай в комендатуре', titleEn: 'Tea at the Commandant’s',
    bpm: 118, rhythm: 'night', lead: 'bell', bars: [
      ['F',  [[0, 2, 65], [3, 2, 69], [6, 2, 72], [10, 2, 74], [13, 2, 72]]],
      ['C',  [[0, 3, 67], [5, 2, 72], [8, 2, 76], [12, 2, 74]]],
      ['Bb', [[0, 2, 70], [3, 2, 74], [6, 2, 77], [10, 2, 74], [13, 2, 72]]],
      ['F',  [[0, 3, 69], [4, 2, 72], [8, 5, 65]]],
      ['Dm', [[0, 2, 74], [3, 2, 72], [6, 2, 69], [10, 2, 65], [13, 2, 69]]],
      ['Gm', [[0, 3, 67], [5, 2, 70], [8, 2, 74], [12, 2, 77]]],
      ['C',  [[0, 2, 76], [3, 2, 74], [6, 2, 72], [10, 2, 67], [13, 2, 64]]],
      ['F',  [[0, 3, 65], [4, 2, 69], [8, 6, 77]]],
    ],
  },
  {
    id: 'unanswered-letter', title: 'Письмо без ответа', titleEn: 'Unanswered Letter',
    bpm: 66, rhythm: 'sparse', lead: 'flute', bars: [
      ['Dm', [[0, 5, 69], [6, 3, 65], [11, 4, 64]]],
      ['Bb', [[0, 7, 62], [10, 4, 65]]],
      ['Gm', [[0, 5, 67], [6, 3, 65], [11, 4, 58]]],
      ['A',  [[0, 7, 61], [10, 3, 57]]],
      ['Dm', [[0, 6, 74], [8, 5, 69]]],
      ['F',  [[0, 4, 72], [6, 4, 69], [12, 3, 65]]],
      ['Gm', [[0, 6, 67], [8, 5, 62]]],
      ['A',  [[0, 4, 64], [6, 3, 61], [11, 4, 57]]],
    ],
  },
  {
    id: 'last-train', title: 'Последний поезд', titleEn: 'The Last Train',
    bpm: 74, rhythm: 'sparse', lead: 'reed', bars: [
      ['Gm', [[2, 7, 74], [12, 3, 67]]],
      ['Bb', [[0, 7, 77], [11, 4, 72]]],
      ['Dm', [[2, 7, 69], [12, 3, 65]]],
      ['A',  [[0, 8, 64], [12, 3, 61]]],
      ['Bb', [[2, 6, 82], [11, 4, 77]]],
      ['F',  [[0, 7, 76], [11, 4, 72]]],
      ['Gm', [[2, 7, 74], [12, 3, 70]]],
      ['A',  [[0, 8, 73], [12, 3, 69]]],
    ],
  },
  { id: 'night-shift', title: 'Ночная смена', titleEn: 'Night Shift', bpm: 78, rhythm: 'night', bars: SCORE },
];
export const MUSIC_TRACKS = THEMES.map(({ id, title, titleEn, bpm, bars }) => ({
  id, title, titleEn, bpm, duration: bars.length * 240 / bpm,
}));
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

export class Music {
  constructor(engine) {
    this.e = engine;
    this.step = 0;
    this.next = 0;
    this.timer = null;
    this.voices = new Set();
    this.resources = null;
    this.themeIndex = 0;
    this.previewState = null;
    this.onTrackEnd = null;
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
    this.next = ctx.currentTime + .08;
    this.startedAt = this.next;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + (this.onTrackEnd ? .14 : 1.4));
    this.pump();
    this.timer = setInterval(() => this.pump(), 30);
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
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
    const themeIndex = THEMES.findIndex(theme => theme.id === id);
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
      const player = new Music({ ctx: context, musicBus });
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
  }

  pump() {
    const { ctx } = this.e;
    // A suspended AudioContext freezes its clock and all scheduled notes together.
    if (!ctx || ctx.state !== 'running') return;
    if (this.onTrackEnd && this.step === THEMES[this.themeIndex].bars.length * BAR_STEPS) {
      if (ctx.currentTime >= this.next) this.onTrackEnd();
      return;
    }
    if (ctx.currentTime - this.next > .1) {
      this.step -= this.step % BAR_STEPS;
      this.next = ctx.currentTime + .08;
    }
    while (this.next < ctx.currentTime + LOOKAHEAD) {
      const theme = THEMES[this.themeIndex];
      const stepSeconds = 60 / theme.bpm / 4;
      this.playStep(this.step, this.next, theme, stepSeconds);
      this.next += stepSeconds;
      if (++this.step === theme.bars.length * BAR_STEPS) {
        if (this.onTrackEnd) return;
        this.step = 0;
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      }
    }
  }

  playStep(step, time, theme, STEP_SECONDS) {
    const bar = Math.floor(step / BAR_STEPS);
    const position = step % BAR_STEPS;
    const [chordName, melody] = theme.bars[bar];
    const chord = CHORDS[chordName];
    const answer = bar >= theme.bars.length / 2;
    const bridge = theme.rhythm === 'sparse';
    const march = theme.rhythm === 'march';

    if (position === 0) this.tone('triangle', chord.bass, time, 5.5 * STEP_SECONDS, .34);
    if (position === 8) this.tone('triangle', chord.bass + (answer ? 12 : 0), time, 4 * STEP_SECONDS, .27);
    if (position === 14) this.tone('triangle', chord.bass + 7, time, 1.4 * STEP_SECONDS, .19);

    if (position % 4 === 2) {
      const note = chord.arp[Math.floor(position / 4)];
      this.tone('harmony', note+(bridge?12:0), time, STEP_SECONDS * (bridge?2.5:1.5), bridge?.027:answer ? .044 : .034);
    }
    for (const [at, length, note] of melody) {
      if (at === position) this.tone(theme.lead || 'lead', note, time, STEP_SECONDS * length, bridge?.065:answer ? .105 : .09);
    }

    if (!bridge && (position === 0 || ((march || answer) && position === 8))) this.kick(time);
    if (!bridge && (position === 12 || ((march || bar >= 4) && position === 4))) {
      this.noise(time, .105, 'bandpass', 1700, .075);
    }
    if (answer && !bridge && position % 4 === 2) this.noise(time, .028, 'highpass', 4700, .018);
    if ((bar === 7 || bar === 15) && position === 14) this.noise(time, .07, 'bandpass', 2000, .04);
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

  kick(time) {
    const context = this.e.ctx;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(130, time);
    oscillator.frequency.exponentialRampToValueAtTime(43, time + .09);
    gain.gain.setValueAtTime(FLOOR, time);
    gain.gain.linearRampToValueAtTime(.19, time + .003);
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
