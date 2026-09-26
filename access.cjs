const {AppError,fail}=require('./domain.cjs');
async function identify(auth,db,header){
 fail(typeof header==='string'&&header.startsWith('Bearer '),'Inicia sesión para continuar.',401);
 let token;try{token=await auth.verifyIdToken(header.slice(7),true);}catch{throw new AppError(401,'La sesión venció. Vuelve a ingresar.');}
 const u=await db.doc('usuarios/'+token.uid).get(),v=u.data();
 fail(u.exists&&v.activo===true&&['ADMIN','CLIENTE','AGENTE'].includes(v.rol),'Usuario sin acceso.',403);
 const actor={uid:token.uid,rol:v.rol,email:token.email||'',agenteId:v.agenteId||null};
 if(actor.rol==='AGENTE'){
  fail(typeof actor.agenteId==='string','Agente no vinculado.',403);
  const a=await db.doc('agentes/'+actor.agenteId).get();
  fail(a.exists&&a.data().activo===true&&a.data().uid===actor.uid,'Agente deshabilitado.',403);
 }
 return actor;
}
function panel(a){fail(['ADMIN','CLIENTE'].includes(a.rol),'Acceso exclusivo del panel.',403);}
function admin(a){fail(a.rol==='ADMIN','Solo el administrador puede realizar esta acción.',403);}
function agent(a){fail(a.rol==='AGENTE','Ingresa con tu cuenta de agente.',403);}
async function current(tx,db,a){
 const u=await tx.get(db.doc('usuarios/'+a.uid));fail(u.exists&&u.data().activo===true&&u.data().rol===a.rol,'Los permisos cambiaron.',403);
 if(a.rol==='AGENTE'){
  const s=await tx.get(db.doc('agentes/'+a.agenteId));
  fail(s.exists&&s.data().activo===true&&s.data().uid===a.uid&&u.data().agenteId===a.agenteId,'Agente deshabilitado.',403);
  return s.data();
 }
 return u.data();
}
module.exports={identify,panel,admin,agent,current};
