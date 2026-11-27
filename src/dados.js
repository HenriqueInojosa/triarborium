/* Mesa de dados: fórmulas, rolagens e animação. */
import { $, STATS, clamp, esc, mod, store, toast, uid } from './util.js';
import { S, ui } from './estado.js';
import { pic } from './imagens.js';
import { find, paint } from './banco.js';
import { myPub } from './jogador.js';
import { fmtTime } from './chat.js';
import { setView } from './acesso.js';
import { obsMode } from './overlays.js';

/* ---------- dice: rolls/<id> in Firestore; each seat (master + every character) has a felt box where its last roll lands ---------- */
const DIE_SIDES=[4,6,8,10,12,20,100];
const DIE_SHAPE={4:'50,8 94,88 6,88',6:'12,12 88,12 88,88 12,88',8:'50,4 95,50 50,96 5,50',10:'50,4 94,40 50,96 6,40',12:'50,4 95,36 78,93 22,93 5,36',20:'50,3 93,27 93,73 50,97 7,73 7,27',100:'50,4 94,40 50,96 6,40'};
const ABBR_STAT={FOR:'str',STR:'str',DES:'dex',DEX:'dex',CON:'con',INT:'int',SAB:'wis',WIS:'wis',CAR:'cha',CHA:'cha'};
const isStat=k=>STATS.some(x=>x[0]===k);
const statName=k=>(STATS.find(x=>x[0]===k)||['',''])[1];
export const statMod=(c,k)=>isStat(k)?Math.floor(((Number(c&&c[k])||10)-10)/2):0;
export const num=v=>Math.trunc(Number(v))||0;
const dropOf=g=>Number.isInteger(g.drop)?g.drop:-1;
const dieLbl=s=>'d'+(s===100?'%':s);
const dieSvg=s=>`<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${DIE_SHAPE[s]||DIE_SHAPE[6]}"/></svg>`;
let rolls=[],localRolls=[],rollsSeen=null,rollsErr='';
export const freshIds=new Set();
const diceUI={n:1,adv:0,bonus:0,expr:'',stat:store.get('tri-dice-stat')||'',hidden:store.get('tri-dice-hidden')==='1',logOpen:false,clearAsk:false};
export function rnd(s){const a=new Uint32Array(1),lim=Math.floor(4294967296/s)*s;do crypto.getRandomValues(a);while(a[0]>=lim);return a[0]%s+1}
/* "2d6+3", "1d20 + FOR - 1", "d%": dice, signed numbers and attribute abbreviations; any other text is ignored */
function parseFormula(str,c){
  const p={groups:[],flat:0,touched:false};
  const src=String(str||'').toUpperCase().replace(/\s+/g,'').replace(/D%/g,'D100');
  const re=/([+-]?)(?:(\d*)D(\d+)|(\d+)|(FOR|STR|DES|DEX|CON|INT|SAB|WIS|CAR|CHA))/g;let m;
  while((m=re.exec(src))){const sg=m[1]==='-'?-1:1;
    if(m[3]){if(p.groups.length<6)p.groups.push({n:clamp(m[2]||1,1,20),s:clamp(m[3],2,100),neg:sg<0});p.touched=true}
    else if(m[4]){if(m[1]){p.flat+=sg*clamp(m[4],0,999);p.touched=true}}
    else if(m[1]||m.index===0){p.flat+=sg*statMod(c,ABBR_STAT[m[5]]);p.touched=true}}
  return p;
}
export const exprOf=p=>(p.groups||[]).map((g,i)=>(g.neg?'-':i?'+':'')+g.n+dieLbl(g.s)).join('')+(p.flat?(p.flat>0?'+':'')+p.flat:'');
/* a skill rolls its "Dados" plus the chosen attribute's modifier; with only a modifier it becomes a d20 test */
export function skillParse(s,c){
  const p=parseFormula(s.dice,c);if(isStat(s.stat)){p.flat+=statMod(c,s.stat);p.touched=true}
  if(!p.groups.length){if(!p.touched)return null;p.groups.push({n:1,s:20,neg:false})}
  return p;
}
/* advantage/disadvantage rolls the first single d20 twice and drops one */
function makeRoll(p,adv){
  let total=p.flat,used=0;
  const groups=p.groups.map(g=>{const r=Array.from({length:g.n},()=>rnd(g.s));let drop=-1;
    if(adv&&!used&&g.s===20&&g.n===1&&!g.neg){r.push(rnd(20));drop=adv>0?(r[0]>=r[1]?1:0):(r[0]<=r[1]?1:0);used=adv}
    const sum=r.reduce((a,v,i)=>a+(i===drop?0:v),0);total+=g.neg?-sum:sum;return{s:g.s,r,drop,neg:!!g.neg}});
  return{groups,total,adv:used};
}
function natOf(r){
  const g=(r.groups||[]).find(g=>num(g.s)===20&&!g.neg&&(g.r||[]).length-(dropOf(g)>=0?1:0)===1);if(!g)return 0;
  const v=num(g.r.find((_,i)=>i!==dropOf(g)));return v===20?1:v===1?-1:0;
}
const breakdown=r=>(r.groups||[]).map((g,i)=>{const d=dropOf(g);return (g.neg?' − ':i?' + ':'')+'['+(g.r||[]).map((v,j)=>j===d?`<s>${num(v)}</s>`:num(v)).join(', ')+']'}).join('')+(num(r.flat)?(num(r.flat)>0?' + ':' − ')+Math.abs(num(r.flat)):'');
const myChar=()=>{const p=myPub();return p?find('chars',p.id)||null:null};
export function canRollFor(col,c){if(!S.db||!c)return false;if(col==='mnpcs')return S.unlocked;if(col!=='chars')return false;if(S.unlocked)return true;const p=myPub();return !!p&&p.id===c.id}
export function rollerIdentity(c,col){
  if(c&&col==='mnpcs')return{charId:'master',who:String(c.name||'NPC').slice(0,80),from:'master'};
  if(c&&col==='chars')return{charId:c.id,who:String(c.name||'Personagem').slice(0,80),from:S.unlocked?'master':'player'};
  if(S.unlocked)return{charId:'master',who:'Mestre',from:'master'};
  const p=myPub();return p?{charId:p.id,who:String(p.name||'Jogador').slice(0,80),from:'player'}:null;
}
function markFresh(id){freshIds.add(id);setTimeout(()=>{freshIds.delete(id);renderDice()},2600)}
export async function doRoll(p,label,who,opts={}){
  if(!S.db||!who){toast('Entre com Google e escolha seu personagem para rolar.');return}
  if(!p.groups.length){toast('A fórmula precisa de dados, ex.: 1d20+3.');return}
  const res=makeRoll(p,opts.noAdv?0:diceUI.adv),id=uid();if(!opts.noAdv)diceUI.adv=0;
  const doc={...who,label:String(label||'').slice(0,80),expr:(exprOf(p)+(res.adv>0?' · vantagem':res.adv<0?' · desvantagem':'')).slice(0,80),groups:res.groups,flat:p.flat,total:res.total,uid:S.me?S.me.uid:'',at:Date.now()};
  markFresh(id);
  if(S.unlocked&&diceUI.hidden){localRolls=[{id,...doc,secret:true},...localRolls].slice(0,20);announce(localRolls[0]);renderDice();return doc}
  try{await S.db.collection('rolls').doc(id).set(doc)}
  catch(e){freshIds.delete(id);toast(e&&e.code==='invalid_argument'?'O banco recusou a rolagem: confira se as regras novas do Firestore foram publicadas.':'Não foi possível rolar agora. Tente de novo.');renderDice();return null}
  renderDice();return doc;
}
/* rolls from the table: "Rolar com" (players) and the bonus apply to every die rolled here */
function trayRoll(p,label){
  const c=S.unlocked?null:myChar(),st=c&&isStat(diceUI.stat)?diceUI.stat:'';
  if(st){p.flat+=statMod(c,st);label+=' + '+statName(st)}
  if(diceUI.bonus)p.flat+=diceUI.bonus;
  doRoll(p,label,rollerIdentity());
}
export function sheetRoll(col,c,d){
  if(!canRollFor(col,c)){toast('Só o dono do personagem e o mestre rolam por esta ficha.');return}
  const who=rollerIdentity(c,col);
  if(d.rollStat){if(isStat(d.rollStat))doRoll({groups:[{n:1,s:20,neg:false}],flat:statMod(c,d.rollStat)},'Teste de '+statName(d.rollStat),who);return}
  const s=(c.skills||[]).find(x=>x.id===d.rollSkill),p=s&&skillParse(s,c);if(p)doRoll(p,s.name||'Habilidade',who);
}
export function watchRolls(){
  if(!S.db||obsMode||watchRolls.on)return;watchRolls.on=true;
  S.db.collection('rolls').orderBy('at','desc').limit(40).onSnapshot(s=>{
    const list=s.docs.map(d=>({id:d.id,...d.data()}));rollsErr='';
    if(rollsSeen&&S.unlocked){rollsSincePrune+=list.filter(r=>!rollsSeen.has(r.id)).length;if(rollsSincePrune>=20){rollsSincePrune=0;pruneRolls()}}
    if(rollsSeen)for(const r of list)if(!rollsSeen.has(r.id)&&num(r.at)>Date.now()-20000){if(!freshIds.has(r.id))markFresh(r.id);announce(r)}
    rollsSeen=new Set(list.map(r=>r.id));rolls=list;renderDice();
  },e=>{rollsErr=e&&e.code==='invalid_argument'?'perm':'net';renderDice()});
}
/* the master's device keeps the table small: only the newest 60 rolls survive */
let rollsSincePrune=0;
export async function pruneRolls(){try{const s=await S.db.collection('rolls').orderBy('at','desc').get();for(const d of s.docs.slice(60))await S.db.collection('rolls').doc(d.id).delete()}catch(e){}}
async function clearRolls(){
  try{const s=await S.db.collection('rolls').get();await Promise.all(s.docs.map(d=>S.db.collection('rolls').doc(d.id).delete()));localRolls=[];toast('Mesa de dados limpa.')}
  catch(e){toast('Não foi possível limpar a mesa.')}
  renderDice();
}
export const seatList=()=>[{id:'master',name:'Mestre'},...S.pub.map(p=>({id:p.id,name:p.name||'Personagem',portrait:p.portrait,sub:p.ownerName||''}))];
function diceHTML(r,fresh){
  let i=0;const n=natOf(r);
  return (r.groups||[]).slice(0,6).map(g=>{const s=clamp(g.s,2,100),d=dropOf(g);
    return (g.r||[]).slice(0,21).map((v,j)=>{const val=clamp(v,0,999),kept=j!==d;
      const cls=['die','d'+s,fresh?'fresh':'',kept?'':'drop',kept&&s===20&&n&&!g.neg?(n>0?'crit':'fumble'):''].filter(Boolean).join(' ');
      return `<span class="${cls}" style="--i:${i++}" data-s="${s}" data-v="${val}">${dieSvg(s)}<b>${val}</b></span>`}).join('')}).join('');
}
export function seatHTML(seat,r,mine){
  const fresh=!!r&&freshIds.has(r.id),n=r?natOf(r):0;
  const sub=r&&r.who&&r.who!==seat.name?r.who:seat.sub;
  const head=`<div class="seat-head">${seat.id==='master'?'<span class="seat-gm" aria-hidden="true">♛</span>':pic(seat)}<span><b>${esc(seat.name)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span></div>`;
  if(!r)return `<div class="seat${mine?' me':''}">${head}<div class="seat-felt"><span class="seat-idle">Nenhuma rolagem</span></div></div>`;
  return `<div class="seat${mine?' me':''}${fresh?' fresh':''}${n>0?' crit':n<0?' fumble':''}">${head}<div class="seat-felt">${diceHTML(r,fresh)}</div>
    <div class="seat-res"><span class="seat-lbl" title="${esc(r.label)}">${r.secret?'🔒 ':''}${esc(r.label||r.expr)}</span><b class="seat-total">${num(r.total)}</b></div>
    <div class="seat-expr">${esc(r.expr)}${n>0?' · <em>Crítico!</em>':n<0?' · <em>Falha crítica</em>':''}</div></div>`;
}
function rollerHTML(){
  if(!rollerIdentity())return '<p class="hint">Entre com Google e escolha seu personagem para rolar.</p>';
  const c=S.unlocked?null:myChar();
  return `<div class="roller">
    <div class="roller-row"><div class="qty" role="group" aria-label="Quantidade de dados"><button class="btn sm" data-dq="-1" aria-label="Menos um dado" ${diceUI.n<=1?'disabled':''}>−</button><b>${diceUI.n}</b><button class="btn sm" data-dq="1" aria-label="Mais um dado" ${diceUI.n>=20?'disabled':''}>+</button></div>
      <div class="dbtns">${DIE_SIDES.map(s=>`<button class="dbtn" data-die="${s}" title="Rolar ${diceUI.n}${dieLbl(s)}">${dieSvg(s)}<span>${diceUI.n>1?diceUI.n:''}${dieLbl(s)}</span></button>`).join('')}</div></div>
    <div class="roller-row">${c?`<label class="field inline">Rolar com<select id="dStat"><option value="">Nada</option>${STATS.map(([k,n])=>`<option value="${k}"${diceUI.stat===k?' selected':''}>${n} (${mod(c[k]??10)})</option>`).join('')}</select></label>`:''}
      <label class="field inline">Bônus<input id="dBonus" type="number" min="-99" max="99" value="${diceUI.bonus}"></label>
      <div class="seg" role="group" aria-label="Vantagem no próximo d20">${[[0,'Normal'],[1,'Vantagem'],[-1,'Desvantagem']].map(([v,l])=>`<button type="button" class="${diceUI.adv===v?'on':''}" data-adv="${v}" aria-pressed="${diceUI.adv===v}" title="Vale para o próximo d20">${l}</button>`).join('')}</div>
      ${S.unlocked?`<label class="row lbl"><input type="checkbox" id="dHidden"${diceUI.hidden?' checked':''}> Rolagem oculta (só você vê)</label>`:''}</div>
    <form class="roller-row" id="dForm"><input id="dExpr" value="${esc(diceUI.expr)}" placeholder="Fórmula livre: 2d6+1d4+3, 1d20+FOR…" maxlength="60" aria-label="Fórmula livre"><button class="btn gold">Rolar</button></form></div>`;
}
export function animateDice(root){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  root.querySelectorAll('.die.fresh').forEach(d=>{const s=num(d.dataset.s)||6,v=d.dataset.v,b=d.querySelector('b'),end=performance.now()+620+num(d.style.getPropertyValue('--i'))*70;
    const t=setInterval(()=>{if(!d.isConnected||performance.now()>=end){clearInterval(t);b.textContent=v;return}b.textContent=1+Math.floor(Math.random()*s)},55)});
}
function trayInView(){const t=$('diceTray');if(!t||t.hidden||$('groupView').hidden)return false;const b=t.getBoundingClientRect();return b.bottom>80&&b.top<innerHeight-80}
/* a roll that lands while the table is off screen pops up in the corner */
function announce(r){
  // na tela de entrada (antes de logar ou escolher personagem) os dados rolados não aparecem
  if(obsMode||trayInView()||document.body.classList.contains('kz-on'))return;const f=$('diceFeed');if(!f)return;
  const seat=seatList().find(s=>s.id===r.charId)||{id:String(r.charId||''),name:r.who||'?'};
  const el=document.createElement('div');el.className='dice-pop';el.style.cursor='pointer';el.title='Abrir a mesa de dados';el.innerHTML=seatHTML(seat,r,false);
  el.addEventListener('click',()=>{if(ui.view!=='group')setView('group');const t=$('diceTray');if(!t.hidden)t.scrollIntoView({behavior:'smooth',block:'center'})});
  f.prepend(el);while(f.children.length>3)f.lastElementChild.remove();animateDice(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)},5000);
}
export function renderDice(){
  const tray=$('diceTray');if(!tray||obsMode)return;
  const show=!!S.db&&!!S.me&&!document.body.classList.contains('kz-on')&&(S.unlocked||(!S.me.anon&&!!myPub()));
  tray.hidden=!show;if(!show)return;
  if(!tray.firstElementChild)tray.innerHTML='<div class="dt-head" id="dHead"></div><div class="seats" id="dSeats"></div><div id="dRoller"></div><div id="dLog"></div>';
  const set=(el,h)=>{if(el._h!==h){el._h=h;el.innerHTML=h}};
  set($('dHead'),`<h2>Mesa de dados</h2>${rollsErr==='perm'?'<span class="hint warn">O banco bloqueou as rolagens: publique as regras novas do Firestore.</span>':rollsErr?'<span class="hint warn">Sem conexão com a mesa de dados.</span>':''}${S.unlocked?(diceUI.clearAsk?'<span class="row"><span class="hint">Apagar todas as rolagens?</span><button class="btn sm danger" data-dclear="yes">Apagar</button><button class="btn sm" data-dclear="no">Cancelar</button></span>':'<button class="btn sm" data-dclear="ask">Limpar mesa</button>'):''}`);
  const all=[...localRolls,...rolls].sort((a,b)=>num(b.at)-num(a.at)),mineId=S.unlocked?'master':(myPub()||{}).id,box=$('dSeats'),seats=seatList();
  const keep=new Set(seats.map(s=>s.id));[...box.children].forEach(el=>{if(!keep.has(el.dataset.seat))el.remove()});
  seats.forEach((s,i)=>{let el=[...box.children].find(x=>x.dataset.seat===s.id);if(!el){el=document.createElement('div');el.dataset.seat=s.id}
    if(box.children[i]!==el)box.insertBefore(el,box.children[i]||null);
    const h=seatHTML(s,all.find(r=>r.charId===s.id),s.id===mineId);if(el._h!==h){el._h=h;el.innerHTML=h;animateDice(el)}});
  const rl=$('dRoller'),rh=rollerHTML();if(rl._h!==rh){rl._h=rh;paint(rl,rh)}
  set($('dLog'),all.length?`<details class="dlog"${diceUI.logOpen?' open':''}><summary>Histórico (${all.length})</summary><ol>${all.slice(0,40).map(r=>{const n=natOf(r);return `<li><span class="t">${fmtTime(r.at)}</span> <b>${esc(r.who)}</b> · ${r.secret?'🔒 ':''}${esc(r.label||r.expr)}: ${breakdown(r)} = <b>${num(r.total)}</b>${n>0?' ✦ crítico':n<0?' ✖ falha crítica':''}</li>`}).join('')}</ol></details>`:'');
}
$('diceTray').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.die){const s=clamp(d.die,2,100);trayRoll({groups:[{n:diceUI.n,s,neg:false}],flat:0},diceUI.n+dieLbl(s));return}
  if(d.dq){diceUI.n=clamp(diceUI.n+Number(d.dq),1,20);renderDice();return}
  if(d.adv!==undefined){diceUI.adv=Number(d.adv)||0;renderDice();return}
  if(d.dclear&&S.unlocked){diceUI.clearAsk=d.dclear==='ask';if(d.dclear==='yes')clearRolls();renderDice()}
});
$('diceTray').addEventListener('change',e=>{const t=e.target;
  if(t.id==='dStat'){diceUI.stat=isStat(t.value)?t.value:'';store.set('tri-dice-stat',diceUI.stat||null)}
  else if(t.id==='dHidden'){diceUI.hidden=t.checked;store.set('tri-dice-hidden',t.checked?'1':null)}});
$('diceTray').addEventListener('input',e=>{const t=e.target;if(t.id==='dBonus')diceUI.bonus=clamp(t.value,-99,99);else if(t.id==='dExpr')diceUI.expr=t.value.slice(0,60)});
$('diceTray').addEventListener('submit',e=>{if(e.target.id!=='dForm')return;e.preventDefault();
  const p=parseFormula(diceUI.expr,S.unlocked?null:myChar());if(!p.groups.length){toast('Escreva uma fórmula com dados, ex.: 2d6+3.');return}
  trayRoll(p,diceUI.expr.trim().slice(0,40))});
$('diceTray').addEventListener('toggle',e=>{if(e.target.matches('details.dlog'))diceUI.logOpen=e.target.open},true);
