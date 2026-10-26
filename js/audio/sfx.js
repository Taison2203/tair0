/** Original 8-bit checkpoint foley. All sounds are synthesized locally. */
const FLOOR = 0.00001;
function tone(c, out, t, f, dur = 0.1, type = 'triangle', peak = 0.3, end = f) {
  const s = c.createOscillator(),
    filter = c.createBiquadFilter(),
    a = c.createGain();
  s.type = type;
  s.frequency.setValueAtTime(f, t);
  s.frequency.exponentialRampToValueAtTime(end, t + dur);
  filter.type = 'lowpass';
  filter.frequency.value = 3100;
  filter.Q.value = 0.5;
  a.gain.setValueAtTime(FLOOR, t);
  a.gain.linearRampToValueAtTime(peak, t + Math.min(0.004, dur / 5));
  a.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  s.connect(filter).connect(a).connect(out);
  s.onended = () => {
    s.disconnect();
    filter.disconnect();
    a.disconnect();
  };
  s.start(t);
  s.stop(t + dur + 0.008);
}
function rustle(c, out, t, dur, f = 1200, end = f, peak = 0.35, clock = 11025) {
  const s = c.createBufferSource(),
    b = c.createBuffer(1, Math.ceil((dur + 0.02) * c.sampleRate), c.sampleRate);
  const samples = b.getChannelData(0);
  let register = 1 + Math.floor(Math.random() * 32766),
    last = -1,
    value = 0;
  // Clocked 15-bit LFSR gives paper and machinery a restrained console texture.
  for (let i = 0; i < samples.length; i++) {
    const step = Math.floor((i * clock) / c.sampleRate);
    if (step !== last) {
      register = (register >> 1) | (((register ^ (register >> 1)) & 1) << 14);
      value = register & 1 ? 0.75 : -0.75;
      last = step;
    }
    samples[i] = value;
  }
  s.buffer = b;
  const filter = c.createBiquadFilter(),
    a = c.createGain();
  filter.type = 'bandpass';
  filter.Q.value = 0.65;
  filter.frequency.setValueAtTime(f, t);
  filter.frequency.exponentialRampToValueAtTime(end, t + dur);
  a.gain.setValueAtTime(FLOOR, t);
  a.gain.linearRampToValueAtTime(peak, t + Math.min(0.009, dur / 4));
  a.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  s.connect(filter).connect(a).connect(out);
  s.onended = () => {
    s.disconnect();
    filter.disconnect();
    a.disconnect();
  };
  s.start(t);
  s.stop(t + dur + 0.012);
}
function knock(c, d, t, f = 155, strength = 0.6) {
  tone(c, d, t, f, 0.14, 'triangle', strength, 65);
  rustle(c, d, t, 0.045, 1800, 700, strength * 0.45);
}
function paper(c, d, t, speed = 1, weight = 1) {
  rustle(c, d, t, 0.14 / speed, 650, 2400, 0.32 * weight);
  rustle(c, d, t + 0.07 / speed, 0.15 / speed, 2100, 700, 0.23 * weight);
}
function notes(c, d, t, frequencies, step = 0.09, type = 'square', peak = 0.19) {
  frequencies.forEach((f, i) => tone(c, d, t + i * step, f, step * 1.8, type, peak));
}
function relay(c, d, t, rising) {
  knock(c, d, t, rising ? 450 : 300, 0.2);
  tone(c, d, t + 0.025, rising ? 160 : 240, 0.16, 'triangle', 0.14, rising ? 320 : 80);
}
const def = (group, label, dur, level, build, extra = {}) => ({
  group,
  label,
  dur,
  level,
  build,
  cooldown: 90,
  variation: 0.018,
  ...extra,
});
export const SFX = {
  hover: def(
    'УПРАВЛЕНИЕ',
    'Наведение',
    0.07,
    0.09,
    (c, d, t) => tone(c, d, t, 790, 0.025, 'square', 0.15, 690),
    { cooldown: 85 },
  ),
  tick: def('УПРАВЛЕНИЕ', 'Переключатель', 0.17, 0.24, (c, d, t) => {
    tone(c, d, t, 620, 0.035, 'square', 0.22, 430);
    knock(c, d, t, 230, 0.15);
  }),
  key: def(
    'УПРАВЛЕНИЕ',
    'Клавиша машинки',
    0.09,
    0.22,
    (c, d, t) => {
      rustle(c, d, t, 0.022, 1700, 1200, 0.32);
      tone(c, d, t, 220, 0.04, 'triangle', 0.2, 140);
    },
    { cooldown: 42, variation: 0.07 },
  ),
  backspace: def('УПРАВЛЕНИЕ', 'Возврат каретки', 0.22, 0.24, (c, d, t) => {
    tone(c, d, t, 480, 0.09, 'square', 0.15, 240);
    knock(c, d, t + 0.055, 250, 0.23);
  }),
  zoom: def('УПРАВЛЕНИЕ', 'Лупа', 0.19, 0.25, (c, d, t) => {
    tone(c, d, t, 350, 0.12, 'triangle', 0.3, 700);
    rustle(c, d, t, 0.045, 1200, 1800, 0.14);
  }),
  soundOn: def('УПРАВЛЕНИЕ', 'Звук включён', 0.32, 0.32, (c, d, t) => notes(c, d, t, [294, 440, 587], 0.065)),
  soundOff: def('УПРАВЛЕНИЕ', 'Звук выключен', 0.22, 0.3, (c, d, t) => notes(c, d, t, [440, 294], 0.05)),
  page: def('БУМАГИ', 'Перелистывание', 0.45, 0.46, (c, d, t) => {
    paper(c, d, t, 0.8);
    knock(c, d, t + 0.25, 180, 0.17);
  }),
  paper: def('БУМАГИ', 'Лист бумаги', 0.27, 0.34, (c, d, t) => paper(c, d, t)),
  documentOpen: def('БУМАГИ', 'Открыть документ', 0.38, 0.46, (c, d, t) => {
    paper(c, d, t, 0.85);
    rustle(c, d, t + 0.15, 0.13, 900, 1700, 0.18);
  }),
  documentClose: def('БУМАГИ', 'Вернуть документ', 0.39, 0.42, (c, d, t) => {
    paper(c, d, t, 1.3);
    knock(c, d, t + 0.2, 180, 0.27);
  }),
  passportOpen: def('БУМАГИ', 'Обложка паспорта', 0.52, 0.5, (c, d, t) => {
    knock(c, d, t, 120, 0.4);
    paper(c, d, t + 0.07, 0.8, 0.85);
    knock(c, d, t + 0.32, 220, 0.18);
  }),
  fileOpen: def('БУМАГИ', 'Папка с делами', 0.55, 0.48, (c, d, t) => {
    rustle(c, d, t, 0.12, 550, 900, 0.36);
    paper(c, d, t + 0.12, 0.8);
    knock(c, d, t + 0.35, 140, 0.3);
  }),
  documentSet: def('БУМАГИ', 'Документ на столе', 0.2, 0.35, (c, d, t) => {
    knock(c, d, t, 120, 0.4);
    rustle(c, d, t, 0.09, 650, 1300, 0.16);
  }),
  noteUnfold: def('БУМАГИ', 'Развернуть записку', 0.47, 0.39, (c, d, t) => {
    paper(c, d, t, 1.2);
    paper(c, d, t + 0.17, 1.1, 0.7);
  }),
  noteFold: def('БУМАГИ', 'Сложить записку', 0.37, 0.37, (c, d, t) => {
    rustle(c, d, t, 0.17, 2200, 600, 0.4);
    knock(c, d, t + 0.17, 260, 0.17);
  }),
  fileFiled: def('БУМАГИ', 'Бланк в архив', 0.74, 0.48, (c, d, t) => {
    rustle(c, d, t, 0.4, 700, 1800, 0.33);
    rustle(c, d, t + 0.22, 0.27, 1500, 450, 0.3);
    knock(c, d, t + 0.5, 100, 0.45);
  }),
  albumOpen: def('ФОТОАРХИВ', 'Открыть фотоальбом', 0.52, 0.46, (c, d, t) => {
    knock(c, d, t, 105, 0.4);
    paper(c, d, t + 0.08, 0.7);
    tone(c, d, t + 0.3, 440, 0.12, 'triangle', 0.1);
  }),
  photoPick: def('ФОТОАРХИВ', 'Достать фотографию', 0.32, 0.34, (c, d, t) => {
    rustle(c, d, t, 0.18, 1450, 2600, 0.28);
    knock(c, d, t + 0.13, 310, 0.18);
  }),
  photoSlide: def('ФОТОАРХИВ', 'Следующий снимок', 0.3, 0.32, (c, d, t) => {
    rustle(c, d, t, 0.21, 2300, 900, 0.27);
    rustle(c, d, t + 0.14, 0.07, 1000, 1700, 0.12);
  }),
  receiptPrint: def('МЕХАНИЗМЫ', 'Печать предписания', 0.61, 0.38, (c, d, t) => {
    for (let i = 0; i < 5; i++) {
      rustle(c, d, t + i * 0.065, 0.04, 1500, 1000, 0.21);
      tone(c, d, t + i * 0.065, 180 + i * 12, 0.05, 'square', 0.09);
    }
    rustle(c, d, t + 0.31, 0.23, 800, 1600, 0.27);
  }),
  receiptTear: def('МЕХАНИЗМЫ', 'Отрыв талона', 0.4, 0.4, (c, d, t) => {
    for (let i = 0; i < 5; i++) rustle(c, d, t + i * 0.035, 0.07, 1100 + i * 260, 1700, 0.27);
    knock(c, d, t + 0.2, 220, 0.17);
  }),
  ding: def('МЕХАНИЗМЫ', 'Звонок машинки', 0.64, 0.36, (c, d, t) => {
    tone(c, d, t, 1175, 0.49, 'triangle', 0.3);
    tone(c, d, t, 1762, 0.29, 'sine', 0.12);
  }),
  lampOn: def('МЕХАНИЗМЫ', 'Включить лампу', 0.28, 0.32, (c, d, t) => relay(c, d, t, true), { pan: 0.55 }),
  lampOff: def('МЕХАНИЗМЫ', 'Выключить лампу', 0.25, 0.3, (c, d, t) => relay(c, d, t, false), { pan: 0.55 }),
  lampFlicker: def(
    'МЕХАНИЗМЫ',
    'Контакт лампы',
    0.26,
    0.1,
    (c, d, t) => {
      rustle(c, d, t, 0.025, 850, 600, 0.2, 6000);
      rustle(c, d, t + 0.16, 0.035, 700, 1000, 0.13, 6000);
    },
    { cooldown: 1000, pan: 0.55 },
  ),
  scannerOn: def('МЕХАНИЗМЫ', 'Запуск сверки', 0.61, 0.39, (c, d, t) => {
    relay(c, d, t, true);
    tone(c, d, t + 0.1, 140, 0.25, 'square', 0.12, 280);
    notes(c, d, t + 0.3, [587, 880], 0.065, 'triangle');
  }),
  paperFeed: def('МЕХАНИЗМЫ', 'Подача документов', 0.57, 0.43, (c, d, t) => {
    tone(c, d, t, 90, 0.3, 'square', 0.13, 135);
    paper(c, d, t + 0.12, 0.85);
    knock(c, d, t + 0.38, 180, 0.22);
  }),
  compare: def('МЕХАНИЗМЫ', 'Сверить строки', 0.27, 0.3, (c, d, t) => {
    tone(c, d, t, 440, 0.08, 'square', 0.2);
    tone(c, d, t + 0.09, 660, 0.12, 'triangle', 0.24);
  }),
  stamp: def(
    'СИГНАЛЫ',
    'Удар печати',
    0.4,
    0.65,
    (c, d, t) => {
      rustle(c, d, t, 0.05, 1900, 900, 0.22);
      knock(c, d, t + 0.055, 145, 0.72);
      knock(c, d, t + 0.19, 210, 0.18);
    },
    { duck: true, cooldown: 250 },
  ),
  approve: def(
    'СИГНАЛЫ',
    'Одобрено',
    0.65,
    0.59,
    (c, d, t) => {
      knock(c, d, t + 0.045, 140, 0.65);
      notes(c, d, t + 0.18, [440, 554, 659], 0.09, 'square', 0.16);
    },
    { duck: true, cooldown: 300 },
  ),
  deny: def(
    'СИГНАЛЫ',
    'Отказано',
    0.54,
    0.53,
    (c, d, t) => {
      knock(c, d, t + 0.035, 125, 0.65);
      notes(c, d, t + 0.17, [330, 262, 220], 0.075, 'square', 0.14);
    },
    { duck: true, cooldown: 300 },
  ),
  buzzer: def(
    'СИГНАЛЫ',
    'Ошибка в бланке',
    0.33,
    0.36,
    (c, d, t) => {
      tone(c, d, t, 147, 0.15, 'square', 0.23);
      tone(c, d, t + 0.13, 139, 0.14, 'square', 0.2);
    },
    { cooldown: 350 },
  ),
  warning: def(
    'СИГНАЛЫ',
    'Предупреждение поста',
    0.47,
    0.39,
    (c, d, t) => notes(c, d, t, [440, 349, 440], 0.1, 'triangle', 0.28),
    { duck: true, cooldown: 600 },
  ),
  shiftStart: def(
    'СИГНАЛЫ',
    'Начало смены',
    0.92,
    0.46,
    (c, d, t) => {
      knock(c, d, t, 180, 0.25);
      notes(c, d, t + 0.12, [294, 349, 440, 587], 0.13, 'square', 0.17);
    },
    { duck: true, variation: 0 },
  ),
  shiftComplete: def(
    'СИГНАЛЫ',
    'Смена завершена',
    1.08,
    0.48,
    (c, d, t) => {
      notes(c, d, t, [294, 440, 587, 698, 880], 0.135, 'square', 0.17);
      tone(c, d, t + 0.55, 294, 0.4, 'triangle', 0.2);
    },
    { duck: true, variation: 0 },
  ),
  linkVerified: def(
    'СИГНАЛЫ',
    'Контакт подтверждён',
    0.67,
    0.4,
    (c, d, t) => {
      notes(c, d, t, [440, 587, 880], 0.12, 'triangle', 0.3);
      tone(c, d, t + 0.28, 294, 0.28, 'triangle', 0.15);
    },
    { duck: true },
  ),
  transmit: def('СИГНАЛЫ', 'Передача запроса', 0.42, 0.28, (c, d, t) => {
    [0, 0.065, 0.18].forEach((offset, i) => tone(c, d, t + offset, 660 + i * 220, 0.065, 'square', 0.16));
    rustle(c, d, t + 0.18, 0.12, 1300, 1900, 0.12);
  }),
  newsArrived: def(
    'СИГНАЛЫ',
    'Новая сводка',
    0.54,
    0.35,
    (c, d, t) => {
      notes(c, d, t, [587, 784], 0.13, 'triangle', 0.28);
      rustle(c, d, t + 0.22, 0.17, 850, 1500, 0.18);
    },
    { pan: 0.4 },
  ),
  ezic: def(
    'СИГНАЛЫ',
    'Шифр EZIC',
    1.04,
    0.42,
    (c, d, t) => {
      notes(c, d, t, [880, 740, 622, 523, 440, 330, 220, 147], 0.085, 'square', 0.16);
      rustle(c, d, t + 0.61, 0.28, 1100, 350, 0.28, 6000);
    },
    { duck: true, cooldown: 900 },
  ),
};
