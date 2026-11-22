import { el } from '../core/dom.js?v=reception-20261119';
import { getLanguage } from '../core/i18n.js?v=reception-20261119';

export function initShiftMusic(music, audio) {
  const footer = document.querySelector('.site-footer');
  const tools = footer?.querySelector('.site-footer__tools');
  if (!tools) return;
  const ru = getLanguage() === 'ru';
  const status = el('small', { class: 'shift-music__status' });
  const title = el('strong', { class: 'shift-music__title' });
  const queued = el('small', { class: 'shift-music__status' });
  const copy = el('span', { class: 'shift-music__copy', role: 'status' }, status, title, queued);
  const next = el('button', { type: 'button', class: 'shift-music__next' },
    ru ? 'Следующая' : 'Next track', el('span', { 'aria-hidden': 'true' }, ' ⏭'));
  const player = el('section', {
    class: 'shift-music', 'aria-label': ru ? 'Музыка смены' : 'Shift music', 'data-no-translate': '',
  }, el('span', { class: 'shift-music__icon', 'aria-hidden': 'true' }, '♫'), copy, next);
  tools.before(player);

  function render() {
    const track = music.currentTrack;
    const audible = music.playing && !audio.muted && audio.volume.music > 0 && !document.hidden;
    player.classList.toggle('is-playing', audible);
    status.textContent = audible
      ? (ru ? 'Сейчас играет' : 'Now playing')
      : (ru ? 'Музыка смены · на паузе' : 'Shift music · paused');
    title.textContent = ru ? track.title : track.titleEn;
    queued.textContent = (ru ? 'Далее · ' : 'Up next · ') + (ru ? music.nextTrack.title : music.nextTrack.titleEn);
    next.disabled = Boolean(music.previewState) || !audio.supported;
  }
  next.addEventListener('click', () => {
    audio.play('tick', { gain: .55 });
    music.skip();
  });
  music.addEventListener('change', render);
  audio.addEventListener('change', render);
  render();
}
