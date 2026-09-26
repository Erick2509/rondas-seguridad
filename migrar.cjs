/* Primero ejecutar sin --apply: solo inventario y copia local. No borra datos. */
const fs=require('node:fs');const {services}=require('../lib/firebase.cjs');
const apply=process.argv.includes('--apply'),close=process.argv.includes('--cerrar-antiguas');
if(close&&!apply)console.log('Simulación: se mostrarán los cierres de rondas antiguas, sin escribir.');
const {db,Timestamp}=services();
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup='respaldo-antes-migracion-'+stamp+'.ndjson';
const fd=fs.openSync(backup,'wx',0o600);
function record(path,data){fs.writeSync(fd,JSON.stringify({path,data})+'\n');}
function time(r){for(const v of [r.inicioTimestamp,r.timestamp])if(v&&typeof v.toMillis==='function')return v;const n=Date.parse(r.horaInicioLocal||'');return Number.isFinite(n)?Timestamp.fromMillis(n):Timestamp.fromMillis(0);}
async function pages(name,fn){let last;while(true){let q=db.collection(name).orderBy('__name__').limit(100);if(last)q=q.startAfter(last);const s=await q.get();if(s.empty)break;for(const d of s.docs)await fn(d);last=s.docs.at(-1);}}
(async()=>{let rounds=0,active=0,devices=0;
 // Respaldo de documentos y validaciones anteriores a cualquier actualización.
 for(const name of ['usuarios','agentes','puntos','dispositivosPush'])await pages(name,async d=>record(d.ref.path,d.data()));
 await pages('rondas',async d=>{record(d.ref.path,d.data());const validations=await d.ref.collection('validaciones').get();for(const v of validations.docs)record(v.ref.path,v.data());});
 await pages('rondas',async d=>{const r=d.data();if(r.schemaVersion===2)return;rounds++;if(r.estado==='EN_CURSO')active++;
  if(apply)await db.runTransaction(async tx=>{const s=await tx.get(d.ref),r=s.data();if(!s.exists||r.schemaVersion===2)return;const changes={schemaVersion:1,archivada:r.archivada===true,inicioTimestamp:time(r),fechaHistoricaDesconocida:time(r).toMillis()===0,migradoEn:Timestamp.now()};
   if(close&&r.estado==='EN_CURSO'){Object.assign(changes,{estado:'INCOMPLETA',motivoCancelacion:'Cierre administrativo al actualizar a versión 2. Registro anterior conservado.',cancelacionTimestamp:Timestamp.now(),cerradaPor:'MIGRACION_SERVIDOR'});tx.create(db.collection('auditoria').doc(),{uid:'MIGRACION_SERVIDOR',accion:'CERRAR_RONDA_ANTIGUA',target:d.id,creadoEn:Timestamp.now()});}
   tx.update(d.ref,changes);
  });
 });
 await pages('dispositivosPush',async d=>{if(d.data().schemaVersion===2)return;devices++;if(apply)await d.ref.update({activo:false,migradoEn:Timestamp.now()});});
 if(apply)await db.doc('migraciones/v2').set({actualizadoEn:Timestamp.now(),rondasRevisadas:rounds,dispositivosAnteriores:devices});
 fs.closeSync(fd);console.log(JSON.stringify({modo:apply?'APLICADO':'SIMULACION',rondasAntiguas:rounds,rondasAntiguasEnCurso:active,cerradas:apply&&close?active:0,dispositivosAnteriores:devices,respaldo:backup},null,2));
 if(active&&!close)console.log('ATENCIÓN: antes de habilitar agentes, cierra las rondas antiguas en el panel o repite con --apply --cerrar-antiguas.');
 console.log('Las fotografías de la versión antigua no existían en la base de datos y no pueden reconstruirse.');
})().catch(e=>{try{fs.closeSync(fd);}catch{}console.error('Migración detenida:',e.code||e.message);process.exit(1);});
