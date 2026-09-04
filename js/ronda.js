import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


const parametros = new URLSearchParams(window.location.search);

const codigoPunto = parametros.get("punto");


const cargando = document.getElementById("cargando");
const resultado = document.getElementById("resultado");
const error = document.getElementById("error");

const codigoElemento = document.getElementById("codigoPunto");
const nombreElemento = document.getElementById("nombrePunto");
const mensajeError = document.getElementById("mensajeError");


async function cargarPunto() {

    if (!codigoPunto) {

        mostrarError(
            "No se recibió ningún código de punto."
        );

        return;
    }

    try {

        const referencia = doc(
            db,
            "puntos",
            codigoPunto
        );

        const documento = await getDoc(referencia);


        if (!documento.exists()) {

            mostrarError(
                "El punto de control no existe."
            );

            return;
        }


        const punto = documento.data();


        if (punto.activo !== true) {

            mostrarError(
                "Este punto de control está desactivado."
            );

            return;
        }


        codigoElemento.textContent =
            punto.codigo;

        nombreElemento.textContent =
            punto.nombre;


        cargando.classList.add("d-none");

        resultado.classList.remove("d-none");


        // Guardamos temporalmente el punto
        sessionStorage.setItem(
            "puntoActual",
            JSON.stringify({
                id: codigoPunto,
                codigo: punto.codigo,
                nombre: punto.nombre
            })
        );


    } catch (errorFirebase) {

        console.error(errorFirebase);

        mostrarError(
            "No se pudo conectar con Firebase."
        );

    }

}


function mostrarError(mensaje) {

    cargando.classList.add("d-none");

    error.classList.remove("d-none");

    mensajeError.textContent = mensaje;

}


window.continuar = function () {

    window.location.href = "index.html";

};


cargarPunto();