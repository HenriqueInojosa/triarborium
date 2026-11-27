/* Firebase: inicialização e acesso ao Firestore e ao login.
   Expõe claude.use('db') e claude.use('auth'), no mesmo formato que o resto do site já usa. */
import { FIREBASE_CONFIG } from './firebase-config.js';

let ready;
const fbP=new Promise(r=>ready=r);
export const claude={use:name=>fbP.then(fb=>fb[name]||null)};

(async()=>{
try{
  const cfg=FIREBASE_CONFIG;
  if(!cfg||!cfg.apiKey)throw Error('firebase-config.js ainda não foi preenchido');
  // carregados sob demanda (mesma versão 10.12.2 que vinha do CDN), em arquivos separados no build
  const {initializeApp}=await import('firebase/app');
  const A=await import('firebase/auth');
  const F=await import('firebase/firestore');
  const app=initializeApp(cfg);
  const fa=A.getAuth(app);
  // everyone starts signed in (anonymously, so the OBS overlay works); players upgrade to Google
  let user=await new Promise(res=>{const off=A.onAuthStateChanged(fa,u=>{off();res(u)})});
  if(!user)user=(await A.signInAnonymously(fa)).user;
  const fs=F.getFirestore(app);
  const code=e=>e&&e.code==='permission-denied'?'invalid_argument':'unavailable';
  const wrapErr=e=>({code:code(e),message:String(e&&e.message||e)});
  const snapDoc=s=>({id:s.id,exists:s.exists(),data:()=>s.data(),metadata:{fromCache:s.metadata.fromCache,hasPendingWrites:s.metadata.hasPendingWrites}});
  const uid=()=>crypto.randomUUID().replaceAll('-','');
  function docRef(path){const r=F.doc(fs,path);return{id:r.id,path,
    get:async()=>{try{return snapDoc(await F.getDoc(r))}catch(e){throw wrapErr(e)}},
    set:(d,o)=>(o?F.setDoc(r,d,o):F.setDoc(r,d)).catch(e=>{throw wrapErr(e)}),
    update:d=>F.updateDoc(r,d).catch(e=>{throw wrapErr(e)}),
    delete:()=>F.deleteDoc(r).catch(e=>{throw wrapErr(e)}),
    onSnapshot:(next,err)=>F.onSnapshot(r,s=>next(snapDoc(s)),e=>err&&err(wrapErr(e))),
    collection:p=>colRef(path+'/'+p)}}
  function colRef(path,cons=[]){const base=F.collection(fs,path);const q=()=>cons.length?F.query(base,...cons):base;return{path,
    doc:id=>docRef(path+'/'+(id||uid())),
    add:async d=>{const r=docRef(path+'/'+uid());await r.set(d);return r},
    orderBy:(f,dir)=>colRef(path,[...cons,F.orderBy(f,dir||'asc')]),
    where:(f,op,v)=>colRef(path,[...cons,F.where(f,op,v)]),
    limit:n=>colRef(path,[...cons,F.limit(n)]),
    get:async()=>{const s=await F.getDocs(q());return{docs:s.docs.map(snapDoc),size:s.size,empty:s.empty,metadata:{fromCache:s.metadata.fromCache}}},
    onSnapshot:(next,err)=>F.onSnapshot(q(),s=>next({docs:s.docs.map(snapDoc),size:s.size,empty:s.empty,metadata:{fromCache:s.metadata.fromCache,hasPendingWrites:s.metadata.hasPendingWrites},docChanges:()=>[]}),e=>err&&err(wrapErr(e)))}}
  const db={doc:docRef,collection:p=>colRef(p)};
  const auth={
    user:()=>({uid:fa.currentUser.uid,anon:fa.currentUser.isAnonymous,name:fa.currentUser.displayName||'',email:fa.currentUser.email||''}),
    google:async()=>{await A.signInWithPopup(fa,new A.GoogleAuthProvider());location.reload()},
    signOut:async()=>{await A.signOut(fa);location.reload()}
  };
  ready({db,auth});
}catch(e){console.error('Firebase:',e);ready({})}
})();
