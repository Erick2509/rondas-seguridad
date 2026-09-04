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

let qrValidado = false;


// ======================================================
// 1. OBTENER DATOS DEL QR DESDE LA URL
//
// Ejemplo:
//
// ronda.html?punto=P01&token=xxxxxxxx
// ======================================================

const parametros =
    new URLSearchParams(
        window.location.search
    );


const codigoPunto =
    parametros.get("punto");


const tokenQR =
    parametros.get("token");


// ======================================================
// 2. MOSTRAR ERROR
// ======================================================

function mostrarError(mensaje) {

    if (error) {

        error.textContent =
            mensaje;


        error.classList.remove(
            "d-none"
        );
    }
}


// ======================================================
// 3. OCULTAR ERROR
// ======================================================

function ocultarError() {

    if (error) {

        error.textContent = "";

        error.classList.add(
            "d-none"
        );
    }
}


// ======================================================
// 4. BLOQUEAR FORMULARIO
// ======================================================

function bloquearFormulario() {

    if (codigoAgente) {

        codigoAgente.disabled =
            true;
    }


    if (btnContinuar) {

        btnContinuar.disabled =
            true;
    }
}


// ======================================================
// 5. HABILITAR FORMULARIO
// ======================================================

function habilitarFormulario() {

    if (codigoAgente) {

        codigoAgente.disabled =
            false;
    }


    if (btnContinuar) {

        btnContinuar.disabled =
            false;
    }
}


// ======================================================
// 6. VALIDAR QR FÍSICO
// ======================================================

async function cargarPunto() {

    bloquearFormulario();


    // --------------------------------------------------
    // NO HAY CÓDIGO DEL PUNTO
    // --------------------------------------------------

    if (!codigoPunto) {

        if (infoPunto) {

            infoPunto.innerHTML = `

                ❌ <strong>QR NO VÁLIDO</strong>

                <br><br>

                No se encontró el código
                del punto de control.

            `;
        }


        mostrarError(
            "Debes escanear el código QR físico del punto."
        );


        return;
    }


    // --------------------------------------------------
    // NO HAY TOKEN
    // --------------------------------------------------

    if (!tokenQR) {

        if (infoPunto) {

            infoPunto.innerHTML = `

                ❌ <strong>QR NO VÁLIDO</strong>

                <br><br>

                Este enlace no contiene
                el código de seguridad.

            `;
        }


        mostrarError(
            "Debes escanear el código QR físico del punto."
        );


        return;
    }


    try {

        // --------------------------------------------------
        // BUSCAR PUNTO EN FIREBASE
        // --------------------------------------------------

        const referenciaPunto =
            doc(
                db,
                "puntos",
                codigoPunto
            );


        const documentoPunto =
            await getDoc(
                referenciaPunto
            );


        // --------------------------------------------------
        // PUNTO NO EXISTE
        // --------------------------------------------------

        if (
            !documentoPunto.exists()
        ) {

            if (infoPunto) {

                infoPunto.innerHTML = `

                    ❌ <strong>PUNTO NO ENCONTRADO</strong>

                `;
            }


            mostrarError(
                "El punto de control no existe."
            );


            return;
        }


        const punto =
            documentoPunto.data();


        // --------------------------------------------------
        // PUNTO DESACTIVADO
        // --------------------------------------------------

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


        // --------------------------------------------------
        // COMPROBAR QUE FIREBASE TIENE TOKEN
        // --------------------------------------------------

        if (
            !punto.qrToken
        ) {

            if (infoPunto) {

                infoPunto.innerHTML = `

                    ⚠️ <strong>ERROR DE CONFIGURACIÓN</strong>

                    <br><br>

                    Este punto no tiene
                    un QR de seguridad configurado.

                `;
            }


            mostrarError(
                "Comunícate con el administrador."
            );


            return;
        }


        // --------------------------------------------------
        // COMPARAR TOKEN DEL QR
        // CON TOKEN DE FIREBASE
        // --------------------------------------------------

        if (
            tokenQR !==
            punto.qrToken
        ) {

            if (infoPunto) {

                infoPunto.innerHTML = `

                    ❌ <strong>QR NO VÁLIDO</strong>

                    <br><br>

                    El código QR no corresponde
                    a este punto de control.

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

        qrValidado =
            true;


        puntoActual = {

            id:
                documentoPunto.id,

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


        // IMPORTANTE:
        // NO guardamos qrToken en sessionStorage.


        if (infoPunto) {

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


        ocultarError();

        habilitarFormulario();


        if (codigoAgente) {

            codigoAgente.focus();
        }


    } catch (
        errorFirebase
    ) {

        console.error(
            "Error cargando punto:",
            errorFirebase
        );


        if (infoPunto) {

            infoPunto.innerHTML = `

                ❌ <strong>ERROR DE CONEXIÓN</strong>

            `;
        }


        mostrarError(
            "No se pudo verificar el código QR. Inténtalo nuevamente."
        );
    }
}


// ======================================================
// 7. IDENTIFICAR AGENTE
// ======================================================

async function identificarAgente(
    codigo
) {

    const codigoLimpio =
        String(codigo).trim();


    if (!codigoLimpio) {

        throw new Error(
            "Ingresa tu código de agente."
        );
    }


    const referenciaAgente =
        doc(
            db,
            "agentes",
            codigoLimpio
        );


    const documentoAgente =
        await getDoc(
            referenciaAgente
        );


    if (
        !documentoAgente.exists()
    ) {

        throw new Error(
            "El código de agente no existe."
        );
    }


    const agente =
        documentoAgente.data();


    if (
        agente.activo !== true
    ) {

        throw new Error(
            "Este agente está desactivado."
        );
    }


    agenteActual = {

        id:
            documentoAgente.id,

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
// 8. FORMULARIO
// ======================================================

if (formulario) {

    formulario.addEventListener(

        "submit",

        async event => {

            event.preventDefault();

            ocultarError();


            // ------------------------------------------
            // COMPROBAR NUEVAMENTE QR
            // ------------------------------------------

            if (
                qrValidado !== true ||
                !puntoActual
            ) {

                mostrarError(
                    "El QR del punto no ha sido validado."
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


            // ------------------------------------------
            // BLOQUEAR BOTÓN MIENTRAS CONSULTAMOS
            // ------------------------------------------

            btnContinuar.disabled =
                true;


            const textoOriginal =
                btnContinuar.textContent;


            btnContinuar.textContent =
                "VERIFICANDO...";


            try {

                // ------------------------------------------
                // VALIDAR AGENTE
                // ------------------------------------------

                await identificarAgente(
                    codigo
                );


                // ------------------------------------------
                // CREAR DATOS PARA LA SIGUIENTE PANTALLA
                // ------------------------------------------

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


                // ------------------------------------------
                // GUARDAR TEMPORALMENTE
                // ------------------------------------------

                sessionStorage.setItem(

                    "rondaActual",

                    JSON.stringify(
                        rondaActual
                    )

                );


                // ------------------------------------------
                // IR A CÁMARA
                // ------------------------------------------

                window.location.href =
                    "camara.html";


            } catch (
                errorAgente
            ) {

                console.error(
                    errorAgente
                );


                mostrarError(
                    errorAgente.message ||
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
// 9. INICIAR
// ======================================================

cargarPunto();