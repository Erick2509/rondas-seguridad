import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ======================================================
// ELEMENTOS HTML
// ======================================================

const infoPunto =
    document.getElementById("infoPunto");

const formulario =
    document.getElementById("formAgente");

const codigoAgente =
    document.getElementById("codigoAgente");

const btnContinuar =
    document.getElementById("btnContinuar");

const error =
    document.getElementById("error");


// ======================================================
// VARIABLES
// ======================================================

let puntoActual = null;

let agenteActual = null;

let promesaPunto = null;


// ======================================================
// OBTENER PUNTO DESDE EL QR
//
// Ejemplo:
// ronda.html?punto=P01
// ======================================================

const parametros =
    new URLSearchParams(
        window.location.search
    );


const codigoPunto =
    parametros.get("punto");


// ======================================================
// MOSTRAR ERROR
// ======================================================

function mostrarError(mensaje) {

    if (!error) {
        return;
    }


    error.textContent =
        mensaje;


    error.classList.remove(
        "d-none"
    );
}


// ======================================================
// OCULTAR ERROR
// ======================================================

function ocultarError() {

    if (!error) {
        return;
    }


    error.textContent = "";


    error.classList.add(
        "d-none"
    );
}


// ======================================================
// MOSTRAR PUNTO INMEDIATAMENTE
// ======================================================

function mostrarPuntoInicial() {

    if (!codigoPunto) {

        if (infoPunto) {

            infoPunto.innerHTML = `

                ❌ <strong>PUNTO NO VÁLIDO</strong>

                <br><br>

                Debes escanear el QR
                del punto de control.

            `;
        }


        mostrarError(
            "No se encontró el código del punto."
        );


        if (codigoAgente) {

            codigoAgente.disabled =
                true;
        }


        if (btnContinuar) {

            btnContinuar.disabled =
                true;
        }


        return false;
    }


    // --------------------------------------------------
    // MOSTRAR P01 SIN ESPERAR FIREBASE
    // --------------------------------------------------

    if (infoPunto) {

        infoPunto.innerHTML = `

            📍 <strong>Punto:</strong>
            ${codigoPunto}

            <br>

            🔄 Verificando información...

        `;
    }


    // El agente puede comenzar a escribir
    // inmediatamente.

    if (codigoAgente) {

        codigoAgente.disabled =
            false;


        codigoAgente.focus();
    }


    if (btnContinuar) {

        btnContinuar.disabled =
            false;
    }


    return true;
}


// ======================================================
// CONSULTAR PUNTO EN SEGUNDO PLANO
// ======================================================

async function consultarPunto() {

    const referencia =
        doc(
            db,
            "puntos",
            codigoPunto
        );


    const inicio =
        performance.now();


    const documento =
        await getDoc(
            referencia
        );


    console.log(
        "Punto Firestore:",
        Math.round(
            performance.now() -
            inicio
        ),
        "ms"
    );


    // --------------------------------------------------
    // COMPROBAR EXISTENCIA
    // --------------------------------------------------

    if (!documento.exists()) {

        throw new Error(
            "Este punto de control no existe."
        );
    }


    const punto =
        documento.data();


    // --------------------------------------------------
    // COMPROBAR SI ESTÁ ACTIVO
    // --------------------------------------------------

    if (
        punto.activo !== true
    ) {

        throw new Error(
            "Este punto de control está desactivado."
        );
    }


    // --------------------------------------------------
    // PREPARAR PUNTO
    // --------------------------------------------------

    puntoActual = {

        id:
            documento.id,

        codigo:
            punto.codigo ||
            codigoPunto,

        nombre:
            punto.nombre ||
            codigoPunto,

        latitud:
            punto.latitud ?? null,

        longitud:
            punto.longitud ?? null,

        radioMetros:
            punto.radioMetros ?? null

    };


    // --------------------------------------------------
    // ACTUALIZAR PANTALLA
    // --------------------------------------------------

    if (infoPunto) {

        infoPunto.innerHTML = `

            ✅ <strong>PUNTO IDENTIFICADO</strong>

            <br><br>

            📍 <strong>Punto:</strong>
            ${puntoActual.nombre}

            <br>

            🔲 <strong>Código:</strong>
            ${puntoActual.codigo}

        `;
    }


    return puntoActual;
}


// ======================================================
// INICIAR CONSULTA DEL PUNTO
//
// IMPORTANTE:
//
// NO usamos await aquí.
//
// Esto permite que Firebase trabaje
// mientras el agente escribe su código.
// ======================================================

function iniciarConsultaPunto() {

    promesaPunto =
        consultarPunto();


    // Evitamos un error no controlado
    // si Firebase falla antes de que
    // el agente pulse continuar.

    promesaPunto.catch(
        e => {

            console.error(
                "Error cargando punto:",
                e
            );

        }
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
            "Ingresa tu código de agente."
        );
    }


    const referencia =
        doc(
            db,
            "agentes",
            codigoLimpio
        );


    const inicio =
        performance.now();


    const documento =
        await getDoc(
            referencia
        );


    console.log(
        "Agente Firestore:",
        Math.round(
            performance.now() -
            inicio
        ),
        "ms"
    );


    // --------------------------------------------------
    // NO EXISTE
    // --------------------------------------------------

    if (!documento.exists()) {

        throw new Error(
            "El código de agente no existe."
        );
    }


    const agente =
        documento.data();


    // --------------------------------------------------
    // DESACTIVADO
    // --------------------------------------------------

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
// FORMULARIO
// ======================================================

if (formulario) {

    formulario.addEventListener(

        "submit",

        async event => {

            event.preventDefault();


            ocultarError();


            const codigo =
                codigoAgente.value.trim();


            if (!codigo) {

                mostrarError(
                    "Ingresa tu código de agente."
                );


                codigoAgente.focus();


                return;
            }


            // ==================================================
            // BOTÓN
            // ==================================================

            btnContinuar.disabled =
                true;


            const textoOriginal =
                btnContinuar.textContent;


            btnContinuar.textContent =
                "CONTINUANDO...";


            try {

                // ==================================================
                // AGENTE Y PUNTO
                //
                // La consulta del punto probablemente
                // ya estará terminada porque comenzó
                // al abrir la página.
                //
                // La del agente empieza ahora.
                // ==================================================

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


                // ==================================================
                // CREAR RONDA
                // ==================================================

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


                // ==================================================
                // GUARDAR EN SESIÓN
                // ==================================================

                sessionStorage.setItem(

                    "rondaActual",

                    JSON.stringify(
                        rondaActual
                    )

                );


                // ==================================================
                // IR INMEDIATAMENTE A CÁMARA
                // ==================================================

                window.location.href =
                    "camara.html";


            } catch (e) {

                console.error(
                    "Error:",
                    e
                );


                mostrarError(
                    e.message ||
                    "No se pudo continuar."
                );


                btnContinuar.disabled =
                    false;


                btnContinuar.textContent =
                    textoOriginal;


                codigoAgente.focus();
            }
        }
    );
}


// ======================================================
// INICIO
// ======================================================

if (
    mostrarPuntoInicial()
) {

    // Firebase comienza inmediatamente,
    // pero NO bloquea el formulario.

    iniciarConsultaPunto();
}