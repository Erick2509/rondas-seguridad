import { db } from "./firebase.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ======================================================
// ELEMENTOS
// ======================================================

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


// ======================================================
// VARIABLES
// ======================================================

let datosRonda = null;

let ubicacionActual = null;

let direccionActual =
    "Ubicación no disponible";

let imagenFinal = null;

let rondaRegistrada = false;

let gpsWatchId = null;

let fechaFoto = null;


// ======================================================
// 1. CARGAR DATOS DE LA RONDA
// ======================================================

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


    try {

        datosRonda =
            JSON.parse(datos);

    } catch (e) {

        mostrarError(
            "Los datos de la ronda no son válidos."
        );

        return false;
    }


    if (
        !datosRonda.agente ||
        !datosRonda.punto
    ) {

        mostrarError(
            "Faltan datos del agente o del punto."
        );

        return false;
    }


    // ==================================================
    // COMPATIBILIDAD CON AGENTES ANTIGUOS
    // ==================================================

    datosRonda.agente.cargo =
        datosRonda.agente.cargo ||
        "No registrado";

    datosRonda.agente.turno =
        datosRonda.agente.turno ||
        "No registrado";


    // ==================================================
    // INFORMACIÓN MOSTRADA EN CAMARA.HTML
    // ==================================================

    informacion.innerHTML = `

        <strong>👮 Nombre:</strong>
        ${datosRonda.agente.nombre}

        <br>

        <strong>🦺 Cargo:</strong>
        ${datosRonda.agente.cargo}

        <br>

        <strong>🕐 Turno:</strong>
        ${datosRonda.agente.turno}

        <br>

        <strong>📍 Punto:</strong>
        ${datosRonda.punto.nombre}

        <br>

        <strong>🔲 Código del punto:</strong>
        ${datosRonda.punto.codigo}

        <br>

        <strong>📱 QR:</strong>
        Validado

    `;


    return true;
}


// ======================================================
// 2. INICIAR GPS
// ======================================================

function iniciarGPS() {

    // La cámara se habilita inmediatamente.

    seccionFoto.classList.remove(
        "d-none"
    );


    if (!navigator.geolocation) {

        gps.className =
            "alert alert-warning";


        gps.innerHTML = `

            ⚠️ <strong>Ubicación no disponible</strong>

            <br>

            Puedes tomar la fotografía,
            pero el dispositivo no permite obtener GPS.

        `;


        return;
    }


    gps.className =
        "alert alert-info";


    gps.innerHTML = `

        📍 <strong>UBICACIÓN ACTIVADA</strong>

        <br>

        🔄 Obteniendo ubicación actual...

        <br><br>

        Puedes tomar la fotografía.

    `;


    gpsWatchId =
        navigator.geolocation.watchPosition(

            posicion => {

                ubicacionActual = {

                    latitud:
                        posicion.coords.latitude,

                    longitud:
                        posicion.coords.longitude
                };


                gps.className =
                    "alert alert-success";


                gps.innerHTML = `

                    📍 <strong>UBICACIÓN LISTA</strong>

                    <br>

                    🔄 GPS actualizado en tiempo real

                    <br><br>

                    📸 Ya puedes tomar la fotografía.

                `;
            },


            errorGPS => {

                console.error(
                    "Error GPS:",
                    errorGPS
                );


                gps.className =
                    "alert alert-warning";


                gps.innerHTML = `

                    ⚠️ <strong>No se pudo obtener la ubicación.</strong>

                    <br>

                    Puedes tomar la fotografía,
                    pero intenta activar la ubicación
                    del celular para registrar la dirección.

                `;
            },


            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );
}


// ======================================================
// 3. OBTENER DIRECCIÓN
// ======================================================

async function obtenerDireccion(
    latitud,
    longitud
) {

    try {

        const url =
            "https://nominatim.openstreetmap.org/reverse" +
            "?format=jsonv2" +
            "&addressdetails=1" +
            "&zoom=18" +
            "&accept-language=es" +
            "&lat=" +
            encodeURIComponent(latitud) +
            "&lon=" +
            encodeURIComponent(longitud);


        const respuesta =
            await fetch(url);


        if (!respuesta.ok) {

            throw new Error(
                "No se pudo consultar la dirección."
            );
        }


        const datos =
            await respuesta.json();


        const a =
            datos.address || {};


        const calle =
            a.road ||
            a.pedestrian ||
            a.residential ||
            a.footway ||
            a.path ||
            "";


        const numero =
            a.house_number ||
            "";


        const zona =
            a.neighbourhood ||
            a.suburb ||
            a.quarter ||
            a.city_district ||
            a.district ||
            "";


        const ciudad =
            a.city ||
            a.town ||
            a.village ||
            a.municipality ||
            "";


        const region =
            a.state ||
            a.region ||
            "";


        const pais =
            a.country ||
            "";


        const partes =
            [];


        if (calle) {

            if (numero) {

                partes.push(
                    `${calle} ${numero}`
                );

            } else {

                partes.push(
                    calle
                );
            }
        }


        if (
            zona &&
            !partes.includes(zona)
        ) {

            partes.push(
                zona
            );
        }


        if (
            ciudad &&
            !partes.includes(ciudad)
        ) {

            partes.push(
                ciudad
            );
        }


        if (
            region &&
            !partes.includes(region)
        ) {

            partes.push(
                region
            );
        }


        if (
            pais &&
            !partes.includes(pais)
        ) {

            partes.push(
                pais
            );
        }


        if (
            partes.length > 0
        ) {

            return partes.join(
                ", "
            );
        }


        if (
            datos.display_name
        ) {

            return datos.display_name;
        }


        return "Dirección no encontrada";


    } catch (e) {

        console.error(
            "Error obteniendo dirección:",
            e
        );


        return "Dirección no disponible";
    }
}


// ======================================================
// 4. SELECCIONAR / TOMAR FOTOGRAFÍA
// ======================================================

fotoInput.addEventListener(
    "change",
    manejarFoto
);


async function manejarFoto(event) {

    const archivo =
        event.target.files[0];


    if (!archivo) {

        return;
    }


    estado.className =
        "alert alert-info mt-3";


    estado.innerHTML = `

        📍 <strong>Obteniendo dirección...</strong>

        <br>

        Preparando evidencia...

    `;


    // ==================================================
    // GUARDAR FECHA Y HORA EXACTA DE LA FOTO
    // ==================================================

    fechaFoto =
        new Date();


    // ==================================================
    // OBTENER DIRECCIÓN
    // ==================================================

    if (ubicacionActual) {

        direccionActual =
            await obtenerDireccion(

                ubicacionActual.latitud,

                ubicacionActual.longitud
            );

    } else {

        direccionActual =
            "Ubicación GPS no disponible";
    }


    // ==================================================
    // LEER FOTO
    // ==================================================

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


// ======================================================
// 5. ESCRIBIR TEXTO EN VARIAS LÍNEAS
// ======================================================

function escribirTextoEnLineas(
    ctx,
    texto,
    x,
    y,
    anchoMaximo,
    alturaLinea
) {

    const palabras =
        String(texto)
            .split(" ");


    let linea =
        "";


    let posicionY =
        y;


    for (
        let i = 0;
        i < palabras.length;
        i++
    ) {

        const prueba =
            linea +
            palabras[i] +
            " ";


        const medida =
            ctx.measureText(
                prueba
            );


        if (
            medida.width >
                anchoMaximo &&
            i > 0
        ) {

            ctx.fillText(
                linea.trim(),
                x,
                posicionY
            );


            linea =
                palabras[i] +
                " ";


            posicionY +=
                alturaLinea;

        } else {

            linea =
                prueba;
        }
    }


    ctx.fillText(
        linea.trim(),
        x,
        posicionY
    );


    return posicionY;
}


// ======================================================
// 6. GENERAR IMAGEN FINAL
// ======================================================

function generarImagenFinal(imagen) {

    const anchoMaximo =
        1200;


    let ancho =
        imagen.width;


    let alto =
        imagen.height;


    // ==================================================
    // REDUCIR FOTO SI ES MUY GRANDE
    // ==================================================

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


    // ==================================================
    // ESPACIO INFERIOR PARA LA MARCA DE AGUA
    //
    // Nombre
    // Cargo
    // Turno
    // Punto
    // Fecha
    // Hora
    // Ubicación
    // ==================================================

    const alturaInfo =
        480;


    canvas.width =
        ancho;


    canvas.height =
        alto +
        alturaInfo;


    const ctx =
        canvas.getContext(
            "2d"
        );


    // ==================================================
    // DIBUJAR FOTOGRAFÍA
    // ==================================================

    ctx.drawImage(
        imagen,
        0,
        0,
        ancho,
        alto
    );


    // ==================================================
    // FONDO DE INFORMACIÓN
    // ==================================================

    ctx.fillStyle =
        "#111827";


    ctx.fillRect(
        0,
        alto,
        ancho,
        alturaInfo
    );


    // ==================================================
    // TEXTO BLANCO
    // ==================================================

    ctx.fillStyle =
        "#ffffff";


    // ==================================================
    // TÍTULO
    // ==================================================

    ctx.font =
        "bold 30px Arial";


    ctx.fillText(
        "🛡️ RONDA DE SEGURIDAD",
        30,
        alto + 45
    );


    // ==================================================
    // DATOS
    // ==================================================

    ctx.font =
        "22px Arial";


    // ==================================================
    // NOMBRE DEL AGENTE
    // ==================================================

    ctx.fillText(
        `👮 ${datosRonda.agente.nombre}`,
        30,
        alto + 90
    );


    // ==================================================
    // CARGO
    // ==================================================

    ctx.fillText(
        `🦺 ${datosRonda.agente.cargo}`,
        30,
        alto + 130
    );


    // ==================================================
    // TURNO
    // ==================================================

    ctx.fillText(
        `🕐 ${datosRonda.agente.turno}`,
        30,
        alto + 170
    );


    // ==================================================
    // PUNTO
    // ==================================================

    ctx.fillText(
        `📍 ${datosRonda.punto.nombre}`,
        30,
        alto + 210
    );


    // ==================================================
    // FECHA
    // ==================================================

    const fecha =
        fechaFoto.toLocaleDateString(
            "es-PE"
        );


    const hora =
        fechaFoto.toLocaleTimeString(
            "es-PE"
        );


    ctx.fillText(
        `📅 Fecha: ${fecha}`,
        30,
        alto + 250
    );


    // ==================================================
    // HORA
    // ==================================================

    ctx.fillText(
        `🕐 Hora: ${hora}`,
        30,
        alto + 290
    );


    // ==================================================
    // UBICACIÓN
    // ==================================================

    escribirTextoEnLineas(

        ctx,

        `📌 ${direccionActual}`,

        30,

        alto + 335,

        ancho - 60,

        30
    );


    // ==================================================
    // CONVERTIR A JPG
    // ==================================================

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

                <br><br>

                👮 ${datosRonda.agente.nombre}

                <br>

                🦺 ${datosRonda.agente.cargo}

                <br>

                🕐 ${datosRonda.agente.turno}

                <br>

                📍 ${datosRonda.punto.nombre}

                <br>

                📅 Fecha: ${fecha}

                <br>

                🕐 Hora: ${hora}

                <br>

                📌 ${direccionActual}

            `;
        },


        "image/jpeg",

        0.88
    );
}


// ======================================================
// 7. REGISTRAR RONDA
// ======================================================

btnRegistrar.addEventListener(
    "click",
    registrarRonda
);


async function registrarRonda() {

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

        const fechaRegistro =
            fechaFoto ||
            new Date();


        const datos = {

            // ==========================================
            // AGENTE
            // ==========================================

            agenteId:
                datosRonda.agente.id,

            agenteNombre:
                datosRonda.agente.nombre,

            agenteCargo:
                datosRonda.agente.cargo,

            agenteTurno:
                datosRonda.agente.turno,


            // ==========================================
            // PUNTO
            // ==========================================

            puntoId:
                datosRonda.punto.id,

            puntoCodigo:
                datosRonda.punto.codigo,

            puntoNombre:
                datosRonda.punto.nombre,


            // ==========================================
            // FECHA Y HORA
            // ==========================================

            fecha:
                fechaRegistro
                    .toLocaleDateString(
                        "es-PE"
                    ),

            hora:
                fechaRegistro
                    .toLocaleTimeString(
                        "es-PE"
                    ),


            // ==========================================
            // UBICACIÓN
            // ==========================================

            direccion:
                direccionActual,


            latitud:
                ubicacionActual
                    ? ubicacionActual.latitud
                    : null,


            longitud:
                ubicacionActual
                    ? ubicacionActual.longitud
                    : null,


            // ==========================================
            // QR
            // ==========================================

            qrValidado:
                true,


            metodoValidacion:
                "QR_FISICO",


            // ==========================================
            // ESTADO
            // ==========================================

            estado:
                "completada",


            timestamp:
                serverTimestamp()
        };


        // ==================================================
        // GUARDAR EN FIRESTORE
        // ==================================================

        await addDoc(

            collection(
                db,
                "rondas"
            ),

            datos
        );


        rondaRegistrada =
            true;


        // ==================================================
        // DETENER GPS
        // ==================================================

        if (
            gpsWatchId !== null
        ) {

            navigator.geolocation
                .clearWatch(
                    gpsWatchId
                );


            gpsWatchId =
                null;
        }


        // ==================================================
        // MENSAJE DE ÉXITO
        // ==================================================

        estado.className =
            "alert alert-success mt-3";


        estado.innerHTML = `

            ✅ <strong>RONDA REGISTRADA</strong>

            <br><br>

            👮 ${datosRonda.agente.nombre}

            <br>

            🦺 ${datosRonda.agente.cargo}

            <br>

            🕐 ${datosRonda.agente.turno}

            <br>

            📍 ${datosRonda.punto.nombre}

            <br>

            📅 Fecha:
            ${fechaRegistro.toLocaleDateString("es-PE")}

            <br>

            🕐 Hora:
            ${fechaRegistro.toLocaleTimeString("es-PE")}

            <br>

            📌 ${direccionActual}

            <br><br>

            📱 QR físico: VALIDADO

            <br>

            📸 Evidencia registrada

        `;


        btnRegistrar.classList.add(
            "d-none"
        );


        btnCompartir.classList.remove(
            "d-none"
        );


    } catch (errorFirebase) {

        console.error(
            "Error registrando ronda:",
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


// ======================================================
// 8. COMPARTIR
// ======================================================

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


    const fecha =
        fechaFoto.toLocaleDateString(
            "es-PE"
        );


    const hora =
        fechaFoto.toLocaleTimeString(
            "es-PE"
        );


    // ==================================================
    // MENSAJE PARA WHATSAPP
    // ==================================================

    const mensaje =
`🛡️ RONDA DE SEGURIDAD

👮 ${datosRonda.agente.nombre}
🦺 ${datosRonda.agente.cargo}
🕐 ${datosRonda.agente.turno}
📍 ${datosRonda.punto.nombre}
📅 Fecha: ${fecha}
🕐 Hora: ${hora}
📌 ${direccionActual}

📱 QR físico: VALIDADO
📸 Evidencia registrada`;


    // ==================================================
    // CREAR ARCHIVO JPG
    // ==================================================

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

        // ==================================================
        // COMPARTIR FOTO + TEXTO
        // ==================================================

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

            // ==================================================
            // NAVEGADOR SIN SOPORTE
            // ==================================================

            descargarImagen();


            alert(
                "Este navegador no permite compartir directamente. " +
                "La fotografía fue descargada."
            );
        }


    } catch (errorCompartir) {

        console.log(
            "Compartir cancelado:",
            errorCompartir
        );
    }
}


// ======================================================
// 9. DESCARGAR FOTO
// ======================================================

function descargarImagen() {

    if (!imagenFinal) {

        return;
    }


    const enlace =
        document.createElement(
            "a"
        );


    const url =
        URL.createObjectURL(
            imagenFinal
        );


    enlace.href =
        url;


    enlace.download =
        "evidencia-ronda.jpg";


    document.body.appendChild(
        enlace
    );


    enlace.click();


    enlace.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },

        1000
    );
}


// ======================================================
// 10. MOSTRAR ERROR
// ======================================================

function mostrarError(texto) {

    error.textContent =
        texto;


    error.classList.remove(
        "d-none"
    );
}


// ======================================================
// 11. DETENER GPS AL SALIR
// ======================================================

window.addEventListener(

    "pagehide",

    () => {

        if (
            gpsWatchId !== null
        ) {

            navigator.geolocation
                .clearWatch(
                    gpsWatchId
                );


            gpsWatchId =
                null;
        }
    }
);


// ======================================================
// 12. INICIAR
// ======================================================

if (
    cargarDatos()
) {

    iniciarGPS();
}