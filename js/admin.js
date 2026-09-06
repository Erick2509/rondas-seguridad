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
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// =====================================================
// FUNCIÓN CORTA PARA OBTENER ELEMENTOS
// =====================================================

const $ = (id) =>
    document.getElementById(id);


// =====================================================
// MENÚ
// =====================================================

const menuInicio = $("menuInicio");
const menuRondas = $("menuRondas");
const menuQR = $("menuQR");
const menuAgentes = $("menuAgentes");

const seccionInicio = $("seccionInicio");
const seccionRondas = $("seccionRondas");
const seccionQR = $("seccionQR");
const seccionAgentes = $("seccionAgentes");


// =====================================================
// RONDAS
// =====================================================

const listaRondas = $("listaRondas");
const cargando = $("cargando");
const error = $("error");
const buscador = $("buscador");
const btnActualizar = $("btnActualizar");

const totalRondas = $("totalRondas");
const rondasHoy = $("rondasHoy");
const totalAgentes = $("totalAgentes");
const totalPuntos = $("totalPuntos");


// =====================================================
// QR
// =====================================================

const qrCodigo = $("qrCodigo");
const qrNombre = $("qrNombre");
const qrTipoRonda = $("qrTipoRonda");
const qrFuncion = $("qrFuncion");
const qrOrden = $("qrOrden");

const btnGenerarQR = $("btnGenerarQR");

const qrError = $("qrError");
const qrResultado = $("qrResultado");

const codigoQR = $("codigoQR");

const qrNombreVisual = $("qrNombreVisual");
const qrCodigoVisual = $("qrCodigoVisual");
const qrUrl = $("qrUrl");

const btnDescargarQR = $("btnDescargarQR");
const btnImprimirQR = $("btnImprimirQR");


// =====================================================
// PUNTOS
// =====================================================

const listaPuntos = $("listaPuntos");
const cargandoPuntos = $("cargandoPuntos");
const buscarPunto = $("buscarPunto");
const btnActualizarPuntos = $("btnActualizarPuntos");


// =====================================================
// AGENTES
// =====================================================

const agenteCodigo = $("agenteCodigo");
const agenteNombre = $("agenteNombre");
const agenteCargo = $("agenteCargo");
const agenteTurno = $("agenteTurno");

const btnGuardarAgente =
    $("btnGuardarAgente");

const btnCancelarEdicionAgente =
    $("btnCancelarEdicionAgente");

const agenteMensaje =
    $("agenteMensaje");

const listaAgentes =
    $("listaAgentes");

const cargandoAgentes =
    $("cargandoAgentes");

const buscarAgente =
    $("buscarAgente");

const btnActualizarAgentes =
    $("btnActualizarAgentes");

const tituloFormularioAgente =
    $("tituloFormularioAgente");


// =====================================================
// VARIABLES
// =====================================================

let rondas = [];
let puntos = [];
let agentes = [];

let urlQRActual = "";
let codigoQRActual = "";
let nombreQRActual = "";

let agenteEditandoId = null;


// =====================================================
// MENÚ
// =====================================================

function mostrarSeccion(nombre) {

    seccionInicio.classList.remove("activa");
    seccionRondas.classList.remove("activa");
    seccionQR.classList.remove("activa");
    seccionAgentes.classList.remove("activa");

    menuInicio.classList.remove("activo");
    menuRondas.classList.remove("activo");
    menuQR.classList.remove("activo");
    menuAgentes.classList.remove("activo");


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

        cargarPuntos();
    }


    if (nombre === "agentes") {

        seccionAgentes.classList.add("activa");
        menuAgentes.classList.add("activo");

        cargarAgentes();
    }
}


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


menuAgentes.addEventListener(
    "click",
    function () {

        mostrarSeccion("agentes");
    }
);


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
// AGREGAR LÍNEA SEGURA
// =====================================================

function agregarLinea(
    contenedor,
    titulo,
    valor
) {

    const linea =
        document.createElement("div");

    const fuerte =
        document.createElement("strong");

    fuerte.textContent =
        titulo;

    linea.appendChild(
        fuerte
    );

    linea.appendChild(
        document.createTextNode(
            String(
                valor ?? "-"
            )
        )
    );

    contenedor.appendChild(
        linea
    );
}


// =====================================================
// MENSAJES
// =====================================================

function mostrarMensaje(
    elemento,
    texto,
    exito = false
) {

    elemento.classList.toggle(
        "exito",
        exito
    );

    elemento.textContent =
        texto;

    elemento.style.display =
        "block";
}


function ocultarMensaje(
    elemento
) {

    elemento.style.display =
        "none";

    elemento.classList.remove(
        "exito"
    );

    elemento.textContent =
        "";
}


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
            function (documento) {

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


        actualizarResumenRondas();


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
// RESUMEN RONDAS
// =====================================================

function actualizarResumenRondas() {

    totalRondas.textContent =
        rondas.length;


    const hoy =
        fechaHoy();


    const cantidadHoy =
        rondas.filter(
            function (ronda) {

                return (
                    ronda.fecha ===
                    hoy
                );
            }
        ).length;


    rondasHoy.textContent =
        cantidadHoy;
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
        function (ronda) {

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
// BUSCAR RONDAS
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


    const filtradas =
        rondas.filter(
            function (ronda) {

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


buscador.addEventListener(
    "input",
    filtrarRondas
);


btnActualizar.addEventListener(
    "click",
    cargarRondas
);


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

        mostrarMensaje(
            qrError,
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


    const margenQR =
        document.createElement(
            "div"
        );

    margenQR.className =
        "qr-margen";


    codigoQR.appendChild(
        margenQR
    );


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
// GUARDAR PUNTO
// =====================================================

async function guardarPuntoYGenerarQR() {
    ocultarMensaje(qrError);

    const codigo = qrCodigo.value.trim().toUpperCase();
    const nombre = qrNombre.value.trim();
    const tipoRonda = qrTipoRonda.value;
    const funcionQR = qrFuncion.value;
    const orden = Number(qrOrden.value);

    if (!codigo || !/^P\d+$/.test(codigo)) {
        mostrarMensaje(qrError, "El código debe tener formato P01, P02, P03...");
        qrCodigo.focus();
        return;
    }
    if (!nombre) {
        mostrarMensaje(qrError, "Ingresa el nombre del punto.");
        qrNombre.focus();
        return;
    }
    if (!tipoRonda) {
        mostrarMensaje(qrError, "Selecciona Ronda Externa o Ronda Interna.");
        qrTipoRonda.focus();
        return;
    }
    if (!funcionQR) {
        mostrarMensaje(qrError, "Selecciona la función del QR: INICIO, PUNTO o FINAL.");
        qrFuncion.focus();
        return;
    }
    if (!Number.isInteger(orden) || orden < 1) {
        mostrarMensaje(qrError, "Ingresa un número de orden válido desde 1.");
        qrOrden.focus();
        return;
    }

    btnGenerarQR.disabled = true;
    btnGenerarQR.textContent = "COMPROBANDO CONFIGURACIÓN...";

    try {
        const referencia = doc(db, "puntos", codigo);
        const existente = await getDoc(referencia);
        if (existente.exists()) {
            qrResultado.style.display = "none";
            mostrarMensaje(qrError, `❌ El código ${codigo} ya existe. Usa otro código.`);
            return;
        }

        const resultadoPuntos = await getDocs(collection(db, "puntos"));
        let ordenRepetido = false;
        let inicioRepetido = false;
        let finalRepetido = false;

        resultadoPuntos.forEach((documento) => {
            const p = documento.data();
            if (p.tipoRonda === tipoRonda && Number(p.orden) === orden) ordenRepetido = true;
            if (p.tipoRonda === tipoRonda && p.funcionQR === "INICIO" && funcionQR === "INICIO") inicioRepetido = true;
            if (p.tipoRonda === tipoRonda && p.funcionQR === "FINAL" && funcionQR === "FINAL") finalRepetido = true;
        });

        if (ordenRepetido) {
            mostrarMensaje(qrError, `❌ El orden ${orden} ya está usado en la Ronda ${tipoRonda}.`);
            return;
        }
        if (inicioRepetido) {
            mostrarMensaje(qrError, `❌ La Ronda ${tipoRonda} ya tiene un QR de INICIO.`);
            return;
        }
        if (finalRepetido) {
            mostrarMensaje(qrError, `❌ La Ronda ${tipoRonda} ya tiene un QR FINAL.`);
            return;
        }

        btnGenerarQR.textContent = "GUARDANDO PUNTO...";
        await setDoc(referencia, { codigo, nombre, tipoRonda, funcionQR, orden, activo: true, creadoEn: serverTimestamp() });
        crearQRVisual(codigo, nombre);
        mostrarMensaje(qrError, `✅ ${codigo} creado como ${funcionQR} de Ronda ${tipoRonda}, orden ${orden}.`, true);

        qrCodigo.value = ""; qrNombre.value = ""; qrTipoRonda.value = ""; qrFuncion.value = ""; qrOrden.value = "";
        await cargarPuntos();
    } catch (e) {
        console.error("Error creando punto:", e);
        mostrarMensaje(qrError, "No se pudo crear el punto: " + e.message);
    } finally {
        btnGenerarQR.disabled = false;
        btnGenerarQR.textContent = "💾 GUARDAR PUNTO Y GENERAR QR";
    }
}

btnGenerarQR.addEventListener("click", guardarPuntoYGenerarQR);

// =====================================================
// QR CON MARGEN
// =====================================================

function canvasQRConMargen() {

    const canvasOriginal =
        codigoQR.querySelector(
            "canvas"
        );


    if (!canvasOriginal) {

        return null;
    }


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


    return canvasFinal;
}


// =====================================================
// DESCARGAR QR
// =====================================================

function descargarQR() {

    const canvasFinal =
        canvasQRConMargen();


    if (!canvasFinal) {

        mostrarMensaje(
            qrError,
            "Primero crea o selecciona un QR."
        );

        return;
    }


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

    const canvasFinal =
        canvasQRConMargen();


    if (
        !canvasFinal ||
        !codigoQRActual
    ) {

        mostrarMensaje(
            qrError,
            "Primero crea o selecciona un QR."
        );

        return;
    }


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

        mostrarMensaje(
            qrError,
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

                <div
                    style="font-size:20px;font-weight:bold"
                >
                    ${nombreQRActual}
                </div>

                <div>
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
// CARGAR PUNTOS
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
            function (documento) {

                puntos.push(
                    {
                        id:
                            documento.id,

                        ...documento.data()
                    }
                );
            }
        );


        puntos.sort(
            function (a, b) {

                return String(
                    a.codigo ||
                    a.id
                ).localeCompare(
                    String(
                        b.codigo ||
                        b.id
                    ),
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
            'No se pudieron cargar los puntos: ' +
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
        function (punto) {

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


            const codigo =
                document.createElement(
                    "div"
                );

            codigo.className =
                "punto-codigo";

            codigo.textContent =
                "🔲 " +
                codigoPunto;


            const nombre =
                document.createElement(
                    "div"
                );

            nombre.className =
                "punto-nombre";

            nombre.textContent =
                "📍 " +
                nombrePunto;


            const activo =
                document.createElement(
                    "div"
                );


            activo.className =
                punto.activo === true
                    ? "estado-activo"
                    : "estado-inactivo";


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

            const metaRonda = document.createElement("div");
            metaRonda.className = "punto-fecha";
            const tipoTexto = punto.tipoRonda || "SIN CONFIGURAR";
            const funcionTexto = punto.funcionQR || "SIN CONFIGURAR";
            const ordenTexto = punto.orden ?? "-";
            metaRonda.textContent = `Ronda: ${tipoTexto} · Función: ${funcionTexto} · Orden: ${ordenTexto}`;
            info.appendChild(metaRonda);

            info.appendChild(
                activo
            );


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

                    ocultarMensaje(
                        qrError
                    );


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
// BUSCAR PUNTOS
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
                function (punto) {

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
                            ) + " " +
                            (punto.tipoRonda || "") + " " +
                            (punto.funcionQR || "") + " " +
                            (punto.orden ?? "")
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
// ENTER QR
// =====================================================

qrCodigo.addEventListener(
    "keydown",
    function (event) {

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
    function (event) {

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
// AGENTES
// =====================================================


// =====================================================
// NORMALIZAR CÓDIGO
//
// 1   -> 001
// 2   -> 002
// 25  -> 025
// 125 -> 125
// =====================================================

function normalizarCodigoAgente(
    valor
) {

    const limpio =
        valor.trim();


    if (
        !/^\d+$/.test(
            limpio
        )
    ) {

        return limpio;
    }


    return limpio.padStart(
        3,
        "0"
    );
}


// =====================================================
// LIMPIAR FORMULARIO
// =====================================================

function limpiarFormularioAgente() {

    agenteEditandoId =
        null;


    agenteCodigo.value =
        "";

    agenteCodigo.disabled =
        false;


    agenteNombre.value =
        "";

    agenteCargo.value =
        "";

    agenteTurno.value =
        "";


    tituloFormularioAgente.textContent =
        "👮 Crear agente";


    btnGuardarAgente.textContent =
        "💾 GUARDAR AGENTE";


    btnCancelarEdicionAgente.style.display =
        "none";


    ocultarMensaje(
        agenteMensaje
    );
}


// =====================================================
// GUARDAR / EDITAR AGENTE
// =====================================================

async function guardarAgente() {

    ocultarMensaje(
        agenteMensaje
    );


    const codigo =
        normalizarCodigoAgente(
            agenteCodigo.value
        );


    const nombre =
        agenteNombre.value
            .trim();


    const cargo =
        agenteCargo.value
            .trim();


    const turno =
        agenteTurno.value;


    // =================================================
    // VALIDACIONES
    // =================================================

    if (
        !codigo ||
        !/^\d{3,6}$/.test(
            codigo
        )
    ) {

        mostrarMensaje(
            agenteMensaje,
            "El código debe contener entre 3 y 6 números. Ejemplo: 001."
        );

        agenteCodigo.focus();

        return;
    }


    if (!nombre) {

        mostrarMensaje(
            agenteMensaje,
            "Ingresa el nombre y apellidos."
        );

        agenteNombre.focus();

        return;
    }


    if (!cargo) {

        mostrarMensaje(
            agenteMensaje,
            "Ingresa el cargo del agente."
        );

        agenteCargo.focus();

        return;
    }


    if (!turno) {

        mostrarMensaje(
            agenteMensaje,
            "Selecciona el turno."
        );

        agenteTurno.focus();

        return;
    }


    btnGuardarAgente.disabled =
        true;


    try {

        // =============================================
        // EDITAR AGENTE EXISTENTE
        // =============================================

        if (
            agenteEditandoId
        ) {

            await updateDoc(
                doc(
                    db,
                    "agentes",
                    agenteEditandoId
                ),
                {
                    // IMPORTANTE:
                    // EL CÓDIGO SIEMPRE SE CONSERVA
                    codigo:
                        agenteEditandoId,

                    nombre:
                        nombre,

                    cargo:
                        cargo,

                    turno:
                        turno,

                    actualizadoEn:
                        serverTimestamp()
                }
            );


            const idActualizado =
                agenteEditandoId;


            limpiarFormularioAgente();


            mostrarMensaje(
                agenteMensaje,
                "✅ Agente " +
                idActualizado +
                " actualizado correctamente. " +
                "El identificador se mantuvo sin cambios.",
                true
            );

        }

        // =============================================
        // CREAR NUEVO AGENTE
        // =============================================

        else {

            const referencia =
                doc(
                    db,
                    "agentes",
                    codigo
                );


            const existente =
                await getDoc(
                    referencia
                );


            // =========================================
            // NO PERMITIR CÓDIGOS REPETIDOS
            // =========================================

            if (
                existente.exists()
            ) {

                mostrarMensaje(
                    agenteMensaje,
                    "❌ El identificador " +
                    codigo +
                    " ya existe. Debes usar otro."
                );

                return;
            }


            await setDoc(
                referencia,
                {
                    codigo:
                        codigo,

                    nombre:
                        nombre,

                    cargo:
                        cargo,

                    turno:
                        turno,

                    activo:
                        true,

                    creadoEn:
                        serverTimestamp()
                }
            );


            mostrarMensaje(
                agenteMensaje,
                "✅ Agente " +
                codigo +
                " creado correctamente.",
                true
            );


            agenteCodigo.value =
                "";

            agenteNombre.value =
                "";

            agenteCargo.value =
                "";

            agenteTurno.value =
                "";
        }


        await cargarAgentes();


    } catch (e) {

        console.error(
            "Error guardando agente:",
            e
        );


        mostrarMensaje(
            agenteMensaje,
            "No se pudo guardar el agente: " +
            e.message
        );


    } finally {

        btnGuardarAgente.disabled =
            false;
    }
}


// =====================================================
// EDITAR AGENTE
// =====================================================

function editarAgente(
    agente
) {

    agenteEditandoId =
        agente.id;


    // =================================================
    // IDENTIFICADOR BLOQUEADO
    // =================================================

    agenteCodigo.value =
        agente.id;


    agenteCodigo.disabled =
        true;


    agenteNombre.value =
        agente.nombre ||
        "";


    agenteCargo.value =
        agente.cargo ||
        "";


    agenteTurno.value =
        agente.turno ||
        "";


    tituloFormularioAgente.textContent =
        "✏️ Editar agente";


    btnGuardarAgente.textContent =
        "💾 GUARDAR CAMBIOS";


    btnCancelarEdicionAgente.style.display =
        "block";


    ocultarMensaje(
        agenteMensaje
    );


    seccionAgentes.scrollIntoView(
        {
            behavior:
                "smooth",

            block:
                "start"
        }
    );
}


// =====================================================
// ACTIVAR / DESACTIVAR
// =====================================================

async function cambiarEstadoAgente(
    agente
) {

    const nuevoEstado =
        agente.activo !== true;


    const accion =
        nuevoEstado
            ? "activar"
            : "desactivar";


    const confirmar =
        window.confirm(
            "¿Deseas " +
            accion +
            " al agente " +
            agente.id +
            " - " +
            (
                agente.nombre ||
                ""
            ) +
            "?"
        );


    if (!confirmar) {

        return;
    }


    try {

        await updateDoc(
            doc(
                db,
                "agentes",
                agente.id
            ),
            {
                activo:
                    nuevoEstado,

                actualizadoEn:
                    serverTimestamp()
            }
        );


        await cargarAgentes();


    } catch (e) {

        console.error(
            "Error cambiando estado:",
            e
        );


        mostrarMensaje(
            agenteMensaje,
            "No se pudo cambiar el estado: " +
            e.message
        );
    }
}


// =====================================================
// CARGAR AGENTES
// =====================================================

async function cargarAgentes() {

    cargandoAgentes.style.display =
        "block";


    listaAgentes.innerHTML =
        "";


    try {

        const resultado =
            await getDocs(
                collection(
                    db,
                    "agentes"
                )
            );


        agentes =
            [];


        resultado.forEach(
            function (documento) {

                agentes.push(
                    {
                        id:
                            documento.id,

                        ...documento.data()
                    }
                );
            }
        );


        // =============================================
        // ORDENAR 001, 002, 003, 010...
        // =============================================

        agentes.sort(
            function (a, b) {

                return String(
                    a.id
                ).localeCompare(
                    String(
                        b.id
                    ),
                    undefined,
                    {
                        numeric:
                            true
                    }
                );
            }
        );


        cargandoAgentes.style.display =
            "none";


        // =============================================
        // CONTADOR REAL DE AGENTES
        // =============================================

        totalAgentes.textContent =
            agentes.length;


        mostrarAgentes(
            agentes
        );


    } catch (e) {

        console.error(
            "Error cargando agentes:",
            e
        );


        cargandoAgentes.style.display =
            "none";


        listaAgentes.innerHTML =
            '<div class="sin-resultados">' +
            'No se pudieron cargar los agentes: ' +
            e.message +
            '</div>';
    }
}


// =====================================================
// MOSTRAR AGENTES
// =====================================================

function mostrarAgentes(
    datos
) {

    listaAgentes.innerHTML =
        "";


    if (
        datos.length === 0
    ) {

        listaAgentes.innerHTML =
            '<div class="sin-resultados">' +
            'Todavía no hay agentes registrados.' +
            '</div>';

        return;
    }


    datos.forEach(
        function (agente) {

            const tarjeta =
                document.createElement(
                    "div"
                );


            tarjeta.className =
                "agente-item";


            const superior =
                document.createElement(
                    "div"
                );


            superior.className =
                "agente-superior";


            const info =
                document.createElement(
                    "div"
                );


            // =========================================
            // CÓDIGO + NOMBRE
            // =========================================

            const codigo =
                document.createElement(
                    "div"
                );


            codigo.className =
                "agente-codigo";


            codigo.textContent =
                "👮 " +
                agente.id +
                " — " +
                (
                    agente.nombre ||
                    "Sin nombre"
                );


            // =========================================
            // CARGO Y TURNO
            // =========================================

            const meta =
                document.createElement(
                    "div"
                );


            meta.className =
                "agente-meta";


            meta.textContent =
                "Cargo: " +
                (
                    agente.cargo ||
                    "Sin registrar"
                ) +
                " · Turno: " +
                (
                    agente.turno ||
                    "Sin registrar"
                );


            // =========================================
            // ESTADO
            // =========================================

            const estado =
                document.createElement(
                    "div"
                );


            estado.className =
                agente.activo === true
                    ? "estado-activo"
                    : "estado-inactivo";


            estado.textContent =
                agente.activo === true
                    ? "✅ ACTIVO"
                    : "⛔ INACTIVO";


            info.appendChild(
                codigo
            );


            info.appendChild(
                meta
            );


            info.appendChild(
                estado
            );


            // =========================================
            // BOTONES
            // =========================================

            const acciones =
                document.createElement(
                    "div"
                );


            acciones.className =
                "acciones";


            // EDITAR

            const botonEditar =
                document.createElement(
                    "button"
                );


            botonEditar.className =
                "btn-editar";


            botonEditar.type =
                "button";


            botonEditar.textContent =
                "✏️ EDITAR";


            botonEditar.addEventListener(
                "click",
                function () {

                    editarAgente(
                        agente
                    );
                }
            );


            // ACTIVAR / DESACTIVAR

            const botonEstado =
                document.createElement(
                    "button"
                );


            botonEstado.className =
                "btn-estado";


            botonEstado.type =
                "button";


            botonEstado.textContent =
                agente.activo === true
                    ? "⛔ DESACTIVAR"
                    : "✅ ACTIVAR";


            botonEstado.addEventListener(
                "click",
                function () {

                    cambiarEstadoAgente(
                        agente
                    );
                }
            );


            acciones.appendChild(
                botonEditar
            );


            acciones.appendChild(
                botonEstado
            );


            superior.appendChild(
                info
            );


            superior.appendChild(
                acciones
            );


            tarjeta.appendChild(
                superior
            );


            listaAgentes.appendChild(
                tarjeta
            );
        }
    );
}


// =====================================================
// BUSCAR AGENTES
// =====================================================

buscarAgente.addEventListener(
    "input",
    function () {

        const texto =
            buscarAgente.value
                .trim()
                .toLowerCase();


        if (!texto) {

            mostrarAgentes(
                agentes
            );

            return;
        }


        const filtrados =
            agentes.filter(
                function (agente) {

                    const contenido =
                        (
                            agente.id +
                            " " +
                            (
                                agente.nombre ||
                                ""
                            ) +
                            " " +
                            (
                                agente.cargo ||
                                ""
                            ) +
                            " " +
                            (
                                agente.turno ||
                                ""
                            )
                        )
                        .toLowerCase();


                    return contenido.includes(
                        texto
                    );
                }
            );


        mostrarAgentes(
            filtrados
        );
    }
);


// =====================================================
// BOTONES AGENTES
// =====================================================

btnGuardarAgente.addEventListener(
    "click",
    guardarAgente
);


btnCancelarEdicionAgente.addEventListener(
    "click",
    limpiarFormularioAgente
);


btnActualizarAgentes.addEventListener(
    "click",
    cargarAgentes
);


// =====================================================
// NORMALIZAR CÓDIGO AL SALIR
// =====================================================

agenteCodigo.addEventListener(
    "blur",
    function () {

        if (
            !agenteEditandoId
        ) {

            agenteCodigo.value =
                normalizarCodigoAgente(
                    agenteCodigo.value
                );
        }
    }
);


// =====================================================
// ENTER AGENTES
// =====================================================

agenteCodigo.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key ===
            "Enter"
        ) {

            event.preventDefault();

            agenteNombre.focus();
        }
    }
);


agenteNombre.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key ===
            "Enter"
        ) {

            event.preventDefault();

            agenteCargo.focus();
        }
    }
);


// =====================================================
// INICIAR PANEL
// =====================================================

cargarRondas();

cargarPuntos();

cargarAgentes();