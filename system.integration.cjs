const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
process.env.FIREBASE_PROJECT_ID='demo-rondas';
const {services}=require('../lib/firebase.cjs');const {makeHandler}=require('../lib/api.cjs');const {push}=require('../lib/push.cjs');
const {engine}=require('../lib/rounds.cjs');
const s=services(),{db,auth,Timestamp}=s;let sends=0,failSend=false;
const messaging={send:async()=>{sends++;if(failSend)throw Object.assign(Error('simulado'),{code:'messaging/internal-error'});return 'message';}};
const handler=makeHandler(()=>({...s,messaging}));let tokens={};
const photo=fs.readFileSync('tests/fixtures/evidencia.jpg').toString('base64');
async function api(uid,accion,body={}){const req={method:'POST',headers:{'content-type':'application/json',...(uid?{authorization:'Bearer '+tokens[uid]}:{})},body:{accion,...body}};const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(o){this.body=o;return this;}};await handler(req,res);return res;}
async function ok(uid,action,b){const r=await api(uid,action,b);assert.equal(r.statusCode,200,JSON.stringify(r.body));return r.body;}
async function seed(){
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-rondas/databases/(default)/documents',{method:'DELETE'});
 for(const [uid,rol,agenteId]of [['admin','ADMIN'],['client','CLIENTE'],['agente_001','AGENTE','001'],['agente_002','AGENTE','002']]){
  try{await auth.createUser({uid,email:uid+'@test.invalid',password:'Test-Password-12345'});}catch{}
  await db.doc('usuarios/'+uid).set({rol,activo:true,correo:uid+'@test.invalid',...(agenteId?{agenteId}:{})});
  if(agenteId)await db.doc('agentes/'+agenteId).set({uid,codigo:agenteId,nombre:'Agente '+agenteId,cargo:'Vigilante',turno:'Día',activo:true});
  const custom=await auth.createCustomToken(uid),r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:custom,returnSecureToken:true})});tokens[uid]=(await r.json()).idToken;
 }
 for(const [i,f]of [[1,'INICIO'],[2,'PUNTO'],[3,'FINAL']])await db.doc('puntos/P0'+i).set({codigo:'P0'+i,nombre:'Punto '+i,direccion:'Lima',orden:i,funcionQR:f,tipoRonda:'EXTERNA',activo:true});
}
test('Flujos reales con Firestore y Authentication emulados',async t=>{
 await seed();let id;
 await t.test('anónimo bloqueado; CLIENTE no puede iniciar ni editar catálogos',async()=>{assert.equal((await api(null,'rondas')).statusCode,401);assert.equal((await api('client','iniciar',{punto:'P01',requestId:'request-0000000001'})).statusCode,403);assert.equal((await api('client','guardar-agente',{codigo:'003'})).statusCode,403);});
 await t.test('CLIENTE consulta agentes sin identidad de acceso; AGENTE solo obtiene su perfil',async()=>{
  const r=await ok('client','agentes');assert.equal(r.agentes.length,2);assert.deepEqual(r.agentes[0],{id:'001',nombre:'Agente 001',cargo:'Vigilante',turno:'Día',activo:true});
  assert.equal((await api('client','credencial-agente',{codigo:'001'})).statusCode,403);
  const me=await ok('agente_001','me');assert.deepEqual(me.agente,{codigo:'001',nombre:'Agente 001',cargo:'Vigilante',turno:'Día'});assert.equal((await api('agente_001','agentes')).statusCode,403);
 });
 await t.test('inicio concurrente solo crea una ronda activa',async()=>{const r=await Promise.all([ok('agente_001','iniciar',{punto:'P01',requestId:'request-0000000001'}),ok('agente_001','iniciar',{punto:'P01',requestId:'request-0000000002'})]);assert.equal(r[0].ronda.id,r[1].ronda.id);id=r[0].ronda.id;assert.equal((await db.collection('rondas').get()).size,1);assert.equal((await db.collection('eventosPush').get()).size,1);});
 await t.test('agente ajeno no puede leer, cancelar ni registrar',async()=>{for(const action of ['ronda','cancelar','registrar'])assert.equal((await api('agente_002',action,{rondaId:id,punto:'P01',foto:photo,motivo:'Prueba'})).statusCode,403);});
 await t.test('no permite FINAL adelantado ni una foto inválida',async()=>{assert.equal((await api('agente_001','registrar',{rondaId:id,punto:'P03',foto:photo})).statusCode,409);assert.equal((await api('agente_001','registrar',{rondaId:id,punto:'P01',foto:'mal'})).statusCode,400);assert.equal((await db.collection(`rondas/${id}/validaciones`).get()).size,0);});
 await t.test('doble envío guarda una evidencia y una validación',async()=>{const r=await Promise.all([ok('agente_001','registrar',{rondaId:id,punto:'P01',foto:photo}),ok('agente_001','registrar',{rondaId:id,punto:'P01',foto:photo})]);assert(r.some(x=>x.duplicado));assert.equal((await db.doc('rondas/'+id).get()).data().totalValidados,1);assert.equal((await db.collection('evidencias').get()).size,1);assert.equal((await db.collection(`rondas/${id}/validaciones`).get()).size,1);});
 await t.test('ruta histórica permanece al editar catálogo',async()=>{await ok('admin','guardar-punto',{codigo:'P02',nombre:'Nombre nuevo',direccion:'Otra dirección',orden:2,funcionQR:'PUNTO',tipoRonda:'EXTERNA',activo:true});const r=await ok('agente_001','ronda',{rondaId:id});assert.equal(r.ronda.ruta[1].nombre,'Punto 2');});
 await t.test('punto inactivo no se valida, al habilitarlo se completa',async()=>{await db.doc('puntos/P02').update({activo:false});assert.equal((await api('agente_001','registrar',{rondaId:id,punto:'P02',foto:photo})).statusCode,409);await db.doc('puntos/P02').update({activo:true});await ok('agente_001','registrar',{rondaId:id,punto:'P02',foto:photo});const r=await ok('agente_001','registrar',{rondaId:id,punto:'P03',foto:photo});assert.equal(r.ronda.estado,'COMPLETADA');assert.equal(r.ronda.totalValidados,3);assert(!((await db.doc('rondasActivas/agente_001').get()).exists));});
 await t.test('reintento tras cierre es idempotente; no permite cancelar completada',async()=>{assert((await ok('agente_001','registrar',{rondaId:id,punto:'P03',foto:photo})).duplicado);assert.equal((await api('agente_001','cancelar',{rondaId:id,motivo:'No'})).statusCode,409);assert.equal((await db.collection(`rondas/${id}/validaciones`).get()).size,3);});
 await t.test('reintento de inicio concurrente conserva la ronda original tras cierre',async()=>{const r=await ok('agente_001','iniciar',{punto:'P01',requestId:'request-0000000002'});assert.equal(r.ronda.id,id);assert.equal(r.ronda.estado,'COMPLETADA');});
 await t.test('panel recupera foto privada; otro agente no',async()=>{const e=await ok('client','evidencia',{evidenciaId:id+'_001'});assert.equal(e.base64,photo);assert.equal((await api('agente_002','evidencia',{evidenciaId:id+'_001'})).statusCode,403);});
 await t.test('archivo preserva evidencias y bitácora; CLIENTE no archiva',async()=>{assert.equal((await api('client','archivar',{rondaId:id,motivo:'Prueba'})).statusCode,403);await ok('admin','archivar',{rondaId:id,motivo:'Corrección de prueba'});assert.equal((await db.collection(`rondas/${id}/validaciones`).get()).size,3);assert((await db.collection('auditoria').where('accion','==','ARCHIVAR_RONDA').get()).size===1);assert.equal((await ok('client','rondas',{})).rondas.length,0);assert.equal((await ok('admin','rondas',{archivadas:true})).rondas.length,1);});
 await t.test('un usuario no puede quitar el dispositivo de otro',async()=>{const d=await ok('admin','push-registrar',{token:'token-ficticio-administrador-0000000'});assert.equal((await api('client','push-quitar',{deviceId:d.deviceId})).statusCode,403);await ok('admin','push-quitar',{deviceId:d.deviceId});assert(!(await db.doc('dispositivosPush/'+d.deviceId).get()).exists);});
 await t.test('FCM fallido se reintenta; usuario deshabilitado no recibe',async()=>{
  await ok('client','push-registrar',{token:'token-ficticio-cliente-000000000'});const r=await ok('agente_002','iniciar',{punto:'P01',requestId:'request-0000000003'});const event=db.doc('eventosPush/'+r.ronda.id+'_INCOMPLETA');
  failSend=true;await ok('agente_002','cancelar',{rondaId:r.ronda.id,motivo:'<img src=x onerror=alert(1)> prueba de texto'});assert.equal((await event.get()).data().estado,'PENDIENTE');const before=sends;
  failSend=false;await event.update({nextAttemptAt:Timestamp.fromMillis(0)});await push({...s,messaging}).pending();assert(sends>before);assert.equal((await event.get()).data().estado,'ENVIADO');
  await db.doc('usuarios/client').update({activo:false});const b=sends;const n=await ok('agente_002','iniciar',{punto:'P01',requestId:'request-0000000004'});assert.equal(sends,b);assert(n.ronda.id);
 });
 await t.test('agente deshabilitado pierde permiso con token antiguo',async()=>{await db.doc('agentes/002').update({activo:false});assert.equal((await api('agente_002','activa')).statusCode,403);});
 await t.test('paginación y filtros no repiten documentos',async()=>{for(let i=0;i<25;i++)await db.doc('rondas/pagina_'+i).set({schemaVersion:1,archivada:false,inicioTimestamp:Timestamp.fromMillis(100000+i),agenteId:'099',agenteTurno:'Noche',tipoRonda:'INTERNA',estado:'COMPLETADA'});let cursor=null,ids=[];do{const r=await ok('admin','rondas',{agenteId:'099',agenteTurno:'Noche',tipoRonda:'INTERNA',estado:'COMPLETADA',cursor});assert(r.rondas.length<=10);ids.push(...r.rondas.map(x=>x.id));cursor=r.siguiente;}while(cursor);assert.equal(ids.length,25);assert.equal(new Set(ids).size,25);});
 await t.test('no permite quitar el propio acceso ADMIN',async()=>{assert.equal((await api('admin','guardar-usuario',{uid:'admin',rol:'CLIENTE',activo:true})).statusCode,400);});
});
