/* Testes de ruptura (sanidade). */
import { clamp, toast } from './util.js';
import { S } from './estado.js';
import { sanOf } from './imagens.js';
import { write } from './banco.js';
import { renderMyHud, renderRoster } from './jogador.js';
import { canRollFor, doRoll, num, rollerIdentity } from './dados.js';

/* ---------- rupture: sanity at 0. Each turn roll 1d20: 10+ success, under 10 failure.
   3 successes: back with 1 sanity. 3 failures: dead. Natural 20: back at once. Natural 1: two failures. ---------- */
const ruptOf=c=>{const r=(c&&c.rupture)||{};return{s:clamp(r.s||0,0,3),f:clamp(r.f||0,0,3),dead:r.state==='dead'}};
export const isDead=c=>{if(!c)return false;if(c.rupture!==undefined)return ruptOf(c).dead;const p=typeof S.pub!=='undefined'&&S.pub.find(x=>x.id===c.id);return !!p&&ruptOf(p).dead};
export function ruptHTML(c,m,R){
  const r=ruptOf(c),marks=(n,k)=>Array.from({length:3},(_,i)=>`<i class="${k}${i<n?' on':''}"></i>`).join('');
  return `<div class="rupt${r.dead?' dead':''}"><div class="rupt-head"><b>${r.dead?'☠ Morto':'Em ruptura'}</b><span class="hint">${r.dead?'Três falhas no teste de ruptura.':'A cada turno, role 1d20: 10 ou mais é sucesso, abaixo de 10 é falha. 3 sucessos: volta com 1 de sanidade. 3 falhas: morre. 20 natural volta na hora; 1 natural conta 2 falhas.'}</span></div>
    ${r.dead?'':`<div class="rupt-marks"><span class="ok">Sucessos</span>${marks(r.s,'ok')}<span class="bad">Falhas</span>${marks(r.f,'bad')}</div>`}
    <div class="row">${!r.dead&&R?'<button class="btn sm gold" data-rupt-roll>🎲 Teste de ruptura (1d20)</button>':''}${m?(r.dead?'<button class="btn sm" data-rupt="revive">Reviver com 1 de sanidade</button>':'<button class="btn sm" data-rupt="s">+ Sucesso</button><button class="btn sm" data-rupt="f">+ Falha</button><button class="btn sm" data-rupt="reset">Zerar</button>'):''}</div></div>`;
}
export function applyRupt(col,c,ev){
  let {s,f}=ruptOf(c),patch,msg='';const nm=c.name||'Personagem';
  if(ev==='reset'){patch={rupture:{s:0,f:0,state:''}}}
  else if(ev==='back'||ev==='revive'){patch={rupture:null,sanity:1};msg=ev==='back'?nm+' tirou 20 natural e voltou com 1 de sanidade!':nm+' voltou com 1 de sanidade.'}
  else{if(ev==='s')s++;else f+=ev==='f2'?2:1;
    if(s>=3){patch={rupture:null,sanity:1};msg=nm+' venceu a ruptura e voltou com 1 de sanidade.'}
    else if(f>=3){patch={rupture:{s,f:3,state:'dead'}};msg=nm+' sucumbiu à ruptura. ☠'}
    else{patch={rupture:{s,f,state:''}};msg=(ev==='s'?'Sucesso':ev==='f2'?'1 natural: duas falhas':'Falha')+` (${s} sucesso${s===1?'':'s'}, ${f} falha${f===1?'':'s'})`}}
  write(col,c.id,patch);
  /* write() only mirrors the public summary for the master; the player updates it here (rules allow it only while in rupture) */
  if(!S.unlocked&&col==='chars'){const pp=S.pub.find(x=>x.id===c.id);if(pp)Object.assign(pp,patch);S.db.collection('public').doc(c.id).update(patch).catch(()=>{})}
  if(msg)toast(msg);renderRoster();renderMyHud();
}
export async function ruptureRoll(col,c){
  if(!canRollFor(col,c)){toast('Só o dono do personagem e o mestre rolam por esta ficha.');return}
  if(ruptOf(c).dead||sanOf(c)>0)return;
  const doc=await doRoll({groups:[{n:1,s:20,neg:false}],flat:0},'Teste de ruptura',rollerIdentity(c,col),{noAdv:true});if(!doc)return;
  const v=num(doc.groups[0].r[0]);
  /* let the die land before the verdict shows */
  await new Promise(r=>setTimeout(r,900));
  applyRupt(col,c,v===20?'back':v===1?'f2':v>=10?'s':'f');
}
