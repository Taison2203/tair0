/** Warm desk light. Rare mild dips, never a flashing full-screen overlay. */
import { bus } from '../core/bus.js?v=city-2';

export function initAtmosphere(audio) {
  const desk = document.querySelector('#desk');
  const lamp = document.querySelector('.desk-lamp');
  const label = document.querySelector('[data-lamp-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true;
  let timer;
  let pulse;
  // Each new shift starts with the lamp on. A click switches it off for this visit.
  const dust = document.createElement('div');
  dust.className = 'desk-dust';
  dust.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 8; i++) {
    const mote = document.createElement('i');
    mote.style.setProperty('--mote', i);
    dust.append(mote);
  }
  desk.querySelector('.desk-light').append(dust);

  function stop() {
    clearTimeout(timer);
    clearTimeout(pulse);
    desk.style.setProperty('--lamp-power', enabled ? '1' : '0');
  }
  function schedule() {
    stop();
    desk.dataset.visibility = document.hidden ? 'hidden' : 'visible';
    if (!enabled || reduced.matches || document.hidden || document.body.dataset.phase !== 'shift') return;
    timer = setTimeout(() => {
      if (document.hidden || !enabled || reduced.matches) return;
      desk.style.setProperty('--lamp-power', '.48');
      audio.play('lampFlicker');
      pulse = setTimeout(() => {
        desk.style.setProperty('--lamp-power', '1');
        schedule();
      }, 180 + Math.random() * 60);
    }, 15000 + Math.random() * 5000);
  }
  function render() {
    desk.dataset.lamp = enabled ? 'on' : 'off';
    lamp.setAttribute('aria-pressed', String(enabled));
    lamp.setAttribute('aria-label', enabled ? 'Выключить настольную лампу' : 'Включить настольную лампу');
    label.textContent = enabled ? 'ВКЛ.' : 'ВЫКЛ.';
    schedule();
  }
  lamp.addEventListener('click', () => {
    enabled = !enabled;
    audio.play(enabled ? 'lampOn' : 'lampOff');
    render();
  });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', schedule);
  bus.on('shift:started', schedule);
  render();
}
