const {test}=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),fs=require('node:fs');
process.env.FIREBASE_PROJECT_ID='demo-rondas';
const {db,Timestamp}=require('../lib/firebase.cjs').services();
test('migración: simulación no escribe, aplica sin borrar y se puede repetir',async()=>{
 await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-rondas/databases/(default)/documents',{method:'DELETE'});
 await db.doc('rondas/legacy').set({estado:'EN_CURSO',timestamp:Timestamp.fromMillis(123456),agenteNombre:'Antiguo'});
 await db.doc('rondas/legacy/validaciones/v1').set({puntoNombre:'Punto conservado'});
 await db.doc('rondas/new').set({schemaVersion:2,estado:'EN_CURSO',inicioTimestamp:Timestamp.now(),archivada:false});
 await db.doc('dispositivosPush/old').set({activo:true,token:'anterior'});await db.doc('dispositivosPush/new').set({schemaVersion:2,activo:true,token:'nuevo'});
 execFileSync(process.execPath,['scripts/migrar.cjs'],{env:process.env});assert.equal((await db.doc('rondas/legacy').get()).data().schemaVersion,undefined);
 execFileSync(process.execPath,['scripts/migrar.cjs','--apply','--cerrar-antiguas'],{env:process.env});
 const r=(await db.doc('rondas/legacy').get()).data();assert.equal(r.schemaVersion,1);assert.equal(r.inicioTimestamp.toMillis(),123456);assert.equal(r.estado,'INCOMPLETA');assert((await db.doc('rondas/legacy/validaciones/v1').get()).exists);assert.equal((await db.doc('rondas/new').get()).data().estado,'EN_CURSO');assert.equal((await db.doc('dispositivosPush/old').get()).data().activo,false);assert.equal((await db.doc('dispositivosPush/new').get()).data().activo,true);
 execFileSync(process.execPath,['scripts/migrar.cjs','--apply','--cerrar-antiguas'],{env:process.env});assert.equal((await db.collection('auditoria').get()).size,1);
 fs.mkdirSync('test-results',{recursive:true});for(const f of fs.readdirSync('.'))if(f.startsWith('respaldo-antes-migracion-')&&f.endsWith('.ndjson'))fs.renameSync(f,'test-results/'+f);
});
