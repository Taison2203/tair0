// Each numbered note belongs to the track's scale. Time is written in eighths
// (including rests), so phrases have a dependable pulse and breathing room.
const scales = {
  minor: [62, 64, 65, 67, 69, 70, 72, 74, 76, 77],
  major: [65, 67, 69, 70, 72, 74, 76, 77, 79, 81],
};

// ID, names, BPM, accompaniment, lead, scale, main phrase, answering phrase.
const scores = [
  ['red-order','Красный приказ','Red Order',120,'march','brass','minor',
    ['Dm 1:2 1:1 0:1 3:2 5:2','Dm 8:2 5:2 3:2 1:2','Gm 4:2 4:1 0:1 6:2 4:2','A 5:2 2:2 5:2 0:2'],
    ['Bb 6:2 8:1 6:1 3:2 6:2','A 5:4 2:2 5:2']],
  ['iron-watch','Железный караул','Iron Watch',112,'march','lead','minor',
    ['Dm 5:3 3:1 1:2 3:2','Bb 3:3 6:1 8:2 6:2','Gm 4:3 6:1 8:2 6:2','A 5:4 2:2 0:2'],
    ['F 8:3 7:1 5:2 3:2','A 5:3 2:1 5:4']],
  ['alarm-at-station','Тревога на посту','Alarm at the Post',108,'signal','reed','minor',
    ['Gm 0:1 4:1 6:2 4:2 0:2','Gm 0:1 4:1 6:2 8:2 6:2','Bb 3:2 6:2 8:3 6:1','A 5:4 2:2 0:2'],
    ['Dm 8:3 5:1 3:2 5:2','A 5:3 2:1 5:4']],
  ['parade-ground','Парадный плац','Parade Ground',104,'march','brass','minor',
    ['Dm 1:3 3:1 5:2 8:2','F 7:3 5:1 3:2 5:2','Bb 6:3 8:1 6:2 3:2','A 5:4 2:2 0:2'],
    ['Gm 4:3 6:1 8:2 9:2','A 9:3 7:1 5:4']],
  ['archive-signal','Сигнал из архива','Signal from the Archive',84,'sustain','flute','minor',
    ['Dm 1:2 3:1 5:1 5:3 0:1','Bb 1:2 3:1 6:1 6:3 0:1','Gm 4:2 6:2 8:2 6:2','Dm 1:4 3:2 1:2'],
    ['F 5:2 7:1 8:1 7:3 0:1','Bb 6:2 5:1 3:1 1:4']],
  ['last-train','Последний поезд','The Last Train',72,'rail','reed','minor',
    ['Gm 8:4 6:2 4:2','Bb 6:4 3:2 6:2','Dm 5:4 3:2 1:2','A 2:4 5:2 0:2'],
    ['F 7:4 5:2 3:2','Gm 6:4 4:2 1:2']],
  ['winter-station','Зимний вокзал','Winter Station',64,'sustain','flute','minor',
    ['Gm 4:4 6:2 8:2','Bb 6:6 3:2','Dm 5:4 3:2 2:2','A 2:6 0:2'],
    ['Bb 8:4 10:2 8:2','Gm 6:4 4:4']],
  ['unanswered-letter','Письмо без ответа','Unanswered Letter',64,'sustain','flute','minor',
    ['Dm 5:4 3:2 2:2','Bb 1:6 3:2','Gm 4:4 3:2 1:2','A 2:6 0:2'],
    ['F 7:4 5:2 3:2','Dm 5:4 3:2 1:2']],
  ['empty-yard','Пустой двор','Empty Courtyard',68,'sustain','bell','minor',
    ['Dm 3:3 5:1 3:2 1:2','Bb 3:6 0:2','F 5:3 7:1 5:2 3:2','C 2:6 0:2'],
    ['Gm 6:3 8:1 6:2 4:2','Dm 3:4 1:4']],
  ['distant-window','Далёкое окно','Distant Window',72,'sustain','flute','major',
    ['Bb 4:4 6:2 5:2','F 3:4 1:2 3:2','Dm 6:4 5:2 3:2','C 2:6 0:2'],
    ['Bb 6:4 8:2 6:2','C 5:4 2:4']],
  ['after-lights-out','После отбоя','After Lights Out',72,'watch','flute','major',
    ['F 3:2 5:2 8:2 5:2','C 2:2 5:2 7:2 5:2','Dm 3:2 6:2 8:2 6:2','Bb 4:4 6:2 4:2'],
    ['Gm 2:2 4:2 9:2 6:2','F 5:4 3:4']],
  ['night-shift','Ночная смена','Night Shift',80,'watch','lead','minor',
    ['Dm 1:2 3:2 5:3 3:1','Bb 6:2 8:2 6:3 3:1','Gm 4:2 6:2 8:3 6:1','A 5:4 2:2 0:2'],
    ['F 7:2 8:2 10:2 8:2','A 9:4 5:4']],
  ['paper-route','Бумажный маршрут','Paper Route',88,'watch','lead','minor',
    ['Dm 1:2 3:2 5:2 8:2','F 7:2 5:2 3:2 5:2','Bb 6:2 8:2 10:2 8:2','A 9:4 5:2 2:2'],
    ['Gm 8:2 6:2 4:2 6:2','Dm 5:4 3:2 1:2']],
  ['morning-report','Утренняя сводка','Morning Report',96,'watch','reed','major',
    ['F 1:2 3:2 5:2 8:2','C 7:2 5:2 2:2 5:2','Bb 4:2 6:2 8:2 6:2','F 5:4 3:2 1:2'],
    ['Dm 6:2 8:2 10:2 8:2','C 7:4 5:2 2:2']],
  ['pocket-radio','Карманное радио','Pocket Radio',104,'bounce','bell','major',
    ['F 0:1 5:1 3:2 5:1 8:1 5:2','C 0:1 5:1 2:2 5:1 7:1 5:2','Bb 0:1 6:1 4:2 6:1 8:1 6:2','F 5:2 3:2 1:4'],
    ['Dm 6:2 8:1 10:1 8:2 6:2','C 7:2 9:1 7:1 5:2 2:2']],
  ['queue-dance','Танец очереди','Queue Dance',112,'bounce','reed','major',
    ['F 1:2 0:1 3:1 5:2 3:2','Bb 4:2 0:1 6:1 8:2 6:2','Gm 2:2 0:1 4:1 6:2 4:2','C 2:2 5:2 7:2 5:2'],
    ['F 8:2 0:1 10:1 8:2 5:2','C 7:2 5:2 2:4']],
  ['commandants-tea','Чай в комендатуре','Tea at the Commandant’s',116,'bounce','bell','major',
    ['F 3:1 5:1 8:2 5:1 3:1 5:2','C 2:1 5:1 7:2 5:1 2:1 5:2','Bb 4:1 6:1 8:2 6:1 4:1 6:2','F 5:2 3:2 1:4'],
    ['Dm 6:1 8:1 10:2 8:1 6:1 8:2','C 7:2 5:2 2:4']],
  ['last-stamp','Последняя печать','Last Stamp',120,'bounce','brass','major',
    ['F 1:2 3:1 5:1 8:2 5:2','Bb 4:2 6:1 8:1 6:2 4:2','Dm 6:2 8:1 10:1 8:2 6:2','C 7:2 5:2 2:2 5:2'],
    ['F 8:2 5:1 3:1 5:2 8:2','A 3:2 7:2 3:2 0:2']],
];

function readBar(source, scale) {
  const [chord, ...parts] = source.split(' ');
  let step = 0;
  const notes = [];
  for (const part of parts) {
    const [degree, eighths] = part.split(':').map(Number);
    const length = eighths * 2;
    if (degree) notes.push([step, length - .32, scale[degree - 1]]);
    step += length;
  }
  return [chord, notes];
}

function arrange([id, title, titleEn, bpm, rhythm, lead, mode, theme, reply]) {
  const scale = scales[mode];
  const first = theme.map(bar => readBar(bar, scale));
  const second = reply.map(bar => readBar(bar, scale));
  const count = bpm / 4;
  // Four-bar sentences alternate the main figure with a contrasting answer.
  // The reprise restores the signature phrase before the quieter cadence.
  const answer = [...second, first[2], first[3]];
  const extension = [first[0], first[1], ...second];
  const peakStart = count - 6;
  const outroStart = count - 2;
  const bars = Array.from({ length: count }, (_, bar) => {
    if (bar >= outroStart) {
      const [chord, notes] = first[bar === outroStart ? 2 : 3];
      if (bar === outroStart) return [chord, notes];
      const [at, , pitch] = notes[0];
      return [chord, [[at, 13 - at, pitch]]];
    }
    if (bar >= peakStart) return first[bar - peakStart];
    if (bar >= 4) {
      const phrases = [extension, answer, first, answer];
      return phrases[(Math.floor(bar / 4) - 1) % phrases.length][bar % 4];
    }
    return first[bar % 4];
  });
  return {id, title, titleEn, bpm, rhythm, lead, bars, peakStart, outroStart};
}

export const THEMES = scores.map(arrange);

export const WINTER_THEMES = [
  ['snow-over-pavlton','Снег над Павлтоном','Snow over Pavlton',76,'sustain','bell','major',
    ['F 5:2 8:1 7:1 5:2 3:2','Bb 4:3 6:1 8:2 6:2','Gm 4:2 6:2 9:3 6:1','C 7:2 5:1 4:1 2:4'],
    ['Dm 6:2 8:2 10:2 8:2','F 7:1 5:1 3:2 5:4']],
  ['last-december-shift','Последняя смена декабря','Last Shift of December',68,'rail','flute','minor',
    ['Dm 3:3 1:1 5:4','Bb 6:2 5:1 3:1 1:4','Gm 4:2 6:1 8:1 6:2 4:2','C 7:2 2:2 1:4'],
    ['F 3:1 5:1 8:4 7:2','Gm 6:2 4:1 3:1 4:4']],
  ['lights-at-the-post','Огоньки на посту','Lights at the Post',112,'bounce','reed','major',
    ['F 1:1 3:1 5:2 8:1 5:1 3:2','C 2:1 5:1 7:2 9:1 7:1 5:2','Bb 4:2 6:1 4:1 8:2 6:2','F 5:1 4:1 3:2 1:4'],
    ['Dm 6:1 8:1 10:2 8:2 6:2','C 9:2 7:1 5:1 7:2 2:2']],
].map(arrange);
