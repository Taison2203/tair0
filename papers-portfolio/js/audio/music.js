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
const originalThemes = [
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
    bpm: 88, rhythm: 'sparse', lead: 'reed', backing: 'radio', bars: [
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
    bpm: 66, rhythm: 'sparse', lead: 'flute', backing: 'letter', bars: [
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
    bpm: 74, rhythm: 'sparse', lead: 'reed', backing: 'rail', bars: [
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

// Written phrases use one note per beat, with 0 marking a deliberate rest.
const newThemes = [
  ['iron-watch', 'Железный караул', 'Iron Watch', 124, 'march', 'brass', [
    ['Dm', 62, 69, 68, 62], ['A', 61, 64, 69, 57], ['Bb', 58, 65, 70, 71], ['Gm', 67, 62, 58, 55],
    ['Dm', 74, 72, 69, 65], ['C', 67, 60, 64, 67], ['Bb', 70, 65, 62, 58], ['A', 64, 61, 57, 61],
  ]],
  ['alarm-at-station', 'Тревога на посту', 'Alarm at the Post', 112, 'march', 'reed', [
    ['Gm', 79, 0, 74, 77], ['Gm', 79, 74, 70, 67], ['Bb', 77, 0, 74, 70], ['A', 76, 73, 69, 0],
    ['Dm', 77, 74, 69, 72], ['C', 76, 72, 67, 64], ['Gm', 67, 70, 74, 0], ['A', 73, 69, 64, 61],
  ]],
  ['winter-station', 'Зимний вокзал', 'Winter Station', 64, 'sparse', 'flute', [
    ['Gm', 74, 0, 70, 67], ['Bb', 65, 0, 70, 0], ['Dm', 69, 65, 64, 0], ['A', 61, 0, 64, 57],
    ['Gm', 67, 74, 77, 74], ['Bb', 70, 65, 0, 62], ['A', 64, 61, 57, 0], ['Dm', 62, 0, 0, 0],
  ]],
  ['empty-yard', 'Пустой двор', 'Empty Courtyard', 69, 'sparse', 'bell', [
    ['Dm', 69, 65, 0, 62], ['Bb', 65, 0, 70, 69], ['F', 72, 69, 65, 0], ['C', 67, 64, 60, 0],
    ['Gm', 74, 70, 67, 0], ['Bb', 77, 74, 70, 65], ['A', 64, 67, 61, 0], ['Dm', 62, 0, 65, 0],
  ]],
  ['distant-window', 'Далёкое окно', 'Distant Window', 73, 'sparse', 'flute', [
    ['Bb', 70, 74, 0, 72], ['F', 69, 65, 69, 0], ['Dm', 74, 72, 69, 65], ['A', 64, 61, 0, 57],
    ['Gm', 67, 74, 79, 77], ['Bb', 74, 70, 65, 0], ['F', 69, 65, 72, 69], ['C', 67, 64, 60, 0],
  ]],
  ['paper-route', 'Бумажный маршрут', 'Paper Route', 86, 'night', 'lead', [
    ['Dm', 62, 65, 69, 65], ['F', 72, 69, 0, 65], ['Bb', 70, 74, 72, 70], ['C', 67, 64, 67, 0],
    ['Dm', 69, 65, 64, 62], ['Gm', 67, 70, 74, 70], ['A', 69, 73, 76, 73], ['Dm', 74, 69, 65, 62],
  ]],
  ['morning-report', 'Утренняя сводка', 'Morning Report', 94, 'night', 'reed', [
    ['F', 65, 69, 72, 0], ['C', 67, 72, 76, 74], ['Dm', 69, 65, 62, 0], ['Bb', 65, 70, 74, 72],
    ['F', 77, 76, 72, 69], ['Gm', 70, 67, 74, 0], ['C', 76, 74, 72, 67], ['F', 69, 65, 72, 0],
  ]],
  ['pocket-radio', 'Карманное радио', 'Pocket Radio', 103, 'night', 'bell', [
    ['C', 72, 76, 79, 76], ['F', 77, 72, 69, 72], ['Dm', 74, 77, 81, 77], ['Gm', 79, 74, 70, 74],
    ['Bb', 82, 77, 74, 77], ['F', 81, 77, 72, 69], ['C', 76, 79, 81, 76], ['F', 77, 72, 69, 65],
  ]],
  ['queue-dance', 'Танец очереди', 'Queue Dance', 116, 'night', 'brass', [
    ['F', 65, 72, 69, 74], ['Bb', 70, 77, 74, 72], ['Gm', 67, 74, 70, 77], ['C', 76, 72, 67, 64],
    ['F', 77, 81, 79, 77], ['Dm', 74, 69, 77, 74], ['C', 72, 76, 79, 76], ['F', 77, 72, 69, 77],
  ]],
  ['last-stamp', 'Последняя печать', 'Last Stamp', 121, 'night', 'bell', [
    ['F', 77, 69, 72, 77], ['C', 76, 67, 72, 76], ['Bb', 74, 70, 77, 74], ['F', 72, 69, 65, 0],
    ['Bb', 70, 74, 77, 82], ['Gm', 79, 74, 70, 67], ['A', 76, 73, 69, 73], ['Dm', 74, 69, 65, 62],
  ]],
].map(([id, title, titleEn, bpm, rhythm, lead, phrases]) => ({
  id, title, titleEn, bpm, rhythm, lead,
  bars: phrases.map(([chord, ...notes], bar) => [
    chord, notes.flatMap((note, beat) => note ? [[beat * 4, bar % 4 === 3 && beat === 3 ? 3.5 : rhythm === 'march' ? 1.8 : 3.2, note]] : []),
  ]),
}));

const themeById = new Map([...originalThemes, ...newThemes].map(theme => [theme.id, theme]));
// Each response is a new phrase written for its theme. The original melody
// remains the main statement, so the development has something to return to.
const responses = {
  'red-order': [['Gm', 55, 67, 70, 73], ['Bb', 70, 65, 58, 65], ['Dm', 74, 69, 68, 62], ['A', 64, 61, 57, 61]],
  'iron-watch': [['Bb', 58, 70, 77, 76], ['C', 72, 67, 64, 67], ['Gm', 79, 74, 70, 67], ['A', 76, 73, 69, 64]],
  'alarm-at-station': [['Dm', 77, 0, 81, 77], ['Bb', 82, 77, 0, 74], ['Gm', 79, 77, 74, 70], ['A', 76, 73, 0, 69]],
  'parade-ground': [['Bb', 74, 70, 77, 74], ['F', 72, 69, 77, 81], ['Gm', 82, 79, 74, 70], ['A', 76, 73, 69, 64]],
  'archive-signal': [['Dm', 0, 77, 76, 69], ['Bb', 74, 0, 70, 65], ['Gm', 0, 79, 74, 70], ['A', 76, 0, 73, 69]],
  'last-train': [['F', 81, 77, 0, 72], ['C', 79, 76, 72, 0], ['Bb', 82, 77, 74, 70], ['A', 76, 73, 69, 0]],
  'winter-station': [['Bb', 77, 74, 0, 70], ['Dm', 76, 69, 65, 0], ['Gm', 79, 0, 74, 70], ['A', 73, 69, 0, 64]],
  'unanswered-letter': [['F', 77, 76, 0, 72], ['C', 76, 72, 67, 0], ['Gm', 79, 77, 74, 70], ['A', 73, 69, 64, 0]],
  'empty-yard': [['F', 69, 72, 77, 0], ['Bb', 74, 77, 82, 77], ['Gm', 79, 74, 70, 0], ['A', 76, 73, 0, 69]],
  'distant-window': [['F', 72, 77, 0, 81], ['Dm', 81, 77, 74, 69], ['Bb', 82, 77, 74, 0], ['C', 79, 76, 72, 0]],
  'after-lights-out': [['Bb', 74, 77, 0, 74], ['F', 72, 69, 72, 0], ['Gm', 79, 74, 70, 67], ['A', 76, 73, 69, 0]],
  'night-shift': [['Bb', 70, 74, 77, 74], ['C', 76, 72, 67, 0], ['Gm', 79, 74, 70, 67], ['A', 76, 73, 69, 64]],
  'paper-route': [['Bb', 70, 77, 74, 77], ['F', 81, 77, 72, 69], ['Gm', 79, 74, 77, 70], ['A', 76, 73, 69, 73]],
  'morning-report': [['Bb', 74, 77, 82, 81], ['F', 77, 72, 69, 72], ['Gm', 79, 74, 70, 74], ['C', 76, 79, 76, 72]],
  'pocket-radio': [['Bb', 82, 86, 89, 86], ['F', 84, 81, 77, 81], ['Dm', 86, 84, 81, 77], ['C', 79, 84, 88, 84]],
  'queue-dance': [['Bb', 77, 82, 86, 82], ['Gm', 79, 86, 82, 79], ['F', 81, 77, 84, 81], ['C', 79, 84, 86, 88]],
  'commandants-tea': [['Bb', 74, 77, 82, 84], ['Dm', 81, 77, 74, 77], ['Gm', 79, 82, 86, 82], ['C', 84, 79, 76, 72]],
  'last-stamp': [['Bb', 82, 86, 89, 86], ['C', 84, 79, 88, 84], ['Dm', 86, 81, 77, 81], ['A', 85, 81, 76, 73]],
};

function arrange(theme) {
  const barCount = Math.round(theme.bpm / 4);
  const score = theme.bars;
  const sparse = theme.rhythm === 'sparse';
  const introCount = barCount >= 24 ? 4 : 2;
  const outroCount = barCount >= 24 ? 3 : 2;
  const statement = score.slice(0, 8);
  const answer = responses[theme.id].map(([chord, ...pitches]) => [
    chord, pitches.flatMap((pitch, i) => pitch
      ? [[(sparse ? [0, 5, 9, 12] : [0, 3, 8, 12])[i], sparse ? [4, 3.4, 2.4, 3][i] : [2.4, 3.3, 2.6, 2.5][i], pitch]]
      : []),
  ]);
  const excerpt = (bar, count) => [bar[0], bar[1].slice(0, count)];
  const intro = Array.from({ length: introCount }, (_, i) =>
    excerpt(statement[i], i === 0 ? 1 : 2));
  const developmentCount = Math.floor((barCount - introCount - outroCount - statement.length) / 2);
  const development = Array.from({ length: developmentCount }, (_, i) =>
    i < answer.length ? answer[i] : score[(i + 2) % score.length]);
  const peakCount = barCount - introCount - statement.length - development.length - outroCount;
  const peakSource = score.length > 8 ? [...score.slice(8), ...answer] : [...answer.slice(2), ...statement, ...answer];
  const peak = Array.from({ length: peakCount }, (_, i) => peakSource[i % peakSource.length]);
  const outro = Array.from({ length: outroCount }, (_, i) =>
    excerpt(i === outroCount - 1 ? score.at(-1) : statement.at(-outroCount + i + 1), outroCount - i));
  return {
    ...theme, bpm: barCount * 4,
    bars: [...intro, ...statement, ...development, ...peak, ...outro],
    introCount, peakStart: intro.length + statement.length + development.length,
    outroStart: barCount - outroCount,
  };
}

// Intensity eases into grief, steadies into a shift, then brightens. The final
// tune returns to D minor and leads back into the opening march.
const THEMES = [
  'red-order', 'iron-watch', 'alarm-at-station', 'parade-ground', 'archive-signal',
  'last-train', 'winter-station', 'unanswered-letter', 'empty-yard', 'distant-window',
  'after-lights-out', 'night-shift', 'paper-route', 'morning-report',
  'pocket-radio', 'queue-dance', 'commandants-tea', 'last-stamp',
].map(id => arrange(themeById.get(id)));
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
    this.themeIndex = Math.floor(Math.random() * THEMES.length);
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
      const nextTheme = THEMES[(this.themeIndex + 1) % THEMES.length];
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
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      }
    }
  }

  playStep(step, time, theme, stepSeconds, level = 1) {
    const bar = Math.floor(step / BAR_STEPS);
    const position = step % BAR_STEPS;
    const opening = bar < theme.introCount;
    const ending = bar >= theme.outroStart;
    const climax = bar >= theme.peakStart && !ending;
    if (opening) level *= .60 + .32 * bar / theme.introCount;
    if (climax) level *= 1.12;
    if (ending) level *= .78 - .16 * (bar - theme.outroStart);
    const [chordName, melody] = theme.bars[bar];
    const chord = CHORDS[chordName];
    const answer = bar >= theme.bars.length / 2;
    const bridge = theme.rhythm === 'sparse';
    const march = theme.rhythm === 'march';

    const note = (voice, pitch, beats, gain) => this.tone(voice, pitch, time, beats * stepSeconds, gain * level);
    if (theme.backing) {
      this.playBacking(theme.backing, chord, position, note);
    } else {
      if (position === 0) note('triangle', chord.bass, 5.5, .34);
      if (position === 8) note('triangle', chord.bass + (answer ? 12 : 0), 4, .27);
      if (position === 14) note('triangle', chord.bass + 7, 1.4, .19);
      if (position % 4 === 2) {
        note('harmony', chord.arp[Math.floor(position / 4)] + (bridge ? 12 : 0),
          bridge ? 2.5 : 1.5, bridge ? .027 : answer ? .044 : .034);
      }
    }
    for (const [at, length, pitch] of melody) {
      if (at === position) note(theme.lead || 'lead', pitch, length, bridge ? .065 : answer ? .105 : .09);
    }
    if (climax && position === 11) {
      note('harmony', chord.arp[1] + 12, 2.8, bridge ? .018 : .03);
    }

    const drums = !bridge && !ending && (!opening || bar === theme.introCount - 1);
    if (drums && (position === 0 || ((march || answer) && position === 8))) this.kick(time, level);
    if (drums && (position === 12 || ((march || bar >= 4) && position === 4))) {
      this.noise(time, .105, 'bandpass', 1700, .075 * level);
    }
    if (drums && answer && position % 4 === 2) this.noise(time, .028, 'highpass', 4700, .018 * level);
    if (drums && (bar === theme.peakStart - 1 || bar === theme.outroStart - 1) && position === 14) {
      this.noise(time, .07, 'bandpass', 2000, .04 * level);
    }
  }

  playBacking(style, chord, position, note) {
    if (style === 'radio') {
      if (position === 0 || position === 10) note('triangle', chord.bass + 12, 2.5, .21);
      if (position === 5 || position === 13) note('harmony', chord.arp[position === 5 ? 1 : 2], 1.4, .038);
    } else if (style === 'letter') {
      if (position === 0) note('triangle', chord.bass, 12.5, .22);
      if (position === 3) note('harmony', chord.arp[1], 7, .025);
      if (position === 9) note('harmony', chord.arp[2], 5.5, .029);
    } else {
      if (position === 0 || position === 8) note('triangle', chord.bass, 3.5, .23);
      if (position === 3 || position === 11) note('triangle', chord.bass + 7, 2.5, .12);
      if (position === 6 || position === 14) note('harmony', chord.arp[2], 3.5, .029);
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
