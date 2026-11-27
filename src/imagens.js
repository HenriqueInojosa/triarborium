/* Retratos e imagens: arquivos em assets/ e imagens enviadas guardadas no Firestore (fb:...). */
import { ASSET_EXT, SAN_VAR } from './assets.js';
import { b64, esc, uid, unb64 } from './util.js';
import { S } from './estado.js';
import { renderChatList } from './chat.js';
import { obsMode, renderObs } from './overlays.js';
import { render } from './app.js';

export const blob=id=>!id?'':String(id).startsWith('fb:')?fbUrl(String(id)):ASSET_EXT[id]?'assets/'+id+'.'+ASSET_EXT[id]:'';
/* sanity stages: below 50 and below 20 the animated portraits swap to "shaken" (-s1) and "unhinged" (-s2) versions */
export const sanOf=c=>{let v=c?c.sanity:null;if(v==null&&c&&typeof S.pub!=='undefined'){const p=S.pub.find(x=>x.id===c.id||x.id===c.ref);if(p)v=p.sanity}const n=Number(v);return v==null||isNaN(n)?100:n};
export const face=c=>{const id=c&&c.portrait,base=blob(id);if(!base||!SAN_VAR.has(id))return base;const v=sanOf(c);return v<20?'assets/'+id+'-s2.gif':v<50?'assets/'+id+'-s1.gif':base};
export const pic=(c,cls='')=>blob(c.portrait)?`<img class="${cls}" src="${face(c)}" alt="">`:`<span class="ph ${cls}">${esc((c.name||'?').trim().charAt(0).toUpperCase())}</span>`;
/* ---------- files kept in Firestore (free plan has no Storage): blobs/<id> with base64, split into parts when large ---------- */
export const FB_CHUNK=700*1024,FB_MAX=6*1024*1024;
const fbCache={},fbMeta={};
let fbTick=null;
export function fbUrl(id){if(fbCache[id])return fbCache[id];if(!(id in fbCache)&&S.db){fbCache[id]='';loadFb(id)}return ''}
async function loadFb(id){
  try{const raw=id.slice(3);const s=await S.db.collection('blobs').doc(raw).get();if(!s.exists)return;const m=s.data();const parts=[];
    if(m.d)parts.push(m.d);else for(let i=0;i<(m.n||0);i++){const p=await S.db.collection('blobs/'+raw+'/parts').doc(String(i)).get();if(p.exists)parts.push(p.data().d)}
    fbMeta[id]=m;fbCache[id]=URL.createObjectURL(new Blob(parts.map(unb64),{type:m.mime||'application/octet-stream'}));
    clearTimeout(fbTick);fbTick=setTimeout(()=>{if(obsMode){S.obsLast='';renderObs()}else{render();renderChatList()}},80);
  }catch(e){delete fbCache[id]}
}
async function shrinkImage(file,max){
  const bmp=await createImageBitmap(file);const k=Math.min(1,max/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return await new Promise(r=>c.toBlob(b=>r(b),'image/webp',.84))||file;
}
export async function putBlob(file,opt={}){
  let b=file,mime=opt.type||file.type||'application/octet-stream';const name=String(file.name||opt.name||'arquivo').slice(0,120);
  if(/^image\/(png|jpe?g|webp|bmp|gif)$/.test(mime)&&!(mime==='image/gif'&&file.size<=FB_CHUNK)){try{b=await shrinkImage(file,opt.max||1280);mime=b.type||mime}catch(e){}}
  if(b.size>FB_MAX)throw Error('Arquivo grande demais (máximo 6 MB).');
  const buf=new Uint8Array(await b.arrayBuffer()),n=Math.max(1,Math.ceil(buf.length/FB_CHUNK)),id=uid();
  const meta={mime,name,size:buf.length,n,uid:S.me?S.me.uid:'',at:Date.now()};
  if(n===1)meta.d=b64(buf);else for(let i=0;i<n;i++)await S.db.collection('blobs/'+id+'/parts').doc(String(i)).set({d:b64(buf.subarray(i*FB_CHUNK,(i+1)*FB_CHUNK))});
  await S.db.collection('blobs').doc(id).set(meta);
  const fid='fb:'+id;fbMeta[fid]=meta;fbCache[fid]=URL.createObjectURL(new Blob([buf],{type:mime}));
  return{id:fid,url:fbCache[fid],name,mime,size:buf.length};
}
export const fbAssets={upload:async(f,o)=>putBlob(f,{type:o&&o.type,max:900})};
