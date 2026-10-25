/** Duplicate penalties, dead-click citations and the EZIC cipher sequence. */

import { $ } from '../core/dom.js';
import { bus } from '../core/bus.js';
import { CONTENT } from '../config/content.js';

function normalizeKey(key) {
  return String(key || '').toUpperCase().replace(/[^A-Z]/g, '');
}

function vigenere(text, key, direction) {
  const cleanKey = normalizeKey(key);
  if (!cleanKey) return String(text || '');
  let cursor = 0;
  return Array.from(String(text || '')).map((character) => {
    const code = character.charCodeAt(0);
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    if (!isUpper && !isLower) return character;
    const base = isUpper ? 65 : 97;
    const shift = cleanKey.charCodeAt(cursor % cleanKey.length) - 65;
    cursor += 1;
    return String.fromCharCode(((code - base + direction * shift + 26) % 26) + base);
  }).join('');
}

export const vigenereEncode = (text, key) => vigenere(text, key, 1);
export const vigenereDecode = (text, key) => vigenere(text, key, -1);

export function initPenalty({ audio, isShiftActive = () => false } = {}) {
  const desk = $('#desk');
  if (!desk || !audio) return;
  let deadClicks = [];
  let cooldownUntil = 0;

  desk.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    // Only empty desk clicks violate the playful rule. Reading or selecting text must not.
    if (target !== desk || !isShiftActive()) return;
    const now = Date.now();
    if (now < cooldownUntil) return;
    deadClicks = deadClicks.filter((stamp) => now - stamp <= 8000);
    deadClicks.push(now);
    audio.play('buzzer');
    if (deadClicks.length < 3) return;
    deadClicks = [];
    cooldownUntil = now + 1500;
    bus.emit('receipt:print', {
      header: CONTENT.receipts.penalty,
      text: CONTENT.receipts.penalty,
      meta: 'НАРУШЕНИЕ ПРОТОКОЛА · ПРЕДУПРЕЖДЕНИЕ ВЫДАНО',
    });
  });
}

export function initEzic(audio) {
  const duplicateButton = $('.dup-btn');
  const flash = $('#flash');
  const terminal = $('.ezic-terminal');
  const secretClip = $('.clip--b');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let duplicateReady = true;
  let triggering = false;
  let lastTrigger = 0;

  duplicateButton?.addEventListener('click', () => {
    if (!duplicateReady) return;
    duplicateReady = false;
    duplicateButton.disabled = true;
    audio.play('buzzer', { gain: 0.9 });
    bus.emit('receipt:print', {
      header: CONTENT.receipts.penalty,
      text: CONTENT.receipts.duplicate,
      meta: 'ЗАПРОС НА КОПИЮ · ОТКЛОНЕНО',
    });
    window.setTimeout(() => {
      duplicateReady = true;
      duplicateButton.disabled = false;
    }, 1500);
  });

  async function triggerOrder() {
    const now = Date.now();
    if (triggering || now - lastTrigger < 5000) return;
    triggering = true;
    lastTrigger = now;
    audio.play('ezic');

    if (flash) {
      flash.classList.remove('is-on');
      void flash.offsetWidth;
      flash.classList.add('is-on');
      window.setTimeout(() => flash.classList.remove('is-on'), reducedMotion.matches ? 600 : 1200);
    }

    const cipher = vigenereEncode(CONTENT.ezic.secret, CONTENT.ezic.key);
    if (terminal) {
      terminal.textContent = 'СЕКРЕТНАЯ ЗАПИСКА EZIC\n> ' + cipher + '\nКЛЮЧ: ' + CONTENT.ezic.key;
      terminal.hidden = false;
      terminal.focus({ preventScroll: true });
    }

    bus.emit('receipt:print', {
      header: 'ПРИКАЗ ЗВЕЗДЫ EZIC',
      text: 'ПОРЯДОК СЛЕДИТ ЗА ТОБОЙ. СЛАВА АРСТОТЦКЕ.',
      meta: 'ТАЙНАЯ ПЕРЕДАЧА · ' + cipher,
    });

    secretClip?.classList.remove('is-shifting');
    if (secretClip && !reducedMotion.matches) {
      void secretClip.offsetWidth;
      secretClip.classList.add('is-shifting');
      window.setTimeout(() => secretClip.classList.remove('is-shifting'), 400);
    }
    window.setTimeout(() => { triggering = false; }, 5000);
  }

  terminal?.addEventListener('click', () => {
    audio.play('tick');
    terminal.hidden = true;
  });

  secretClip?.addEventListener('click', triggerOrder);

  let keyBuffer = '';
  window.addEventListener('keydown', (event) => {
    if (document.body.dataset.phase !== 'shift') return;
    if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'Escape' && terminal && !terminal.hidden) {
      terminal.hidden = true;
      return;
    }
    if (!/^[A-Z]$/i.test(event.key)) return;
    keyBuffer = (keyBuffer + event.key.toUpperCase()).slice(-normalizeKey(CONTENT.ezic.key).length);
    if (keyBuffer === normalizeKey(CONTENT.ezic.key)) {
      keyBuffer = '';
      triggerOrder();
    }
  });

  return { triggerOrder };
}
