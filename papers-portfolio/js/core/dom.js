/**
 * dom.js — DOM helpers, animation waiters, selectors.
 */

import { t } from './i18n.js?v=access-1';

/** querySelector shorthand. */
export const $ = (sel, root = document) => root.querySelector(sel);

/** querySelectorAll as array shorthand. */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Sleep for ms milliseconds. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for CSS animation to end on element `el` after adding class `cls`.
 * Falls back to `fallbackMs` timeout if animationend never fires
 * (e.g. prefers-reduced-motion).
 */
export function stepAnim(el, cls, fallbackMs = 900) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      el.removeEventListener('animationend', onEnd);
      resolve();
    };
    const onEnd = (e) => {
      if (e.target === el) finish();
    };
    const t = setTimeout(finish, fallbackMs);
    el.addEventListener('animationend', onEnd);
    el.classList.add(cls);
  });
}

/**
 * Remove animation class after it ends.
 */
export function removeAfterAnim(el, cls, fallbackMs = 900) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      el.removeEventListener('animationend', onEnd);
      el.classList.remove(cls);
      resolve();
    };
    const onEnd = (e) => {
      if (e.target === el) finish();
    };
    const t = setTimeout(finish, fallbackMs);
    el.addEventListener('animationend', onEnd);
  });
}

/**
 * Create a DOM element with optional attributes and children.
 */
export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  const copy = value => Object.hasOwn(attrs,'data-no-translate') ? value : t(value);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('aria')) e.setAttribute(k.replace(/([A-Z])/g, '-$1').toLowerCase(), k === 'aria-label' || k === 'ariaLabel' ? t(v) : v);
    else e.setAttribute(k, ['alt','title','placeholder'].includes(k) ? t(v) : v);
  }
  for (const child of children) {
    if (typeof child === 'string') e.append(document.createTextNode(copy(child)));
    else if (child) e.append(child);
  }
  return e;
}

/**
 * Get CSS custom property value from root.
 */
export function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Deterministic PRNG (Mulberry32).
 */
export function mulberry32(a) {
  return () => {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
