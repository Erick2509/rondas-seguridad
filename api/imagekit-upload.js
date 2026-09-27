const MAX_UPLOAD_BYTES = 260 * 1024;

function clean(value, fallback = "x") {
  const s = String(value || fallback).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return s.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || fallback;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) return res.status(503).json({ error: "ImageKit no está configurado" });

  try {
    const { imageBase64, rondaId, puntoCodigo, fechaISO } = req.body || {};
    if (!imageBase64 || !rondaId || !puntoCodigo) return res.status(400).json({ error: "Faltan datos de evidencia" });

    const match = String(imageBase64).match(/^data:image\/(webp|jpeg);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Formato de imagen inválido" });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > MAX_UPLOAD_BYTES) return res.status(413).json({ error: "La evidencia supera 260 KB" });

    const d = fechaISO ? new Date(fechaISO) : new Date();
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Fecha inválida" });
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const folder = `/rondas/${yyyy}/${mm}/${dd}/${clean(rondaId)}`;
    const fileName = `${clean(puntoCodigo)}-${Date.now()}.webp`;

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "image/webp" }), fileName);
    form.append("fileName", fileName);
    form.append("folder", folder);
    form.append("useUniqueFileName", "true");
    form.append("tags", "ronda,evidencia");

    const auth = Buffer.from(`${privateKey}:`).toString("base64");
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ error: data.message || "No se pudo subir la evidencia" });

    return res.status(200).json({
      ok: true,
      fileId: data.fileId,
      url: data.url,
      filePath: data.filePath,
      size: data.size || bytes.length
    });
  } catch (e) {
    console.error("ImageKit upload:", e);
    return res.status(500).json({ error: "Error interno al almacenar evidencia" });
  }
}
