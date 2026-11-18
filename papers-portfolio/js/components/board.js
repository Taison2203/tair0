/** Public noticeboard and a Telegram-approved owner desk. No credentials persist in storage. */
import { getLanguage, getLocale } from '../core/i18n.js?v=reactions-20261119b';
import { createReaction, observeView, releaseReactions } from './reactions.js?v=reactions-20261119b';
const API='https://tair-portfolio-api.q5yhpcm78q.chatgpt.site';
const words=(ru,en)=>getLanguage()==='en'?en:ru;
const node=(tag,props={},...children)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props))if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k==='onClick')e.addEventListener('click',v);else e.setAttribute(k,v);for(const c of children)e.append(c);return e;};
export function initBoard(audio){
  let session='',login=null,pollTimer=null,busy=false,editing=null,fileId=null,posts=[],opener=null,showArchive=false;
  let stopViews=[];
  const dialog=node('dialog',{class:'noticeboard-dialog','aria-labelledby':'noticeboard-title','data-no-translate':''});
  const close=node('button',{type:'button',class:'board-close',text:words('ЗАКРЫТЬ','CLOSE'),onClick:()=>dialog.close()});
  const board=node('section',{class:'noticeboard'});
  const heading=node('h2',{id:'noticeboard-title',text:words('ДОСКА ОБЪЯВЛЕНИЙ','NOTICEBOARD')});
  const sub=node('p',{class:'board-subtitle',text:words('Письма, находки и обновления от Таира.','Notes, discoveries and updates from Tair.')});
  const status=node('p',{class:'board-status',role:'status','aria-live':'polite'});
  const list=node('div',{class:'board-posts'});
  const owner=node('button',{type:'button',class:'board-tool',text:words('Вход владельца','Owner sign-in'),onClick:()=>{panel.hidden=!panel.hidden;panel.scrollIntoView({behavior:'smooth',block:'nearest'});}});
  const refresh=node('button',{type:'button',class:'board-tool',text:words('Обновить','Refresh'),onClick:()=>loadPosts()});
  const archive=node('button',{type:'button',class:'board-tool',hidden:'',text:words('Архив записей','Archived notices'),onClick:()=>{showArchive=!showArchive;archive.textContent=showArchive?words('Вернуться к записям','Back to notices'):words('Архив записей','Archived notices');render();}});
  const panel=node('section',{class:'board-owner',hidden:'','aria-label':words('Кабинет владельца','Owner desk')});
  const loginBox=node('div');
  const loginStatus=node('p',{role:'status',class:'board-login-status'});
  const loginButton=node('button',{type:'button',class:'btn',text:words('Получить пропуск в Telegram','Get a Telegram pass'),onClick:startLogin});
  const telegram=node('a',{class:'board-telegram',target:'_blank',rel:'noopener noreferrer',hidden:'',text:words('Открыть бота и подтвердить код','Open bot and confirm code')});
  const check=node('button',{type:'button',class:'board-tool',hidden:'',text:words('Проверить подтверждение','Check confirmation'),onClick:checkLogin});
  loginBox.append(node('h3',{text:words('КАБИНЕТ ВЛАДЕЛЬЦА','OWNER DESK')}),node('p',{text:words('Подтвердите вход в своём боте. Код на сайте и в Telegram должен совпадать.','Confirm sign-in in your bot. The code here must match the code in Telegram.')}),loginButton,loginStatus,telegram,check);
  const form=node('form',{class:'board-editor',hidden:''});
  const title=node('input',{name:'title',required:'',maxlength:'120',autocomplete:'off'});
  const body=node('textarea',{name:'body',maxlength:'6000',rows:'7'});
  const file=node('input',{type:'file',accept:'image/png,image/jpeg,image/webp,application/pdf,text/plain,application/zip'});
  const published=node('input',{type:'checkbox'}),pinned=node('input',{type:'checkbox'});
  const fileStatus=node('p',{class:'board-file-status'});
  const submit=node('button',{type:'submit',class:'btn',text:words('ПОСТАВИТЬ ПЕЧАТЬ И СОХРАНИТЬ','STAMP AND SAVE')});
  const editorTitle=node('h3',{text:words('НОВАЯ ЗАПИСЬ','NEW NOTICE')});
  const label=(text,control)=>node('label',{class:'board-field'},node('span',{text}),control);
  form.append(editorTitle,label(words('Заголовок','Title'),title),label(words('Текст','Text'),body),label(words('Вложение · до 6 МБ','Attachment · up to 6 MB'),file),node('p',{class:'board-help',text:words('PNG, JPEG, WebP, PDF, TXT, ZIP. Метаданные фотографий удаляются перед загрузкой. Файлы станут доступны всем после публикации.','PNG, JPEG, WebP, PDF, TXT, ZIP. Photo metadata is removed before upload. Files become public when published.')}),fileStatus,node('button',{type:'button',class:'board-tool',text:words('Убрать вложение','Remove attachment'),onClick:()=>{fileId=null;file.value='';fileStatus.textContent=words('Без вложения','No attachment');}}),label(words('Опубликовать для всех','Publish for everyone'),published),label(words('Закрепить наверху','Pin to top'),pinned),submit,node('button',{type:'button',class:'board-tool',text:words('Новая запись','New notice'),onClick:resetEditor}),node('button',{type:'button',class:'board-tool',text:words('Выйти из кабинета','Sign out'),onClick:logout}));
  panel.append(loginBox,form);
  board.append(node('header',{class:'board-header'},node('p',{class:'board-kicker',text:words('ЛИЧНЫЙ АРХИВ · ТАИР','PERSONAL ARCHIVE · TAIR')}),heading,sub),node('div',{class:'board-tools'},refresh,owner,archive),status,panel,list);
  dialog.append(close,board);document.body.append(dialog);
  const openButton=node('button',{type:'button',class:'board-invitation','aria-haspopup':'dialog',onClick:open},node('span',{class:'board-invitation__pin','aria-hidden':'true'}),node('span',{class:'board-invitation__title',text:words('ДОСКА ОБЪЯВЛЕНИЙ','NOTICEBOARD')}),node('span',{class:'board-invitation__description',text:words('Заметки и обновления Таира · открыть','Tair’s notes and updates · open')}));
  document.querySelector('#desk').append(openButton);
  async function request(path,options={},token=session){
    const headers=new Headers(options.headers);if(token)headers.set('Authorization','Bearer '+token);
    let r;try{r=await fetch(API+path,{...options,headers,credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(25000)});}catch{throw Error(words('Нет связи с приёмной. Проверьте интернет и повторите позже.','Could not reach the reception. Check your connection and try later.'));}
    const data=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401&&session){session='';posts=[];list.replaceChildren();archive.hidden=true;form.hidden=true;loginBox.hidden=false;loginButton.disabled=false;resetEditor();}throw Error(data.message||words('Сервис временно недоступен. Повторите позже.','Service unavailable. Try again later.'));}return data;
  }
  function message(text){status.textContent=text;}
  async function loadPosts(){
    refresh.disabled=true;message(words('Собираем свежий выпуск…','Collecting the latest notices…'));
    try{const data=await request(session?'/api/admin/posts':'/api/board');posts=data.posts;render();message(session?words('Кабинет открыт. Черновики видны только вам.','Owner desk open. Drafts are visible only to you.'):posts.length?words('Свежие записи владельца.','Latest notices from the owner.'):words('Пока ни одного объявления. Первый лист появится здесь.','No notices yet. The first sheet will appear here.'));}catch(e){message(e.message);}finally{refresh.disabled=false;}
  }
  function render(){
    stopViews.forEach(stop=>stop());stopViews=[];releaseReactions(list);
    list.replaceChildren();
    const visible=posts.filter(p=>session?Boolean(p.deleted)===showArchive:true);
    if(!visible.length){list.append(node('article',{class:'board-empty'},node('span',{'aria-hidden':'true',text:'✦'}),node('h3',{text:showArchive?words('АРХИВ ПУСТ','ARCHIVE IS EMPTY'):words('МЕСТО ДЛЯ НОВЫХ ИСТОРИЙ','ROOM FOR NEW STORIES')}),node('p',{text:showArchive?words('Здесь можно восстановить снятые с доски записи.','Notices removed from the board can be restored here.'):words('Доска готова. Таир может приколоть сюда запись, фотографию или файл.','The board is ready for Tair’s notes, pictures and files.')})));return;}
    for(const p of visible){
      const card=node('article',{class:'board-post'+(p.pinned?' is-pinned':'')});
      card.append(node('span',{class:'board-post__pin','aria-hidden':'true'}),node('p',{class:'board-post__meta',text:(session&&!p.published?words('ЧЕРНОВИК · ','DRAFT · '):p.pinned?words('ЗАКРЕПЛЕНО · ','PINNED · '):'')+new Intl.DateTimeFormat(getLocale(),{dateStyle:'medium'}).format(new Date(p.created_at))}),node('h3',{text:p.title}),node('p',{class:'board-post__body',text:p.body}));
      const fid=p.fileId||p.file_id;
      if(fid&&(!session||p.published)){
        const href=API+'/api/board/files/'+fid;
        const a=node('a',{href,target:'_blank',rel:'noopener noreferrer',class:'board-attachment'});
        if(p.fileMime?.startsWith('image/'))a.append(node('img',{src:href,alt:p.title,loading:'lazy',decoding:'async',referrerpolicy:'no-referrer'}));
        a.append(node('span',{text:(p.fileName||words('Вложение','Attachment'))+' · '+Math.ceil((p.fileSize||0)/1024)+' KB'}));card.append(a);
      }else if(fid)card.append(node('p',{text:words('Вложение сохранено. Доступно посетителям после публикации.','Attachment saved. Available to visitors once published.')}));
      if(!p.deleted&&(!session||p.published)){card.append(createReaction('post:'+p.id));stopViews.push(observeView('post:'+p.id,card));}
      if(session){const controls=p.deleted?node('div',{class:'board-post__tools'},node('button',{type:'button',class:'board-tool',text:words('Восстановить как черновик','Restore as draft'),onClick:async()=>{try{await request('/api/admin/posts/'+p.id+'/restore',{method:'POST'});await loadPosts();}catch(e){message(e.message);}}})):node('div',{class:'board-post__tools'},node('button',{type:'button',class:'board-tool',text:words('Изменить','Edit'),onClick:()=>edit(p)}),node('button',{type:'button',class:'board-tool board-tool--danger',text:words('Убрать в архив…','Archive…'),onClick:()=>confirmDelete(p,card)}));card.append(controls);}
      if(session&&p.deleted)card.append(node('button',{type:'button',class:'board-tool board-tool--danger',text:words('Удалить навсегда…','Delete permanently…'),onClick:()=>{
        if(card.querySelector('.board-confirm'))return;
        const box=node('div',{class:'board-confirm'},node('p',{text:words('Запись и неиспользуемое вложение будут удалены навсегда. Восстановить их нельзя.','This notice and its unused attachment will be deleted permanently. This cannot be undone.')}),node('button',{type:'button',class:'board-tool board-tool--danger',text:words('Подтверждаю удаление навсегда','Confirm permanent deletion'),onClick:async()=>{try{await request('/api/admin/posts/'+p.id+'/purge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:p.id})});await loadPosts();}catch(e){message(e.message);}}}),node('button',{type:'button',class:'board-tool',text:words('Отмена','Cancel'),onClick:()=>box.remove()}));card.append(box);
      }}));
      list.append(card);
    }
  }
  function confirmDelete(p,card){
    if(card.querySelector('.board-confirm'))return;
    const box=node('div',{class:'board-confirm'},node('p',{text:words('Снять запись с доски? Её можно будет восстановить из архива.','Remove this notice from the board? You can restore it from the archive.')}),node('button',{type:'button',class:'board-tool board-tool--danger',text:words('Да, в архив','Yes, archive'),onClick:async()=>{try{await request('/api/admin/posts/'+p.id,{method:'DELETE'});if(editing===p.id)resetEditor();audio.play('paper');await loadPosts();}catch(e){message(e.message);}}}),node('button',{type:'button',class:'board-tool',text:words('Отмена','Cancel'),onClick:()=>box.remove()}));card.append(box);
  }
  function edit(p){editing=p.id;fileId=p.file_id||p.fileId||null;title.value=p.title;body.value=p.body;published.checked=Boolean(p.published);pinned.checked=Boolean(p.pinned);file.value='';fileStatus.textContent=p.fileName||words('Без вложения','No attachment');editorTitle.textContent=words('ИЗМЕНИТЬ ЗАПИСЬ','EDIT NOTICE');panel.hidden=false;form.scrollIntoView({behavior:'smooth',block:'start'});title.focus({preventScroll:true});}
  function resetEditor(){editing=null;fileId=null;form.reset();fileStatus.textContent='';editorTitle.textContent=words('НОВАЯ ЗАПИСЬ','NEW NOTICE');}
  async function startLogin(){
    if(busy)return;busy=true;loginButton.disabled=true;clearTimeout(pollTimer);telegram.hidden=true;check.hidden=true;loginStatus.textContent=words('Готовим новый пропуск…','Preparing a new pass…');
    try{login=await request('/api/admin/login',{method:'POST'},'');login.deadline=Date.now()+300000;loginStatus.textContent=words('Сверьте код в боте: ','Match this code in the bot: ')+login.confirmationCode;telegram.href=login.url;telegram.hidden=false;check.hidden=false;check.disabled=false;pollTimer=setTimeout(checkLogin,5000);}catch(e){loginStatus.textContent=e.message;loginButton.disabled=false;}finally{busy=false;}
  }
  async function checkLogin(){
    if(!login||busy)return;clearTimeout(pollTimer);
    if(Date.now()>login.deadline){loginStatus.textContent=words('Пропуск истёк. Получите новый.','Pass expired. Request a new one.');login=null;loginButton.disabled=false;check.hidden=true;return;}
    if(document.hidden||!dialog.open){pollTimer=setTimeout(checkLogin,5000);return;}
    busy=true;check.disabled=true;
    try{const data=await request('/api/admin/login/status',{},login.requestToken);if(data.status==='approved'){session=data.sessionToken;login=null;loginBox.hidden=true;form.hidden=false;archive.hidden=false;owner.textContent=words('Кабинет владельца','Owner desk');resetEditor();audio.play('linkVerified');await loadPosts();return;}}catch(e){loginStatus.textContent=e.message;login=null;loginButton.disabled=false;}
    finally{busy=false;check.disabled=false;if(login)pollTimer=setTimeout(checkLogin,5000);}
  }
  async function logout(){try{await request('/api/admin/logout',{method:'POST'});}catch{}session='';posts=[];list.replaceChildren();archive.hidden=true;showArchive=false;form.hidden=true;loginBox.hidden=false;loginButton.disabled=false;loginStatus.textContent='';telegram.hidden=true;check.hidden=true;owner.textContent=words('Вход владельца','Owner sign-in');resetEditor();await loadPosts();}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!session)return;
    if(!body.value.trim()&&!file.files[0]&&!fileId){message(words('Добавьте текст или вложение.','Add text or an attachment.'));return;}
    busy=true;submit.disabled=true;message(words('Регистрируем запись…','Registering the notice…'));
    try{
      if(file.files[0]){
        let upload=file.files[0];if(upload.size>6*1024*1024)throw Error(words('Максимум 6 МБ на файл.','Maximum file size is 6 MB.'));
        if(upload.type.startsWith('image/'))upload=await cleanImage(upload);
        const saved=await request('/api/admin/uploads?name='+encodeURIComponent(upload.name),{method:'POST',headers:{'Content-Type':upload.type||'application/zip'},body:upload});fileId=saved.id;file.value='';fileStatus.textContent=saved.name;
      }
      await request('/api/admin/posts'+(editing?'/'+editing:''),{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title.value.trim(),body:body.value.trim(),published:published.checked,pinned:pinned.checked,fileId})});
      audio.play('stamp');form.classList.add('is-filed');setTimeout(()=>form.classList.remove('is-filed'),600);resetEditor();await loadPosts();message(words('ЗАПИСЬ СОХРАНЕНА. Печать поставлена.','NOTICE SAVED. Stamped and filed.'));
    }catch(e){message(e.message);}finally{busy=false;submit.disabled=false;}
  });
  async function cleanImage(input){
    const image=await createImageBitmap(input);try{if(image.width>10000||image.height>10000)throw Error(words('Изображение слишком большое.','Image dimensions are too large.'));const ratio=Math.min(1,2048/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.92));if(!blob)throw Error(words('Не удалось подготовить фото.','Could not prepare the photo.'));return new File([blob],input.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'});}finally{image.close();}
  }
  function open(){opener=document.activeElement;dialog.showModal();board.scrollTop=0;audio.play('paper');loadPosts();}
  dialog.addEventListener('close',()=>{stopViews.forEach(stop=>stop());stopViews=[];opener?.focus({preventScroll:true});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&login&&dialog.open)checkLogin();});
  window.addEventListener('pagehide',()=>{session='';login=null;clearTimeout(pollTimer);});
  return {open};
}
