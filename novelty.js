import {$,call,el,button,fecha} from './common.js';
const upper=value=>String(value).toLocaleUpperCase('es-PE');
// Independent of round mutations and its evidence/draft store.
export function mountNovelty(auth,{beforeOpen=async()=>{}}={}){
 let dialog,profile,source=null,capturedAt=null,report=null,previewURL=null,working=false;
 let photo,text,preview,status,prepare,share,fallback;
 const message=value=>{status.textContent=value;};
 function invalidate(){report=null;share.disabled=true;fallback.hidden=true;preview.hidden=true;if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}}
 function create(){
  dialog=el('dialog');dialog.id='noveltyDialog';dialog.setAttribute('aria-labelledby','noveltyTitle');
  const title=el('h2','Notificar novedades');title.id='noveltyTitle';
  const help=el('p','OPCIONAL. TU RONDA SIGUE EN CURSO. ESTE REPORTE NO REGISTRA NI REEMPLAZA NINGÚN PUNTO.','muted');
  const photoLabel=el('label','TOMAR FOTO DE LA NOVEDAD');photoLabel.htmlFor='noveltyPhoto';
  photo=el('input');photo.id='noveltyPhoto';photo.type='file';photo.accept='image/jpeg,image/png,image/webp';photo.setAttribute('capture','environment');
  const textLabel=el('label','ESCRIBE LA NOVEDAD');textLabel.htmlFor='noveltyText';
  text=el('textarea');text.id='noveltyText';text.rows=5;text.maxLength=1000;text.placeholder='DESCRIBE LO OCURRIDO…';
  status=el('p');status.id='noveltyStatus';status.setAttribute('role','status');
  preview=el('img');preview.id='noveltyPreview';preview.alt='FOTO DE LA NOVEDAD CON MARCA DE AGUA';preview.className='evidence';preview.hidden=true;
  prepare=button('Preparar foto con marca de agua',async()=>{
   if(working)return;working=true;prepare.disabled=true;photo.disabled=true;text.disabled=true;invalidate();
   try{
    const description=upper(text.value.trim());text.value=description;
    if(!source)throw Error('TOMA UNA FOTO DE LA NOVEDAD.');
    if(!description)throw Error('ESCRIBE LA NOVEDAD ANTES DE PREPARARLA.');
    const lines=['NOVEDAD DE SEGURIDAD',`AGENTE: ${profile.codigo} · ${profile.nombre}`,`CARGO: ${profile.cargo}`,`TURNO: ${profile.turno}`,`CAPTURA EN EL DISPOSITIVO (LIMA): ${fecha(capturedAt)}`,`NOVEDAD: ${description}`].map(upper);
    const blob=await watermark(source,lines);
    const file=new File([blob],`novedad-${profile.codigo}-${capturedAt}.jpg`,{type:'image/jpeg'});
    report={file,text:lines.join('\n')};previewURL=URL.createObjectURL(blob);preview.src=previewURL;preview.hidden=false;share.disabled=false;
    message('FOTO LISTA. REVÍSALA Y PULSA ENVIAR POR WHATSAPP.');
   }catch(e){message(upper(e.message));}finally{working=false;prepare.disabled=false;photo.disabled=false;text.disabled=false;}
  });prepare.id='noveltyPrepare';
  share=button('Enviar por WhatsApp',async()=>{
   if(!report||working)return;working=true;share.disabled=true;
   try{
    if(navigator.canShare?.({files:[report.file]})){
     message('ELIGE WHATSAPP Y EL DESTINATARIO EN EL MENÚ DE COMPARTIR.');
     await navigator.share({files:[report.file],text:report.text});
     message('SE ABRIÓ EL MENÚ PARA COMPARTIR. COMPRUEBA EL ENVÍO EN WHATSAPP; TU RONDA NO HA CAMBIADO.');
    }else showFallback();
   }catch(e){if(e.name==='AbortError')message('ENVÍO CANCELADO. PUEDES REINTENTAR O VOLVER A TU RONDA.');else{showFallback();message('NO SE PUDO COMPARTIR DIRECTAMENTE. DESCARGA LA FOTO Y ADJÚNTALA EN WHATSAPP.');}}
   finally{working=false;share.disabled=!report;}
  });share.id='noveltyShare';share.disabled=true;
  fallback=el('div');fallback.id='noveltyFallback';fallback.hidden=true;
  const download=button('1. Descargar foto',()=>{if(!report)return;const a=el('a');a.href=previewURL;a.download=report.file.name;a.click();});
  const whatsapp=el('a','2. Abrir WhatsApp con el texto','button secondary');whatsapp.id='noveltyWhatsApp';whatsapp.target='_blank';whatsapp.rel='noopener noreferrer';
  fallback.append(el('p','ADJUNTA LA FOTO DESCARGADA EN EL CHAT: EL ENLACE DE WHATSAPP SOLO INCLUYE EL TEXTO.'),download,whatsapp);
  function showFallback(){whatsapp.href='https://wa.me/?text='+encodeURIComponent(report.text);fallback.hidden=false;message('DESCARGA LA FOTO, ABRE WHATSAPP Y ADJÚNTALA AL MENSAJE.');}
  const close=button('Volver a mi ronda',()=>dialog.close());close.id='noveltyClose';
  const discard=button('Descartar novedad',()=>{if(working||!confirm('¿DESCARTAR SOLO ESTA NOVEDAD? TU RONDA NO CAMBIARÁ.'))return;invalidate();source=null;capturedAt=null;photo.value='';text.value='';message('NOVEDAD DESCARTADA.');});
  photo.onchange=()=>{invalidate();source=null;capturedAt=null;const f=photo.files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>20*1024*1024){photo.value='';message('USA UNA FOTO JPEG, PNG O WEBP DE HASTA 20 MB.');return;}source=f;capturedAt=Date.now();message('FOTO SELECCIONADA. ESCRIBE LA NOVEDAD Y PREPÁRALA.');};
  text.addEventListener('input',()=>{const a=text.selectionStart,b=text.selectionEnd,v=text.value;const start=upper(v.slice(0,a)).length,end=upper(v.slice(0,b)).length;text.value=upper(v);text.setSelectionRange(start,end);invalidate();message('PREPARA LA FOTO PARA INCLUIR EL TEXTO ACTUALIZADO.');});
  dialog.append(title,help,photoLabel,photo,textLabel,text,prepare,preview,status,share,fallback,close,discard,el('p','LA NOVEDAD SE CONSERVA AL CERRAR ESTA VENTANA, PERO SE PIERDE AL RECARGAR O SALIR DE ESTA PÁGINA. NO SE GUARDA EN EL HISTORIAL DE RONDAS.','muted'));
  document.body.append(dialog);
 }
 $('novelty').onclick=async()=>{
  if(!dialog)create();dialog.showModal();message('CARGANDO DATOS DEL AGENTE…');prepare.disabled=true;
  try{await beforeOpen();if(!profile){const data=await call(auth,'me');if(data.usuario.rol!=='AGENTE'||!data.agente)throw Error('INGRESA CON UNA CUENTA DE AGENTE.');profile=data.agente;}prepare.disabled=working;message(report?'FOTO LISTA PARA COMPARTIR.':'PUEDES REPORTAR UNA NOVEDAD O VOLVER A LA RONDA EN CUALQUIER MOMENTO.');}catch(e){message(upper(e.message));}
 };
}
async function watermark(file,texts){
 const url=URL.createObjectURL(file),image=new Image();
 try{
  image.src=url;await image.decode();
  const scale=Math.min(1,1200/image.width,1500/image.height),iw=Math.round(image.width*scale),h=Math.round(image.height*scale),w=Math.max(600,iw);
  const canvas=document.createElement('canvas');let ctx=canvas.getContext('2d');ctx.font='22px Arial';
  const lines=[];
  // Character wrapping also handles long words, pasted URLs, accents and line breaks.
  for(const text of texts)for(const paragraph of text.split('\n')){
   let line='';for(const word of paragraph.split(/\s+/)){
    if(line&&ctx.measureText(line+' '+word).width>w-40){lines.push(line);line='';}
    if(line)line+=' ';for(const c of word){if(ctx.measureText(line+c).width>w-40){lines.push(line);line='';}line+=c;}
   }lines.push(line);
  }
  canvas.width=w;canvas.height=h+48+lines.length*29;ctx=canvas.getContext('2d');ctx.fillStyle='#12243a';ctx.fillRect(0,0,w,canvas.height);ctx.drawImage(image,(w-iw)/2,0,iw,h);
  // Watermark is burned into the JPEG itself, including an overlay on the photo.
  ctx.fillStyle='rgba(18,36,58,.78)';ctx.fillRect(0,Math.max(0,h-46),w,46);ctx.fillStyle='#fff';ctx.font='bold 22px Arial';ctx.fillText('PREVENCIÓN · NOVEDAD',20,Math.max(25,h-15));
  ctx.font='22px Arial';lines.forEach((line,i)=>ctx.fillText(line,20,h+34+i*29));
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));if(!blob)throw Error('NO SE PUDO PREPARAR LA FOTO. INTÉNTALO DE NUEVO.');return blob;
 }finally{URL.revokeObjectURL(url);}
}
