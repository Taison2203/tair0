/**
 * «Ночная смена»: an original 16-bar chiptune in D minor, 78 BPM.
 * Two pulse voices, triangle bass and LFSR noise preserve the small-console sound.
 * A quieter opening, answering melody and turnaround make the loop less tiring.
 * Notes use the Web Audio clock; timers only fill a short lookahead window.
 */

const BPM = 78;
const STEP_SECONDS = 60 / BPM / 4;
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
const TOTAL_STEPS = SCORE.length * BAR_STEPS;
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
  }

  start() {
    const { ctx, musicBus } = this.e;
    if (!ctx || !musicBus || this.timer !== null) return;
    if (!this.resources) {
      this.resources = {
        lead: makePulse(ctx, .25),
        harmony: makePulse(ctx, .125),
        noise: makeNoise(ctx),
      };
    }
    // Resume on a bar line, avoiding an isolated fragment of a held melody note.
    this.step -= this.step % BAR_STEPS;
    this.next = ctx.currentTime + .08;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(LEVEL, ctx.currentTime + 1.4);
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

  pump() {
    const { ctx } = this.e;
    // A suspended AudioContext freezes its clock and all scheduled notes together.
    if (!ctx || ctx.state !== 'running') return;
    if (ctx.currentTime - this.next > .1) {
      this.step -= this.step % BAR_STEPS;
      this.next = ctx.currentTime + .08;
    }
    while (this.next < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.next);
      this.next += STEP_SECONDS;
      this.step = (this.step + 1) % TOTAL_STEPS;
    }
  }

  playStep(step, time) {
    const bar = Math.floor(step / BAR_STEPS);
    const position = step % BAR_STEPS;
    const [chordName, melody] = SCORE[bar];
    const chord = CHORDS[chordName];
    const answer = bar >= 8;

    if (position === 0) this.tone('triangle', chord.bass, time, 5.5 * STEP_SECONDS, .34);
    if (position === 8) this.tone('triangle', chord.bass + (answer ? 12 : 0), time, 4 * STEP_SECONDS, .27);
    if (position === 14) this.tone('triangle', chord.bass + 7, time, 1.4 * STEP_SECONDS, .19);

    if (position % 4 === 2) {
      const note = chord.arp[Math.floor(position / 4)];
      this.tone('harmony', note, time, STEP_SECONDS * 1.5, answer ? .044 : .034);
    }
    for (const [at, length, note] of melody) {
      if (at === position) this.tone('lead', note, time, STEP_SECONDS * length, answer ? .105 : .09);
    }

    if (position === 0 || (answer && position === 8)) this.kick(time);
    if (position === 12 || (bar >= 4 && position === 4)) {
      this.noise(time, .105, 'bandpass', 1700, .075);
    }
    if (answer && position % 4 === 2) this.noise(time, .028, 'highpass', 4700, .025);
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
    if (type === 'triangle') oscillator.type = 'triangle';
    else oscillator.setPeriodicWave(this.resources[type]);
    oscillator.frequency.setValueAtTime(mtof(midi), time);
    filter.type = 'lowpass';
    filter.frequency.value = type === 'lead' ? 2600 : type === 'harmony' ? 1800 : 1400;
    filter.Q.value = .45;
    // Tiny stepped vibrato only on held lead notes; no detuned chorus or reverb.
    if (type === 'lead' && duration > .45) {
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
