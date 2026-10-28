/** Best-effort controls. Web pages cannot block OS screenshots or external cameras. */
import { bus } from '../core/bus.js?v=identity-1';

export function isCaptureShortcut(event) {
  const key=String(event.key||'').toLowerCase();
  const code=String(event.code||'');
  if (key==='printscreen' || code==='PrintScreen') return true;
  if (event.metaKey && event.shiftKey && (['3','4','5','6'].includes(key) || /^Digit[3456]$/.test(code))) return true;
  return Boolean(event.shiftKey && (event.metaKey || event.ctrlKey) && (key==='s' || code==='KeyS'));
}

export function initCaptureProtection(audio) {
  const shield=document.querySelector('#capture-shield');
  const curtain=document.querySelector('#privacy-curtain');
  if(!shield)return;
  let lastShown=0;
  let previousFocus=null;
  let passive=false;
  function hideCurtain() {
    passive=false;
    if(!curtain)return;
    if(typeof curtain.hidePopover==='function' && curtain.matches(':popover-open'))curtain.hidePopover();
    curtain.classList.remove('is-visible');
  }
  function showCurtain() {
    if(shield.open || !curtain)return;
    passive=true;
    try {
      if(typeof curtain.showPopover==='function') {
        if(!curtain.matches(':popover-open'))curtain.showPopover();
      } else curtain.classList.add('is-visible');
    } catch {/* optional in older engines */}
  }
  function show(reason='capture') {
    if(shield.open)return;
    hideCurtain();
    shield.dataset.reason=reason;
    shield.querySelector('.capture-shield__code').textContent = reason==='rules'
      ? 'РАСПОРЯЖЕНИЕ № 2203' : 'ОШИБКА 2203-404';
    lastShown=Date.now();
    previousFocus=document.activeElement;
    // A synchronous top-layer cover also obscures already-open document dialogs.
    shield.showModal();
    if(audio.ready)audio.play(reason==='rules'?'documentOpen':'warning',{gain:.65});
  }
  function dismiss() {
    if(!shield.open)return;
    const readingRules = shield.dataset.reason==='rules';
    shield.close();
    hideCurtain();
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    if(readingRules)return;
    bus.emit('receipt:print',{
      header:'ПРЕДПИСАНИЕ МИНИСТЕРСТВА ВЪЕЗДА',
      meta:'РЕЖИМ ПРОСМОТРА · 2203-404',
      text:'Материалы поста предоставлены только для ознакомления. Копирование, фото- и видеосъёмка запрещены распоряжением № 2203.',
    });
  }
  shield.querySelector('[data-capture-dismiss]')?.addEventListener('click',dismiss);
  shield.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  document.querySelector('[data-viewing-rules]')?.addEventListener('click',()=>show('rules'));
  window.addEventListener('keydown',event=>{
    if(shield.open) {
      if(event.key==='Escape') {event.preventDefault();event.stopImmediatePropagation();dismiss();}
      return;
    }
    if(isCaptureShortcut(event)) {
      event.preventDefault();event.stopImmediatePropagation();show('capture');
    } else if((event.ctrlKey||event.metaKey) && ['p','s'].includes(event.key.toLowerCase())) {
      event.preventDefault();event.stopImmediatePropagation();show('copy');
    }
  },true);
  // A keyup event may arrive after an OS screenshot. It cannot undo that screenshot.
  window.addEventListener('keyup',event=>{
    if((event.key==='PrintScreen'||event.code==='PrintScreen') && Date.now()-lastShown>1500)show('capture');
  },true);
  window.addEventListener('beforeprint',()=>show('print'));
  document.addEventListener('copy',event=>{
    if(document.activeElement?.closest('input,textarea,[contenteditable="true"]'))return;
    event.preventDefault();show('copy');
  },true);
  document.addEventListener('dragstart',event=>{
    if(event.target instanceof Element && event.target.closest('img,canvas'))event.preventDefault();
  });
  document.addEventListener('contextmenu',event=>{
    if(event.target instanceof Element && event.target.closest('img,canvas')) {event.preventDefault();show('copy');}
  },true);
  // Leaving the window hides the documents without accusing the visitor of capture.
  window.addEventListener('blur',showCurtain);
  window.addEventListener('focus',hideCurtain);
  document.addEventListener('visibilitychange',()=>document.hidden?showCurtain():hideCurtain());
  document.addEventListener('pointerdown',()=>{if(passive && !document.hidden)hideCurtain();},true);
  return {show,dismiss};
}
