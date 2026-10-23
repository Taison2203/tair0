/**
 * startScreen.js — Full-screen start overlay with progress bar and start buttons.
 */

import { $, stepAnim } from '../core/dom.js';

export function initStartScreen() {
  const screen = $('#start-screen');
  const blocks = screen.querySelectorAll('.progress__block');
  const btnStart = screen.querySelector('.btn--primary');
  const btnMute = screen.querySelector('.btn--secondary');
  let onStartCb = null;

  function updateProgress(pct) {
    const filled = Math.round(pct * blocks.length);
    blocks.forEach((b, i) => {
      b.classList.toggle('is-filled', i < filled);
    });
    screen.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', Math.round(pct * 100));
  }

  function setReady() {
    btnStart.disabled = false;
    btnStart.focus();
    if (btnMute) btnMute.disabled = false;
  }

  function onStart(cb) {
    onStartCb = cb;
    btnStart.addEventListener('click', () => {
      if (btnStart.disabled) return;
      btnStart.disabled = true;
      if (btnMute) btnMute.disabled = true;
      cb({ muted: false });
    });
    if (btnMute) {
      btnMute.addEventListener('click', () => {
        if (btnMute.disabled) return;
        btnStart.disabled = true;
        btnMute.disabled = true;
        cb({ muted: true });
      });
    }
  }

  async function hide() {
    await stepAnim(screen, 'is-leaving', 600);
    screen.hidden = true;
  }

  return { updateProgress, setReady, onStart, hide };
}
