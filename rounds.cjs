const {fail,str,pointCode,route,assertStep,digest,millis,duration,jpeg,coordinates,cursor}=require('./domain.cjs');
const {agent,panel,admin,current}=require('./access.cjs');
function engine({db,Timestamp}){
 const now=()=>Timestamp.now();
 const event=(tx,id,tipo,r,t)=>tx.create(db.doc(`eventosPush/${id}_${tipo}`),{rondaId:id,tipoEvento:tipo,agenteNombre:r.agenteNombre,tipoRonda:r.tipoRonda,duracionSegundos:r.duracionSegundos||0,creadoEn:t,nextAttemptAt:t,estado:'PENDIENTE',intentos:0,leaseUntil:Timestamp.fromMillis(0),motivo:r.motivoCancelacion||''});
 const log=(tx,a,accion,target,t,extra={})=>tx.create(db.collection('auditoria').doc(),{uid:a.uid,rol:a.rol,accion,target,creadoEn:t,...extra});
 async function start(a,b){
  agent(a);const codigo=pointCode(b.punto),requestId=str(b.requestId,'Identificador',80);
  fail(/^[a-zA-Z0-9_-]{16,80}$/.test(requestId),'Identificador de inicio inválido.');
  const id=digest(a.uid+':'+requestId).slice(0,32),ref=db.doc('rondas/'+id),lock=db.doc('rondasActivas/'+a.uid);
  return db.runTransaction(async tx=>{
   const ag=await current(tx,db,a),old=await tx.get(ref),ls=await tx.get(lock),requestRef=db.doc('solicitudesInicio/'+id),alias=await tx.get(requestRef);
   if(alias.exists){const previous=await tx.get(db.doc('rondas/'+alias.data().rondaId));fail(previous.exists,'La ronda de este inicio ya no está disponible.',409);return {ronda:{id:previous.id,...previous.data()},duplicado:true};}
   if(old.exists){fail(old.data().agenteUid===a.uid,'Ronda ajena.',403);return {ronda:{id,...old.data()},duplicado:true};}
   if(ls.exists){const existing=await tx.get(db.doc('rondas/'+ls.data().rondaId));if(existing.exists&&existing.data().estado==='EN_CURSO'&&!existing.data().archivada){tx.set(requestRef,{uid:a.uid,rondaId:existing.id,creadoEn:now()});return {ronda:{id:existing.id,...existing.data()},recuperada:true};}}
   const p=await tx.get(db.doc('puntos/'+codigo));fail(p.exists&&p.data().activo&&p.data().funcionQR==='INICIO','Escanea un QR de INICIO activo.');
   const ps=await tx.get(db.collection('puntos').where('tipoRonda','==',p.data().tipoRonda));
   const ruta=route(ps.docs.map(x=>({codigo:x.id,...x.data()})));fail(ruta[0].codigo===codigo,'Este no es el inicio de la ruta.');
   const t=now(),r={schemaVersion:2,agenteUid:a.uid,agenteId:a.agenteId,agenteNombre:ag.nombre,agenteCargo:ag.cargo,agenteTurno:ag.turno,tipoRonda:p.data().tipoRonda,estado:'EN_CURSO',inicioQrCodigo:codigo,inicioTimestamp:t,horaInicioLocal:new Date(t.toMillis()).toISOString(),totalValidados:0,ultimoOrden:0,ultimoPuntoCodigo:null,ruta,rutaVersion:digest(JSON.stringify(ruta)),archivada:false,actualizadoEn:t};
   tx.create(ref,r);tx.set(requestRef,{uid:a.uid,rondaId:id,creadoEn:t});tx.set(lock,{rondaId:id,creadoEn:t});event(tx,id,'INICIO',r,t);return {ronda:{id,...r},eventoId:id+'_INICIO'};
  });
 }
 async function active(a){agent(a);const s=await db.doc('rondasActivas/'+a.uid).get();if(!s.exists)return {ronda:null};const r=await db.doc('rondas/'+s.data().rondaId).get();return {ronda:r.exists&&r.data().agenteUid===a.uid&&r.data().estado==='EN_CURSO'&&!r.data().archivada?{id:r.id,...r.data()}:null};}
 async function get(a,b){const id=cursor(b.rondaId);fail(id,'Falta la ronda.');const s=await db.doc('rondas/'+id).get();fail(s.exists,'Ronda no encontrada.',404);const r=s.data();if(a.rol==='AGENTE')fail(r.agenteUid===a.uid&&!r.archivada,'Ronda no autorizada.',403);else {panel(a);fail(a.rol==='ADMIN'||!r.archivada,'Ronda archivada.',403);}return {ronda:{id,...r}};}
 async function step(a,b){
  agent(a);const id=cursor(b.rondaId),codigo=pointCode(b.punto);fail(id,'Falta la ronda.');
  const photo=jpeg(b.foto),gps=coordinates(b.gps),ref=db.doc('rondas/'+id);
  return db.runTransaction(async tx=>{
   await current(tx,db,a);const snap=await tx.get(ref);fail(snap.exists,'Ronda no encontrada.',404);const r=snap.data();
   fail(r.agenteUid===a.uid,'Ronda ajena.',403);fail(!r.archivada,'Ronda archivada.',409);
   const p=r.ruta?.find(p=>p.codigo===codigo);fail(p,'QR no pertenece a esta ronda.');
   const key=String(p.orden).padStart(3,'0'),valRef=ref.collection('validaciones').doc(key),prev=await tx.get(valRef);
   if(prev.exists)return {ronda:{id,...r},validacion:{id:key,...prev.data()},duplicado:true};
   const expected=assertStep(r,codigo,a),point=await tx.get(db.doc('puntos/'+codigo));
   fail(point.exists&&point.data().activo===true,'El punto está desactivado. Contacta al administrador.',409);
   const t=now(),final=expected.funcionQR==='FINAL',total=r.totalValidados+1;
   fail(!final||total===r.ruta.length,'Faltan puntos antes del FINAL.',409);
   const evId=id+'_'+key,v={puntoId:codigo,puntoCodigo:codigo,puntoNombre:expected.nombre,tipoRonda:r.tipoRonda,funcionQR:expected.funcionQR,orden:expected.orden,direccion:expected.direccion,gps,metodoValidacion:'CODIGO_QR',qrValidado:true,evidenciaId:evId,evidenciaSha256:photo.sha256,evidenciaBytes:photo.bytes.length,timestamp:t,agenteUid:a.uid};
   const changes={ultimoOrden:expected.orden,ultimoPuntoCodigo:codigo,totalValidados:total,actualizadoEn:t};
   if(final)Object.assign(changes,{estado:'COMPLETADA',finTimestamp:t,horaFinLocal:new Date(t.toMillis()).toISOString(),duracionSegundos:duration(r.inicioTimestamp,t)});
   tx.create(valRef,v);tx.create(db.doc('evidencias/'+evId),{rondaId:id,agenteUid:a.uid,bytes:photo.bytes,mime:'image/jpeg',sha256:photo.sha256,width:photo.width,height:photo.height,creadoEn:t});
   tx.update(ref,changes);if(final){tx.delete(db.doc('rondasActivas/'+a.uid));event(tx,id,'COMPLETADA',{...r,...changes},t);}
   return {ronda:{id,...r,...changes},validacion:{id:key,...v},eventoId:final?id+'_COMPLETADA':null};
  });
 }
 async function cancel(a,b){
  agent(a);const id=cursor(b.rondaId),motivo=str(b.motivo,'Motivo',500);fail(id,'Falta ronda.');
  return db.runTransaction(async tx=>{
   await current(tx,db,a);const ref=db.doc('rondas/'+id),s=await tx.get(ref);fail(s.exists,'Ronda no encontrada.',404);const r=s.data();
   fail(r.agenteUid===a.uid,'Ronda ajena.',403);fail(!r.archivada,'Ronda archivada.',409);
   if(r.estado==='INCOMPLETA')return {duplicado:true};fail(r.estado==='EN_CURSO','Esta ronda ya finalizó.',409);
   const t=now(),changes={estado:'INCOMPLETA',cancelacionTimestamp:t,horaCancelacionLocal:new Date(t.toMillis()).toISOString(),duracionSegundos:duration(r.inicioTimestamp,t),motivoCancelacion:motivo,actualizadoEn:t};
   tx.update(ref,changes);tx.delete(db.doc('rondasActivas/'+a.uid));event(tx,id,'INCOMPLETA',{...r,...changes},t);return {eventoId:id+'_INCOMPLETA'};
  });
 }
 async function archive(a,b){
  admin(a);const id=cursor(b.rondaId),motivo=str(b.motivo,'Motivo de archivo',500);fail(id,'Falta ronda.');
  return db.runTransaction(async tx=>{await current(tx,db,a);const ref=db.doc('rondas/'+id),s=await tx.get(ref);fail(s.exists,'Ronda no encontrada.',404);const r=s.data();if(r.archivada)return {duplicado:true};fail(r.estado!=='EN_CURSO','Primero debe cerrarse la ronda.',409);const t=now();tx.update(ref,{archivada:true,archivadaPor:a.uid,archivadaEn:t,motivoArchivo:motivo});log(tx,a,'ARCHIVAR_RONDA',id,t,{motivo});return {ok:true};});
 }
 async function closeLegacy(a,b){admin(a);const id=cursor(b.rondaId),motivo=str(b.motivo,'Motivo',500);fail(id,'Falta ronda.');return db.runTransaction(async tx=>{await current(tx,db,a);const ref=db.doc('rondas/'+id),s=await tx.get(ref);fail(s.exists,'Ronda no encontrada.',404);const r=s.data();fail(r.estado==='EN_CURSO','La ronda no está en curso.',409);const t=now(),changes={estado:'INCOMPLETA',motivoCancelacion:motivo,cancelacionTimestamp:t,duracionSegundos:duration(r.inicioTimestamp,t),cerradaPor:a.uid};tx.update(ref,changes);if(r.agenteUid)tx.delete(db.doc('rondasActivas/'+r.agenteUid));log(tx,a,'CERRAR_RONDA',id,t,{motivo});event(tx,id,'INCOMPLETA',{...r,...changes},t);return {eventoId:id+'_INCOMPLETA'};});}
 async function history(a,b){
  panel(a);let q=db.collection('rondas').where('archivada','==',b.archivadas===true&&a.rol==='ADMIN');
  for(const k of ['agenteId','agenteTurno','tipoRonda','estado'])if(b[k])q=q.where(k,'==',str(b[k],k,80));
  for(const [k,op,suffix] of [['desde','>=','T00:00:00-05:00'],['hasta','<=','T23:59:59.999-05:00']])if(b[k]){fail(/^\d{4}-\d{2}-\d{2}$/.test(b[k])&&Number.isFinite(Date.parse(b[k]+suffix)),'Fecha inválida.');q=q.where('inicioTimestamp',op,Timestamp.fromMillis(Date.parse(b[k]+suffix)));}
  q=q.orderBy('inicioTimestamp','desc').orderBy('__name__','desc');
  const after=cursor(b.cursor);if(after){const last=await db.doc('rondas/'+after).get();fail(last.exists&&last.data().inicioTimestamp,'Cursor caducado. Recarga la lista.');q=q.startAfter(last);}
  const s=await q.limit(11).get(),page=s.docs.slice(0,10);return {rondas:page.map(d=>({id:d.id,...d.data()})),siguiente:s.docs.length>10?page.at(-1).id:null};
 }
 async function details(a,b){const {ronda}=await get(a,b),s=await db.collection(`rondas/${ronda.id}/validaciones`).orderBy('orden').limit(101).get();return {ronda,validaciones:s.docs.map(d=>({id:d.id,...d.data()}))};}
 async function evidence(a,b){const id=cursor(b.evidenciaId);fail(id,'Falta evidencia.');const s=await db.doc('evidencias/'+id).get();fail(s.exists,'No hay fotografía guardada para esta validación.',404);const e=s.data();await get(a,{rondaId:e.rondaId});return {mime:e.mime,base64:e.bytes.toString('base64')};}
 return {start,active,get,step,cancel,archive,closeLegacy,history,details,evidence,log};
}
module.exports={engine};
