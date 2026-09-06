
/* =========================================================
   NOTIFICACIONES PUSH - PWA ADMINISTRACIÓN
   ========================================================= */
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";

const VAPID_PUBLIC_KEY = "BDHsF6Yh-g_REJp45fr5QCLjVfCitfpiy6mt4Kdca9_WtAOdeFh8mJFk-SUVSFcrRIFyAH_1xDrLpbQWPe5wAUA";

async function activarNotificacionesPush() {
  const btn = document.getElementById("btnPush");
  const estado = document.getElementById("estadoPush");

  try {
    if (!(await isSupported())) {
      throw new Error("Este navegador no es compatible con notificaciones push.");
    }

    const user = auth.currentUser;
    if (!user || !rolActual || !["ADMIN", "CLIENTE"].includes(rolActual)) {
      throw new Error("Debes iniciar sesión como ADMIN o CLIENTE.");
    }

    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      estado.textContent = "Notificaciones no autorizadas";
      return;
    }

    const registro = await navigator.serviceWorker.ready;
    const messaging = getMessaging();

    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registro
    });

    if (!token) {
      throw new Error("Firebase no devolvió un token para este dispositivo.");
    }

    let deviceId = localStorage.getItem("pushDeviceId");
    if (!deviceId) {
      deviceId = (crypto.randomUUID ? crypto.randomUUID() :
        Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem("pushDeviceId", deviceId);
    }

    const docId = `device_${deviceId}`;

    await setDoc(doc(db, "dispositivosPush", docId), {
      uid: user.uid,
      correo: user.email || "",
      rol: rolActual,
      token,
      activo: true,
      plataforma: navigator.userAgent || "",
      actualizadoEn: serverTimestamp()
    }, { merge: true });

    localStorage.setItem("fcmAdminToken", token);
    localStorage.setItem("pushDocId", docId);

    estado.textContent = "✅ Notificaciones automáticas activadas";
    btn.textContent = "🔔 NOTIFICACIONES ACTIVADAS";
    btn.disabled = true;

  } catch (error) {
    console.error("Error activando push:", error);
    estado.textContent = "❌ " + (error?.message || "No se pudieron activar las notificaciones");
  }
}

async function prepararPush() {
  const btn = document.getElementById("btnPush");
  const estado = document.getElementById("estadoPush");

  if (!btn || !estado) return;

  btn.disabled = false;
  btn.textContent = "🔔 ACTIVAR NOTIFICACIONES";

  if (!("Notification" in window)) {
    estado.textContent = "❌ Este navegador no admite notificaciones.";
    btn.disabled = true;
    return;
  }

  if (Notification.permission === "denied") {
    estado.textContent = "⚠️ Las notificaciones están bloqueadas en el iPhone/navegador.";
    btn.textContent = "🔔 NOTIFICACIONES BLOQUEADAS";
    return;
  }

  const docId = localStorage.getItem("pushDocId");
  if (Notification.permission === "granted" && docId) {
    estado.textContent = "✅ Notificaciones automáticas activadas";
    btn.textContent = "🔔 REACTIVAR / ACTUALIZAR";
  } else if (Notification.permission === "granted") {
    estado.textContent = "Permiso concedido. Pulsa ACTIVAR para registrar este celular.";
  } else {
    estado.textContent = "Notificaciones todavía no activadas";
  }

  // Importante en iPhone: el requestPermission debe ocurrir directamente
  // dentro del toque del usuario, sin operaciones async previas.
  btn.onclick = async () => {
    try {
      if (Notification.permission === "default") {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          estado.textContent = "⚠️ No se concedió permiso para notificaciones.";
          return;
        }
      }

      estado.textContent = "Registrando este celular...";
      await activarNotificacionesPush();

      // Si activarNotificacionesPush terminó correctamente habrá guardado pushDocId.
      if (localStorage.getItem("pushDocId")) {
        estado.textContent = "✅ Notificaciones automáticas activadas";
        btn.textContent = "🔔 REACTIVAR / ACTUALIZAR";
        btn.disabled = false;
      }
    } catch (e) {
      console.error(e);
      estado.textContent = "❌ " + (e?.message || "No se pudo activar");
      btn.disabled = false;
    }
  };
}

document.addEventListener("DOMContentLoaded", prepararPush);

import { db } from "./firebase.js";
import {
    getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { collection,
    getDocs,
    query,
    orderBy,
    limit,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// =====================================================
// AUTENTICACIÓN Y ROLES
// =====================================================

const auth = getAuth();
let rolActual = null;
let usuarioActual = null;
let accesoResuelto = false;

function ocultarFuncionesEdicionParaCliente() {
    // La cliente solo usa el historial de rondas.
    const selectores = [
        '[data-seccion="inicio"]',
        '[data-seccion="puntos"]',
        '[data-seccion="agentes"]',
        '[data-target="inicio"]',
        '[data-target="puntos"]',
        '[data-target="agentes"]'
    ];

    selectores.forEach(function(sel) {
        document.querySelectorAll(sel).forEach(function(el) {
            el.style.display = "none";
        });
    });

    // Compatibilidad con los IDs/clases del panel actual.
    document.querySelectorAll("button, a").forEach(function(el) {
        const t = (el.textContent || "").trim().toUpperCase();
        if (
            t.includes("PUNTOS / QR") ||
            t === "PUNTOS" ||
            t.includes("AGENTES") ||
            t === "INICIO"
        ) {
            el.style.display = "none";
        }
    });

    // Oculta paneles de edición si existieran visibles.
    document.querySelectorAll('[id*="punto"],[id*="agente"]').forEach(function(el) {
        const id=(el.id||"").toLowerCase();
        if (
            id.includes("form") ||
            id.includes("modal") ||
            id.includes("seccion") ||
            id.includes("panel")
        ) el.style.display="none";
    });

    // Abre la pestaña Rondas.
    const candidatos=[...document.querySelectorAll("button,a")];
    const rondas=candidatos.find(function(el){
        return (el.textContent||"").trim().toUpperCase()==="RONDAS";
    });
    if(rondas) rondas.click();
}

async function resolverAcceso(user) {
    if (!user) {
        location.replace("login.html");
        return;
    }

    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (!snap.exists() || snap.data().activo !== true) {
        await signOut(auth);
        location.replace("login.html");
        return;
    }

    const rol = snap.data().rol;
    if (rol !== "ADMIN" && rol !== "CLIENTE") {
        await signOut(auth);
        location.replace("login.html");
        return;
    }

    rolActual = rol;
    usuarioActual = user;
    accesoResuelto = true;

    const rolSesion=document.getElementById("rolSesion");
    const correoSesion=document.getElementById("correoSesion");
    if(rolSesion) rolSesion.textContent =
        rol === "ADMIN" ? "👨‍💻 ADMINISTRADOR" : "👩‍💼 CLIENTE";
    if(correoSesion) correoSesion.textContent = user.email || "";

    if (rol === "CLIENTE") {
        ocultarFuncionesEdicionParaCliente();
    }

    document.body.style.visibility = "visible";
}

onAuthStateChanged(auth, function(user) {
    resolverAcceso(user).catch(async function() {
        try { await signOut(auth); } catch(e) {}
        location.replace("login.html");
    });
});

const btnCerrarSesion=document.getElementById("btnCerrarSesion");
if(btnCerrarSesion){
    btnCerrarSesion.addEventListener("click", async function(){
        await signOut(auth);
        location.replace("login.html");
    });
}


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
const btnCancelarEdicionQR = $("btnCancelarEdicionQR");
const tituloFormularioQR = $("tituloFormularioQR");

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
let puntoEditandoId = null;

// Historial: 10 rondas por página para ADMIN y CLIENTE.
const RONDAS_POR_PAGINA = 10;
let paginaRondas = 1;
let rondasVistaActual = [];


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

        // Al volver al resumen, consulta nuevamente Firebase para
        // mostrar rondas, puntos y agentes con los datos más recientes.
        Promise.allSettled([
            cargarRondas(),
            cargarPuntos(),
            cargarAgentes()
        ]);
    }


    if (nombre === "rondas") {

        seccionRondas.classList.add("activa");
        menuRondas.classList.add("activo");

        // Actualiza el historial cada vez que se pulsa Rondas.
        cargarRondas();
    }


    if (nombre === "qr") {

        seccionQR.classList.add("activa");
        menuQR.classList.add("activo");

        // Actualiza la lista de puntos/QR cada vez que se abre.
        cargarPuntos();
    }


    if (nombre === "agentes") {

        seccionAgentes.classList.add("activa");
        menuAgentes.classList.add("activo");

        // Actualiza la lista de agentes cada vez que se abre.
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
// HISTORIAL DE RONDAS COMPLETAS
// =====================================================

function fechaDesdeValor(valor) {
    if (!valor) return null;
    try {
        if (typeof valor.toDate === "function") return valor.toDate();
        const f = new Date(valor);
        return Number.isNaN(f.getTime()) ? null : f;
    } catch (e) {
        return null;
    }
}

function fechaRonda(ronda) {
    const f =
        fechaDesdeValor(ronda.inicioTimestamp) ||
        fechaDesdeValor(ronda.timestamp) ||
        fechaDesdeValor(ronda.horaInicioLocal);

    if (f) return f.toLocaleDateString("es-PE");

    return ronda.fecha || "-";
}

function horaInicioRonda(ronda) {
    const f =
        fechaDesdeValor(ronda.inicioTimestamp) ||
        fechaDesdeValor(ronda.timestamp) ||
        fechaDesdeValor(ronda.horaInicioLocal);

    if (f) return f.toLocaleTimeString("es-PE");

    return ronda.hora || "-";
}

function horaFinRonda(ronda) {
    const f =
        fechaDesdeValor(ronda.finTimestamp) ||
        fechaDesdeValor(ronda.horaFinLocal);

    return f ? f.toLocaleTimeString("es-PE") : "-";
}

function horaCancelacionRonda(ronda) {
    const f =
        fechaDesdeValor(ronda.cancelacionTimestamp) ||
        fechaDesdeValor(ronda.horaCancelacionLocal);

    return f ? f.toLocaleTimeString("es-PE") : "-";
}

function duracionTexto(segundos) {
    const total = Number(segundos);

    if (!Number.isFinite(total) || total < 0) {
        return "-";
    }

    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const seg = Math.floor(total % 60);

    const partes = [];

    if (horas > 0) partes.push(horas + " h");
    if (minutos > 0 || horas > 0) partes.push(minutos + " min");
    partes.push(seg + " s");

    return partes.join(" ");
}

function esRondaNueva(ronda) {
    return !!(
        ronda.tipoRonda ||
        ronda.inicioTimestamp ||
        ronda.horaInicioLocal ||
        ronda.totalValidados !== undefined
    );
}

async function cargarValidacionesRonda(rondaId) {
    const resultado =
        await getDocs(
            collection(
                db,
                "rondas",
                rondaId,
                "validaciones"
            )
        );

    const validaciones = [];

    resultado.forEach(
        function (documento) {
            validaciones.push({
                id: documento.id,
                ...documento.data()
            });
        }
    );

    validaciones.sort(
        function (a, b) {
            const oa = Number(a.orden || 0);
            const ob = Number(b.orden || 0);

            if (oa !== ob) {
                return oa - ob;
            }

            const fa =
                fechaDesdeValor(a.timestamp);

            const fb =
                fechaDesdeValor(b.timestamp);

            return (
                (fa ? fa.getTime() : 0) -
                (fb ? fb.getTime() : 0)
            );
        }
    );

    return validaciones;
}


// =====================================================
// CARGAR RONDAS
// =====================================================

async function cargarRondas() {

    error.style.display = "none";
    cargando.style.display = "block";
    listaRondas.innerHTML = "";

    try {

        // No usamos orderBy("timestamp") porque las nuevas
        // rondas utilizan inicioTimestamp y las antiguas timestamp.
        const resultado =
            await getDocs(
                collection(
                    db,
                    "rondas"
                )
            );

        const documentos = [];

        resultado.forEach(
            function (documento) {
                documentos.push({
                    id: documento.id,
                    ...documento.data()
                });
            }
        );

        // Cargar los QR validados de cada ronda nueva.
        await Promise.all(
            documentos.map(
                async function (ronda) {

                    if (esRondaNueva(ronda)) {
                        try {
                            ronda.validaciones =
                                await cargarValidacionesRonda(
                                    ronda.id
                                );
                        } catch (e) {
                            console.error(
                                "No se pudieron cargar validaciones de " +
                                ronda.id,
                                e
                            );

                            ronda.validaciones = [];
                        }
                    } else {
                        ronda.validaciones = [];
                    }
                }
            )
        );

        documentos.sort(
            function (a, b) {

                const fa =
                    fechaDesdeValor(a.inicioTimestamp) ||
                    fechaDesdeValor(a.timestamp) ||
                    fechaDesdeValor(a.horaInicioLocal);

                const fb =
                    fechaDesdeValor(b.inicioTimestamp) ||
                    fechaDesdeValor(b.timestamp) ||
                    fechaDesdeValor(b.horaInicioLocal);

                return (
                    (fb ? fb.getTime() : 0) -
                    (fa ? fa.getTime() : 0)
                );
            }
        );

        rondas = documentos;

        cargando.style.display = "none";

        actualizarResumenRondas();
        instalarFiltrosRondas();
        actualizarOpcionesFiltrosRondas();
        paginaRondas = 1;
        aplicarFiltrosRondas();

    } catch (e) {

        console.error(
            "Error cargando rondas:",
            e
        );

        cargando.style.display = "none";

        error.textContent =
            "No se pudieron cargar las rondas: " +
            e.message;

        error.style.display = "block";
    }
}


// =====================================================
// RESUMEN RONDAS
// =====================================================

function actualizarResumenRondas() {

    totalRondas.textContent =
        rondas.length;

    const hoy =
        new Date()
            .toLocaleDateString(
                "es-PE"
            );

    const cantidadHoy =
        rondas.filter(
            function (ronda) {
                return fechaRonda(ronda) === hoy;
            }
        ).length;

    rondasHoy.textContent =
        cantidadHoy;
}


// =====================================================
// PUNTOS FALTANTES DE UNA RONDA
// =====================================================

function obtenerResumenRecorrido(ronda) {
    const ruta = puntos
        .filter(function (punto) {
            return punto.activo === true &&
                punto.tipoRonda === ronda.tipoRonda &&
                Number(punto.orden || 0) > 0;
        })
        .sort(function (a, b) {
            return Number(a.orden || 0) - Number(b.orden || 0);
        });

    const validados = new Set(
        (Array.isArray(ronda.validaciones) ? ronda.validaciones : [])
            .map(function (v) {
                return String(v.puntoCodigo || v.puntoId || "").toUpperCase();
            })
    );

    const faltantes = ruta.filter(function (punto) {
        const codigo = String(punto.codigo || punto.id || "").toUpperCase();
        return !validados.has(codigo);
    });

    return {
        ruta: ruta,
        faltantes: faltantes,
        completados: Math.max(0, ruta.length - faltantes.length)
    };
}

function crearAvisoRondaIncompleta(ronda) {
    const resumen = obtenerResumenRecorrido(ronda);
    const aviso = document.createElement("div");
    aviso.className = "alert alert-danger mt-3 mb-0";

    const titulo = document.createElement("div");
    titulo.innerHTML = "<strong>⚠️ Recorrido no completado</strong>";
    aviso.appendChild(titulo);

    const progreso = document.createElement("div");
    progreso.style.marginTop = "6px";

    if (resumen.ruta.length > 0) {
        progreso.textContent =
            "✅ Completado: " + resumen.completados +
            " de " + resumen.ruta.length + " QR";
    } else {
        progreso.textContent =
            "Último QR validado: " +
            (ronda.ultimoPuntoCodigo || "Ninguno");
    }
    aviso.appendChild(progreso);

    if (resumen.ruta.length > 0) {
        const cantidad = document.createElement("div");
        cantidad.textContent =
            "❌ Faltaron: " + resumen.faltantes.length + " QR";
        aviso.appendChild(cantidad);

        resumen.faltantes.forEach(function (punto) {
            const linea = document.createElement("div");
            linea.style.marginTop = "4px";
            linea.textContent =
                "📍 " + (punto.codigo || punto.id) +
                " — " + (punto.nombre || "Punto") +
                " · Orden " + Number(punto.orden || 0);
            aviso.appendChild(linea);
        });
    }

    return aviso;
}

// =====================================================
// MOSTRAR VALIDACIONES
// =====================================================

function crearBloqueValidaciones(ronda) {

    const bloque =
        document.createElement(
            "div"
        );

    bloque.style.marginTop = "14px";
    bloque.style.paddingTop = "12px";
    bloque.style.borderTop =
        "1px solid #e5e7eb";

    const titulo =
        document.createElement(
            "div"
        );

    titulo.style.fontWeight =
        "800";

    titulo.style.marginBottom =
        "10px";

    const cantidad =
        Array.isArray(
            ronda.validaciones
        )
            ? ronda.validaciones.length
            : Number(
                ronda.totalValidados ||
                0
            );

    titulo.textContent =
        "📍 QR VALIDADOS: " +
        cantidad;

    bloque.appendChild(
        titulo
    );

    if (
        !Array.isArray(
            ronda.validaciones
        ) ||
        ronda.validaciones.length === 0
    ) {

        const vacio =
            document.createElement(
                "div"
            );

        vacio.className =
            "punto-fecha";

        vacio.textContent =
            ronda.estado === "EN_CURSO"
                ? "Aún no hay QR registrados en esta ronda."
                : "No hay detalle de QR disponible.";

        bloque.appendChild(
            vacio
        );

        return bloque;
    }

    ronda.validaciones.forEach(
        function (validacion) {

            const item =
                document.createElement(
                    "div"
                );

            item.style.padding =
                "9px 0";

            item.style.borderBottom =
                "1px solid #f1f5f9";

            const principal =
                document.createElement(
                    "div"
                );

            principal.style.fontWeight =
                "700";

            principal.textContent =
                "✅ " +
                (
                    validacion.puntoCodigo ||
                    validacion.puntoId ||
                    "-"
                ) +
                " — " +
                (
                    validacion.puntoNombre ||
                    "Punto"
                );

            const meta =
                document.createElement(
                    "div"
                );

            meta.style.fontSize =
                "13px";

            meta.style.color =
                "#64748b";

            const hora =
                validacion.hora ||
                (
                    fechaDesdeValor(
                        validacion.timestamp
                    )
                        ? fechaDesdeValor(
                            validacion.timestamp
                        ).toLocaleTimeString(
                            "es-PE"
                        )
                        : "-"
                );

            meta.textContent =
                "🕐 " +
                hora +
                " · Orden " +
                (
                    validacion.orden ??
                    "-"
                ) +
                " · " +
                (
                    validacion.funcionQR ||
                    "PUNTO"
                );

            item.appendChild(
                principal
            );

            item.appendChild(
                meta
            );

            bloque.appendChild(
                item
            );
        }
    );

    return bloque;
}


// =====================================================
// MOSTRAR RONDAS
// =====================================================

function mostrarRondas(
    datos
) {

    listaRondas.innerHTML = "";
    rondasVistaActual = Array.isArray(datos) ? datos : [];

    if (rondasVistaActual.length === 0) {
        listaRondas.innerHTML =
            '<div class="sin-resultados">No se encontraron rondas.</div>';
        return;
    }

    const totalPaginas = Math.max(
        1,
        Math.ceil(rondasVistaActual.length / RONDAS_POR_PAGINA)
    );

    if (paginaRondas > totalPaginas) paginaRondas = totalPaginas;
    if (paginaRondas < 1) paginaRondas = 1;

    const inicioPagina = (paginaRondas - 1) * RONDAS_POR_PAGINA;
    const finPagina = inicioPagina + RONDAS_POR_PAGINA;
    const datosPagina = rondasVistaActual.slice(inicioPagina, finPagina);

    datosPagina.forEach(
        function (ronda) {

            // =========================================
            // COMPATIBILIDAD CON HISTORIAL ANTIGUO
            // =========================================

            if (!esRondaNueva(ronda)) {

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

                if (rolActual === "ADMIN") {
                    superior.appendChild(crearBotonEliminarRonda(ronda));
                }

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

                return;
            }

            // =========================================
            // NUEVA RONDA AGRUPADA
            // =========================================

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

            const titulo =
                document.createElement(
                    "div"
                );

            titulo.className =
                "agente";

            const iconoTipo =
                ronda.tipoRonda ===
                "EXTERNA"
                    ? "🌳"
                    : "🏢";

            titulo.textContent =
                iconoTipo +
                " RONDA " +
                (
                    ronda.tipoRonda ||
                    "-"
                );

            const estado =
                document.createElement(
                    "span"
                );

            estado.className =
                "estado";

            if (
                ronda.estado ===
                "COMPLETADA"
            ) {

                estado.textContent =
                    "✅ COMPLETADA";

            } else if (
                ronda.estado ===
                "EN_CURSO"
            ) {

                estado.textContent =
                    "🟡 EN CURSO";

            } else if (
                ronda.estado ===
                "INCOMPLETA"
            ) {

                estado.textContent =
                    "🔴 INCOMPLETA";

            } else {

                estado.textContent =
                    "⚪ " +
                    (
                        ronda.estado ||
                        "SIN ESTADO"
                    );
            }

            superior.appendChild(
                titulo
            );

            superior.appendChild(
                estado
            );

            if (rolActual === "ADMIN") {
                superior.appendChild(crearBotonEliminarRonda(ronda));
            }

            const detalle =
                document.createElement(
                    "div"
                );

            detalle.className =
                "detalle";

            agregarLinea(
                detalle,
                "👮 Agente: ",
                ronda.agenteNombre ||
                "-"
            );

            agregarLinea(
                detalle,
                "🦺 Cargo: ",
                ronda.agenteCargo ||
                "-"
            );

            agregarLinea(
                detalle,
                "🕐 Turno: ",
                ronda.agenteTurno ||
                "-"
            );

            agregarLinea(
                detalle,
                "📅 Fecha: ",
                fechaRonda(
                    ronda
                )
            );

            agregarLinea(
                detalle,
                "🟢 Inicio: ",
                horaInicioRonda(
                    ronda
                )
            );

            if (ronda.estado === "INCOMPLETA") {
                agregarLinea(
                    detalle,
                    "⛔ Cancelada: ",
                    horaCancelacionRonda(ronda)
                );

                agregarLinea(
                    detalle,
                    "⏱️ Duración: ",
                    duracionTexto(ronda.duracionSegundos)
                );

                agregarLinea(
                    detalle,
                    "📝 Motivo: ",
                    ronda.motivoCancelacion || "Sin motivo"
                );
            } else {
                agregarLinea(
                    detalle,
                    "🔴 Final: ",
                    ronda.estado === "COMPLETADA"
                        ? horaFinRonda(ronda)
                        : "-"
                );

                agregarLinea(
                    detalle,
                    "⏱️ Duración: ",
                    ronda.estado === "COMPLETADA"
                        ? duracionTexto(ronda.duracionSegundos)
                        : "En curso"
                );
            }

            agregarLinea(
                detalle,
                "🔢 Total QR: ",
                Array.isArray(
                    ronda.validaciones
                )
                    ? ronda.validaciones.length
                    : (
                        ronda.totalValidados ||
                        0
                    )
            );

            if (ronda.estado === "INCOMPLETA") {
                detalle.appendChild(
                    crearAvisoRondaIncompleta(ronda)
                );
            }

            detalle.appendChild(
                crearBloqueValidaciones(
                    ronda
                )
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

    const totalPaginasPaginacion = Math.max(
        1,
        Math.ceil(rondasVistaActual.length / RONDAS_POR_PAGINA)
    );

    const paginacion = document.createElement("div");
    paginacion.className = "paginacion-rondas";

    const anterior = document.createElement("button");
    anterior.type = "button";
    anterior.className = "btn-actualizar";
    anterior.textContent = "← ANTERIOR";
    anterior.disabled = paginaRondas <= 1;
    anterior.addEventListener("click", function() {
        if (paginaRondas > 1) {
            paginaRondas--;
            mostrarRondas(rondasVistaActual);
            seccionRondas.scrollIntoView({behavior:"smooth", block:"start"});
        }
    });

    const infoPagina = document.createElement("div");
    infoPagina.className = "info-paginacion";
    infoPagina.textContent =
        `Página ${paginaRondas} de ${totalPaginasPaginacion} · ${rondasVistaActual.length} rondas`;

    const siguiente = document.createElement("button");
    siguiente.type = "button";
    siguiente.className = "btn-actualizar";
    siguiente.textContent = "SIGUIENTE →";
    siguiente.disabled = paginaRondas >= totalPaginasPaginacion;
    siguiente.addEventListener("click", function() {
        if (paginaRondas < totalPaginasPaginacion) {
            paginaRondas++;
            mostrarRondas(rondasVistaActual);
            seccionRondas.scrollIntoView({behavior:"smooth", block:"start"});
        }
    });

    paginacion.appendChild(anterior);
    paginacion.appendChild(infoPagina);
    paginacion.appendChild(siguiente);
    listaRondas.appendChild(paginacion);
}


// =====================================================
// ELIMINAR RONDA - SOLO ADMIN
// =====================================================

function crearBotonEliminarRonda(ronda) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn-eliminar-ronda";
    boton.textContent = "🗑️ ELIMINAR";
    boton.title = "Eliminar esta ronda definitivamente";

    boton.addEventListener("click", async function() {
        if (rolActual !== "ADMIN") return;

        const agente = ronda.agenteNombre || "Agente";
        const fecha = fechaRonda(ronda) || ronda.fecha || "";
        const confirmar = window.confirm(
            `¿Eliminar definitivamente esta ronda?\n\n${agente}${fecha ? " · " + fecha : ""}\n\nEsta acción no se puede deshacer.`
        );
        if (!confirmar) return;

        boton.disabled = true;
        boton.textContent = "ELIMINANDO...";

        try {
            // Firestore no elimina subcolecciones automáticamente.
            // Primero quitamos las validaciones/evidencias y luego la ronda.
            const validacionesRef = collection(db, "rondas", ronda.id, "validaciones");
            const validacionesSnap = await getDocs(validacionesRef);

            for (const validacionDoc of validacionesSnap.docs) {
                await deleteDoc(
                    doc(db, "rondas", ronda.id, "validaciones", validacionDoc.id)
                );
            }

            await deleteDoc(doc(db, "rondas", ronda.id));

            rondas = rondas.filter(function(r) {
                return r.id !== ronda.id;
            });

            actualizarResumenRondas();

            const textoBusqueda = buscador.value.trim().toLowerCase();
            if (textoBusqueda) {
                filtrarRondas();
            } else {
                const totalPaginasNuevo = Math.max(
                    1,
                    Math.ceil(rondas.length / RONDAS_POR_PAGINA)
                );
                if (paginaRondas > totalPaginasNuevo) paginaRondas = totalPaginasNuevo;
                mostrarRondas(rondas);
            }
        } catch (e) {
            console.error("Error eliminando ronda:", e);
            alert("No se pudo eliminar la ronda: " + e.message);
            boton.disabled = false;
            boton.textContent = "🗑️ ELIMINAR";
        }
    });

    return boton;
}



// =====================================================
// FILTROS DE RONDAS
// FECHA · AGENTE · TURNO · TIPO DE RONDA
// =====================================================

let filtrosRondasInstalados = false;

function normalizarTextoFiltro(valor) {
    return String(valor || "").trim();
}

function fechaISODeRonda(ronda) {
    const valores = [
        ronda.horaInicioLocal,
        ronda.fechaInicio,
        ronda.fecha
    ];

    for (const valor of valores) {
        if (typeof valor !== "string") continue;

        let m = valor.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;

        m = valor.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    }

    const ts = ronda.inicioTimestamp || ronda.timestamp;
    if (ts && typeof ts.toDate === "function") {
        const d = ts.toDate();
        const y = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const dia = String(d.getDate()).padStart(2, "0");
        return `${y}-${mes}-${dia}`;
    }

    return "";
}

function instalarFiltrosRondas() {
    if (filtrosRondasInstalados || !listaRondas) return;

    const caja = document.createElement("div");
    caja.id = "filtrosRondas";
    caja.className = "filtros-rondas";

    caja.innerHTML = `
        <div class="filtro-ronda">
            <label for="filtroFechaRonda">📅 Fecha</label>
            <input type="date" id="filtroFechaRonda">
        </div>

        <div class="filtro-ronda">
            <label for="filtroAgenteRonda">👤 Agente</label>
            <select id="filtroAgenteRonda">
                <option value="">Todos los agentes</option>
            </select>
        </div>

        <div class="filtro-ronda">
            <label for="filtroTurnoRonda">🕐 Turno</label>
            <select id="filtroTurnoRonda">
                <option value="">Todos los turnos</option>
                <option value="DIA">Día</option>
                <option value="NOCHE">Noche</option>
            </select>
        </div>

        <div class="filtro-ronda">
            <label for="filtroTipoRonda">🛡️ Tipo de ronda</label>
            <select id="filtroTipoRonda">
                <option value="">Todas</option>
                <option value="INTERNA">INTERNA</option>
                <option value="EXTERNA">EXTERNA</option>
            </select>
        </div>

        <div class="filtro-ronda">
            <label for="filtroEstadoRonda">📋 Estado</label>
            <select id="filtroEstadoRonda">
                <option value="">Todos los estados</option>
                <option value="EN_CURSO">EN CURSO</option>
                <option value="COMPLETADA">COMPLETADA</option>
                <option value="INCOMPLETA">INCOMPLETA</option>
            </select>
        </div>

        <button type="button"
                id="btnLimpiarFiltrosRondas"
                class="btn-limpiar-filtros">
            ✖ LIMPIAR FILTROS
        </button>
    `;

    listaRondas.parentNode.insertBefore(caja, listaRondas);

    ["filtroFechaRonda", "filtroAgenteRonda", "filtroTurnoRonda", "filtroTipoRonda", "filtroEstadoRonda"]
        .forEach(function(id) {
            document.getElementById(id).addEventListener("change", function() {
                paginaRondas = 1;
                aplicarFiltrosRondas();
            });
        });

    document.getElementById("btnLimpiarFiltrosRondas")
        .addEventListener("click", function() {
            document.getElementById("filtroFechaRonda").value = "";
            document.getElementById("filtroAgenteRonda").value = "";
            document.getElementById("filtroTurnoRonda").value = "";
            document.getElementById("filtroTipoRonda").value = "";
            document.getElementById("filtroEstadoRonda").value = "";
            if (buscador) buscador.value = "";
            paginaRondas = 1;
            aplicarFiltrosRondas();
        });

    filtrosRondasInstalados = true;
    actualizarOpcionesFiltrosRondas();
}

function actualizarOpcionesFiltrosRondas() {
    if (!filtrosRondasInstalados) return;

    const selectAgente = document.getElementById("filtroAgenteRonda");
    const agenteActual = selectAgente.value;

    const agentesUnicos = [...new Set(
        rondas.map(r => normalizarTextoFiltro(r.agenteNombre)).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "es"));

    selectAgente.innerHTML =
        '<option value="">Todos los agentes</option>' +
        agentesUnicos.map(v => `<option value="${escapeHtmlFiltro(v)}">${escapeHtmlFiltro(v)}</option>`).join("");

    if (agentesUnicos.includes(agenteActual)) selectAgente.value = agenteActual;
}

function escapeHtmlFiltro(valor) {
    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function aplicarFiltrosRondas() {
    if (!filtrosRondasInstalados) {
        mostrarRondas(rondas);
        return;
    }

    const fecha = document.getElementById("filtroFechaRonda").value;
    const agente = document.getElementById("filtroAgenteRonda").value;
    const turno = document.getElementById("filtroTurnoRonda").value;
    const tipo = document.getElementById("filtroTipoRonda").value;
    const estado = document.getElementById("filtroEstadoRonda").value;

    const texto = buscador ? buscador.value.trim().toLowerCase() : "";

    const filtradas = rondas.filter(function(ronda) {
        if (fecha && fechaISODeRonda(ronda) !== fecha) return false;

        if (agente && normalizarTextoFiltro(ronda.agenteNombre) !== agente) {
            return false;
        }

        if (turno) {
            const turnoRonda = normalizarTextoFiltro(
                ronda.agenteTurno || ronda.turno
            ).toUpperCase()
             .normalize("NFD")
             .replace(/[\u0300-\u036f]/g, "");

            if (turnoRonda !== turno) return false;
        }

        if (tipo && normalizarTextoFiltro(ronda.tipoRonda).toUpperCase() !== tipo) {
            return false;
        }

        if (estado &&
            normalizarTextoFiltro(ronda.estado).toUpperCase() !== estado) {
            return false;
        }

        if (texto) {
            const contenido = [
                ronda.agenteNombre,
                ronda.agenteCargo,
                ronda.agenteTurno,
                ronda.turno,
                ronda.tipoRonda,
                ronda.estado,
                ronda.fecha,
                ronda.horaInicioLocal,
                ronda.inicioQrCodigo
            ].join(" ").toLowerCase();

            if (!contenido.includes(texto)) return false;
        }

        return true;
    });

    mostrarRondas(filtradas);
}


// =====================================================
// BUSCAR RONDAS
// =====================================================

function filtrarRondas() {
    paginaRondas = 1;
    aplicarFiltrosRondas();
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

function limpiarFormularioQR() {
    puntoEditandoId = null;
    qrCodigo.value = "";
    qrCodigo.disabled = false;
    qrNombre.value = "";
    qrTipoRonda.value = "";
    qrFuncion.value = "";
    qrOrden.value = "";
    btnGenerarQR.textContent = "💾 GUARDAR PUNTO Y GENERAR QR";
    if (btnCancelarEdicionQR) btnCancelarEdicionQR.style.display = "none";
    if (tituloFormularioQR) tituloFormularioQR.textContent = "📱 Crear punto y código QR";
}

function editarPuntoQR(punto) {
    if (rolActual !== "ADMIN") return;
    puntoEditandoId = punto.id;
    qrCodigo.value = punto.codigo || punto.id;
    qrCodigo.disabled = true; // El código físico del QR nunca cambia.
    qrNombre.value = punto.nombre || "";
    qrTipoRonda.value = punto.tipoRonda || "";
    qrFuncion.value = punto.funcionQR || "";
    qrOrden.value = punto.orden ?? "";
    if (tituloFormularioQR) tituloFormularioQR.textContent = "✏️ Editar punto QR";
    btnGenerarQR.textContent = "💾 GUARDAR CAMBIOS";
    if (btnCancelarEdicionQR) btnCancelarEdicionQR.style.display = "block";
    ocultarMensaje(qrError);
    mostrarMensaje(qrError, "ℹ️ El código " + (punto.codigo || punto.id) + " está bloqueado para que el QR físico siga funcionando.", true);
    document.querySelector(".qr-panel")?.scrollIntoView({behavior:"smooth", block:"start"});
}

if (btnCancelarEdicionQR) {
    btnCancelarEdicionQR.addEventListener("click", function() {
        limpiarFormularioQR();
        ocultarMensaje(qrError);
    });
}

async function guardarPuntoYGenerarQR() {
    ocultarMensaje(qrError);

    const codigo = qrCodigo.value.trim().toUpperCase();
    const nombre = qrNombre.value.trim();
    const tipoRonda = qrTipoRonda.value;
    const funcionQR = qrFuncion.value;
    const orden = Number(qrOrden.value);

    if (!codigo || !/^P\d+$/.test(codigo)) {
        mostrarMensaje(qrError, "El código debe tener formato P01, P02, P03...");
        qrCodigo.focus(); return;
    }
    if (!nombre) { mostrarMensaje(qrError, "Ingresa el nombre del punto."); qrNombre.focus(); return; }
    if (!tipoRonda) { mostrarMensaje(qrError, "Selecciona Ronda Externa o Ronda Interna."); qrTipoRonda.focus(); return; }
    if (!funcionQR) { mostrarMensaje(qrError, "Selecciona la función del QR: INICIO, PUNTO o FINAL."); qrFuncion.focus(); return; }
    if (!Number.isInteger(orden) || orden < 1) { mostrarMensaje(qrError, "Ingresa un número de orden válido desde 1."); qrOrden.focus(); return; }

    btnGenerarQR.disabled = true;
    btnGenerarQR.textContent = "COMPROBANDO CONFIGURACIÓN...";

    try {
        const referencia = doc(db, "puntos", codigo);
        const existente = await getDoc(referencia);

        if (!puntoEditandoId && existente.exists()) {
            qrResultado.style.display = "none";
            mostrarMensaje(qrError, `❌ El código ${codigo} ya existe. Usa otro código.`);
            return;
        }
        if (puntoEditandoId && codigo !== puntoEditandoId) {
            mostrarMensaje(qrError, "❌ El código del QR no puede modificarse.");
            return;
        }

        const resultadoPuntos = await getDocs(collection(db, "puntos"));
        let ordenRepetido = false, inicioRepetido = false, finalRepetido = false;
        resultadoPuntos.forEach((documento) => {
            if (documento.id === puntoEditandoId) return; // excluir el propio punto al editar
            const q = documento.data();
            if (q.tipoRonda === tipoRonda && Number(q.orden) === orden) ordenRepetido = true;
            if (q.tipoRonda === tipoRonda && q.funcionQR === "INICIO" && funcionQR === "INICIO") inicioRepetido = true;
            if (q.tipoRonda === tipoRonda && q.funcionQR === "FINAL" && funcionQR === "FINAL") finalRepetido = true;
        });

        if (ordenRepetido) { mostrarMensaje(qrError, `❌ El orden ${orden} ya está usado en la Ronda ${tipoRonda}.`); return; }
        if (inicioRepetido) { mostrarMensaje(qrError, `❌ La Ronda ${tipoRonda} ya tiene un QR de INICIO.`); return; }
        if (finalRepetido) { mostrarMensaje(qrError, `❌ La Ronda ${tipoRonda} ya tiene un QR FINAL.`); return; }

        if (puntoEditandoId) {
            btnGenerarQR.textContent = "GUARDANDO CAMBIOS...";
            await updateDoc(referencia, {
                codigo, nombre, tipoRonda, funcionQR, orden,
                actualizadoEn: serverTimestamp()
            });
            crearQRVisual(codigo, nombre);
            const guardado = codigo;
            limpiarFormularioQR();
            mostrarMensaje(qrError, `✅ ${guardado} actualizado. El QR físico anterior sigue siendo válido.`, true);
        } else {
            btnGenerarQR.textContent = "GUARDANDO PUNTO...";
            await setDoc(referencia, { codigo, nombre, tipoRonda, funcionQR, orden, activo: true, creadoEn: serverTimestamp() });
            crearQRVisual(codigo, nombre);
            mostrarMensaje(qrError, `✅ ${codigo} creado como ${funcionQR} de Ronda ${tipoRonda}, orden ${orden}.`, true);
            limpiarFormularioQR();
        }
        await cargarPuntos();
    } catch (e) {
        console.error("Error guardando punto:", e);
        mostrarMensaje(qrError, "No se pudo guardar el punto: " + e.message);
    } finally {
        btnGenerarQR.disabled = false;
        btnGenerarQR.textContent = puntoEditandoId ? "💾 GUARDAR CAMBIOS" : "💾 GUARDAR PUNTO Y GENERAR QR";
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

async function descargarQR() {

    const canvasFinal = canvasQRConMargen();

    if (!canvasFinal) {
        mostrarMensaje(qrError, "Primero crea o selecciona un QR.");
        return;
    }

    const nombreArchivo = "QR_" + codigoQRActual + ".png";

    const blob = await new Promise((resolve) => {
        canvasFinal.toBlob(resolve, "image/png");
    });

    if (!blob) {
        mostrarMensaje(qrError, "No se pudo preparar la imagen del QR.");
        return;
    }

    const archivo = new File([blob], nombreArchivo, { type: "image/png" });
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // En iPhone/iPad intentamos primero la hoja de compartir del sistema.
    // En Android también funciona en navegadores compatibles.
    try {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [archivo] })) {
            await navigator.share({
                files: [archivo],
                title: "QR " + codigoQRActual,
                text: nombreQRActual || ("QR " + codigoQRActual)
            });
            mostrarMensaje(qrError, "✅ QR preparado para guardar o compartir.", true);
            return;
        }
    } catch (e) {
        if (e && e.name === "AbortError") return;
        console.warn("No se pudo usar compartir archivos:", e);
    }

    const url = URL.createObjectURL(blob);

    // iOS no siempre respeta el atributo download. Abrimos la imagen para
    // que se pueda mantener pulsada y elegir Guardar en Fotos.
    if (esIOS) {
        const nueva = window.open(url, "_blank");
        if (!nueva) {
            location.href = url;
        }
        mostrarMensaje(
            qrError,
            "📱 En iPhone: mantén pulsada la imagen del QR y elige Guardar en Fotos.",
            true
        );
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
    }

    // Android / escritorio: descarga directa.
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    mostrarMensaje(qrError, "✅ QR guardado/descargado.", true);
}

btnDescargarQR.addEventListener("click", descargarQR);


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


            superior.appendChild(info);

            const acciones = document.createElement("div");
            acciones.style.display = "flex";
            acciones.style.gap = "8px";
            acciones.style.flexWrap = "wrap";
            acciones.appendChild(boton);

            if (rolActual === "ADMIN") {
                const btnEditar = document.createElement("button");
                btnEditar.className = "btn-actualizar";
                btnEditar.type = "button";
                btnEditar.textContent = "✏️ Editar";
                btnEditar.addEventListener("click", function() {
                    editarPuntoQR(punto);
                });
                acciones.appendChild(btnEditar);
            }

            superior.appendChild(acciones);

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

cargarPuntos()
    .then(function () {
        return cargarRondas();
    })
    .catch(function () {
        return cargarRondas();
    });

cargarAgentes();

// Segunda barrera visual: bloquea acciones de edición en modo CLIENTE.
document.addEventListener("click", function(e) {
    if (rolActual !== "CLIENTE") return;
    const el=e.target.closest("button,a");
    if(!el) return;

    // Las notificaciones son una función permitida también para CLIENTE.
    // No bloquear el botón de registro/actualización del dispositivo push.
    if (el.id === "btnPush" || el.closest("#panelPush")) return;

    const t=(el.textContent||"").toUpperCase();
    const id=(el.id||"").toLowerCase();
    if (
        t.includes("GUARDAR") || t.includes("CREAR") || t.includes("EDITAR") ||
        t.includes("ACTIVAR") || t.includes("DESACTIVAR") || t.includes("ELIMINAR") ||
        id.includes("guardar") || id.includes("crear") || id.includes("editar")
    ) {
        e.preventDefault();
        e.stopImmediatePropagation();
    }
}, true);


/* ===== NOTIFICACIONES EN TIEMPO REAL ===== */
let unsubscribeNotificaciones=null, notificacionesRondas=[];
const STORAGE_LEIDAS="rondas_notificaciones_leidas_v1";
function idsLeidos(){try{return new Set(JSON.parse(localStorage.getItem(STORAGE_LEIDAS)||"[]"))}catch(e){return new Set()}}
function guardarLeidos(s){localStorage.setItem(STORAGE_LEIDAS,JSON.stringify(Array.from(s).slice(-500)))}
function timestampMs(valor, respaldo){
    if(valor && typeof valor.toMillis==="function") return valor.toMillis();
    const n = respaldo ? Date.parse(respaldo) : 0;
    return Number.isFinite(n) ? n : 0;
}

function crearNotifs(d){
    const r=d.data()||{};
    const agente=r.agenteNombre||r.nombreAgente||r.agente||"Agente";
    const ronda=r.tipoRonda||"RONDA";
    const detalle=`${ronda} · ${agente}`;
    const eventos=[];

    // El inicio siempre se conserva como una notificación independiente.
    eventos.push({
        id:d.id+":INICIO",
        titulo:"🟢 Ronda iniciada",
        detalle,
        ms:timestampMs(r.inicioTimestamp||r.timestamp, r.horaInicioLocal)
    });

    // Si después se completa, se agrega otra notificación.
    if(r.estado==="COMPLETADA"){
        eventos.push({
            id:d.id+":FINAL",
            titulo:"✅ Ronda finalizada",
            detalle,
            ms:timestampMs(r.finTimestamp, r.horaFinLocal)
        });
    }

    // Si después se cancela, se agrega otra notificación.
    if(r.estado==="INCOMPLETA"){
        eventos.push({
            id:d.id+":INCOMPLETA",
            titulo:"🔴 Ronda incompleta",
            detalle: r.motivoCancelacion
                ? `${detalle} · Motivo: ${r.motivoCancelacion}`
                : detalle,
            ms:timestampMs(r.cancelacionTimestamp, r.horaCancelacionLocal)
        });
    }

    return eventos;
}
function renderNotifs(){const l=document.getElementById("listaNotificaciones"),c=document.getElementById("contadorNotificaciones");if(!l||!c)return;const le=idsLeidos(),n=notificacionesRondas.filter(x=>!le.has(x.id)).length;c.textContent=n>99?"99+":String(n);c.hidden=n===0;l.innerHTML="";if(!notificacionesRondas.length){l.innerHTML='<div class="notificacion-vacia">No hay notificaciones.</div>';return}notificacionesRondas.forEach(x=>{const e=document.createElement("div");e.className="notificacion-item"+(le.has(x.id)?"":" no-leida");e.innerHTML=`<div class="notificacion-titulo">${x.titulo}</div><div class="notificacion-detalle">${x.detalle}</div><div class="notificacion-hora">${x.ms?new Date(x.ms).toLocaleString("es-PE"):""}</div>`;e.onclick=()=>{const s=idsLeidos();s.add(x.id);guardarLeidos(s);renderNotifs()};l.appendChild(e)})}
function iniciarNotificacionesRondas(){if(unsubscribeNotificaciones)unsubscribeNotificaciones();unsubscribeNotificaciones=onSnapshot(collection(db,"rondas"),s=>{notificacionesRondas=s.docs.flatMap(crearNotifs).sort((a,b)=>b.ms-a.ms).slice(0,50);renderNotifs()},e=>console.error("Notificaciones:",e))}
document.addEventListener("DOMContentLoaded",()=>{const b=document.getElementById("btnNotificaciones"),p=document.getElementById("panelNotificaciones"),m=document.getElementById("btnMarcarLeidas");if(b&&p)b.onclick=e=>{e.stopPropagation();p.hidden=!p.hidden};document.addEventListener("click",e=>{if(p&&!p.hidden&&!p.contains(e.target)&&e.target!==b)p.hidden=true});if(m)m.onclick=()=>{const s=idsLeidos();notificacionesRondas.forEach(x=>s.add(x.id));guardarLeidos(s);renderNotifs()}}); 
onAuthStateChanged(auth,u=>{if(u)iniciarNotificacionesRondas();else if(unsubscribeNotificaciones){unsubscribeNotificaciones();unsubscribeNotificaciones=null}});
