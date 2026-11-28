import { createDialogSnow } from './dialogSnow.js';

const surfacesSelector = '.book, .desk-file, .secret-note, .board-invitation, .news-button, .dispatch, .scanner, .clock, .shift-music';
const snowColors = ['#edf7fc', '#c9e1ef', '#a8c5da'];
const segmentWidth = 12;
const meltPerSecond = .32;
const randomBetween = (low, high) => low + Math.random() * (high - low);

export function startSnowfall() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.className = 'winter-snow';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 720px)');
  const desk = document.querySelector('#desk');
  const dialogSnow = createDialogSnow(refresh);
  const flakes = [];
  const byElement = new WeakMap();
  let surfaces = [];
  let width, height, frame = 0, last = 0, measureAt = 0, gustEnd = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const scale = Math.min(devicePixelRatio, narrow.matches ? 1 : 1.5);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    dialogSnow?.resize(width, height, scale);
    measureAt = 0;
  }

  function measureSurfaces() {
    if (document.body.dataset.phase !== 'shift') {
      surfaces = [];
      return;
    }
    surfaces = [];
    for (const element of desk.querySelectorAll(surfacesSelector)) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.top < 0 || rect.top > height) continue;
      let bins = byElement.get(element);
      const count = Math.max(1, Math.ceil(rect.width / segmentWidth));
      if (!bins || bins.length !== count) {
        const book = element.matches('.book');
        bins = Array.from({ length: count }, () => randomBetween(book ? 2 : 1, book ? 5 : 3));
        byElement.set(element, bins);
      }
      surfaces.push({ rect, bins });
    }
    surfaces.sort((first, second) => first.rect.top - second.rect.top);
  }

  function resetFlake(flake, scattered = false) {
    flake.x = randomBetween(0, width);
    flake.y = scattered ? randomBetween(0, height) : randomBetween(-70, -4);
    flake.size = Math.random() < .14 ? 4 : Math.random() < .55 ? 2 : 3;
    flake.fall = randomBetween(27, 79);
    flake.drift = randomBetween(-10, 18);
    flake.color = snowColors[Math.floor(Math.random() * snowColors.length)];
    flake.alpha = randomBetween(.42, .88);
  }

  function drawBanks(storm, delta) {
    context.globalAlpha = .89;
    for (const { rect, bins } of surfaces) {
      bins.forEach((depth, index) => {
        const left = rect.left + index * segmentWidth;
        const span = Math.min(segmentWidth, rect.right - left);
        const pixels = Math.round(depth);
        if (pixels < 1) return;
        context.fillStyle = '#9fbecf';
        context.fillRect(Math.round(left), Math.round(rect.top), span, 2);
        context.fillStyle = '#e2f1f7';
        context.fillRect(Math.round(left), Math.round(rect.top) - pixels, span, pixels + 1);
        if (!storm && depth > 3) bins[index] = Math.max(3, depth - delta * meltPerSecond);
      });
    }
    context.globalAlpha = 1;
  }

  function draw(now) {
    frame = 0;
    if (document.hidden) return;
    const delta = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    if (now >= measureAt) {
      measureSurfaces();
      measureAt = now + 120;
    }
    const storm = document.body.dataset.phase === 'shift' && desk.dataset.lamp === 'off';
    const gust = now < gustEnd;
    const count = narrow.matches ? (storm || gust ? 100 : 48) : (storm || gust ? 215 : 102);
    context.clearRect(0, 0, width, height);
    if (!reduced.matches) {
      while (flakes.length < count) {
        const flake = {};
        resetFlake(flake, true);
        flakes.push(flake);
      }
      if (flakes.length > count) flakes.length = count;
      for (const flake of flakes) {
        const previous = flake.y;
        flake.y += flake.fall * delta * (storm ? 1.4 : 1);
        flake.x += (flake.drift + (storm || gust ? 32 : 0)) * delta;
        if (flake.x > width + 4) flake.x = -4;
        if (flake.x < -4) flake.x = width + 4;
        const landing = surfaces.find(({ rect }) =>
          previous < rect.top && flake.y >= rect.top && flake.x >= rect.left && flake.x < rect.right);
        if (landing) {
          const index = Math.floor((flake.x - landing.rect.left) / segmentWidth);
          const limit = storm ? 15 : 7;
          if (landing.bins[index] < limit) {
            landing.bins[index] = Math.min(limit, landing.bins[index] + flake.size * .52);
          }
          resetFlake(flake);
        } else if (flake.y > height + 4) resetFlake(flake);
        context.globalAlpha = flake.alpha;
        context.fillStyle = flake.color;
        context.fillRect(Math.round(flake.x), Math.round(flake.y), flake.size, flake.size);
      }
    }
    drawBanks(storm, reduced.matches ? 0 : delta);
    dialogSnow?.draw(delta, reduced.matches, storm);
    if (!reduced.matches) frame = requestAnimationFrame(draw);
  }

  function refresh() {
    measureAt = 0;
    if (!frame && !document.hidden) {
      last = 0;
      frame = requestAnimationFrame(draw);
    }
  }
  addEventListener('resize', () => { resize(); refresh(); });
  addEventListener('scroll', refresh, { passive: true });
  document.addEventListener('visibilitychange', refresh);
  reduced.addEventListener('change', refresh);
  new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['data-phase'] });
  resize();
  refresh();
  return () => { gustEnd = performance.now() + 5200; refresh(); };
}
