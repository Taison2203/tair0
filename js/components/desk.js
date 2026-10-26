/**
 * desk.js — Desk textures, clock, document scanner, mute button.
 */

import { $, css, mulberry32 } from '../core/dom.js?v=sfx-2';
import { drawSprite, makeTile, SPEAKER_ON, SPEAKER_OFF, DIGITS } from '../core/sprites.js?v=sfx-2';
import { bus } from '../core/bus.js?v=sfx-2';
import { getLocale } from '../core/i18n.js?v=sfx-2';

const SPEAKER_PAL = { '#': '--paper' };

/**
 * Generate the desk texture and set as CSS variable.
 */
export function makeDeskTexture(seed = 42) {
  const rnd = mulberry32(seed);
  const S = 128;
  const tile = makeTile(S, S, (ctx, w, h) => {
    const c0 = css('--desk-0');
    const c1 = css('--desk-1');
    const c2 = css('--desk-2');

    /* Base fill */
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, w, h);

    /* Light noise dots */
    ctx.fillStyle = c2;
    for (let i = 0; i < 500; i++) {
      ctx.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 1);
    }

    /* Dark dots */
    ctx.fillStyle = c0;
    for (let i = 0; i < 120; i++) {
      ctx.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 1);
    }

    /* Scratches */
    ctx.fillStyle = c2;
    for (let i = 0; i < 70; i++) {
      const x = (rnd() * w) | 0;
      const y = (rnd() * h) | 0;
      const len = 3 + ((rnd() * 6) | 0);
      const dir = [0, 1, -1][((rnd() * 3) | 0)]; /* 0=horiz, 1=diag down, -1=diag up */
      for (let j = 0; j < len; j++) {
        ctx.fillRect((x + j) % S, (y + dir * j + S) % S, 1, 1);
      }
    }

    /* Dark stains with Bayer 2×2 dithering */
    const bayer2 = [[0, 2], [3, 1]];
    for (let s = 0; s < 6; s++) {
      const sx = (rnd() * w) | 0;
      const sy = (rnd() * h) | 0;
      const sr = 4 + ((rnd() * 6) | 0);
      for (let dy = -sr; dy <= sr; dy++) {
        for (let dx = -sr; dx <= sr; dx++) {
          if (dx * dx + dy * dy > sr * sr) continue;
          const dist = Math.sqrt(dx * dx + dy * dy) / sr;
          const threshold = bayer2[((sy + dy) & 1)][((sx + dx) & 1)] / 4;
          if (dist < threshold + 0.3) {
            ctx.fillStyle = c0;
            ctx.fillRect((sx + dx + S) % S, (sy + dy + S) % S, 1, 1);
          }
        }
      }
    }
  });

  const url = tile.toDataURL();
  document.documentElement.style.setProperty('--desk-tex', `url(${url})`);
}

/**
 * Generate page grain texture.
 */
export function makeGrainTexture(seed = 123) {
  const rnd = mulberry32(seed);
  const S = 16;
  const tile = makeTile(S, S, (ctx, w, h) => {
    const c = css('--olive-d');
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = c;
      ctx.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 1);
    }
  });
  const url = tile.toDataURL();
  document.documentElement.style.setProperty('--grain-tex', `url(${url})`);
}

/**
 * Generate ring texture for book spine.
 */
export function makeRingTexture() {
  const tile = makeTile(8, 16, (ctx) => {
    const dark = css('--frame-d');
    const light = css('--frame-l');
    const mid = css('--frame');

    /* Ring: oval shape repeating vertically */
    ctx.fillStyle = dark;
    ctx.fillRect(2, 0, 4, 1);
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(6, 1, 1, 1);

    ctx.fillStyle = mid;
    ctx.fillRect(0, 2, 1, 4);
    ctx.fillRect(7, 2, 1, 4);

    ctx.fillStyle = light;
    ctx.fillRect(0, 6, 1, 2);
    ctx.fillRect(7, 6, 1, 2);

    ctx.fillStyle = dark;
    ctx.fillRect(1, 8, 1, 1);
    ctx.fillRect(6, 8, 1, 1);
    ctx.fillRect(2, 9, 4, 1);

    /* Gap between rings */
    /* rows 10-15 are empty (transparent) for the gap */
  });
  const url = tile.toDataURL();
  document.documentElement.style.setProperty('--ring-tex', `url(${url})`);
}

/**
 * Initialize the LED clock.
 */
export function initClock() {
  const container = $('.clock__display');
  if (!container) return;

  const digitEls = container.querySelectorAll('.clock__digit');
  const colonDots = container.querySelectorAll('.clock__colon-dot');
  const calendar = document.querySelector('.clock__calendar');
  const compactCalendar = document.querySelector('[data-current-date]');
  const monthFormat = new Intl.DateTimeFormat(getLocale(), { month: 'long' });
  const weekdayFormat = new Intl.DateTimeFormat(getLocale(), { weekday: 'long' });
  const dateFormat = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'full' });
  let colonVisible = true;
  let lastMinute = -1;
  let lastDate = '';

  function renderDigit(el, n) {
    const pattern = DIGITS[n];
    const dots = el.querySelectorAll('.clock__dot');
    let idx = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 2; col >= 0; col--) {
        const on = (pattern[row] >> col) & 1;
        dots[idx].className = `clock__dot ${on ? 'is-on' : 'is-off'}`;
        idx++;
      }
    }
  }

  function update() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const minute = h * 60 + m;
    // Use the same local date as the clock, including after midnight or sleep.
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (calendar && dateKey !== lastDate) {
      lastDate = dateKey;
      calendar.dateTime = dateKey;
      calendar.setAttribute('aria-label', `Сегодня: ${dateFormat.format(now)}`);
      calendar.querySelector('[data-calendar-day]').textContent = String(now.getDate()).padStart(2, '0');
      calendar.querySelector('[data-calendar-month]').textContent = monthFormat.format(now);
      calendar.querySelector('[data-calendar-year]').textContent = String(now.getFullYear());
      calendar.querySelector('[data-calendar-weekday]').textContent = weekdayFormat.format(now);
      if (compactCalendar) {
        compactCalendar.dateTime = dateKey;
        compactCalendar.textContent = `Сегодня · ${dateFormat.format(now)}`;
        compactCalendar.setAttribute('aria-label', `Сегодня: ${dateFormat.format(now)}`);
      }
    }

    if (minute !== lastMinute) {
      lastMinute = minute;
      container.setAttribute('aria-label', `Текущее время: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      const h1 = Math.floor(h / 10);
      const h2 = h % 10;
      const m1 = Math.floor(m / 10);
      const m2 = m % 10;
      renderDigit(digitEls[0], h1);
      renderDigit(digitEls[1], h2);
      renderDigit(digitEls[2], m1);
      renderDigit(digitEls[3], m2);
    }

    /* Blink colon every second */
    const sec = now.getSeconds();
    const newVis = sec % 2 === 0;
    if (newVis !== colonVisible) {
      colonVisible = newVis;
      colonDots.forEach((d) => {
        d.style.opacity = colonVisible ? '1' : '0';
      });
    }
  }

  function tick() {
    if (document.hidden) return;
    update();
  }

  update();
  setInterval(tick, 500);
  document.addEventListener('visibilitychange', tick);
}

/**
 * A document-fed scanner rather than an unrelated circuit board.
 */
export function createScanner() {
  const container = $('.scanner');
  if (!container) return;
  const device = container.querySelector('.scanner__device');
  if (!device) return;
  const image = new Image(64, 48);
  image.src = 'assets/img/scanner.svg';
  image.alt = '';
  device.replaceChildren(image);
}

/**
 * Initialize mute button.
 */
export function initMuteButton(audio, { onMute = () => {}, onUnmute = () => {} } = {}) {
  const btn = $('.mute');
  if (!btn || !audio.supported) {
    if (btn) btn.hidden = true;
    return;
  }

  btn.hidden = false;
  let muted = audio.muted;
  const iconOn = drawSprite(SPEAKER_ON, SPEAKER_PAL);
  const iconOff = drawSprite(SPEAKER_OFF, SPEAKER_PAL);
  btn.append(iconOn);

  function updateIcon() {
    btn.replaceChildren(muted ? iconOff.cloneNode(true) : iconOn.cloneNode(true));
    btn.setAttribute('aria-pressed', String(muted));
    btn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
  }

  btn.addEventListener('click', () => {
    if (!audio.ready) return;
    if (!muted) audio.play('soundOff');
    muted = !muted;
    audio.setMuted(muted);
    updateIcon();
    if (muted) onMute();
    else {
      onUnmute();
      audio.ctx.resume().then(() => { if (!audio.muted) audio.play('soundOn'); });
    }
    bus.emit('mute:toggle', { muted });
  });

  bus.on('mute:toggle', (e) => {
    muted = e.detail.muted;
    updateIcon();
  });

  updateIcon();
}
