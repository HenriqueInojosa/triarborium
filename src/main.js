/* Ponto de entrada: carrega o Firebase e inicia o site (ou o overlay do OBS). */
import { claude } from './firebase.js';
import { $, setStatus, store } from './util.js';
import { S, ui } from './estado.js';
import { SIGIL, combatAlerts, renderLive, renderSheet, startMotes } from './jogador.js';
import { renderDesk } from './mestre.js';
import { ensurePublic, tryPassword, unlock } from './acesso.js';
import { bootObs, obsMode } from './overlays.js';
import { watchRolls } from './dados.js';
import { pruneScene, render } from './app.js';

if(!obsMode){document.body.insertAdjacentHTML('afterbegin',`<div class="kz-backdrop" aria-hidden="true"><div class="kz-sky"></div><div class="kz-tower"></div>${SIGIL}<canvas class="kz-motes"></canvas></div>`);startMotes(document.querySelector('.kz-backdrop'))}
render();
(async()=>{
  if(obsMode){bootObs();return}
  S.db=await claude.use('db');
  if(!S.db){setStatus('warn','Sem conexão com o banco de dados (confira o firebase-config.js)');return}
  S.auth=await claude.use('auth');S.me=S.auth&&S.auth.user();
  $('views').hidden=false;
  watchRolls();
  let loaded=false;const timer=setTimeout(()=>{if(!loaded)setStatus('warn','Sem conexão com as fichas ainda')},10000);
  S.db.collection('public').orderBy('order').onSnapshot(snap=>{
    S.pub=snap.docs.map(d=>({id:d.id,...structuredClone(d.data())}));S.pubLoaded=true;
    if(!snap.metadata.fromCache){loaded=true;clearTimeout(timer);setStatus('live','Ao vivo')}
    ensurePublic();render();
  },err=>{clearTimeout(timer);setStatus('warn','Conexão perdida, recarregue a página')});
  const saved=store.get('tri-mestre',sessionStorage);if(saved&&await tryPassword(saved))unlock(saved);
  render();
  S.db.doc('session/live').onSnapshot(s=>{if(s.exists)S.live=structuredClone(s.data());if(!s.metadata.fromCache){S.liveLoaded=true;pruneScene()}if(!S.live.initiative)S.live.initiative={entries:[],round:1,turn:0};combatAlerts();renderLive();if(S.unlocked&&['init','refs','over','obs','players','scene'].includes(ui.mtab))renderDesk(false);if(S.unlocked)renderSheet(false)},()=>{});
})();
