/** Poll the local, source-filtered news endpoint without blocking the handbook. */

import { el } from '../core/dom.js';

const REFRESH_MS = 15 * 60 * 1000;

function readableItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => {
    if (!item || typeof item.title !== 'string' || !Number.isFinite(Date.parse(item.publishedAt))) return false;
    try {
      const url = new URL(item.href);
      return url.protocol === 'https:' && ['news.google.com', 'who.int', 'gov.kz', 'rospotrebnadzor.ru'].some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain));
    } catch { return false; }
  }).slice(0, 8);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(date);
}

function renderItems(list, items) {
  if (!list) return;
  list.replaceChildren(...items.map((item) => {
    const row = el('li', { class: 'dispatch__item' },
      el('span', { class: 'dispatch__category' }, item.category || item.source || 'СООБЩЕНИЕ'),
      el('h3', {}, item.title),
      item.summary ? el('p', {}, item.summary) : null,
      el('time', { datetime: item.publishedAt || '' }, item.dateLabel || formatDate(item.publishedAt)),
      el('a', { href: item.href, target: '_blank', rel: 'noopener noreferrer' }, 'Открыть сообщение ↗')
    );
    return row;
  }));
  list.setAttribute('aria-busy', 'false');
}

export function initNews() {
  const list = document.querySelector('[data-news-items]');
  const refreshButton = document.querySelector('[data-news-refresh]');
  const status = document.querySelector('[data-news-status]');
  const updated = document.querySelector('[data-news-updated]');
  const sheet = document.querySelector('.dispatch');
  const reader = document.querySelector('#news-reader');
  const openButton = document.querySelector('[data-news-open]');
  const preview = document.querySelector('[data-news-preview]');
  if (!list || !refreshButton || !status || !updated) return;

  // Keep one live newspaper. On compact screens it moves into an accessible reader.
  const compact = matchMedia('(max-width: 999px)');
  const desk = document.querySelector('#desk');
  function placeNewspaper() {
    if (!sheet || !reader || !desk) return;
    if (reader.open) reader.close();
    (compact.matches ? reader : desk).append(sheet);
  }
  placeNewspaper();
  compact.addEventListener('change', placeNewspaper);
  openButton?.addEventListener('click', () => {
    if (!reader || reader.open || !compact.matches) return;
    reader.showModal();
    openButton.setAttribute('aria-expanded', 'true');
  });
  document.querySelector('[data-news-close]')?.addEventListener('click', () => reader?.close());
  reader?.addEventListener('close', () => openButton?.setAttribute('aria-expanded', 'false'));
  reader?.addEventListener('click', (event) => {
    if (event.target !== reader) return;
    const bounds = reader.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) reader.close();
  });

  const renderContext = (items = []) => {
    renderItems(list, items);
    if (preview) preview.textContent = items.length + ' сообщений · читать газету';
  };
  let activeRequest = null;
  let lastUpdate = 0;
  function writeUpdated(value) {
    updated.textContent = value ? formatDate(value) + ' · ' + new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qyzylorda',
    }).format(new Date(value)) : '—';
  }
  try {
    const saved = JSON.parse(localStorage.getItem('post-news-v1') || 'null');
    if (saved?.items?.length && Number.isFinite(Date.parse(saved.checkedAt))) {
      renderContext(readableItems(saved.items));
      writeUpdated(saved.checkedAt);
    }
  } catch { /* storage is optional; the live feed still works */ }

  async function update({ force = false } = {}) {
    if (activeRequest) return activeRequest;
    refreshButton.disabled = true;
    refreshButton.setAttribute('aria-busy', 'true');
    list.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.textContent = 'Проверяем официальные ленты…';

    activeRequest = (async () => {
      try {
        const response = await fetch('/api/news' + (force ? '?refresh=1' : ''), {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error('news feed unavailable');
        const data = await response.json();
        const context = readableItems(data.context);
        const items = readableItems(data.items);
        if (items.length || context.length) {
          renderContext([...context, ...items]);
          writeUpdated(data.checkedAt);
          try { localStorage.setItem('post-news-v1', JSON.stringify({ items: [...context, ...items], checkedAt: data.checkedAt })); } catch { /* storage may be unavailable */ }
        }
        lastUpdate = Date.now();
        status.textContent = data.live
          ? items.length
            ? 'Проверено · сообщения выше'
            : 'Проверено · новых сообщений пока нет'
          : list.children.length
            ? 'Лента недоступна. Показан последний сохранённый выпуск.'
            : 'Лента недоступна. Датированные материалы из архива доступны ниже.';
        status.hidden = data.live && items.length > 0;
      } catch {
        list.setAttribute('aria-busy', 'false');
        status.hidden = false;
        status.textContent = list.children.length
          ? 'Связь с лентой прервана. Показан последний сохранённый выпуск.'
          : 'Лента временно недоступна. Датированные материалы из архива доступны ниже.';
      } finally {
        list.setAttribute('aria-busy', 'false');
        refreshButton.disabled = false;
        refreshButton.removeAttribute('aria-busy');
        activeRequest = null;
      }
    })();
    return activeRequest;
  }

  refreshButton.addEventListener('click', () => update({ force: true }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastUpdate >= REFRESH_MS) update();
  });
  window.setInterval(() => {
    if (!document.hidden) update();
  }, REFRESH_MS);
  update();

  return { refresh: () => update({ force: true }) };
}
