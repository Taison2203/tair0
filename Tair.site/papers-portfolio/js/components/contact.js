/** Official form: real server acknowledgment precedes the approval stamp and filing animation. */
import { el, sleep, stepAnim } from '../core/dom.js?v=sfx-2';
import { bus } from '../core/bus.js?v=sfx-2';
import { CONTENT } from '../config/content.js?v=sfx-2';
import { apiFetch } from '../core/api.js?v=sfx-2';

const STORAGE_KEY = 'inspector.feedback.v1';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initContact({ audio, makeStamp }) {
  const dialog = document.querySelector('#doc-contact');
  const form = dialog?.querySelector('form');
  if (!form) return;
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector('.request__status');
  const stampArea = form.querySelector('.request__stamp');
  const result = dialog.querySelector('.submission-result');
  const purpose = form.querySelector('[name="purpose"]');
  purpose.replaceChildren(...CONTENT.contact.purposes.map(value => el('option', { value }, value)));
  let busy = false;
  let filed = false;
  let ready = false;
  let telegramLinked = false;
  let syncing = false;
  let linkExpires = 0;
  const binding = form.querySelector('.telegram-binding');
  const telegramLink = form.querySelector('[data-telegram-link]');
  async function prepareLink() {
    if (!telegramLink || Date.now() < linkExpires) return;
    const r = await apiFetch('/api/telegram/link', { method: 'POST' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Не удалось получить пропуск.');
    telegramLink.href = data.url;
    telegramLink.textContent = 'ПОДТВЕРДИТЬ В TELEGRAM →';
    telegramLink.setAttribute('aria-disabled', 'false');
    linkExpires = Date.now() + (data.expiresIn - 10) * 1000;
  }
  let localReceipt = null;
  try { localReceipt = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* cookies and server remain authoritative */ }

  function showStatus(message, error = false) {
    status.textContent = message;
    status.className = 'request__status' + (error ? ' is-error' : '');
  }
  function remember(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ receiptId: data.receiptId, receivedAt: data.receivedAt, status: data.status })); } catch { /* server cookie still prevents duplicates */ }
  }
  function showFiled(data, pending = false) {
    filed = true;
    submit.disabled = true;
    form.hidden = true;
    result.hidden = false;
    result.classList.toggle('is-pending', pending);
    result.querySelector('#submission-title').textContent = pending ? 'БЛАНК НА ПРОВЕРКЕ' : 'ВЫ УЖЕ ОСТАВИЛИ ОБРАЩЕНИЕ';
    result.querySelector('[data-submission-id]').textContent = data.receiptId || 'ЗАРЕГИСТРИРОВАН';
    result.querySelector('[data-submission-status]').textContent = pending ? 'ДОСТАВКА УТОЧНЯЕТСЯ' : 'НА РАССМОТРЕНИИ';
    result.querySelector('[data-submission-message]').textContent = pending
      ? 'Бланк зарегистрирован, состояние доставки уточняется. Повторная отправка временно заблокирована.'
      : 'Бланк передан Таиру. Копия и решение о переписке придут в чат с @tair0_bot.';
    result.querySelector('.submission-result__seal').textContent = pending ? 'ПРОВЕРКА' : 'ПРИНЯТО';
    if (dialog.open) result.querySelector('#submission-title').focus({ preventScroll: true });
  }

  async function syncState() {
    if (busy || syncing || filed) return;
    syncing = true;
    try {
      const response = await apiFetch('/api/contact/state', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('state unavailable');
      const data = await response.json();
      if (data.status === 'received' || data.status === 'pending') {
        remember(data);
        showFiled(data, data.status === 'pending');
      } else if (localReceipt?.receiptId) {
        showFiled(localReceipt, localReceipt.status === 'pending');
      } else {
        const previouslyLinked = telegramLinked;
        telegramLinked = Boolean(data.telegram?.linked);
        if (telegramLinked && !previouslyLinked && dialog.open) audio.play('linkVerified');
        binding?.classList.toggle('is-linked', telegramLinked);
        form.querySelector('[data-telegram-status]').textContent = telegramLinked ? 'КОНТАКТ ПОДТВЕРЖДЁН · ' + data.telegram.display : 'СВЕРКА КОНТАКТА';
        form.elements.contact.value = telegramLinked ? data.telegram.display : '';
        ready = data.deliveryReady && telegramLinked;
        if (!telegramLinked) await prepareLink();
        submit.disabled = !ready;
        showStatus(ready ? '' : data.deliveryReady ? 'Подтвердите контакт в Telegram. После этого отправка станет доступна.' : 'Приёмная временно недоступна. Попробуйте позже.');
      }
    } catch {
      if (localReceipt?.receiptId) showFiled(localReceipt, localReceipt.status === 'pending');
      else { ready = false; submit.disabled = true; showStatus('Нет связи с приёмной. Откройте бланк немного позже.', true); }
    } finally { syncing = false; }
  }

  async function ink(text, color) {
    const stamp = await makeStamp(text, color, -8, { fontPx: 16, seed: Date.now() & 0xffff, wear: .035, scale: 1 });
    stampArea.replaceChildren(stamp);
    if (!reduced()) {
      submit.classList.add('is-pressing');
      await sleep(150);
    }
    audio.play(color === '--ok' ? 'approve' : 'deny');
    await stepAnim(stamp, 'is-hit', reduced() ? 0 : 280);
    if (!reduced()) {
      await stepAnim(form, 'is-shaking', 250);
      submit.classList.remove('is-pressing');
    }
  }

  form.addEventListener('input', event => {
    if (!event.isComposing && event.target.matches('input:not([readonly]), textarea')) {
      audio.play(event.inputType?.startsWith('delete') ? 'backspace' : 'key', { gain: .5 });
    }
    event.target.classList.remove('is-invalid');
    event.target.removeAttribute('aria-invalid');
  });

  purpose.addEventListener('change', () => audio.play('tick'));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || filed || !ready) return;
    const fields = Object.fromEntries(new FormData(form));
    const name = String(fields.name || '').trim();
    const contact = String(fields.contact || '').trim();
    const message = String(fields.message || '').trim();
    const email = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,63}$/.test(contact);
    const telegram = /^(?:@|https?:\/\/t\.me\/)?[A-Za-z][A-Za-z0-9_]{4,31}\/?$/.test(contact);
    const issues = [[form.elements.name, !name, 'Укажите имя или организацию.'],
      [form.elements.contact, !telegramLinked, 'Подтвердите контакт через Telegram-бота.'],
      [form.elements.message, message.length < 10, 'Текст обращения — не менее 10 символов.']];
    issues.forEach(([field, invalid]) => {
      field.classList.toggle('is-invalid', invalid);
      if (invalid) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
    });
    const issue = issues.find(([, invalid]) => invalid);
    if (issue) {
      audio.play('buzzer');
      showStatus(issue[2], true);
      issue[0].focus();
      return;
    }
    busy = true;
    audio.play('transmit');
    submit.disabled = true;
    showStatus('Регистрируем бланк и передаём в отдел связи…');
    try {
      const response = await apiFetch(CONTENT.contact.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, message, purpose: fields.purpose, website: fields.website || '' }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'DELIVERY_UNCERTAIN') { showFiled(data, true); return; }
        if (data.code === 'DUPLICATE') {
          showStatus('ОТКАЗАНО: ДУБЛИКАТ. Этот контакт или браузер уже использован.', true);
          await ink('ДУБЛИКАТ', '--no');
          return;
        }
        throw new Error(data.message || 'Не удалось передать бланк. Попробуйте позже.');
      }
      if (data.status !== 'received' || !data.receiptId) throw new Error('Приёмная не подтвердила получение.');
      // The browser flag is written only after the server confirms Telegram delivery.
      remember(data);
      localReceipt = data;
      filed = true;
      form.querySelectorAll('input,textarea,select').forEach(field => field.disabled = true);
      showStatus('Бланк № ' + data.receiptId + ' передан Таиру.');
      if (dialog.open) {
        await ink('ПРИНЯТО', '--ok');
        if (!reduced()) {
          await sleep(1200);
          audio.play('fileFiled');
          await stepAnim(form, 'is-filed', 650);
        }
      }
      showFiled(data);
    } catch (error) {
      const errorMessage = error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'Связь прервалась. Проверяем регистрацию перед повторной попыткой…'
        : error.message;
      showStatus(errorMessage, true);
      // The response may have been lost after delivery. Consult the server before unlocking.
      busy = false;
      await syncState();
      if (!filed) showStatus(errorMessage, true);
    } finally {
      busy = false;
      if (!filed) submit.disabled = !ready;
    }
  });
  bus.on('doc:opened', event => { if (event.detail.key === 'contact' && !filed && !busy) void syncState(); });
  if (localReceipt?.receiptId) showFiled(localReceipt, localReceipt.status === 'pending');
  void syncState();
  window.addEventListener('focus', () => { if (dialog.open && !filed) void syncState(); });
  setInterval(() => { if (dialog.open && !document.hidden && !filed && !busy && !telegramLinked) void syncState(); }, 3000);
}
