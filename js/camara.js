import { db } from "./firebase.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ========================================
// ELEMENTOS HTML
// ========================================

const informacion =
    document.getElementById("informacion");

const gps =
    document.getElementById("gps");

const seccionFoto =
    document.getElementById("seccionFoto");

const fotoInput =
    document.getElementById("foto");

const vistaPrevia =
    document.getElementById("vistaPrevia");

const canvas =
    document.getElementById("canvas");

const estado =
    document.getElementById("estado");

const btnRegistrar =
    document.getElementById("btnRegistrar");

const btnCompartir =
    document.getElementById("btnCompartir");

const error =
    document.getElementById("error");


// ========================================
// VARIABLES
// ========================================

let datosRonda = null;

let ubicacion = null;

let imagenFinal = null;

let rondaRegistrada = false;


// ========================================
// GPS EN TIEMPO REAL
// ========================================

let gpsWatchId = null;

let muestrasGPS = [];

let gpsValidado = false;


// Usamos pocas muestras para responder
// rápidamente cuando el agente se mueve.
const MAX_MUESTRAS_GPS = 3;


// Para autorizar la ronda necesitamos
// una precisión GPS razonable.
const PRECISION_PARA_VALIDAR = 8;


// Lecturas peores de 30 metros
// se consideran demasiado imprecisas.
const PRECISION_DESCARTAR = 30;


// ========================================
// 1. RECUPERAR DATOS DE LA RONDA
// ========================================

function cargarDatos() {

    const datos =
        sessionStorage.getItem(
            "rondaActual"
        );


    if (!datos) {

        mostrarError(
            "No se encontró información de la ronda."
        );

        return false;
    }


    datosRonda =
        JSON.parse(datos);


    informacion.innerHTML = `

        <strong>👮 Agente:</strong>
        ${datosRonda.agente.nombre}

        <br>

        <strong>🔢 Código:</strong>
        ${datosRonda.agente.codigo}

        <br>

        <strong>📍 Punto:</strong>
        ${datosRonda.punto.nombre}

        <br>

        <strong>🔲 Código:</strong>
        ${datosRonda.punto.codigo}

    `;


    return true;
}


// ========================================
// 2. CONVERTIR GRADOS A RADIANES
// ========================================

function gradosARadianes(grados) {

    return grados *
        Math.PI /
        180;
}


// ========================================
// 3. CALCULAR DISTANCIA GPS
// Fórmula Haversine
// ========================================

function calcularDistanciaMetros(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R =
        6371000;


    const dLat =
        gradosARadianes(
            lat2 - lat1
        );


    const dLon =
        gradosARadianes(
            lon2 - lon1
        );


    const a =

        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)

        +

        Math.cos(
            gradosARadianes(lat1)
        )

        *

        Math.cos(
            gradosARadianes(lat2)
        )

        *

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
// 4. PROMEDIO PONDERADO GPS
// ========================================

function promedioPonderadoGPS() {

    if (
        muestrasGPS.length === 0
    ) {

        return null;
    }


    let sumaPesos = 0;

    let latitud = 0;

    let longitud = 0;


    muestrasGPS.forEach(
        muestra => {

            const precision =
                Math.max(
                    muestra.precision,
                    1
                );


            // Una lectura más precisa
            // tiene más importancia.

            const peso =
                1 /
                (precision * precision);


            latitud +=
                muestra.latitud *
                peso;


            longitud +=
                muestra.longitud *
                peso;


            sumaPesos +=
                peso;

        }
    );


    return {

        latitud:
            latitud /
            sumaPesos,

        longitud:
            longitud /
            sumaPesos

    };
}


// ========================================
// 5. BLOQUEAR CÁMARA
// ========================================

function bloquearRonda() {

    gpsValidado =
        false;


    seccionFoto.classList.add(
        "d-none"
    );
}


// ========================================
// 6. HABILITAR CÁMARA
// ========================================

function habilitarRonda() {

    gpsValidado =
        true;


    seccionFoto.classList.remove(
        "d-none"
    );
}


// ========================================
// 7. GPS EN TIEMPO REAL
// ========================================

function obtenerUbicacion() {

    if (
        !navigator.geolocation
    ) {

        mostrarError(
            "Este navegador no permite obtener ubicación."
        );

        return;
    }


    gps.className =
        "alert alert-info";


    gps.innerHTML = `

        📡 <strong>Activando GPS...</strong>

        <br>

        La distancia aparecerá automáticamente.

    `;


    gpsWatchId =
        navigator.geolocation.watchPosition(

            posicion => {

                const latitud =
                    posicion.coords.latitude;


                const longitud =
                    posicion.coords.longitude;


                const precision =
                    posicion.coords.accuracy;


                // ========================================
                // GPS DEMASIADO IMPRECISO
                // ========================================

                if (
                    precision >
                    PRECISION_DESCARTAR
                ) {

                    muestrasGPS = [];


                    bloquearRonda();


                    gps.className =
                        "alert alert-warning";


                    gps.innerHTML = `

                        📡 <strong>GPS ACTIVO</strong>

                        <br><br>

                        ⚠️ Señal GPS débil

                        <br>

                        📡 Precisión actual:
                        ±${precision.toFixed(1)} m

                        <br><br>

                        🔄 Buscando una mejor ubicación...

                    `;


                    return;
                }


                // ========================================
                // GUARDAMOS LA NUEVA LECTURA
                // ========================================

                muestrasGPS.push({

                    latitud:
                        latitud,

                    longitud:
                        longitud,

                    precision:
                        precision

                });


                // Solamente conservamos
                // las últimas 3 posiciones.

                if (
                    muestrasGPS.length >
                    MAX_MUESTRAS_GPS
                ) {

                    muestrasGPS.shift();

                }


                // ========================================
                // FILTRAR POSICIÓN
                // ========================================

                const posicionFiltrada =
                    promedioPonderadoGPS();


                if (
                    !posicionFiltrada
                ) {

                    return;
                }


                // ========================================
                // COORDENADAS DEL PUNTO
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
                        datosRonda.punto.radioMetros
                        || 5
                    );


                // ========================================
                // COMPROBAR CONFIGURACIÓN
                // ========================================

                if (
                    !Number.isFinite(
                        latitudPunto
                    )
                    ||
                    !Number.isFinite(
                        longitudPunto
                    )
                ) {

                    bloquearRonda();


                    gps.className =
                        "alert alert-danger";


                    gps.innerHTML = `

                        ❌ El punto no tiene
                        coordenadas GPS configuradas.

                    `;


                    return;
                }


                // ========================================
                // CALCULAR DISTANCIA
                // ========================================

                const distancia =
                    calcularDistanciaMetros(

                        posicionFiltrada.latitud,

                        posicionFiltrada.longitud,

                        latitudPunto,

                        longitudPunto

                    );


                // ========================================
                // GUARDAR UBICACIÓN ACTUAL
                // ========================================

                ubicacion = {

                    latitud:
                        posicionFiltrada.latitud,

                    longitud:
                        posicionFiltrada.longitud,

                    precision:
                        precision,

                    distanciaPunto:
                        distancia,

                    radioMetros:
                        radioMetros,

                    dentroDelRadio:
                        false

                };


                // ========================================
                // MOSTRAR DISTANCIA INMEDIATAMENTE
                // PERO TODAVÍA NO AUTORIZAR
                // SI LA PRECISIÓN ES BAJA
                // ========================================

                if (
                    precision >
                    PRECISION_PARA_VALIDAR
                ) {

                    bloquearRonda();


                    gps.className =
                        "alert alert-warning";


                    gps.innerHTML = `

                        📡 <strong>GPS EN TIEMPO REAL</strong>

                        <br><br>

                        📍 Distancia estimada:
                        <strong>
                            ${distancia.toFixed(1)} m
                        </strong>

                        <br>

                        🎯 Límite permitido:
                        ${radioMetros} m

                        <br>

                        📡 Precisión:
                        ±${precision.toFixed(1)} m

                        <br><br>

                        🟡 Refinando ubicación...

                    `;


                    return;
                }


                // ========================================
                // DENTRO DEL RADIO
                // ========================================

                if (
                    distancia <=
                    radioMetros
                ) {

                    ubicacion.dentroDelRadio =
                        true;


                    habilitarRonda();


                    gps.className =
                        "alert alert-success";


                    gps.innerHTML = `

                        ✅ <strong>GPS VERIFICADO</strong>

                        <br><br>

                        📍 Distancia:
                        <strong>
                            ${distancia.toFixed(1)} m
                        </strong>

                        <br>

                        🎯 Límite permitido:
                        ${radioMetros} m

                        <br>

                        📡 Precisión:
                        ±${precision.toFixed(1)} m

                        <br>

                        🔄 GPS en tiempo real

                    `;

                }


                // ========================================
                // FUERA DEL RADIO
                // ========================================

                else {

                    ubicacion.dentroDelRadio =
                        false;


                    bloquearRonda();


                    gps.className =
                        "alert alert-danger";


                    gps.innerHTML = `

                        ❌ <strong>FUERA DEL PUNTO</strong>

                        <br><br>

                        📍 Distancia:
                        <strong>
                            ${distancia.toFixed(1)} m
                        </strong>

                        <br>

                        🎯 Debes estar a:
                        ${radioMetros} m o menos

                        <br>

                        📡 Precisión:
                        ±${precision.toFixed(1)} m

                        <br>

                        🔄 GPS actualizándose en tiempo real

                    `;

                }

            },


            errorGPS => {

                console.error(
                    errorGPS
                );


                bloquearRonda();


                gps.className =
                    "alert alert-danger";


                let mensajeGPS =
                    "No se pudo obtener tu ubicación.";


                if (
                    errorGPS.code === 1
                ) {

                    mensajeGPS =
                        "Debes permitir el acceso a tu ubicación.";

                }


                if (
                    errorGPS.code === 2
                ) {

                    mensajeGPS =
                        "El teléfono no pudo determinar tu ubicación.";

                }


                if (
                    errorGPS.code === 3
                ) {

                    mensajeGPS =
                        "El GPS está tardando demasiado. Mantén activada la ubicación.";

                }


                gps.innerHTML = `

                    ❌ <strong>${mensajeGPS}</strong>

                    <br>

                    Verifica que el GPS del celular
                    esté activado.

                `;

            },


            {

                enableHighAccuracy:
                    true,

                maximumAge:
                    0,

                timeout:
                    10000

            }

        );
}


// ========================================
// 8. SELECCIONAR FOTO
// ========================================

fotoInput.addEventListener(
    "change",
    manejarFoto
);


function manejarFoto(event) {

    // Volvemos a comprobar el GPS
    // justo antes de aceptar la fotografía.

    if (
        !ubicacion ||
        ubicacion.dentroDelRadio !== true ||
        gpsValidado !== true
    ) {

        mostrarError(
            "La ubicación GPS ya no está dentro del área autorizada."
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
        function (e) {

            const imagen =
                new Image();


            imagen.onload =
                function () {

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
// 9. GENERAR FOTO CON INFORMACIÓN
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
        230;


    canvas.width =
        ancho;


    canvas.height =
        alto +
        alturaInfo;


    const ctx =
        canvas.getContext(
            "2d"
        );


    // FOTO

    ctx.drawImage(

        imagen,

        0,
        0,

        ancho,
        alto

    );


    // FONDO

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

        "🛡️ RONDA DE SEGURIDAD",

        30,

        alto + 40

    );


    ctx.font =
        "22px Arial";


    ctx.fillText(

        `📍 ${datosRonda.punto.nombre} — ${datosRonda.punto.codigo}`,

        30,

        alto + 80

    );


    ctx.fillText(

        `👮 ${datosRonda.agente.nombre} — ${datosRonda.agente.codigo}`,

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

        `📅 ${fecha}  🕐 ${hora}`,

        30,

        alto + 150

    );


    ctx.fillText(

        `📍 GPS verificado — ${ubicacion.distanciaPunto.toFixed(1)} m`,

        30,

        alto + 185

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

                ✅ Fotografía preparada

                <br>

                📍 Distancia:
                ${ubicacion.distanciaPunto.toFixed(1)} m

            `;

        },


        "image/jpeg",

        0.85

    );
}


// ========================================
// 10. REGISTRAR RONDA
// ========================================

btnRegistrar.addEventListener(
    "click",
    registrarRonda
);


async function registrarRonda() {

    if (!ubicacion) {

        mostrarError(
            "No tenemos la ubicación GPS."
        );

        return;
    }


    // SEGURIDAD:
    // comprobamos otra vez la posición
    // justo antes de registrar.

    if (
        ubicacion.dentroDelRadio !== true ||
        gpsValidado !== true
    ) {

        mostrarError(
            "No puedes registrar la ronda porque no estás dentro del área autorizada."
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


            precisionGPS:
                ubicacion.precision,


            distanciaPunto:
                ubicacion.distanciaPunto,


            radioPermitido:
                ubicacion.radioMetros,


            gpsValidado:
                true,


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


        // Una vez registrada dejamos
        // de vigilar el GPS.

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

            ✅ <strong>Ronda registrada correctamente</strong>

            <br>

            Los datos fueron guardados.

            <br>

            📍 Distancia:
            ${ubicacion.distanciaPunto.toFixed(1)} m

            <br>

            📡 Precisión:
            ±${ubicacion.precision.toFixed(1)} m

            <br>

            La fotografía NO fue almacenada.

        `;


        btnRegistrar.classList.add(
            "d-none"
        );


        btnCompartir.classList.remove(
            "d-none"
        );


    } catch (errorFirebase) {

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
// 11. COMPARTIR EN WHATSAPP
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

📍 GPS: Verificado
📏 Distancia al punto: ${ubicacion.distanciaPunto.toFixed(1)} m
📡 Precisión GPS: ±${ubicacion.precision.toFixed(1)} m
🎯 Radio permitido: ${ubicacion.radioMetros} m

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

                "La función de compartir archivos no está disponible en este navegador. Se descargó la fotografía para que puedas enviarla por WhatsApp."

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
// 12. DESCARGAR RESPALDO
// ========================================

function descargarImagen() {

    const enlace =
        document.createElement(
            "a"
        );


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
// 13. MOSTRAR ERROR
// ========================================

function mostrarError(texto) {

    error.textContent =
        texto;


    error.classList.remove(
        "d-none"
    );
}


// ========================================
// 14. DETENER GPS AL SALIR
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
// 15. INICIAR
// ========================================

if (
    cargarDatos()
) {

    obtenerUbicacion();

}