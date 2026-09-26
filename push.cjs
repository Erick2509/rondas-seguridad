const crypto=require('node:crypto');
const {fail,str,digest,millis}=require('./domain.cjs');
const {panel,admin,current}=require('./access.cjs');
function push({db,Timestamp,messaging}){
 async function register(a,b){panel(a);const token=str(b.token,'Token',4096);fail(token.length>20,'Token inválido.');const hash=digest(token),id=a.uid+'_'+hash;
  await db.runTransaction(async tx=>{await current(tx,db,a);const s=await tx.get(db.collection('dispositivosPush').where('uid','==',a.uid));const ref=db.doc('dispositivosPush/'+id);fail(s.size<10||s.docs.some(d=>d.id===id),'Máximo 10 dispositivos por cuenta. Cierra una sesión antigua.');tx.set(ref,{schemaVersion:2,uid:a.uid,rol:a.rol,token,activo:true,actualizadoEn:Timestamp.now()});});return {deviceId:id};}
 async function unregister(a,b){panel(a);const id=str(b.deviceId,'Dispositivo',200),ref=db.doc('dispositivosPush/'+id);await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)return;fail(s.data().uid===a.uid,'Dispositivo ajeno.',403);tx.delete(ref);});return {ok:true};}
 async function processOne(id){
  const ref=db.doc('eventosPush/'+id),owner=crypto.randomUUID(),t=Timestamp.now();
  const data=await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)return null;const e=s.data();if(e.estado!=='PENDIENTE'||millis(e.leaseUntil)>t.toMillis()||millis(e.nextAttemptAt)>t.toMillis())return null;tx.update(ref,{leaseOwner:owner,leaseUntil:Timestamp.fromMillis(t.toMillis()+90000),nextAttemptAt:Timestamp.fromMillis(t.toMillis()+90000),intentos:(e.intentos||0)+1});return {...e,intentos:(e.intentos||0)+1};});
  if(!data)return {omitido:true};
  let retry=false;try{
   const devices=await db.collection('dispositivosPush').where('activo','==',true).limit(1001).get();fail(devices.size<=1000,'Demasiados dispositivos para un lote.',503);
   const byToken=new Map();for(const d of devices.docs){const x=d.data();if(typeof x.token!=='string'||typeof x.uid!=='string')continue;const u=await db.doc('usuarios/'+x.uid).get();if(!u.exists||!u.data().activo||!['ADMIN','CLIENTE'].includes(u.data().rol))continue;byToken.set(x.token,d);}
   let count=0;
   for(const [token,d] of byToken){
    const receipt=ref.collection('entregas').doc(digest(token)),old=await receipt.get();if(old.exists&&['ENVIADA','DESCARTADA'].includes(old.data().estado))continue;
    // Revalidar el dispositivo y el destinatario lo más cerca posible del envío.
    const fresh=await d.ref.get();if(!fresh.exists||!fresh.data().activo||fresh.data().token!==token)continue;
    const u=await db.doc('usuarios/'+fresh.data().uid).get();if(!u.exists||!u.data().activo||!['ADMIN','CLIENTE'].includes(u.data().rol))continue;
    // Acotar el trabajo por ejecución y continuar desde recibos persistidos.
    if(++count>100){retry=true;break;}
    const title=data.tipoEvento==='INICIO'?'🟢 Ronda iniciada':data.tipoEvento==='COMPLETADA'?'✅ Ronda completada':'🔴 Ronda incompleta';
    const body=`${data.agenteNombre} · ${data.tipoRonda}${data.tipoEvento==='COMPLETADA'?' · '+data.duracionSegundos+' s':''}`;
    try{
     await messaging.send({token,data:{title,body,eventId:id,url:'/admin.html'},webpush:{headers:{TTL:'3600',Urgency:'normal'}}});
     await receipt.set({estado:'ENVIADA',enviadoEn:Timestamp.now()});
    }catch(e){
     const permanent=['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(e.code);
     if(permanent){await receipt.set({estado:'DESCARTADA',codigo:e.code,actualizadoEn:Timestamp.now()});await d.ref.delete();}
     else{retry=true;await receipt.set({estado:'REINTENTAR',codigo:e.code||'error-transitorio',actualizadoEn:Timestamp.now()});}
    }
   }
  }catch(e){retry=true;console.error('push_batch',e.code||e.message);}
  await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists||s.data().leaseOwner!==owner)return;const attempts=s.data().intentos;
   tx.update(ref,{estado:retry?(attempts>=12?'FALLIDO':'PENDIENTE'):'ENVIADO',leaseUntil:Timestamp.fromMillis(0),leaseOwner:null,actualizadoEn:Timestamp.now(),nextAttemptAt:Timestamp.fromMillis(Date.now()+Math.min(3600000,15000*2**Math.min(attempts,8)))});
  });return {procesado:true,reintentar:retry};
 }
 async function pending(){const s=await db.collection('eventosPush').where('estado','==','PENDIENTE').where('nextAttemptAt','<=',Timestamp.now()).orderBy('nextAttemptAt').limit(5).get();for(const d of s.docs)await processOne(d.id);return {procesados:s.size};}
 async function status(a){admin(a);const s=await db.collection('eventosPush').orderBy('creadoEn','desc').limit(30).get();return {eventos:s.docs.map(d=>({id:d.id,tipo:d.data().tipoEvento,estado:d.data().estado,intentos:d.data().intentos,creadoEn:d.data().creadoEn}))};}
 async function retry(a,b){admin(a);const id=str(b.eventoId,'Evento',160);fail(/^[A-Za-z0-9_-]+$/.test(id),'Evento inválido.');await db.runTransaction(async tx=>{await current(tx,db,a);const ref=db.doc('eventosPush/'+id),s=await tx.get(ref);fail(s.exists,'Evento no encontrado.',404);fail(['FALLIDO','PENDIENTE'].includes(s.data().estado),'El evento ya fue procesado.',409);fail(millis(s.data().leaseUntil)<=Date.now(),'Hay un envío en curso.',409);tx.update(ref,{estado:'PENDIENTE',intentos:0,nextAttemptAt:Timestamp.now(),leaseUntil:Timestamp.fromMillis(0)});});return processOne(id);}
 return {register,unregister,processOne,pending,status,retry};
}
module.exports={push};
