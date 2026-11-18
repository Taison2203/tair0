/** Shared counters, explicit like state, and account confirmation through the existing bot. */
import { apiFetch } from '../core/api.js?v=compact-20261119';
import { getLanguage } from '../core/i18n.js?v=compact-20261119';
const words=(ru,en)=>getLanguage()==='en'?en:ru;
const states=new Map(),queued=new Set(),viewed=new Set(),disposers=new WeakMap();let batchTimer,audio,linked=false,login,loginTimer,loginDeadline=0,desiredTarget=null,returnFocus;
function state(target){if(!states.has(target))states.set(target,{target,views:null,likes:null,liked:false,pending:false,epoch:0,widgets:new Set()});return states.get(target);}
function update(item){const s=state(item.target);Object.assign(s,item);for(const render of s.widgets)render();}
async function call(path,options={}){
 let r;try{r=await apiFetch(path,{...options,signal:AbortSignal.timeout(12000)});}catch{throw Error(words('Нет связи с приёмной. Повторите позже.','Reception is unavailable. Please try later.'));}
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(getLanguage()==='en'?(data.code==='RATE_LIMIT'?'Too many requests. Please wait a little.':data.code==='TELEGRAM_REQUIRED'?'Confirm Telegram to like this item.':'Could not save your reaction. Please try again.'):(data.message||'Не удалось сохранить отметку.')),{code:data.code});return data;
}
async function refresh(targets){
 const unique=[...new Set(targets)],epochs=new Map(unique.map(target=>[target,state(target).epoch]));
 for(let i=0;i<unique.length;i+=25){try{const data=await call('/api/social?targets='+encodeURIComponent(unique.slice(i,i+25).join(',')));const newlyLinked=data.linked&&!linked;linked=data.linked;data.items.forEach(item=>{const s=state(item.target);if(!s.pending&&s.epoch===epochs.get(item.target))update(item);});if(newlyLinked)await mergeViewed();}catch{/* Keep unavailable counters as dashes; never invent zero. */}}
}
async function mergeViewed(){await Promise.allSettled([...viewed].map(target=>call('/api/social/view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target})}).then(data=>update({target,views:data.item.views}))));}
export function refreshReactions(){return refresh([...states.keys()]);}
export function releaseReactions(container){for(const root of container.querySelectorAll('.social-controls'))disposers.get(root)?.();}
function queue(target){queued.add(target);clearTimeout(batchTimer);batchTimer=setTimeout(()=>{const targets=[...queued];queued.clear();refresh(targets);},60);}
function icon(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('class','social-heart');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M2 1h4v2h4V1h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2V9H0V3h2z');svg.append(path);return svg;}
export function createReaction(target,{viewsOnly=false}={}){
 const s=state(target),root=document.createElement('div');root.className='social-controls';root.dataset.noTranslate='';
 const button=document.createElement('button');button.type='button';button.className='social-like';button.append(icon());
 const label=document.createElement('span'),count=document.createElement('span');count.className='social-like__count';button.append(label,count);
 const views=document.createElement('span');views.className='social-views';views.title=words('Уникальные браузеры и подтверждённые аккаунты. Не точное число людей.','Unique browsers and verified accounts. Not an exact count of people.');
 const status=document.createElement('span');status.className='social-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const render=(celebrate=false)=>{label.textContent=words('Нравится',s.liked?'Liked':'Like');count.textContent=s.likes===null?'—':String(s.likes);button.setAttribute('aria-pressed',String(s.liked));button.disabled=s.pending;button.title=words(s.liked?'Снять свой лайк':'Поставить лайк · один на Telegram-аккаунт',s.liked?'Remove your like':'Like · one per Telegram account');button.classList.toggle('is-liked',s.liked);views.textContent=(s.views===null?'—':new Intl.NumberFormat().format(s.views))+' '+words('просм.','views');
  if(celebrate){root.dataset.mark=s.liked?'+':'−';root.classList.remove('is-celebrating');void root.offsetWidth;root.classList.add('is-celebrating');setTimeout(()=>root.classList.remove('is-celebrating'),650);}
 };
 s.widgets.add(render);disposers.set(root,()=>s.widgets.delete(render));render();if(!viewsOnly)root.append(button);root.append(views,status);queue(target);
 button.addEventListener('click',async()=>{
  if(s.pending)return;status.textContent='';
  if(s.likes===null)await refresh([target]);
  if(!linked){await showLogin(target,button);return;}
  await changeLike(s,!s.liked,status,root);
 });
 return root;
}
async function changeLike(s,liked,status,root){
 s.pending=true;s.epoch++;for(const render of s.widgets)render();
 try{const data=await call('/api/social/like',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:s.target,liked})});linked=data.linked;update(data.item);audio?.play(liked?'like':'unlike',{gain:.65});
  for(const render of s.widgets)render(true);
  if(status)status.textContent=words(liked?'Отметка принята':'Лайк снят',liked?'Marked as liked':'Like removed');
 }catch(e){if(e.code==='TELEGRAM_REQUIRED'){linked=false;await showLogin(s.target,root?.querySelector('button'));}else if(status)status.textContent=e.message;}
 finally{s.pending=false;for(const render of s.widgets)render();}
}
export function observeView(target,element){
 // A real, visible read lasting 1.5 seconds. No thumbnail-impression counting.
 let timer=null,visible=false,stopped=false;
 const stopTimer=()=>{clearTimeout(timer);timer=null;};
 function schedule(){stopTimer();if(stopped||!visible||document.hidden||viewed.has(target))return;timer=setTimeout(async()=>{
   if(!element.isConnected||document.hidden||!visible)return;
   try{const data=await call('/api/social/view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target})});viewed.add(target);update({target,views:data.item.views});}catch{/* Reading remains usable when counters are unavailable. */}
 },1500);}
 const observer=new IntersectionObserver(entries=>{const e=entries[0];visible=e.isIntersecting&&(e.intersectionRatio>=.15||e.intersectionRect.height>=120);schedule();},{threshold:[0,.15,.5,1]});observer.observe(element);
 const visibility=()=>schedule();document.addEventListener('visibilitychange',visibility);
 return ()=>{stopped=true;stopTimer();observer.disconnect();document.removeEventListener('visibilitychange',visibility);};
}
function makeLogin(){
 const d=document.createElement('dialog');d.className='social-login';d.dataset.noTranslate='';d.setAttribute('aria-labelledby','social-login-title');
 const h=document.createElement('h2');h.id='social-login-title';h.textContent=words('ОДИН АККАУНТ · ОДНА ОТМЕТКА','ONE ACCOUNT · ONE LIKE');
 const p=document.createElement('p');p.textContent=words('Подтвердите Telegram в боте. После подтверждения поставим лайк выбранному объекту. На сайте видны только общие числа — ваше имя и ник не публикуются.','Confirm Telegram in the bot. We will then like the selected item. Only totals are public — your name and username are not published.');
 const text=document.createElement('p');text.className='social-login__status';text.setAttribute('role','status');
 const link=document.createElement('a');link.className='board-tool';link.target='_blank';link.rel='noopener noreferrer';link.hidden=true;link.textContent=words('Подтвердить в Telegram','Confirm in Telegram');
 const check=document.createElement('button');check.className='board-tool';check.type='button';check.textContent=words('Я подтвердил · проверить','Confirmed · check');check.addEventListener('click',()=>{audio?.play('tick',{gain:.6});checkLogin();});
 const cancel=document.createElement('button');cancel.className='board-tool';cancel.type='button';cancel.textContent=words('Отмена','Cancel');cancel.addEventListener('click',()=>d.close());
 d.append(h,p,link,check,cancel,text);link.addEventListener('click',()=>audio?.play('transmit'));d.addEventListener('close',()=>{audio?.play('documentClose');clearTimeout(loginTimer);desiredTarget=null;returnFocus?.focus({preventScroll:true});});document.body.append(d);login={dialog:d,text,link,check};return login;
}
async function showLogin(target,opener){
 const ui=login||makeLogin();desiredTarget=target;returnFocus=opener;ui.link.hidden=true;ui.check.disabled=true;ui.text.textContent=words('Готовим пропуск…','Preparing your pass…');if(!ui.dialog.open){ui.dialog.showModal();audio?.play('documentOpen');}
 try{const data=await call('/api/telegram/link',{method:'POST'});if(!ui.dialog.open)return;ui.link.href=data.url;ui.link.hidden=false;ui.check.disabled=false;loginDeadline=Date.now()+data.expiresIn*1000;ui.text.textContent=words('Откройте бота, нажмите «Старт» и подтвердите привязку.','Open the bot, press Start and confirm the link.');loginTimer=setTimeout(checkLogin,5000);}catch(e){ui.text.textContent=e.message;ui.check.disabled=false;}
}
async function checkLogin(){
 clearTimeout(loginTimer);if(!login?.dialog.open||login.check.disabled)return;
 if(document.hidden){loginTimer=setTimeout(checkLogin,5000);return;}
 if(Date.now()>loginDeadline){login.text.textContent=words('Пропуск истёк. Закройте окно и нажмите на лайк снова.','Pass expired. Close this window and press Like again.');return;}
 login.check.disabled=true;
 try{const data=await call('/api/social?targets='+encodeURIComponent(desiredTarget));if(data.linked){linked=true;data.items.forEach(update);const target=desiredTarget;login.dialog.close();
   await mergeViewed();
   await refreshReactions();const s=state(target);if(!s.liked){await changeLike(s,true);for(const render of s.widgets)render();}return;}login.text.textContent=words('Пока нет подтверждения. Нажмите «Старт» в боте и подтвердите привязку.','No confirmation yet. Press Start in the bot and confirm the link.');}catch(e){login.text.textContent=e.message;}finally{login.check.disabled=false;if(login.dialog.open)loginTimer=setTimeout(checkLogin,5000);}
}
export function initReactions(engine){audio=engine;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&login?.dialog.open)checkLogin();});}
