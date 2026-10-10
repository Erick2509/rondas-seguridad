async function avisarPush(tipoEvento, rondaId, notificacionClave) {
  try {
    await fetch("/api/notificar-ronda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipoEvento, rondaId, notificacionClave })
    });
  } catch (e) {
    console.warn("La ronda se guardó, pero no se pudo solicitar la notificación:", e);
  }
}

import { db } from "./firebase.js";
import {
  doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const codigoURL = (params.get("punto") || "").trim().toUpperCase();
const $ = id => document.getElementById(id);

const codigoPunto = $("codigoPunto");
const estadoPunto = $("estadoPunto");
const infoPunto = $("infoPunto");
const codigoAgente = $("codigoAgente");
const formularioAgente = $("formularioAgente");
const btnContinuar = $("btnContinuar");
const mensaje = $("mensaje");
const error = $("error");
const mensajeError = $("mensajeError");
const infoRonda = $("infoRonda");
const accionesError = $("accionesError");
const btnEscanearNuevamente = $("btnEscanearNuevamente");

let punto = null;

function activa() {
  try {
    return JSON.parse(localStorage.getItem("rondaActiva") || sessionStorage.getItem("rondaActiva") || "null");
  } catch (e) {
    return null;
  }
}

function guardarActiva(ronda) {
  localStorage.setItem("rondaActiva", JSON.stringify(ronda));
  sessionStorage.setItem("rondaActiva", JSON.stringify(ronda));
}

function ponerLineas(elemento, lineas) {
  elemento.textContent = lineas.join("\n");
  elemento.style.whiteSpace = "pre-line";
}

function msg(tipo, texto) {
  mensaje.className = "alert alert-" + tipo + " mt-3";
  mensaje.textContent = texto;
  mensaje.classList.remove("d-none");
}

function err(texto) {
  mensajeError.textContent = texto;
  error.classList.remove("d-none");
  const ronda = activa();
  if (ronda?.rondaId) accionesError.classList.remove("d-none");
}

btnEscanearNuevamente.addEventListener("click", function () {
  // Conservamos rondaActiva; solo descartamos el punto que no correspondía.
  sessionStorage.removeItem("rondaActual");
  window.location.href = "index.html";
});

function limpiar() {
  mensaje.classList.add("d-none");
  error.classList.add("d-none");
  accionesError.classList.add("d-none");
}

async function cargarPunto() {
  if (!/^P\d+$/.test(codigoURL)) throw new Error("Código de punto inválido.");

  const snap = await getDoc(doc(db, "puntos", codigoURL));
  if (!snap.exists()) throw new Error("El punto de control no existe.");

  const d = snap.data();
  if (d.activo !== true) throw new Error("Este punto está desactivado.");

  punto = {
    id: snap.id,
    codigo: d.codigo || snap.id,
    nombre: d.nombre || snap.id,
    tipoRonda: d.tipoRonda || null,
    funcionQR: d.funcionQR || null,
    orden: Number(d.orden || 0)
  };

  if (!punto.tipoRonda || !["INICIO", "PUNTO", "FINAL"].includes(punto.funcionQR) || !punto.orden) {
    throw new Error("Este QR todavía no tiene tipo, función u orden configurado.");
  }

  codigoPunto.textContent = punto.nombre;
  ponerLineas(estadoPunto, [
    `Código: ${punto.codigo}`,
    `Ronda: ${punto.tipoRonda} · Función: ${punto.funcionQR} · Orden: ${punto.orden}`
  ]);
  infoPunto.className = "alert alert-success";
}

async function agente(codigo) {
  const c = String(codigo).trim();
  if (!c) throw new Error("Ingresa el código del agente.");

  const snap = await getDoc(doc(db, "agentes", c));
  if (!snap.exists()) throw new Error("Código de agente no válido.");

  const d = snap.data();
  if (d.activo !== true) throw new Error("Este agente está desactivado.");

  return {
    id: snap.id,
    codigo: d.codigo || c,
    nombre: d.nombre || "Agente",
    cargo: d.cargo || "No registrado",
    turno: d.turno || "No registrado"
  };
}

async function cargarRuta(tipo) {
  const resultado = await getDocs(
    query(collection(db, "puntos"), where("tipoRonda", "==", tipo), where("activo", "==", true))
  );

  const ruta = [];
  resultado.forEach(documento => {
    const d = documento.data();
    if (d.activo !== true) return;
    ruta.push({
      id: documento.id,
      codigo: d.codigo || documento.id,
      nombre: d.nombre || documento.id,
      tipoRonda: d.tipoRonda,
      funcionQR: d.funcionQR,
      orden: Number(d.orden || 0)
    });
  });

  ruta.sort((a, b) => a.orden - b.orden);
  if (!ruta.length) throw new Error(`La Ronda ${tipo} no tiene puntos activos configurados.`);

  const ordenes = new Set();
  let inicios = 0;
  let finales = 0;

  ruta.forEach((p, indice) => {
    if (!Number.isInteger(p.orden) || p.orden < 1) throw new Error(`El punto ${p.codigo} tiene un orden inválido.`);
    if (ordenes.has(p.orden)) throw new Error(`Hay dos puntos usando el orden ${p.orden} en la Ronda ${tipo}.`);
    ordenes.add(p.orden);
    if (p.funcionQR === "INICIO") inicios++;
    if (p.funcionQR === "FINAL") finales++;
    if (p.orden !== indice + 1) throw new Error(`Falta configurar el orden ${indice + 1} en la Ronda ${tipo}.`);
  });

  if (inicios !== 1 || ruta[0].funcionQR !== "INICIO") {
    throw new Error(`La Ronda ${tipo} debe tener un único INICIO en el orden 1.`);
  }
  if (finales !== 1 || ruta[ruta.length - 1].funcionQR !== "FINAL") {
    throw new Error(`La Ronda ${tipo} debe tener un único FINAL como último punto.`);
  }

  return ruta;
}

async function puntoEsperado(tipo, orden, rutaGuardada) {
  if (Array.isArray(rutaGuardada) && rutaGuardada.length) {
    return rutaGuardada.find(p => Number(p.orden) === Number(orden)) || null;
  }

  // Compatibilidad con rondas antiguas que todavía no guardaban snapshot de ruta.
  const resultado = await getDocs(
    query(collection(db, "puntos"), where("tipoRonda", "==", tipo), where("orden", "==", orden), where("activo", "==", true))
  );
  let esperado = null;
  resultado.forEach(d => {
    if (d.data().activo === true) esperado = { id: d.id, ...d.data() };
  });
  return esperado;
}

async function preparar() {
  await cargarPunto();
  let ronda = activa();

  if (ronda?.rondaId) {
    const snap = await getDoc(doc(db, "rondas", ronda.rondaId));
    if (!snap.exists() || snap.data().estado !== "EN_CURSO") {
      localStorage.removeItem("rondaActiva");
      sessionStorage.removeItem("rondaActiva");
      sessionStorage.removeItem("rondaActual");
      ronda = null;
    } else {
      const rd = snap.data();
      ronda.ultimoOrden = Number(rd.ultimoOrden || ronda.ultimoOrden || 0);
      ronda.ultimoPuntoCodigo = rd.ultimoPuntoCodigo || ronda.ultimoPuntoCodigo || null;
      ronda.totalValidados = Number(rd.totalValidados || 0);
      ronda.ruta = Array.isArray(rd.ruta) ? rd.ruta : (ronda.ruta || []);
      ronda.totalPuntosPlanificados = Number(rd.totalPuntosPlanificados || ronda.ruta.length || 0);
      ronda.notificacionClave = rd.notificacionClave || ronda.notificacionClave || null;
      guardarActiva(ronda);
    }
  }

  if (!ronda) {
    if (punto.funcionQR !== "INICIO") {
      throw new Error("No hay una ronda activa. Debes escanear primero el QR de INICIO.");
    }
    formularioAgente.classList.remove("d-none");
    codigoAgente.focus();
    return;
  }

  formularioAgente.classList.add("d-none");
  infoRonda.classList.remove("d-none");
  ponerLineas(infoRonda, [
    `🔄 RONDA ${ronda.tipoRonda} EN CURSO`,
    `👮 ${ronda.agente.nombre}`,
    `🦺 ${ronda.agente.cargo}`,
    `🕐 ${ronda.agente.turno}`
  ]);

  if (punto.tipoRonda !== ronda.tipoRonda) {
    throw new Error(`Esta ronda es ${ronda.tipoRonda}. El QR escaneado pertenece a ${punto.tipoRonda}.`);
  }

  const esperado = Number(ronda.ultimoOrden || 0) + 1;
  if (punto.orden !== esperado) {
    const p = await puntoEsperado(ronda.tipoRonda, esperado, ronda.ruta);
    throw new Error(
      `QR fuera de secuencia. Debes validar primero ${
        p ? (p.codigo || p.id) + " - " + (p.nombre || "Punto") : "el punto de orden " + esperado
      }.`
    );
  }

  // Si la ronda guarda una ruta congelada, el QR debe seguir perteneciendo a ella.
  if (Array.isArray(ronda.ruta) && ronda.ruta.length) {
    const plan = ronda.ruta.find(p => String(p.codigo || p.id).toUpperCase() === punto.codigo.toUpperCase());
    if (!plan || Number(plan.orden) !== punto.orden || plan.funcionQR !== punto.funcionQR) {
      throw new Error("Este QR ya no coincide con el recorrido que se definió al iniciar la ronda.");
    }
  }

  sessionStorage.setItem("rondaActual", JSON.stringify({
    rondaId: ronda.rondaId,
    agente: ronda.agente,
    punto,
    tipoRonda: ronda.tipoRonda,
    inicio: ronda.inicio
  }));

  setTimeout(() => location.href = "camara.html", 500);
}

async function iniciar() {
  limpiar();
  const a = await agente(codigoAgente.value);

  if (punto.funcionQR !== "INICIO") {
    throw new Error("La ronda debe comenzar con un QR configurado como INICIO.");
  }

  const ruta = await cargarRuta(punto.tipoRonda);
  const inicioRuta = ruta[0];
  if (String(inicioRuta.codigo || inicioRuta.id).toUpperCase() !== punto.codigo.toUpperCase()) {
    throw new Error(`El QR de INICIO configurado para esta ronda es ${inicioRuta.codigo || inicioRuta.id}.`);
  }

  const inicio = new Date();
  const notificacionClave = crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const rutaSnapshot = ruta.map(p => ({
    codigo: p.codigo || p.id,
    nombre: p.nombre || "Punto",
    funcionQR: p.funcionQR,
    orden: Number(p.orden)
  }));

  const ref = await addDoc(collection(db, "rondas"), {
    agenteId: a.id,
    agenteNombre: a.nombre,
    agenteCargo: a.cargo,
    agenteTurno: a.turno,
    tipoRonda: punto.tipoRonda,
    estado: "EN_CURSO",
    inicioQrCodigo: punto.codigo,
    horaInicioLocal: inicio.toISOString(),
    inicioTimestamp: serverTimestamp(),
    totalValidados: 0,
    ultimoOrden: 0,
    ultimoPuntoCodigo: null,
    ruta: rutaSnapshot,
    totalPuntosPlanificados: rutaSnapshot.length,
    versionRuta: 1,
    notificacionClave
  });

  const ronda = {
    rondaId: ref.id,
    agente: a,
    tipoRonda: punto.tipoRonda,
    inicio: inicio.toISOString(),
    ultimoOrden: 0,
    totalValidados: 0,
    ultimoPuntoCodigo: null,
    ruta: rutaSnapshot,
    totalPuntosPlanificados: rutaSnapshot.length,
    notificacionClave
  };

  guardarActiva(ronda);
  avisarPush("INICIO", ref.id, notificacionClave);
  sessionStorage.setItem("rondaActual", JSON.stringify({
    rondaId: ref.id,
    agente: a,
    punto,
    tipoRonda: punto.tipoRonda,
    inicio: ronda.inicio
  }));
  location.href = "camara.html";
}

btnContinuar.addEventListener("click", async () => {
  btnContinuar.disabled = true;
  try {
    await iniciar();
  } catch (e) {
    msg("danger", "❌ " + (e.message || "No se pudo iniciar."));
    btnContinuar.disabled = false;
  }
});

codigoAgente.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    btnContinuar.click();
  }
});

codigoPunto.textContent = codigoURL || "No identificado";
preparar().catch(e => {
  infoPunto.className = "alert alert-danger";
  err(e.message);
  formularioAgente.classList.add("d-none");
});
