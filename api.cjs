const {services}=require('./firebase.cjs');
const {AppError,fail}=require('./domain.cjs');
const {identify,panel}=require('./access.cjs');
const {engine}=require('./rounds.cjs');
const {catalog}=require('./catalog.cjs');
const {push}=require('./push.cjs');
function jsonSafe(v){if(v==null)return v;if(typeof v.toMillis==='function')return v.toMillis();if(Array.isArray(v))return v.map(jsonSafe);if(typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,jsonSafe(x)]));return v;}
function headers(res){res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');}
async function limit(db,Timestamp,uid){const ref=db.doc('limites/'+uid);await db.runTransaction(async tx=>{const s=await tx.get(ref),n=Date.now(),d=s.data(),same=d&&n-d.inicio<60000;fail(!same||d.cantidad<120,'Demasiadas solicitudes. Espera un minuto.',429);tx.set(ref,{inicio:same?d.inicio:n,cantidad:same?d.cantidad+1:1,expiraEn:Timestamp.fromMillis(n+3600000)});});}
function makeHandler(deps=services){return async (req,res)=>{
 headers(res);if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método no permitido.'});
 try{
  const configured=process.env.APP_ORIGIN;if(req.headers.origin&&configured)fail(req.headers.origin===configured,'Origen no permitido.',403);
  fail(String(req.headers['content-type']||'').startsWith('application/json'),'Utiliza JSON.',415);
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body;fail(b&&typeof b==='object'&&!Array.isArray(b),'Solicitud inválida.');fail(JSON.stringify(b).length<450000,'Solicitud demasiado grande.',413);
  const s=deps(),a=await identify(s.auth,s.db,req.headers.authorization);await limit(s.db,s.Timestamp,a.uid);
  const rounds=engine(s),cat=catalog(s),notifications=push(s);
  const actions={
   me:async()=>({usuario:a}),activa:rounds.active,iniciar:rounds.start,registrar:rounds.step,cancelar:rounds.cancel,ronda:rounds.get,rondas:rounds.history,detalle:rounds.details,evidencia:rounds.evidence,archivar:rounds.archive,'cerrar-ronda':rounds.closeLegacy,
   puntos:cat.points,'guardar-punto':cat.savePoint,'comprobar-rutas':cat.checkRoutes,agentes:cat.agents,'guardar-agente':cat.saveAgent,'credencial-agente':cat.credential,usuarios:cat.users,'guardar-usuario':cat.saveUser,'clave-panel':cat.resetPanel,
   'push-registrar':notifications.register,'push-quitar':notifications.unregister,'push-estado':notifications.status,'push-reintentar':notifications.retry,
   'push-procesar':async a=>{panel(a);return notifications.pending();},
   avisos:async a=>{panel(a);const q=await s.db.collection('eventosPush').orderBy('creadoEn','desc').limit(30).get();return {avisos:q.docs.map(d=>({id:d.id,tipo:d.data().tipoEvento,nombre:d.data().agenteNombre,ronda:d.data().tipoRonda,fecha:d.data().creadoEn}))};}
  };
  fail(Object.hasOwn(actions,b.accion),'Acción desconocida.');const result=await actions[b.accion](a,b);
  // El evento ya está persistido; un fallo de FCM nunca revierte el registro.
  if(result?.eventoId)try{await notifications.processOne(result.eventoId);}catch(e){console.error('push_pending',e.code||'retry');}
  return res.status(200).json({ok:true,...jsonSafe(result)});
 }catch(e){const status=e instanceof AppError?e.status:e instanceof SyntaxError?400:500;console.error('api_error',e.code||status);return res.status(status).json({ok:false,error:status===500?'No se pudo completar la operación. Reintenta; si persiste, contacta al administrador.':e.message});}
};}
module.exports={makeHandler,jsonSafe};
