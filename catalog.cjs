const crypto=require('node:crypto');
const {fail,str,code,pointCode,cursor,route}=require('./domain.cjs');
const {admin,panel,current}=require('./access.cjs');
function catalog({db,auth,Timestamp}){
 const audit=(tx,a,action,id)=>tx.create(db.collection('auditoria').doc(),{uid:a.uid,rol:a.rol,accion:action,target:id,creadoEn:Timestamp.now()});
 async function points(a){admin(a);const s=await db.collection('puntos').limit(201).get();fail(s.size<=200,'Hay más de 200 puntos: requiere paginar el catálogo.');return {puntos:s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.tipoRonda.localeCompare(b.tipoRonda)||a.orden-b.orden)};}
 async function savePoint(a,b){
  admin(a);const id=pointCode(b.codigo),nombre=str(b.nombre,'Nombre'),direccion=str(b.direccion,'Dirección del punto',250),orden=Number(b.orden);
  fail(['INTERNA','EXTERNA'].includes(b.tipoRonda)&&['INICIO','PUNTO','FINAL'].includes(b.funcionQR),'Tipo o función inválidos.');
  fail(Number.isInteger(orden)&&orden>=1&&orden<=100,'Orden inválido.');fail(b.funcionQR!=='INICIO'||orden===1,'INICIO debe tener orden 1.');
  return db.runTransaction(async tx=>{
   await current(tx,db,a);const ref=db.doc('puntos/'+id),old=await tx.get(ref),guard=db.doc('control/catalogoPuntos');await tx.get(guard);
   const all=await tx.get(db.collection('puntos'));const activo=b.activo!==false;
   if(!old.exists)fail(all.size<200,'Máximo 200 puntos.');
   if(activo)for(const d of all.docs){if(d.id===id)continue;const p=d.data();if(p.activo&&p.tipoRonda===b.tipoRonda){fail(p.orden!==orden,'Ese orden ya está ocupado.');if(b.funcionQR!=='PUNTO')fail(p.funcionQR!==b.funcionQR,'Ya existe un '+b.funcionQR+' activo.');}}
   const data={codigo:id,nombre,direccion,orden,tipoRonda:b.tipoRonda,funcionQR:b.funcionQR,activo,creadoEn:old.data()?.creadoEn||Timestamp.now(),actualizadoEn:Timestamp.now()};
   tx.set(ref,data);tx.set(guard,{actualizadoEn:Timestamp.now()});audit(tx,a,'GUARDAR_PUNTO',id);return {ok:true};
  });
 }
 async function checkRoutes(a){admin(a);const {puntos}=await points(a);return {rutas:['EXTERNA','INTERNA'].map(tipo=>{try{return {tipo,ok:true,total:route(puntos.filter(p=>p.tipoRonda===tipo)).length};}catch(e){return {tipo,ok:false,error:e.message};}})};}
 async function agents(a){panel(a);const s=await db.collection('agentes').limit(501).get();fail(s.size<=500,'Catálogo de agentes demasiado grande.');return {agentes:s.docs.map(d=>a.rol==='ADMIN'?{id:d.id,...d.data()}:{id:d.id,nombre:d.data().nombre,turno:d.data().turno})};}
 async function saveAgent(a,b){
  admin(a);const id=code(b.codigo),nombre=str(b.nombre,'Nombre'),cargo=str(b.cargo,'Cargo');fail(['Día','Noche'].includes(b.turno),'Selecciona Día o Noche.');
  let uid;
  await db.runTransaction(async tx=>{
   await current(tx,db,a);const ref=db.doc('agentes/'+id),s=await tx.get(ref);uid=s.data()?.uid||null;
   if(uid)await tx.get(db.doc('usuarios/'+uid));
   const t=Timestamp.now();tx.set(ref,{...(s.data()||{}),codigo:id,nombre,cargo,turno:b.turno,activo:b.activo!==false,creadoEn:s.data()?.creadoEn||t,actualizadoEn:t});
   if(uid)tx.set(db.doc('usuarios/'+uid),{activo:b.activo!==false,actualizadoEn:t},{merge:true});audit(tx,a,'GUARDAR_AGENTE',id);
  });
  if(uid){try{await auth.updateUser(uid,{disabled:b.activo===false});if(b.activo===false)await auth.revokeRefreshTokens(uid);}catch{ return {ok:true,aviso:'Datos guardados. No se pudo sincronizar Authentication; vuelve a guardar el agente. El permiso de la base de datos ya está actualizado.'};}}
  return {ok:true};
 }
 async function credential(a,b){
  admin(a);const id=code(b.codigo),ref=db.doc('agentes/'+id),s=await ref.get();fail(s.exists,'Primero registra al agente.');
  const uid='agente_'+id,email=id+'@agentes.rondas.invalid',password=crypto.randomBytes(15).toString('base64url');
  fail(!s.data().uid||s.data().uid===uid,'Este agente usa una vinculación distinta. Revisión manual necesaria.',409);
  try{const existing=await auth.getUser(uid);fail(existing.email===email,'Identidad de acceso incompatible.',409);await auth.updateUser(uid,{password,disabled:!s.data().activo});await auth.revokeRefreshTokens(uid);}catch(e){if(e.code==='auth/user-not-found')await auth.createUser({uid,email,password,displayName:s.data().nombre,disabled:!s.data().activo});else throw e;}
  await db.runTransaction(async tx=>{await current(tx,db,a);const ag=await tx.get(ref),us=await tx.get(db.doc('usuarios/'+uid));fail(ag.exists,'El agente ya no existe.');fail(!us.exists||us.data().rol==='AGENTE','Cuenta reservada para otro rol.',409);const t=Timestamp.now();tx.update(ref,{uid,actualizadoEn:t});tx.set(db.doc('usuarios/'+uid),{rol:'AGENTE',agenteId:id,activo:ag.data().activo,correo:email,actualizadoEn:t});audit(tx,a,'RENOVAR_ACCESO_AGENTE',id);});
  return {codigo:id,password,mensaje:'Entrega esta contraseña al agente por un canal privado. No se guarda en texto en la base de datos.'};
 }
 async function users(a){admin(a);const s=await db.collection('usuarios').where('rol','in',['ADMIN','CLIENTE']).limit(101).get();fail(s.size<=100,'Máximo 100 usuarios de panel.');return {usuarios:s.docs.map(d=>({id:d.id,...d.data()}))};}
 async function saveUser(a,b){
  admin(a);fail(['ADMIN','CLIENTE'].includes(b.rol),'Rol inválido.');let uid=b.uid?cursor(b.uid):null,password=null,email;
  if(!uid){email=str(b.correo,'Correo',254).toLowerCase();fail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!email.endsWith('@agentes.rondas.invalid'),'Correo inválido.');password=crypto.randomBytes(15).toString('base64url');
   try{const existing=await auth.getUserByEmail(email);uid=existing.uid;password=null;}catch(e){if(e.code!=='auth/user-not-found')throw e;const created=await auth.createUser({email,password});uid=created.uid;}
  }
  await db.runTransaction(async tx=>{await current(tx,db,a);const ref=db.doc('usuarios/'+uid),old=await tx.get(ref),admins=await tx.get(db.collection('usuarios').where('rol','==','ADMIN'));
   fail(!old.exists||old.data().rol!=='AGENTE','La cuenta pertenece a un agente.');
   fail(uid!==a.uid||(b.rol==='ADMIN'&&b.activo!==false),'No puedes quitarte tu propio acceso administrativo.');
   if(old.data()?.rol==='ADMIN'&&old.data()?.activo&&(b.rol!=='ADMIN'||b.activo===false))fail(admins.docs.filter(d=>d.data().activo).length>1,'Debe quedar un administrador activo.');
   tx.set(ref,{correo:email||old.data()?.correo||'',rol:b.rol,activo:b.activo!==false,actualizadoEn:Timestamp.now()});audit(tx,a,'GUARDAR_USUARIO',uid);
  });
  // Firestore controla el acceso inmediatamente; no deshabilitamos una cuenta global
  // que pudiera utilizar otras aplicaciones del mismo proyecto.
  if(b.activo===false)await auth.revokeRefreshTokens(uid);
  return {ok:true,uid,password};
 }
 async function resetPanel(a,b){admin(a);const uid=cursor(b.uid);fail(uid&&uid!==a.uid,'Usa la recuperación de contraseña para tu propia cuenta.');const s=await db.doc('usuarios/'+uid).get();fail(s.exists&&['ADMIN','CLIENTE'].includes(s.data().rol),'Cuenta no válida.');const password=crypto.randomBytes(15).toString('base64url');await auth.updateUser(uid,{password});await auth.revokeRefreshTokens(uid);await db.collection('auditoria').add({uid:a.uid,accion:'RENOVAR_CLAVE_PANEL',target:uid,creadoEn:Timestamp.now()});return {password};}
 return {points,savePoint,checkRoutes,agents,saveAgent,credential,users,saveUser,resetPanel};
}
module.exports={catalog};
