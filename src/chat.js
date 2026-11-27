/* Conversa privada entre jogador e mestre. */
import { $, esc, toast, uid } from './util.js';
import { S, ui } from './estado.js';
import { FB_MAX, fbUrl, pic, putBlob } from './imagens.js';
import { myPub } from './jogador.js';
import { renderDesk } from './mestre.js';
import { setView } from './acesso.js';
import { obsMode } from './overlays.js';

/* ---------- private chat: threads/<charId> (meta) + threads/<charId>/msgs, only that player and the master ---------- */
let chatCid=null,chatUnsub=null,chatMsgs=[],chatFirst=true,threads={},threadsKey=null,threadsUnsub=null,pendingAtt=[],chatSending=false;
const myRole=()=>S.unlocked?'master':'player';
export const fmtTime=t=>{const d=new Date(t||0);const today=new Date().toDateString()===d.toDateString();return today?d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
function unreadOf(cid){const t=threads[cid];if(!t||!t.lastAt)return false;return S.unlocked?(t.lastFrom==='player'&&t.lastAt>(t.seenMaster||0)):(t.lastFrom==='master'&&t.lastAt>(t.seenPlayer||0))}
export function watchThreads(){
  if(!S.db||obsMode)return;const mine=myPub();const key=S.unlocked?'master':(mine&&!S.me.anon?'p:'+mine.id:null);
  if(key===threadsKey)return;threadsKey=key;if(threadsUnsub){threadsUnsub();threadsUnsub=null}threads={};
  if(chatCid&&!(key==='master'||key==='p:'+chatCid))closeChat();
  const onNew=(cid,t)=>{const was=unreadOf(cid);threads[cid]=t;if(!was&&unreadOf(cid)&&!(chatCid===cid&&!$('chat').hidden)){const p=S.pub.find(x=>x.id===cid);toast(S.unlocked?'Nova mensagem de '+(p?p.name:'um jogador'):'Nova mensagem do mestre')}};
  if(key==='master')threadsUnsub=S.db.collection('threads').onSnapshot(s=>{for(const d of s.docs)onNew(d.id,d.data());chatChrome();if(ui.mtab==='msgs')renderDesk(false)},()=>{});
  else if(key)threadsUnsub=S.db.collection('threads').doc(mine.id).onSnapshot(s=>{onNew(mine.id,s.exists?s.data():{});chatChrome()},()=>{});
  chatChrome();
}
export function chatChrome(){
  const fab=$('chatFab'),mine=myPub();const show=!document.body.classList.contains('kz-on')&&ui.view==='group'&&(S.unlocked||(!!mine&&!S.me.anon));
  fab.hidden=!show;$('chatFabLabel').textContent=S.unlocked?'Mensagens':'Mestre';
  const n=Object.keys(threads).filter(unreadOf).length;const bd=$('chatBadge');bd.hidden=!n;bd.textContent=n;
  const tb=$('msgTabBadge');if(tb){tb.hidden=!n||!S.unlocked;tb.textContent=n}
}
export function openChat(cid){
  if(!cid||!S.db)return;
  if(chatCid!==cid){if(chatUnsub)chatUnsub();chatCid=cid;chatMsgs=[];chatFirst=true;renderChatList();
    chatUnsub=S.db.collection('threads/'+cid+'/msgs').orderBy('at').onSnapshot(s=>{chatMsgs=s.docs.map(d=>({id:d.id,...d.data()}));renderChatList();markSeen()},()=>toast('Não foi possível abrir a conversa.'))}
  const p=S.pub.find(x=>x.id===cid);$('chatTitle').textContent=S.unlocked?(p?p.name:'Jogador'):'Mestre';
  $('chatSub').textContent=S.unlocked?'Conversa privada com '+(p&&p.ownerName?p.ownerName:'o jogador'):'Conversa privada com o mestre';
  $('chat').hidden=false;markSeen();setTimeout(()=>$('chatText').focus(),60);
}
export function closeChat(){$('chat').hidden=true;if(chatUnsub){chatUnsub();chatUnsub=null}chatCid=null;pendingAtt=[];renderPending()}
function markSeen(){if(!chatCid||$('chat').hidden)return;const k=S.unlocked?'seenMaster':'seenPlayer',t=threads[chatCid]||{};if((t[k]||0)>=(t.lastAt||0)&&t.lastAt)return;
  const now=Date.now();threads[chatCid]={...t,[k]:now};chatChrome();S.db.collection('threads').doc(chatCid).set({[k]:now},{merge:true}).catch(()=>{})}
function attHTML(a){
  const url=fbUrl(a.id);
  if(String(a.mime||'').startsWith('image/'))return url?`<img class="att-img" src="${url}" alt="${esc(a.name)}" data-zoom>`:`<div class="att-load">Carregando imagem…</div>`;
  return url?`<a class="att-file" href="${url}" download="${esc(a.name)}">📎 <span>${esc(a.name)}</span> <small>${fmtSize(a.size||0)}</small></a>`:`<span class="att-file">📎 <span>${esc(a.name)}</span> <small>carregando…</small></span>`;
}
export function renderChatList(){
  const el=$('chatList');if(!el||$('chat').hidden&&!chatCid)return;const near=el.scrollHeight-el.scrollTop-el.clientHeight<120;
  const p=S.pub.find(x=>x.id===chatCid);
  el.innerHTML=chatMsgs.map(m=>{const mine=m.from===myRole();const who=m.from==='master'?'Mestre':(S.unlocked?(p?p.name:'Jogador'):'Você');
    return `<div class="msg ${mine?'me':'them'}"><div class="bub">${m.text?`<p>${esc(m.text).replace(/\n/g,'<br>')}</p>`:''}${(m.att||[]).map(attHTML).join('')}</div><span class="msg-meta">${esc(who)} · ${fmtTime(m.at)}</span></div>`}).join('')
    ||`<p class="chat-empty">${S.unlocked?'Nenhuma mensagem com este jogador ainda.':'Mande uma mensagem ao mestre. Só vocês dois veem esta conversa.'}</p>`;
  if(near||chatFirst){el.scrollTop=el.scrollHeight;chatFirst=false}
}
function renderPending(){$('chatAtt').innerHTML=pendingAtt.map((f,i)=>`<span class="att-chip">${f.type.startsWith('image/')?'🖼':'📎'} ${esc(f.name||'imagem')} <button type="button" data-unatt="${i}" aria-label="Remover anexo">×</button></span>`).join('')}
function addFiles(list){for(const f of list){if(pendingAtt.length>=5){toast('Máximo de 5 anexos por mensagem.');break}if(f.size>FB_MAX*2){toast(f.name+': grande demais.');continue}pendingAtt.push(f)}renderPending()}
async function sendChat(){
  if(chatSending||!chatCid)return;const text=$('chatText').value.trim().slice(0,4000);if(!text&&!pendingAtt.length)return;
  chatSending=true;$('chatSend').disabled=true;$('chatSend').textContent=pendingAtt.length?'Enviando anexos…':'Enviando…';
  try{const att=[];for(const f of pendingAtt){const r=await putBlob(f);att.push({id:r.id,name:r.name,mime:r.mime,size:r.size})}
    const now=Date.now(),role=myRole();
    await S.db.collection('threads/'+chatCid+'/msgs').doc(uid()).set({from:role,uid:S.me.uid,text,att,at:now});
    await S.db.collection('threads').doc(chatCid).set({lastAt:now,lastFrom:role,[role==='master'?'seenMaster':'seenPlayer']:now},{merge:true});
    $('chatText').value='';pendingAtt=[];renderPending();autoGrow();
  }catch(e){toast(e.message&&!e.code?e.message:'Não foi possível enviar. Tente de novo.')}
  chatSending=false;$('chatSend').disabled=false;$('chatSend').textContent='Enviar';
}
function autoGrow(){const t=$('chatText');t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'}
$('chatFab').addEventListener('click',()=>{if(S.unlocked){setView('master');ui.mtab='msgs';renderDesk(true)}else{const m=myPub();if(m)openChat(m.id)}});
$('chatClose').addEventListener('click',closeChat);
$('chatForm').addEventListener('submit',e=>{e.preventDefault();sendChat()});
$('chatText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});
$('chatText').addEventListener('input',autoGrow);
$('chatText').addEventListener('paste',e=>{const fs=[...(e.clipboardData?.files||[])];if(fs.length){e.preventDefault();addFiles(fs)}});
$('chatFile').addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value=''});
$('chatAtt').addEventListener('click',e=>{const b=e.target.closest('[data-unatt]');if(b){pendingAtt.splice(Number(b.dataset.unatt),1);renderPending()}});
$('chatList').addEventListener('click',e=>{const img=e.target.closest('[data-zoom]');if(img){const lb=$('lightbox');lb.querySelector('img').src=img.src;lb.hidden=false}});
$('lightbox').addEventListener('click',()=>$('lightbox').hidden=true);
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('lightbox').hidden)$('lightbox').hidden=true;else if(!$('chat').hidden)closeChat()}});
export function msgsTabHTML(){
  const rows=S.pub.map(p=>({p,t:threads[p.id]||{}})).filter(r=>r.p.owner||r.t.lastAt).sort((a,b)=>(b.t.lastAt||0)-(a.t.lastAt||0));
  return `<div class="panel sheet"><div class="row" style="justify-content:space-between"><h2>Mensagens</h2><span class="hint">Conversas privadas com cada jogador</span></div>
    ${rows.map(({p,t})=>`<button class="pc msgrow${unreadOf(p.id)?' unread':''}" data-thread="${esc(p.id)}">${pic(p)}<span style="min-width:0"><span class="pc-name">${esc(p.name)}${unreadOf(p.id)?' <span class="mine">nova mensagem</span>':''}</span><br><span class="pc-cls">${p.owner?esc(p.ownerName||'Jogador'):'Sem jogador no momento'}${t.lastAt?' · última '+(t.lastFrom==='master'?'sua':'dele')+' '+fmtTime(t.lastAt):' · sem mensagens'}</span></span></button>`).join('')||'<p class="empty">Quando os jogadores escolherem seus personagens, as conversas aparecem aqui.</p>'}</div>`;
}
