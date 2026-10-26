/** Eight independent portraits. Original crops remain available alongside pixel editions. */
import { el } from '../core/dom.js';
import { bus } from '../core/bus.js';

const PHOTOS = [
  ['Портрет', 'Портрет инспектора на оливковом фоне'],
  ['За столом', 'Инспектор в белой футболке за столом с двумя десертами'],
  ['В соломенной шляпе', 'Инспектор в соломенной шляпе с красными завязками'],
  ['В светлой куртке', 'Инспектор в светлой куртке с цепочкой на серо-синем фоне'],
  ['В розовых очках', 'Инспектор в розовых очках и бордовом пиджаке держит предмет в обёртке'],
  ['С документами', 'Инспектор в чёрных очках и кожаной куртке показывает раскрытый документ'],
  ['В чёрных очках', 'Крупный портрет инспектора в чёрных очках и кожаной куртке'],
  ['В камуфляже', 'Инспектор в камуфляжной кепке и рубашке на зелёном фоне'],
].map(([title, alt], index) => ({ title, alt, id: String(index + 1).padStart(2, '0') }));

export function initGallery(audio) {
  const dialog = document.querySelector('#doc-gallery');
  if (!dialog) return;
  const album = dialog.querySelector('.gallery');
  const sheet = dialog.querySelector('[data-gallery-sheet]');
  const view = dialog.querySelector('[data-gallery-view]');
  const grid = dialog.querySelector('.gallery__grid');
  const image = dialog.querySelector('[data-gallery-image]');
  const stage = dialog.querySelector('.gallery-view__stage');
  const originalButton = dialog.querySelector('[data-gallery-original]');
  const zoomButton = dialog.querySelector('[data-gallery-zoom]');
  const download = dialog.querySelector('[data-gallery-download]');
  let index = 0;
  let original = false;
  let enlarged = false;
  let savedScroll = 0;
  const cards = [];

  PHOTOS.forEach((photo, i) => {
    const button = el('button', { class: 'gallery-photo', type: 'button', 'aria-label': 'Открыть фото ' + photo.id + ': ' + photo.title },
      el('span', { class: 'gallery-photo__image' }, el('img', { src: 'assets/img/gallery/' + photo.id + '.png', alt: photo.alt, width: '384', height: '512', loading: 'lazy', decoding: 'async' })),
      el('span', { class: 'gallery-photo__caption' }, el('span', { class: 'gallery-photo__number' }, photo.id), el('span', {}, photo.title)),
    );
    button.addEventListener('click', () => {
      savedScroll = album.scrollTop;
      sheet.hidden = true;
      view.hidden = false;
      open(i);
      dialog.querySelector('[data-gallery-back]').focus({ preventScroll: true });
    });
    cards.push(button);
    grid.append(button);
  });

  function renderImage() {
    const photo = PHOTOS[index];
    image.src = 'assets/img/gallery/' + (original ? 'originals/' : '') + photo.id + '.png';
    image.alt = photo.alt + (original ? '. Исходный кадр' : '. Пиксельная версия');
    stage.classList.toggle('is-enlarged', enlarged);
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    originalButton.setAttribute('aria-pressed', String(original));
    originalButton.textContent = original ? 'Показать пиксельную версию' : 'Показать исходник';
    zoomButton.setAttribute('aria-pressed', String(enlarged));
    zoomButton.textContent = enlarged ? 'Уместить в окне' : 'Увеличить ×2';
    dialog.querySelector('[data-gallery-counter]').textContent = photo.id + ' / 08 · ' + (original ? 'ИСХОДНИК' : 'ПИКСЕЛЬНАЯ ВЕРСИЯ');
    dialog.querySelector('[data-gallery-caption]').textContent = photo.title;
    download.href = image.src;
    download.download = 'inspector-' + photo.id + (original ? '-original' : '-pixel') + '.png';
  }
  function open(next) {
    index = (next + PHOTOS.length) % PHOTOS.length;
    enlarged = false;
    album.scrollTop = 0;
    renderImage();
    audio.play('paper', { gain: .45 });
  }
  function back() {
    view.hidden = true;
    sheet.hidden = false;
    enlarged = false;
    album.scrollTop = savedScroll;
    cards[index].focus({ preventScroll: true });
    audio.play('paper', { gain: .4 });
  }
  dialog.querySelector('[data-gallery-back]').addEventListener('click', back);
  dialog.querySelector('[data-gallery-prev]').addEventListener('click', () => open(index - 1));
  dialog.querySelector('[data-gallery-next]').addEventListener('click', () => open(index + 1));
  originalButton.addEventListener('click', () => { original = !original; renderImage(); audio.play('tick', { gain: .4 }); });
  zoomButton.addEventListener('click', () => { enlarged = !enlarged; renderImage(); });
  dialog.addEventListener('keydown', event => {
    if (view.hidden || enlarged || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    open(index + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  bus.on('doc:opened', ({ detail }) => {
    if (detail.key !== 'gallery') return;
    sheet.hidden = false;
    view.hidden = true;
    original = false;
    enlarged = false;
    album.scrollTop = 0;
  });
}
