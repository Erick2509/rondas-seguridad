import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ======================================================
// ELEMENTOS
// ======================================================

const infoPunto = document.getElementById("infoPunto");
const formulario = document.getElementById("formAgente");
const codigoAgente = document.getElementById("codigoAgente");
const btnContinuar = document.getElementById("btnContinuar");
const error = document.getElementById("error");


// ======================================================
// VARIABLES
// ======================================================

let puntoActual = null;
let agenteActual = null;
let qrValidado = false;


// ======================================================
// DATOS DEL QR
// ======================================================

const parametros =
    new URLSearchParams(window.location.search);

const codigoPunto =
    parametros.get("punto");

const tokenQR =
    parametros.get("token");


// ======================================================
// ERRORES
// ======================================================

function mostrarError(mensaje) {

    if (!error) return;

    error.textContent = mensaje;

    error.classList.remove("d-none");
}


function ocultarError() {

    if (!error) return;

    error.textContent = "";

    error.classList.add("d-none");
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
// MOSTRAR PUNTO VALIDADO
// ======================================================

function mostrarPuntoValidado() {

    if (!infoPunto) return;

    infoPunto.innerHTML = `

        ✅ <strong>QR VÁLIDO</strong>

        <br><br>

        📍 <strong>Punto:</strong>
        ${puntoActual.nombre}

        <br>

        🔲 <strong>Código:</strong>
        ${puntoActual.codigo}

    `;
}


// ======================================================
// GUARDAR VALIDACIÓN TEMPORAL
// ======================================================

function guardarValidacionTemporal() {

    const datos = {

        codigo:
            puntoActual.codigo,

        token:
            tokenQR,

        punto:
            puntoActual,

        tiempo:
            Date.now()

    };


    sessionStorage.setItem(
        "qrValidadoTemporal",
        JSON.stringify(datos)
    );
}


// ======================================================
// REVISAR VALIDACIÓN TEMPORAL
//
// Solo dura 5 minutos.
// ======================================================

function recuperarValidacionTemporal() {

    try {

        const guardado =
            sessionStorage.getItem(
                "qrValidadoTemporal"
            );


        if (!guardado) {
            return false;
        }


        const datos =
            JSON.parse(guardado);


        // ----------------------------------------------
        // MÁXIMO 5 MINUTOS
        // ----------------------------------------------

        const tiempoTranscurrido =
            Date.now() -
            datos.tiempo;


        const cincoMinutos =
            5 * 60 * 1000;


        if (
            tiempoTranscurrido >
            cincoMinutos
        ) {

            sessionStorage.removeItem(
                "qrValidadoTemporal"
            );

            return false;
        }


        // ----------------------------------------------
        // DEBE SER EXACTAMENTE EL MISMO QR
        // ----------------------------------------------

        if (
            datos.codigo !== codigoPunto ||
            datos.token !== tokenQR
        ) {

            return false;
        }


        if (!datos.punto) {
            return false;
        }


        puntoActual =
            datos.punto;


        qrValidado =
            true;


        mostrarPuntoValidado();

        ocultarError();

        habilitarFormulario();


        if (codigoAgente) {
            codigoAgente.focus();
        }


        return true;


    } catch (e) {

        sessionStorage.removeItem(
            "qrValidadoTemporal"
        );


        return false;
    }
}


// ======================================================
// VALIDAR QR
// ======================================================

async function cargarPunto() {

    bloquearFormulario();


    // ==================================================
    // MOSTRAR ALGO INMEDIATAMENTE
    // ==================================================

    if (infoPunto) {

        infoPunto.innerHTML = `

            🔍 <strong>VERIFICANDO PUNTO...</strong>

            <br><br>

            ${codigoPunto
                ? `📍 ${codigoPunto}`
                : "Leyendo QR..."}

        `;
    }


    // ==================================================
    // VALIDACIONES BÁSICAS INMEDIATAS
    // ==================================================

    if (!codigoPunto) {

        if (infoPunto) {

            infoPunto.innerHTML = `

                ❌ <strong>QR NO VÁLIDO</strong>

            `;
        }


        mostrarError(
            "Debes escanear el QR físico del punto."
        );


        return;
    }


    if (!tokenQR) {

        if (infoPunto) {

            infoPunto.innerHTML = `

                ❌ <strong>QR NO VÁLIDO</strong>

                <br><br>

                Falta el código de seguridad.

            `;
        }


        mostrarError(
            "Debes escanear el QR físico autorizado."
        );


        return;
    }


    // ==================================================
    // COMPROBAR SI YA LO VALIDAMOS
    // DURANTE ESTA SESIÓN
    // ==================================================

    if (
        recuperarValidacionTemporal()
    ) {

        console.log(
            "QR recuperado desde sesión."
        );

        return;
    }


    // ==================================================
    // CONSULTAR FIRESTORE
    // ==================================================

    try {

        const inicioConsulta =
            performance.now();


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


        const finConsulta =
            performance.now();


        console.log(
            "Firestore tardó:",
            Math.round(
                finConsulta -
                inicioConsulta
            ),
            "ms"
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
        // DESACTIVADO
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
                "Este punto de control está desactivado."
            );


            return;
        }


        // ==================================================
        // TOKEN NO CONFIGURADO
        // ==================================================

        if (!punto.qrToken) {

            if (infoPunto) {

                infoPunto.innerHTML = `

                    ⚠️ <strong>ERROR DE CONFIGURACIÓN</strong>

                `;
            }


            mostrarError(
                "Este punto no tiene un QR configurado."
            );


            return;
        }


        // ==================================================
        // TOKEN INCORRECTO
        // ==================================================

        if (
            tokenQR !==
            punto.qrToken
        ) {

            if (infoPunto) {

                infoPunto.innerHTML = `

                    ❌ <strong>QR NO VÁLIDO</strong>

                    <br><br>

                    El código de seguridad
                    no corresponde a ${codigoPunto}.

                `;
            }


            mostrarError(
                "Debes escanear el QR físico autorizado."
            );


            return;
        }


        // ==================================================
        // QR CORRECTO
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
                punto.radioMetros ?? null,

            qrValidado:
                true

        };


        qrValidado =
            true;


        // Guardamos temporalmente.
        guardarValidacionTemporal();


        mostrarPuntoValidado();

        ocultarError();

        habilitarFormulario();


        if (codigoAgente) {

            codigoAgente.focus();
        }


    } catch (e) {

        console.error(
            "Error verificando QR:",
            e
        );


        if (infoPunto) {

            infoPunto.innerHTML = `

                ❌ <strong>ERROR DE CONEXIÓN</strong>

            `;
        }


        mostrarError(
            "No se pudo verificar el punto. Revisa tu conexión e inténtalo nuevamente."
        );
    }
}


// ======================================================
// VALIDAR AGENTE
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
            // QR DEBE ESTAR VALIDADO
            // ==================================================

            if (
                qrValidado !== true ||
                !puntoActual
            ) {

                mostrarError(
                    "Primero debes escanear un QR válido."
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

            btnContinuar.disabled =
                true;


            const textoOriginal =
                btnContinuar.textContent;


            btnContinuar.textContent =
                "VERIFICANDO...";


            try {

                // ==================================================
                // CONSULTAR AGENTE
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
                            puntoActual.radioMetros,

                        qrValidado:
                            true

                    },


                    agente: {

                        id:
                            agenteActual.id,

                        codigo:
                            agenteActual.codigo,

                        nombre:
                            agenteActual.nombre

                    },


                    qrValidado:
                        true,


                    inicio:
                        new Date().toISOString()

                };


                // ==================================================
                // GUARDAR RONDA
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