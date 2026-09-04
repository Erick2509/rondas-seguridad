import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


const parametros =
    new URLSearchParams(window.location.search);

const codigoPunto =
    parametros.get("punto");


const cargando =
    document.getElementById("cargando");

const resultado =
    document.getElementById("resultado");

const error =
    document.getElementById("error");

const nombreElemento =
    document.getElementById("nombrePunto");

const codigoElemento =
    document.getElementById("codigoPunto");

const mensajeError =
    document.getElementById("mensajeError");

const codigoAgente =
    document.getElementById("codigoAgente");

const mensaje =
    document.getElementById("mensaje");

const btnContinuar =
    document.getElementById("btnContinuar");


let puntoActual = null;
let agenteActual = null;


// ========================================
// 1. CARGAR PUNTO
// ========================================

async function cargarPunto() {

    if (!codigoPunto) {

        mostrarError(
            "No se recibió ningún código de punto."
        );

        return;
    }

    try {

        const referencia =
            doc(db, "puntos", codigoPunto);

        const documento =
            await getDoc(referencia);


        if (!documento.exists()) {

            mostrarError(
                "El punto de control no existe."
            );

            return;
        }


        const punto =
            documento.data();


        if (punto.activo !== true) {

            mostrarError(
                "Este punto de control está desactivado."
            );

            return;
        }


        if (
            typeof punto.latitud !== "number" ||
            typeof punto.longitud !== "number"
        ) {

            mostrarError(
                "Este punto no tiene coordenadas GPS configuradas."
            );

            return;
        }


        puntoActual = {

            id: codigoPunto,

            codigo:
                punto.codigo,

            nombre:
                punto.nombre,

            latitud:
                punto.latitud,

            longitud:
                punto.longitud,

            radioMetros:
                typeof punto.radioMetros === "number"
                    ? punto.radioMetros
                    : 30
        };


        nombreElemento.textContent =
            punto.nombre;

        codigoElemento.textContent =
            punto.codigo;


        cargando.classList.add("d-none");

        resultado.classList.remove("d-none");


    } catch (errorFirebase) {

        console.error(
            "ERROR FIREBASE:",
            errorFirebase
        );

        mostrarError(
            "Error: " +
            errorFirebase.code +
            " - " +
            errorFirebase.message
        );
    }
}


// ========================================
// 2. VALIDAR AGENTE
// ========================================

async function validarAgente() {

    const codigo =
        codigoAgente.value.trim();


    if (!codigo) {

        mostrarMensaje(
            "warning",
            "Ingresa el código del agente."
        );

        return;
    }


    btnContinuar.disabled =
        true;

    btnContinuar.textContent =
        "VERIFICANDO...";


    try {

        const referencia =
            doc(db, "agentes", codigo);

        const documento =
            await getDoc(referencia);


        if (!documento.exists()) {

            mostrarMensaje(
                "danger",
                "❌ Código de agente no válido."
            );

            return;
        }


        const agente =
            documento.data();


        if (agente.activo !== true) {

            mostrarMensaje(
                "danger",
                "❌ Este agente está desactivado."
            );

            return;
        }


        agenteActual = {

            id:
                codigo,

            codigo:
                agente.codigo,

            nombre:
                agente.nombre
        };


        sessionStorage.setItem(
            "rondaActual",
            JSON.stringify({

                punto:
                    puntoActual,

                agente:
                    agenteActual

            })
        );


        mostrarMensaje(
            "success",
            "✅ Agente identificado: " +
            agente.nombre
        );


        btnContinuar.textContent =
            "CONTINUAR →";


        setTimeout(() => {

            window.location.href =
                "camara.html";

        }, 800);


    } catch (errorFirebase) {

        console.error(
            "ERROR VALIDANDO AGENTE:",
            errorFirebase
        );


        mostrarMensaje(
            "danger",
            "Error al verificar el agente."
        );


    } finally {

        btnContinuar.disabled =
            false;

    }
}


// ========================================
// 3. MENSAJES
// ========================================

function mostrarMensaje(tipo, texto) {

    mensaje.className =
        "alert alert-" +
        tipo +
        " mt-3";

    mensaje.textContent =
        texto;

    mensaje.classList.remove(
        "d-none"
    );
}


function mostrarError(texto) {

    cargando.classList.add(
        "d-none"
    );

    resultado.classList.add(
        "d-none"
    );

    error.classList.remove(
        "d-none"
    );

    mensajeError.textContent =
        texto;
}


// ========================================
// 4. BOTÓN
// ========================================

btnContinuar.addEventListener(
    "click",
    validarAgente
);


// ========================================
// INICIAR
// ========================================

cargarPunto();