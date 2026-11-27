/* Ficha do personagem: HTML e eventos de edição. */
import { STATS, clamp, esc, mod, store, toast, uid } from './util.js';
import { S, SHOW_HP, ui } from './estado.js';
import { blob, pic } from './imagens.js';
import { find, remove, write, writeLater } from './banco.js';
import { renderLive, renderRoster } from './jogador.js';
import { ov, setOv } from './overlays.js';
import { canRollFor, exprOf, sheetRoll, skillParse } from './dados.js';
import { applyRupt, ruptHTML, ruptureRoll } from './ruptura.js';
import { render } from './app.js';

/* ---------- shared sheet (characters and NPCs) ---------- */
export function sheetHTML(c,o){
  // o: {col, m (master edits), edit (may edit player fields), tab, notesKey, histKey, npc}
  const {m,edit,tab}=o;
  const R=canRollFor(o.col,c);
  let body='';
  if(tab==='sheet'){
    const san=clamp(c.sanity??100,0,100),hpMax=Number(c.hpMax)||0;
    const st=STATS.map(([k,n])=>`<div class="stat"><span>${n}</span>${m?`<input type="number" min="1" max="30" data-master="${k}" value="${Number(c[k])||10}" aria-label="${n}">`:`<b>${Number(c[k])||10}</b>`}${R?`<button class="stat-roll" data-roll-stat="${k}" title="Rolar 1d20 ${mod(c[k]??10)} (${n})">🎲 ${mod(c[k]??10)}</button>`:`<small>${mod(c[k]??10)}</small>`}</div>`).join('');
    const step=(k,v,max)=>!m?`<b class="val" title="Definido pelo mestre">${v}</b>`:`<div class="stepper"><button class="btn sm" data-step="${k}" data-d="-1" ${!edit||v<=0?'disabled':''} aria-label="Diminuir">−</button><span class="val">${v}</span><button class="btn sm" data-step="${k}" data-d="1" ${!edit||v>=max?'disabled':''} aria-label="Aumentar">+</button></div>`;
    const fx=(c.effects||[]).map(e=>`<div class="fx ${e.type==='debuff'?'debuff':''}">${blob(e.image)?`<img src="${blob(e.image)}" alt="">`:''}<span><small>${e.type==='debuff'?'Debuff':'Buff'}</small>${esc(e.label)}</span>${m?`<button class="btn sm" data-fxdel="${esc(e.id)}" aria-label="Remover efeito">×</button>`:''}</div>`).join('');
    body=`<div class="grid2${m?'':' sheet3'}">
      <section class="box"><h4>Atributos</h4><div class="stats">${st}</div></section>
      <section class="box"><h4>Recursos</h4>
        <div class="res"><span class="lbl">Classe de Armadura</span>${m?`<input class="num" type="number" min="0" max="40" data-master="ac" value="${Number(c.ac)||0}" aria-label="CA">`:`<b class="val">${Number(c.ac)||0}</b>`}</div>
        ${SHOW_HP?`<div class="res"><span class="lbl">Pontos de Vida</span><div class="stepper">${step('hp',Number(c.hp)||0,hpMax)}<span class="lbl">/</span>${m?`<input class="num" type="number" min="0" max="999" data-master="hpMax" value="${hpMax}" aria-label="PV máximo">`:`<b>${hpMax}</b>`}</div></div>`:''}
        <div class="res"><span class="lbl">Inspiração</span>${step('inspiration',Number(c.inspiration)||0,99)}</div>
        ${o.npc?'':`<div class="res" style="flex-direction:column;align-items:stretch">
          <div class="row" style="justify-content:space-between"><span class="lbl">Sanidade</span><span class="stepper"><input class="num" type="number" min="0" max="100" data-field="sanity" value="${san}" ${m?'':'disabled'} aria-label="Sanidade"><span class="lbl">/ 100</span></span></div>
          <div class="san-track"><i data-sanfill style="width:${san}%"></i></div>
          ${m?`<div class="row">${[-10,-5,-1,1,5,10].map(d=>`<button class="btn sm" data-san="${d}">${d>0?'+':''}${d}</button>`).join('')}</div>`:''}
          <p class="hint">51–100 estável · 26–50 abalado · 1–25 crítico · 0 ruptura</p>${san===0?ruptHTML(c,m,R):''}</div>`}
      </section>${m?'</div>':''}
      <section class="box"><h4>Efeitos</h4>${fx?`<div class="effects">${fx}</div>`:'<p class="hint">Nenhum buff ou debuff ativo.</p>'}
        ${m?`<form class="row" data-fxform><input name="label" placeholder="Nome do efeito" maxlength="60" required aria-label="Nome do efeito"><select name="type" aria-label="Tipo"><option value="buff">Buff</option><option value="debuff">Debuff</option></select>${S.assets?'<input name="img" type="file" accept="image/*" aria-label="Imagem do efeito">':''}<button class="btn" type="submit">+ Adicionar efeito</button></form>`:''}</section>${m?'':'</div>'}
      ${m?`<section class="box"><h4>${o.npc?'NPC':'Personagem'}</h4><div class="grid2"><label class="field">Nome<input data-mtext="name" value="${esc(c.name)}" maxlength="80"></label><label class="field">${o.npc?'Tipo':'Classe'}<input data-mtext="cls" value="${esc(c.cls)}" maxlength="80"></label></div>
        <div class="row">${S.assets?`<label class="btn">Trocar retrato<input type="file" accept="image/*" data-portrait hidden></label>`:''}
        ${o.npc?`<button class="btn" data-act="reveal-npc">${(ov().npcs||[]).some(n=>n.id===c.id)?'Tirar de cena (overlay)':'Colocar em cena (overlay)'}</button>`:`<button class="btn" data-act="ov-show">${ov().selected===c.id?'📺 No overlay':'📺 Mostrar no overlay'}</button>`}
        ${ui.confirm===c.id?`<div class="confirm">Remover ${esc(c.name)}? Isso não pode ser desfeito. <button class="btn danger" data-act="del-yes">Remover</button><button class="btn" data-act="del-no">Cancelar</button></div>`:`<button class="btn danger" data-act="del">Remover ${o.npc?'NPC':'personagem'}</button>`}</div></section>`:''}`;
  }
  if(tab==='skills'){
    body=`<p class="hint">${m?'Como mestre, você edita nome, dados, atributo, descrição e limite, e pode gastar ou devolver usos.':'Clique no dado para usar a habilidade: cada uso gasta 1 carga. O mestre restaura os usos.'}</p><div class="skills-grid${m?' edit':''}">`+
    ((c.skills||[]).map(s=>{const max=clamp(s.maxUses,1,99),left=clamp(s.usesLeft??max,0,max);
      const fin=max<99,out=fin&&left<=0,conf=ui.skConfirm===c.id+':'+s.id;
      const rp=R?skillParse(s,c):null,rollBtn=rp?`<button class="btn sm gold" data-roll-skill="${esc(s.id)}" title="Rolar ${esc(s.name||'Habilidade')}" ${out?'disabled':''}>🎲 ${esc(exprOf(rp))}</button>`:(R&&fin?`<button class="btn sm gold" data-roll-skill="${esc(s.id)}" ${out?'disabled':''}>Usar</button>`:'');
      const pips=max<=10?`<span class="pips">${Array.from({length:max},(_,i)=>`<i class="pip${i<left?'':' off'}"></i>`).join('')}</span>`:'';
      const head=m?`<div class="grid2" style="width:100%"><label class="field">Nome<input data-skill="name" data-id="${esc(s.id)}" value="${esc(s.name)}"></label><div class="grid3"><label class="field">Dados<input data-skill="dice" data-id="${esc(s.id)}" value="${esc(s.dice)}" placeholder="1d8+2"></label><label class="field">Atributo<select data-skill="stat" data-id="${esc(s.id)}"><option value="">—</option>${STATS.map(([k,n])=>`<option value="${k}"${s.stat===k?' selected':''}>${n}</option>`).join('')}</select></label><label class="field">Usos máx.<input type="number" min="1" max="99" data-skill="maxUses" data-id="${esc(s.id)}" value="${max}"></label></div></div>`:`<h5>${esc(s.name||'Habilidade')}${s.dice?`<span class="dice">${esc(s.dice)}</span>`:''}</h5>`;
      const foot=conf?`<div class="sk-confirm"><p>Usar <b>${esc(s.name||'Habilidade')}</b>? Gasta 1 uso (restam ${left} de ${max}).</p><span><button class="btn sm gold" data-skgo="${esc(s.id)}">${rp?'🎲 Rolar e gastar':'Usar'}</button><button class="btn sm" data-act="sk-no">Cancelar</button></span></div>`
        :`<div class="skill-foot">${pips}<b class="sk-left${out?' out':''}">${fin?left+'/'+max:'∞'}</b>${m?`<button class="btn sm" data-use="${esc(s.id)}" data-d="-1" ${left===0?'disabled':''}>− Gastar</button><button class="btn sm" data-use="${esc(s.id)}" data-d="1" ${left===max?'disabled':''}>+ Devolver</button>`:''}<span class="sk-roll">${rollBtn}</span></div>`;
      return `<div class="skill${conf?' confirming':''}"><div class="skill-top">${head}</div>
        ${m?`<label class="field">Descrição<textarea rows="3" data-skill="description" data-id="${esc(s.id)}">${esc(s.description)}</textarea></label>`:`<p class="desc">${esc(s.description||'Sem descrição')}</p>`}
        ${foot}
        ${m?`<div><button class="btn sm danger" data-skilldel="${esc(s.id)}">Remover habilidade</button></div>`:''}</div>`}).join('')||'<p class="empty">Nenhuma habilidade cadastrada.</p>')+'</div>'+
    (m?`<div class="row"><button class="btn" data-act="skill-add">+ Nova habilidade</button><button class="btn" data-act="skill-reset">Restaurar todos os usos</button></div>`:'');
  }
  if(tab==='inv'){
    body=`<div class="row" style="justify-content:space-between"><p class="hint">${m?'Quantidades, estado e observações de cada item.':'🔒 O inventário é controlado pelo mestre.'}</p>${m?'<button class="btn gold" data-act="item-add">+ Adicionar item</button>':''}</div>`+
    ((c.items||[]).map(it=>`<div class="item"><label class="field">Item<input data-item="name" data-id="${esc(it.id)}" value="${esc(it.name)}" maxlength="160" ${m?'':'disabled'}></label><label class="field">Qtd.<input type="number" min="0" max="99999" data-item="qty" data-id="${esc(it.id)}" value="${Number(it.qty)||0}" ${m?'':'disabled'}></label><label class="field">Estado<select data-item="used" data-id="${esc(it.id)}" ${m?'':'disabled'}><option value="0"${it.used?'':' selected'}>Disponível</option><option value="1"${it.used?' selected':''}>Utilizado</option></select></label>${m?`<button class="btn sm danger" data-itemdel="${esc(it.id)}">Remover</button>`:'<span></span>'}<label class="field notes">Observações<input data-item="notes" data-id="${esc(it.id)}" value="${esc(it.notes)}" maxlength="4000" ${m?'':'disabled'}></label></div>`).join('')||'<p class="empty">Inventário vazio.</p>');
  }
  if(tab==='hist'||tab==='notes'){
    const k=tab==='hist'?o.histKey:o.notesKey;
    body=`<label class="field">${tab==='hist'?'Histórico':'Anotações'}<textarea rows="14" data-text="${k}" maxlength="60000" ${edit?'':'disabled'} placeholder="Escreva aqui…">${esc(c[k])}</textarea></label><p class="hint">${o.npc?'Visível só na Área do Mestre.':'Visível para todos na mesa.'}</p>`;
  }
  const tabs=[['sheet','Ficha'],['skills','Habilidades'],['inv','Inventário'],['hist','Histórico'],['notes','Anotações']];
  return `<div class="hero">${pic(c,'portrait')}<div class="grow"><h3>${esc(c.name)}</h3><div class="cls">${esc(c.cls||(o.npc?'NPC':'Aventureiro'))}${c.updatedAt?` · atualizado ${new Date(c.updatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:''}</div></div>
    ${o.npc||o.desk?'':`<button class="btn" data-act="mine">${c.id===ui.mine?'★ Meu personagem':'☆ Este é meu personagem'}</button>`}</div>
    <nav class="tabs">${tabs.map(([k,n])=>`<button class="${k===tab?'active':''}" data-tab="${k}">${n}</button>`).join('')}</nav>${body}
    ${edit?'':'<p class="hint">Você está vendo em modo leitura. Para editar, peça ao mestre acesso de Colaborador.</p>'}`;
}
/* sheet event wiring, shared by the player sheet and the NPC sheet */
export function wireSheet(el,ctx){
  // ctx(): {col, c, m, edit, setTab(t), rerender()}
  el.addEventListener('click',async e=>{
    const x=ctx();if(!x||!x.c)return;const {col,c}=x;const b=e.target.closest('button');if(!b||(b.type==='submit'&&b.form))return;
    if(b.dataset.tab){x.setTab(b.dataset.tab);x.rerender(true);return}
    if(b.dataset.act==='mine'){ui.mine=c.id===ui.mine?null:c.id;store.set('tri-mine',ui.mine);render();return}
    if('ruptRoll' in b.dataset){ruptureRoll(col,c).then(()=>x.rerender(false));return}
    if(b.dataset.rupt){if(!x.m)return;applyRupt(col,c,b.dataset.rupt);x.rerender(false);return}
    if(b.dataset.act==='sk-no'){ui.skConfirm=null;x.rerender(false);return}
    if(b.dataset.rollSkill||b.dataset.skgo){
      /* using a skill spends one charge: ask first, then roll (or just spend, for skills without dice) */
      const id=b.dataset.rollSkill||b.dataset.skgo,sk=(c.skills||[]).find(y=>y.id===id);if(!sk)return;
      const max=clamp(sk.maxUses,1,99),left=clamp(sk.usesLeft??max,0,max);
      if(!canRollFor(col,c)){toast('Só o dono do personagem e o mestre usam esta ficha.');return}
      if(max>=99){sheetRoll(col,c,{rollSkill:id});return}
      if(left<=0){ui.skConfirm=null;toast('Sem usos restantes. Peça ao mestre para restaurar.');x.rerender(false);return}
      if(b.dataset.rollSkill){ui.skConfirm=c.id+':'+id;x.rerender(false);return}
      ui.skConfirm=null;const skills=structuredClone(c.skills||[]);skills.find(y=>y.id===id).usesLeft=left-1;write(col,c.id,{skills});
      if(skillParse(sk,c))sheetRoll(col,c,{rollSkill:id});else toast((sk.name||'Habilidade')+' usada.');
      x.rerender(false);return}
    if(b.dataset.rollStat){sheetRoll(col,c,b.dataset);return}
    if(!x.edit)return;
    const re=()=>x.rerender(false);
    if((b.dataset.step||b.dataset.san||b.dataset.itemdel||b.dataset.act==='item-add')&&!x.m)return;
    if(b.dataset.step){const k=b.dataset.step,max=k==='hp'?(Number(c.hpMax)||0):99;write(col,c.id,{[k]:clamp((Number(c[k])||0)+Number(b.dataset.d),0,max)});re()}
    else if(b.dataset.san){const v=clamp((c.sanity??100)+Number(b.dataset.san),0,100);write(col,c.id,v>0?{sanity:v,rupture:null}:{sanity:v});re()}
    else if(b.dataset.use&&x.m){const skills=structuredClone(c.skills||[]);const s=skills.find(y=>y.id===b.dataset.use);if(!s)return;const max=clamp(s.maxUses,1,99);s.usesLeft=clamp((s.usesLeft??max)+Number(b.dataset.d),0,max);write(col,c.id,{skills});re()}
    else if(b.dataset.itemdel){write(col,c.id,{items:(c.items||[]).filter(i=>i.id!==b.dataset.itemdel)});re()}
    else if(b.dataset.act==='item-add'){if((c.items||[]).length>=300){toast('Limite de 300 itens.');return}write(col,c.id,{items:[...(c.items||[]),{id:uid(),name:'Novo item',qty:1,used:false,notes:''}]});re()}
    else if(!x.m)return;
    else if(b.dataset.fxdel){write(col,c.id,{effects:(c.effects||[]).filter(f=>f.id!==b.dataset.fxdel)});re()}
    else if(b.dataset.skilldel){write(col,c.id,{skills:(c.skills||[]).filter(s=>s.id!==b.dataset.skilldel)});re()}
    else if(b.dataset.act==='skill-add'){write(col,c.id,{skills:[...(c.skills||[]),{id:uid(),name:'Nova habilidade',description:'',dice:'',maxUses:1,usesLeft:1,playerNote:''}]});re()}
    else if(b.dataset.act==='skill-reset'){write(col,c.id,{skills:(c.skills||[]).map(s=>({...s,usesLeft:clamp(s.maxUses,1,99)}))});toast('Usos restaurados.');re()}
    else if(b.dataset.act==='reveal-npc'){const list=ov().npcs||[];const on=list.some(n=>n.id===c.id);setOv({npcs:on?list.filter(n=>n.id!==c.id):[...list,{id:c.id,name:c.name,portrait:c.portrait||''}]});toast(on?'NPC saiu de cena.':'NPC em cena.');renderLive();re()}
    else if(b.dataset.act==='ov-show'){setOv({selected:c.id,visible:true});toast('Mostrando '+c.name+' no overlay.');re()}
    else if(b.dataset.act==='del'){ui.confirm=c.id;x.rerender(true)}
    else if(b.dataset.act==='del-no'){ui.confirm=null;x.rerender(true)}
    else if(b.dataset.act==='del-yes'){ui.confirm=null;await remove(col,c.id);toast(c.name+' removido.')}
  });
  el.addEventListener('input',e=>{
    const x=ctx();if(!x||!x.c||!x.edit)return;const {col,c}=x,t=e.target;
    if(t.dataset.field==='sanity'){if(t.value===''||!x.m)return;const v=clamp(t.value,0,100);const f=el.querySelector('[data-sanfill]');if(f)f.style.width=v+'%';writeLater(col,c.id,v>0?{sanity:v,rupture:null}:{sanity:v},'san'+c.id);renderRoster()}
    else if(t.dataset.text){writeLater(col,c.id,{[t.dataset.text]:t.value.slice(0,60000)},t.dataset.text+c.id)}
    else if(t.dataset.item){if(!x.m)return;const items=structuredClone(c.items||[]);const it=items.find(y=>y.id===t.dataset.id);if(!it)return;const k=t.dataset.item;
      if(k==='qty')it.qty=clamp(t.value,0,99999);else if(k==='used')it.used=t.value==='1';else it[k]=t.value.slice(0,k==='notes'?4000:160);writeLater(col,c.id,{items},'items'+c.id)}
    else if(t.dataset.skill){const k=t.dataset.skill;if(k!=='playerNote'&&!x.m)return;const skills=structuredClone(c.skills||[]);const s=skills.find(y=>y.id===t.dataset.id);if(!s)return;
      if(k==='maxUses'){if(t.value==='')return;s.maxUses=clamp(t.value,1,99);s.usesLeft=Math.min(s.usesLeft??s.maxUses,s.maxUses)}else s[k]=t.value.slice(0,4000);writeLater(col,c.id,{skills},'skills'+c.id)}
    else if(x.m&&t.dataset.master){if(t.value==='')return;const k=t.dataset.master;const lim=k==='hpMax'?[0,999]:k==='ac'?[0,40]:[1,30];const p={[k]:clamp(t.value,...lim)};if(k==='hpMax')p.hp=Math.min(Number(c.hp)||0,p.hpMax);writeLater(col,c.id,p,'m'+k+c.id)}
    else if(x.m&&t.dataset.mtext){writeLater(col,c.id,{[t.dataset.mtext]:t.value.slice(0,80)},'mt'+t.dataset.mtext+c.id)}
  });
  el.addEventListener('change',async e=>{
    const x=ctx(),t=e.target;if(!x||!x.c||!x.m||!t.matches('[data-portrait]'))return;const f=t.files[0];t.value='';if(!f)return;
    try{const r=await S.assets.upload(f);write(x.col,x.c.id,{portrait:r.id});if(x.col==='mnpcs'&&S.live.reveal&&S.live.reveal.id===x.c.id)write('session','live',{reveal:{...S.live.reveal,image:r.id}});if((x.col==='mnpcs'||x.col==='chars')&&(ov().npcs||[]).some(n=>n.id===x.c.id)){setOv({npcs:(ov().npcs||[]).map(n=>n.id===x.c.id?{...n,portrait:r.id}:n)});renderLive()}toast('Retrato atualizado.');x.rerender(true)}catch(err){toast('Não foi possível enviar o retrato ('+(err&&err.code||'erro')+').')}
  });
  el.addEventListener('submit',async e=>{
    const x=ctx();if(!x||!x.c||!x.m||!e.target.matches('[data-fxform]'))return;e.preventDefault();
    const fd=new FormData(e.target);const label=String(fd.get('label')||'').trim().slice(0,60);if(!label)return;
    let image='';const f=fd.get('img');if(f&&f.size&&S.assets){try{image=(await S.assets.upload(f)).id}catch(err){toast('Imagem não enviada ('+(err.code||'erro')+').')}}
    write(x.col,x.c.id,{effects:[...(x.c.effects||[]),{id:uid(),label,description:'',type:fd.get('type')==='debuff'?'debuff':'buff',image}]});x.rerender(true);
  });
}
/* ---------- group view ---------- */
export const curChar=()=>find('chars',ui.sel);
