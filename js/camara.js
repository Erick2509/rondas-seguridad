import { db } from "./firebase.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


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


let datosRonda = null;

let ubicacion = null;

let imagenFinal = null;

let rondaRegistrada = false;


// ========================================
// CONFIGURACIÓN GPS
// ========================================

const PRECISION_MAXIMA_METROS = 50;


// ========================================
// CALCULAR DISTANCIA
// ========================================

function gradosARadianes(grados) {

    return grados *
        Math.PI /
        180;
}


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
        Math.sin(dLat / 2) +

        Math.cos(
            gradosARadianes(lat1)
        ) *

        Math.cos(
            gradosARadianes(lat2)
        ) *

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
// VALIDAR CERCANÍA
// ========================================

function validarCercania(
    latitud,
    longitud,
    precision
) {

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
            || 30
        );


    if (
        !Number.isFinite(
            latitudPunto
        ) ||

        !Number.isFinite(
            longitudPunto
        )
    ) {

        return {

            valido:
                false,

            motivo:
                "El punto no tiene coordenadas GPS configuradas."

        };
    }


    if (
        precision >
        PRECISION_MAXIMA_METROS
    ) {

        return {

            valido:
                false,

            motivo:
                `La precisión GPS es baja (±${Math.round(precision)} m). ` +
                "Muévete a un lugar con mejor señal e inténtalo otra vez."

        };
    }


    const distancia =
        calcularDistanciaMetros(

            latitud,
            longitud,

            latitudPunto,
            longitudPunto

        );


    return {

        valido:
            distancia <=
            radioMetros,

        distancia:
            distancia,

        radioMetros:
            radioMetros,

        motivo:
            distancia <= radioMetros
                ? ""
                : `Estás a ${Math.round(distancia)} m del punto. ` +
                `Debes estar a ${radioMetros} m o menos.`

    };
}


// ========================================
// 1. RECUPERAR DATOS
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
        JSON.parse(
            datos
        );


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
// 2. OBTENER GPS
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


    navigator.geolocation.getCurrentPosition(

        posicion => {

            const latitud =
                posicion.coords.latitude;


            const longitud =
                posicion.coords.longitude;


            const precision =
                posicion.coords.accuracy;


            const validacion =
                validarCercania(

                    latitud,

                    longitud,

                    precision

                );


            ubicacion = {

                latitud:
                    latitud,

                longitud:
                    longitud,

                precision:
                    precision,

                distanciaPunto:
                    validacion.distancia
                    ?? null,

                radioMetros:
                    validacion.radioMetros
                    ??
                    datosRonda.punto.radioMetros
                    ??
                    30,

                dentroDelRadio:
                    validacion.valido

            };


            if (
                !validacion.valido
            ) {

                gps.className =
                    "alert alert-danger";


                gps.innerHTML = `

                    ❌ <strong>Ubicación no válida</strong>

                    <br>

                    ${validacion.motivo}

                    <br>

                    Precisión:
                    ±${Math.round(precision)} metros

                `;


                seccionFoto.classList.add(
                    "d-none"
                );


                return;
            }


            gps.className =
                "alert alert-success";


            gps.innerHTML = `

                ✅ <strong>GPS verificado</strong>

                <br>

                Distancia al punto:
                ${Math.round(validacion.distancia)} metros

                <br>

                Radio permitido:
                ${validacion.radioMetros} metros

                <br>

                Precisión:
                ±${Math.round(precision)} metros

            `;


            seccionFoto.classList.remove(
                "d-none"
            );

        },


        errorGPS => {

            console.error(
                errorGPS
            );


            gps.className =
                "alert alert-danger";


            gps.innerHTML = `

                ❌ No se pudo obtener tu ubicación.

                <br>

                Debes permitir el acceso a la ubicación
                para continuar.

            `;

        },


        {

            enableHighAccuracy:
                true,

            timeout:
                15000,

            maximumAge:
                0

        }

    );
}


// ========================================
// 3. SELECCIONAR FOTO
// ========================================

fotoInput.addEventListener(
    "change",
    manejarFoto
);


function manejarFoto(
    event
) {

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
// 4. GENERAR FOTO CON INFORMACIÓN
// ========================================

function generarImagenFinal(
    imagen
) {

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

        `📍 GPS verificado — ${Math.round(ubicacion.distanciaPunto)} m`,

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

        },

        "image/jpeg",

        0.85

    );
}


// ========================================
// 5. REGISTRAR RONDA EN FIREBASE
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


    if (
        ubicacion.dentroDelRadio
        !== true
    ) {

        mostrarError(
            "No puedes registrar la ronda porque estás fuera del radio permitido."
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


        estado.className =
            "alert alert-success mt-3";


        estado.innerHTML = `

            ✅ <strong>Ronda registrada correctamente</strong>

            <br>

            Los datos fueron guardados.

            <br>

            Distancia al punto:
            ${Math.round(ubicacion.distanciaPunto)} metros.

            <br>

            La fotografía NO fue almacenada.

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
// 6. COMPARTIR
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
📏 Distancia al punto: ${Math.round(ubicacion.distanciaPunto)} m
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
// 7. DESCARGAR COMO RESPALDO
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
// ERROR
// ========================================

function mostrarError(
    texto
) {

    error.textContent =
        texto;


    error.classList.remove(
        "d-none"
    );

}


// ========================================
// INICIAR
// ========================================

if (
    cargarDatos()
) {

    obtenerUbicacion();

}