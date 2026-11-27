import { store } from './util.js';

/* Estado compartilhado entre os módulos.
   Variáveis que vários arquivos reatribuem ficam neste objeto (S.db, S.live, ...),
   porque um import do ES não pode ser reatribuído por quem importa. */
export const S = {
  mkey: null,
  db: null,
  assets: null,
  isMaster: false,
  canWrite: true,
  unlocked: false,
  masterSubs: false,
  auth: null,
  me: null,
  pub: [],
  pubLoaded: false,
  mySubId: null,
  mySub: null,
  masterCharsSub: null,
  notesDoc: {notes:'',campaigns:[],activeCampaign:''},
  live: {initiative:{entries:[],round:1,turn:0},reveal:null},
  obsLast: '',
  liveLoaded: false,
};

/* this campaign tracks sanity only: flip to true to bring hit points back everywhere */
export const SHOW_HP=false;
export const SUMMARY=['name','cls','portrait','hp','hpMax','sanity','effects','order','rupture'];
export const summaryOf=c=>Object.fromEntries(SUMMARY.map(k=>[k,c[k]??(k==='rupture'?null:k==='effects'?[]:k==='sanity'?100:k==='order'?0:k==='portrait'||k==='cls'||k==='name'?'':0)]));
export const data={chars:[],mnpcs:[],mrefs:[],marchive:[]};
export const ui={view:'group',sel:store.get('tri-sel'),tab:'sheet',mine:store.get('tri-mine'),mtab:'over',mpSel:null,mpTab:'sheet',npcSel:null,npcTab:'sheet',archSel:null,confirm:null};
