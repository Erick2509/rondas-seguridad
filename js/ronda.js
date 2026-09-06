import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ======================================================
// LEER PUNTO DESDE URL
// ======================================================

const parametros =
    new URLSearchParams(
        window.location.search
    );

const codigoPuntoURL =
    parametros.get("punto");


// ======================================================
// ELEMENTOS HTML
// ======================================================

const infoPunto =
    document.getElementById("infoPunto");

const codigoPuntoElemento =
    document.getElementById("codigoPunto");

const estadoPunto =
    document.getElementById("estadoPunto");

const codigoAgente =
    document.getElementById("codigoAgente");

const btnContinuar =
    document.getElementById("btnContinuar");

const mensaje =
    document.getElementById("mensaje");

const error =
    document.getElementById("error");

const mensajeError =
    document.getElementById("mensajeError");


// ======================================================
// VARIABLES
// ======================================================

let puntoActual = null;
let agenteActual = null;
let promesaPunto = null;


// ======================================================
// MENSAJES
// ======================================================

function mostrarMensaje(tipo, texto) {

    mensaje.className =
        "alert alert-" +
        tipo +
        " mt-3";

    mensaje.textContent = texto;

    mensaje.classList.remove("d-none");
}


function ocultarMensaje() {

    mensaje.classList.add("d-none");
}


function mostrarError(texto) {

    mensajeError.textContent = texto;

    error.classList.remove("d-none");
}


function ocultarError() {

    error.classList.add("d-none");
}


// ======================================================
// MOSTRAR PUNTO INMEDIATAMENTE
// ======================================================

function mostrarPuntoInicial() {

    if (!codigoPuntoURL) {

        codigoPuntoElemento.textContent =
            "No identificado";

        estadoPunto.textContent =
            "Debes escanear el QR del punto.";

        infoPunto.className =
            "alert alert-danger";

        mostrarError(
            "No se recibió ningún código de punto."
        );

        codigoAgente.disabled = true;
        btnContinuar.disabled = true;

        return false;
    }


    codigoPuntoElemento.textContent =
        codigoPuntoURL;

    estadoPunto.textContent =
        "Cargando nombre del punto...";

    infoPunto.className =
        "alert alert-info";


    // El agente puede escribir inmediatamente

    codigoAgente.disabled = false;
    btnContinuar.disabled = false;

    codigoAgente.focus();

    return true;
}


// ======================================================
// CONSULTAR PUNTO
// ======================================================

async function consultarPunto() {

    try {

        const referencia =
            doc(
                db,
                "puntos",
                codigoPuntoURL
            );

        const documento =
            await getDoc(referencia);


        if (!documento.exists()) {

            throw new Error(
                "El punto de control no existe."
            );
        }


        const punto =
            documento.data();


        if (punto.activo !== true) {

            throw new Error(
                "Este punto de control está desactivado."
            );
        }


        puntoActual = {

            id:
                documento.id,

            codigo:
                punto.codigo ||
                codigoPuntoURL,

            nombre:
                punto.nombre ||
                codigoPuntoURL,

            latitud:
                punto.latitud ?? null,

            longitud:
                punto.longitud ?? null,

            radioMetros:
                punto.radioMetros ?? null
        };


        codigoPuntoElemento.textContent =
            puntoActual.nombre;


        estadoPunto.innerHTML = `

            Código:
            <strong>
                ${puntoActual.codigo}
            </strong>

        `;


        infoPunto.className =
            "alert alert-success";


        return puntoActual;


    } catch (errorFirebase) {

        console.error(
            "ERROR PUNTO:",
            errorFirebase
        );


        infoPunto.className =
            "alert alert-danger";


        codigoPuntoElemento.textContent =
            codigoPuntoURL;


        estadoPunto.textContent =
            errorFirebase.message;


        mostrarError(
            errorFirebase.message
        );


        throw errorFirebase;
    }
}


// ======================================================
// INICIAR CONSULTA DEL PUNTO
// ======================================================

function iniciarCargaPunto() {

    promesaPunto =
        consultarPunto();

    promesaPunto.catch(
        () => {}
    );
}


// ======================================================
// CONSULTAR AGENTE
// ======================================================

async function consultarAgente(codigo) {

    const codigoLimpio =
        String(codigo).trim();


    if (!codigoLimpio) {

        throw new Error(
            "Ingresa el código del agente."
        );
    }


    const referencia =
        doc(
            db,
            "agentes",
            codigoLimpio
        );


    const documento =
        await getDoc(referencia);


    // ==================================================
    // AGENTE NO EXISTE
    // ==================================================

    if (!documento.exists()) {

        throw new Error(
            "Código de agente no válido."
        );
    }


    const agente =
        documento.data();


    // ==================================================
    // AGENTE DESACTIVADO
    // ==================================================

    if (agente.activo !== true) {

        throw new Error(
            "Este agente está desactivado."
        );
    }


    // ==================================================
    // DATOS DEL AGENTE
    // AHORA INCLUIMOS CARGO Y TURNO
    // ==================================================

    agenteActual = {

        id:
            documento.id,

        codigo:
            agente.codigo ||
            codigoLimpio,

        nombre:
            agente.nombre ||
            "Agente",

        cargo:
            agente.cargo ||
            "No registrado",

        turno:
            agente.turno ||
            "No registrado"
    };


    return agenteActual;
}


// ======================================================
// CONTINUAR
// ======================================================

async function continuar() {

    ocultarMensaje();
    ocultarError();


    const codigo =
        codigoAgente.value.trim();


    if (!codigo) {

        mostrarMensaje(
            "warning",
            "Ingresa el código del agente."
        );

        codigoAgente.focus();

        return;
    }


    btnContinuar.disabled = true;

    const textoOriginal =
        btnContinuar.textContent;

    btnContinuar.textContent =
        "CONTINUANDO...";


    try {

        const resultados =
            await Promise.all([

                promesaPunto,

                consultarAgente(
                    codigo
                )

            ]);


        const punto =
            resultados[0];

        const agente =
            resultados[1];


        // =================================================
        // CREAR RONDA TEMPORAL
        // =================================================

        const rondaActual = {

            punto: {

                id:
                    punto.id,

                codigo:
                    punto.codigo,

                nombre:
                    punto.nombre,

                latitud:
                    punto.latitud,

                longitud:
                    punto.longitud,

                radioMetros:
                    punto.radioMetros
            },


            agente: {

                id:
                    agente.id,

                codigo:
                    agente.codigo,

                nombre:
                    agente.nombre,

                cargo:
                    agente.cargo,

                turno:
                    agente.turno
            },


            inicio:
                new Date().toISOString()
        };


        // =================================================
        // GUARDAR DATOS PARA CAMARA.HTML
        // =================================================

        sessionStorage.setItem(

            "rondaActual",

            JSON.stringify(
                rondaActual
            )

        );


        // =================================================
        // IR A CÁMARA
        // =================================================

        window.location.href =
            "camara.html";


    } catch (errorProceso) {

        console.error(
            "ERROR:",
            errorProceso
        );


        mostrarMensaje(
            "danger",
            "❌ " +
            (
                errorProceso.message ||
                "No se pudo continuar."
            )
        );


        btnContinuar.disabled = false;

        btnContinuar.textContent =
            textoOriginal;

        codigoAgente.focus();
    }
}


// ======================================================
// BOTÓN
// ======================================================

btnContinuar.addEventListener(
    "click",
    continuar
);


// ======================================================
// ENTER
// ======================================================

codigoAgente.addEventListener(

    "keydown",

    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            continuar();
        }
    }
);


// ======================================================
// INICIAR
// ======================================================

if (mostrarPuntoInicial()) {

    iniciarCargaPunto();
}