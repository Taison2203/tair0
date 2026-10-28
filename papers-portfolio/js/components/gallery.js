/** Watermarked previews. Browser controls are deterrents, not screenshot protection. */
import { el } from '../core/dom.js?v=identity-1';
import { bus } from '../core/bus.js?v=identity-1';
import { t } from '../core/i18n.js?v=identity-1';

const PHOTOS = [
  ['Портрет', 'Портрет инспектора на оливковом фоне'],
  ['В чёрных очках', 'Портрет инспектора на оливковом фоне'],
  ['В соломенной шляпе', 'Инспектор в соломенной шляпе с красными завязками'],
  ['В светлой куртке', 'Инспектор в светлой куртке с цепочкой на серо-синем фоне'],
  ['В розовых очках', 'Инспектор в розовых очках и бордовом пиджаке держит предмет в обёртке'],
  ['С документами', 'Инспектор в чёрных очках и кожаной куртке показывает раскрытый документ'],
  ['В чёрных очках', 'Крупный портрет инспектора в чёрных очках и кожаной куртке'],
  ['В камуфляже', 'Инспектор в камуфляжной кепке и рубашке на зелёном фоне'],
].map(([title, alt], index) => ({ title, alt, id: String(index + 1).padStart(2, '0') }));

function paintPreview(canvas, photo) {
  canvas.setAttribute('aria-label', photo.alt + '. Превью с водяным знаком Таира');
  const source = new Image();
  source.onload = () => {
    // Ignore a late response after the viewer has moved to another photograph.
    if (canvas.dataset.photo !== photo.id) return;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, 384, 512);
    const scale = Math.min(384 / source.naturalWidth, 512 / source.naturalHeight);
    const width = Math.round(source.naturalWidth * scale);
    const height = Math.round(source.naturalHeight * scale);
    c.drawImage(source, Math.floor((384 - width) / 2), Math.floor((512 - height) / 2), width, height);
    // The public PNG already contains a flattened watermark. No clean original
    // is supplied to the renderer; browser restrictions are only an extra deterrent.
  };
  source.onerror = () => {
    if (canvas.dataset.photo !== photo.id) return;
    const c = canvas.getContext('2d');
    c.fillStyle = '#252820'; c.fillRect(0, 0, 384, 512);
    c.fillStyle = '#d8cf9b'; c.font = '14px monospace';
    c.fillText(t('Фото временно недоступно'), 30, 256);
  };
  canvas.dataset.photo = photo.id;
  source.src = 'assets/img/gallery/preview-' + photo.id + '.png?v=photo02-replaced-1';
}

export function protectedPhoto(id, label = '') {
  const photo = PHOTOS.find(photo => photo.id === id);
  const canvas = el('canvas', { class: 'protected-photo', width: '384', height: '512', role: 'img', draggable: 'false' });
  for (const type of ['contextmenu', 'dragstart', 'copy', 'cut']) canvas.addEventListener(type, event => event.preventDefault());
  if (label) canvas.setAttribute('aria-label', label);
  paintPreview(canvas, photo);
  return canvas;
}

export function initGallery(audio) {
  const dialog = document.querySelector('#doc-gallery');
  if (!dialog) return;
  const album = dialog.querySelector('.gallery');
  const sheet = dialog.querySelector('[data-gallery-sheet]');
  const view = dialog.querySelector('[data-gallery-view]');
  const grid = dialog.querySelector('.gallery__grid');
  const image = protectedPhoto('01');
  image.setAttribute('data-gallery-image', '');
  dialog.querySelector('[data-gallery-image]').replaceWith(image);
  const stage = dialog.querySelector('.gallery-view__stage');
  const zoomButton = dialog.querySelector('[data-gallery-zoom]');
  let index = 0;
  let enlarged = false;
  let savedScroll = 0;
  const cards = [];

  PHOTOS.forEach((photo, i) => {
    const button = el('button', { class: 'gallery-photo', type: 'button', 'aria-label': 'Открыть фото ' + photo.id + ': ' + photo.title },
      el('span', { class: 'gallery-photo__image' }, protectedPhoto(photo.id)),
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
    paintPreview(image, photo);
    stage.classList.toggle('is-enlarged', enlarged);
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    zoomButton.setAttribute('aria-pressed', String(enlarged));
    zoomButton.textContent = enlarged ? 'Уместить в окне' : 'Увеличить ×2';
    dialog.querySelector('[data-gallery-counter]').textContent = photo.id + ' / 08 · ЛИЧНЫЙ АРХИВ';
    dialog.querySelector('[data-gallery-caption]').textContent = photo.title;
  }
  function open(next, sliding = false) {
    const direction = next < index ? -.25 : .25;
    index = (next + PHOTOS.length) % PHOTOS.length;
    enlarged = false;
    album.scrollTop = 0;
    renderImage();
    audio.play(sliding ? 'photoSlide' : 'photoPick', { pan: sliding ? direction : 0 });
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
  dialog.querySelector('[data-gallery-prev]').addEventListener('click', () => open(index - 1, true));
  dialog.querySelector('[data-gallery-next]').addEventListener('click', () => open(index + 1, true));
  zoomButton.addEventListener('click', () => { enlarged = !enlarged; audio.play('zoom', { rate: enlarged ? 1 : .85 }); renderImage(); });
  dialog.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && ['s', 'p', 'c', 'x'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      return;
    }
    if (view.hidden || enlarged || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    open(index + (event.key === 'ArrowLeft' ? -1 : 1), true);
  });
  bus.on('doc:opened', ({ detail }) => {
    if (detail.key !== 'gallery') return;
    sheet.hidden = false;
    view.hidden = true;
    enlarged = false;
    album.scrollTop = 0;
  });
}
