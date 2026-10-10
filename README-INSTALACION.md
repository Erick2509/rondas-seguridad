# Rondas de Seguridad — instalación y funcionamiento

## Flujo actual de una ronda

1. El agente escanea el QR físico correspondiente.
2. El sistema valida el tipo de ronda y el orden del QR.
3. El agente toma la fotografía.
4. La PWA agrega a la imagen los datos de la ronda, agente, punto, fecha, hora y ubicación.
5. El agente pulsa **ENVIAR FOTO AL GRUPO DE WHATSAPP**.
6. El teléfono abre el menú nativo para compartir. El agente selecciona WhatsApp y el grupo correspondiente.
7. El agente pulsa **YA LA ENVIÉ AL GRUPO** y confirma.
8. Recién entonces se registra el QR en Firestore y se habilita **CONTINUAR RONDA**.

La fotografía **no se sube ni se almacena en el sistema**. Firestore solo conserva los datos del punto y el indicador de que la evidencia fue enviada por WhatsApp.

> Nota: una PWA/web no puede seleccionar automáticamente un grupo concreto de WhatsApp ni comprobar técnicamente que el mensaje llegó al grupo. Por eso existe una confirmación explícita antes de registrar el punto.

## Firebase

La configuración pública de Firebase está centralizada en:

`js/firebase-config.js`

Si el proyecto se instala para otro cliente, cambia allí los datos del nuevo proyecto Firebase.

### Reglas de Firestore

El proyecto incluye:

- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

Para desplegar las reglas con Firebase CLI:

```bash
firebase login
firebase use TU_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```

Las reglas incluidas separan:

- ADMIN: administración de agentes, puntos y rondas.
- CLIENTE: lectura del historial y notificaciones.
- PWA de agentes: lectura de puntos activos, consulta del agente por código, inicio de ronda, avance secuencial y cancelación.

## Vercel / notificaciones push

La API `api/notificar-ronda.js` necesita estas variables privadas en Vercel:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Opcional:

- `APP_URL` — URL pública del sistema. Si no se define, la API usa automáticamente el dominio de la petición.

Nunca coloques `FIREBASE_PRIVATE_KEY` ni otras claves privadas dentro de archivos JavaScript públicos.

## Optimización de lecturas

El panel fue ajustado para reducir consumo:

- Las validaciones/QR de una ronda no se descargan al abrir el panel.
- Se cargan solo al pulsar **VER DETALLE**.
- Las rondas permanecen en caché del panel durante 60 segundos salvo que se pulse **ACTUALIZAR**.
- CLIENTE no descarga catálogos de puntos ni agentes.
- El listener de notificaciones observa solo las 50 rondas más recientes.
- Las rondas nuevas guardan una copia de su recorrido para no depender del catálogo actual al mostrar el historial.

## Prueba recomendada antes de producción

1. Crear al menos una ruta INTERNA y una EXTERNA completas.
2. Verificar que cada ruta tenga un único INICIO, órdenes consecutivos y un único FINAL al último.
3. Crear un agente activo.
4. Iniciar una ronda desde el QR de INICIO.
5. Intentar escanear un QR fuera de orden y comprobar que sea rechazado.
6. Tomar una fotografía y cancelar el menú de compartir: el punto no debe avanzar.
7. Compartir la fotografía, confirmar el envío y verificar que recién entonces aparezca CONTINUAR RONDA.
8. Completar la ronda y revisar el historial desde ADMIN y CLIENTE.
9. Probar CANCELAR RONDA y verificar estado INCOMPLETA.
10. Probar eliminar una ronda desde ADMIN.
