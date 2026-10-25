/**
 * Document dialogs, seeded security marks, project files and the contact form.
 * User-facing facts are read from config/content.js; missing facts stay redacted.
 */

import { $, el, stepAnim, css, mulberry32 } from '../core/dom.js';
import {
  drawSprite, ICON_NETWORK, ICON_DATABASE, ICON_HARDWARE, ICON_ANALYTICS,
  CASE_LASER, CASE_AI, CASE_ROBLOX,
} from '../core/sprites.js';
import { makePortrait } from '../core/pixelate.js';
import { bus } from '../core/bus.js';
import { CONTENT } from '../config/content.js';
import { initContact } from './contact.js';

const VALID_DOCS = new Set(['passport', 'pass', 'cases', 'contact', 'inspection']);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeBarcode(width = 120, height = 14, seed = 2026) {
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  canvas.className = 'px';
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.fillStyle = css('--ink') || '#25271f';
  const random = mulberry32(seed);
  let x = 2;
  while (x < width - 4) {
    const barWidth = random() > 0.72 ? 2 : 1;
    context.fillRect(x, 0, barWidth, height);
    x += barWidth + 1 + Math.floor(random() * 3);
  }
  return canvas;
}

function makeDocumentNumber(seed) {
  const random = mulberry32(seed);
  const digits = () => Array.from({ length: 5 }, () => Math.floor(random() * 10)).join('');
  return digits() + '-' + digits();
}

async function makeStamp(text, colorVar = '--ok', angle = -8, options = {}) {
  const { fontPx = 8, seed = 1, wear = 0.04, scale = 1 } = options;
  const font = fontPx + 'px "Press Start 2P"';
  if (document.fonts?.load) {
    try { await document.fonts.load(font, String(text)); } catch { /* canvas falls back to monospace */ }
  }

  const width = String(text).length * fontPx + 16;
  const height = fontPx + 16;
  const source = Object.assign(document.createElement('canvas'), { width, height });
  const context = source.getContext('2d');
  context.imageSmoothingEnabled = false;
  const color = css(colorVar) || '#2f8f3d';
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 2;
  context.strokeRect(1, 1, width - 2, height - 2);
  context.strokeRect(4, 4, width - 8, height - 8);
  context.font = font + ', monospace';
  context.textBaseline = 'top';
  context.fillText(String(text), 8, 8);

  const random = mulberry32(seed);
  for (let i = 0; i < width * height * wear; i += 1) {
    context.clearRect((random() * width) | 0, (random() * height) | 0, 1, 1);
  }

  const radians = angle * Math.PI / 180;
  const outputWidth = Math.ceil((Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))) * scale) + 2;
  const outputHeight = Math.ceil((Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) * scale) + 2;
  const stamp = Object.assign(document.createElement('canvas'), {
    width: outputWidth,
    height: outputHeight,
  });
  const stampContext = stamp.getContext('2d');
  stampContext.imageSmoothingEnabled = false;
  stampContext.translate(outputWidth / 2, outputHeight / 2);
  stampContext.rotate((angle * Math.PI) / 180);
  stampContext.scale(scale, scale);
  stampContext.drawImage(source, -width / 2, -height / 2);
  stamp.className = 'px stamp';
  stamp.style.width = 'calc(' + outputWidth + ' * var(--u))';
  stamp.style.height = 'calc(' + outputHeight + ' * var(--u))';
  stamp.setAttribute('role', 'img');
  stamp.setAttribute('aria-label', 'Печать: ' + text);
  return stamp;
}

export async function initDocuments(audio) {
  const desk = $('#desk');
  let openDialog = null;
  let returnFocus = null;
  let openQueue = Promise.resolve();
  const closeTasks = new WeakMap();

  function writeDocumentHash(key) {
    if (!key || window.location.hash === '#' + key) return;
    history.pushState({ document: key }, '', '#' + key);
  }

  function clearDocumentHash(key) {
    if (window.location.hash !== '#' + key) return;
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
  }

  function openDoc(key) {
    if (!VALID_DOCS.has(key) || document.body.dataset.phase !== 'shift') return Promise.resolve();
    const task = openQueue.then(() => openDocNow(key));
    openQueue = task.catch(() => {});
    return task;
  }

  async function openDocNow(key) {
    const dialog = $('#doc-' + key);
    if (!dialog) return;
    if (openDialog === dialog && dialog.open && !dialog.classList.contains('is-leaving')) return;

    if (openDialog) await closeDoc(openDialog);
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialog = dialog;
    desk?.classList.add('is-dim');
    audio.play('paper', { gain: 0.8 });
    if (!dialog.open) dialog.showModal();
    bus.emit('doc:opened', { key });
    await stepAnim(dialog, 'is-entering', reducedMotion() ? 20 : 520);
    dialog.classList.remove('is-entering');
    audio.play('stamp');
    writeDocumentHash(key);
  }

  function closeDoc(dialog, { fromHistory = false } = {}) {
    if (!dialog || !dialog.open) return Promise.resolve();
    if (closeTasks.has(dialog)) return closeTasks.get(dialog);

    const task = (async () => {
      audio.play('paper', { gain: 0.6 });
      await stepAnim(dialog, 'is-leaving', reducedMotion() ? 20 : 300);
      dialog.close();
      bus.emit('doc:closed', { key: dialog.id.replace(/^doc-/, '') });
      dialog.classList.remove('is-leaving', 'is-entering');
      const closedKey = dialog.id.replace(/^doc-/, '');
      if (!fromHistory) clearDocumentHash(closedKey);
      if (openDialog === dialog) openDialog = null;
      if (!document.querySelector('dialog.doc[open]')) desk?.classList.remove('is-dim');
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    })();

    closeTasks.set(dialog, task);
    task.then(() => closeTasks.delete(dialog), () => closeTasks.delete(dialog));
    return task;
  }

  function closeAll() {
    if (openDialog) return closeDoc(openDialog);
    return Promise.resolve();
  }

  document.querySelectorAll('dialog.doc').forEach((dialog) => {
    dialog.querySelector('.doc__close')?.addEventListener('click', () => closeDoc(dialog));
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDoc(dialog);
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDoc(dialog);
    });
  });

  async function setupPassport() {
    const passport = $('#doc-passport .passport');
    if (!passport) return;

    const photo = passport.querySelector('.passport__photo');
    if (photo) {
      photo.replaceChildren(await makePortrait(CONTENT.passport.photo, 40, 52, CONTENT.passport.pixelArt));
    }

    const number = passport.querySelector('[data-passport-number]');
    if (number) number.textContent = makeDocumentNumber(3018);

    const fields = passport.querySelector('.passport__fields');
    if (fields) {
      const ageAtIssue = CONTENT.passport.issueYear - CONTENT.passport.birthYear;
      const values = [
        ['ФАМИЛИЯ:', CONTENT.owner.surname || el('span', { class: 'classified', 'aria-label': 'Фамилия засекречена' }, 'ЗАСЕКРЕЧЕНО')],
        ['ИМЯ:', CONTENT.owner.givenName],
        ['ГРАЖДАНСТВО:', CONTENT.passport.citizenship],
        ['ГОД РОЖДЕНИЯ:', String(CONTENT.passport.birthYear)],
        ['ВОЗРАСТ:', String(ageAtIssue)],
        ['РОСТ:', `${CONTENT.passport.heightCm} СМ`],
        ['ГОРОД:', CONTENT.passport.documentCity],
        ['СПЕЦИАЛЬНОСТЬ:', CONTENT.passport.major],
        ['ВЫДАН:', String(CONTENT.passport.issueYear)],
      ];
      fields.replaceChildren(el('dl', {}, ...values.flatMap(([label, value]) => [
        el('dt', {}, label), el('dd', {}, value),
      ])));
    }

    const barcode = passport.querySelector('.passport__barcode');
    barcode?.replaceChildren(makeBarcode(160, 16, 3018));

    const stamps = passport.querySelector('.passport__stamps');
    if (stamps) {
      stamps.replaceChildren();
      const first = await makeStamp(CONTENT.passport.stampTexts[0] || 'ПРОВЕРЕНО', '--ok', -7, {
        seed: 3018, scale: 0.6,
      });
      const second = await makeStamp(CONTENT.passport.stampTexts[1] || 'СВЕРЕНО', '--stamp-blue', 8, {
        seed: 3019, scale: 0.6,
      });
      stamps.append(first, second);
    }
  }

  async function setupWorkPass() {
    const pass = $('#doc-pass .workpass');
    if (!pass) return;
    const grid = pass.querySelector('.workpass__grid');
    const icons = {
      networks: ICON_NETWORK,
      databases: ICON_DATABASE,
      hardware: ICON_HARDWARE,
      analytics: ICON_ANALYTICS,
    };

    if (grid) {
      grid.replaceChildren();
      CONTENT.workPass.forEach((category) => {
        const icon = drawSprite(icons[category.key] || ICON_HARDWARE, { '#': '--ink', G: '--gold' });
        icon.className = 'wp-cat__icon px';
        const section = el('section', { class: 'wp-cat' },
          icon,
          el('h3', { class: 'wp-cat__title' }, category.title),
          el('ul', { class: 'wp-cat__items' },
            ...category.items.map((item) => el('li', { class: 'wp-chip' }, item))
          )
        );
        grid.append(section);
      });
    }

    pass.querySelector('.workpass__barcode')?.replaceChildren(makeBarcode(140, 16, 4026));
    const stampLabel = pass.querySelector('.workpass__stamp-label');
    if (stampLabel) {
      const stamp = await makeStamp('ДЕЙСТВУЕТ', '--stamp-blue', -5, { seed: 4026, scale: 0.45 });
      stamp.classList.add('workpass__valid-stamp');
      stampLabel.append(stamp);
    }
  }

  async function setupCases() {
    const dialog = $('#doc-cases');
    const tabs = dialog?.querySelector('.cases__tabs');
    const panel = dialog?.querySelector('.case-panel');
    if (!tabs || !panel) return;
    panel.id = 'case-panel';
    panel.setAttribute('aria-live', 'polite');
    const orientation = matchMedia('(max-width: 599px)');
    const updateOrientation = () => tabs.setAttribute('aria-orientation', orientation.matches ? 'horizontal' : 'vertical');
    updateOrientation();
    orientation.addEventListener('change', updateOrientation);

    const sprites = {
      '0001': { sprite: CASE_LASER, palette: { '#': '--ink', G: '--gold', B: '--frame', R: '--led', L: '--blue-led', o: '--olive-d' } },
      '0002': { sprite: CASE_AI, palette: { '#': '--ink' } },
      '0003': { sprite: CASE_ROBLOX, palette: { '#': '--ink' } },
    };
    const stamps = await Promise.all(CONTENT.cases.map((item, index) => makeStamp(
      item.summary ? 'ПРОВЕРЕНО' : 'СЕКРЕТНО',
      item.summary ? '--ok' : '--no',
      index % 2 ? 5 : -5,
      { seed: 5000 + index, scale: 0.38 }
    )));
    let activeIndex = 0;

    function renderCase(index) {
      const item = CONTENT.cases[index];
      if (!item) return;
      activeIndex = index;
      tabs.querySelectorAll('.case-tab').forEach((tab, tabIndex) => {
        tab.setAttribute('aria-selected', String(tabIndex === index));
        tab.tabIndex = tabIndex === index ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', 'case-tab-' + item.no);
      panel.replaceChildren();

      const visual = sprites[item.no] || { sprite: CASE_AI, palette: { '#': '--ink' } };
      const sprite = drawSprite(visual.sprite, visual.palette);
      sprite.className = 'case-panel__sprite px';
      sprite.style.width = 'calc(64 * var(--u))';
      sprite.style.height = 'calc(48 * var(--u))';

      const tags = el('div', { class: 'case-panel__tags' }, ...(item.tags.length
        ? item.tags.map((tag) => el('span', { class: 'case-tag' }, tag))
        : [el('span', { class: 'case-tag case-tag--empty' }, 'ТЕХНОЛОГИИ НЕ УКАЗАНЫ')]
      ));
      const body = item.summary
        ? el('p', { class: 'case-panel__summary' }, item.summary)
        : el('div', { class: 'case-panel__body' },
            el('div', { class: 'case-panel__classified', 'aria-hidden': 'true' }, '██████████████████████████████████████'),
            el('div', { class: 'case-panel__classified-label' }, 'СВЕДЕНИЯ ЗАСЕКРЕЧЕНЫ 5-М ОТДЕЛОМ')
          );

      const links = item.links
        .map((entry) => typeof entry === 'string' ? { href: entry, label: entry } : entry)
        .filter((entry) => entry?.href && /^https?:\/\//i.test(entry.href));
      const linkRow = el('div', { class: 'case-panel__links' }, ...(links.length
        ? links.map((entry) => el('a', {
            class: 'case-panel__link', href: entry.href, target: '_blank', rel: 'noopener noreferrer',
          }, entry.label || entry.href))
        : [el('button', {
            class: 'case-panel__links-disabled', type: 'button', disabled: '',
            title: 'Материалы засекречены',
          }, 'МАТЕРИАЛЫ ЗАСЕКРЕЧЕНЫ')]
      ));

      panel.append(
        el('div', { class: 'case-panel__header' }, el('span', {}, 'ДЕЛО № ' + item.no), stamps[index]),
        el('h3', { class: 'case-panel__title' }, item.title),
        sprite,
        tags,
        body,
        linkRow
      );
      panel.classList.remove('is-swapping');
      if (!reducedMotion()) {
        void panel.offsetWidth;
        panel.classList.add('is-swapping');
        window.setTimeout(() => panel.classList.remove('is-swapping'), 300);
      }
    }

    tabs.replaceChildren();
    CONTENT.cases.forEach((item, index) => {
      const button = el('button', {
        class: 'case-tab', type: 'button', role: 'tab',
        id: 'case-tab-' + item.no, 'aria-controls': 'case-panel',
        'aria-selected': String(index === 0), tabindex: index === 0 ? '0' : '-1',
      }, '№ ' + item.no);
      button.addEventListener('click', () => {
        audio.play('paper');
        renderCase(index);
      });
      button.addEventListener('keydown', (event) => {
        let next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % CONTENT.cases.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + CONTENT.cases.length) % CONTENT.cases.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = CONTENT.cases.length - 1;
        else return;
        event.preventDefault();
        tabs.querySelectorAll('.case-tab')[next]?.focus();
        renderCase(next);
      });
      tabs.append(button);
    });
    renderCase(activeIndex);
  }

  await Promise.all([setupPassport(), setupWorkPass(), setupCases()]);
  initContact({ audio, makeStamp });

  bus.on('doc:open', (event) => {
    const key = event.detail?.key;
    if (key) openDoc(key);
  });
  bus.on('doc:closeAll', closeAll);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openDialog) closeDoc(openDialog);
  });

  window.addEventListener('hashchange', () => {
    const key = window.location.hash.slice(1);
    if (key === 'inspection') openDoc(key);
    else if (VALID_DOCS.has(key)) bus.emit('tab:select', { key });
    else {
      bus.emit('tab:reset');
      if (openDialog) closeDoc(openDialog, { fromHistory: true });
    }
  });

  return { openDoc, closeDoc, closeAll };
}
