import {initializeApp} from 'firebase/app';
import {getMessaging,onBackgroundMessage} from 'firebase/messaging/sw';
import {firebaseConfig} from './config.js';
const CACHE='rondas-v2-__BUILD_VERSION__';
const ASSETS=__PRECACHE__;
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('rondas-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 const path=url.pathname==='/'?'/index.html':url.pathname;if(!ASSETS.includes(path))return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);if(e.request.mode==='navigate'){try{const r=await fetch(e.request);if(r.ok)await cache.put(path,r.clone());return r;}catch{return await cache.match(path)||Response.error();}}
 return await cache.match(path)||fetch(e.request);})());
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const w of windows)if(new URL(w.url).pathname==='/admin.html'){await w.focus();return;}await self.clients.openWindow('/admin.html');})());});
try{const messaging=getMessaging(initializeApp(firebaseConfig));onBackgroundMessage(messaging,payload=>{
 const d=payload.data||{};return self.registration.showNotification(d.title||'Rondas de Seguridad',{body:d.body||'Nueva actividad',icon:'/icons/admin-192.png',badge:'/icons/admin-192.png',tag:d.eventId||'rondas',renotify:false,data:{url:'/admin.html'}});
});}catch(e){console.warn('Push no disponible en este navegador.');}
