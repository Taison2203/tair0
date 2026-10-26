/** One-at-a-time citation queue with dialog-safe popover layering. */

import { $, el, sleep, stepAnim } from '../core/dom.js?v=access-1';
import { bus } from '../core/bus.js?v=access-1';
import { t, getLocale } from '../core/i18n.js?v=access-1';

export function initReceipts(audio) {
  const container = $('#receipts');
  if (!container) return { printReceipt: () => Promise.resolve(null), dismissReceipt: () => {} };

  const queue = [];
  const recent = new Map();
  let current = null;
  let processing = false;
  let sequence = 0;

  function placeContainer() {
    // A top-layer popover outside a modal can still be inert. Keep the receipt
    // inside the active dialog so it remains clickable and accessible.
    const dialogs=[...document.querySelectorAll('dialog[open]')];
    const host=dialogs[dialogs.length-1] || document.body;
    if(container.parentElement!==host)host.append(container);
  }

  function showContainer() {
    placeContainer();
    container.classList.add('is-visible');
    if (typeof container.showPopover === 'function' && !container.matches(':popover-open')) {
      try { container.showPopover(); } catch { /* a concurrent top-layer change is harmless */ }
    }
  }

  function hideContainer() {
    container.classList.remove('is-visible');
    if (typeof container.hidePopover === 'function' && container.matches(':popover-open')) {
      try { container.hidePopover(); } catch { /* older engines may not expose popover state */ }
    }
  }

  function bumpToTop() {
    if (!current || typeof container.showPopover !== 'function') return;
    placeContainer();
    if (container.matches(':popover-open')) {
      try { container.hidePopover(); } catch { return; }
      try { container.showPopover(); } catch { /* leave the current receipt visible in place */ }
    } else showContainer();
  }

  function dismissReceipt(receipt, callback) {
    if (!receipt || receipt.closing) return receipt?.closed || Promise.resolve();
    receipt.closing = true;
    window.clearTimeout(receipt.dismissTimer);
    audio.play('paper', { gain: 0.7 });
    const task = stepAnim(receipt.element, 'is-leaving', matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 350)
      .then(() => {
        receipt.element.remove();
        if (current === receipt) {
          current = null;
          hideContainer();
        }
        if (callback) callback();
        receipt.resolveClosed();
      });
    receipt.closed = task;
    return task;
  }

  async function present(record) {
    // Keep the two training papers and decision stamps unobstructed. The final
    // shift receipt is delivered when the inspector returns to the desk.
    while (document.querySelector('#doc-inspection[open]')) {
      await new Promise(resolve => {
        const off = bus.on('doc:closed', ({ detail }) => {
          if (detail.key === 'inspection') { off(); resolve(); }
        });
      });
    }
    sequence += 1;
    const now = new Date();
    const date = new Intl.DateTimeFormat(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
    const time = new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
    const id = String(sequence).padStart(4, '0');
    const header = t(record.header || 'ПРЕДУПРЕЖДЕНИЕ АРСТОТЦКИ');
    const meta = t(record.meta || 'ПРОТОКОЛ М.О.А.') + ' · ' + date + ' ' + time + ' · № ' + id;
    const element = el('button', {
      class: 'receipt', type: 'button',
      'aria-label': header + '. ' + String(record.text || '') + '. Нажмите, чтобы убрать уведомление.',
    },
      el('span', { class: 'receipt__header' }, header),
      el('span', { class: 'receipt__meta' }, meta),
      el('span', { class: 'receipt__text is-typing', 'data-no-translate': '' }, '')
    );
    let resolveClosed;
    const receipt = {
      element,
      closing: false,
      closed: new Promise((resolve) => { resolveClosed = resolve; }),
      resolveClosed: () => resolveClosed?.(),
      dismissTimer: 0,
    };
    current = receipt;
    showContainer();
    container.append(element);
    element.addEventListener('click', () => dismissReceipt(receipt, record.onDismiss));
    audio.play('paper', { gain: 0.85 });
    await stepAnim(element, 'is-entering', matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : 500);
    element.classList.remove('is-entering');

    const text = t(record.text || '');
    const textEl = element.querySelector('.receipt__text');
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (let index = 0; index < text.length; index += 1) {
      if (receipt.closing || !element.isConnected) break;
      textEl.textContent += text[index];
      if (!fast && index % 2 === 0) audio.play('key', { gain: 0.25 });
      if (!fast) await sleep(38);
    }
    textEl.classList.remove('is-typing');
    if (!receipt.closing) audio.play('ding');

    if (!fast && !receipt.closing) {
      receipt.dismissTimer = window.setTimeout(() => dismissReceipt(receipt, record.onDismiss), 4500);
    } else if (!receipt.closing) {
      receipt.dismissTimer = window.setTimeout(() => dismissReceipt(receipt, record.onDismiss), 4500);
    }
    await receipt.closed;
    record.resolve?.(element);
  }

  async function drainQueue() {
    if (processing) return;
    processing = true;
    while (queue.length) {
      const record = queue.shift();
      await present(record);
    }
    processing = false;
    if (!current) hideContainer();
  }

  function printReceipt(record = {}) {
    const text = String(record.text || '');
    const now = Date.now();
    const last = recent.get(text) || 0;
    if (text && now - last < 1500) return Promise.resolve(null);
    if (text) recent.set(text, now);
    for (const [message, timestamp] of recent) {
      if (now - timestamp > 10000) recent.delete(message);
    }
    const queueLimit = current ? 2 : 3;
    if (queue.length >= queueLimit) queue.shift()?.resolve(null);
    const completion = new Promise((resolve) => {
      queue.push({ ...record, text, resolve });
    });
    void drainQueue();
    return completion;
  }

  bus.on('receipt:print', (event) => {
    if (event.detail) void printReceipt(event.detail);
  });
  bus.on('doc:opened', ({ detail }) => {
    if (detail.key === 'inspection') {
      hideContainer();
      if (current) void dismissReceipt(current);
    } else bumpToTop();
  });
  bus.on('doc:closed',()=>{if(current && !current.closing)showContainer();});

  return { printReceipt, dismissReceipt };
}
