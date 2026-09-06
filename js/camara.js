import { db } from "./firebase.js";
import {
  doc,collection,addDoc,updateDoc,serverTimestamp,increment
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const $=id=>document.getElementById(id);
const informacion=$("informacion"),gps=$("gps"),seccionFoto=$("seccionFoto"),fotoInput=$("foto");
const vistaPrevia=$("vistaPrevia"),canvas=$("canvas"),estado=$("estado"),btnRegistrar=$("btnRegistrar");
const btnCompartir=$("btnCompartir"),btnSiguiente=$("btnSiguiente"),error=$("error");
let datosRonda=null,ubicacionActual=null,direccionActual="Ubicación no disponible",imagenFinal=null,registrado=false,gpsWatchId=null,fechaFoto=null;

function mostrarError(t){error.textContent=t;error.classList.remove("d-none");}
function activa(){try{return JSON.parse(sessionStorage.getItem("rondaActiva")||"null");}catch(e){return null;}}
function guardarActiva(r){sessionStorage.setItem("rondaActiva",JSON.stringify(r));}

function cargarDatos(){
  try{datosRonda=JSON.parse(sessionStorage.getItem("rondaActual")||"null");}catch(e){}
  if(!datosRonda?.agente||!datosRonda?.punto||!datosRonda?.rondaId){mostrarError("No se encontró información de la ronda activa.");return false;}
  informacion.innerHTML=`<strong>🧭 Ronda:</strong> ${datosRonda.tipoRonda}<br>
  <strong>👮 Nombre:</strong> ${datosRonda.agente.nombre}<br>
  <strong>🦺 Cargo:</strong> ${datosRonda.agente.cargo}<br>
  <strong>🕐 Turno:</strong> ${datosRonda.agente.turno}<br>
  <strong>📍 Punto:</strong> ${datosRonda.punto.nombre}<br>
  <strong>🔲 Código:</strong> ${datosRonda.punto.codigo}<br>
  <strong>🔢 Orden:</strong> ${datosRonda.punto.orden}<br>
  <strong>📱 QR:</strong> Validado`;
  return true;
}

function iniciarGPS(){
  seccionFoto.classList.remove("d-none");
  if(!navigator.geolocation){gps.innerHTML="⚠️ Ubicación no disponible. Puedes tomar la fotografía.";return;}
  gps.className="alert alert-info";gps.innerHTML="📍 <strong>UBICACIÓN ACTIVADA</strong><br>🔄 Obteniendo ubicación actual...";
  gpsWatchId=navigator.geolocation.watchPosition(p=>{
    ubicacionActual={latitud:p.coords.latitude,longitud:p.coords.longitude};
    gps.className="alert alert-success";gps.innerHTML="📍 <strong>UBICACIÓN LISTA</strong><br>📸 Ya puedes tomar la fotografía.";
  },()=>{gps.className="alert alert-warning";gps.innerHTML="⚠️ No se pudo obtener la ubicación. Puedes tomar la fotografía.";},
  {enableHighAccuracy:true,maximumAge:0,timeout:10000});
}

async function obtenerDireccion(lat,lon){
  try{
    const u="https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=es&lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lon);
    const r=await fetch(u);if(!r.ok)throw new Error();
    const d=await r.json(),a=d.address||{};
    const partes=[];
    const calle=a.road||a.pedestrian||a.residential||a.footway||a.path||"";
    const numero=a.house_number||"",zona=a.neighbourhood||a.suburb||a.quarter||a.city_district||a.district||"";
    const ciudad=a.city||a.town||a.village||a.municipality||"",region=a.state||a.region||"",pais=a.country||"";
    if(calle)partes.push(calle+(numero?" "+numero:""));
    for(const x of [zona,ciudad,region,pais])if(x&&!partes.includes(x))partes.push(x);
    return partes.length?partes.join(", "):(d.display_name||"Dirección no encontrada");
  }catch(e){return "Dirección no disponible";}
}

fotoInput.addEventListener("change",async e=>{
  const archivo=e.target.files[0];if(!archivo)return;
  fechaFoto=new Date();estado.className="alert alert-info mt-3";estado.textContent="📍 Preparando evidencia...";
  direccionActual=ubicacionActual?await obtenerDireccion(ubicacionActual.latitud,ubicacionActual.longitud):"Ubicación GPS no disponible";
  const reader=new FileReader();
  reader.onload=ev=>{const img=new Image();img.onload=()=>generarImagen(img);img.src=ev.target.result;};
  reader.readAsDataURL(archivo);
});

function lineas(ctx,texto,x,y,max,alto){
  const palabras=String(texto).split(" ");let linea="",py=y;
  for(let i=0;i<palabras.length;i++){const p=linea+palabras[i]+" ";if(ctx.measureText(p).width>max&&i>0){ctx.fillText(linea.trim(),x,py);linea=palabras[i]+" ";py+=alto;}else linea=p;}
  ctx.fillText(linea.trim(),x,py);return py;
}

function generarImagen(img){
  const max=1200;let w=img.width,h=img.height;if(w>max){const p=max/w;w=max;h*=p;}
  const info=540;canvas.width=w;canvas.height=h+info;const ctx=canvas.getContext("2d");
  ctx.drawImage(img,0,0,w,h);ctx.fillStyle="#111827";ctx.fillRect(0,h,w,info);ctx.fillStyle="#fff";
  ctx.font="bold 30px Arial";ctx.fillText("🛡️ RONDA DE SEGURIDAD",30,h+45);
  ctx.font="22px Arial";
  const fecha=fechaFoto.toLocaleDateString("es-PE"),hora=fechaFoto.toLocaleTimeString("es-PE");
  ctx.fillText(`🧭 Ronda ${datosRonda.tipoRonda}`,30,h+90);
  ctx.fillText(`👮 ${datosRonda.agente.nombre}`,30,h+130);
  ctx.fillText(`🦺 ${datosRonda.agente.cargo}`,30,h+170);
  ctx.fillText(`🕐 ${datosRonda.agente.turno}`,30,h+210);
  ctx.fillText(`📍 ${datosRonda.punto.nombre} (${datosRonda.punto.codigo})`,30,h+250);
  ctx.fillText(`🔢 Orden: ${datosRonda.punto.orden}`,30,h+290);
  ctx.fillText(`📅 Fecha: ${fecha}`,30,h+330);ctx.fillText(`🕐 Hora: ${hora}`,30,h+370);
  lineas(ctx,`📌 ${direccionActual}`,30,h+415,w-60,30);
  canvas.toBlob(blob=>{imagenFinal=blob;vistaPrevia.classList.remove("d-none");estado.className="alert alert-success mt-3";estado.innerHTML=`✅ <strong>Fotografía preparada</strong><br><br>🧭 Ronda ${datosRonda.tipoRonda}<br>📍 ${datosRonda.punto.nombre}<br>📅 ${fecha}<br>🕐 ${hora}<br>📌 ${direccionActual}`;},"image/jpeg",.88);
}

btnRegistrar.addEventListener("click",registrar);
async function registrar(){
  if(!imagenFinal){mostrarError("Primero debes tomar la fotografía.");return;}
  btnRegistrar.disabled=true;btnRegistrar.textContent="REGISTRANDO...";
  try{
    const f=fechaFoto||new Date(),r=activa();
    if(!r||r.rondaId!==datosRonda.rondaId)throw new Error("La ronda activa no coincide.");
    await addDoc(collection(db,"rondas",datosRonda.rondaId,"validaciones"),{
      puntoId:datosRonda.punto.id,puntoCodigo:datosRonda.punto.codigo,puntoNombre:datosRonda.punto.nombre,
      tipoRonda:datosRonda.tipoRonda,funcionQR:datosRonda.punto.funcionQR,orden:Number(datosRonda.punto.orden),
      fecha:f.toLocaleDateString("es-PE"),hora:f.toLocaleTimeString("es-PE"),direccion:direccionActual,
      latitud:ubicacionActual?ubicacionActual.latitud:null,longitud:ubicacionActual?ubicacionActual.longitud:null,
      qrValidado:true,metodoValidacion:"QR_FISICO",timestamp:serverTimestamp()
    });
    const esFinal=datosRonda.punto.funcionQR==="FINAL";
    const cambios={ultimoOrden:Number(datosRonda.punto.orden),ultimoPuntoCodigo:datosRonda.punto.codigo,totalValidados:increment(1)};
    if(esFinal){
      const inicio=new Date(r.inicio),fin=new Date();
      cambios.estado="COMPLETADA";cambios.finTimestamp=serverTimestamp();cambios.horaFinLocal=fin.toISOString();
      cambios.duracionSegundos=Math.max(0,Math.round((fin-inicio)/1000));
    }
    await updateDoc(doc(db,"rondas",datosRonda.rondaId),cambios);
    r.ultimoOrden=Number(datosRonda.punto.orden);r.ultimoPuntoCodigo=datosRonda.punto.codigo;r.totalValidados=Number(r.totalValidados||0)+1;
    if(esFinal)r.finalizada=true;
    guardarActiva(r);registrado=true;
    if(gpsWatchId!==null){navigator.geolocation.clearWatch(gpsWatchId);gpsWatchId=null;}
    estado.className="alert alert-success mt-3";
    estado.innerHTML=`✅ <strong>${esFinal?"ÚLTIMO PUNTO REGISTRADO":"PUNTO REGISTRADO"}</strong><br><br>🧭 Ronda ${datosRonda.tipoRonda}<br>📍 ${datosRonda.punto.nombre}<br>📱 QR físico: VALIDADO<br>📸 Evidencia registrada`;
    btnRegistrar.classList.add("d-none");btnCompartir.classList.remove("d-none");
  }catch(e){mostrarError("No se pudo registrar el punto: "+e.message);btnRegistrar.disabled=false;btnRegistrar.textContent="✅ REGISTRAR PUNTO";}
}

btnCompartir.addEventListener("click",compartir);
async function compartir(){
  if(!registrado){mostrarError("Primero debes registrar el punto.");return;}
  const fecha=fechaFoto.toLocaleDateString("es-PE"),hora=fechaFoto.toLocaleTimeString("es-PE");
  const texto=`🛡️ RONDA DE SEGURIDAD

🧭 Ronda: ${datosRonda.tipoRonda}
👮 ${datosRonda.agente.nombre}
🦺 ${datosRonda.agente.cargo}
🕐 ${datosRonda.agente.turno}
📍 ${datosRonda.punto.nombre}
🔲 ${datosRonda.punto.codigo}
📅 Fecha: ${fecha}
🕐 Hora: ${hora}
📌 ${direccionActual}

📱 QR físico: VALIDADO
📸 Evidencia registrada`;
  const archivo=new File([imagenFinal],`ronda-${datosRonda.punto.codigo}-${Date.now()}.jpg`,{type:"image/jpeg"});
  try{
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[archivo]})){
      await navigator.share({text:texto,files:[archivo]});
    }else{
      const u=URL.createObjectURL(imagenFinal),a=document.createElement("a");a.href=u;a.download="evidencia-ronda.jpg";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
      alert("Este navegador no permite compartir directamente. La fotografía fue descargada.");
    }
    mostrarBotonSiguiente();
  }catch(e){
    if(e?.name!=="AbortError")mostrarError("No se pudo compartir: "+(e.message||"Error"));
    // Si el usuario cancela, no asumimos que compartió.
  }
}

function mostrarBotonSiguiente(){
  btnSiguiente.classList.remove("d-none");
  const esFinal=datosRonda.punto.funcionQR==="FINAL";
  btnSiguiente.textContent=esFinal?"✅ FINALIZAR RONDA":"🔄 CONTINUAR RONDA";
  btnSiguiente.className=esFinal?"btn btn-danger btn-lg w-100 mt-2":"btn btn-dark btn-lg w-100 mt-2";
}
btnSiguiente.addEventListener("click",()=>{
  const esFinal=datosRonda.punto.funcionQR==="FINAL";
  sessionStorage.removeItem("rondaActual");
  if(esFinal){
    sessionStorage.removeItem("rondaActiva");
    document.body.innerHTML=`<div class="container py-5"><div class="card shadow-sm mx-auto" style="max-width:600px"><div class="card-body text-center p-5"><div class="fs-1">✅</div><h2>Ronda completada</h2><p class="lead">La Ronda ${datosRonda.tipoRonda} finalizó correctamente.</p><a href="index.html" class="btn btn-primary btn-lg w-100">VOLVER AL INICIO</a></div></div></div>`;
  }else location.href="index.html";
});
window.addEventListener("pagehide",()=>{if(gpsWatchId!==null)navigator.geolocation.clearWatch(gpsWatchId);});
if(cargarDatos())iniciarGPS();
