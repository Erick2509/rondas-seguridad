import {signInWithEmailAndPassword,sendPasswordResetEmail} from 'firebase/auth';
import {$,account,call,notice,showError,busy,install,signOut} from './common.js';
const {auth,ready}=account();install();
async function enter(){const {usuario}=await call(auth,'me');if(!['ADMIN','CLIENTE'].includes(usuario.rol)){await signOut(auth);throw Error('Esta cuenta no tiene acceso al panel.');}location.replace('/admin.html');}
$('login').addEventListener('submit',e=>{e.preventDefault();busy($('submit'),async()=>{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);await enter();});});
$('recover').onclick=async()=>{try{const email=$('email').value.trim();if(!email)throw Error('Escribe tu correo para recuperar el acceso.');await sendPasswordResetEmail(auth,email);notice('Si existe una cuenta compatible, recibirás un correo para restablecer la contraseña.');}catch(e){showError(e);}};
ready().then(u=>u&&enter()).catch(showError);
