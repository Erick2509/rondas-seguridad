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
// 1. RECUPERAR DATOS
// ========================================

function cargarDatos() {

    const datos =
        sessionStorage.getItem("rondaActual");


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
// 2. OBTENER GPS
// ========================================

function obtenerUbicacion() {

    if (!navigator.geolocation) {

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


            ubicacion = {
                latitud,
                longitud,
                precision
            };


            gps.className =
                "alert alert-success";

            gps.innerHTML = `
                ✅ <strong>Ubicación obtenida</strong>
                <br>
                Latitud: ${latitud.toFixed(6)}
                <br>
                Longitud: ${longitud.toFixed(6)}
                <br>
                Precisión: ±${Math.round(precision)} metros
            `;


            seccionFoto.classList.remove("d-none");

        },

        errorGPS => {

            console.error(errorGPS);

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
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
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


function manejarFoto(event) {

    const archivo =
        event.target.files[0];


    if (!archivo) {
        return;
    }


    const lector =
        new FileReader();


    lector.onload = function(e) {

        const imagen =
            new Image();


        imagen.onload = function() {

            generarImagenFinal(
                imagen
            );

        };


        imagen.src =
            e.target.result;

    };


    lector.readAsDataURL(archivo);
}


// ========================================
// 4. GENERAR FOTO CON INFORMACIÓN
// ========================================

function generarImagenFinal(imagen) {

    const anchoMaximo = 1200;

    let ancho =
        imagen.width;

    let alto =
        imagen.height;


    if (ancho > anchoMaximo) {

        const proporcion =
            anchoMaximo / ancho;

        ancho =
            anchoMaximo;

        alto =
            alto * proporcion;
    }


    const alturaInfo = 230;


    canvas.width =
        ancho;

    canvas.height =
        alto + alturaInfo;


    const ctx =
        canvas.getContext("2d");


    // Foto

    ctx.drawImage(
        imagen,
        0,
        0,
        ancho,
        alto
    );


    // Fondo de información

    ctx.fillStyle =
        "#111827";

    ctx.fillRect(
        0,
        alto,
        ancho,
        alturaInfo
    );


    // Texto

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
        "📍 GPS: Ubicación registrada",
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


            estado:
                "completada",

            timestamp:
                serverTimestamp()

        };


        await addDoc(
            collection(db, "rondas"),
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
// 6. COMPARTIR
// ========================================

btnCompartir.addEventListener(
    "click",
    compartirWhatsApp
);


async function compartirWhatsApp() {

    if (!rondaRegistrada) {

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


    const mensaje = `🛡️ RONDA DE SEGURIDAD

👮 Agente: ${datosRonda.agente.nombre}
🔢 Código: ${datosRonda.agente.codigo}

📍 Punto: ${datosRonda.punto.nombre}
🔲 Código: ${datosRonda.punto.codigo}

📅 Fecha: ${fecha}
🕐 Hora: ${hora}

📍 GPS: Verificado
✅ Punto registrado`;


    const archivo =
        new File(
            [imagenFinal],
            `ronda-${datosRonda.punto.codigo}-${Date.now()}.jpg`,
            {
                type: "image/jpeg"
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

                text: mensaje,

                files: [archivo]

            });


        } else {

            // Fallback

            descargarImagen();

            alert(
                "La función de compartir archivos no está disponible en este navegador. Se descargó la fotografía para que puedas enviarla por WhatsApp."
            );

        }


    } catch (errorCompartir) {

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
// ERROR
// ========================================

function mostrarError(texto) {

    error.textContent =
        texto;

    error.classList.remove(
        "d-none"
    );

}


// ========================================
// INICIAR
// ========================================

if (cargarDatos()) {

    obtenerUbicacion();

}