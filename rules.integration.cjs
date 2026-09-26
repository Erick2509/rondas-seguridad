const {test}=require('node:test');const fs=require('node:fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const {getDoc,getDocs,setDoc,updateDoc,deleteDoc,doc,collection}=require('firebase/firestore');
test('Firestore rechaza todo acceso directo: anónimo, cliente, agente y admin',async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-rondas',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});
 try{await env.withSecurityRulesDisabled(async c=>{for(const col of ['usuarios','agentes','puntos','rondas','evidencias','eventosPush','dispositivosPush','auditoria','rondasActivas'])await setDoc(doc(c.firestore(),col,'prueba'),{activo:true,rol:'ADMIN'});});
 for(const uid of [null,'cliente','agente','admin']){const db=uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();for(const col of ['usuarios','agentes','puntos','rondas','evidencias','eventosPush','dispositivosPush','auditoria','rondasActivas']){
 await assertFails(getDoc(doc(db,col,'prueba')));await assertFails(getDocs(collection(db,col)));await assertFails(setDoc(doc(db,col,'nuevo'),{activo:true}));await assertFails(updateDoc(doc(db,col,'prueba'),{activo:false}));await assertFails(deleteDoc(doc(db,col,'prueba')));
 }await assertFails(setDoc(doc(db,'rondas/prueba/validaciones/v1'),{orden:1}));}
 }finally{await env.cleanup();}
});
