import { db } from "./firebase.js";

import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ======================================================
// ELEMENTOS DEL MENÚ
// ======================================================

const menuInicio =
    document.getElementById("menuInicio");

const menuRondas =
    document.getElementById("menuRondas");

const menuQR =
    document.getElementById("menuQR");


const seccionInicio =
    document.getElementById("seccionInicio");

const seccionRondas =
    document.getElementById("seccionRondas");

const seccionQR =
    document.getElementById("seccionQR");


// ======================================================
// ELEMENTOS RONDAS
// ======================================================

const listaRondas =
    document.getElementById("listaRondas");

const cargando =
    document.getElementById("cargando");

const error =
    document.getElementById("error");

const totalRondas =
    document.getElementById("totalRondas");

const rondasHoy =
    document.getElementById("rondasHoy");

const totalAgentes =
    document.getElementById("totalAgentes");

const totalPuntos =
    document.getElementById("totalPuntos");

const buscador =
    document.getElementById("buscador");

const btnActualizar =
    document.getElementById("btnActualizar");


// ======================================================
// ELEMENTOS QR
// ======================================================

const qrCodigo =
    document.getElementById("qrCodigo");

const qrNombre =
    document.getElementById("qrNombre");

const btnGenerarQR =
    document.getElementById("btnGenerarQR");

const qrResultado =
    document.getElementById("qrResultado");

const qrError =
    document.getElementById("qrError");

const codigoQR =
    document.getElementById("codigoQR");

const qrNombreVisual =
    document.getElementById("qrNombreVisual");

const qrCodigoVisual =
    document.getElementById("qrCodigoVisual");

const qrUrl =
    document.getElementById("qrUrl");

const btnDescargarQR =
    document.getElementById("btnDescargarQR");

const btnImprimirQR =
    document.getElementById("btnImprimirQR");


// ======================================================
// VARIABLES
// ======================================================

let rondas = [];

let urlQRActual = "";


// ======================================================
// CAMBIAR SECCIÓN
// ======================================================

function mostrarSeccion(nombre) {

    seccionInicio.classList.remove("activa");
    seccionRondas.classList.remove("activa");
    seccionQR.classList.remove("activa");

    menuInicio.classList.remove("activo");
    menuRondas.classList.remove("activo");
    menuQR.classList.remove("activo");


    if (nombre === "inicio") {

        seccionInicio.classList.add("activa");
        menuInicio.classList.add("activo");
    }


    if (nombre === "rondas") {

        seccionRondas.classList.add("activa");
        menuRondas.classList.add("activo");
    }


    if (nombre === "qr") {

        seccionQR.classList.add("activa");
        menuQR.classList.add("activo");
    }
}


// ======================================================
// MENÚ
// ======================================================

menuInicio.addEventListener(
    "click",
    function () {

        mostrarSeccion("inicio");
    }
);


menuRondas.addEventListener(
    "click",
    function () {

        mostrarSeccion("rondas");
    }
);


menuQR.addEventListener(
    "click",
    function () {

        mostrarSeccion("qr");
    }
);


// ======================================================
// CARGAR RONDAS
// ======================================================

async function cargarRondas() {

    ocultarError();

    cargando.style.display =
        "block";

    listaRondas.innerHTML =
        "";


    try {

        const referencia =
            collection(
                db,
                "rondas"
            );


        const consulta =
            query(
                referencia,
                orderBy(
                    "timestamp",
                    "desc"
                ),
                limit(100)
            );


        const resultado =
            await getDocs(
                consulta
            );


        rondas = [];


        resultado.forEach(
            function (documento) {

                const datos =
                    documento.data();


                rondas.push({

                    id:
                        documento.id,

                    ...datos

                });
            }
        );


        cargando.style.display =
            "none";


        actualizarResumen();

        mostrarRondas(
            rondas
        );


    } catch (e) {

        console.error(
            "Error cargando rondas:",
            e
        );


        cargando.style.display =
            "none";


        mostrarError(
            "No se pudieron cargar las rondas. " +
            e.message
        );
    }
}


// ======================================================
// RESUMEN
// ======================================================

function actualizarResumen() {

    totalRondas.textContent =
        rondas.length;


    const agentes =
        new Set();


    const puntos =
        new Set();


    let contadorHoy =
        0;


    const hoy =
        fechaLocalActual();


    rondas.forEach(
        function (ronda) {

            if (ronda.agenteId) {

                agentes.add(
                    ronda.agenteId
                );
            }


            if (ronda.puntoId) {

                puntos.add(
                    ronda.puntoId
                );
            }


            if (
                ronda.fecha === hoy
            ) {

                contadorHoy++;
            }
        }
    );


    rondasHoy.textContent =
        contadorHoy;


    totalAgentes.textContent =
        agentes.size;


    totalPuntos.textContent =
        puntos.size;
}


// ======================================================
// FECHA
// ======================================================

function fechaLocalActual() {

    const fecha =
        new Date();


    const dia =
        String(
            fecha.getDate()
        ).padStart(
            2,
            "0"
        );


    const mes =
        String(
            fecha.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const anio =
        fecha.getFullYear();


    return (
        dia +
        "/" +
        mes +
        "/" +
        anio
    );
}


// ======================================================
// MOSTRAR RONDAS
// ======================================================

function mostrarRondas(datos) {

    listaRondas.innerHTML =
        "";


    if (
        datos.length === 0
    ) {

        const vacio =
            document.createElement(
                "div"
            );


        vacio.className =
            "sin-resultados";


        vacio.textContent =
            "No se encontraron rondas.";


        listaRondas.appendChild(
            vacio
        );


        return;
    }


    datos.forEach(
        function (ronda) {

            crearTarjetaRonda(
                ronda
            );
        }
    );
}


// ======================================================
// TARJETA DE RONDA
// ======================================================

function crearTarjetaRonda(ronda) {

    const tarjeta =
        document.createElement(
            "div"
        );


    tarjeta.className =
        "ronda";


    const superior =
        document.createElement(
            "div"
        );


    superior.className =
        "ronda-superior";


    const agente =
        document.createElement(
            "div"
        );


    agente.className =
        "agente";


    agente.textContent =
        "👮 " +
        (
            ronda.agenteNombre ||
            "Agente sin nombre"
        );


    const estado =
        document.createElement(
            "span"
        );


    estado.className =
        "estado";


    estado.textContent =
        "✅ " +
        (
            ronda.estado ||
            "completada"
        );


    superior.appendChild(
        agente
    );


    superior.appendChild(
        estado
    );


    const detalle =
        document.createElement(
            "div"
        );


    detalle.className =
        "detalle";


    agregarLinea(
        detalle,
        "📍 Punto: ",
        ronda.puntoNombre || "-"
    );


    agregarLinea(
        detalle,
        "🔲 Código: ",
        ronda.puntoCodigo ||
        ronda.puntoId ||
        "-"
    );


    agregarLinea(
        detalle,
        "📅 Fecha: ",
        ronda.fecha || "-"
    );


    agregarLinea(
        detalle,
        "🕐 Hora: ",
        ronda.hora || "-"
    );


    agregarLinea(
        detalle,
        "📌 Dirección: ",
        ronda.direccion ||
        "Dirección no disponible"
    );


    tarjeta.appendChild(
        superior
    );


    tarjeta.appendChild(
        detalle
    );


    listaRondas.appendChild(
        tarjeta
    );
}


// ======================================================
// AGREGAR LÍNEA
// ======================================================

function agregarLinea(
    contenedor,
    titulo,
    valor
) {

    const linea =
        document.createElement(
            "div"
        );


    const fuerte =
        document.createElement(
            "strong"
        );


    fuerte.textContent =
        titulo;


    const texto =
        document.createTextNode(
            String(valor)
        );


    linea.appendChild(
        fuerte
    );


    linea.appendChild(
        texto
    );


    contenedor.appendChild(
        linea
    );
}


// ======================================================
// FILTRAR
// ======================================================

function filtrarRondas() {

    const texto =
        buscador.value
            .trim()
            .toLowerCase();


    if (!texto) {

        mostrarRondas(
            rondas
        );

        return;
    }


    const filtradas =
        rondas.filter(
            function (ronda) {

                const contenido = [

                    ronda.agenteNombre,
                    ronda.puntoNombre,
                    ronda.puntoCodigo,
                    ronda.puntoId,
                    ronda.fecha,
                    ronda.hora,
                    ronda.direccion

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                return contenido.includes(
                    texto
                );
            }
        );


    mostrarRondas(
        filtradas
    );
}


// ======================================================
// ERROR PANEL
// ======================================================

function mostrarError(texto) {

    error.textContent =
        texto;


    error.style.display =
        "block";
}


function ocultarError() {

    error.style.display =
        "none";
}


// ======================================================
// ERROR QR
// ======================================================

function mostrarErrorQR(texto) {

    qrError.textContent =
        texto;


    qrError.style.display =
        "block";
}


function ocultarErrorQR() {

    qrError.style.display =
        "none";
}


// ======================================================
// GENERAR QR VISUAL
// ======================================================

function crearQRVisual(
    codigo,
    nombre
) {

    urlQRActual =
        window.location.origin +
        "/ronda.html?punto=" +
        encodeURIComponent(
            codigo
        );


    codigoQR.innerHTML =
        "";


    new window.QRCode(
        codigoQR,
        {
            text:
                urlQRActual,

            width:
                260,

            height:
                260,

            correctLevel:
                window.QRCode
                    .CorrectLevel
                    .H
        }
    );


    qrNombreVisual.textContent =
        nombre;


    qrCodigoVisual.textContent =
        "Código: " +
        codigo;


    qrUrl.textContent =
        urlQRActual;


    qrResultado.style.display =
        "block";
}


// ======================================================
// GUARDAR PUNTO + GENERAR QR
// ======================================================

async function guardarPuntoYGenerarQR() {

    ocultarErrorQR();


    const codigo =
        qrCodigo.value
            .trim()
            .toUpperCase();


    const nombre =
        qrNombre.value
            .trim();


    if (!codigo) {

        mostrarErrorQR(
            "Ingresa el código del punto."
        );

        qrCodigo.focus();

        return;
    }


    if (!nombre) {

        mostrarErrorQR(
            "Ingresa el nombre del punto."
        );

        qrNombre.focus();

        return;
    }


    // Solo P01, P02, P03, P100...

    if (
        !/^P\d+$/.test(codigo)
    ) {

        mostrarErrorQR(
            "El código debe tener formato P01, P02, P03..."
        );

        qrCodigo.focus();

        return;
    }


    if (
        typeof window.QRCode ===
        "undefined"
    ) {

        mostrarErrorQR(
            "No se pudo cargar el generador QR."
        );

        return;
    }


    btnGenerarQR.disabled =
        true;


    btnGenerarQR.textContent =
        "GUARDANDO PUNTO...";


    try {

        // Documento puntos/P01, puntos/P02...

        const referenciaPunto =
            doc(
                db,
                "puntos",
                codigo
            );


        const existente =
            await getDoc(
                referenciaPunto
            );


        // ==========================================
        // SI YA EXISTE
        // ==========================================

        if (existente.exists()) {

            const datos =
                existente.data();


            if (
                datos.activo !== true
            ) {

                throw new Error(
                    "El punto " +
                    codigo +
                    " ya existe pero está desactivado."
                );
            }


            // Generamos el QR del punto existente

            crearQRVisual(
                codigo,
                datos.nombre || nombre
            );


            mostrarMensajeQRExito(
                "✅ El punto " +
                codigo +
                " ya existía. Se generó nuevamente su QR."
            );


            return;
        }


        // ==========================================
        // CREAR NUEVO PUNTO
        // ==========================================

        await setDoc(
            referenciaPunto,
            {
                codigo:
                    codigo,

                nombre:
                    nombre,

                activo:
                    true,

                creadoEn:
                    serverTimestamp()
            }
        );


        // ==========================================
        // QR
        // ==========================================

        crearQRVisual(
            codigo,
            nombre
        );


        mostrarMensajeQRExito(
            "✅ Punto " +
            codigo +
            " creado correctamente en Firebase. El QR ya está listo."
        );


    } catch (e) {

        console.error(
            "Error creando punto:",
            e
        );


        mostrarErrorQR(
            "No se pudo crear el punto: " +
            e.message
        );


    } finally {

        btnGenerarQR.disabled =
            false;


        btnGenerarQR.textContent =
            "💾 GUARDAR PUNTO Y GENERAR QR";
    }
}


// ======================================================
// MENSAJE DE ÉXITO QR
// ======================================================

function mostrarMensajeQRExito(
    texto
) {

    qrError.textContent =
        texto;


    qrError.style.display =
        "block";


    qrError.style.background =
        "#d1e7dd";


    qrError.style.color =
        "#0f5132";
}


// ======================================================
// RESTABLECER ESTILO MENSAJE
// ======================================================

function restaurarMensajeQR() {

    qrError.style.background =
        "#fee2e2";


    qrError.style.color =
        "#991b1b";
}


qrCodigo.addEventListener(
    "input",
    restaurarMensajeQR
);


qrNombre.addEventListener(
    "input",
    restaurarMensajeQR
);


// ======================================================
// DESCARGAR QR
// ======================================================

function descargarQRAdmin() {

    const canvas =
        codigoQR.querySelector(
            "canvas"
        );


    const imagen =
        codigoQR.querySelector(
            "img"
        );


    let dataURL =
        "";


    if (canvas) {

        dataURL =
            canvas.toDataURL(
                "image/png"
            );

    } else if (imagen) {

        dataURL =
            imagen.src;

    } else {

        restaurarMensajeQR();

        mostrarErrorQR(
            "Primero genera un código QR."
        );

        return;
    }


    const codigo =
        qrCodigo.value
            .trim()
            .toUpperCase();


    const enlace =
        document.createElement(
            "a"
        );


    enlace.href =
        dataURL;


    enlace.download =
        "QR_" +
        codigo +
        ".png";


    document.body.appendChild(
        enlace
    );


    enlace.click();


    enlace.remove();
}


// ======================================================
// IMPRIMIR QR
// ======================================================

function imprimirQRAdmin() {

    if (!urlQRActual) {

        restaurarMensajeQR();

        mostrarErrorQR(
            "Primero genera un código QR."
        );

        return;
    }


    const area =
        document.getElementById(
            "areaQR"
        );


    const contenido =
        area.outerHTML;


    const ventana =
        window.open(
            "",
            "_blank"
        );


    if (!ventana) {

        restaurarMensajeQR();

        mostrarErrorQR(
            "El navegador bloqueó la ventana de impresión."
        );

        return;
    }


    ventana.document.write(
        `
        <!DOCTYPE html>

        <html lang="es">

        <head>

            <meta charset="UTF-8">

            <title>
                QR Punto de Control
            </title>

            <style>

                body {
                    margin: 0;
                    padding: 40px;
                    font-family: Arial, sans-serif;
                    text-align: center;
                }

                .area-qr {
                    display: inline-block;
                    border: 2px solid #111;
                    border-radius: 12px;
                    padding: 25px;
                }

                .qr-titulo {
                    font-size: 21px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }

                .qr-nombre {
                    font-size: 19px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .qr-codigo {
                    margin-bottom: 15px;
                }

                .qr-url {
                    max-width: 300px;
                    margin: 15px auto 0;
                    font-size: 11px;
                    word-break: break-all;
                }

            </style>

        </head>

        <body>

            ${contenido}

        </body>

        </html>
        `
    );


    ventana.document.close();


    setTimeout(
        function () {

            ventana.focus();

            ventana.print();

        },
        500
    );
}


// ======================================================
// EVENTOS
// ======================================================

buscador.addEventListener(
    "input",
    filtrarRondas
);


btnActualizar.addEventListener(
    "click",
    cargarRondas
);


btnGenerarQR.addEventListener(
    "click",
    guardarPuntoYGenerarQR
);


btnDescargarQR.addEventListener(
    "click",
    descargarQRAdmin
);


btnImprimirQR.addEventListener(
    "click",
    imprimirQRAdmin
);


// ======================================================
// ENTER
// ======================================================

qrCodigo.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            guardarPuntoYGenerarQR();
        }
    }
);


qrNombre.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            guardarPuntoYGenerarQR();
        }
    }
);


// ======================================================
// INICIAR
// ======================================================

cargarRondas();