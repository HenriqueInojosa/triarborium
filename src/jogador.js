/* Tela do grupo e do jogador: barra de combate, lista de personagens, retrato e HUD. */
import { $, clamp, esc, store, toast } from './util.js';
import { S, SHOW_HP, data, ui } from './estado.js';
import { blob, face, pic, sanOf } from './imagens.js';
import { paint, write } from './banco.js';
import { curChar, sheetHTML, wireSheet } from './ficha.js';
import { renderDesk, scalePreview } from './mestre.js';
import { setView } from './acesso.js';
import { hudHTML, obsMode, ov, setOv } from './overlays.js';
import { isDead } from './ruptura.js';
import { render } from './app.js';

/* ---------- combat: turn bar for everyone (BG3-style), splash on start, "your turn" alert ---------- */
export function combatBar(ini,ents){
  const turn=Math.min(ini.turn||0,ents.length-1),mine=myPub(),cur=ents[turn];const myTurn=!!(mine&&cur&&cur.ref===mine.id);
  const tiles=ents.map((en,i)=>{const p=en.kind==='char'?S.pub.find(x=>x.id===en.ref):null,hpMax=p?Number(p.hpMax)||0:0,hp=p?Number(p.hp)||0:0;
    const cls=['cbt',en.kind==='npc'?'foe':'ally',i===turn?'now':'',i<turn?'done':'',mine&&en.ref===mine.id?'me':''].join(' ');
    return `<div class="${cls}" title="${esc(en.name)}">${i===turn?'<span class="cbt-mark">▼</span>':''}<span class="cbt-frame">${pic(en)}</span>${SHOW_HP&&hpMax?`<span class="cbt-hp"><i style="width:${Math.round(hp/hpMax*100)}%"></i></span>`:''}<span class="cbt-name">${esc(String(en.name||'').split(' ')[0])}</span>${ini.showNumbers?`<span class="cbt-n">${Number(en.init)||0}</span>`:''}</div>`}).join('');
  return `<div class="combat${myTurn?' myturn':''}" role="status" aria-live="polite"><div class="cbt-round"><small>Rodada</small><b>${Number(ini.round)||1}</b></div><div class="cbt-track">${tiles}</div>
    <div class="cbt-now"><small>${myTurn?'É a sua vez':'Turno de'}</small><b>${esc(cur?cur.name:'')}</b>${S.unlocked&&S.canWrite?`<span class="row"><button class="btn sm" data-turn="prev" aria-label="Turno anterior">◀</button><button class="btn gold sm" data-turn="next">Passar turno ▶</button></span>`:''}</div></div>`;
}
function stepTurn(dir){
  const ini=structuredClone(S.live.initiative||{entries:[],round:1,turn:0});const n=(ini.entries||[]).length;if(!n)return;
  if(dir>0){ini.turn=(ini.turn||0)+1;if(ini.turn>=n){ini.turn=0;ini.round=(ini.round||1)+1}}
  else{ini.turn=(ini.turn||0)-1;if(ini.turn<0){if((ini.round||1)>1){ini.round--;ini.turn=n-1}else ini.turn=0}}
  write('session','live',{initiative:ini});renderLive();if(S.unlocked)renderDesk(false);
}
function splash(title,sub,kind){
  if(obsMode||document.body.classList.contains('kz-on'))return;
  const el=document.createElement('div');el.className='cbt-splash '+kind;el.innerHTML=`<div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>`;
  document.body.appendChild(el);setTimeout(()=>el.remove(),2700);
}
let prevCombat=null,prevTurnKey=null;
export function combatAlerts(){
  const ini=S.live.initiative||{},ents=ini.entries||[],on=combatOn(ini),cur=ents[ini.turn||0],key=on&&cur?cur.id+'|'+(ini.round||1):'',mine=myPub();
  if(prevCombat===false&&on)splash('Combate!','Rolem a iniciativa. A torre não espera.','fight');
  else if(prevCombat===true&&!on)splash('Fim do combate','Respirem. Por enquanto.','end');
  else if(prevTurnKey!==null&&key&&key!==prevTurnKey&&mine&&cur.ref===mine.id)splash('Sua vez!',mine.name+', o palco é seu.','turn');
  prevCombat=on;prevTurnKey=key;
}
/* combat only shows to players once the master clicks "Iniciar combate" (started===false while the list is being set up) */
export const combatOn=ini=>!!ini&&(ini.entries||[]).length>0&&ini.started!==false;
export function renderLive(){
  const ini=S.live.initiative||{entries:[]},ents=ini.entries||[];let h='';
  if(combatOn(ini))h+=combatBar(ini,ents);
  const sceneNpcs=ov().visible!==false?(ov().npcs||[]):[];
  if(sceneNpcs.length)h+=`<div class="panel scene${sceneNpcs.length===1?' solo':''}"><h2>Em cena</h2><div class="scene-row">${sceneNpcs.map(n=>`<figure class="scene-card" style="margin:0"><div class="scene-frame">${pic(n)}</div><figcaption class="scene-name">${esc(n.name)}</figcaption></figure>`).join('')}</div></div>`;
  if(S.db&&!S.canWrite)h=`<div class="notice"><b>Modo leitura.</b> Sua conta entrou como Visualizador, então dá para ver as fichas mas não salvar mudanças. Peça ao dono da página acesso de <b>Colaborador</b> (ou <b>Editor</b>) no menu Share.</div>`+h;
  const r=S.live.reveal;
  if(r){h+=`<div class="panel reveal">${blob(r.image)?`<img src="${blob(r.image)}" alt="${esc(r.name)}">`:'<span></span>'}<div><p class="hint">O mestre está mostrando</p><h3>${esc(r.name)}</h3>${r.description?`<p class="desc">${esc(r.description)}</p>`:''}</div></div>`}
  const lb=$('livebar');if(lb._h!==h){lb._h=h;lb.innerHTML=h;
    const tr=lb.querySelector('.cbt-track'),now=tr&&tr.querySelector('.cbt.now');if(now)tr.scrollLeft=Math.max(0,now.offsetLeft-tr.offsetLeft-tr.clientWidth/2+now.offsetWidth/2)}
}
export function renderRoster(){
  const cs=data.chars;
  $('count').textContent=cs.length?cs.length+(cs.length===1?' personagem':' personagens'):'';
  if(!cs.length){$('roster').innerHTML='<p class="empty">Nenhuma ficha ainda.'+(S.isMaster?' Adicione o HTML de uma ficha individual abaixo.':' O mestre vai adicionar as fichas.')+'</p>';return}
  $('roster').innerHTML=cs.map(c=>{const hpMax=Number(c.hpMax)||0,hp=Number(c.hp)||0,san=clamp(c.sanity??100,0,100);
    return `<button class="pc${c.id===ui.sel?' active':''}" data-pick="${esc(c.id)}">${pic(c)}<span style="min-width:0"><span class="pc-name">${esc(c.name)}${c.id===ui.mine?'<span class="mine">você</span>':''}</span><br><span class="pc-cls">${esc(c.cls||'Aventureiro')}${SHOW_HP?` · PV ${hp}/${hpMax}`:''} · San ${san}${isDead(c)?' · ☠ Morto':san===0?' · Em ruptura':''}</span><span class="bars"><span class="bar hp"${SHOW_HP?'':' hidden'}><i style="width:${hpMax?Math.round(hp/hpMax*100):0}%"></i></span><span class="bar san"><i style="width:${san}%"></i></span></span></span></button>`}).join('');
}
export function renderSheet(force){
  const c=curChar(),el=$('sheet');
  const html=c?sheetHTML(c,{col:'chars',m:S.unlocked&&S.canWrite,edit:S.canWrite,tab:ui.tab,notesKey:'playerNotes',histKey:'playerHistory',desk:true}):`<div class="empty">${data.chars.length?'Escolha um personagem na lista.':'Carregando ficha…'}</div>`;
  if(force)el.innerHTML=html;else paint(el,html);
}
/* ---------- player side: Google login, pick a character, then only that sheet ---------- */
export const myPub=()=>S.me&&!S.me.anon?S.pub.find(p=>p.owner===S.me.uid):null;
export function subscribeMine(id){
  if(S.mySubId===id)return;if(S.mySub){S.mySub();S.mySub=null}S.mySubId=id;data.chars=[];if(!id)return;
  S.mySub=S.db.collection('chars').doc(id).onSnapshot(s=>{data.chars=s.exists?[{id:s.id,...structuredClone(s.data())}]:[];ui.sel=id;render()},()=>{toast('Não foi possível abrir a sua ficha.')});
}
/* Karazhan gate: full-screen night scene for login and hero choice */
export const SIGIL=`<svg class="kz-sigil" viewBox="-100 -100 200 200" aria-hidden="true" fill="none" stroke="currentColor"><circle r="96" stroke-width=".6"/><circle r="90" stroke-width="1.4"/><circle r="70" stroke-width=".6" stroke-dasharray="2 4"/><circle r="40" stroke-width=".8"/>${Array.from({length:24},(_,i)=>{const a=i*15*Math.PI/180,r1=i%2?86:82;return `<line x1="${(Math.cos(a)*r1).toFixed(1)}" y1="${(Math.sin(a)*r1).toFixed(1)}" x2="${(Math.cos(a)*90).toFixed(1)}" y2="${(Math.sin(a)*90).toFixed(1)}" stroke-width=".8"/>`}).join('')}<path d="M0 -70 L60.6 35 L-60.6 35 Z M0 70 L60.6 -35 L-60.6 -35 Z" stroke-width=".7"/>${Array.from({length:6},(_,i)=>{const a=(i*60-90)*Math.PI/180;return `<circle cx="${(Math.cos(a)*70).toFixed(1)}" cy="${(Math.sin(a)*70).toFixed(1)}" r="4" stroke-width=".8"/>`}).join('')}</svg>`;
function kzScene(inner){return `<div class="kz"><div class="kz-sky"></div><div class="kz-tower"></div>${SIGIL}<canvas class="kz-motes" aria-hidden="true"></canvas><div class="kz-content">${inner}</div><button class="kz-master" data-go-master>✦ Área do Mestre</button></div>`}
export function startMotes(root){
  const cv=root.querySelector('.kz-motes');if(!cv||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const ctx=cv.getContext('2d');let W,H,dpr;const P=[];
  const size=()=>{dpr=Math.min(2,devicePixelRatio||1);W=cv.clientWidth;H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)};size();addEventListener('resize',size);
  const spawn=(y)=>({x:Math.random()*W,y:y??H+10,r:Math.random()*1.8+.4,v:Math.random()*.35+.12,d:(Math.random()-.5)*.25,t:Math.random()*6.28,gold:Math.random()<.28});
  for(let i=0;i<80;i++)P.push(spawn(Math.random()*H));
  (function frame(){if(!cv.isConnected){removeEventListener('resize',size);return}
    ctx.clearRect(0,0,W,H);for(const p of P){p.y-=p.v;p.x+=p.d+Math.sin(p.t)*.15;p.t+=.02;if(p.y<-10)Object.assign(p,spawn());
      const a=.35+.45*Math.abs(Math.sin(p.t));ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.283);ctx.fillStyle=p.gold?`rgba(240,200,120,${a})`:`rgba(190,140,255,${a})`;ctx.shadowBlur=8;ctx.shadowColor=p.gold?'#f0c878':'#b98cff';ctx.fill()}
    requestAnimationFrame(frame)})();
}
function setPV(pv,html){if(pv._h===html)return;pv._h=html;pv.innerHTML=html;startMotes(pv)}
function renderAcct(){
  const h=(S.unlocked?'<button class="btn sm" data-master-lock title="Sair do modo mestre neste aparelho">Sair do mestre</button>':'')+(S.me&&!S.me.anon?'<button class="btn sm" data-logout title="Sair da conta Google">Sair da conta</button>':'');
  const el=$('acct');if(el&&el._h!==h){el._h=h;el.innerHTML=h}
}
/* the player's own painted HUD (same frame the OBS overlay uses) above their sheet */
export function renderMyHud(){const w=$('myHud'),c=curChar();if(!c){w.hidden=true;return}w.hidden=false;
  /* player screen: just the framed portrait (health and sanity already live in the sheet below) */
  let pp=w.querySelector('.pportrait');const solo=document.body.classList.contains('pmode');
  if(solo){if(!pp){pp=document.createElement('div');pp.className='pportrait';w.appendChild(pp)}w.firstElementChild.hidden=true;pp.hidden=false;const dead=isDead(c),rup=!dead&&sanOf(c)<=0;pp.classList.toggle('dead',dead);const ph=`<div class="scene-frame">${pic(c)}</div><div class="pp-txt"><h3>${esc(c.name||'')}</h3>${c.cls?`<p>${esc(c.cls)}</p>`:''}${dead?'<p class="pp-state">☠ Morto</p>':rup?'<p class="pp-state">Em ruptura</p>':''}</div>`;if(pp._h!==ph){pp._h=ph;pp.innerHTML=ph}return}
  if(pp)pp.hidden=true;w.firstElementChild.hidden=false;const box=w.firstElementChild,h=hudHTML(c);if(box._h!==h){box._h=h;box.innerHTML=h}scalePreview()}
export function renderPlayer(){
  renderAcct();$('myHud').hidden=true;document.body.classList.remove('pmode');
  const pv=$('playerView'),bar=$('playerBar'),lay=$('sheetLayout');
  const gateOn=ui.view==='group'&&!S.unlocked&&!!S.me&&S.pubLoaded&&(S.me.anon||!myPub());
  document.body.classList.toggle('kz-on',gateOn);
  if(S.unlocked){pv.hidden=true;bar.hidden=true;lay.hidden=false;$('rosterPanel').hidden=false;lay.classList.remove('solo');return}
  $('rosterPanel').hidden=true;lay.classList.add('solo');
  if(!S.me||!S.pubLoaded){pv.hidden=false;bar.hidden=true;lay.hidden=true;setPV(pv,'<p class="hint">Conectando…</p>');return}
  const crest=(document.querySelector('.brand img')||{}).src||'';
  if(S.me.anon){subscribeMine(null);pv.hidden=false;bar.hidden=true;lay.hidden=true;
    setPV(pv,kzScene(`<div class="kz-card">
      <img class="kz-crest" src="${crest}" alt="Brasão Triarborium">
      <p class="kz-eyebrow">Triarborium · Campanha II</p>
      <h1 class="kz-title">Sombras de Karazhan</h1>
      <div class="kz-orn"><span>◆</span></div>
      <p class="kz-lore">A torre desperta sob a lua violeta.<br>Diga seu nome à porta e reclame o seu herói.</p>
      <button class="kz-btn" data-login><span class="kz-btn-main">Atravessar o portão</span><span class="kz-btn-sub">Entrar com Google</span></button>
      <p class="kz-fine">Só você e o mestre verão a sua ficha.</p></div>`));return}
  const mine=myPub();
  if(!mine){subscribeMine(null);pv.hidden=false;bar.hidden=true;lay.hidden=true;
    setPV(pv,kzScene(`<div class="kz-pick">
      <div class="kz-pickhead"><img class="kz-crest sm" src="${crest}" alt=""><div><p class="kz-eyebrow">Bem-vindo, viajante</p><h1 class="kz-title sm">Escolha seu herói</h1></div><button class="kz-ghost" data-logout>Sair</button></div>
      <p class="kz-lore">Cada herói só pode ter um portador. Os que já atravessaram o portão aparecem apagados.</p>
      <div class="kz-grid">${S.pub.map(p=>{const taken=p.owner&&p.owner!==S.me.uid;return `<button class="kz-hero${taken?' taken':''}" data-claim="${esc(p.id)}" ${taken?'disabled':''}><span class="kz-frame">${blob(p.portrait)?`<img src="${face(p)}" alt="">`:`<span class="ph">${esc((p.name||'?').charAt(0))}</span>`}</span><b>${esc(p.name)}</b><span class="kz-cls">${taken?'Já escolhido':esc(p.cls||'Aventureiro')}</span></button>`}).join('')||'<p class="kz-lore">O mestre ainda não cadastrou heróis.</p>'}</div></div>`));return}
  pv.hidden=true;pv._h='';lay.hidden=false;bar.hidden=true;document.body.classList.add('pmode');subscribeMine(mine.id);renderMyHud();
  bar.innerHTML=`<span class="hint">Jogando como <b>${esc(mine.name)}</b></span><span class="row"><button class="btn sm" data-release>Trocar personagem</button><button class="btn sm" data-logout>Sair</button></span>`;
}
async function claim(id){
  const p=S.pub.find(x=>x.id===id);if(!p||p.owner)return;
  try{await S.db.collection('public').doc(id).update({owner:S.me.uid,ownerName:(S.me.name||S.me.email||'Jogador').slice(0,60)});toast('Você é '+p.name+'.')}
  catch(e){toast('Esse personagem já foi escolhido por outra pessoa.')}
}
async function release(id){try{await S.db.collection('public').doc(id).update({owner:null,ownerName:null})}catch(e){toast('Não foi possível liberar o personagem.')}}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||!S.auth)return;
  if('login' in b.dataset){try{await S.auth.google()}catch(err){toast('Login cancelado ou bloqueado ('+(err.code||'erro')+').')}}
  else if('logout' in b.dataset){await S.auth.signOut()}
  else if(b.dataset.claim){claim(b.dataset.claim)}
  else if('release' in b.dataset){const m=myPub();if(m){ui.confirm=null;await release(m.id)}}
  else if('goMaster' in b.dataset){setView('master')}
  else if(b.dataset.turn){if(S.unlocked)stepTurn(b.dataset.turn==='next'?1:-1)}
  else if('masterLock' in b.dataset){$('lockBtn').click();toast('Modo mestre encerrado neste aparelho.')}
  else if(b.dataset.masterRelease){await release(b.dataset.masterRelease);toast('Personagem liberado.')}
});
$('roster').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;ui.sel=b.dataset.pick;ui.confirm=null;store.set('tri-sel',ui.sel);if(S.unlocked&&S.canWrite&&ov().follow!==false&&ov().selected!==ui.sel)setOv({selected:ui.sel});renderRoster();renderSheet(true)});
wireSheet($('sheet'),()=>({col:'chars',c:curChar(),m:S.unlocked&&S.canWrite,edit:S.canWrite,setTab:t=>ui.tab=t,rerender:f=>{renderRoster();renderSheet(f)}}));
