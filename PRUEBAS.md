# Verificación de la entrega

Fecha: 26/09/2026. Pruebas ejecutadas sobre el código incluido, con un proyecto aislado `demo-rondas`. No se utilizaron credenciales ni datos de producción.

## Resultados

| Comprobación | Resultado |
|---|---|
| Build del navegador y service worker | Aprobado; recursos locales compilados |
| Sintaxis de 29 archivos JS/CJS y referencias locales de HTML | Aprobado |
| Pruebas unitarias | 5 aprobadas: rutas inválidas, permisos/secuencia, imágenes inválidas, tiempo del servidor y QR con área central cubierta |
| Reglas Firestore | 184 operaciones directas rechazadas según lo esperado, con contextos anónimo, CLIENTE, AGENTE y ADMIN |
| API con Authentication y Firestore emulados | 16 escenarios aprobados (17 resultados de Node incluyendo el contenedor de la suite) |
| Migración de historial | Simulación sin cambios, aplicación conservando registros y repetición idempotente aprobadas |
| Navegador Chromium | Flujo ADMIN/CLIENTE/AGENTE aprobado, escritorio 1360×960 y vista móvil 390×844 |
| QR generado por la interfaz, con PREVENCIÓN | Decodificado a la URL correcta mediante jsQR |
| Evidencia | Foto recuperada desde el detalle después de registrar; otro agente no puede leerla |
| Conexión interrumpida | Borrador retenido y reenvío sin duplicar el punto |
| Compartir cancelado | Continuar sigue disponible; foto recuperada tras recarga |
| XSS | Texto con etiqueta HTML mostrado literalmente, sin crear la etiqueta ni ejecutar el marcador |
| Service worker | La página inicial vuelve a abrir con la red deshabilitada después de instalar la caché |
| Dependencias de producción (`npm audit --omit=dev`) | 0 alertas conocidas en el momento de la revisión |

Entorno final de servidor: Node.js 22.23.3 y Java 21; Firebase CLI 15.31.0. Navegador final: Chromium 140 mediante Playwright 1.55.1. Las pruebas de FCM usan un emisor simulado que puede fallar para verificar persistencia y reintentos; no envían push reales.

Los escenarios de API cubren: acceso anónimo, permisos del CLIENTE, inicio concurrente, agente ajeno, FINAL adelantado, imagen inválida, envío duplicado concurrente, ruta histórica al editar catálogo, punto desactivado, cierre correcto, reintento después del cierre, repetición del identificador de inicio, lectura protegida de foto, archivo con bitácora, dispositivos ajenos, FCM transitorio, usuarios deshabilitados, paginación/filtros y protección del propio administrador. Algunos casos se agrupan en un escenario.

## Cómo repetir las pruebas

Requisitos: Node.js 22, Java 21+, npm y los puertos 8080/9099/4173 libres.

```sh
npm ci
npm run build
npm test
npm run test:rules
npm run test:integration
npx playwright install chromium --only-shell
npx firebase emulators:exec --project demo-rondas --only firestore,auth "node --test tests/migration.integration.cjs"
npx firebase emulators:exec --project demo-rondas --only firestore,auth "node tests/browser.cjs"
```

Los mensajes PERMISSION_DENIED en la prueba de reglas son resultados esperados de los casos negativos, no un error de instalación.

## Dependencias y alcance pendiente

Se actualizó Firebase Admin de 13.4.0 a 14.5.0 y se fijaron versiones con `package-lock.json`. El override de UUID 11.1.1 dentro de Gaxios sustituye la versión con aviso conocido; las pruebas de la API pasaron con esa resolución. No se aplicaron cambios forzados de API mayor a las dependencias de telemetría de la CLI.

La auditoría completa incluyendo herramientas de desarrollo conserva **3 avisos moderados** de la cadena `firebase-tools → @google-cloud/pubsub → @opentelemetry/core`, sin avisos altos ni críticos. Esa cadena pertenece a la herramienta local de Firebase y no se importa en la aplicación del navegador ni en los handlers de producción. Los avisos están declarados; no se afirma ausencia absoluta de vulnerabilidades ni seguridad certificada. Revisa las actualizaciones de la CLI antes de usarla en el futuro.

Falta verificar en tu despliegue real:

- Variables y credenciales correctas, cuenta ADMIN, dominios autorizados e índices terminados.
- Entrega real de FCM, permisos del sistema operativo y ejecución del scheduler con el panel cerrado.
- Instalación y cámaras físicas de Android/iOS, permisos denegados y lectura de los QR impresos en el lugar.
- Cuotas y consumo real de Firestore/Vercel, retención de fotos y disponibilidad del scheduler elegido.

El navegador móvil emulado no equivale a una prueba en un iPhone o Android físico. La aplicación puede cargar su interfaz sin red y conserva borradores, pero no inicia ni confirma rondas nuevas sin comunicación con el servidor.
