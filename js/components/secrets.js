import { bus } from '../core/bus.js?v=reactions-20261119c';
import { getLanguage } from '../core/i18n.js?v=reactions-20261119c';
export function initSecrets(audio){
 let buffer='',last=0,unlocked=false;
 window.addEventListener('keydown',event=>{
  if(document.body.dataset.phase!=='shift'||document.querySelector('dialog[open]')||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,[contenteditable]'))return;
  if(!/^\d$/.test(event.key))return;
  const now=Date.now();if(now-last>2200)buffer='';last=now;buffer=(buffer+event.key).slice(-4);
  if(buffer!=='2203'||unlocked)return;
  unlocked=true;document.querySelector('#desk').classList.add('has-archive-light');audio.play('ezic',{gain:.5});
  bus.emit('receipt:print',{header:getLanguage()==='en'?'SECRET ARCHIVE FOUND':'СЕКРЕТНЫЙ АРХИВ НАЙДЕН',text:getLanguage()==='en'?'Pass 2203 accepted. The night desk has a light of its own. A mark for the attentive inspector.':'Пропуск 2203 принят. У ночного поста появился свой свет. Отметка для самого внимательного инспектора.',meta:'2203 · PERSONAL ARCHIVE'});
 });
}
