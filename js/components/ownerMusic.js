import { MUSIC_TRACKS } from '../audio/music.js?v=shift-player-1';
import { el } from '../core/dom.js?v=reception-20261119';
import { getLanguage } from '../core/i18n.js?v=reception-20261119';

const clock = seconds => {
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
};

export function createOwnerMusic(music) {
  const ru = getLanguage() === 'ru';
  const name = track => ru ? track.title : track.titleEn;
  const playingLabel = ru ? 'Остановить' : 'Stop';
  const playLabel = ru ? 'Прослушать' : 'Play';
  const idleLabel = ru ? 'Выбери мелодию' : 'Choose a track';
  const trackCount = MUSIC_TRACKS.length;
  const trackLabel = new Intl.PluralRules(ru ? 'ru' : 'en').select(trackCount);
  const countLabel = ru
    ? trackCount + ' ' + ({ one: 'тема', few: 'темы' }[trackLabel] || 'тем')
    : trackCount + (trackLabel === 'one' ? ' track' : ' tracks');

  const details = el('details', { class: 'owner-music' });
  const summary = el('summary', { class: 'owner-music__summary' },
    el('span', { class: 'owner-music__symbol', 'aria-hidden': 'true' }, '♫'),
    el('span', { class: 'owner-music__heading' },
      el('strong', {}, ru ? 'Музыка смены' : 'Shift music'),
      el('small', {}, countLabel)
    ),
    el('span', { class: 'owner-music__chevron', 'aria-hidden': 'true' })
  );

  const bars = el('span', { class: 'owner-music__bars', 'aria-hidden': 'true' },
    el('i'), el('i'), el('i'), el('i'), el('i')
  );
  const status = el('span', { class: 'owner-music__status', role: 'status' }, idleLabel);
  const time = el('span', { class: 'owner-music__time', 'aria-hidden': 'true' }, '0:00');
  const progress = el('progress', {
    class: 'owner-music__progress', value: '0', max: '1',
    'aria-label': ru ? 'Ход воспроизведения' : 'Playback progress',
  });
  const list = el('ul', { class: 'owner-music__tracks' });
  const controls = new Map();
  let active = null;
  let generation = 0;
  let interval;

  function setActive(track) {
    active = track;
    details.classList.toggle('is-playing', Boolean(track));
    for (const [id, control] of controls) {
      const selected = track?.id === id;
      control.button.setAttribute('aria-pressed', String(selected));
      control.button.setAttribute('aria-label', (selected ? playingLabel : playLabel) + ' · ' + name(control.track));
      control.symbol.textContent = selected ? '■' : '▶';
    }
    status.textContent = track ? name(track) : idleLabel;
    progress.max = track?.duration || 1;
    progress.value = 0;
    time.textContent = track ? '0:00 / ' + clock(track.duration) : '0:00';
  }

  function stop(options) {
    if (!active) return;
    generation++;
    clearInterval(interval);
    music.stopPreview(options);
    setActive(null);
  }

  async function play(track) {
    if (active?.id === track.id) {
      stop();
      return;
    }
    clearInterval(interval);
    const current = ++generation;
    setActive(track);
    const onEnd = () => {
      if (current !== generation) return;
      clearInterval(interval);
      setActive(null);
    };
    let started = false;
    try {
      started = await music.preview(track.id, { onEnd });
    } catch { /* The message below also covers unavailable audio devices. */ }
    if (current !== generation || !active) return;
    if (!started) {
      stop();
      status.textContent = ru ? 'Не удалось запустить звук. Попробуй ещё раз.' : 'Could not start audio. Try again.';
      return;
    }
    interval = setInterval(() => {
      const elapsed = Math.min(track.duration, music.previewElapsed);
      progress.value = elapsed;
      time.textContent = clock(elapsed) + ' / ' + clock(track.duration);
    }, 160);
  }

  for (const track of MUSIC_TRACKS) {
    const symbol = el('span', { class: 'owner-music__play', 'aria-hidden': 'true' }, '▶');
    const button = el('button', {
      type: 'button', class: 'owner-music__track', 'aria-pressed': 'false',
      'aria-label': playLabel + ' · ' + name(track),
    }, symbol,
    el('span', { class: 'owner-music__track-name' }, name(track)),
    el('span', { class: 'owner-music__track-meta' }, track.bpm + ' BPM'),
    el('span', { class: 'owner-music__track-length' }, clock(track.duration)));
    button.addEventListener('click', () => void play(track));
    controls.set(track.id, { button, symbol, track });
    list.append(el('li', {}, button));
  }

  details.append(summary, el('div', { class: 'owner-music__body' },
    el('div', { class: 'owner-music__display' }, bars, status, time, progress),
    list
  ));
  details.addEventListener('toggle', () => { if (!details.open) stop(); });
  return { element: details, stop };
}
