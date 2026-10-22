/**
 * book.js — Central handbook (Справочник для рекрутеров).
 * Handles cover, table of contents, side tabs, page-turn transitions, and bookmark ribbon.
 */

import { $, el, stepAnim } from '../core/dom.js';
import { drawSprite, ARSTOTZKA_CREST } from '../core/sprites.js';
import { bus } from '../core/bus.js';
import { CONTENT } from '../config/content.js';

export function initBook(audio) {
  const bookEl = $('.book');
  if (!bookEl) return;

  const leftPage = bookEl.querySelector('.page--left');
  const rightPage = bookEl.querySelector('.page--right');
  const tabsContainer = bookEl.querySelector('.book__tabs');
  const ribbon = bookEl.querySelector('.book__ribbon');
  const pageTurn = bookEl.querySelector('.page-turn');

  let activeTab = null;
  let navigationQueue = Promise.resolve();

  const redactedSurname = () => el('span', {
    class: 'classified',
    'aria-label': 'Фамилия засекречена',
  }, 'ЗАСЕКРЕЧЕНО');

  /* Render Cover (Left Page) */
  if (leftPage) {
    leftPage.replaceChildren();
    const emblemCanvas = drawSprite(ARSTOTZKA_CREST, { '#': '--paper' });
    emblemCanvas.style.width = 'calc(32 * var(--u))';
    emblemCanvas.style.height = 'calc(26 * var(--u))';

    const cover = el('div', { class: 'cover' },
      el('div', { class: 'cover__emblem' }, emblemCanvas),
      el('div', { class: 'cover__frame pxframe' },
        el('div', { class: 'cover__l1' }, CONTENT.cover.l1),
        el('div', { class: 'cover__l2' }, CONTENT.cover.l2),
        el('div', { class: 'cover__sub' }, CONTENT.cover.sub)
      )
    );
    leftPage.append(cover);
  }

  /* Render Tabs */
  if (tabsContainer) {
    tabsContainer.replaceChildren();
    CONTENT.tabs.forEach((tab) => {
      const btn = el('button', {
        class: 'tab',
        type: 'button',
        'data-tab': tab.key,
        'aria-haspopup': 'dialog',
        'aria-label': `Раздел: ${tab.label}`,
      }, tab.label);

      btn.addEventListener('click', () => {
        selectTab(tab.key);
      });

      tabsContainer.append(btn);
    });
  }

  /* Render TOC view into Right Page */
  function renderTOC() {
    rightPage.replaceChildren();

    const title = el('h2', { class: 'page__title' }, 'СОДЕРЖАНИЕ');
    const note = el('p', { class: 'page__note' }, 'СПРАВОЧНИК ИНСПЕКТОРА // ВЫБЕРИТЕ РАЗДЕЛ');
    const tocList = el('ul', { class: 'toc' });

    CONTENT.tabs.forEach((tab, index) => {
      const chip = el('button', {
        class: 'chip',
        type: 'button',
        'data-tab': tab.key,
        'aria-haspopup': 'dialog',
        'aria-label': `Открыть раздел ${tab.label}`,
      },
        el('span', { class: 'chip__marker' }),
        el('span', { class: 'chip__index' }, `0${index + 1}`),
        el('span', { class: 'chip__content' },
          el('span', { class: 'chip__text' }, tab.label),
          el('span', { class: 'chip__description' }, tab.blurb)
        )
      );

      chip.addEventListener('click', () => {
        selectTab(tab.key);
      });

      tocList.append(el('li', { class: 'toc__item' }, chip));
    });

    const contactChannel = CONTENT.contact.endpoint || CONTENT.contact.email || CONTENT.contact.telegram;
    const briefing = el('section', { class: 'page__briefing', 'aria-label': 'Краткая сводка кандидата' },
      el('h3', { class: 'page__briefing-title' }, 'КАРТОЧКА КАНДИДАТА'),
      el('dl', { class: 'page__briefing-data' },
        el('dt', {}, 'КАНДИДАТ'),
        el('dd', {}, CONTENT.owner.givenName + ' ', CONTENT.owner.surname || redactedSurname()),
        el('dt', {}, 'ГОРОД'),
        el('dd', {}, CONTENT.passport.city),
        el('dt', {}, 'СПЕЦИАЛЬНОСТЬ'),
        el('dd', {}, CONTENT.passport.major),
        el('dt', {}, 'ДЕЛА / ДОПУСКИ'),
        el('dd', {}, CONTENT.cases.length + ' / ' + CONTENT.workPass.length),
        el('dt', {}, 'КАНАЛ СВЯЗИ'),
        el('dd', {}, contactChannel ? 'НАСТРОЕН' : 'НЕ НАСТРОЕН')
      )
    );
    const ownerStamp = el('div', { class: 'owner-stamp' }, `СОБСТВЕННОСТЬ: ${CONTENT.owner.givenName.toUpperCase()}`);

    rightPage.append(title, note, tocList, briefing, ownerStamp);
  }

  function sectionDetails(key) {
    if (key === 'passport') return [
      ['ИМЯ', CONTENT.owner.givenName],
      ['ГРАЖДАНСТВО', CONTENT.passport.citizenship],
      ['ГОРОД', CONTENT.passport.documentCity],
      ['ГОД РОЖДЕНИЯ', String(CONTENT.passport.birthYear)],
      ['РОСТ', `${CONTENT.passport.heightCm} СМ`],
      ['ФАМИЛИЯ', CONTENT.owner.surname || redactedSurname()],
    ];
    if (key === 'pass') return CONTENT.workPass.map((category) => [category.title, category.items.join(' · ')]);
    if (key === 'cases') return CONTENT.cases.map((item) => [`№ ${item.no}`, item.title]);
    const channel = CONTENT.contact.endpoint || CONTENT.contact.email || CONTENT.contact.telegram;
    return [
      ['КАНАЛ', channel ? 'НАСТРОЕН' : 'НЕ НАСТРОЕН'],
      ['ЦЕЛИ', CONTENT.contact.purposes.join(' · ')],
    ];
  }

  /* Render Section view into Right Page */
  function renderSection(tabKey) {
    const tabData = CONTENT.tabs.find((t) => t.key === tabKey);
    if (!tabData) return renderTOC();

    rightPage.replaceChildren();

    const detailList = el('dl', { class: 'section-page__details' },
      ...sectionDetails(tabKey).flatMap(([label, value]) => [
        el('dt', {}, label),
        el('dd', {}, value),
      ])
    );
    const section = el('div', { class: 'section-page' },
      el('h2', { class: 'section-page__title' }, tabData.label),
      el('p', { class: 'section-page__blurb' }, tabData.blurb),
      detailList,
      el('button', {
        class: 'btn btn--primary',
        type: 'button',
        'data-open-doc': tabKey,
      }, `ПРЕДЪЯВИТЬ: ${tabData.label}`)
    );

    section.querySelector('[data-open-doc]').addEventListener('click', () => {
      bus.emit('doc:open', { key: tabKey });
    });

    rightPage.append(section);
  }

  /* Page turn transition with sound */
  async function triggerPageTurn(renderFn, onReveal = null) {
    audio.play('page', { gain: 0.8 });

    if (pageTurn) {
      pageTurn.classList.remove('is-wiping-out');
      pageTurn.classList.add('is-wiping-in');
      await stepAnim(pageTurn, 'is-wiping-in', 250);
      renderFn();
      onReveal?.();
      pageTurn.classList.remove('is-wiping-in');
      pageTurn.classList.add('is-wiping-out');
      await stepAnim(pageTurn, 'is-wiping-out', 250);
      pageTurn.classList.remove('is-wiping-out');
    } else {
      renderFn();
      onReveal?.();
    }
  }

  /* Select tab */
  function selectTab(tabKey, autoOpenDoc = true) {
    const task = navigationQueue.then(() => selectTabNow(tabKey, autoOpenDoc));
    navigationQueue = task.catch(() => {});
    return task;
  }

  async function selectTabNow(tabKey, autoOpenDoc) {
    if (activeTab === tabKey) {
      if (autoOpenDoc) bus.emit('doc:open', { key: tabKey });
      return;
    }

    activeTab = tabKey;

    /* Update tabs UI */
    const allTabs = tabsContainer.querySelectorAll('.tab');
    allTabs.forEach((t) => {
      const match = t.dataset.tab === tabKey;
      t.setAttribute('aria-current', String(match));
    });

    await triggerPageTurn(
      () => renderSection(tabKey),
      autoOpenDoc ? () => bus.emit('doc:open', { key: tabKey }) : null
    );
  }

  /* Reset to TOC */
  function resetToTOC() {
    const task = navigationQueue.then(resetToTOCNow);
    navigationQueue = task.catch(() => {});
    return task;
  }

  async function resetToTOCNow() {
    if (!activeTab) return;
    activeTab = null;

    const allTabs = tabsContainer.querySelectorAll('.tab');
    allTabs.forEach((t) => t.removeAttribute('aria-current'));

    await triggerPageTurn(() => {
      renderTOC();
    });

    bus.emit('doc:closeAll');
  }

  /* Bookmark Ribbon */
  if (ribbon) {
    ribbon.addEventListener('click', () => {
      resetToTOC();
    });
  }

  /* Initial render */
  renderTOC();

  bus.on('tab:select', (e) => {
    if (e.detail?.key) selectTab(e.detail.key, e.detail.autoOpen !== false);
  });

  bus.on('tab:reset', () => {
    resetToTOC();
  });

  return { selectTab, resetToTOC };
}
