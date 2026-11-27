/* Renderização geral e sincronização com o Firestore (assinaturas do mestre). */
import { setStatus } from './util.js';
import { S, data, ui } from './estado.js';
import { decObj, raw } from './cripto.js';
import { write } from './banco.js';
import { renderLive, renderPlayer, renderRoster, renderSheet } from './jogador.js';
import { curNpc, renderDesk } from './mestre.js';
import { chatChrome, watchThreads } from './chat.js';
import { obsMode, ov, setOv } from './overlays.js';
import { renderDice } from './dados.js';

/* ---------- live data ---------- */
export function render(){if(obsMode)return;renderLive();renderPlayer();renderDice();watchThreads();chatChrome();if(S.unlocked)renderRoster();renderSheet(false);if(S.unlocked)renderDesk(false)}
function listen(col,onDocs){return S.db.collection(col).orderBy('order').onSnapshot(s=>{data[col]=s.docs.map(d=>({id:d.id,...structuredClone(d.data())}));onDocs&&onDocs(s)},err=>{if(err.code==='revoked')setStatus('warn','Acesso encerrado')})}
async function decryptCol(col){const out=[];for(const r of raw[col]){const d=await decObj(r.d);if(d)out.push({...d,id:r.id,order:r.d.order??d.order})}data[col]=out}
export async function decryptAll(){if(!S.mkey)return;await Promise.all(['mnpcs','mrefs','marchive'].map(decryptCol));if(raw.mnotes){const n=await decObj(raw.mnotes);if(n)S.notesDoc=n}if(!curNpc())ui.npcSel=(data.mnpcs[0]||{}).id||null}
let npcsLoaded=false;
/* drop scene entries whose NPC no longer exists (e.g. deleted before this fix) */
export function pruneScene(){if(!S.unlocked||!npcsLoaded||!S.liveLoaded)return;const ids=new Set(raw.mnpcs.map(r=>r.id)),list=ov().npcs||[];if(S.live.reveal&&ids.has(S.live.reveal.id))write('session','live',{reveal:null});const keep=n=>n.kind==='char'||ids.has(n.id);if(list.some(n=>!keep(n)))setOv({npcs:list.filter(keep)})}
export function startMaster(){
  if(S.masterSubs||!S.db)return;S.masterSubs=true;
  for(const col of ['mnpcs','mrefs','marchive'])S.db.collection(col).orderBy('order').onSnapshot(async s=>{raw[col]=s.docs.map(d=>({id:d.id,d:d.data()}));if(col==='mnpcs'&&!s.metadata.fromCache){npcsLoaded=true;pruneScene()}if(!S.mkey)return;await decryptCol(col);if(col==='mnpcs'&&!curNpc())ui.npcSel=(data.mnpcs[0]||{}).id||null;renderDesk(false)},()=>{});
  S.db.doc('mnotes/main').onSnapshot(async s=>{raw.mnotes=s.exists?s.data():null;if(!S.mkey||!raw.mnotes)return;const n=await decObj(raw.mnotes);if(n){S.notesDoc=n;renderDesk(false)}},()=>{});
}
