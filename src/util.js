/* Funções utilitárias sem dependências: DOM, texto, números, localStorage e avisos. */
export const $=id=>document.getElementById(id);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const STATS=[['str','Força'],['dex','Destreza'],['con','Constituição'],['int','Inteligência'],['wis','Sabedoria'],['cha','Carisma']];
export const b64=u=>{let s='';const a=new Uint8Array(u);for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s)};
export const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,Math.trunc(Number(n)||0)));
export const mod=n=>{const m=Math.floor((Number(n)-10)/2);return (m>=0?'+':'')+m};
export const uid=()=>(crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):'x'+Date.now().toString(36)+Math.random().toString(36).slice(2));
export const store={get(k,s=localStorage){try{return s.getItem(k)}catch(e){return null}},set(k,v,s=localStorage){try{v==null?s.removeItem(k):s.setItem(k,v)}catch(e){}}};
export function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,3200)}
export function setStatus(kind,text){$('dot').className='dot '+kind;$('statusText').textContent=text;$('statusBox').hidden=kind!=='warn'}
