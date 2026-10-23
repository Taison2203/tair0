/**
 * scale.js — 1 unit = whole number of physical pixels on any DPR/zoom.
 */
export function initScale() {
  const apply = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = innerWidth;
    const h = innerHeight;
    const target = (w >= 2400 && h >= 1300) ? 4 : (w >= 1600 && h >= 900) ? 3 : 2;
    const k = Math.max(1, Math.round(target * dpr));
    document.documentElement.style.setProperty('--u', `${k / dpr}px`);
  };
  apply();
  addEventListener('resize', apply, { passive: true });
}
