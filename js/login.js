import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig={
  apiKey:"AIzaSyDf8abFDocep8kEHa45IJ02r_nBY6X8ops",
  authDomain:"rondas-seguridad-63ba4.firebaseapp.com",
  projectId:"rondas-seguridad-63ba4",
  storageBucket:"rondas-seguridad-63ba4.firebasestorage.app",
  messagingSenderId:"924206639387",
  appId:"1:924206639387:web:2e730ce51c54cccb624bbe"
};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);

const form=document.getElementById("formLogin");
const correo=document.getElementById("correo");
const clave=document.getElementById("clave");
const mensaje=document.getElementById("mensaje");
const btn=document.getElementById("btnEntrar");

function error(t){
  mensaje.textContent=t;
  mensaje.classList.remove("d-none");
}
async function usuarioAutorizado(user){
  const s=await getDoc(doc(db,"usuarios",user.uid));
  return s.exists() && s.data().activo===true &&
    (s.data().rol==="ADMIN" || s.data().rol==="CLIENTE");
}

onAuthStateChanged(auth,async user=>{
  if(!user)return;
  try{
    if(await usuarioAutorizado(user)) location.replace("admin.html");
  }catch(e){}
});

form.addEventListener("submit",async e=>{
  e.preventDefault();
  mensaje.classList.add("d-none");
  btn.disabled=true; btn.textContent="INGRESANDO...";
  try{
    const cred=await signInWithEmailAndPassword(auth,correo.value.trim(),clave.value);
    if(!(await usuarioAutorizado(cred.user))){
      await signOut(auth);
      throw new Error("Esta cuenta no tiene permiso para ingresar al panel.");
    }
    location.replace("admin.html");
  }catch(e){
    let t="No se pudo iniciar sesión.";
    if(e.code==="auth/invalid-credential" || e.code==="auth/wrong-password" || e.code==="auth/user-not-found") t="Correo o contraseña incorrectos.";
    else if(e.message && !String(e.message).includes("Firebase")) t=e.message;
    error(t);
    btn.disabled=false; btn.textContent="INGRESAR";
  }
});