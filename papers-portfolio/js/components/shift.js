/** Session-only desk interactions. No progress or visitor data leaves the browser. */
import { bus } from '../core/bus.js';
import { CONTENT } from '../config/content.js';
import { initInspection } from './inspection.js';

export function initShift(audio) {
  const visited = new Set();
  initInspection(audio);

  bus.on('doc:opened', ({ detail }) => {
    if (!CONTENT.tabs.some(tab => tab.key === detail.key) || visited.has(detail.key)) return;
    visited.add(detail.key);
    document.querySelectorAll('[data-shift-count]').forEach(node => {
      node.textContent = 'Просмотрено ' + visited.size + ' из ' + CONTENT.tabs.length + ' разделов';
    });
    document.querySelectorAll('[data-shift-entry="' + detail.key + '"]').forEach(node => {
      node.classList.add('is-checked');
      node.querySelector('span').textContent = '■';
      node.setAttribute('aria-label', node.textContent.slice(1) + ': просмотрено');
    });
  });

}
