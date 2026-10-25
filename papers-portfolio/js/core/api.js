/** Public API routing. No bot credentials are shipped to the browser. */
const hosted = ['tair0.me', 'www.tair0.me'].includes(location.hostname);
const origin = hosted ? 'https://tair-portfolio-api.spicytitan257.chatgpt.site' : '';
let visitorId;
function visitor() {
  if (visitorId) return visitorId;
  let saved;
  try { saved = localStorage.getItem('inspector.api.visitor'); } catch { /* cookies remain available */ }
  if (!/^[a-f0-9]{64}$/.test(saved || '')) saved = document.cookie.split('; ').find(value => value.startsWith('inspector_visitor='))?.split('=')[1];
  visitorId = /^[a-f0-9]{64}$/.test(saved || '') ? saved : [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem('inspector.api.visitor', visitorId); } catch { /* per-visit fallback */ }
  document.cookie = 'inspector_visitor=' + visitorId + '; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  return visitorId;
}
export function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers);
  if (hosted && path.startsWith('/api/contact')) headers.set('X-Visitor-ID', visitor());
  return fetch(origin + path, { ...options, headers, credentials: hosted ? 'omit' : 'same-origin' });
}
