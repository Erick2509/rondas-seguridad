import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ======================================================
// ELEMENTOS
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


// ======================================================
// LEER PUNTO DEL QR
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
// ERRORES
// ======================================================

function mostrarError(mensaje) {

    if (!error) return;

    error.textContent = mensaje;

    error.classList.remove(
        "d-none"
    );
}


function ocultarError() {

    if (!error) return;

    error.textContent = "";

    error.classList.add(
        "d-none"
    );
}


// ======================================================
// FORMULARIO
// ======================================================

function bloquearFormulario() {

    if (codigoAgente) {
        codigoAgente.disabled = true;
    }

    if (btnContinuar) {
        btnContinuar.disabled = true;
    }
}


function habilitarFormulario() {

    if (codigoAgente) {
        codigoAgente.disabled = false;
    }

    if (btnContinuar) {
        btnContinuar.disabled = false;
    }
}


// ======================================================
// CARGAR PUNTO
// ======================================================

async function cargarPunto() {

    bloquearFormulario();


    // ==================================================
    // COMPROBAR QUE EL QR TENGA PUNTO
    // ==================================================

    if (!codigoPunto) {

        if (infoPunto) {

            infoPunto.innerHTML = `
                ❌ <strong>PUNTO NO VÁLIDO</strong>
                <br><br>
                Debes escanear el QR del punto.
            `;
        }


        mostrarError(
            "No se encontró el código del punto."
        );

        return;
    }


    // ==================================================
    // MOSTRAR PUNTO INMEDIATAMENTE
    // ==================================================

    if (infoPunto) {

        infoPunto.innerHTML = `
            📍 <strong>Punto:</strong> ${codigoPunto}
            <br>
            🔄 Cargando información...
        `;
    }


    try {

        // ==================================================
        // BUSCAR PUNTO EN FIREBASE
        // ==================================================

        const referencia =
            doc(
                db,
                "puntos",
                codigoPunto
            );


        const documento =
            await getDoc(
                referencia
            );


        // ==================================================
        // NO EXISTE
        // ==================================================

        if (!documento.exists()) {

            if (infoPunto) {

                infoPunto.innerHTML = `
                    ❌ <strong>PUNTO NO ENCONTRADO</strong>
                `;
            }


            mostrarError(
                "Este punto de control no existe."
            );

            return;
        }


        const punto =
            documento.data();


        // ==================================================
        // PUNTO DESACTIVADO
        // ==================================================

        if (
            punto.activo !== true
        ) {

            if (infoPunto) {

                infoPunto.innerHTML = `
                    ⛔ <strong>PUNTO DESACTIVADO</strong>
                    <br><br>
                    ${punto.nombre || codigoPunto}
                `;
            }


            mostrarError(
                "Este punto está desactivado."
            );

            return;
        }


        // ==================================================
        // PUNTO CORRECTO
        // ==================================================

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


        // ==================================================
        // MOSTRAR PUNTO
        // ==================================================

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


        ocultarError();

        habilitarFormulario();


        if (codigoAgente) {

            codigoAgente.focus();
        }


    } catch (e) {

        console.error(
            "Error cargando punto:",
            e
        );


        mostrarError(
            "No se pudo cargar el punto. Revisa tu conexión."
        );
    }
}


// ======================================================
// IDENTIFICAR AGENTE
// ======================================================

async function identificarAgente(codigo) {

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


    const documento =
        await getDoc(
            referencia
        );


    if (!documento.exists()) {

        throw new Error(
            "El código de agente no existe."
        );
    }


    const agente =
        documento.data();


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
// FORMULARIO DEL AGENTE
// ======================================================

if (formulario) {

    formulario.addEventListener(

        "submit",

        async event => {

            event.preventDefault();

            ocultarError();


            // ==================================================
            // PUNTO DEBE ESTAR CARGADO
            // ==================================================

            if (!puntoActual) {

                mostrarError(
                    "Espera mientras se carga el punto."
                );

                return;
            }


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

            btnContinuar.disabled = true;


            const textoOriginal =
                btnContinuar.textContent;


            btnContinuar.textContent =
                "VERIFICANDO...";


            try {

                // ==================================================
                // VERIFICAR AGENTE
                // ==================================================

                await identificarAgente(
                    codigo
                );


                // ==================================================
                // CREAR RONDA
                // ==================================================

                const rondaActual = {

                    punto: {

                        id:
                            puntoActual.id,

                        codigo:
                            puntoActual.codigo,

                        nombre:
                            puntoActual.nombre,

                        latitud:
                            puntoActual.latitud,

                        longitud:
                            puntoActual.longitud,

                        radioMetros:
                            puntoActual.radioMetros
                    },


                    agente: {

                        id:
                            agenteActual.id,

                        codigo:
                            agenteActual.codigo,

                        nombre:
                            agenteActual.nombre
                    },


                    inicio:
                        new Date().toISOString()
                };


                // ==================================================
                // GUARDAR TEMPORALMENTE
                // ==================================================

                sessionStorage.setItem(

                    "rondaActual",

                    JSON.stringify(
                        rondaActual
                    )
                );


                // ==================================================
                // IR A CÁMARA
                // ==================================================

                window.location.href =
                    "camara.html";


            } catch (e) {

                console.error(
                    "Error agente:",
                    e
                );


                mostrarError(
                    e.message ||
                    "No se pudo verificar el agente."
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
// INICIAR
// ======================================================

cargarPunto();