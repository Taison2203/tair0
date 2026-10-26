/** A paper catalogue for auditioning the checkpoint's original sound effects. */
import { el } from '../core/dom.js?v=footer-1';
import { t } from '../core/i18n.js?v=footer-1';

export function initSoundArchive(audio) {
  const opener = document.querySelector('[data-sound-archive]');
  if (!opener) return;
  if (!audio.supported) {
    opener.hidden = true;
    return;
  }
  const close = el('button', { type: 'button', class: 'sound-archive__close' }, '[X] ВЕРНУТЬСЯ');
  const status = el('p', { class: 'sound-archive__status', role: 'status' });
  const enable = el('button', { type: 'button', class: 'btn sound-archive__enable' }, 'Включить звук');
  const controls = el('fieldset', { class: 'sound-archive__mix' }, el('legend', {}, 'ГРОМКОСТЬ ПОСТА'));
  const sliders = [];
  for (const [channel, label] of [
    ['effects', 'Эффекты'],
    ['music', 'Музыка'],
  ]) {
    const id = 'volume-' + channel;
    const output = el('output', { for: id, 'data-no-translate': '' });
    const input = el('input', {
      id,
      type: 'range',
      min: 0,
      max: 100,
      step: 1,
      value: Math.round(audio.volume[channel] * 100),
    });
    controls.append(
      el('div', { class: 'sound-archive__slider' }, el('label', { for: id }, label), input, output),
    );
    input.addEventListener('input', () => audio.setVolume(channel, Number(input.value) / 100));
    input.addEventListener('change', () => {
      if (channel === 'effects') audio.play('tick');
    });
    sliders.push({ channel, input, output });
  }
  const catalogue = el('div', { class: 'sound-archive__catalogue' });
  const groups = new Map(),
    buttons = [];
  let index = 0,
    activeButton = null,
    playingTimer;
  for (const [name, def] of Object.entries(audio.defs)) {
    if (!groups.has(def.group)) {
      const items = el('div', { class: 'sound-archive__items' });
      catalogue.append(el('section', {}, el('h3', {}, def.group), items));
      groups.set(def.group, items);
    }
    const button = el(
      'button',
      {
        type: 'button',
        class: 'sound-archive__sample',
        'aria-label': t('Прослушать запись') + ': ' + t(def.label),
      },
      el(
        'span',
        { class: 'sound-archive__number', 'aria-hidden': 'true', 'data-no-translate': '' },
        String(++index).padStart(2, '0'),
      ),
      el('span', {}, def.label),
      el('span', { class: 'sound-archive__play', 'aria-hidden': 'true' }, '▶'),
    );
    button.addEventListener('click', () => {
      if (!audio.play(name, { preview: true })) return;
      activeButton?.classList.remove('is-playing');
      clearTimeout(playingTimer);
      activeButton = button;
      button.classList.add('is-playing');
      status.textContent = t('СЕЙЧАС ЗВУЧИТ:') + ' ' + t(def.label);
      playingTimer = setTimeout(() => {
        button.classList.remove('is-playing');
        activeButton = null;
        sync();
      }, def.dur * 1000);
    });
    groups.get(def.group).append(button);
    buttons.push(button);
  }
  const sheet = el(
    'article',
    { class: 'sound-archive__sheet' },
    el('p', { class: 'sound-archive__eyebrow' }, 'МИНИСТЕРСТВО ВЪЕЗДА · ФОНОТЕКА № 2203'),
    el('h2', { id: 'sound-archive-title' }, 'ЗВУКОВОЙ АРХИВ'),
    el(
      'p',
      { class: 'sound-archive__intro' },
      '40 звуков рабочего поста. Выберите запись для прослушивания.',
    ),
    controls,
    el('div', { class: 'sound-archive__feedback' }, status, enable),
    catalogue,
  );
  const dialog = el(
    'dialog',
    { class: 'sound-archive', 'aria-labelledby': 'sound-archive-title' },
    close,
    sheet,
  );
  document.body.append(dialog);
  function sync() {
    const silent = audio.muted || audio.volume.effects === 0;
    buttons.forEach((button) => {
      button.disabled = silent;
    });
    enable.hidden = !audio.muted;
    for (const { channel, input, output } of sliders) {
      const value = Math.round(audio.volume[channel] * 100);
      input.value = value;
      output.value = value + '%';
    }
    status.textContent = audio.muted
      ? 'Звук выключен. Включите его для прослушивания.'
      : audio.volume.effects === 0
        ? 'Поднимите громкость эффектов для прослушивания.'
        : 'ЗАПИСЬ ГОТОВА К ПРОСЛУШИВАНИЮ';
  }
  audio.addEventListener('change', sync);
  enable.addEventListener('click', () => {
    document.querySelector('.mute')?.click();
    if (!audio.muted) sliders[0].input.focus({ preventScroll: true });
  });
  opener.addEventListener('click', () => {
    if (dialog.open || !audio.ready) return;
    sync();
    dialog.showModal();
    dialog.scrollTop = 0;
    audio.play('fileOpen', { gain: 0.75 });
    close.focus({ preventScroll: true });
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => event.stopPropagation());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') event.stopPropagation();
  });
  dialog.addEventListener('close', () => {
    clearTimeout(playingTimer);
    activeButton?.classList.remove('is-playing');
    audio.stopEffects();
    audio.play('documentClose', { gain: 0.75 });
    opener.focus({ preventScroll: true });
  });
}
