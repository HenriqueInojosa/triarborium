/* Importação de fichas (.html / .json). */
import { $, STATS, clamp, toast, uid } from './util.js';
import { S, summaryOf, ui } from './estado.js';
import { find, write } from './banco.js';
import { render } from './app.js';

/* ---------- import (mestre) ---------- */
function sniffImage(b){if(b[0]===0x47&&b[1]===0x49)return'image/gif';if(b[0]===0x89&&b[1]===0x50)return'image/png';if(b[0]===0xFF&&b[1]===0xD8)return'image/jpeg';if(b[8]===0x57&&b[9]===0x45)return'image/webp';return null}
async function uploadDataUri(uri){if(!S.assets||!uri)return'';const m=/^data:[^;]*;base64,(.*)$/s.exec(uri);if(!m)return'';const bin=atob(m[1]);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);const type=sniffImage(bytes);if(!type)return'';return (await S.assets.upload(new Blob([bytes],{type}),{type})).id}
const okId=s=>/^[A-Za-z0-9]{1,64}$/.test(s);
const cleanSkill=s=>{const max=clamp(s.maxUses,1,99);return{id:okId(s.id)?s.id:uid(),name:String(s.name||'Habilidade').slice(0,160),description:String(s.description||'').slice(0,4000),dice:String(s.dice||'').slice(0,60),stat:STATS.some(x=>x[0]===s.stat)?s.stat:'',maxUses:max,usesLeft:clamp(s.usesLeft??max,0,max),playerNote:String(s.playerNote||'').slice(0,4000)}};
const cleanItem=i=>({id:okId(i.id)?i.id:uid(),name:String(i.name||'Item').slice(0,160),qty:clamp(i.qty,0,99999),used:!!i.used,notes:String(i.notes||'').slice(0,4000)});
function sheetFields(b){const o={};for(const[k]of STATS)o[k]=clamp(b[k]??10,1,30);o.ac=clamp(b.ac,0,40);o.hpMax=clamp(b.hpMax,0,999);o.hp=clamp(b.hp,0,o.hpMax);o.inspiration=clamp(b.inspiration,0,99);o.sanity=clamp(b.sanity??100,0,100);
  o.skills=(Array.isArray(b.skills)?b.skills:[]).slice(0,100).map(cleanSkill);o.items=(Array.isArray(b.items)?b.items:[]).slice(0,300).map(cleanItem);o.playerNotes=String(b.playerNotes||'').slice(0,60000);o.playerHistory=String(b.playerHistory||'').slice(0,60000);return o}
async function importFile(f){
  const text=await f.text();
  const m=/<script type="application\/json" id="bootstrap">([\s\S]*?)<\/script>/.exec(text);
  if(m){const boot=JSON.parse(m[1]);if(boot.format!=='triarborium-player-sheet'||!boot.character)throw Error('não é uma ficha Triarborium');
    const id=String(boot.character.id).replace(/[^A-Za-z0-9]/g,'').slice(0,64)||uid();const ex=find('chars',id);
    let portrait=ex?.portrait||'';if(!portrait)portrait=await uploadDataUri(boot.portrait).catch(()=>'');
    const doc={name:String(boot.character.name||'Sem nome').slice(0,80),cls:String(boot.character.class||'').slice(0,80),portrait,...sheetFields({...boot.baseline,sanity:boot.baseline.sanity??boot.character.sanity}),effects:ex?.effects||[],order:ex?.order??Date.now(),updatedAt:new Date().toISOString()};
    await S.db.collection('chars').doc(id).set(doc);const op=S.pub.find(p=>p.id===id);await S.db.collection('public').doc(id).set({...summaryOf(doc),owner:op?.owner??null,ownerName:op?.ownerName??null});ui.sel=id;return (ex?'Atualizado: ':'Adicionado: ')+doc.name}
  const d=JSON.parse(text);
  if(d.format==='triarborium-player-sheet'&&d.current&&d.characterId){
    const id=String(d.characterId).replace(/[^A-Za-z0-9]/g,'').slice(0,64);const c=find('chars',id);
    if(!c)throw Error('envie primeiro o HTML da ficha de '+(d.characterName||'este personagem'));
    const p=sheetFields(d.current);const keep={};for(const k of ['hp','inspiration','sanity','items','playerNotes','playerHistory'])keep[k]=p[k];
    keep.hp=Math.min(keep.hp,Number(c.hpMax)||0);
    keep.skills=(c.skills||[]).map(s=>{const n=p.skills.find(x=>x.id===s.id);return n?{...s,usesLeft:Math.min(n.usesLeft,clamp(s.maxUses,1,99)),playerNote:n.playerNote}:s});
    write('chars',id,keep);ui.sel=id;return 'Progresso importado: '+c.name}
  throw Error('formato não reconhecido');
}
$('importFile').addEventListener('change',async e=>{const files=[...e.target.files];e.target.value='';
  for(const f of files){try{if(f.size>16*1024*1024)throw Error('arquivo grande demais');toast(await importFile(f))}catch(err){toast(f.name+': '+(err.message||err.code||'não foi possível ler'))}}render()});
