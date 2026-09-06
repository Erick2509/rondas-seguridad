
async function avisarPush(tipoEvento, rondaId) {
    try {
        await fetch("/api/notificar-ronda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipoEvento, rondaId })
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
const codigoPunto = $("codigoPunto"), estadoPunto = $("estadoPunto"), infoPunto = $("infoPunto");
const codigoAgente = $("codigoAgente"), formularioAgente = $("formularioAgente"), btnContinuar = $("btnContinuar");
const mensaje = $("mensaje"), error = $("error"), mensajeError = $("mensajeError"), infoRonda = $("infoRonda");
let punto = null;
const accionesError =
    document.getElementById("accionesError");

const btnEscanearNuevamente =
    document.getElementById("btnEscanearNuevamente");

function activa() { try { return JSON.parse(localStorage.getItem("rondaActiva") || sessionStorage.getItem("rondaActiva") || "null"); } catch (e) { return null; } }
function msg(tipo, texto) { mensaje.className = "alert alert-" + tipo + " mt-3"; mensaje.textContent = texto; mensaje.classList.remove("d-none"); }
function err(texto) {

    mensajeError.textContent =
        texto;

    error.classList.remove(
        "d-none"
    );

    // Si ya existe una ronda activa,
    // permitimos regresar al escáner.
    const ronda =
        activa();

    if (
        ronda &&
        ronda.rondaId
    ) {

        accionesError.classList.remove(
            "d-none"
        );
    }
}
btnEscanearNuevamente.addEventListener(
    "click",
    function () {

        // IMPORTANTE:
        // No borramos rondaActiva.
        // Así se conserva:
        // - agente
        // - cargo
        // - turno
        // - tipo de ronda
        // - último QR validado
        // - orden esperado

        sessionStorage.removeItem(
            "rondaActual"
        );

        window.location.href =
            "index.html";
    }
);
function limpiar() {

    mensaje.classList.add(
        "d-none"
    );

    error.classList.add(
        "d-none"
    );

    accionesError.classList.add(
        "d-none"
    );
}
function guardarActiva(r) { localStorage.setItem("rondaActiva", JSON.stringify(r)); sessionStorage.setItem("rondaActiva", JSON.stringify(r)); }

async function cargarPunto() {
    if (!/^P\d+$/.test(codigoURL)) throw new Error("Código de punto inválido.");
    const snap = await getDoc(doc(db, "puntos", codigoURL));
    if (!snap.exists()) throw new Error("El punto de control no existe.");
    const d = snap.data();
    if (d.activo !== true) throw new Error("Este punto está desactivado.");
    punto = { id: snap.id, codigo: d.codigo || snap.id, nombre: d.nombre || snap.id, tipoRonda: d.tipoRonda || null, funcionQR: d.funcionQR || null, orden: Number(d.orden || 0) };
    if (!punto.tipoRonda || !["INICIO", "PUNTO", "FINAL"].includes(punto.funcionQR) || !punto.orden) throw new Error("Este QR todavía no tiene tipo, función u orden configurado.");
    codigoPunto.textContent = punto.nombre;
    estadoPunto.innerHTML = `Código: <strong>${punto.codigo}</strong><br>Ronda: <strong>${punto.tipoRonda}</strong> · Función: <strong>${punto.funcionQR}</strong> · Orden: <strong>${punto.orden}</strong>`;
    infoPunto.className = "alert alert-success";
}

async function agente(codigo) {
    const c = String(codigo).trim();
    if (!c) throw new Error("Ingresa el código del agente.");
    const s = await getDoc(doc(db, "agentes", c));
    if (!s.exists()) throw new Error("Código de agente no válido.");
    const d = s.data();
    if (d.activo !== true) throw new Error("Este agente está desactivado.");
    return { id: s.id, codigo: d.codigo || c, nombre: d.nombre || "Agente", cargo: d.cargo || "No registrado", turno: d.turno || "No registrado" };
}

async function puntoEsperado(tipo, orden) {
    const q = query(collection(db, "puntos"), where("tipoRonda", "==", tipo), where("orden", "==", orden));
    const s = await getDocs(q);
    let x = null; s.forEach(d => { if (d.data().activo === true) x = { id: d.id, ...d.data() }; });
    return x;
}

async function preparar() {
    await cargarPunto();
    let r = activa();
    if (r?.rondaId) {
        const rs = await getDoc(doc(db, "rondas", r.rondaId));
        if (!rs.exists() || rs.data().estado !== "EN_CURSO") {
            localStorage.removeItem("rondaActiva"); sessionStorage.removeItem("rondaActiva"); sessionStorage.removeItem("rondaActual"); r = null;
        } else {
            const rd=rs.data(); r.ultimoOrden=Number(rd.ultimoOrden||r.ultimoOrden||0); r.ultimoPuntoCodigo=rd.ultimoPuntoCodigo||r.ultimoPuntoCodigo||null; r.totalValidados=Number(rd.totalValidados||0); guardarActiva(r);
        }
    }
    if (!r) {
        if (punto.funcionQR !== "INICIO") throw new Error("No hay una ronda activa. Debes escanear primero el QR de INICIO.");
        formularioAgente.classList.remove("d-none");
        codigoAgente.focus();
        return;
    }
    formularioAgente.classList.add("d-none");
    infoRonda.classList.remove("d-none");
    infoRonda.innerHTML = `🔄 <strong>RONDA ${r.tipoRonda} EN CURSO</strong><br>👮 ${r.agente.nombre}<br>🦺 ${r.agente.cargo}<br>🕐 ${r.agente.turno}`;

    if (punto.tipoRonda !== r.tipoRonda) throw new Error(`Esta ronda es ${r.tipoRonda}. El QR escaneado pertenece a ${punto.tipoRonda}.`);
    const esperado = Number(r.ultimoOrden || 0) + 1;
    if (punto.orden !== esperado) {
        const p = await puntoEsperado(r.tipoRonda, esperado);
        throw new Error(`QR fuera de secuencia. Debes validar primero ${p ? (p.codigo || p.id) + " - " + (p.nombre || "Punto") : "el punto de orden " + esperado}.`);
    }
    sessionStorage.setItem("rondaActual", JSON.stringify({ rondaId: r.rondaId, agente: r.agente, punto, tipoRonda: r.tipoRonda, inicio: r.inicio }));
    setTimeout(() => location.href = "camara.html", 700);
}

async function iniciar() {
    limpiar();
    const a = await agente(codigoAgente.value);
    if (punto.funcionQR !== "INICIO") throw new Error("La ronda debe comenzar con un QR configurado como INICIO.");
    const ref = await addDoc(collection(db, "rondas"), {
        agenteId: a.id, agenteNombre: a.nombre, agenteCargo: a.cargo, agenteTurno: a.turno,
        tipoRonda: punto.tipoRonda, estado: "EN_CURSO",
        inicioQrCodigo: punto.codigo, horaInicioLocal: new Date().toISOString(),
        inicioTimestamp: serverTimestamp(), totalValidados: 0
    });
    const r = { rondaId: ref.id, agente: a, tipoRonda: punto.tipoRonda, inicio: new Date().toISOString(), ultimoOrden: 0, totalValidados: 0, ultimoPuntoCodigo: null };
    guardarActiva(r);
    avisarPush("INICIO", ref.id);
    sessionStorage.setItem("rondaActual", JSON.stringify({ rondaId: ref.id, agente: a, punto, tipoRonda: punto.tipoRonda, inicio: r.inicio }));
    location.href = "camara.html";
}

btnContinuar.addEventListener("click", async () => {
    btnContinuar.disabled = true;
    try { await iniciar(); } catch (e) { msg("danger", "❌ " + (e.message || "No se pudo iniciar.")); btnContinuar.disabled = false; }
});
codigoAgente.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); btnContinuar.click(); } });

codigoPunto.textContent = codigoURL || "No identificado";
preparar().catch(e => { infoPunto.className = "alert alert-danger"; err(e.message); formularioAgente.classList.add("d-none"); });
