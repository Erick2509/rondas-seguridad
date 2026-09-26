const crypto = require('node:crypto');
class AppError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(condition,message,status=400)=>{if(!condition)throw new AppError(status,message);};
function str(value,name,max=160){fail(typeof value==='string'&&value.trim().length>0&&value.trim().length<=max,`${name} no válido.`);return value.trim();}
function code(v){const c=str(v,'Código',6).padStart(3,'0');fail(/^\d{3,6}$/.test(c),'El código debe tener de 3 a 6 dígitos.');return c;}
function pointCode(v){const c=str(v,'Punto',30).toUpperCase();fail(/^P\d{1,12}$/.test(c),'Código de punto inválido.');return c;}
function route(points){
 const p=points.filter(p=>p.activo===true).sort((a,b)=>a.orden-b.orden);
 fail(p.length>=2&&p.length<=100,'Configura entre 2 y 100 puntos activos.');
 const ids=new Set();p.forEach((x,i)=>{
   fail(Number.isInteger(x.orden)&&x.orden===i+1,'La ruta necesita órdenes consecutivos desde 1, sin duplicados.');
   fail(x.funcionQR===(i===0?'INICIO':i===p.length-1?'FINAL':'PUNTO'),'La ruta necesita INICIO primero, FINAL al terminar y PUNTO en medio.');
   fail(!ids.has(x.codigo),'Hay códigos de punto repetidos.');ids.add(pointCode(x.codigo));
 });
 return p.map(x=>({codigo:x.codigo,nombre:str(x.nombre,'Nombre'),direccion:typeof x.direccion==='string'?x.direccion.slice(0,250):'',tipoRonda:x.tipoRonda,funcionQR:x.funcionQR,orden:x.orden}));
}
function assertStep(r,p,actor){
 fail(r.agenteUid===actor.uid,'Esta ronda pertenece a otro agente.',403);
 fail(!r.archivada&&r.estado==='EN_CURSO','La ronda ya está cerrada.',409);
 fail(r.schemaVersion===2&&Array.isArray(r.ruta),'Esta ronda anterior requiere revisión del administrador.',409);
 const expected=r.ruta[r.totalValidados];
 fail(expected&&expected.codigo===p,'QR fuera de secuencia. Escanea '+(expected?.codigo||'el punto esperado')+'.',409);
 return expected;
}
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const millis=v=>v?.toMillis?v.toMillis():v instanceof Date?v.getTime():0;
const duration=(start,end)=>Math.max(0,Math.floor((millis(end)-millis(start))/1000));
function jpeg(data){
 fail(typeof data==='string'&&data.length<=410000&&/^[A-Za-z0-9+/]+={0,2}$/.test(data),'Fotografía inválida o demasiado grande.');
 const b=Buffer.from(data,'base64');
 fail(b.length>=100&&b.length<=300000&&b[0]===255&&b[1]===216&&b[b.length-2]===255&&b[b.length-1]===217,'La evidencia debe ser JPEG de hasta 300 KB.');
 let i=2,dimensions=null;
 while(i+4<b.length){
   if(b[i++]!==255)break;while(b[i]===255)i++;const marker=b[i++];
   if(marker===0xda||marker===0xd9)break;
   const n=b.readUInt16BE(i);fail(n>=2&&i+n<=b.length,'JPEG incompleto.');
   if([0xc0,0xc1,0xc2].includes(marker)){fail(n>=8,'JPEG inválido.');dimensions={height:b.readUInt16BE(i+3),width:b.readUInt16BE(i+5)};break;}
   i+=n;
 }
 fail(dimensions&&dimensions.width>=100&&dimensions.height>=100&&dimensions.width<=2400&&dimensions.height<=3200,'Dimensiones de fotografía no válidas.');
 return {bytes:b,sha256:digest(b),...dimensions};
}
function cursor(v){if(!v)return null;fail(typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v),'Cursor inválido.');return v;}
function coordinates(v){if(v==null)return null;fail(typeof v==='object'&&Number.isFinite(v.lat)&&Math.abs(v.lat)<=90&&Number.isFinite(v.lng)&&Math.abs(v.lng)<=180&&Number.isFinite(v.precision)&&v.precision>=0,'Ubicación inválida.');return {lat:v.lat,lng:v.lng,precision:v.precision};}
module.exports={AppError,fail,str,code,pointCode,route,assertStep,digest,millis,duration,jpeg,cursor,coordinates};
