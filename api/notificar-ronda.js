const admin = require("firebase-admin");

function iniciarFirebase() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables privadas de Firebase en Vercel.");
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

function duracion(seg) {
  const s = Math.max(0, Number(seg || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m} min${r ? ` ${r} s` : ""}` : `${r} s`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false });

  try {
    iniciarFirebase();
    const db = admin.firestore();
    const { tipoEvento, rondaId } = req.body || {};

    if (!["INICIO","COMPLETADA","INCOMPLETA"].includes(tipoEvento) || !rondaId) {
      return res.status(400).json({ ok:false, error:"Solicitud inválida" });
    }

    const rondaRef = db.collection("rondas").doc(String(rondaId));
    const snap = await rondaRef.get();
    if (!snap.exists) return res.status(404).json({ ok:false });

    const r = snap.data();

    // Nunca confiamos en el evento enviado por el navegador: verificamos
    // el estado real que ya está guardado en Firestore.
    if (tipoEvento === "INICIO" && r.estado !== "EN_CURSO") {
      return res.status(409).json({ ok:false, error:"Estado no coincide" });
    }
    if (tipoEvento === "COMPLETADA" && r.estado !== "COMPLETADA") {
      return res.status(409).json({ ok:false, error:"Estado no coincide" });
    }
    if (tipoEvento === "INCOMPLETA" && r.estado !== "INCOMPLETA") {
      return res.status(409).json({ ok:false, error:"Estado no coincide" });
    }

    // Dedupe: cada ronda/evento solo se envía una vez.
    const eventoRef = db.collection("eventosPush").doc(`${rondaId}_${tipoEvento}`);
    let debeEnviar = false;
    await db.runTransaction(async tx => {
      const ev = await tx.get(eventoRef);
      if (ev.exists) return;
      tx.create(eventoRef, {
        rondaId: String(rondaId),
        tipoEvento,
        creadoEn: admin.firestore.FieldValue.serverTimestamp()
      });
      debeEnviar = true;
    });

    if (!debeEnviar) return res.status(200).json({ ok:true, duplicado:true });

    const ds = await db.collection("dispositivosPush").where("activo","==",true).get();

    // Un mismo iPhone/Android puede haber iniciado sesión con ADMIN y luego
    // SUPERVISORA. Enviar una sola vez por token físico evita duplicados.
    const porToken = new Map();
    for (const d of ds.docs) {
      const token = d.data().token;
      if (typeof token === "string" && token) porToken.set(token, d);
    }
    const docs = [...porToken.values()];

    if (!docs.length) return res.status(200).json({ ok:true, enviados:0 });

    let title, body;
    const nombre = r.agenteNombre || "Agente";
    const tipo = r.tipoRonda || "Ronda";

    if (tipoEvento === "INICIO") {
      title = "🟢 Ronda iniciada";
      body = `${nombre} inició ronda ${tipo}.`;
    } else if (tipoEvento === "COMPLETADA") {
      title = "✅ Ronda finalizada";
      body = `${nombre} completó ronda ${tipo}. Duración: ${duracion(r.duracionSegundos)}.`;
    } else {
      title = "🔴 Ronda incompleta";
      body = `${nombre} · ${tipo}. ${r.motivoCancelacion || "Cancelada antes de finalizar."}`;
    }

    let enviados = 0;
    for (let i=0; i<docs.length; i+=500) {
      const lote = docs.slice(i,i+500);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: lote.map(d => d.data().token),
        notification: { title, body },
        webpush: {
          notification: {
            icon: "https://rondas-seguridad.vercel.app/icons/admin-192.png",
            badge: "https://rondas-seguridad.vercel.app/icons/admin-192.png"
          },
          fcmOptions: { link: "https://rondas-seguridad.vercel.app/admin.html" }
        }
      });
      enviados += response.successCount;

      const borrar=[];
      response.responses.forEach((x,j)=>{
        const code=x.error && x.error.code;
        if (!x.success && (code==="messaging/registration-token-not-registered" || code==="messaging/invalid-registration-token")) {
          borrar.push(lote[j].ref.delete());
        }
      });
      await Promise.allSettled(borrar);
    }

    return res.status(200).json({ ok:true, enviados });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:"Error enviando notificación" });
  }
};
