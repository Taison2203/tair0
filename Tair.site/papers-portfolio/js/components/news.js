/** Poll the local, source-filtered news endpoint without blocking the handbook. */

import { el } from '../core/dom.js';

const REFRESH_MS = 15 * 60 * 1000;

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
  if (!list || !refreshButton || !status || !updated) return;

  const renderContext = (items = []) => renderItems(list, items);
  let activeRequest = null;
  let lastUpdate = 0;

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
        const context = Array.isArray(data.context) ? data.context : [];
        const items = Array.isArray(data.items) ? data.items : [];
        renderContext([...context, ...items]);
        updated.textContent = data.checkedAt ? formatDate(data.checkedAt) + ' · ' + new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(data.checkedAt)) : '—';
        lastUpdate = Date.now();
        status.textContent = data.live
          ? items.length
            ? 'Проверено · сообщения выше'
            : 'Проверено · новых сообщений пока нет'
          : 'Архив сейчас недоступен. Проверьте подключение или нажмите ↻.';
        status.hidden = data.live && items.length > 0;
      } catch {
        list.setAttribute('aria-busy', 'false');
        status.hidden = false;
        status.textContent = 'Не удалось подключиться к ленте. Официальная сводка выше доступна по ссылке.';
      } finally {
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
