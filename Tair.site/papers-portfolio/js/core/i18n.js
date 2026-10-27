import { ENGLISH } from '../config/english.js?v=city-2';

const STORAGE_KEY = 'inspector.language.v1';
let language = 'ru';
let observer;
const cyrillic = /[А-Яа-яЁё]/;
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseMatcher = new RegExp('(?<![\\p{L}\\p{N}])(?:' + Object.keys(ENGLISH).sort((a,b) => b.length-a.length).map(escapeRegExp).join('|') + ')(?![\\p{L}\\p{N}])', 'gu');

export const getLanguage = () => language;
export const getLocale = () => language === 'en' ? 'en-GB' : 'ru-RU';

/** Stable UI data stays in Russian; only presentation is localised. */
export function translateUI(value, targetLanguage = 'en') {
  const text = String(value ?? '');
  if (targetLanguage !== 'en' || !cyrillic.test(text)) return text;
  if (Object.hasOwn(ENGLISH, text)) return ENGLISH[text];
  const clean = text.trim();
  if (Object.hasOwn(ENGLISH, clean)) return text.replace(clean, ENGLISH[clean]);
  const rules = [
    [/^Просмотрено (\d+) из (\d+) разделов$/, (_,a,b) => `Viewed ${a} of ${b} sections`],
    [/^Посетитель (\d+) из (\d+)(?: · верных решений: (\d+))?$/, (_,a,b,c) => `Visitor ${a} of ${b}` + (c === undefined ? '' : ` · correct decisions: ${c}`)],
    [/^ПРОВЕРЕНО (\d+) ИЗ (\d+) · ВЕРНО (\d+)$/, (_,a,b,c) => `CHECKED ${a} OF ${b} · CORRECT ${c}`],
    [/^(\d+) ИЗ (\d+)$/, (_,a,b) => `${a} OF ${b}`],
    [/^(\d+) сообщений · читать газету$/, (_,n) => `${n} reports · read the bulletin`],
    [/^Бланк № (.+) передан Таиру\.$/, (_,n) => `Form no. ${n} has been sent to Tair.`],
    [/^(\d+) СМ$/, (_,n) => `${n} CM`],
    [/^КПП № (\d+) · ВЕРНО (\d+) ИЗ (\d+)$/, (_,n,a,b) => `CHECKPOINT NO. ${n} · CORRECT ${a} OF ${b}`],
    [/^Открыть раздел (.+)$/, (_,s) => `Open section ${translateUI(s,targetLanguage)}`],
    [/^Раздел: (.+)$/, (_,s) => `Section: ${translateUI(s,targetLanguage)}`],
    [/^ПРЕДЪЯВИТЬ: (.+)$/, (_,s) => `PRESENT: ${translateUI(s,targetLanguage)}`],
    [/^Открыть фото (\d+): (.+)$/, (_,n,s) => `Open photo ${n}: ${translateUI(s,targetLanguage)}`],
    [/^(.+): просмотрено$/, (_,s) => `${translateUI(s,targetLanguage)}: viewed`],
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(clean)) return text.replace(clean, clean.replace(pattern,replacement));
  }
  return text.replace(phraseMatcher, match => ENGLISH[match]);
}
export const t = value => translateUI(value,language);

const skipped = '[data-no-translate], script, style, textarea, [contenteditable="true"]';
const attrs = ['aria-label','alt','title','placeholder'];
function translateElement(element) {
  // Translate textarea placeholders, while translateText never touches their content.
  if (element.closest('[data-no-translate], script, style, [contenteditable="true"]')) return;
  for (const attr of attrs) {
    const value=element.getAttribute(attr);
    if (value && cyrillic.test(value)) {
      const translated=t(value);
      if (value!==translated) element.setAttribute(attr,translated);
    }
  }
}
function translateText(node) {
  if (!node.parentElement || node.parentElement.closest(skipped)) return;
  const value=node.nodeValue;
  if (value && cyrillic.test(value)) {
    const translated=t(value);
    if (translated!==value) node.nodeValue=translated;
  }
}
export function localize(root=document.body) {
  if (language !== 'en' || !root) return;
  if (root.nodeType===3) {translateText(root);return;}
  if (root.nodeType===1) translateElement(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())) {
    if (node.nodeType===3) translateText(node);
    else translateElement(node);
  }
}
function observe() {
  if (observer) return;
  // Dynamic statuses are translated in the same microtask before the next paint.
  // Editable text and source news headlines are explicitly excluded.
  observer=new MutationObserver(records => {
    if(language!=='en')return;
    for(const record of records) {
      if(record.type==='characterData')translateText(record.target);
      else if(record.type==='attributes')translateElement(record.target);
      else for(const node of record.addedNodes)localize(node);
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});
}
function setLanguage(selected) {
  language=selected==='en'?'en':'ru';
  document.documentElement.lang=language;
  document.title=t('Таир — Портфолио инспектора | Papers, Please');
  document.querySelector('[data-language-reset]')?.setAttribute('aria-label',t('Сменить язык'));
  try {localStorage.setItem(STORAGE_KEY,language);}catch{/* language still works without storage */}
  document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach(node=>{node.content=t(node.content);});
  localize();
  observe();
}

/** A choice is required on every entry; a saved preference is highlighted only. */
export function chooseLanguage() {
  const screen=document.querySelector('#language-screen');
  const start=document.querySelector('#start-screen');
  let preferred='ru';
  try {preferred=localStorage.getItem(STORAGE_KEY)||'ru';}catch{}
  screen.querySelectorAll('[data-language]').forEach(button=>button.classList.toggle('is-preferred',button.dataset.language===preferred));
  document.querySelector('[data-language-reset]')?.addEventListener('click',()=>window.location.reload());
  return new Promise(resolve=>{
    for(const button of screen.querySelectorAll('[data-language]')) {
      button.addEventListener('click',()=>{
        if(screen.hidden)return;
        setLanguage(button.dataset.language);
        screen.hidden=true;
        start.hidden=false;
        resolve(language);
      },{once:true});
    }
    screen.querySelector(`[data-language="${preferred==='en'?'en':'ru'}"]`)?.focus();
  });
}
