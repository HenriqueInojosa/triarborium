/* Leitura e escrita no Firestore (fila de gravação, criar, apagar) e repintura segura. */
import { $, toast } from './util.js';
import { S, SUMMARY, data } from './estado.js';
import { MASTER, encObj } from './cripto.js';
import { ov, setOv } from './overlays.js';

export const find=(col,id)=>data[col].find(x=>x.id===id);
/* ---------- writes: one at a time per document, patches merge while queued ---------- */
const queues={};
export function write(col,id,patch){
  const key=col+'/'+id,q=queues[key]||(queues[key]={busy:false,next:null});
  q.next=Object.assign(q.next||{},patch);
  if(col==='session')Object.assign(S.live,patch);else if(col==='mnotes')Object.assign(S.notesDoc,patch);else{const c=find(col,id);if(c)Object.assign(c,patch)}
  if(q.busy)return;
  (async()=>{q.busy=true;
    while(q.next){const p=q.next;q.next=null;if(col==='chars'||col==='marchive')p.updatedAt=new Date().toISOString();
      try{if(MASTER.has(col)){if(!S.mkey)throw{code:'locked'};const full=col==='mnotes'?S.notesDoc:find(col,id);if(!full)continue;await S.db.collection(col).doc(id).set({...(await encObj(full)),order:full.order||0})}
        else{await S.db.collection(col).doc(id).update(p);
          if(col==='chars'){const allowed=S.unlocked?SUMMARY:[];const sp={};for(const k of allowed)if(k in p)sp[k]=p[k];
            if(Object.keys(sp).length){const pp=S.pub.find(x=>x.id===id);if(pp)Object.assign(pp,sp);await S.db.collection('public').doc(id).update(sp)}}}}
      catch(e){if(e&&e.code==='invalid_argument')toast('Sem permissão para salvar isso.');else toast('Não foi possível salvar agora. Tente de novo.')}}
    q.busy=false})();
}
export const timers={};
export function writeLater(col,id,patch,key){clearTimeout(timers[key]);if(col==='mnotes')Object.assign(S.notesDoc,patch);else{const c=find(col,id);if(c)Object.assign(c,patch)}timers[key]=setTimeout(()=>write(col,id,patch),600)}
export async function create(col,id,doc){try{if(MASTER.has(col)){data[col].push({id,...doc});doc={...(await encObj(doc)),order:doc.order||0}}await S.db.collection(col).doc(id).set(doc);return true}catch(e){toast('Não foi possível criar ('+(e.code||'erro')+').');return false}}
export async function remove(col,id){try{await S.db.collection(col).doc(id).delete();if(col==='chars')await S.db.collection('public').doc(id).delete();if(col==='mnpcs'&&S.live.reveal&&S.live.reveal.id===id)write('session','live',{reveal:null});if((col==='mnpcs'||col==='chars')&&(ov().npcs||[]).some(n=>n.id===id))setOv({npcs:(ov().npcs||[]).filter(n=>n.id!==id)})}catch(e){toast('Não foi possível remover.')}}
/* ---------- region rendering that never clobbers a field being typed in ---------- */
const pending={};
export function paint(el,html){const a=document.activeElement;if(a&&el.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='file'){pending[el.id]=html;return}delete pending[el.id];el.innerHTML=html}
document.addEventListener('focusout',e=>setTimeout(()=>{for(const id in pending){const el=$(id);if(el&&!el.contains(document.activeElement)){el.innerHTML=pending[id];delete pending[id]}}},0));
