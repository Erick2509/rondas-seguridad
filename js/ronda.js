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
    document.getElementById(
        "infoPunto"
    );


const codigoPuntoElemento =
    document.getElementById(
        "codigoPunto"
    );


const estadoPunto =
    document.getElementById(
        "estadoPunto"
    );


const codigoAgente =
    document.getElementById(
        "codigoAgente"
    );


const btnContinuar =
    document.getElementById(
        "btnContinuar"
    );


const mensaje =
    document.getElementById(
        "mensaje"
    );


const error =
    document.getElementById(
        "error"
    );


const mensajeError =
    document.getElementById(
        "mensajeError"
    );


// ======================================================
// VARIABLES
// ======================================================

let puntoActual =
    null;


let agenteActual =
    null;


// Guardamos la promesa del punto.
// Firebase comienza inmediatamente,
// pero NO bloqueamos la pantalla.

let promesaPunto =
    null;


// ======================================================
// MOSTRAR MENSAJE
// ======================================================

function mostrarMensaje(
    tipo,
    texto
) {

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


// ======================================================
// OCULTAR MENSAJE
// ======================================================

function ocultarMensaje() {

    mensaje.classList.add(
        "d-none"
    );
}


// ======================================================
// ERROR GENERAL
// ======================================================

function mostrarError(
    texto
) {

    mensajeError.textContent =
        texto;


    error.classList.remove(
        "d-none"
    );
}


// ======================================================
// OCULTAR ERROR
// ======================================================

function ocultarError() {

    error.classList.add(
        "d-none"
    );
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


        codigoAgente.disabled =
            true;


        btnContinuar.disabled =
            true;


        return false;
    }


    // ---------------------------------------------
    // MOSTRAMOS P01 INSTANTÁNEAMENTE
    // ---------------------------------------------

    codigoPuntoElemento.textContent =
        codigoPuntoURL;


    estadoPunto.textContent =
        "Cargando nombre del punto...";


    infoPunto.className =
        "alert alert-info";


    // ---------------------------------------------
    // EL AGENTE YA PUEDE ESCRIBIR
    // ---------------------------------------------

    codigoAgente.disabled =
        false;


    btnContinuar.disabled =
        false;


    codigoAgente.focus();


    return true;
}


// ======================================================
// CONSULTAR PUNTO EN FIREBASE
// ======================================================

async function consultarPunto() {

    try {

        const inicio =
            performance.now();


        const referencia =
            doc(
                db,
                "puntos",
                codigoPuntoURL
            );


        const documento =
            await getDoc(
                referencia
            );


        const tiempo =
            performance.now() -
            inicio;


        console.log(
            "Punto Firestore:",
            Math.round(tiempo),
            "ms"
        );


        // ---------------------------------------------
        // NO EXISTE
        // ---------------------------------------------

        if (
            !documento.exists()
        ) {

            throw new Error(
                "El punto de control no existe."
            );
        }


        const punto =
            documento.data();


        // ---------------------------------------------
        // DESACTIVADO
        // ---------------------------------------------

        if (
            punto.activo !== true
        ) {

            throw new Error(
                "Este punto de control está desactivado."
            );
        }


        // ---------------------------------------------
        // GUARDAR PUNTO
        // ---------------------------------------------

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


        // ---------------------------------------------
        // ACTUALIZAR INTERFAZ
        // ---------------------------------------------

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


    } catch (
        errorFirebase
    ) {

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
// INICIAR FIREBASE EN SEGUNDO PLANO
// ======================================================

function iniciarCargaPunto() {

    promesaPunto =
        consultarPunto();


    // Evita un error no controlado
    // mientras el usuario todavía escribe.

    promesaPunto.catch(
        () => {}
    );
}


// ======================================================
// CONSULTAR AGENTE
// ======================================================

async function consultarAgente(
    codigo
) {

    const codigoLimpio =
        String(codigo).trim();


    if (!codigoLimpio) {

        throw new Error(
            "Ingresa el código del agente."
        );
    }


    const inicio =
        performance.now();


    const referencia =
        doc(
            db,
            "agentes",
            codigoLimpio
        );


    const documento =
        await getDoc(
            referencia
        );


    const tiempo =
        performance.now() -
        inicio;


    console.log(
        "Agente Firestore:",
        Math.round(tiempo),
        "ms"
    );


    // ---------------------------------------------
    // AGENTE NO EXISTE
    // ---------------------------------------------

    if (
        !documento.exists()
    ) {

        throw new Error(
            "Código de agente no válido."
        );
    }


    const agente =
        documento.data();


    // ---------------------------------------------
    // AGENTE DESACTIVADO
    // ---------------------------------------------

    if (
        agente.activo !== true
    ) {

        throw new Error(
            "Este agente está desactivado."
        );
    }


    agenteActual = {

        id:
            documento.id,


        codigo:
            agente.codigo ||
            codigoLimpio,


        nombre:
            agente.nombre ||
            "Agente"

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


    // ---------------------------------------------
    // BOTÓN
    // ---------------------------------------------

    btnContinuar.disabled =
        true;


    const textoOriginal =
        btnContinuar.textContent;


    btnContinuar.textContent =
        "CONTINUANDO...";


    try {

        // =================================================
        // CONSULTA DEL PUNTO
        // YA COMENZÓ AL ABRIR LA PÁGINA
        //
        // AGENTE SE CONSULTA AHORA
        // =================================================

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
                    agente.nombre

            },


            inicio:
                new Date().toISOString()

        };


        // =================================================
        // GUARDAR
        // =================================================

        sessionStorage.setItem(

            "rondaActual",

            JSON.stringify(
                rondaActual
            )

        );


        // =================================================
        // NO HAY ESPERA DE 800ms
        // =================================================

        window.location.href =
            "camara.html";


    } catch (
        errorProceso
    ) {

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


        btnContinuar.disabled =
            false;


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
// ENTER EN EL CAMPO
// ======================================================

codigoAgente.addEventListener(

    "keydown",

    event => {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            continuar();
        }
    }

);


// ======================================================
// INICIAR
// ======================================================

if (
    mostrarPuntoInicial()
) {

    iniciarCargaPunto();
}