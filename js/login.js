import { app, db } from "./firebase.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const auth = getAuth(app);
const form = document.getElementById("formLogin");
const correo = document.getElementById("correo");
const clave = document.getElementById("clave");
const mensaje = document.getElementById("mensaje");
const btn = document.getElementById("btnEntrar");

function error(texto) {
  mensaje.textContent = texto;
  mensaje.classList.remove("d-none");
}

async function usuarioAutorizado(user) {
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  return snap.exists() && snap.data().activo === true &&
    (snap.data().rol === "ADMIN" || snap.data().rol === "CLIENTE");
}

onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    if (await usuarioAutorizado(user)) location.replace("admin.html");
  } catch (e) {
    console.warn("No se pudo validar la sesión existente.", e);
  }
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  mensaje.classList.add("d-none");
  btn.disabled = true;
  btn.textContent = "INGRESANDO...";

  try {
    const cred = await signInWithEmailAndPassword(auth, correo.value.trim(), clave.value);
    if (!(await usuarioAutorizado(cred.user))) {
      await signOut(auth);
      throw new Error("Esta cuenta no tiene permiso para ingresar al panel.");
    }
    location.replace("admin.html");
  } catch (e) {
    let texto = "No se pudo iniciar sesión.";
    if (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password" || e.code === "auth/user-not-found") {
      texto = "Correo o contraseña incorrectos.";
    } else if (e.message && !String(e.message).includes("Firebase")) {
      texto = e.message;
    }
    error(texto);
    btn.disabled = false;
    btn.textContent = "INGRESAR";
  }
});
