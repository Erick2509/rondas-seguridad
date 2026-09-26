const {initializeApp,cert,getApps}=require('firebase-admin/app');
const {getFirestore,Timestamp,FieldValue}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {getMessaging}=require('firebase-admin/messaging');
function services(){
 if(!getApps().length){
  const projectId=process.env.FIREBASE_PROJECT_ID;
  if(process.env.FIRESTORE_EMULATOR_HOST){initializeApp({projectId:projectId||'demo-rondas'});}
  else {
   const clientEmail=process.env.FIREBASE_CLIENT_EMAIL,privateKey=(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
   if(!projectId||!clientEmail||!privateKey)throw Error('Configuración privada de Firebase incompleta.');
   initializeApp({credential:cert({projectId,clientEmail,privateKey})});
  }
 }
 return {db:getFirestore(),auth:getAuth(),messaging:getMessaging(),Timestamp,FieldValue};
}
module.exports={services};
