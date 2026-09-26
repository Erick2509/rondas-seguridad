const {test}=require('node:test');const assert=require('node:assert/strict');
const {route,assertStep,jpeg,duration}=require('../lib/domain.cjs');
const p=(codigo,orden,funcionQR)=>({codigo,orden,funcionQR,tipoRonda:'EXTERNA',activo:true,nombre:codigo,direccion:'Lima'});
test('rechaza rutas con huecos, duplicados o FINAL prematuro',()=>{
 assert.throws(()=>route([p('P1',1,'INICIO'),p('P3',3,'FINAL')]));
 assert.throws(()=>route([p('P1',1,'INICIO'),p('P2',2,'FINAL'),p('P3',3,'PUNTO')]));
 assert.throws(()=>route([p('P1',1,'INICIO'),p('P2',1,'FINAL')]));
 assert.equal(route([p('P1',1,'INICIO'),p('P2',2,'FINAL')]).length,2);
});
test('rechaza ronda ajena, cerrada y punto fuera de orden',()=>{const r={agenteUid:'a',estado:'EN_CURSO',schemaVersion:2,totalValidados:0,ruta:[p('P1',1,'INICIO')]};assert.throws(()=>assertStep(r,'P1',{uid:'b'}));assert.throws(()=>assertStep({...r,estado:'COMPLETADA'},'P1',{uid:'a'}));assert.throws(()=>assertStep(r,'P2',{uid:'a'}));assert.equal(assertStep(r,'P1',{uid:'a'}).codigo,'P1');});
test('rechaza falsa imagen y tamaño excesivo',()=>{assert.throws(()=>jpeg(Buffer.from('<script>alert(1)</script>').toString('base64')));assert.throws(()=>jpeg('A'.repeat(410001)));});
test('duración usa marcas de servidor',()=>{assert.equal(duration(new Date(1000),new Date(121000)),120);});
