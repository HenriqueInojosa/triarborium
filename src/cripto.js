/* Criptografia dos dados do mestre (AES-GCM com chave derivada da senha). */
import { b64, unb64 } from './util.js';
import { S } from './estado.js';

/* master data is AES-GCM encrypted with a key derived from the master password; without it the stored docs are unreadable */
export const MASTER=new Set(['mnpcs','mrefs','marchive','mnotes']);
export const raw={mnpcs:[],mrefs:[],marchive:[],mnotes:null};
export async function deriveKey(pw,meta){const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(meta.salt),iterations:meta.iter||310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function encObj(obj,key=S.mkey){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(obj)));return{iv:b64(iv),ct:b64(ct)}}
export async function decObj(d,key=S.mkey){if(!d||!d.ct||!key)return null;try{const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(d.iv)},key,unb64(d.ct));return JSON.parse(new TextDecoder().decode(pt))}catch(e){return null}}
