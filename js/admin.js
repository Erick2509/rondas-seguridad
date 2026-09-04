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
// MENÚ
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

        cargarPuntos();
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


let rondas = [];


async function cargarRondas() {

    error.style.display = "none";
    cargando.style.display = "block";

    listaRondas.innerHTML = "";


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
                limit(100)
            );


        const resultado =
            await getDocs(
                consulta
            );


        rondas = [];


        resultado.forEach(
            function (documento) {

                rondas.push({

                    id:
                        documento.id,

                    ...documento.data()

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

        console.error(e);

        cargando.style.display =
            "none";


        error.textContent =
            "No se pudieron cargar las rondas: " +
            e.message;


        error.style.display =
            "block";
    }
}


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
        function (ronda) {

            if (ronda.agenteId) {

                agentes.add(
                    ronda.agenteId
                );
            }


            if (
                ronda.fecha === hoy
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


function fechaHoy() {

    const fecha =
        new Date();


    const dia =
        String(
            fecha.getDate()
        ).padStart(2, "0");


    const mes =
        String(
            fecha.getMonth() + 1
        ).padStart(2, "0");


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


function mostrarRondas(datos) {

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
                ronda.direccion || "-"
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
            String(valor)
        )
    );


    contenedor.appendChild(
        linea
    );
}


function filtrarRondas() {

    const texto =
        buscador.value
            .trim()
            .toLowerCase();


    const resultado =
        rondas.filter(
            function (ronda) {

                const contenido = [

                    ronda.agenteNombre,
                    ronda.puntoNombre,
                    ronda.puntoCodigo,
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


let urlQRActual =
    "";


// =====================================================
// CREAR QR VISUAL
// =====================================================

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


// =====================================================
// MENSAJES
// =====================================================

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


function ocultarMensajeQR() {

    qrError.style.display =
        "none";

    qrError.classList.remove(
        "exito"
    );
}


// =====================================================
// GUARDAR PUNTO ÚNICO
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


    if (!codigo) {

        mostrarErrorQR(
            "Ingresa el código del punto."
        );

        return;
    }


    if (
        !/^P\d+$/.test(
            codigo
        )
    ) {

        mostrarErrorQR(
            "El código debe ser P01, P02, P03..."
        );

        return;
    }


    if (!nombre) {

        mostrarErrorQR(
            "Ingresa el nombre del punto."
        );

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


        // COMPROBAR SI YA EXISTE

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
            "GUARDANDO...";


        // EL ID DEL DOCUMENTO ES EL MISMO CÓDIGO.
        //
        // puntos/P01
        // puntos/P02
        //
        // Esto evita repetir códigos.

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


        crearQRVisual(
            codigo,
            nombre
        );


        mostrarExitoQR(
            "✅ Punto " +
            codigo +
            " creado correctamente. El código queda reservado y no podrá repetirse."
        );


        // ACTUALIZAR HISTORIAL

        await cargarPuntos();


        qrCodigo.value =
            "";


        qrNombre.value =
            "";


    } catch (e) {

        console.error(
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
// DESCARGAR QR
// =====================================================

function descargarQR() {

    const canvas =
        codigoQR.querySelector(
            "canvas"
        );


    if (!canvas) {

        mostrarErrorQR(
            "Primero selecciona o crea un QR."
        );

        return;
    }


    const enlace =
        document.createElement(
            "a"
        );


    enlace.href =
        canvas.toDataURL(
            "image/png"
        );


    const codigo =
        qrCodigoVisual.textContent
            .replace(
                "Código:",
                ""
            )
            .trim();


    enlace.download =
        "QR_" +
        codigo +
        ".png";


    enlace.click();
}


btnDescargarQR.addEventListener(
    "click",
    descargarQR
);


// =====================================================
// IMPRIMIR
// =====================================================

btnImprimirQR.addEventListener(
    "click",
    function () {

        if (!urlQRActual) {

            mostrarErrorQR(
                "Primero crea o selecciona un QR."
            );

            return;
        }


        const contenido =
            document.getElementById(
                "areaQR"
            ).outerHTML;


        const ventana =
            window.open(
                "",
                "_blank"
            );


        if (!ventana) {

            return;
        }


        ventana.document.write(
            `
            <!DOCTYPE html>

            <html>

            <head>

                <title>
                    Código QR
                </title>

                <style>

                    body {
                        font-family: Arial;
                        text-align: center;
                        padding: 40px;
                    }

                    .area-qr {
                        display: inline-block;
                        border: 2px solid #111;
                        padding: 25px;
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

                ventana.print();

            },
            500
        );
    }
);


// =====================================================
// HISTORIAL DE PUNTOS / QR
// =====================================================

const listaPuntos =
    document.getElementById("listaPuntos");

const cargandoPuntos =
    document.getElementById("cargandoPuntos");

const buscarPunto =
    document.getElementById("buscarPunto");

const btnActualizarPuntos =
    document.getElementById(
        "btnActualizarPuntos"
    );


let puntos =
    [];


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

                puntos.push({

                    id:
                        documento.id,

                    ...documento.data()

                });
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
                        numeric: true
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
            'No se pudo cargar el historial de puntos.' +
            '</div>';
    }
}


// =====================================================
// MOSTRAR HISTORIAL
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
                (
                    punto.codigo ||
                    punto.id
                );


            const nombre =
                document.createElement(
                    "div"
                );


            nombre.className =
                "punto-nombre";


            nombre.textContent =
                "📍 " +
                (
                    punto.nombre ||
                    "Sin nombre"
                );


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


            // FECHA

            if (
                punto.creadoEn &&
                typeof punto.creadoEn.toDate ===
                "function"
            ) {

                const fecha =
                    punto.creadoEn
                        .toDate();


                const fechaElemento =
                    document.createElement(
                        "div"
                    );


                fechaElemento.className =
                    "punto-fecha";


                fechaElemento.textContent =
                    "Creado: " +
                    fecha.toLocaleString(
                        "es-PE"
                    );


                info.appendChild(
                    fechaElemento
                );
            }


            // BOTÓN VER QR

            const boton =
                document.createElement(
                    "button"
                );


            boton.className =
                "btn-ver-qr";


            boton.textContent =
                "📱 Ver QR";


            boton.addEventListener(
                "click",
                function () {

                    const codigoPunto =
                        punto.codigo ||
                        punto.id;


                    crearQRVisual(
                        codigoPunto,
                        punto.nombre ||
                        "Punto de control"
                    );


                    qrCodigo.value =
                        codigoPunto;


                    qrNombre.value =
                        punto.nombre ||
                        "";


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
// BUSCAR PUNTO
// =====================================================

buscarPunto.addEventListener(
    "input",
    function () {

        const texto =
            buscarPunto.value
                .trim()
                .toLowerCase();


        const filtrados =
            puntos.filter(
                function (punto) {

                    const contenido =
                        (
                            (punto.codigo || "") +
                            " " +
                            (punto.nombre || "")
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
// INICIAR
// =====================================================

cargarRondas();

cargarPuntos();