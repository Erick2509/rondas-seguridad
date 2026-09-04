import { db } from "./firebase.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ========================================
// ELEMENTOS HTML
// ========================================

const informacion = document.getElementById("informacion");
const gps = document.getElementById("gps");
const seccionFoto = document.getElementById("seccionFoto");
const fotoInput = document.getElementById("foto");
const vistaPrevia = document.getElementById("vistaPrevia");
const canvas = document.getElementById("canvas");
const estado = document.getElementById("estado");
const btnRegistrar = document.getElementById("btnRegistrar");
const btnCompartir = document.getElementById("btnCompartir");
const error = document.getElementById("error");


// ========================================
// VARIABLES GENERALES
// ========================================

let datosRonda = null;
let ubicacion = null;
let imagenFinal = null;
let rondaRegistrada = false;


// ========================================
// GPS EN TIEMPO REAL
// ========================================

let gpsWatchId = null;

// Guardaremos las últimas distancias.
let distanciasGPS = [];

// Estado actual.
let gpsValidado = false;

// Confirmaciones consecutivas dentro del punto.
let confirmacionesDentro = 0;


// ========================================
// CONFIGURACIÓN GPS
// ========================================

// Cantidad máxima de distancias recientes.
const MAX_DISTANCIAS = 4;

// Necesitamos 2 confirmaciones seguidas.
const CONFIRMACIONES_NECESARIAS = 2;

// Margen para evitar que estando en el borde
// cambie constantemente entre dentro/fuera.
//
// Ejemplo:
// entra <= 5 m
// una vez validado, no se bloquea hasta > 7 m.
const MARGEN_SALIDA_METROS = 2;


// ========================================
// 1. CARGAR DATOS DE LA RONDA
// ========================================

function cargarDatos() {

    const datos = sessionStorage.getItem("rondaActual");

    if (!datos) {

        mostrarError(
            "No se encontró información de la ronda."
        );

        return false;
    }


    try {

        datosRonda = JSON.parse(datos);

    } catch (e) {

        mostrarError(
            "Los datos de la ronda no son válidos."
        );

        return false;
    }


    if (
        !datosRonda.punto ||
        !datosRonda.agente
    ) {

        mostrarError(
            "Faltan datos del punto o del agente."
        );

        return false;
    }


    informacion.innerHTML = `

        <strong>👮 Agente:</strong>
        ${datosRonda.agente.nombre}

        <br>

        <strong>🔢 Código:</strong>
        ${datosRonda.agente.codigo}

        <br><br>

        <strong>📍 Punto:</strong>
        ${datosRonda.punto.nombre}

        <br>

        <strong>🔲 Código:</strong>
        ${datosRonda.punto.codigo}

        <br><br>

        <strong>📱 QR:</strong>
        Verificado

    `;


    return true;
}


// ========================================
// 2. GRADOS A RADIANES
// ========================================

function gradosARadianes(grados) {

    return grados * Math.PI / 180;
}


// ========================================
// 3. CALCULAR DISTANCIA
// HAVERSINE
// ========================================

function calcularDistanciaMetros(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const dLat =
        gradosARadianes(lat2 - lat1);

    const dLon =
        gradosARadianes(lon2 - lon1);


    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)
        +
        Math.cos(gradosARadianes(lat1)) *
        Math.cos(gradosARadianes(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;
}


// ========================================
// 4. CALCULAR MEDIANA
//
// La mediana ayuda a evitar que una lectura
// aislada del GPS cambie demasiado la distancia.
// ========================================

function calcularMediana(valores) {

    if (!valores.length) {
        return null;
    }


    const ordenados =
        [...valores].sort(
            (a, b) => a - b
        );


    const mitad =
        Math.floor(
            ordenados.length / 2
        );


    if (
        ordenados.length % 2 === 0
    ) {

        return (
            ordenados[mitad - 1] +
            ordenados[mitad]
        ) / 2;

    }


    return ordenados[mitad];
}


// ========================================
// 5. BLOQUEAR FOTOGRAFÍA
// ========================================

function bloquearRonda() {

    gpsValidado = false;

    seccionFoto.classList.add(
        "d-none"
    );
}


// ========================================
// 6. HABILITAR FOTOGRAFÍA
// ========================================

function habilitarRonda() {

    gpsValidado = true;

    seccionFoto.classList.remove(
        "d-none"
    );
}


// ========================================
// 7. MOSTRAR ESTADO GPS
// ========================================

function mostrarGPSVerificado(
    distancia,
    radio
) {

    gps.className =
        "alert alert-success";


    gps.innerHTML = `

        🟢 <strong>PUNTO VERIFICADO</strong>

        <br><br>

        📱 QR físico:
        <strong>VALIDADO</strong>

        <br>

        📍 GPS:
        <strong>VALIDADO</strong>

        <br><br>

        📏 Distancia:
        <strong>${distancia.toFixed(1)} m</strong>

        <br>

        🎯 Límite:
        <strong>${radio} m</strong>

        <br><br>

        🔄 Ubicación en tiempo real

    `;
}


function mostrarGPSVerificando(
    distancia,
    radio
) {

    gps.className =
        "alert alert-warning";


    gps.innerHTML = `

        🟡 <strong>VERIFICANDO UBICACIÓN</strong>

        <br><br>

        📱 QR físico:
        <strong>VALIDADO</strong>

        <br>

        📏 Distancia actual:
        <strong>${distancia.toFixed(1)} m</strong>

        <br>

        🎯 Límite:
        <strong>${radio} m</strong>

        <br><br>

        🔄 Confirmando ubicación...

    `;
}


function mostrarFueraPunto(
    distancia,
    radio
) {

    gps.className =
        "alert alert-danger";


    gps.innerHTML = `

        🔴 <strong>FUERA DEL PUNTO</strong>

        <br><br>

        📱 QR físico:
        <strong>VALIDADO</strong>

        <br>

        📏 Distancia:
        <strong>${distancia.toFixed(1)} m</strong>

        <br>

        🎯 Debes estar a:
        <strong>${radio} m o menos</strong>

        <br><br>

        🔄 GPS actualizándose en tiempo real

    `;
}


// ========================================
// 8. GPS EN TIEMPO REAL
// ========================================

function obtenerUbicacion() {

    if (!navigator.geolocation) {

        mostrarError(
            "Este navegador no permite obtener ubicación."
        );

        return;
    }


    gps.className =
        "alert alert-info";


    gps.innerHTML = `

        📡 <strong>ACTIVANDO GPS...</strong>

        <br><br>

        📱 QR físico:
        <strong>VALIDADO</strong>

        <br>

        🔄 Obteniendo ubicación en tiempo real...

    `;


    gpsWatchId =
        navigator.geolocation.watchPosition(

            posicion => {

                // ========================================
                // POSICIÓN ACTUAL
                // ========================================

                const latitud =
                    posicion.coords.latitude;

                const longitud =
                    posicion.coords.longitude;


                // ========================================
                // DATOS DEL PUNTO
                // ========================================

                const latitudPunto =
                    Number(
                        datosRonda.punto.latitud
                    );

                const longitudPunto =
                    Number(
                        datosRonda.punto.longitud
                    );

                const radioMetros =
                    Number(
                        datosRonda.punto.radioMetros || 5
                    );


                // ========================================
                // VALIDAR CONFIGURACIÓN
                // ========================================

                if (
                    !Number.isFinite(latitudPunto) ||
                    !Number.isFinite(longitudPunto)
                ) {

                    bloquearRonda();


                    gps.className =
                        "alert alert-danger";


                    gps.innerHTML = `

                        ❌ <strong>ERROR DE CONFIGURACIÓN</strong>

                        <br><br>

                        El punto no tiene coordenadas
                        GPS configuradas correctamente.

                    `;


                    return;
                }


                // ========================================
                // DISTANCIA DE ESTA LECTURA
                // ========================================

                const distanciaActual =
                    calcularDistanciaMetros(

                        latitud,
                        longitud,

                        latitudPunto,
                        longitudPunto

                    );


                // ========================================
                // GUARDAR DISTANCIA RECIENTE
                // ========================================

                distanciasGPS.push(
                    distanciaActual
                );


                if (
                    distanciasGPS.length >
                    MAX_DISTANCIAS
                ) {

                    distanciasGPS.shift();
                }


                // ========================================
                // DISTANCIA ESTABILIZADA
                // ========================================

                const distanciaEstable =
                    calcularMediana(
                        distanciasGPS
                    );


                if (
                    distanciaEstable === null
                ) {

                    return;
                }


                // ========================================
                // GUARDAR POSICIÓN
                // ========================================

                ubicacion = {

                    latitud:
                        latitud,

                    longitud:
                        longitud,

                    distanciaPunto:
                        distanciaEstable,

                    distanciaInstantanea:
                        distanciaActual,

                    radioMetros:
                        radioMetros,

                    dentroDelRadio:
                        false

                };


                // ========================================
                // SI YA ESTABA VALIDADO
                //
                // Usamos margen de salida.
                //
                // Si el límite es 5 m,
                // no lo bloqueamos por un salto a 5.2.
                //
                // Debe superar 7 m.
                // ========================================

                if (gpsValidado) {

                    const limiteSalida =
                        radioMetros +
                        MARGEN_SALIDA_METROS;


                    if (
                        distanciaEstable <=
                        limiteSalida
                    ) {

                        ubicacion.dentroDelRadio =
                            true;


                        mostrarGPSVerificado(
                            distanciaEstable,
                            radioMetros
                        );


                        return;

                    }


                    // Ya salió realmente del área.

                    confirmacionesDentro = 0;

                    bloquearRonda();


                    mostrarFueraPunto(
                        distanciaEstable,
                        radioMetros
                    );


                    return;
                }


                // ========================================
                // TODAVÍA NO ESTÁ VALIDADO
                // ========================================

                if (
                    distanciaEstable <=
                    radioMetros
                ) {

                    confirmacionesDentro++;


                    // Primera lectura correcta:
                    // mostramos inmediatamente la distancia,
                    // pero esperamos una segunda lectura.

                    if (
                        confirmacionesDentro <
                        CONFIRMACIONES_NECESARIAS
                    ) {

                        mostrarGPSVerificando(
                            distanciaEstable,
                            radioMetros
                        );


                        return;
                    }


                    // ========================================
                    // SEGUNDA CONFIRMACIÓN
                    // ========================================

                    ubicacion.dentroDelRadio =
                        true;


                    habilitarRonda();


                    mostrarGPSVerificado(
                        distanciaEstable,
                        radioMetros
                    );


                    return;
                }


                // ========================================
                // FUERA DEL RADIO
                // ========================================

                confirmacionesDentro = 0;


                bloquearRonda();


                mostrarFueraPunto(
                    distanciaEstable,
                    radioMetros
                );

            },


            errorGPS => {

                console.error(
                    "Error GPS:",
                    errorGPS
                );


                confirmacionesDentro = 0;

                bloquearRonda();


                gps.className =
                    "alert alert-danger";


                let mensaje =
                    "No se pudo obtener la ubicación.";


                if (
                    errorGPS.code === 1
                ) {

                    mensaje =
                        "Debes permitir el acceso a la ubicación.";

                }


                if (
                    errorGPS.code === 2
                ) {

                    mensaje =
                        "El teléfono no pudo determinar la ubicación.";

                }


                if (
                    errorGPS.code === 3
                ) {

                    mensaje =
                        "El GPS está tardando. Mantén activada la ubicación.";

                }


                gps.innerHTML = `

                    ❌ <strong>${mensaje}</strong>

                    <br><br>

                    Verifica que la ubicación
                    del celular esté activada.

                `;

            },


            {
                enableHighAccuracy: true,

                maximumAge: 0,

                timeout: 10000
            }

        );
}


// ========================================
// 9. TOMAR / SELECCIONAR FOTOGRAFÍA
// ========================================

fotoInput.addEventListener(
    "change",
    manejarFoto
);


function manejarFoto(event) {

    // Antes de aceptar la foto,
    // comprobamos que el GPS siga validado.

    if (
        !ubicacion ||
        ubicacion.dentroDelRadio !== true ||
        gpsValidado !== true
    ) {

        mostrarError(
            "Debes estar dentro del punto autorizado para tomar la fotografía."
        );


        fotoInput.value = "";

        return;
    }


    const archivo =
        event.target.files[0];


    if (!archivo) {
        return;
    }


    const lector =
        new FileReader();


    lector.onload =
        function(e) {

            const imagen =
                new Image();


            imagen.onload =
                function() {

                    generarImagenFinal(
                        imagen
                    );

                };


            imagen.src =
                e.target.result;

        };


    lector.readAsDataURL(
        archivo
    );
}


// ========================================
// 10. GENERAR FOTO CON INFORMACIÓN
// ========================================

function generarImagenFinal(imagen) {

    const anchoMaximo =
        1200;


    let ancho =
        imagen.width;

    let alto =
        imagen.height;


    if (
        ancho >
        anchoMaximo
    ) {

        const proporcion =
            anchoMaximo /
            ancho;


        ancho =
            anchoMaximo;


        alto =
            alto *
            proporcion;
    }


    const alturaInfo =
        250;


    canvas.width =
        ancho;

    canvas.height =
        alto +
        alturaInfo;


    const ctx =
        canvas.getContext("2d");


    // FOTO

    ctx.drawImage(
        imagen,
        0,
        0,
        ancho,
        alto
    );


    // FONDO DE INFORMACIÓN

    ctx.fillStyle =
        "#111827";


    ctx.fillRect(
        0,
        alto,
        ancho,
        alturaInfo
    );


    // TEXTO

    ctx.fillStyle =
        "#ffffff";


    ctx.font =
        "bold 28px Arial";


    ctx.fillText(
        "RONDA DE SEGURIDAD",
        30,
        alto + 40
    );


    ctx.font =
        "22px Arial";


    ctx.fillText(
        `Punto: ${datosRonda.punto.nombre} - ${datosRonda.punto.codigo}`,
        30,
        alto + 80
    );


    ctx.fillText(
        `Agente: ${datosRonda.agente.nombre} - ${datosRonda.agente.codigo}`,
        30,
        alto + 115
    );


    const ahora =
        new Date();


    const fecha =
        ahora.toLocaleDateString(
            "es-PE"
        );


    const hora =
        ahora.toLocaleTimeString(
            "es-PE"
        );


    ctx.fillText(
        `Fecha: ${fecha} - Hora: ${hora}`,
        30,
        alto + 150
    );


    ctx.fillText(
        `QR: VALIDADO - GPS: VALIDADO`,
        30,
        alto + 185
    );


    ctx.fillText(
        `Distancia: ${ubicacion.distanciaPunto.toFixed(1)} m`,
        30,
        alto + 220
    );


    canvas.toBlob(

        blob => {

            imagenFinal =
                blob;


            vistaPrevia.classList.remove(
                "d-none"
            );


            estado.className =
                "alert alert-success mt-3";


            estado.innerHTML = `

                ✅ <strong>Fotografía preparada</strong>

                <br>

                📱 QR: Validado

                <br>

                📍 GPS: Validado

                <br>

                📏 Distancia:
                ${ubicacion.distanciaPunto.toFixed(1)} m

            `;

        },


        "image/jpeg",

        0.85
    );
}


// ========================================
// 11. REGISTRAR RONDA
// ========================================

btnRegistrar.addEventListener(
    "click",
    registrarRonda
);


async function registrarRonda() {

    if (!ubicacion) {

        mostrarError(
            "Todavía no tenemos ubicación GPS."
        );

        return;
    }


    // ========================================
    // COMPROBACIÓN FINAL
    // ========================================

    if (
        ubicacion.dentroDelRadio !== true ||
        gpsValidado !== true
    ) {

        mostrarError(
            "No puedes registrar la ronda porque estás fuera del punto autorizado."
        );

        return;
    }


    if (!imagenFinal) {

        mostrarError(
            "Primero debes tomar la fotografía."
        );

        return;
    }


    btnRegistrar.disabled =
        true;


    btnRegistrar.textContent =
        "REGISTRANDO...";


    try {

        const ahora =
            new Date();


        const datos = {

            agenteId:
                datosRonda.agente.id,

            agenteCodigo:
                datosRonda.agente.codigo,

            agenteNombre:
                datosRonda.agente.nombre,


            puntoId:
                datosRonda.punto.id,

            puntoCodigo:
                datosRonda.punto.codigo,

            puntoNombre:
                datosRonda.punto.nombre,


            fecha:
                ahora.toLocaleDateString(
                    "es-PE"
                ),


            hora:
                ahora.toLocaleTimeString(
                    "es-PE"
                ),


            latitud:
                ubicacion.latitud,


            longitud:
                ubicacion.longitud,


            distanciaPunto:
                Number(
                    ubicacion.distanciaPunto.toFixed(1)
                ),


            radioPermitido:
                ubicacion.radioMetros,


            qrValidado:
                true,


            gpsValidado:
                true,


            metodoValidacion:
                "QR_FISICO_GPS",


            estado:
                "completada",


            timestamp:
                serverTimestamp()

        };


        await addDoc(

            collection(
                db,
                "rondas"
            ),

            datos

        );


        rondaRegistrada =
            true;


        // ========================================
        // DETENER GPS DESPUÉS DEL REGISTRO
        // ========================================

        if (
            gpsWatchId !== null
        ) {

            navigator.geolocation.clearWatch(
                gpsWatchId
            );


            gpsWatchId =
                null;
        }


        estado.className =
            "alert alert-success mt-3";


        estado.innerHTML = `

            ✅ <strong>RONDA REGISTRADA</strong>

            <br><br>

            📱 QR físico:
            VALIDADO

            <br>

            📍 GPS:
            VALIDADO

            <br>

            📏 Distancia:
            ${ubicacion.distanciaPunto.toFixed(1)} m

            <br>

            🎯 Límite:
            ${ubicacion.radioMetros} m

            <br><br>

            Los datos fueron guardados correctamente.

        `;


        btnRegistrar.classList.add(
            "d-none"
        );


        btnCompartir.classList.remove(
            "d-none"
        );


    } catch (
        errorFirebase
    ) {

        console.error(
            errorFirebase
        );


        mostrarError(
            "No se pudo registrar la ronda: " +
            errorFirebase.message
        );


        btnRegistrar.disabled =
            false;


        btnRegistrar.textContent =
            "✅ REGISTRAR RONDA";
    }
}


// ========================================
// 12. COMPARTIR WHATSAPP
// ========================================

btnCompartir.addEventListener(
    "click",
    compartirWhatsApp
);


async function compartirWhatsApp() {

    if (
        !rondaRegistrada
    ) {

        mostrarError(
            "Primero debes registrar la ronda."
        );

        return;
    }


    const ahora =
        new Date();


    const fecha =
        ahora.toLocaleDateString(
            "es-PE"
        );


    const hora =
        ahora.toLocaleTimeString(
            "es-PE"
        );


    const mensaje =
`🛡️ RONDA DE SEGURIDAD

👮 Agente: ${datosRonda.agente.nombre}
🔢 Código: ${datosRonda.agente.codigo}

📍 Punto: ${datosRonda.punto.nombre}
🔲 Código: ${datosRonda.punto.codigo}

📅 Fecha: ${fecha}
🕐 Hora: ${hora}

📱 QR físico: VALIDADO
📍 GPS: VALIDADO
📏 Distancia al punto: ${ubicacion.distanciaPunto.toFixed(1)} m
🎯 Límite permitido: ${ubicacion.radioMetros} m

✅ Punto registrado`;


    const archivo =
        new File(

            [imagenFinal],

            `ronda-${datosRonda.punto.codigo}-${Date.now()}.jpg`,

            {
                type:
                    "image/jpeg"
            }

        );


    try {

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [archivo]
            })
        ) {

            await navigator.share({

                text:
                    mensaje,

                files:
                    [archivo]

            });

        } else {

            descargarImagen();


            alert(
                "Este navegador no permite compartir directamente la fotografía. La imagen fue descargada."
            );
        }


    } catch (
        errorCompartir
    ) {

        console.log(
            "Compartir cancelado:",
            errorCompartir
        );
    }
}


// ========================================
// 13. DESCARGAR RESPALDO
// ========================================

function descargarImagen() {

    const enlace =
        document.createElement("a");


    enlace.href =
        URL.createObjectURL(
            imagenFinal
        );


    enlace.download =
        "evidencia-ronda.jpg";


    enlace.click();


    URL.revokeObjectURL(
        enlace.href
    );
}


// ========================================
// 14. MOSTRAR ERROR
// ========================================

function mostrarError(texto) {

    error.textContent =
        texto;


    error.classList.remove(
        "d-none"
    );
}


// ========================================
// 15. DETENER GPS AL SALIR
// ========================================

window.addEventListener(

    "pagehide",

    () => {

        if (
            gpsWatchId !== null
        ) {

            navigator.geolocation.clearWatch(
                gpsWatchId
            );
        }

    }

);


// ========================================
// 16. INICIAR SISTEMA
// ========================================

if (
    cargarDatos()
) {

    obtenerUbicacion();
}