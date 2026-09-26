import {$,account,call,notice,showError,busy,line,clear,install,fecha,button} from './common.js';
import {saveDraft,deleteDraft,drafts} from './drafts.js';
const {auth,ready}=account(true);install();const params=new URLSearchParams(location.search),id=params.get('ronda'),punto=params.get('punto');let ronda,point,pending=null,blob=null,gps=null,registered=false;
function wrap(ctx,text,max){const out=[];let line='';for(const word of String(text).split(/\s+/)){if(ctx.measureText(line+' '+word).width>max&&line){out.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)out.push(line);return out;}
async function base64(blob){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});}
function imageBlob(data){return new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/jpeg'});}
function preview(data){const img=$('preview');img.src='data:image/jpeg;base64,'+data;img.hidden=false;$('save').hidden=false;}
async function prepare(file){
 if(registered)throw Error('Este punto ya fue registrado.');if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error('Selecciona una imagen de hasta 20 MB.');
 const url=URL.createObjectURL(file),image=new Image();try{image.src=url;await image.decode();
 const scale=Math.min(1,1000/image.width,1500/image.height),w=Math.max(500,Math.round(image.width*scale)),h=Math.round(image.height*scale),canvas=document.createElement('canvas');
 let ctx=canvas.getContext('2d');ctx.font='22px Arial';const texts=['RONDA DE SEGURIDAD',`Ronda: ${ronda.tipoRonda}`,`Agente: ${ronda.agenteNombre}`,`Cargo: ${ronda.agenteCargo}`,`Turno: ${ronda.agenteTurno}`,`Punto: ${point.codigo} · ${point.nombre}`,`Captura en el dispositivo: ${fecha(Date.now())}`,`Dirección configurada: ${point.direccion||'Sin dirección'}`,...(gps?[`GPS declarado: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} · ±${Math.round(gps.precision)} m`]:[])];
 const lines=texts.flatMap(t=>wrap(ctx,t,w-40));canvas.width=w;canvas.height=h+40+lines.length*30;ctx=canvas.getContext('2d');ctx.fillStyle="#12243a";ctx.fillRect(0,0,canvas.width,canvas.height);const iw=Math.round(image.width*scale);ctx.drawImage(image,(w-iw)/2,0,iw,h);ctx.fillStyle='#12243a';ctx.fillRect(0,h,w,canvas.height-h);ctx.font='22px Arial';ctx.fillStyle='white';lines.forEach((t,i)=>ctx.fillText(t,20,h+30+i*30));
 let working=canvas;for(let resize=0;resize<5;resize++){
  for(const quality of [.84,.7,.56,.42]){blob=await new Promise(resolve=>working.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=300000)break;}
  if(blob?.size<=300000)break;const c=document.createElement('canvas');c.width=Math.round(working.width*.8);c.height=Math.round(working.height*.8);c.getContext('2d').drawImage(working,0,0,c.width,c.height);working=c;
 }
 if(!blob||blob.size>300000)throw Error('No se pudo comprimir la fotografía. Intenta con otra captura.');
 const foto=await base64(blob);pending={key:auth.currentUser.uid+'_'+id+'_'+punto,uid:auth.currentUser.uid,nombre:point.nombre,creado:Date.now(),payload:{rondaId:id,punto,foto,gps}};
 await saveDraft(pending);preview(foto);notice('Fotografía preparada y guardada como borrador en este dispositivo. Falta registrar el punto.');
 }finally{URL.revokeObjectURL(url);}
}
$('photo').onchange=()=>{const file=$('photo').files[0];if(file)busy($('save'),()=>prepare(file));};
$('gpsButton').onclick=()=>{if(!navigator.geolocation)return notice('GPS no disponible. Puedes continuar con la dirección del punto.');navigator.geolocation.getCurrentPosition(p=>{gps={lat:p.coords.latitude,lng:p.coords.longitude,precision:p.coords.accuracy};notice('Ubicación aproximada obtenida. Toma la fotografía para incluirla.');},()=>notice('No se obtuvo GPS. La dirección configurada sigue disponible.'),{enableHighAccuracy:true,timeout:10000,maximumAge:0});};
async function save(){if(!pending)throw Error('Primero toma una fotografía.');const result=await call(auth,'registrar',pending.payload);await deleteDraft(pending.key);registered=true;$('photo').disabled=true;$('save').hidden=true;$('share').hidden=false;$('next').hidden=false;notice(result.duplicado?'Este punto ya estaba registrado. No se duplicó.':'Punto y fotografía guardados correctamente.','success');$('next').textContent=result.ronda.estado==='COMPLETADA'?'Ronda completada · volver':'Continuar al siguiente QR';if(result.duplicado&&result.validacion?.evidenciaId){const e=await call(auth,'evidencia',{evidenciaId:result.validacion.evidenciaId});preview(e.base64);$('save').hidden=true;blob=imageBlob(e.base64);}}
$('save').onclick=()=>busy($('save'),save);
$('share').onclick=async()=>{try{if(!registered)throw Error('Registra primero el punto.');if(!blob)blob=imageBlob($('preview').src.split(',')[1]);const file=new File([blob],`ronda-${punto}.jpg`,{type:'image/jpeg'}),text=`Ronda ${ronda.tipoRonda}\n${ronda.agenteNombre} · ${ronda.agenteCargo} · ${ronda.agenteTurno}\n${point.nombre}\nDirección configurada: ${point.direccion||'No disponible'}\nFotografía guardada en el sistema.`;
 if(navigator.canShare?.({files:[file]}))await navigator.share({text,files:[file]});else{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);notice('Fotografía descargada. Puedes adjuntarla en WhatsApp.');}
 }catch(e){if(e.name!=='AbortError')showError(e);}};
$('next').onclick=()=>location.assign('/index.html');
ready().then(async u=>{if(!u){location.replace('/index.html');return;}if(!id||!punto)throw Error('Escanea primero el QR del punto.');pending=(await drafts(u.uid)).find(d=>d.payload.rondaId===id&&d.payload.punto===punto)||null;if(pending)preview(pending.payload.foto);
 const r=await call(auth,'ronda',{rondaId:id});ronda=r.ronda;point=ronda.ruta?.find(p=>p.codigo===punto);if(!point)throw Error('El punto no pertenece a esta ronda.');
 clear($('info'));line($('info'),'Agente:',ronda.agenteNombre);line($('info'),'Ronda:',ronda.tipoRonda);line($('info'),'Punto:',point.codigo+' · '+point.nombre);line($('info'),'Dirección configurada:',point.direccion||'No disponible');
 if(ronda.estado!=='EN_CURSO'||ronda.ruta[ronda.totalValidados]?.codigo!==punto){const d=await call(auth,'detalle',{rondaId:id});const v=d.validaciones.find(v=>v.puntoCodigo===punto);if(v?.evidenciaId){const ev=await call(auth,'evidencia',{evidenciaId:v.evidenciaId});preview(ev.base64);registered=true;$('photo').disabled=true;$('save').hidden=true;$('next').hidden=false;$('share').hidden=false;if(pending)await deleteDraft(pending.key);notice('Este punto ya está registrado. Se muestra la fotografía guardada.');return;}throw Error('Esta ronda está cerrada o espera otro QR.');}
 $('photo').disabled=false;
}).catch(showError);
