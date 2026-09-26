import {initializeApp,getApps} from 'firebase/app';
import {getAuth,onAuthStateChanged,signOut,connectAuthEmulator} from 'firebase/auth';
import {firebaseConfig} from './config.js';
export const $=id=>document.getElementById(id);
export const el=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
export function button(text,fn,kind='secondary'){const b=el('button',text,kind);b.type='button';b.addEventListener('click',()=>Promise.resolve(fn(b)).catch(showError));return b;}
export function clear(n){n.replaceChildren();}
export function line(parent,label,value){const p=el('p');p.append(el('strong',label+' '),document.createTextNode(String(value??'—')));parent.append(p);return p;}
export function notice(text,kind='info'){const n=$('notice');if(!n)return;n.textContent=text;n.className='notice '+kind;n.hidden=!text;}
export function showError(e){console.error(e);notice(e.message||'No se pudo completar la operación.','error');}
export function account(agent=false){const emulator=location.hostname==='localhost'&&(new URLSearchParams(location.search).get('emulator')==='1'||sessionStorage.getItem('emulator')==='1');if(emulator)sessionStorage.setItem('emulator','1');const config=emulator?{...firebaseConfig,projectId:'demo-rondas',apiKey:'fake-api-key',authDomain:'demo-rondas.firebaseapp.com'}:firebaseConfig;
 const name=agent?'agentes':'[DEFAULT]';const app=getApps().find(a=>a.name===name)||initializeApp(config,name);const auth=getAuth(app);
 if(emulator&&!auth.emulatorConfig)connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
 return {app,auth,ready:()=>new Promise(resolve=>{const off=onAuthStateChanged(auth,u=>{off();resolve(u);});})};}
export async function call(auth,accion,data={},retried=false){
 if(!navigator.onLine)throw Object.assign(Error('Sin conexión. Vuelve a intentarlo cuando tengas internet.'),{offline:true});
 if(!auth.currentUser)throw Object.assign(Error('Inicia sesión para continuar.'),{status:401});
 const token=await auth.currentUser.getIdToken(retried),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{const r=await fetch('/api/sistema',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({accion,...data}),signal:controller.signal,cache:'no-store'});
 const body=await r.json();if(!r.ok){if(r.status===401&&!retried)return call(auth,accion,data,true);throw Object.assign(Error(body.error||'Error del servidor.'),{status:r.status});}return body;
 }catch(e){if(e.name==='AbortError')throw Error('El servidor demoró. Reintenta: el registro no se duplicará.');throw e;}finally{clearTimeout(timer);}
}
export const fecha=t=>t?new Date(t).toLocaleString('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'medium'}):'Sin fecha';
export const duracion=s=>s==null?'En curso':`${Math.floor(s/60)} min ${s%60} s`;
export async function busy(b,fn){const text=b.textContent;b.disabled=true;b.textContent='Procesando…';try{return await fn();}catch(e){showError(e);}finally{b.disabled=false;b.textContent=text;}}
export function popup(title,render){const d=document.createElement('dialog'),h=el('h2',title),body=el('div'),close=button('Cerrar',()=>{d.close();d.remove();});d.append(h,body,close);render(body,d);document.body.append(d);d.showModal();return d;}
export function credentials(data){popup('Datos de acceso',body=>{line(body,'Código / usuario:',data.codigo||data.uid||'');line(body,'Contraseña temporal:',data.password||'La cuenta conserva su contraseña actual.');body.append(el('p','Entrega estos datos en privado. La contraseña solo se muestra en esta respuesta.'));if(data.password)body.append(button('Copiar contraseña',async()=>{await navigator.clipboard.writeText(data.password);notice('Contraseña copiada.');}));});}
export function network(){const n=$('network');const update=()=>{if(n){n.hidden=navigator.onLine;n.textContent='Sin conexión. Los registros pendientes permanecen en este dispositivo.';}};addEventListener('online',update);addEventListener('offline',update);update();}
export async function install(){network();if('serviceWorker'in navigator){try{await navigator.serviceWorker.register('/service-worker.js');}catch(e){console.warn('No se pudo activar la PWA',e);}}
 let prompt;addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;const b=$('install');if(b){b.hidden=false;b.onclick=async()=>{await prompt.prompt();b.hidden=true;};}});}
export {signOut};
