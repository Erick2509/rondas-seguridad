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
const vistaPrevia = $("vistaPrevia");
const canvas = $("canvas");
const estado = $("estado");
const btnCompartir = $("btnCompartir");
const btnConfirmarEnvio = $("btnConfirmarEnvio");
const btnSiguiente = $("btnSiguiente");
const btnActivarCamara = $("btnActivarCamara");
const btnTomarFoto = $("btnTomarFoto");
const btnRepetirFoto = $("btnRepetirFoto");
const videoCamara = $("videoCamara");
const contenedorCamara = $("contenedorCamara");
const error = $("error");

let datosRonda = null;
let ubicacionActual = null;
let direccionActual = "Ubicación no disponible";
let imagenFinal = null;
let registrado = false;
let compartido = false;
let gpsWatchId = null;
let fechaFoto = null;
let streamCamara = null;

const logoMarca = new Image();
logoMarca.src = "icons/logo-prevencion-recortado.png";
logoMarca.decoding = "async";
const logoLista = new Promise(resolve => {
  if (logoMarca.complete) return resolve(true);
  logoMarca.onload = () => resolve(true);
  logoMarca.onerror = () => resolve(false);
});

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


function ajustarRelacionCaja(caja, ancho, alto) {
  if (!caja || !ancho || !alto) return;
  caja.style.aspectRatio = `${ancho} / ${alto}`;
}

async function iniciarCamara() {
  ocultarError();
  if (streamCamara) return;

  try {
    streamCamara = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    videoCamara.srcObject = streamCamara;
    await videoCamara.play();
    ajustarRelacionCaja(contenedorCamara, videoCamara.videoWidth || 3, videoCamara.videoHeight || 4);
    btnTomarFoto.disabled = false;
    btnActivarCamara.classList.add("d-none");
    btnRepetirFoto.classList.add("d-none");
    contenedorCamara.classList.remove("d-none");
  } catch (e) {
    btnTomarFoto.disabled = true;
    mostrarError("No se pudo abrir la cámara. Revisa los permisos del navegador.");
  }
}

function detenerCamara() {
  if (streamCamara) {
    for (const track of streamCamara.getTracks()) track.stop();
  }
  streamCamara = null;
  videoCamara.srcObject = null;
  btnTomarFoto.disabled = true;
  btnActivarCamara.classList.remove("d-none");
}

videoCamara.addEventListener("loadedmetadata", () => {
  ajustarRelacionCaja(contenedorCamara, videoCamara.videoWidth || 3, videoCamara.videoHeight || 4);
});

btnActivarCamara.addEventListener("click", iniciarCamara);

btnTomarFoto.addEventListener("click", async () => {
  if (!streamCamara || !videoCamara.videoWidth) {
    mostrarError("Primero debes activar la cámara.");
    return;
  }

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

  const captura = document.createElement("canvas");
  captura.width = videoCamara.videoWidth;
  captura.height = videoCamara.videoHeight;
  captura.getContext("2d").drawImage(videoCamara, 0, 0, captura.width, captura.height);

  const img = new Image();
  img.onload = async () => {
    await generarImagen(img);
    detenerCamara();
    btnRepetirFoto.classList.remove("d-none");
  };
  img.src = captura.toDataURL("image/jpeg", 0.92);
});

btnRepetirFoto.addEventListener("click", async () => {
  vistaPrevia.classList.add("d-none");
  btnConfirmarEnvio.classList.add("d-none");
  btnSiguiente.classList.add("d-none");
  btnCompartir.classList.add("d-none");
  await iniciarCamara();
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

function rectRedondeado(ctx, x, y, ancho, alto, radio) {
  const r = Math.min(radio, ancho / 2, alto / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, r);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, r);
  ctx.arcTo(x, y + alto, x, y, r);
  ctx.arcTo(x, y, x + ancho, y, r);
  ctx.closePath();
}

async function generarImagen(img) {
  const max = 1200;
  let w = img.width;
  let h = img.height;

  if (w > max) {
    const proporcion = max / w;
    w = max;
    h *= proporcion;
  }

  const esVertical = h >= w;
  const dosColumnas = !esVertical && w >= 900;
  const info = dosColumnas ? 430 : (esVertical ? 620 : 520);
  canvas.width = w;
  canvas.height = h + info;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0, w, h);

  const logoDisponible = await logoLista;
  if (logoDisponible) {
    const pad = 20;
    const ratio = logoMarca.naturalWidth && logoMarca.naturalHeight
      ? logoMarca.naturalWidth / logoMarca.naturalHeight
      : 6.5;
    const boxW = Math.min(320, Math.max(210, w * 0.30));
    const innerW = boxW - 28;
    const innerH = innerW / ratio;
    const boxH = Math.max(54, Math.round(innerH + 22));
    const boxX = w - boxW - pad;
    const boxY = pad;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
    rectRedondeado(ctx, boxX, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
    ctx.lineWidth = 2;
    rectRedondeado(ctx, boxX, boxY, boxW, boxH, 18);
    ctx.stroke();
    const logoX = boxX + 14;
    const logoY = boxY + (boxH - innerH) / 2;
    ctx.drawImage(logoMarca, logoX, logoY, innerW, innerH);
    ctx.restore();
  }

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, h, w, info);

  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(0, h, w, 10);

  const fecha = fechaFoto.toLocaleDateString("es-PE");
  const hora = fechaFoto.toLocaleTimeString("es-PE");
  const margen = esVertical ? 26 : 30;

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${esVertical ? 28 : 34}px Arial`;
  ctx.fillText("EVIDENCIA DE RONDA", margen, h + 56);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = `${esVertical ? 16 : 18}px Arial`;
  ctx.fillText("Registro validado para control de seguridad", margen, h + 86);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margen, h + 110);
  ctx.lineTo(w - margen, h + 110);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `${esVertical ? 20 : 22}px Arial`;

  if (dosColumnas) {
    const col2X = Math.max(w * 0.53, 420);
    ctx.fillText(`🧭 Ronda: ${datosRonda.tipoRonda}`, margen, h + 152);
    ctx.fillText(`👮 Agente: ${datosRonda.agente.nombre}`, margen, h + 194);
    ctx.fillText(`🦺 Cargo: ${datosRonda.agente.cargo}`, margen, h + 236);
    ctx.fillText(`🕐 Turno: ${datosRonda.agente.turno}`, margen, h + 278);

    ctx.fillText(`📍 Punto: ${datosRonda.punto.nombre}`, col2X, h + 152);
    ctx.fillText(`🔲 Código: ${datosRonda.punto.codigo}`, col2X, h + 194);
    ctx.fillText(`🔢 Orden: ${datosRonda.punto.orden}`, col2X, h + 236);
    ctx.fillText(`📱 QR físico: Validado`, col2X, h + 278);

    ctx.fillText(`📅 Fecha: ${fecha}`, margen, h + 332);
    ctx.fillText(`🕐 Hora: ${hora}`, col2X, h + 332);
    lineas(ctx, `📌 Dirección: ${direccionActual}`, margen, h + 382, w - (margen * 2), 30);
  } else {
    let y = h + 152;
    const salto = esVertical ? 40 : 38;
    const maxTexto = w - (margen * 2);
    const filas = [
      `🧭 Ronda: ${datosRonda.tipoRonda}`,
      `👮 Agente: ${datosRonda.agente.nombre}`,
      `🦺 Cargo: ${datosRonda.agente.cargo}`,
      `🕐 Turno: ${datosRonda.agente.turno}`,
      `📍 Punto: ${datosRonda.punto.nombre}`,
      `🔲 Código: ${datosRonda.punto.codigo}`,
      `🔢 Orden: ${datosRonda.punto.orden}`,
      `📱 QR físico: Validado`,
      `📅 Fecha: ${fecha}`,
      `🕐 Hora: ${hora}`
    ];
    for (const fila of filas) {
      y = lineas(ctx, fila, margen, y, maxTexto, 28);
      y += 14;
    }
    lineas(ctx, `📌 Dirección: ${direccionActual}`, margen, y + 2, maxTexto, 30);
  }

  ctx.fillStyle = "#94a3b8";
  ctx.font = `${esVertical ? 15 : 16}px Arial`;
  ctx.fillText("PREVENCIÓN · Evidencia preparada para envío por WhatsApp", margen, h + info - 26);

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
        "Envía la fotografía al grupo de WhatsApp antes de continuar."
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

  return `🛡️ PREVENCIÓN\n\n` +
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
      "📲 Evidencia: enviada por WhatsApp"
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
    document.body.innerHTML = `<div class="container py-5"><div class="card shadow-sm mx-auto" style="max-width:600px;border-radius:24px;overflow:hidden"><div style="background:#111827;padding:24px;text-align:center"><img src="icons/logo-prevencion-recortado.png" alt="Prevención" style="width:min(280px,80vw);max-height:72px;object-fit:contain"></div><div class="card-body text-center p-5"><div class="fs-1">✅</div><h2>Ronda completada</h2><p class="lead">La ronda finalizó correctamente.</p><a href="index.html" class="btn btn-primary btn-lg w-100">VOLVER AL INICIO</a></div></div></div>`;
  } else {
    location.href = "index.html";
  }
});

window.addEventListener("pagehide", () => {
  if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
  detenerCamara();
});

if (cargarDatos()) iniciarGPS();
