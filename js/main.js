/** Application entry point: load type, prepare documents, then allow the shift to start. */

import { AudioEngine } from './audio/engine.js?v=reception-20261119';
import { initSoundArchive } from './components/soundArchive.js?v=reception-20261119';
import { SFX } from './audio/sfx.js?v=reception-20261119';
import { Music } from './audio/music.js?v=reception-20261119';
import { initScale } from './core/scale.js?v=reception-20261119';
import {
  makeDeskTexture, makeGrainTexture, makeRingTexture, initClock,
  createScanner, initMuteButton,
} from './components/desk.js?v=reception-20261119';
import { initStartScreen } from './components/startScreen.js?v=reception-20261119';
import { initBook } from './components/book.js?v=reception-20261119';
import { initDocuments } from './components/documents.js?v=reception-20261119';
import { initReceipts } from './components/receipts.js?v=reception-20261119';
import { initNews } from './components/news.js?v=reception-20261119';
import { initEzic, initPenalty } from './components/ezic.js?v=reception-20261119';
import { bus } from './core/bus.js?v=reception-20261119';
import { CONTENT } from './config/content.js?v=reception-20261119';
import { makePortrait } from './core/pixelate.js?v=reception-20261119';
import { initShift } from './components/shift.js?v=reception-20261119';
import { initAtmosphere } from './components/atmosphere.js?v=reception-20261119';
import { chooseLanguage } from './core/i18n.js?v=reception-20261119';
import { stepAnim } from './core/dom.js?v=reception-20261119';
import { initCaptureProtection } from './components/captureProtection.js?v=reception-20261119';
import { initVisitorGuide } from './components/visitorGuide.js?v=reception-20261119';
import { initBoard } from './components/board.js?v=board-return-1';
import { initSecrets } from './components/secrets.js?v=reception-20261119';
import { initReactions } from './components/reactions.js?v=reception-20261119';
import { playBrandSound } from './audio/brandSound.js?v=1';

async function loadRequiredFonts() {
  if (!document.fonts?.load) return;
  const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';
  await Promise.all([
    document.fonts.load('8px "Press Start 2P"', sample),
    document.fonts.load('16px "PT Mono"', sample),
  ].map((promise) => promise.catch(() => [])));
}

document.addEventListener('DOMContentLoaded', async () => {
  document.body.dataset.phase = 'boot';
  initScale();
  const audio = new AudioEngine(SFX);
  initReceipts(audio);
  initCaptureProtection(audio);
  const intro = document.querySelector('#brand-intro');
  playBrandSound();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await stepAnim(intro, 'is-playing', 2110);
  }
  intro.hidden = true;
  await chooseLanguage();
  const duplicateButton = document.querySelector('.dup-btn');
  duplicateButton?.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode(' ')));
  if (duplicateButton) document.querySelector('.site-footer__tools')?.append(duplicateButton);
  const startScreen = initStartScreen();
  const music = new Music(audio);

  makeDeskTexture();
  makeGrainTexture();
  makeRingTexture();
  initClock();
  createScanner();
  initAtmosphere(audio);

  const footer = document.querySelector('[data-footer-copy]');
  if (footer) footer.textContent = CONTENT.footer;
  const ownerName = document.querySelector('[data-owner-name]');
  if (ownerName) ownerName.textContent = CONTENT.owner.givenName.toUpperCase();
  const caseCount = document.querySelector('[data-case-count]');
  if (caseCount) caseCount.textContent = String(CONTENT.cases.length).padStart(2, '0');
  const skillCount = document.querySelector('[data-skill-count]');
  if (skillCount) skillCount.textContent = String(CONTENT.workPass.length).padStart(2, '0');

  try {
    await loadRequiredFonts();
    const deskPhoto = document.querySelector('[data-desk-photo]');
    if (deskPhoto) deskPhoto.replaceChildren(await makePortrait(CONTENT.passport.photo, 32, 42, CONTENT.passport.pixelArt));
    const dossierValues = [
      ['[data-dossier-name]', CONTENT.owner.givenName],
      ['[data-dossier-age]', String(CONTENT.passport.issueYear - CONTENT.passport.birthYear)],
      ['[data-dossier-city]', CONTENT.passport.documentCity.toUpperCase()],
      ['[data-dossier-major]', CONTENT.passport.major.toUpperCase()],
    ];
    dossierValues.forEach(([selector, value]) => {
      const field = document.querySelector(selector);
      if (field) field.textContent = value;
    });
    initBook(audio);
    initNews(audio);
    initSoundArchive(audio);
    initReactions(audio);
    initBoard(audio);
    initVisitorGuide(audio);
    initSecrets(audio);
    await initDocuments(audio);
    initShift(audio);
    initEzic(audio);
    initPenalty({ audio, isShiftActive: () => document.body.dataset.phase === 'shift' });

    await audio.preload((progress) => startScreen.updateProgress(progress));
    if (!audio.supported || typeof OfflineAudioContext === 'undefined') startScreen.updateProgress(1);
    startScreen.setReady();
    document.body.dataset.phase = 'ready';
  } catch (error) {
    console.error('[boot] required interface could not be prepared:', error);
    startScreen.updateProgress(1);
    startScreen.setReady();
    document.body.dataset.phase = 'ready';
  }

  startScreen.onStart(async ({ muted }) => {
    // Begin audio during the gesture. Some mobile browsers defer resume() until
    // audio output becomes available; the handbook must still open immediately.
    audio.unlock({ muted }).then(ready => {
      if (!ready) return;
      initMuteButton(audio, {
        onMute: () => music.stop(),
        onUnmute: () => music.start(),
      });
      if (!audio.muted && !document.hidden) { music.start(); audio.play('shiftStart'); }
    }).catch(() => { /* A shift can be completed with audio unavailable. */ });
    document.body.dataset.phase = 'shift';
    await startScreen.hide();
    document.querySelector('#desk')?.removeAttribute('inert');
    document.querySelector('#desk')?.classList.add('is-revealed');
    window.setTimeout(() => document.querySelector('#desk')?.classList.remove('is-revealed'), 1200);
    bus.emit('shift:started');

    const requestedDoc = window.location.hash.slice(1);
    if (requestedDoc === 'inspection') {
      bus.emit('doc:open', { key: 'inspection' });
    } else if (['passport', 'pass', 'cases', 'contact', 'gallery'].includes(requestedDoc)) {
      document.querySelector('.tab[data-tab="' + requestedDoc + '"]')?.focus({ preventScroll: true });
      bus.emit('tab:select', { key: requestedDoc });
    } else {
      document.querySelector('.book__tabs .tab')?.focus({ preventScroll: true });
    }

    window.setTimeout(() => {
      if (document.querySelector('dialog[open]')) return;
      bus.emit('receipt:print', {
        header: 'МИНИСТЕРСТВО ВЪЕЗДА',
        text: 'ИНСПЕКТОР ' + CONTENT.owner.givenName.toUpperCase() + ': Рабочее место готово к проверке.',
        meta: 'АРСТОТЦКА · КПП №1',
      });
    }, 600);
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.body.dataset.phase!=='shift')return;
    if(document.hidden)music.stop();
    else if(audio.ready&&!audio.muted)music.start();
  });

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch' || !audio.ready) return;
    const target = event.target instanceof Element
      ? event.target.closest('.tab, .chip, .btn:not(:disabled), .case-tab, .dup-btn:not(:disabled), .doc__close, .clip--b, .mute, .board-tool:not(:disabled), .board-close, .board-invitation, .social-like:not(:disabled)')
      : null;
    if (!target || target.contains(event.relatedTarget)) return;
    audio.play('hover', { gain: .7 });
  });

  window.addEventListener('keydown', (event) => {
    if (document.body.dataset.phase !== 'shift') return;
    if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target.closest?.('input, textarea, select, button, a, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    if (event.key === '1') bus.emit('tab:select', { key: 'passport' });
    if (event.key === '2') bus.emit('tab:select', { key: 'pass' });
    if (event.key === '3') bus.emit('tab:select', { key: 'cases' });
    if (event.key === '4') bus.emit('tab:select', { key: 'contact' });
    if (event.key === '5') bus.emit('tab:select', { key: 'gallery' });
    if (event.key === '0') bus.emit('tab:reset');
  });
});
