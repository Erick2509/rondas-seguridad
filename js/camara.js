async function avisarPush(tipoEvento, rondaId, notificacionClave) {
  try {
    await fetch("/api/notificar-ronda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipoEvento, rondaId, notificacionClave })
    });
  } catch (e) {
    console.warn("El punto se guardó, pero no se pudo solicitar la notificación:", e);
  }
}

import { db } from "./firebase.js";
import {
  doc, runTransaction, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const $ = id => document.getElementById(id);
const informacion = $("informacion");
const gps = $("gps");
const seccionFoto = $("seccionFoto");
const fotoInput = $("foto");
const vistaPrevia = $("vistaPrevia");
const canvas = $("canvas");
const estado = $("estado");
const btnCompartir = $("btnCompartir");
const btnConfirmarEnvio = $("btnConfirmarEnvio");
const btnSiguiente = $("btnSiguiente");
const error = $("error");

let datosRonda = null;
let ubicacionActual = null;
let direccionActual = "Ubicación no disponible";
let imagenFinal = null;
let registrado = false;
let compartido = false;
let gpsWatchId = null;
let fechaFoto = null;

// La imagen se comprime únicamente para enviarla por WhatsApp.
// No se sube ni se almacena en ningún servicio de archivos.
const OBJETIVO_EVIDENCIA = 180 * 1024;
const MAX_EVIDENCIA = 240 * 1024;

function mostrarError(texto) {
  error.textContent = texto;
  error.classList.remove("d-none");
}

function ocultarError() {
  error.textContent = "";
  error.classList.add("d-none");
}

function activa() {
  try {
    return JSON.parse(localStorage.getItem("rondaActiva") || sessionStorage.getItem("rondaActiva") || "null");
  } catch (e) {
    return null;
  }
}

function guardarActiva(ronda) {
  localStorage.setItem("rondaActiva", JSON.stringify(ronda));
  sessionStorage.setItem("rondaActiva", JSON.stringify(ronda));
}

function ponerLineas(elemento, lineas) {
  elemento.textContent = lineas.join("\n");
  elemento.style.whiteSpace = "pre-line";
}

function cargarDatos() {
  try {
    datosRonda = JSON.parse(sessionStorage.getItem("rondaActual") || "null");
  } catch (e) {
    datosRonda = null;
  }

  if (!datosRonda?.agente || !datosRonda?.punto || !datosRonda?.rondaId) {
    mostrarError("No se encontró información de la ronda activa.");
    return false;
  }

  ponerLineas(informacion, [
    `🧭 Ronda: ${datosRonda.tipoRonda}`,
    `👮 Nombre: ${datosRonda.agente.nombre}`,
    `🦺 Cargo: ${datosRonda.agente.cargo}`,
    `🕐 Turno: ${datosRonda.agente.turno}`,
    `📍 Punto: ${datosRonda.punto.nombre}`,
    `🔲 Código: ${datosRonda.punto.codigo}`,
    `🔢 Orden: ${datosRonda.punto.orden}`,
    "📱 QR: Validado"
  ]);

  return true;
}

function iniciarGPS() {
  seccionFoto.classList.remove("d-none");

  if (!navigator.geolocation) {
    ponerLineas(gps, ["⚠️ Ubicación no disponible.", "Puedes tomar la fotografía."]);
    return;
  }

  gps.className = "alert alert-info";
  ponerLineas(gps, ["📍 UBICACIÓN ACTIVADA", "🔄 Obteniendo ubicación actual..."]);

  gpsWatchId = navigator.geolocation.watchPosition(
    posicion => {
      ubicacionActual = {
        latitud: posicion.coords.latitude,
        longitud: posicion.coords.longitude
      };
      gps.className = "alert alert-success";
      ponerLineas(gps, ["📍 UBICACIÓN LISTA", "📸 Ya puedes tomar la fotografía."]);
    },
    () => {
      gps.className = "alert alert-warning";
      ponerLineas(gps, ["⚠️ No se pudo obtener la ubicación.", "Puedes tomar la fotografía."]);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

async function obtenerDireccion(lat, lon) {
  try {
    const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=es&lat=" +
      encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon);
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error("No disponible");

    const datos = await respuesta.json();
    const a = datos.address || {};
    const partes = [];
    const calle = a.road || a.pedestrian || a.residential || a.footway || a.path || "";
    const numero = a.house_number || "";
    const zona = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district || "";
    const ciudad = a.city || a.town || a.village || a.municipality || "";
    const region = a.state || a.region || "";
    const pais = a.country || "";

    if (calle) partes.push(calle + (numero ? " " + numero : ""));
    for (const parte of [zona, ciudad, region, pais]) {
      if (parte && !partes.includes(parte)) partes.push(parte);
    }

    return partes.length ? partes.join(", ") : (datos.display_name || "Dirección no encontrada");
  } catch (e) {
    return "Dirección no disponible";
  }
}

fotoInput.addEventListener("change", async evento => {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  ocultarError();
  registrado = false;
  compartido = false;
  btnConfirmarEnvio.classList.add("d-none");
  btnSiguiente.classList.add("d-none");
  btnCompartir.classList.add("d-none");

  fechaFoto = new Date();
  estado.className = "alert alert-info mt-3";
  estado.textContent = "📍 Preparando evidencia para WhatsApp...";

  direccionActual = ubicacionActual
    ? await obtenerDireccion(ubicacionActual.latitud, ubicacionActual.longitud)
    : "Ubicación GPS no disponible";

  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => generarImagen(img);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(archivo);
});

function lineas(ctx, texto, x, y, max, alto) {
  const palabras = String(texto).split(" ");
  let linea = "";
  let py = y;

  for (let i = 0; i < palabras.length; i++) {
    const prueba = linea + palabras[i] + " ";
    if (ctx.measureText(prueba).width > max && i > 0) {
      ctx.fillText(linea.trim(), x, py);
      linea = palabras[i] + " ";
      py += alto;
    } else {
      linea = prueba;
    }
  }

  ctx.fillText(linea.trim(), x, py);
  return py;
}

function generarImagen(img) {
  const max = 1200;
  let w = img.width;
  let h = img.height;

  if (w > max) {
    const proporcion = max / w;
    w = max;
    h *= proporcion;
  }

  const info = 540;
  canvas.width = w;
  canvas.height = h + info;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0, w, h);
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, h, w, info);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 30px Arial";
  ctx.fillText("🛡️ RONDA DE SEGURIDAD", 30, h + 45);
  ctx.font = "22px Arial";

  const fecha = fechaFoto.toLocaleDateString("es-PE");
  const hora = fechaFoto.toLocaleTimeString("es-PE");

  ctx.fillText(`🧭 Ronda ${datosRonda.tipoRonda}`, 30, h + 90);
  ctx.fillText(`👮 ${datosRonda.agente.nombre}`, 30, h + 130);
  ctx.fillText(`🦺 ${datosRonda.agente.cargo}`, 30, h + 170);
  ctx.fillText(`🕐 ${datosRonda.agente.turno}`, 30, h + 210);
  ctx.fillText(`📍 ${datosRonda.punto.nombre} (${datosRonda.punto.codigo})`, 30, h + 250);
  ctx.fillText(`🔢 Orden: ${datosRonda.punto.orden}`, 30, h + 290);
  ctx.fillText(`📅 Fecha: ${fecha}`, 30, h + 330);
  ctx.fillText(`🕐 Hora: ${hora}`, 30, h + 370);
  lineas(ctx, `📌 ${direccionActual}`, 30, h + 415, w - 60, 30);

  comprimirEvidencia(canvas)
    .then(blob => {
      imagenFinal = blob;
      vistaPrevia.classList.remove("d-none");
      estado.className = "alert alert-success mt-3";
      ponerLineas(estado, [
        "✅ Fotografía preparada",
        `🧭 Ronda ${datosRonda.tipoRonda}`,
        `📍 ${datosRonda.punto.nombre}`,
        `📅 ${fecha}`,
        `🕐 ${hora}`,
        `📌 ${direccionActual}`,
        `📲 Lista para WhatsApp: ${Math.round(blob.size / 1024)} KB`,
        "",
        "Debes enviarla al grupo de WhatsApp antes de continuar."
      ]);
      btnCompartir.classList.remove("d-none");
    })
    .catch(() => mostrarError("No se pudo optimizar la fotografía."));
}

function blobCanvas(c, tipo, calidad) {
  return new Promise((resolve, reject) => {
    c.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("No se pudo generar imagen")),
      tipo,
      calidad
    );
  });
}

async function comprimirEvidencia(c) {
  let calidad = 0.72;
  let blob = await blobCanvas(c, "image/webp", calidad);

  while (blob.size > OBJETIVO_EVIDENCIA && calidad > 0.42) {
    calidad -= 0.06;
    blob = await blobCanvas(c, "image/webp", calidad);
  }

  if (blob.size > MAX_EVIDENCIA) {
    const escala = Math.sqrt(MAX_EVIDENCIA / blob.size) * 0.94;
    const tmp = document.createElement("canvas");
    tmp.width = Math.max(720, Math.round(c.width * escala));
    tmp.height = Math.round(c.height * (tmp.width / c.width));
    tmp.getContext("2d").drawImage(c, 0, 0, tmp.width, tmp.height);
    blob = await blobCanvas(tmp, "image/webp", 0.58);
  }

  return blob;
}

function textoWhatsApp() {
  const fecha = fechaFoto.toLocaleDateString("es-PE");
  const hora = fechaFoto.toLocaleTimeString("es-PE");

  return `🛡️ RONDA DE SEGURIDAD\n\n` +
    `🧭 Ronda: ${datosRonda.tipoRonda}\n` +
    `👮 ${datosRonda.agente.nombre}\n` +
    `🦺 ${datosRonda.agente.cargo}\n` +
    `🕐 ${datosRonda.agente.turno}\n` +
    `📍 ${datosRonda.punto.nombre}\n` +
    `🔲 ${datosRonda.punto.codigo}\n` +
    `📅 Fecha: ${fecha}\n` +
    `🕐 Hora: ${hora}\n` +
    `📌 ${direccionActual}\n\n` +
    `📱 QR físico: VALIDADO\n` +
    `📸 Evidencia del punto`;
}

btnCompartir.addEventListener("click", compartir);

async function compartir() {
  if (!imagenFinal) {
    mostrarError("Primero debes tomar la fotografía.");
    return;
  }

  ocultarError();
  const archivo = new File(
    [imagenFinal],
    `ronda-${datosRonda.punto.codigo}-${Date.now()}.webp`,
    { type: "image/webp" }
  );

  try {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ text: textoWhatsApp(), files: [archivo] });
      compartido = true;
      estado.className = "alert alert-warning mt-3";
      ponerLineas(estado, [
        "📲 Se abrió el menú para compartir.",
        "Envía la fotografía al grupo de WhatsApp correspondiente.",
        "",
        "Cuando hayas comprobado que fue enviada, confirma abajo."
      ]);
      btnConfirmarEnvio.classList.remove("d-none");
      btnConfirmarEnvio.disabled = false;
    } else {
      const url = URL.createObjectURL(imagenFinal);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ronda-${datosRonda.punto.codigo}.webp`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      compartido = true;
      estado.className = "alert alert-warning mt-3";
      ponerLineas(estado, [
        "⚠️ Este navegador no permite enviar archivos directamente a WhatsApp.",
        "La fotografía fue descargada.",
        "Envíala manualmente al grupo y luego confirma el envío."
      ]);
      btnConfirmarEnvio.classList.remove("d-none");
      btnConfirmarEnvio.disabled = false;
    }
  } catch (e) {
    if (e?.name !== "AbortError") {
      mostrarError("No se pudo compartir: " + (e.message || "Error"));
    }
    // Si el usuario cancela el selector de compartir, no habilitamos el avance.
  }
}

btnConfirmarEnvio.addEventListener("click", registrarDespuesDeWhatsApp);

async function registrarDespuesDeWhatsApp() {
  if (!compartido) {
    mostrarError("Primero debes enviar la fotografía al grupo de WhatsApp.");
    return;
  }
  if (registrado) return;

  const confirmado = window.confirm(
    "Confirma que la fotografía ya fue enviada al grupo de WhatsApp.\n\n" +
    "Solo después se registrará este punto y podrás continuar la ronda."
  );
  if (!confirmado) return;

  btnConfirmarEnvio.disabled = true;
  btnCompartir.disabled = true;
  estado.className = "alert alert-info mt-3";
  estado.textContent = "✅ Confirmando QR y registrando el punto...";

  try {
    const f = fechaFoto || new Date();
    const rondaLocal = activa();
    if (!rondaLocal || rondaLocal.rondaId !== datosRonda.rondaId) {
      throw new Error("La ronda activa no coincide.");
    }

    const rondaRef = doc(db, "rondas", datosRonda.rondaId);
    const puntoRef = doc(db, "puntos", datosRonda.punto.id || datosRonda.punto.codigo);
    // ID determinista: un punto solo puede validarse una vez por ronda.
    const validacionRef = doc(db, "rondas", datosRonda.rondaId, "validaciones", datosRonda.punto.codigo);

    const esFinal = datosRonda.punto.funcionQR === "FINAL";
    const fin = new Date();

    await runTransaction(db, async transaction => {
      const rondaSnap = await transaction.get(rondaRef);
      if (!rondaSnap.exists()) throw new Error("La ronda ya no existe.");

      const rondaDb = rondaSnap.data();
      if (rondaDb.estado !== "EN_CURSO") {
        throw new Error("La ronda ya no está en curso.");
      }
      if (rondaDb.tipoRonda !== datosRonda.tipoRonda) {
        throw new Error("El tipo de ronda no coincide.");
      }

      const puntoSnap = await transaction.get(puntoRef);
      if (!puntoSnap.exists()) throw new Error("El punto ya no existe.");
      const puntoDb = puntoSnap.data();
      if (puntoDb.activo !== true) throw new Error("Este punto fue desactivado.");

      const orden = Number(datosRonda.punto.orden);
      const esperado = Number(rondaDb.ultimoOrden || 0) + 1;
      if (orden !== esperado) {
        throw new Error(`Secuencia inválida. Se esperaba el orden ${esperado}.`);
      }
      if (
        String(puntoDb.tipoRonda || "") !== String(datosRonda.tipoRonda || "") ||
        String(puntoDb.funcionQR || "") !== String(datosRonda.punto.funcionQR || "") ||
        Number(puntoDb.orden || 0) !== orden
      ) {
        throw new Error("La configuración actual del QR no coincide con la ronda.");
      }

      // No leemos la subcolección desde la PWA. Si el documento ya existe,
      // las reglas de Firestore rechazan la escritura duplicada.
      transaction.set(validacionRef, {
        puntoId: datosRonda.punto.id,
        puntoCodigo: datosRonda.punto.codigo,
        puntoNombre: datosRonda.punto.nombre,
        tipoRonda: datosRonda.tipoRonda,
        funcionQR: datosRonda.punto.funcionQR,
        orden,
        fecha: f.toLocaleDateString("es-PE"),
        hora: f.toLocaleTimeString("es-PE"),
        direccion: direccionActual,
        latitud: ubicacionActual ? ubicacionActual.latitud : null,
        longitud: ubicacionActual ? ubicacionActual.longitud : null,
        qrValidado: true,
        metodoValidacion: "QR_FISICO",
        evidenciaWhatsApp: true,
        metodoEvidencia: "WHATSAPP_GRUPO",
        fotoAlmacenada: false,
        timestamp: serverTimestamp()
      });

      const cambios = {
        ultimoOrden: orden,
        ultimoPuntoCodigo: datosRonda.punto.codigo,
        totalValidados: increment(1)
      };

      if (esFinal) {
        const inicio = new Date(rondaLocal.inicio);
        cambios.estado = "COMPLETADA";
        cambios.finTimestamp = serverTimestamp();
        cambios.horaFinLocal = fin.toISOString();
        cambios.duracionSegundos = Math.max(0, Math.round((fin - inicio) / 1000));
      }

      transaction.update(rondaRef, cambios);
    });

    if (esFinal) avisarPush("COMPLETADA", datosRonda.rondaId, rondaLocal.notificacionClave);

    rondaLocal.ultimoOrden = Number(datosRonda.punto.orden);
    rondaLocal.ultimoPuntoCodigo = datosRonda.punto.codigo;
    rondaLocal.totalValidados = Number(rondaLocal.totalValidados || 0) + 1;
    if (esFinal) rondaLocal.finalizada = true;
    guardarActiva(rondaLocal);

    registrado = true;
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }

    estado.className = "alert alert-success mt-3";
    ponerLineas(estado, [
      `✅ ${esFinal ? "ÚLTIMO PUNTO REGISTRADO" : "PUNTO REGISTRADO"}`,
      `🧭 Ronda ${datosRonda.tipoRonda}`,
      `📍 ${datosRonda.punto.nombre}`,
      "📱 QR físico: VALIDADO",
      "📲 Evidencia: enviada por WhatsApp",
      "☁️ Foto almacenada en el sistema: NO"
    ]);

    btnCompartir.classList.add("d-none");
    btnConfirmarEnvio.classList.add("d-none");
    mostrarBotonSiguiente();
  } catch (e) {
    mostrarError("No se pudo registrar el punto: " + (e.message || e));
    btnConfirmarEnvio.disabled = false;
    btnCompartir.disabled = false;
    estado.className = "alert alert-warning mt-3";
    estado.textContent = "⚠️ El punto todavía no fue registrado. Puedes reintentar sin volver a tomar la foto.";
  }
}

function mostrarBotonSiguiente() {
  btnSiguiente.classList.remove("d-none");
  const esFinal = datosRonda.punto.funcionQR === "FINAL";
  btnSiguiente.textContent = esFinal ? "✅ FINALIZAR RONDA" : "🔄 CONTINUAR RONDA";
  btnSiguiente.className = esFinal
    ? "btn btn-danger btn-lg w-100 mt-2"
    : "btn btn-dark btn-lg w-100 mt-2";
}

btnSiguiente.addEventListener("click", () => {
  if (!registrado) {
    mostrarError("Primero debes enviar la evidencia y registrar el punto.");
    return;
  }

  const esFinal = datosRonda.punto.funcionQR === "FINAL";
  sessionStorage.removeItem("rondaActual");

  if (esFinal) {
    localStorage.removeItem("rondaActiva");
    sessionStorage.removeItem("rondaActiva");
    document.body.innerHTML = `<div class="container py-5"><div class="card shadow-sm mx-auto" style="max-width:600px"><div class="card-body text-center p-5"><div class="fs-1">✅</div><h2>Ronda completada</h2><p class="lead">La ronda finalizó correctamente.</p><a href="index.html" class="btn btn-primary btn-lg w-100">VOLVER AL INICIO</a></div></div></div>`;
  } else {
    location.href = "index.html";
  }
});

window.addEventListener("pagehide", () => {
  if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
});

if (cargarDatos()) iniciarGPS();
