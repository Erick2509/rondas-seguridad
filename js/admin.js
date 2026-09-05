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


// =====================================================
// ELEMENTOS DEL MENÚ
// =====================================================

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


// =====================================================
// RONDAS
// =====================================================

const listaRondas =
    document.getElementById("listaRondas");

const cargando =
    document.getElementById("cargando");

const error =
    document.getElementById("error");

const buscador =
    document.getElementById("buscador");

const btnActualizar =
    document.getElementById("btnActualizar");

const totalRondas =
    document.getElementById("totalRondas");

const rondasHoy =
    document.getElementById("rondasHoy");

const totalAgentes =
    document.getElementById("totalAgentes");

const totalPuntos =
    document.getElementById("totalPuntos");


// =====================================================
// QR
// =====================================================

const qrCodigo =
    document.getElementById("qrCodigo");

const qrNombre =
    document.getElementById("qrNombre");

const btnGenerarQR =
    document.getElementById("btnGenerarQR");

const qrError =
    document.getElementById("qrError");

const qrResultado =
    document.getElementById("qrResultado");

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


// =====================================================
// HISTORIAL PUNTOS
// =====================================================

const listaPuntos =
    document.getElementById("listaPuntos");

const cargandoPuntos =
    document.getElementById("cargandoPuntos");

const buscarPunto =
    document.getElementById("buscarPunto");

const btnActualizarPuntos =
    document.getElementById("btnActualizarPuntos");


// =====================================================
// VARIABLES
// =====================================================

let rondas = [];

let puntos = [];

let urlQRActual = "";

let codigoQRActual = "";

let nombreQRActual = "";


// =====================================================
// MENÚ
// =====================================================

function mostrarSeccion(
    nombre
) {

    seccionInicio.classList.remove(
        "activa"
    );

    seccionRondas.classList.remove(
        "activa"
    );

    seccionQR.classList.remove(
        "activa"
    );


    menuInicio.classList.remove(
        "activo"
    );

    menuRondas.classList.remove(
        "activo"
    );

    menuQR.classList.remove(
        "activo"
    );


    if (
        nombre === "inicio"
    ) {

        seccionInicio.classList.add(
            "activa"
        );

        menuInicio.classList.add(
            "activo"
        );
    }


    if (
        nombre === "rondas"
    ) {

        seccionRondas.classList.add(
            "activa"
        );

        menuRondas.classList.add(
            "activo"
        );
    }


    if (
        nombre === "qr"
    ) {

        seccionQR.classList.add(
            "activa"
        );

        menuQR.classList.add(
            "activo"
        );


        cargarPuntos();
    }
}


menuInicio.addEventListener(
    "click",
    function () {

        mostrarSeccion(
            "inicio"
        );
    }
);


menuRondas.addEventListener(
    "click",
    function () {

        mostrarSeccion(
            "rondas"
        );
    }
);


menuQR.addEventListener(
    "click",
    function () {

        mostrarSeccion(
            "qr"
        );
    }
);


// =====================================================
// CARGAR RONDAS
// =====================================================

async function cargarRondas() {

    error.style.display =
        "none";


    cargando.style.display =
        "block";


    listaRondas.innerHTML =
        "";


    try {

        const consulta =
            query(
                collection(
                    db,
                    "rondas"
                ),

                orderBy(
                    "timestamp",
                    "desc"
                ),

                limit(
                    100
                )
            );


        const resultado =
            await getDocs(
                consulta
            );


        rondas =
            [];


        resultado.forEach(
            function (
                documento
            ) {

                rondas.push(
                    {
                        id:
                            documento.id,

                        ...documento.data()
                    }
                );
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


        error.textContent =
            "No se pudieron cargar las rondas: " +
            e.message;


        error.style.display =
            "block";
    }
}


// =====================================================
// RESUMEN
// =====================================================

function actualizarResumen() {

    totalRondas.textContent =
        rondas.length;


    const agentes =
        new Set();


    let contadorHoy =
        0;


    const hoy =
        fechaHoy();


    rondas.forEach(
        function (
            ronda
        ) {

            if (
                ronda.agenteId
            ) {

                agentes.add(
                    ronda.agenteId
                );
            }


            if (
                ronda.fecha ===
                hoy
            ) {

                contadorHoy++;
            }
        }
    );


    totalAgentes.textContent =
        agentes.size;


    rondasHoy.textContent =
        contadorHoy;
}


// =====================================================
// FECHA
// =====================================================

function fechaHoy() {

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


// =====================================================
// MOSTRAR RONDAS
// =====================================================

function mostrarRondas(
    datos
) {

    listaRondas.innerHTML =
        "";


    if (
        datos.length === 0
    ) {

        listaRondas.innerHTML =
            '<div class="sin-resultados">' +
            'No se encontraron rondas.' +
            '</div>';


        return;
    }


    datos.forEach(
        function (
            ronda
        ) {

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
                    "Agente"
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
                ronda.puntoNombre ||
                "-"
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
                ronda.fecha ||
                "-"
            );


            agregarLinea(
                detalle,
                "🕐 Hora: ",
                ronda.hora ||
                "-"
            );


            agregarLinea(
                detalle,
                "📌 Dirección: ",
                ronda.direccion ||
                "-"
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
    );
}


// =====================================================
// AGREGAR LÍNEA SEGURA
// =====================================================

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


    linea.appendChild(
        fuerte
    );


    linea.appendChild(
        document.createTextNode(
            String(
                valor
            )
        )
    );


    contenedor.appendChild(
        linea
    );
}


// =====================================================
// BUSCADOR RONDAS
// =====================================================

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


    const resultado =
        rondas.filter(
            function (
                ronda
            ) {

                const contenido =
                    [
                        ronda.agenteNombre,
                        ronda.puntoNombre,
                        ronda.puntoCodigo,
                        ronda.puntoId,
                        ronda.fecha,
                        ronda.hora,
                        ronda.direccion
                    ]
                        .filter(
                            Boolean
                        )
                        .join(
                            " "
                        )
                        .toLowerCase();


                return contenido.includes(
                    texto
                );
            }
        );


    mostrarRondas(
        resultado
    );
}


buscador.addEventListener(
    "input",
    filtrarRondas
);


btnActualizar.addEventListener(
    "click",
    cargarRondas
);


// =====================================================
// MENSAJES QR
// =====================================================

function ocultarMensajeQR() {

    qrError.style.display =
        "none";


    qrError.classList.remove(
        "exito"
    );
}


function mostrarErrorQR(
    texto
) {

    qrError.classList.remove(
        "exito"
    );


    qrError.textContent =
        texto;


    qrError.style.display =
        "block";
}


function mostrarExitoQR(
    texto
) {

    qrError.classList.add(
        "exito"
    );


    qrError.textContent =
        texto;


    qrError.style.display =
        "block";
}


// =====================================================
// CREAR QR
// =====================================================

function crearQRVisual(
    codigo,
    nombre
) {

    if (
        typeof window.QRCode ===
        "undefined"
    ) {

        mostrarErrorQR(
            "No se pudo cargar el generador QR."
        );

        return;
    }


    codigoQRActual =
        codigo;


    nombreQRActual =
        nombre;


    urlQRActual =
        window.location.origin +
        "/ronda.html?punto=" +
        encodeURIComponent(
            codigo
        );


    codigoQR.innerHTML =
        "";


    // =================================================
    // MARGEN BLANCO
    // =================================================

    const margenQR =
        document.createElement(
            "div"
        );


    margenQR.className =
        "qr-margen";


    codigoQR.appendChild(
        margenQR
    );


    // =================================================
    // GENERAR
    // =================================================

    new window.QRCode(
        margenQR,
        {
            text:
                urlQRActual,

            width:
                240,

            height:
                240,

            colorDark:
                "#000000",

            colorLight:
                "#ffffff",

            correctLevel:
                window.QRCode
                    .CorrectLevel
                    .M
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


// =====================================================
// CREAR PUNTO ÚNICO
// =====================================================

async function guardarPuntoYGenerarQR() {

    ocultarMensajeQR();


    const codigo =
        qrCodigo.value
            .trim()
            .toUpperCase();


    const nombre =
        qrNombre.value
            .trim();


    // =================================================
    // VALIDACIONES
    // =================================================

    if (!codigo) {

        mostrarErrorQR(
            "Ingresa el código del punto."
        );

        qrCodigo.focus();

        return;
    }


    if (
        !/^P\d+$/.test(
            codigo
        )
    ) {

        mostrarErrorQR(
            "El código debe tener formato P01, P02, P03..."
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


    btnGenerarQR.disabled =
        true;


    btnGenerarQR.textContent =
        "COMPROBANDO CÓDIGO...";


    try {

        const referencia =
            doc(
                db,
                "puntos",
                codigo
            );


        // =================================================
        // VERIFICAR DUPLICADO
        // =================================================

        const existente =
            await getDoc(
                referencia
            );


        if (
            existente.exists()
        ) {

            qrResultado.style.display =
                "none";


            mostrarErrorQR(
                "❌ El código " +
                codigo +
                " ya existe. Usa otro código."
            );


            return;
        }


        btnGenerarQR.textContent =
            "GUARDANDO PUNTO...";


        // =================================================
        // CREAR
        // =================================================

        await setDoc(
            referencia,
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


        // =================================================
        // GENERAR QR
        // =================================================

        crearQRVisual(
            codigo,
            nombre
        );


        mostrarExitoQR(
            "✅ Punto " +
            codigo +
            " creado correctamente. " +
            "El QR ya está listo para utilizarse."
        );


        await cargarPuntos();


        qrCodigo.value =
            "";


        qrNombre.value =
            "";


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


btnGenerarQR.addEventListener(
    "click",
    guardarPuntoYGenerarQR
);


// =====================================================
// DESCARGAR QR CON MARGEN BLANCO
// =====================================================

function descargarQR() {

    const canvasOriginal =
        codigoQR.querySelector(
            "canvas"
        );


    if (!canvasOriginal) {

        mostrarErrorQR(
            "Primero crea o selecciona un QR."
        );

        return;
    }


    // Margen extra en archivo descargado

    const margen =
        40;


    const canvasFinal =
        document.createElement(
            "canvas"
        );


    canvasFinal.width =
        canvasOriginal.width +
        margen * 2;


    canvasFinal.height =
        canvasOriginal.height +
        margen * 2;


    const contexto =
        canvasFinal.getContext(
            "2d"
        );


    // Fondo blanco

    contexto.fillStyle =
        "#ffffff";


    contexto.fillRect(
        0,
        0,
        canvasFinal.width,
        canvasFinal.height
    );


    // QR

    contexto.drawImage(
        canvasOriginal,
        margen,
        margen
    );


    const enlace =
        document.createElement(
            "a"
        );


    enlace.href =
        canvasFinal.toDataURL(
            "image/png"
        );


    enlace.download =
        "QR_" +
        codigoQRActual +
        ".png";


    document.body.appendChild(
        enlace
    );


    enlace.click();


    enlace.remove();
}


btnDescargarQR.addEventListener(
    "click",
    descargarQR
);


// =====================================================
// IMPRIMIR QR
// =====================================================

function imprimirQR() {

    const canvasOriginal =
        codigoQR.querySelector(
            "canvas"
        );


    if (
        !canvasOriginal ||
        !codigoQRActual
    ) {

        mostrarErrorQR(
            "Primero crea o selecciona un QR."
        );

        return;
    }


    // =================================================
    // CREAR IMAGEN CON MARGEN
    // =================================================

    const margen =
        40;


    const canvasFinal =
        document.createElement(
            "canvas"
        );


    canvasFinal.width =
        canvasOriginal.width +
        margen * 2;


    canvasFinal.height =
        canvasOriginal.height +
        margen * 2;


    const contexto =
        canvasFinal.getContext(
            "2d"
        );


    contexto.fillStyle =
        "#ffffff";


    contexto.fillRect(
        0,
        0,
        canvasFinal.width,
        canvasFinal.height
    );


    contexto.drawImage(
        canvasOriginal,
        margen,
        margen
    );


    const imagenQR =
        canvasFinal.toDataURL(
            "image/png"
        );


    const ventana =
        window.open(
            "",
            "_blank"
        );


    if (!ventana) {

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
                QR ${codigoQRActual}
            </title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 40px;
                }

                .tarjeta {
                    display: inline-block;
                    border: 2px solid #111;
                    padding: 25px;
                    border-radius: 12px;
                }

                h2 {
                    margin-top: 0;
                }

                .nombre {
                    font-size: 20px;
                    font-weight: bold;
                }

                .codigo {
                    margin-top: 5px;
                    margin-bottom: 15px;
                }

                img {
                    width: 320px;
                    height: 320px;
                }

                .url {
                    max-width: 360px;
                    font-size: 11px;
                    word-break: break-all;
                    margin: 15px auto 0;
                }

            </style>

        </head>

        <body>

            <div class="tarjeta">

                <h2>
                    🛡️ RONDA DE SEGURIDAD
                </h2>

                <div class="nombre">
                    ${nombreQRActual}
                </div>

                <div class="codigo">
                    Código: ${codigoQRActual}
                </div>

                <img
                    src="${imagenQR}"
                    alt="Código QR"
                >

                <div class="url">
                    ${urlQRActual}
                </div>

            </div>

            <script>

                window.onload =
                    function () {

                        setTimeout(
                            function () {

                                window.print();

                            },
                            300
                        );
                    };

            <\/script>

        </body>

        </html>
        `
    );


    ventana.document.close();
}


btnImprimirQR.addEventListener(
    "click",
    imprimirQR
);


// =====================================================
// CARGAR HISTORIAL DE PUNTOS
// =====================================================

async function cargarPuntos() {

    cargandoPuntos.style.display =
        "block";


    listaPuntos.innerHTML =
        "";


    try {

        const resultado =
            await getDocs(
                collection(
                    db,
                    "puntos"
                )
            );


        puntos =
            [];


        resultado.forEach(
            function (
                documento
            ) {

                puntos.push(
                    {
                        id:
                            documento.id,

                        ...documento.data()
                    }
                );
            }
        );


        // =================================================
        // ORDEN NATURAL
        //
        // P01
        // P02
        // P03
        // P10
        // =================================================

        puntos.sort(
            function (
                a,
                b
            ) {

                const codigoA =
                    String(
                        a.codigo ||
                        a.id
                    );


                const codigoB =
                    String(
                        b.codigo ||
                        b.id
                    );


                return codigoA.localeCompare(
                    codigoB,
                    undefined,
                    {
                        numeric:
                            true
                    }
                );
            }
        );


        cargandoPuntos.style.display =
            "none";


        totalPuntos.textContent =
            puntos.length;


        mostrarPuntos(
            puntos
        );


    } catch (e) {

        console.error(
            "Error cargando puntos:",
            e
        );


        cargandoPuntos.style.display =
            "none";


        listaPuntos.innerHTML =
            '<div class="sin-resultados">' +
            'No se pudo cargar el historial de puntos. ' +
            e.message +
            '</div>';
    }
}


// =====================================================
// MOSTRAR PUNTOS
// =====================================================

function mostrarPuntos(
    datos
) {

    listaPuntos.innerHTML =
        "";


    if (
        datos.length === 0
    ) {

        listaPuntos.innerHTML =
            '<div class="sin-resultados">' +
            'Todavía no hay puntos creados.' +
            '</div>';


        return;
    }


    datos.forEach(
        function (
            punto
        ) {

            const codigoPunto =
                punto.codigo ||
                punto.id;


            const nombrePunto =
                punto.nombre ||
                "Punto de control";


            const tarjeta =
                document.createElement(
                    "div"
                );


            tarjeta.className =
                "punto-item";


            const superior =
                document.createElement(
                    "div"
                );


            superior.className =
                "punto-superior";


            const info =
                document.createElement(
                    "div"
                );


            // CÓDIGO

            const codigo =
                document.createElement(
                    "div"
                );


            codigo.className =
                "punto-codigo";


            codigo.textContent =
                "🔲 " +
                codigoPunto;


            // NOMBRE

            const nombre =
                document.createElement(
                    "div"
                );


            nombre.className =
                "punto-nombre";


            nombre.textContent =
                "📍 " +
                nombrePunto;


            // ESTADO

            const activo =
                document.createElement(
                    "div"
                );


            activo.className =
                "activo-punto";


            activo.textContent =
                punto.activo === true
                    ? "✅ ACTIVO"
                    : "⛔ INACTIVO";


            info.appendChild(
                codigo
            );


            info.appendChild(
                nombre
            );


            info.appendChild(
                activo
            );


            // =================================================
            // FECHA
            // =================================================

            if (
                punto.creadoEn &&
                typeof punto.creadoEn.toDate ===
                "function"
            ) {

                const fechaElemento =
                    document.createElement(
                        "div"
                    );


                fechaElemento.className =
                    "punto-fecha";


                fechaElemento.textContent =
                    "Creado: " +
                    punto.creadoEn
                        .toDate()
                        .toLocaleString(
                            "es-PE"
                        );


                info.appendChild(
                    fechaElemento
                );
            }


            // =================================================
            // VER QR
            // =================================================

            const boton =
                document.createElement(
                    "button"
                );


            boton.className =
                "btn-ver-qr";


            boton.type =
                "button";


            boton.textContent =
                "📱 Ver QR";


            boton.addEventListener(
                "click",
                function () {

                    ocultarMensajeQR();


                    crearQRVisual(
                        codigoPunto,
                        nombrePunto
                    );


                    qrResultado.scrollIntoView(
                        {
                            behavior:
                                "smooth",

                            block:
                                "center"
                        }
                    );
                }
            );


            superior.appendChild(
                info
            );


            superior.appendChild(
                boton
            );


            tarjeta.appendChild(
                superior
            );


            listaPuntos.appendChild(
                tarjeta
            );
        }
    );
}


// =====================================================
// BUSCADOR PUNTOS
// =====================================================

buscarPunto.addEventListener(
    "input",
    function () {

        const texto =
            buscarPunto.value
                .trim()
                .toLowerCase();


        if (!texto) {

            mostrarPuntos(
                puntos
            );

            return;
        }


        const filtrados =
            puntos.filter(
                function (
                    punto
                ) {

                    const contenido =
                        (
                            (
                                punto.codigo ||
                                punto.id ||
                                ""
                            ) +
                            " " +
                            (
                                punto.nombre ||
                                ""
                            )
                        )
                            .toLowerCase();


                    return contenido.includes(
                        texto
                    );
                }
            );


        mostrarPuntos(
            filtrados
        );
    }
);


btnActualizarPuntos.addEventListener(
    "click",
    cargarPuntos
);


// =====================================================
// ENTER PARA CREAR
// =====================================================

qrCodigo.addEventListener(
    "keydown",
    function (
        event
    ) {

        if (
            event.key ===
            "Enter"
        ) {

            event.preventDefault();

            qrNombre.focus();
        }
    }
);


qrNombre.addEventListener(
    "keydown",
    function (
        event
    ) {

        if (
            event.key ===
            "Enter"
        ) {

            event.preventDefault();

            guardarPuntoYGenerarQR();
        }
    }
);


// =====================================================
// INICIAR
// =====================================================

cargarRondas();

cargarPuntos();