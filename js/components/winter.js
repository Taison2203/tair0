import { playWinterBells } from '../audio/winterBells.js';
import { startSnowfall } from './snowfall.js?v=4';

export function decorateWinter() {
  const gust = startSnowfall();
  const crest = document.querySelector('#language-screen img');
  if (crest) crest.src = 'assets/img/eagle-winter.svg';
  const introSnow = document.createElement('span');
  introSnow.className = 'winter-intro-snow';
  introSnow.setAttribute('aria-hidden', 'true');
  document.querySelector('#brand-intro')?.append(introSnow);
  return gust;
}

function ring(audio) {
  if (!audio.muted && audio.ctx?.state === 'running') {
    playWinterBells(audio.ctx, 'card', 0, audio.sfxBus);
  }
}

export function initWinterSecrets(audio, language, gust) {
  const english = language === 'en';
  const notice = document.createElement('p');
  notice.className = 'winter-secret';
  notice.setAttribute('role', 'status');
  document.body.append(notice);
  let timeout;
  function reveal(message) {
    clearTimeout(timeout);
    notice.textContent = message;
    timeout = setTimeout(() => { notice.textContent = ''; }, 4200);
  }
  function onRepeatedClick(selector, title, callback) {
    const target = document.querySelector(selector);
    if (!target) return;
    let count = 0;
    let last = 0;
    target.addEventListener('click', () => {
      const now = performance.now();
      count = now - last > 2500 ? 1 : count + 1;
      last = now;
      if (count === 3) {
        count = 0;
        callback();
        reveal(title);
      }
    });
  }
  onRepeatedClick('.desk-lamp', english ? 'Weather report intercepted · Blizzard over Pavlton.' :
    'Перехвачена метеосводка · над Павлтоном метель.', () => gust?.());
  onRepeatedClick('[data-desk-photo]', english ? 'Track in the snow · A sleigh passed the post.' :
    'След на снегу · мимо поста проехали сани.', () => ring(audio));
}

export function addWinterCard(audio, language) {
  const journal = document.querySelector('.page--left');
  if (!journal) return;
  const card = document.createElement('details');
  card.className = 'winter-card';
  const flap = document.createElement('summary');
  const greeting = document.createElement('strong');
  const message = document.createElement('p');
  const english = language === 'en';
  flap.textContent = english ? 'Letter for the next shift' : 'Письмо следующей смене';
  greeting.textContent = english ? 'HAPPY NEW YEAR!' : 'С НОВЫМ ГОДОМ!';
  message.textContent = english ? 'I left the lamp on. Safe travels home. — The night inspector' :
    'Лампу оставил включённой. Доброй дороги домой. — Ночной инспектор';
  const secret = document.createElement('button');
  secret.type = 'button';
  secret.className = 'winter-card__seal';
  secret.textContent = english ? 'Turn over the seal' : 'Перевернуть печать';
  secret.addEventListener('click', () => {
    message.textContent = english ? 'P.S. The supply office denies receiving three sacks of mandarins.' :
      'P. S. Отдел снабжения отрицает получение трёх мешков мандаринов.';
    ring(audio);
  }, { once: true });
  card.append(flap, greeting, message, secret);
  card.addEventListener('toggle', () => {
    if (card.open) ring(audio);
  });
  const narrow = matchMedia('(max-width: 720px)');
  const placeCard = () => {
    if (narrow.matches) document.querySelector('.site-footer')?.prepend(card);
    else journal.after(card);
  };
  narrow.addEventListener('change', placeCard);
  placeCard();
}
