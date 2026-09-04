import { db } from "./firebase.js";

import {
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ========================================
// ELEMENTOS
// ========================================

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


// ========================================
// DATOS
// ========================================

let rondas = [];


// ========================================
// CARGAR RONDAS
// ========================================

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


// ========================================
// RESUMEN
// ========================================

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


// ========================================
// FECHA LOCAL
// ========================================

function fechaLocalActual() {

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


    return `${dia}/${mes}/${anio}`;
}


// ========================================
// MOSTRAR RONDAS
// ========================================

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


// ========================================
// CREAR TARJETA
// ========================================

function crearTarjetaRonda(ronda) {

    const tarjeta =
        document.createElement(
            "div"
        );


    tarjeta.className =
        "ronda";


    // ---------------------------
    // PARTE SUPERIOR
    // ---------------------------

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


    // ---------------------------
    // DETALLES
    // ---------------------------

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


// ========================================
// AGREGAR LÍNEA SEGURA
// ========================================

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


// ========================================
// BUSCADOR
// ========================================

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


// ========================================
// ERROR
// ========================================

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


// ========================================
// EVENTOS
// ========================================

buscador.addEventListener(
    "input",
    filtrarRondas
);


btnActualizar.addEventListener(
    "click",
    cargarRondas
);


// ========================================
// INICIAR
// ========================================

cargarRondas();