/* Senha do mestre, desbloqueio e troca entre Grupo e Área do Mestre. */
import { $, esc, store, toast } from './util.js';
import { S, data, summaryOf, ui } from './estado.js';
import { MASTER, decObj, deriveKey } from './cripto.js';
import { fbAssets } from './imagens.js';
import { curChar } from './ficha.js';
import { renderPlayer, subscribeMine } from './jogador.js';
import { renderDesk } from './mestre.js';
import { closeChat } from './chat.js';
import { pruneRolls, renderDice } from './dados.js';
import { decryptAll, render, startMaster } from './app.js';

/* ---------- password gate ---------- */
export async function tryPassword(pw){
  if(!S.db)return false;let meta;try{const s=await S.db.doc('mcrypt/meta').get();if(!s.exists)return false;meta=s.data()}catch(e){return false}
  const key=await deriveKey(pw,meta);const ok=await decObj(meta.check,key);if(!ok||ok.ok!=='triarborium')return false;S.mkey=key;return true;
}
$('gateForm').addEventListener('submit',async e=>{e.preventDefault();const v=$('pw').value;$('pw').value='';$('pwErr').textContent='Verificando…';
  if(await tryPassword(v)){store.set('tri-mestre',v,sessionStorage);unlock(v)}else{$('pwErr').textContent=S.db?'Senha incorreta.':'Ainda conectando, tente de novo em instantes.'}});
async function sha256hex(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
/* the database only treats this device as master after it proves the password: masters/<uid> must carry the same key as the hidden secret/master doc */
async function registerMaster(pw){
  if(!S.me)return false;const key=await sha256hex('triarborium-master:'+pw),ref=S.db.collection('masters').doc(S.me.uid),body={key,at:new Date().toISOString()};
  try{if((await ref.get()).exists)return true}catch(e){}
  try{await ref.set(body);return true}catch(e){}
  try{await S.db.collection('secret').doc('master').set({key});await ref.set(body);return true}catch(e){return false}
}
function startMasterChars(){
  if(S.masterCharsSub)return;subscribeMine(null);
  S.masterCharsSub=S.db.collection('chars').orderBy('order').onSnapshot(snap=>{data.chars=snap.docs.map(d=>({id:d.id,...structuredClone(d.data())}));ensurePublic();if(!curChar())ui.sel=(data.chars[0]||{}).id||null;render()},()=>toast('Não foi possível carregar as fichas.'));
}
const pubMade=new Set();
export async function ensurePublic(){if(!S.unlocked||!S.pubLoaded)return;for(const c of data.chars){if(S.pub.some(p=>p.id===c.id)||pubMade.has(c.id))continue;pubMade.add(c.id);try{await S.db.collection('public').doc(c.id).set({...summaryOf(c),owner:null,ownerName:null})}catch(e){pubMade.delete(c.id)}}}
export function ownerBox(c){if(!c)return'';const p=S.pub.find(x=>x.id===c.id);return `<div class="panel playerbar"><span class="hint">${p&&p.owner?`Jogador: <b>${esc(p.ownerName||'?')}</b>`:'Ninguém escolheu este personagem ainda.'}</span>${p&&p.owner?`<button class="btn sm" data-master-release="${esc(c.id)}">Liberar personagem</button>`:''}</div>`}
export async function unlock(pw){
  if(!(await registerMaster(pw))){S.mkey=null;store.set('tri-mestre',null,sessionStorage);$('pwErr').textContent='O banco não confirmou a senha. Recarregue e tente de novo.';return}
  S.unlocked=true;S.assets=fbAssets;$('gate').hidden=true;$('desk').hidden=false;$('pwErr').textContent='';$('importBox').hidden=false;startMasterChars();startMaster();pruneRolls();await decryptAll();render();renderDesk(true)}
$('lockBtn').addEventListener('click',()=>{if(S.masterCharsSub){S.masterCharsSub();S.masterCharsSub=null}S.assets=null;closeChat();data.chars=[];S.mySubId=null;S.unlocked=false;S.mkey=null;store.set('tri-mestre',null,sessionStorage);for(const c of MASTER)if(c!=='mnotes')data[c]=[];S.notesDoc={notes:'',campaigns:[],activeCampaign:''};$('importBox').hidden=true;$('desk').hidden=true;$('gate').hidden=false;$('mbody').innerHTML='';setView('group');render()});
export function setView(v){ui.view=v;$('groupView').hidden=v!=='group';$('masterView').hidden=v!=='master';document.querySelectorAll('#views button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));if(v==='master'&&!S.unlocked)setTimeout(()=>$('pw').focus(),0);renderPlayer();renderDice()}
$('views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view)});
