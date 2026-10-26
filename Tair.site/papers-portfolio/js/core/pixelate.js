/**
 * pixelate.js — Load an image and apply ordered Bayer 4×4 dithering
 * to produce a 4-color pixel portrait, or generate a procedural silhouette.
 */

import { css } from './dom.js?v=sfx-2';

const BAYER_4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

/**
 * Create a pixelated portrait canvas.
 * @param {string} src — path to photo (or '' for procedural silhouette)
 * @param {number} w — target width in logical pixels
 * @param {number} h — target height in logical pixels
 * @param {boolean} pixelArt — display supplied pixel art without a second dithering pass
 * @returns {Promise<HTMLCanvasElement|HTMLImageElement>}
 */
export async function makePortrait(src, w = 40, h = 52, pixelArt = false) {
  // Supplied pixel art already has its own palette and pixel grid. Keep both intact.
  if (src && pixelArt) {
    const image = new Image();
    image.className = 'px';
    image.alt = 'Пиксельный портрет инспектора Таира';
    image.width = w;
    image.height = h;
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = src;
      });
      return image;
    } catch { /* use the procedural portrait when the asset is missing */ }
  }
  const colors = [
    css('--desk-1'),
    css('--swamp'),
    css('--olive-d'),
    css('--paper'),
  ];

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.className = 'px';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Фотография кандидата');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let sourceData;

  if (src) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });

      /* Cover-crop into w×h */
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tc = tmp.getContext('2d');
      tc.imageSmoothingQuality = 'high';
      tc.imageSmoothingEnabled = true;

      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      tc.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);

      sourceData = tc.getImageData(0, 0, w, h);
    } catch {
      sourceData = null; /* fall through to silhouette */
    }
  }

  if (!sourceData) {
    /* Procedural silhouette */
    drawSilhouette(ctx, w, h, colors);
    return canvas;
  }

  /* Brightness extraction + contrast stretch */
  const d = sourceData.data;
  const grey = new Float32Array(w * h);
  let min = 255, max = 0;
  for (let i = 0; i < w * h; i++) {
    const v = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
    grey[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;

  /* Ordered dither Bayer 4×4 into 4 colors */
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const norm = (grey[y * w + x] - min) / range; /* 0..1 */
      const threshold = BAYER_4[y % 4][x % 4] / 16;
      const idx = Math.min(3, Math.max(0, Math.floor(norm * 4 + threshold - 0.5)));
      ctx.fillStyle = colors[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return canvas;
}

/**
 * Draw a simple silhouette when no photo is available.
 */
function drawSilhouette(ctx, w, h, colors) {
  /* Fill with darkest */
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);

  /* Head (circle approximation) */
  const cx = Math.floor(w / 2);
  const headR = Math.floor(w * 0.22);
  const headY = Math.floor(h * 0.28);
  ctx.fillStyle = colors[2];
  for (let y = -headR; y <= headR; y++) {
    for (let x = -headR; x <= headR; x++) {
      if (x * x + y * y <= headR * headR) {
        ctx.fillRect(cx + x, headY + y, 1, 1);
      }
    }
  }

  /* Shoulders (trapezoid) */
  const shY = headY + headR + 2;
  ctx.fillStyle = colors[1];
  for (let dy = 0; dy < h - shY; dy++) {
    const half = Math.min(Math.floor(w / 2) - 1, Math.floor(headR * 0.7) + dy);
    for (let x = cx - half; x <= cx + half; x++) {
      if (x >= 0 && x < w) ctx.fillRect(x, shY + dy, 1, 1);
    }
  }

  /* Question mark */
  const qx = cx - 2;
  const qy = headY - 3;
  ctx.fillStyle = colors[3];
  [
    [1,0],[2,0],[3,0],
    [3,1],
    [2,2],[3,2],
    [2,3],
    [2,5],
  ].forEach(([dx, dy]) => ctx.fillRect(qx + dx, qy + dy, 1, 1));
}
