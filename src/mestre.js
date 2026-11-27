/* Área do Mestre: abas, NPCs, cena, iniciativa e referências. */
import { $, clamp, esc, toast, uid } from './util.js';
import { S, SHOW_HP, data, ui } from './estado.js';
import { blob, pic } from './imagens.js';
import { create, find, paint, remove, timers, write, writeLater } from './banco.js';
import { sheetHTML, wireSheet } from './ficha.js';
import { combatOn, renderLive } from './jogador.js';
import { msgsTabHTML, openChat } from './chat.js';
import { ownerBox, setView } from './acesso.js';
import { ARTIFACT_URL, hudHTML, obsTabHTML, ov, setOv } from './overlays.js';
import { rnd, statMod } from './dados.js';
import { isDead } from './ruptura.js';

/* ---------- master desk ---------- */
export const curNpc=()=>find('mnpcs',ui.npcSel);
export function renderDesk(force){
  if(!S.unlocked)return;
  document.querySelectorAll('#mtabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.mtab===ui.mtab));
  const el=$('mbody');let h='';
  if(ui.mtab==='over'){
    const ini=S.live.initiative||{entries:[],round:1},tasks=S.notesDoc.checklists||[],open=tasks.filter(t=>!t.done);
    const recent=data.marchive.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,4);
    const camp=(S.notesDoc.campaigns||[]).find(c=>c.id===S.notesDoc.activeCampaign);
    const r=S.live.reveal;
    h=`<div style="display:flex;flex-direction:column;gap:16px">
      <div class="panel sheet" style="gap:6px"><h2>Visão Geral</h2><p class="hint">${camp?`Campanha ativa: <b>${esc((camp.number?camp.number+' · ':'')+camp.name)}</b>`:'Personagens, combate e preparação em um só lugar.'}</p></div>
      <div class="ov">
        <section class="panel sheet ovc"><h2>Jogadores</h2><span class="big">${data.chars.length}</span><p class="hint">Fichas de personagens no grupo.</p><button class="btn" data-go="group">Ver fichas</button></section>
        <section class="panel sheet ovc"><h2>Combate</h2><span class="big">${(ini.entries||[]).length}</span><p class="hint">${(ini.entries||[]).length?`Na iniciativa · rodada ${Number(ini.round)||1}.`:'Nenhum combate em andamento.'}</p><button class="btn" data-go="init">Abrir iniciativa</button></section>
        <section class="panel sheet ovc"><h2>Mostrando aos jogadores</h2>${r?`<div class="row">${blob(r.image)?`<img src="${blob(r.image)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:6px">`:''}<b>${esc(r.name)}</b></div><button class="btn" data-ref-hide>Ocultar</button>`:`<p class="hint">Nada sendo mostrado agora.</p><button class="btn" data-go="refs">Abrir referências</button>`}</section>
      </div>
      <div class="grid2">
        <section class="panel sheet"><div class="row" style="justify-content:space-between"><h2>Tarefas da sessão</h2><span class="hint">${open.length} pendente${open.length===1?'':'s'}</span></div>
          <form class="row" data-taskform><input name="label" maxlength="300" placeholder="Nova tarefa…" aria-label="Nova tarefa" style="flex:1"><button class="btn" type="submit">+ Adicionar</button></form>
          ${tasks.length?tasks.map(t=>`<div class="task${t.done?' done':''}"><label class="row" style="flex:1;min-width:0"><input type="checkbox" data-task="${esc(t.id)}" ${t.done?'checked':''}><span>${esc(t.label)}</span></label><button class="btn sm" data-taskdel="${esc(t.id)}" aria-label="Remover tarefa">×</button></div>`).join('')+(tasks.some(t=>t.done)?'<div><button class="btn sm" data-taskclear>Limpar concluídas</button></div>':''):'<p class="empty">Nenhuma tarefa. Anote o que preparar para a sessão.</p>'}</section>
        <section class="panel sheet"><h2>Arquivo recente</h2>${recent.map(a=>`<button class="pc" style="grid-template-columns:1fr" data-goarch="${esc(a.id)}"><span class="pc-name">${esc(a.title||'Sem título')}</span>${a.updatedAt?`<span class="pc-cls">editado ${new Date(a.updatedAt).toLocaleDateString('pt-BR')}</span>`:''}</button>`).join('')||'<p class="empty">Arquivo vazio.</p>'}<button class="btn" data-go="arch">Abrir arquivo</button></section>
      </div>
      <section class="panel sheet"><h2>Estado do grupo</h2><div class="ptable">${data.chars.map(c=>{const san=clamp(c.sanity??100,0,100),hpMax=Number(c.hpMax)||0;return `<div class="prow">${pic(c)}<b>${esc(c.name)}</b>${SHOW_HP?`<span class="hint">PV ${Number(c.hp)||0}/${hpMax}</span>`:''}<span class="${san<=25?'crit':san<=50?'warnv':'hint'}">San ${san}</span><span class="hint">${(c.effects||[]).map(e=>esc(e.label)).join(', ')}</span></div>`}).join('')}</div></section>
    </div>`;
  }
  if(ui.mtab==='players'){
    if(!find('chars',ui.mpSel))ui.mpSel=(find('chars',ov().selected)||data.chars[0]||{}).id||null;
    const c=find('chars',ui.mpSel),o=ov();
    const list=data.chars.map(x=>{const hpMax=Number(x.hpMax)||0,san=clamp(x.sanity??100,0,100);return `<button class="pc${x.id===ui.mpSel?' active':''}" data-mp="${esc(x.id)}">${pic(x)}<span style="min-width:0"><span class="pc-name">${esc(x.name)}${o.selected===x.id&&o.visible!==false?'<span class="mine">no ar</span>':''}</span><br><span class="pc-cls">${esc(x.cls||'Aventureiro')}${SHOW_HP?` · PV ${Number(x.hp)||0}/${hpMax}`:''} · San ${san}${isDead(x)?' · ☠ Morto':san===0?' · Em ruptura':''}</span><span class="bars"><span class="bar hp"${SHOW_HP?'':' hidden'}><i style="width:${hpMax?Math.round((Number(x.hp)||0)/hpMax*100):0}%"></i></span><span class="bar san"><i style="width:${san}%"></i></span></span></span></button>`}).join('')||'<p class="empty">Nenhuma ficha.</p>';
    const onAir=c&&o.selected===c.id&&o.visible!==false;
    const prev=c?`<section class="panel sheet" style="gap:10px"><div class="row" style="justify-content:space-between"><h2>Overlay</h2><div class="row">${onAir?'<span class="hint">📺 No ar no OBS</span>':`<button class="btn gold" data-act="mp-air">📺 Mostrar no overlay</button>`}<label class="row lbl"><input type="checkbox" id="ovFollow" ${o.follow!==false?'checked':''}> Seguir a ficha aberta</label></div></div><div class="obs-preview" id="obsPreview">${hudHTML(c)}</div></section>`:'';
    const sheet=c?sheetHTML(c,{col:'chars',m:S.canWrite,edit:S.canWrite,tab:ui.mpTab,notesKey:'playerNotes',histKey:'playerHistory',desk:true}):'<div class="empty">Escolha um jogador.</div>';
    h=`<div class="layout"><aside class="panel roster"><div class="roster-head"><h2>Jogadores</h2><span class="hint">${data.chars.length}</span></div><div class="list" id="mpList">${list}</div></aside>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">${S.canWrite?'':'<div class="notice"><b>Modo leitura.</b> Sua conta entrou como Visualizador: dá para ver, mas não salvar. O dono da página precisa te dar acesso de <b>Colaborador</b> ou <b>Editor</b> no menu Share.</div>'}${prev}${ownerBox(c)}<main class="panel sheet" id="mpSheet">${sheet}</main></div></div>`;
    if(!force&&$('mpSheet')){paint($('mpSheet'),sheet);$('mpList').innerHTML=list;const p=$('obsPreview');if(p&&c){const t=document.createElement('div');t.innerHTML=hudHTML(c);p.replaceChildren(t.firstElementChild)}scalePreview();return}
  }
  if(ui.mtab==='init'){
    const ini=S.live.initiative||{entries:[],round:1,turn:0},ents=ini.entries||[];
    const opts=[...data.chars.map(c=>[c,'char']),...data.mnpcs.map(c=>[c,'npc'])].filter(([c])=>!ents.some(e=>e.ref===c.id));
    h=`<div class="panel sheet"><div class="row" style="justify-content:space-between"><h2>Iniciativa · Rodada ${Number(ini.round)||1}</h2>
      <div class="row">${ents.length&&!combatOn(ini)?`<span class="hint">Montando o combate: os jogadores ainda não veem. Ao iniciar, cada um rola d20 + DES e a ordem é montada sozinha.</span><button class="btn gold" data-ini="start">⚔ Iniciar combate</button>`:`<button class="btn" data-ini="prev" ${ents.length?'':'disabled'}>← Turno anterior</button><button class="btn gold" data-ini="next" ${ents.length?'':'disabled'}>Próximo turno →</button>`}</div></div>
      <div class="row"><select id="iniAdd" aria-label="Adicionar à iniciativa"><option value="">Adicionar participante…</option>${opts.map(([c,k])=>`<option value="${k}:${esc(c.id)}">${k==='npc'?'NPC · ':''}${esc(c.name)}</option>`).join('')}</select>
      <button class="btn" data-ini="addall">+ Todos os jogadores</button><button class="btn" data-ini="sort" ${ents.length>1?'':'disabled'}>Ordenar por valor</button>
      <label class="row lbl"><input type="checkbox" id="iniNums" ${ini.showNumbers?'checked':''}> Mostrar valores aos jogadores</label>
      <span class="grow"></span><button class="btn danger" data-ini="clear" ${ents.length?'':'disabled'}>${ents.length&&!combatOn(ini)?'Cancelar combate':'Encerrar combate'}</button></div>
      ${ents.length?ents.map((en,i)=>`<div class="ient${i===(ini.turn||0)?' now':''}">${pic(en)}<span><b>${esc(en.name)}</b> <span class="hint">${en.kind==='npc'?'NPC':'Jogador'}</span></span><input class="num" type="number" min="-20" max="99" data-init="${esc(en.id)}" value="${Number(en.init)||0}" aria-label="Iniciativa de ${esc(en.name)}"><span class="row acts"><button class="btn sm" data-ini="up" data-id="${esc(en.id)}" ${i?'':'disabled'} aria-label="Subir">↑</button><button class="btn sm" data-ini="down" data-id="${esc(en.id)}" ${i<ents.length-1?'':'disabled'} aria-label="Descer">↓</button><button class="btn sm danger" data-ini="rm" data-id="${esc(en.id)}" aria-label="Remover">×</button></span></div>`).join(''):'<p class="empty">Nenhum combate iniciado. Adicione participantes para começar.</p>'}
      <p class="hint">Os jogadores veem a ordem e o turno atual no topo da aba Grupo.</p></div>`;
  }
  if(ui.mtab==='npcs'){
    const n=curNpc();
    h=`<div class="layout"><aside class="panel roster"><div class="roster-head"><h2>NPCs</h2><button class="btn sm" data-act="npc-add">+ Novo</button></div><div class="list">${data.mnpcs.map(c=>`<button class="pc${c.id===ui.npcSel?' active':''}" data-npc="${esc(c.id)}">${pic(c)}<span style="min-width:0"><span class="pc-name">${esc(c.name)}</span><br><span class="pc-cls">${esc(c.cls||'NPC')}${SHOW_HP?` · PV ${Number(c.hp)||0}/${Number(c.hpMax)||0}`:''}</span></span></button>`).join('')||'<p class="empty">Nenhum NPC.</p>'}</div></aside>
      <main class="panel sheet" id="npcSheet">${n?sheetHTML(n,{col:'mnpcs',m:true,edit:true,tab:ui.npcTab,notesKey:'notes',histKey:'history',npc:true}):'<div class="empty">Escolha um NPC.</div>'}</main></div>`;
    if(!force&&$('npcSheet')){paint($('npcSheet'),n?sheetHTML(n,{col:'mnpcs',m:true,edit:true,tab:ui.npcTab,notesKey:'notes',histKey:'history',npc:true}):'<div class="empty">Escolha um NPC.</div>');const l=el.querySelector('.roster .list');if(l)l.innerHTML=data.mnpcs.map(c=>`<button class="pc${c.id===ui.npcSel?' active':''}" data-npc="${esc(c.id)}">${pic(c)}<span style="min-width:0"><span class="pc-name">${esc(c.name)}</span><br><span class="pc-cls">${esc(c.cls||'NPC')}${SHOW_HP?` · PV ${Number(c.hp)||0}/${Number(c.hpMax)||0}`:''}</span></span></button>`).join('');return}
  }
  if(ui.mtab==='refs'){
    const on=S.live.reveal&&S.live.reveal.id;
    h=`<div class="panel sheet"><div class="row" style="justify-content:space-between"><h2>Referências</h2><div class="row">${on?'<button class="btn" data-ref-hide>Ocultar dos jogadores</button>':''}${S.assets?'<label class="btn gold">+ Nova referência<input type="file" accept="image/*" data-refnew hidden></label>':''}</div></div>
      <p class="hint">“Mostrar” exibe a imagem para os jogadores no topo da aba Grupo.</p>
      <div class="refs">${data.mrefs.map(r=>`<div class="ref${on===r.id?' on':''}">${blob(r.image)?`<img src="${blob(r.image)}" alt="${esc(r.name)}" loading="lazy">`:''}<input data-refk="name" data-id="${esc(r.id)}" value="${esc(r.name)}" aria-label="Nome" maxlength="80"><input data-refk="description" data-id="${esc(r.id)}" value="${esc(r.description)}" placeholder="Descrição" aria-label="Descrição" maxlength="300">
        <div class="row"><button class="btn sm ${on===r.id?'':'gold'}" data-ref-show="${esc(r.id)}">${on===r.id?'Ocultar':'Mostrar'}</button>${ui.confirm===r.id?`<button class="btn sm danger" data-ref-del="${esc(r.id)}">Confirmar remoção</button>`:`<button class="btn sm" data-ref-ask="${esc(r.id)}">Remover</button>`}</div></div>`).join('')||'<p class="empty">Nenhuma referência.</p>'}</div></div>`;
  }
  if(ui.mtab==='arch'){
    const a=find('marchive',ui.archSel)||data.marchive[0];if(a)ui.archSel=a.id;
    h=`<div class="layout"><aside class="panel roster"><div class="roster-head"><h2>Arquivo</h2><button class="btn sm" data-act="arch-add">+ Nova</button></div><div class="list">${data.marchive.map(x=>`<button class="pc${x.id===ui.archSel?' active':''}" style="grid-template-columns:1fr" data-arch="${esc(x.id)}"><span class="pc-name">${esc(x.title||'Sem título')}</span></button>`).join('')||'<p class="empty">Arquivo vazio.</p>'}</div></aside>
      <main class="panel sheet">${a?`<label class="field">Título<input data-archk="title" value="${esc(a.title)}" maxlength="160"></label><label class="field">Conteúdo<textarea rows="20" data-archk="content" maxlength="60000">${esc(a.content)}</textarea></label>
        <div class="row">${ui.confirm===a.id?`<div class="confirm">Apagar “${esc(a.title)}”? Isso não pode ser desfeito. <button class="btn danger" data-arch-del="${esc(a.id)}">Apagar</button><button class="btn" data-act="cancel">Cancelar</button></div>`:`<button class="btn danger" data-arch-ask="${esc(a.id)}">Apagar entrada</button>`}</div>`:'<div class="empty">Crie a primeira entrada do arquivo.</div>'}</main></div>`;
  }
  if(ui.mtab==='msgs')h=msgsTabHTML();
  if(ui.mtab==='notes'){
    const camps=S.notesDoc.campaigns||[];
    h=`<div class="panel sheet"><h2>Notas do Mestre</h2>
      ${camps.length?`<label class="field">Campanha ativa<select id="campSel">${camps.map(c=>`<option value="${esc(c.id)}"${c.id===S.notesDoc.activeCampaign?' selected':''}>${esc((c.number?c.number+' · ':'')+c.name)}</option>`).join('')}</select></label>`:''}
      <label class="field">Notas privadas<textarea rows="22" id="mNotes" maxlength="200000" placeholder="Ganchos, segredos, próximos passos…">${esc(S.notesDoc.notes)}</textarea></label><p class="hint">Só aparecem aqui, na Área do Mestre.</p></div>`;
  }
  if(ui.mtab==='scene')h=sceneTabHTML();
  if(ui.mtab==='obs')h=obsTabHTML();
  if(force)el.innerHTML=h;else paint(el,h);
  scalePreview();
}
/* ---------- Em cena (master tab): drag characters/NPCs onto the stage; tap works on phones ---------- */
function sceneTabHTML(){
  const list=ov().npcs||[],inIds=new Set(list.map(n=>n.id));
  const card=(c,kind,on)=>`<div class="sc-card" draggable="true" tabindex="0" role="button" data-sc-id="${esc(c.id)}" data-sc-kind="${kind}" title="${on?'Arraste para fora ou toque para tirar de cena':'Arraste para a cena ou toque para colocar'}"><div class="sc-pic">${pic(c)}</div><span>${esc(c.name||'?')}</span><small>${kind==='char'?'Jogador':'NPC'}</small></div>`;
  const chars=data.chars.filter(c=>!inIds.has(c.id)),npcs=data.mnpcs.filter(c=>!inIds.has(c.id));
  return `<div class="panel sheet"><div class="row" style="justify-content:space-between"><h2>Em cena</h2><button class="btn danger" data-sc-clear ${list.length?'':'disabled'}>Limpar cena</button></div>
    <p class="hint">Arraste personagens e NPCs para a cena, e para fora dela para tirar. No celular, toque no card. O que estiver na cena aparece para os jogadores no topo da aba Grupo.</p>
    <div class="field"><b style="color:var(--ink)">Link para o OBS</b><span>Fontes → + → Navegador → cole o link, 1920×1080. Fundo verde: troque o final por <b>#overlay-cena-verde</b>.</span><div class="linkrow"><code>${ARTIFACT_URL}#overlay-cena</code><button class="btn sm" data-copy="${ARTIFACT_URL}#overlay-cena">Copiar</button></div></div>
    <div class="sc-wrap"><div class="sc-zone stage" data-sc-drop="in"><h4>Na cena</h4><div class="sc-grid">${list.map(n=>card(n,n.kind==='char'?'char':'npc',true)).join('')||'<p class="sc-empty">Arraste alguém para cá.</p>'}</div></div>
    <div class="sc-zone" data-sc-drop="out"><h4>Personagens</h4><div class="sc-grid">${chars.map(c=>card(c,'char',false)).join('')||'<p class="hint">Todos já estão em cena.</p>'}</div>
      <h4>NPCs</h4><div class="sc-grid">${npcs.map(c=>card(c,'npc',false)).join('')||'<p class="hint">Nenhum NPC disponível.</p>'}</div></div></div></div>`;
}
function sceneSet(id,kind,on){
  const list=ov().npcs||[],has=list.some(n=>n.id===id);if(on===has)return;
  if(on){const c=find(kind==='char'?'chars':'mnpcs',id);if(!c)return;setOv({npcs:[...list,{id,kind,name:c.name||'?',portrait:c.portrait||''}]})}
  else setOv({npcs:list.filter(n=>n.id!==id)});
  renderDesk(true);renderLive();
}
(()=>{const mb=$('mbody');let dragId=null,dragKind=null;
  const zoneOf=e=>e.target.closest&&e.target.closest('[data-sc-drop]');
  mb.addEventListener('click',e=>{if(!S.unlocked||ui.mtab!=='scene')return;
    if(e.target.closest('[data-sc-clear]')){setOv({npcs:[]});renderDesk(true);renderLive();toast('Cena limpa.');return}
    const c=e.target.closest('.sc-card');if(!c)return;const on=!!c.closest('[data-sc-drop="in"]');sceneSet(c.dataset.scId,c.dataset.scKind,!on)});
  mb.addEventListener('keydown',e=>{const c=e.target.closest&&e.target.closest('.sc-card');if(c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();c.click()}});
  mb.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('.sc-card');if(!c)return;dragId=c.dataset.scId;dragKind=c.dataset.scKind;c.classList.add('dragging');try{e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move'}catch(_){}});
  mb.addEventListener('dragend',e=>{const c=e.target.closest&&e.target.closest('.sc-card');if(c)c.classList.remove('dragging');mb.querySelectorAll('.sc-zone.over').forEach(z=>z.classList.remove('over'));dragId=null});
  mb.addEventListener('dragover',e=>{const z=zoneOf(e);if(!z||!dragId)return;e.preventDefault();mb.querySelectorAll('.sc-zone.over').forEach(x=>x!==z&&x.classList.remove('over'));z.classList.add('over')});
  mb.addEventListener('dragleave',e=>{const z=zoneOf(e);if(z&&!z.contains(e.relatedTarget))z.classList.remove('over')});
  mb.addEventListener('drop',e=>{const z=zoneOf(e);if(!z||!dragId)return;e.preventDefault();z.classList.remove('over');sceneSet(dragId,dragKind,z.dataset.scDrop==='in');dragId=null});
})();
export function scalePreview(){document.querySelectorAll('.obs-preview').forEach(p=>{if(p.firstElementChild&&p.clientWidth)p.firstElementChild.style.transform='scale('+(p.clientWidth/2172)+')'})}
addEventListener('resize',scalePreview);
/* the HUD column can change width without a window resize (layout switch, fonts, sidebar): rescale whenever it does */
if(window.ResizeObserver){const ro=new ResizeObserver(()=>scalePreview());const hp=document.querySelector('#myHud .obs-preview');if(hp)ro.observe(hp);addEventListener('load',scalePreview)}
wireSheet($('mbody'),()=>ui.mtab==='npcs'?{col:'mnpcs',c:curNpc(),m:true,edit:true,setTab:t=>ui.npcTab=t,rerender:()=>renderDesk(true)}
  :ui.mtab==='players'?{col:'chars',c:find('chars',ui.mpSel),m:S.canWrite,edit:S.canWrite,setTab:t=>ui.mpTab=t,rerender:()=>renderDesk(true)}:null);
$('mtabs').addEventListener('click',e=>{const b=e.target.closest('[data-mtab]');if(b){ui.mtab=b.dataset.mtab;ui.confirm=null;renderDesk(true)}});
$('mbody').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||!S.unlocked)return;const d=b.dataset;
  if(d.copy){const v=d.copy;navigator.clipboard.writeText(v).then(()=>toast('Link copiado.'),()=>{const c=b.previousElementSibling;const r=document.createRange();r.selectNodeContents(c);const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Selecionei o link: copie com Ctrl+C.')});return}
  if(d.thread){openChat(d.thread);return}
  if(d.mp){ui.mpSel=d.mp;ui.mpTab=ui.mpTab||'sheet';ui.confirm=null;if(S.canWrite&&ov().follow!==false&&ov().selected!==d.mp)setOv({selected:d.mp,visible:true});renderDesk(true);return}
  if(d.act==='mp-air'){setOv({selected:ui.mpSel,visible:true});renderDesk(true);return}
  if(d.ovnpcdel){setOv({npcs:(ov().npcs||[]).filter(n=>n.id!==d.ovnpcdel)});renderDesk(true);renderLive();return}
  if(d.go){if(d.go==='group'){setView('group');return}ui.mtab=d.go;ui.confirm=null;renderDesk(true);return}
  if(d.goarch){ui.archSel=d.goarch;ui.mtab='arch';ui.confirm=null;renderDesk(true);return}
  if(d.taskdel){write('mnotes','main',{checklists:(S.notesDoc.checklists||[]).filter(t=>t.id!==d.taskdel)});renderDesk(true);return}
  if('taskclear' in d){write('mnotes','main',{checklists:(S.notesDoc.checklists||[]).filter(t=>!t.done)});renderDesk(true);return}
  if(d.npc){ui.npcSel=d.npc;ui.npcTab='sheet';ui.confirm=null;renderDesk(true);return}
  if(d.act==='npc-add'){const id=uid();if(await create('mnpcs',id,{name:'Novo NPC',cls:'',portrait:'',str:10,dex:10,con:10,int:10,wis:10,cha:10,ac:10,hp:0,hpMax:0,inspiration:0,skills:[],items:[],effects:[],notes:'',history:'',order:Date.now()})){ui.npcSel=id}return}
  if(d.arch){ui.archSel=d.arch;ui.confirm=null;renderDesk(true);return}
  if(d.act==='arch-add'){const id=uid();if(await create('marchive',id,{title:'Nova entrada',category:'',content:'',order:Date.now()}))ui.archSel=id;return}
  if(d.archAsk){ui.confirm=d.archAsk;renderDesk(true);return}
  if(d.act==='cancel'){ui.confirm=null;renderDesk(true);return}
  if(d.archDel){ui.confirm=null;await remove('marchive',d.archDel);ui.archSel=null;return}
  if(d.refShow){const r=find('mrefs',d.refShow);const on=S.live.reveal&&S.live.reveal.id===r.id;write('session','live',{reveal:on?null:{id:r.id,name:r.name,description:r.description||'',image:r.image||''}});renderDesk(true);renderLive();return}
  if('refHide' in d){write('session','live',{reveal:null});renderDesk(true);renderLive();return}
  if(d.refAsk){ui.confirm=d.refAsk;renderDesk(true);return}
  if(d.refDel){ui.confirm=null;if(S.live.reveal&&S.live.reveal.id===d.refDel)write('session','live',{reveal:null});await remove('mrefs',d.refDel);return}
  if(d.ini){
    const ini=structuredClone(S.live.initiative||{entries:[],round:1,turn:0});ini.entries=ini.entries||[];const n=ini.entries.length;const i=ini.entries.findIndex(x=>x.id===d.id);
    if(d.ini==='next'){ini.turn=(ini.turn||0)+1;if(ini.turn>=n){ini.turn=0;ini.round=(ini.round||1)+1}}
    else if(d.ini==='prev'){ini.turn=(ini.turn||0)-1;if(ini.turn<0){if((ini.round||1)>1){ini.round--;ini.turn=n-1}else ini.turn=0}}
    else if(d.ini==='sort'){const cur=ini.entries[ini.turn||0];ini.entries.sort((a,b)=>(Number(b.init)||0)-(Number(a.init)||0));ini.turn=Math.max(0,ini.entries.indexOf(cur))}
    else if(d.ini==='clear'){ini.entries=[];ini.turn=0;ini.round=1;ini.started=false}
    else if(d.ini==='start'){if(!n)return;
      /* roll initiative for everyone: d20 + DEX modifier, highest first (ties: higher DEX) */
      for(const en of ini.entries){const c=find(en.kind==='npc'?'mnpcs':'chars',en.ref),m=statMod(c,'dex'),r=rnd(20);en.init=r+m;en.dex=m;en.roll=r}
      ini.entries.sort((x,y)=>(y.init-x.init)||((y.dex||0)-(x.dex||0)));ini.started=true;ini.turn=0;ini.round=1;
      toast('Iniciativa rolada (d20 + DES): '+ini.entries.map(e=>String(e.name||'').split(' ')[0]+' '+e.init).join(', '))}
    else if(d.ini==='addall'){if(!n)ini.started=false;for(const c of data.chars)if(!ini.entries.some(x=>x.ref===c.id))ini.entries.push({id:uid(),ref:c.id,kind:'char',name:c.name,portrait:c.portrait||'',init:0})}
    else if(d.ini==='rm'&&i>=0){ini.entries.splice(i,1);if((ini.turn||0)>=ini.entries.length)ini.turn=0}
    else if(d.ini==='up'&&i>0){[ini.entries[i-1],ini.entries[i]]=[ini.entries[i],ini.entries[i-1]]}
    else if(d.ini==='down'&&i>=0&&i<n-1){[ini.entries[i+1],ini.entries[i]]=[ini.entries[i],ini.entries[i+1]]}
    write('session','live',{initiative:ini});renderDesk(true);renderLive();
  }
});
$('mbody').addEventListener('input',e=>{
  const t=e.target;if(!S.unlocked)return;
  if(t.dataset.refk){writeLater('mrefs',t.dataset.id,{[t.dataset.refk]:t.value.slice(0,300)},'r'+t.dataset.refk+t.dataset.id)}
  else if(t.dataset.archk){writeLater('marchive',ui.archSel,{[t.dataset.archk]:t.value.slice(0,60000)},'a'+t.dataset.archk+ui.archSel);if(t.dataset.archk==='title'){const l=$('mbody').querySelector(`[data-arch="${ui.archSel}"] .pc-name`);if(l)l.textContent=t.value||'Sem título'}}
  else if(t.id==='mNotes'){writeLater('mnotes','main',{notes:t.value.slice(0,200000)},'mnotes')}
  else if(t.dataset.init){if(t.value==='')return;const ini=structuredClone(S.live.initiative);const en=ini.entries.find(x=>x.id===t.dataset.init);if(!en)return;en.init=clamp(t.value,-20,99);clearTimeout(timers.ini);S.live.initiative=ini;timers.ini=setTimeout(()=>{write('session','live',{initiative:S.live.initiative});renderLive()},600)}
});
$('mbody').addEventListener('change',async e=>{
  const t=e.target;if(!S.unlocked)return;
  if(t.id==='ovVis'){setOv({visible:t.checked});renderDesk(true);return}
  if(t.id==='ovFollow'){setOv({follow:t.checked});return}
  if(t.id==='ovAll'){setOv({all:t.checked});renderDesk(true);return}
  if(t.id==='ovSel'){setOv({selected:t.value||null});t.blur();renderDesk(true);return}
  if(t.id==='ovNpcAdd'&&t.value){const n=find('mnpcs',t.value);if(n)setOv({npcs:[...(ov().npcs||[]),{id:n.id,name:n.name,portrait:n.portrait||''}]});t.blur();renderDesk(true);renderLive();return}
  if(t.dataset.task){write('mnotes','main',{checklists:(S.notesDoc.checklists||[]).map(x=>x.id===t.dataset.task?{...x,done:t.checked}:x)});t.blur();renderDesk(true);return}
  if(t.id==='iniAdd'&&t.value){const [kind,id]=[t.value.slice(0,t.value.indexOf(':')),t.value.slice(t.value.indexOf(':')+1)];const c=find(kind==='npc'?'mnpcs':'chars',id);if(!c)return;const ini=structuredClone(S.live.initiative||{entries:[],round:1,turn:0});if(!(ini.entries||[]).length)ini.started=false;ini.entries=[...(ini.entries||[]),{id:uid(),ref:c.id,kind,name:c.name,portrait:c.portrait||'',init:0}];write('session','live',{initiative:ini});t.blur();renderDesk(true);renderLive()}
  else if(t.id==='iniNums'){write('session','live',{initiative:{...S.live.initiative,showNumbers:t.checked}});renderLive()}
  else if(t.id==='campSel'){write('mnotes','main',{activeCampaign:t.value});toast('Campanha ativa alterada.')}
  else if(t.matches('[data-refnew]')){const f=t.files[0];t.value='';if(!f)return;try{const r=await S.assets.upload(f);await create('mrefs',uid(),{name:f.name.replace(/\.[^.]+$/,'').slice(0,80),description:'',image:r.id,order:Date.now()});toast('Referência adicionada.')}catch(err){toast('Não foi possível enviar ('+(err.code||'erro')+').')}}
});
$('mbody').addEventListener('submit',e=>{
  if(!S.unlocked||!e.target.matches('[data-taskform]'))return;e.preventDefault();
  const label=String(new FormData(e.target).get('label')||'').trim().slice(0,300);if(!label)return;
  write('mnotes','main',{checklists:[...(S.notesDoc.checklists||[]),{id:uid(),label,done:false}]});renderDesk(true);
  const inp=$('mbody').querySelector('[data-taskform] input');if(inp)inp.focus();
});
