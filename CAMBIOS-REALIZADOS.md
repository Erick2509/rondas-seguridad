# Cambios realizados

## Evidencia por WhatsApp

- Eliminado el endpoint de carga de imágenes.
- Eliminada toda referencia al proveedor anterior de almacenamiento de imágenes.
- La fotografía se mantiene únicamente en memoria/localmente durante el flujo de captura y compartir.
- El punto no se registra antes de compartir.
- Después de abrir el menú de compartir, el agente debe confirmar **YA LA ENVIÉ AL GRUPO**.
- Solo después de esa confirmación Firestore registra el QR y habilita el siguiente punto.
- Firestore guarda únicamente datos del punto y `evidenciaWhatsApp: true`; no guarda URL, archivo, base64 ni bytes de la foto.

## Consistencia de ronda

- Registro de validación + avance de ronda unificados en una transacción.
- Un QR usa como ID de validación su propio código para evitar duplicados en una misma ronda.
- Se verifica que la ronda siga EN_CURSO.
- Se verifica el orden esperado.
- Se verifica que el punto siga activo y coincida con tipo, función y orden.
- Cancelación de ronda protegida con transacción para no sobrescribir una ronda ya finalizada.

## Historial

- Las rondas nuevas guardan `ruta`, `totalPuntosPlanificados` y `versionRuta` al iniciar.
- El historial ya no depende de la configuración actual de puntos para reconstruir recorridos nuevos.
- El detalle de QR se carga solo cuando se pulsa **VER DETALLE**.
- Corregida la visualización de GPS cuando latitud/longitud son nulos.
- El detalle indica que la evidencia fue enviada por WhatsApp.

## Optimización Firestore

- Eliminada la descarga automática de todas las subcolecciones `validaciones` al abrir el panel.
- Caché de rondas de 60 segundos en el panel para evitar recargas repetidas al cambiar de sección.
- CLIENTE carga únicamente rondas, no catálogos de agentes ni puntos.
- El listener de notificaciones observa solo las 50 rondas más recientes.

## Seguridad

- Añadidas `firestore.rules` con permisos por ADMIN, CLIENTE y PWA de agentes.
- Las reglas validan avance secuencial y escritura conjunta de ronda + validación.
- Las nuevas rondas usan una clave aleatoria por ronda para autorizar solicitudes de notificación.
- Datos variables importantes se renderizan con `textContent` en lugar de HTML directo.
- Añadido `.gitignore` para evitar subir `.env` y archivos privados por accidente.

## Configuración

- Firebase centralizado en `js/firebase-config.js`.
- Login, aplicación principal y service worker usan esa configuración común.
- URL de notificaciones ya no está amarrada al dominio original; usa `APP_URL` o el dominio actual.
- Actualizada la versión de caché del Service Worker.

## Archivos de soporte añadidos

- `README-INSTALACION.md`
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`
- `.gitignore`
