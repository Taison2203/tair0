/** A short visitor handbook: useful paths, without another onboarding gate. */
import { el } from '../core/dom.js?v=guide-20261119';
import { bus } from '../core/bus.js?v=guide-20261119';
import { getLanguage } from '../core/i18n.js?v=guide-20261119';
export function initVisitorGuide(audio) {
  const words=(ru,en)=>getLanguage()==='en'?en:ru;
  const opener=el('button',{type:'button','aria-haspopup':'dialog','aria-controls':'visitor-guide'},words('Как пользоваться','Visitor guide'));
  const close=el('button',{type:'button',class:'board-close'},words('ЗАКРЫТЬ','CLOSE'));
  const dialog=el('dialog',{id:'visitor-guide',class:'visitor-guide','aria-labelledby':'visitor-guide-title','data-no-translate':''});
  const action=(label,key)=>{
    const button=el('button',{type:'button',class:'btn'},label);
    button.addEventListener('click',()=>{dialog.close();bus.emit('doc:open',{key});});return button;
  };
  const sheet=el('article',{class:'visitor-guide__paper'},
    el('p',{class:'visitor-guide__kicker'},words('ПАМЯТКА ПОСЕТИТЕЛЯ · № 2203','VISITOR HANDBOOK · № 2203')),
    el('h2',{id:'visitor-guide-title'},words('ПЕРВЫЙ РАЗ НА ПОСТУ?','FIRST TIME AT THE DESK?')),
    el('p',{},words('Это личный сайт Таира. Разделы справочника открывают документы, проекты и фотографии.','This is Tair’s personal site. The handbook sections open documents, projects, and photographs.')),
    el('ol',{},
      el('li',{},el('strong',{},words('Посмотрите работы.','Explore the work.')),words(' «Дела» — проекты, «Допуск» — навыки, «Галерея» — фотографии.',' The Files section contains projects, Permit lists skills, and Gallery holds photographs.')),
      el('li',{},el('strong',{},words('Свяжитесь с Таиром.','Contact Tair.')),words(' В «Связи» подтвердите Telegram, вернитесь на сайт и отправьте бланк. Или напишите прямо в боте: сайт для этого привязывать не нужно.',' In Contact, confirm Telegram, return to the site, and submit the form. You can also write directly in the bot without linking the site.')),
      el('li',{},el('strong',{},words('Следите за ответом.','Receive your reply.')),words(' Бот покажет статус обращения. После одобрения переписка продолжается там же. Отвечает Таир лично.',' The bot shows your request status. Once approved, continue in the same chat. Tair replies personally.'))),
    el('div',{class:'visitor-guide__actions'},action(words('ПРОЕКТЫ','PROJECTS'),'cases'),action(words('ГАЛЕРЕЯ','GALLERY'),'gallery'),action(words('СВЯЗЬ','CONTACT'),'contact')),
    el('a',{href:'https://t.me/tair0_bot',target:'_blank',rel:'noopener noreferrer',class:'visitor-guide__telegram'},words('Открыть приёмную в Telegram','Open reception in Telegram')),
    el('p',{class:'visitor-guide__note'},words('Звук можно отключить кнопкой динамика. Громкость музыки и эффектов настраивается в «Звуках поста».','Use the speaker button to mute. Adjust music and effects separately in Checkpoint sounds.')));
  dialog.append(close,sheet);document.body.append(dialog);document.querySelector('.site-footer__tools')?.append(opener);
  opener.addEventListener('click',()=>{dialog.showModal();sheet.scrollTop=0;audio.play('fileOpen',{gain:.7});close.focus({preventScroll:true});});
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
  dialog.addEventListener('close',()=>{audio.play('documentClose',{gain:.7});opener.focus({preventScroll:true});});
  sheet.querySelector('a').addEventListener('click',()=>audio.play('transmit',{gain:.7}));
}
