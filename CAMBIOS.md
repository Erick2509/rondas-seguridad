# Correspondencia con las correcciones solicitadas

| Puntos de la lista | Implementación |
|---|---|
| 1–4. Identidad, propietario, reglas y CLIENTE | Authentication por agente, validación del token revocable, usuarios activos, UID propietario, autorización por acción en API y bloqueo de acceso directo a Firestore |
| 5–8. Datos personales, HTML, API y dispositivos | Lecturas autenticadas, textContent/nodos, API autenticada, dispositivos vinculados al UID y límites de solicitudes |
| 9–13. Secuencia, final, duplicados, atomicidad y ruta | Transacciones de servidor, IDs estables de validación, ruta completa validada antes de iniciar, solo un inicio/final y órdenes consecutivos |
| 14–17. Historial, tiempos, abandono y eliminación | Copia inmutable de ruta, tiempos del servidor, una ronda activa recuperable por UID, cierre administrativo y archivo con bitácora |
| 18–20. Fotos, mensajes y compartir | JPEG privado hasta 300 KB, borrador durable local, confirmación solo después del guardado y continuar independiente de Compartir |
| 21–24. Notificaciones | Eventos atómicos pendientes, recibos por token, reintentos con espera, rechazo de usuario inactivo, revocación al salir y estado de activación de la petición actual |
| 25–27. Rendimiento y estados | Consultas de diez rondas por cursor, filtros e índices, detalle bajo demanda, carga tras autorización y errores explícitos |
| 28. Internet y GPS | Borradores reenviables, interfaz de estado de conexión, dirección configurada y GPS opcional con precisión; no se afirma confirmación offline |
| 29. Pruebas | Emuladores Firebase, Chromium de escritorio y móvil, prueba de QR generado; las pruebas en dispositivos físicos y push real quedan para el despliegue |

## Cambios visibles para los usuarios

- El agente necesita código y contraseña. ADMIN crea o renueva el acceso desde Agentes.
- Se añade un formulario de dirección del punto. No se promete que GPS del navegador determine una dirección exacta.
- El administrador archiva rondas y puede consultarlas como archivadas; ya no se destruye la evidencia por una eliminación parcial.
- Las fotografías ahora quedan en el sistema. La compresión y el límite están explicados en LEEME-PRIMERO.md.
- Los registros antiguos se migran para consultarlos; las fotografías que nunca se almacenaron no pueden recuperarse retrospectivamente.
- Las notificaciones pendientes requieren el scheduler incluido o el panel abierto para reintentarse después de un fallo. No se afirma lectura ni entrega exactamente una vez.

No hay servicios externos activados, compras ni despliegues realizados por esta entrega. El código del paquete, las reglas y la migración forman una actualización conjunta.

## Actualización: agentes del cliente y novedades opcionales

- CLIENTE dispone de la pestaña Agentes en modo consulta; el servidor entrega nombre, código, cargo, turno y estado, sin UID de acceso ni gestión de contraseñas.
- Notificar novedades está disponible para AGENTE desde inicio, QR y cámara, como ventana independiente sin operaciones de escritura sobre la ronda.
- Foto JPEG con marca de agua integrada, descripción convertida realmente a mayúsculas, vista previa, compartir por WhatsApp y alternativa de descarga/adjunto manual.
- Cancelar compartir o cerrar la ventana conserva el avance y la evidencia pendiente del punto. El borrador de novedad permanece solo durante la vida de esa página.
