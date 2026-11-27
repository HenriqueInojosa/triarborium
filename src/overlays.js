/* Overlays do OBS (#overlay, #overlay-npcs, #overlay-cena, #overlay-dados, #overlay-referencias, ...). */
import { claude } from './firebase.js';
import { $, clamp, esc } from './util.js';
import { S, data } from './estado.js';
import { blob, face, pic } from './imagens.js';
import { find, write } from './banco.js';
import { combatBar, combatOn } from './jogador.js';
import { animateDice, freshIds, num, seatHTML, seatList } from './dados.js';

/* ---------- OBS overlays ---------- */
const OBS_MODES={'overlay':'players','overlay-npcs':'npcs','overlay-cena':'npcs','overlay-dados':'dice','overlay-referencias':'refs'};
const hashName=decodeURIComponent(location.hash.slice(1));
export const obsMode=OBS_MODES[hashName.replace(/-verde$/,'')]||null;
const ART={npcFrame:'assets/3bfed3aab84eccbc45db664cc3f5e66e.png',disc:'assets/1a7d6721e8b86f4a833db297514f5d59.png',refFrame:'assets/d0e40c11b9b8507352b78e6a3e6e883a.png'};
export const ARTIFACT_URL=location.origin+location.pathname;
const LAYOUT={players:{x:0,y:63,scale:150},npcs:{x:70,y:4,scale:100},references:{x:12,y:12,scale:250},dice:{x:2,y:96,scale:160}};
export const ov=()=>Object.assign({visible:true,all:false,follow:true,selected:null,npcs:[]},S.live.overlay||{});
export function setOv(patch){write('session','live',{overlay:{...ov(),...patch}})}
const sanLevel=n=>{const v=clamp(n,0,100);return v===0?'empty':v<=20?'critical':v<=50?'shaken':'stable'};
function iniInfo(id){const ini=S.live.initiative||{};if(!combatOn(ini))return null;const ents=ini.entries||[],i=ents.findIndex(e=>e.ref===id);if(i<0)return null;return{pos:i+1,val:ini.showNumbers?(Number(ents[i].init)||0):null,now:i===Math.min(ini.turn||0,ents.length-1)}}
function iniPos(id){const ini=S.live.initiative||{};if(!ini.showNumbers||!combatOn(ini))return null;const i=(ini.entries||[]).findIndex(e=>e.ref===id);return i>=0?i+1:null}
/* player HUD ("faixa rúnica"): round portrait ringed by a sanity arc + gilded pill with name, class and effects.
   Native size HUD_W x HUD_H; HUD_K keeps the saved overlay scale looking like the old painted frame (2172px wide). */
export const HUD_W=1080,HUD_H=288,HUD_K=2172/HUD_W;
export function hudHTML(c){
  const v=clamp(c.sanity??100,0,100),pos=iniPos(c.id);
  const fx=(c.effects||[]).filter(e=>blob(e.image)).slice(0,4).map(e=>`<span class="hud-effect ${e.type==='debuff'?'bad':'good'}"><img src="${blob(e.image)}" alt="${esc(e.label)}"></span>`).join('');
  return `<div class="hud-rune san-${sanLevel(v)}" data-id="${esc(c.id)}">
    <div class="hud-pill"><div class="hud-label"><strong>${esc(c.name)}</strong><span>${esc(c.cls||'Aventureiro')}</span></div><div class="hud-fx">${fx}</div></div>
    <div class="hud-ring"><svg viewBox="0 0 288 288" fill="none" aria-hidden="true"><circle class="hud-ring-bed" cx="144" cy="144" r="125"/><circle class="hud-ring-line" cx="144" cy="144" r="125"/><circle class="hud-san-arc" cx="144" cy="144" r="125" pathLength="100" transform="rotate(-90 144 144)" style="stroke-dasharray:${v} 100"/><circle class="hud-ring-gold" cx="144" cy="144" r="139"/></svg>
      <div class="hud-photo">${blob(c.portrait)?`<img src="${face(c)}" alt="">`:''}</div>
      <div class="hud-san-value">${v}<small> / 100</small></div></div>${pos?`<div class="hud-order">${pos}</div>`:''}</div>`;
}
function npcArtHTML(n,info){if(typeof info==='number')info={val:info};return `<div class="npc-art${info&&info.now?' now':''}" data-id="${esc(n.id)}"><div class="face">${blob(n.portrait)?`<img src="${face(n)}" alt="">`:''}</div><img class="frame" src="${ART.npcFrame}" alt=""><div class="name">${esc(n.name)}</div>${info&&info.val!=null?`<div class="ini-medal"><img src="${ART.disc}" alt=""><small>INI</small><b>${info.val}</b></div>`:''}${info&&info.now?'<div class="turn-tag">Turno</div>':''}</div>`}
function obsFit(){const k=Math.min(innerWidth/1920,innerHeight/1080);$('stage').style.transform=`translate(${Math.max(0,(innerWidth-1920*k)/2)}px,${Math.max(0,(innerHeight-1080*k)/2)}px) scale(${k})`}
export function renderObs(){
  const o=ov(),L=Object.assign({},LAYOUT,o.layout||{});
  if(obsMode==='players'){
    const root=$('obsPlayers');const actors=o.visible===false?[]:o.all?data.chars:data.chars.filter(c=>c.id===o.selected);
    const key=actors.map(c=>c.id+':'+face(c)).join('|');const html=actors.map(hudHTML).join('');
    if(key!==S.obsLast){root.innerHTML=html;S.obsLast=key}else{
      // same people on screen: update in place so the entrance animation does not replay
      const tmp=document.createElement('div');tmp.innerHTML=html;[...root.children].forEach((el,i)=>{const n=tmp.children[i];if(!n)return;el.className=n.className;
        el.querySelector('.hud-san-arc').style.cssText=n.querySelector('.hud-san-arc').style.cssText;
        for(const sel of ['.hud-san-value','.hud-label strong','.hud-label span','.hud-fx'])if(el.querySelector(sel).innerHTML!==n.querySelector(sel).innerHTML)el.querySelector(sel).innerHTML=n.querySelector(sel).innerHTML;
        const p=el.querySelector('.hud-photo'),np=n.querySelector('.hud-photo');if(p.innerHTML!==np.innerHTML)p.innerHTML=np.innerHTML;
        const om=el.querySelector('.hud-order'),nm=n.querySelector('.hud-order');if(nm&&om)om.textContent=nm.textContent;else if(nm)el.appendChild(nm);else if(om)om.remove()})}
    const l=L.players,sz=Math.max(.2,Math.min(2.5,(l.scale??100)/100)),count=actors.length||1,used=count*HUD_H+(count-1)*12,k=Math.min(sz*HUD_K,1920/HUD_W,1080/used);
    root.style.left=Math.max(0,Math.min(l.x/100*1920,1920-HUD_W*k))+'px';root.style.top=Math.max(0,Math.min(l.y/100*1080,1080-used*k-24))+'px';root.style.transform=`scale(${k})`;
  }
  if(obsMode==='npcs'){
    const root=$('obsNpcs'),ini=S.live.initiative||{},fight=combatOn(ini);
    const list=o.visible===false?[]:(o.npcs||[]);
    const key=fight?'C'+JSON.stringify([ini,(ini.entries||[]).map(e=>face(e))]):JSON.stringify(list.map(n=>[n.id,n.name,face(n)]));
    if(key!==S.obsLast){root.classList.toggle('fight',fight);root.innerHTML=fight?combatBar(ini,ini.entries):list.map(n=>npcArtHTML(n,null)).join('');S.obsLast=key}
    const l=L.npcs,sz=Math.max(.2,Math.min(2.5,(l.scale??100)/100));let w,h;
    if(fight){w=Math.max(300,root.offsetWidth||1500);h=Math.max(120,root.offsetHeight||200)}else{const cnt=Math.max(1,list.length);h=470;w=cnt*420+(cnt-1)*18}
    const k=fight?Math.min(sz*2,1880/w,1080/h):Math.min(sz,1920/w,1080/h);
    root.style.left=Math.max(0,Math.min(l.x/100*1920,1920-w*k))+'px';root.style.top=Math.max(0,Math.min(l.y/100*1080,1080-h*k))+'px';root.style.transform=`scale(${k})`;
  }
  if(obsMode==='dice'){const l=L.dice,sz=Math.max(.2,Math.min(3,(l.scale??100)/100)),root=$('obsDice'),k=sz;root.style.left=(l.x/100*1920)+'px';root.style.top='auto';root.style.bottom=(1080-l.y/100*1080)+'px';root.style.transform=`scale(${k})`}
  if(obsMode==='refs'){
    const root=$('obsRef'),r=S.live.reveal;const key=r?JSON.stringify([r.id,r.name,r.image]):'';
    if(key!==S.obsLast){S.obsLast=key;root.innerHTML=r?`<div class="reference-art"><div class="window">${blob(r.image)?`<img src="${blob(r.image)}" alt="">`:''}</div><img class="frame" src="${ART.refFrame}" alt=""><div class="caption">${esc(r.name||'')}</div></div>`:''}
    const el=root.firstElementChild;if(el){const l=L.references,sz=Math.max(.2,Math.min(2.5,(l.scale??100)/100)),k=Math.min(sz,1920/1448,1080/1075);el.style.left=Math.max(0,Math.min(l.x/100*1920,1920-1448*k))+'px';el.style.top=Math.max(0,Math.min(l.y/100*1080,1080-1075*k))+'px';el.style.transform=`scale(${k})`}
  }
}
/* dice overlay: each public roll pops in, stays a while and fades (hidden master rolls never reach the database) */
function obsDicePop(r){const f=$('obsDice');if(!f)return;freshIds.add(r.id);
  const seat=seatList().find(x=>x.id===r.charId)||{id:String(r.charId||''),name:r.who||'?'};
  const el=document.createElement('div');el.className='dice-pop';el.innerHTML=seatHTML(seat,r,false);f.append(el);while(f.children.length>3)f.firstElementChild.remove();animateDice(el);
  setTimeout(()=>freshIds.delete(r.id),3000);setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)},15000)}
export async function bootObs(){
  document.documentElement.classList.add('obs');if(/-verde$/.test(hashName))document.documentElement.classList.add('green');
  $('obs').hidden=false;addEventListener('resize',obsFit);obsFit();
  const msg=t=>{$('obsMsg').textContent=t;$('obsMsg').hidden=!t};
  S.db=await claude.use('db');
  if(!S.db){msg('Overlay Triarborium: sem conexão com o banco. Confira o firebase-config.js e recarregue.');return}
  msg('');
  if(obsMode==='dice'){S.db.collection('public').orderBy('order').onSnapshot(s=>{S.pub=s.docs.map(d=>({id:d.id,...d.data()}))},()=>{});
    let seen=null;S.db.collection('rolls').orderBy('at','desc').limit(6).onSnapshot(s=>{const list=s.docs.map(d=>({id:d.id,...d.data()}));if(seen)list.filter(r=>!seen.has(r.id)&&num(r.at)>Date.now()-30000).reverse().forEach(obsDicePop);seen=new Set(list.map(r=>r.id))},()=>msg('Overlay: conexão perdida, recarregue.'))}
  if(obsMode==='npcs')S.db.collection('public').orderBy('order').onSnapshot(s=>{S.pub=s.docs.map(d=>({id:d.id,...d.data()}));renderObs()},()=>{});
  if(obsMode==='players')S.db.collection('public').orderBy('order').onSnapshot(s=>{data.chars=s.docs.map(d=>({id:d.id,...structuredClone(d.data())}));renderObs()},()=>msg('Overlay: conexão perdida, recarregue.'));
  S.db.doc('session/live').onSnapshot(s=>{if(s.exists)S.live=structuredClone(s.data());renderObs()},()=>msg('Overlay: conexão perdida, recarregue.'));
}
export function obsTabHTML(){
  const o=ov(),sel=find('chars',o.selected),r=S.live.reveal;
  const link=(h,label,desc)=>`<div class="field"><b style="color:var(--ink)">${label}</b><span>${desc}</span><div class="linkrow"><code>${ARTIFACT_URL}#${h}</code><button class="btn sm" data-copy="${ARTIFACT_URL}#${h}">Copiar</button></div></div>`;
  return `<div style="display:flex;flex-direction:column;gap:16px">
    ${S.canWrite?'':'<div class="notice">Você está só como Visualizador: dá para ver, mas os botões abaixo não salvam. Peça ao dono acesso de Colaborador ou Editor.</div>'}
    <div class="grid2">
      <section class="panel sheet"><h2>Jogadores no overlay</h2>
        <label class="row lbl"><input type="checkbox" id="ovVis" ${o.visible!==false?'checked':''}> Overlay visível</label>
        <label class="row lbl"><input type="checkbox" id="ovFollow" ${o.follow!==false?'checked':''}> Seguir a ficha que eu abrir na aba Grupo</label>
        <label class="row lbl"><input type="checkbox" id="ovAll" ${o.all?'checked':''}> Mostrar todos os jogadores de uma vez</label>
        <label class="field">Jogador em destaque<select id="ovSel"><option value="">Nenhum</option>${data.chars.map(c=>`<option value="${esc(c.id)}"${c.id===o.selected?' selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
        <div class="obs-preview" id="obsPreview">${sel&&!o.all?hudHTML(sel):''}</div>
        <p class="hint">${o.all?'Mostrando todos os jogadores.':sel?'Prévia do que o OBS mostra agora.':'Nenhum jogador no overlay.'}</p></section>
      <section class="panel sheet"><h2>NPCs em cena</h2>
        ${(o.npcs||[]).map(n=>`<div class="task"><span class="row" style="flex:1">${pic(n)}<b>${esc(n.name)}</b></span><button class="btn sm" data-ovnpcdel="${esc(n.id)}" aria-label="Tirar de cena">×</button></div>`).join('')||'<p class="hint">Nenhum NPC no overlay.</p>'}
        <select id="ovNpcAdd" aria-label="Colocar NPC em cena"><option value="">Colocar NPC em cena…</option>${data.mnpcs.filter(n=>!(o.npcs||[]).some(x=>x.id===n.id)).map(n=>`<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('')}</select>
        <h2 style="margin-top:8px">Referência</h2>
        ${r?`<div class="row">${blob(r.image)?`<img src="${blob(r.image)}" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:4px">`:''}<b>${esc(r.name)}</b><button class="btn sm" data-ref-hide>Ocultar</button></div>`:'<p class="hint">Nenhuma referência no ar.</p>'}<button class="btn" data-go="refs">Escolher referência</button></section>
    </div>
    <section class="panel sheet"><h2>Links para o OBS</h2>
      <p class="hint">No OBS: Fontes → + → Navegador → cole o link, largura 1920, altura 1080. Não precisa de login.</p>
      ${link('overlay','Jogadores','Moldura com retrato, nome, efeitos e sanidade do jogador em destaque.')}
      ${link('overlay-cena','Em cena','Personagens e NPCs em cena, em linha. Durante o combate vira a barra de iniciativa.')}
      ${link('overlay-referencias','Referências','A referência que estiver sendo mostrada.')}
      ${link('overlay-dados','Dados','As rolagens da mesa aparecendo conforme são feitas (rolagens ocultas do mestre nunca aparecem).')}
      <p class="hint">Também existe a versão com fundo verde (link terminado em <b>-verde</b>, ex.: #overlay-verde) para usar com “Captura de janela” e filtro “Chroma key”.</p></section>
  </div>`;
}
