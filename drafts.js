const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('rondas-evidencia-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('pendientes',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('No se pudo abrir el almacenamiento de borradores.'));});
async function run(mode,fn){const db=await open();try{return await new Promise((resolve,reject)=>{const t=db.transaction('pendientes',mode),r=fn(t.objectStore('pendientes'));let value;r.onsuccess=()=>value=r.result;t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('No se pudo guardar el borrador.'));});}finally{db.close();}}
export const saveDraft=d=>run('readwrite',s=>s.put(d));
export const deleteDraft=key=>run('readwrite',s=>s.delete(key));
export const drafts=async uid=>(await run('readonly',s=>s.getAll())).filter(x=>x.uid===uid).sort((a,b)=>a.creado-b.creado);
