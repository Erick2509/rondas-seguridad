# Rondas de Seguridad — versión corregida 2.0

Proyecto completo en HTML, CSS y JavaScript, con Firebase Authentication/Firestore y API para Vercel. Conserva las dos PWA, los tipos EXTERNA/INTERNA, los QR `ronda.html?punto=Pxx`, los turnos Día/Noche, el historial y los roles ADMIN/CLIENTE. Añade cuentas individuales AGENTE.

**Este paquete está preparado y probado localmente. No se ha publicado en tu Vercel ni se han modificado tus datos reales. Debes desplegar aplicación y reglas conjuntamente.**

## Cambios principales

- Código y contraseña por agente, cuenta autenticada y propiedad de la ronda verificadas en cada operación del servidor.
- CLIENTE consulta el historial y recibe notificaciones. Las escrituras del negocio se realizan exclusivamente en el servidor y exigen su rol correspondiente.
- Ruta validada y congelada al inicio: un INICIO, órdenes consecutivos y un FINAL al terminar. Los QR físicos existentes siguen sirviendo si se conserva el mismo dominio y los códigos.
- Una sola ronda activa por agente; se recupera al ingresar desde otro dispositivo.
- Foto, validación y contador se guardan en una sola transacción. El ID estable por paso evita duplicados en reintentos y concurrencia.
- Ronda completada únicamente después de todos los puntos. Las duraciones se calculan con tiempo del servidor.
- Evidencias privadas recuperables en el detalle. La interfaz distingue borrador pendiente de fotografía guardada.
- Borradores de fotografía en IndexedDB: sobreviven a recargas y pueden reenviarse desde la misma cuenta y dispositivo. Al desconectarse, no se anuncia un registro confirmado. Pulsa Reintentar guardado al recuperar internet. No depende de sincronización en segundo plano del navegador.
- Historial con páginas de diez y filtros consultados en servidor; las validaciones y fotos se cargan al abrirlas.
- Archivo lógico con autor/motivo y bitácora; se conserva el registro original. ADMIN puede cerrar una ronda abandonada con motivo y luego archivarla.
- Eventos de notificación durables con reintentos y comprobación de usuarios activos. Un cierre de sesión elimina el dispositivo registrado antes de salir; si no hay conexión se pide reintentar para no afirmar falsamente que se revocó.
- Generación/descarga e impresión masiva de QR con PREVENCIÓN, sin insertar datos como HTML.
- Módulo de agentes, contraseñas y usuarios del panel; protección contra quitarse el último acceso administrativo.

## 1. Preparación y respaldo

1. Reserva un momento sin rondas en curso. Conserva el ZIP anterior y las reglas actuales para referencia.
2. Descomprime este paquete. La carpeta que contiene `package.json`, `api`, `src`, `public` y `lib` es la raíz del proyecto.
3. Usa Node.js 22 y ejecuta `npm ci` en esa carpeta. No subas `node_modules`.
4. El archivo `src/config.js` contiene la configuración pública de tu proyecto original. Ya se mantuvo su projectId y su clave VAPID pública. No se necesitan claves privadas en ese archivo.
5. Copia `.env.example` a `.env.local` para ejecutar la migración local. Rellena las credenciales de tu cuenta de servicio de Firebase. Nunca publiques ese archivo, el JSON de la cuenta de servicio o los respaldos.

## 2. Firebase Authentication

1. En Firebase → Authentication → Sign-in method, habilita **Correo electrónico/contraseña**.
2. Conserva las cuentas ADMIN y CLIENTE existentes. Los documentos `usuarios/{uid}` deben contener `rol: "ADMIN"` o `"CLIENTE"` y `activo: true`.
3. Comprueba que el UID de tu administrador coincide con el de Authentication. Esta cuenta inicial no se crea automáticamente desde internet.
4. Autoriza el dominio de tu Vercel en Authentication → Settings → Authorized domains.
5. Agrega una política de contraseñas acorde con tu servicio (las contraseñas temporales generadas tienen 20 caracteres). Un agente puede cambiarlas desde su aplicación.

Las cuentas de agentes usan internamente `CODIGO@agentes.rondas.invalid`. Es un identificador técnico: el agente escribe su código, no necesita correo y no se envían correos a ese dominio. La recuperación de acceso de agentes la realiza ADMIN con Renovar contraseña. Las cuentas del panel sí utilizan correos reales.

## 3. Variables de entorno en Vercel

En Project → Settings → Environment Variables configura, en Production:

| Variable | Valor |
|---|---|
| FIREBASE_PROJECT_ID | `rondas-seguridad-63ba4` |
| FIREBASE_CLIENT_EMAIL | `client_email` de la cuenta de servicio |
| FIREBASE_PRIVATE_KEY | `private_key` completa; se admiten saltos reales o `\n` |
| APP_ORIGIN | Tu dominio exacto, por ejemplo `https://rondas-seguridad.vercel.app`, sin barra final |
| CRON_SECRET | Cadena aleatoria privada de al menos 32 caracteres |

Puedes generar el secreto con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

El proceso de pruebas utiliza solamente un proyecto `demo-rondas` y los emuladores. Nunca configures `FIRESTORE_EMULATOR_HOST` ni `FIREBASE_AUTH_EMULATOR_HOST` en Vercel Production.

## 4. Reglas e índices — publicar junto con la nueva aplicación

**No copies estas reglas mientras continúes usando el código anterior:** se bloquean deliberadamente los accesos directos a Firestore desde el navegador. El nuevo código utiliza la API autenticada. Hacerlo fuera de la ventana de mantenimiento cortaría temporalmente la versión antigua.

Con Firebase CLI autenticado en tu cuenta y ubicado en la raíz del proyecto:

```sh
npx firebase login
npx firebase deploy --project rondas-seguridad-63ba4 --only firestore:rules,firestore:indexes
```

También puedes copiar `firestore.rules` completo en Firebase → Firestore Database → Reglas → Publicar. Los índices igualmente deben crearse con el comando o siguiendo la configuración de `firestore.indexes.json`. Espera a que estén listos antes de probar filtros.

`storage.rules` bloquea acceso a Cloud Storage, que esta versión no utiliza. No es necesario habilitar Storage. Si tu proyecto comparte un bucket con otra aplicación, no reemplaces sus reglas con este archivo sin revisar ese uso.

La API usa Admin SDK y no está limitada por las reglas de clientes: su seguridad depende de `lib/access.cjs`, los permisos por acción y las transacciones. No elimines esos controles ni expongas las credenciales del servidor.

## 5. Migrar el historial anterior

Esta operación debe hacerse una vez durante el mantenimiento, antes de permitir rondas nuevas. El script no borra rondas, agentes ni usuarios. Normaliza fechas y el campo `archivada` para que el historial entre en la paginación, y desactiva dispositivos push de la versión anterior para que vuelvan a registrarse con asociación segura.

Primero simula:

```sh
node --env-file=.env.local scripts/migrar.cjs
```

Crea un respaldo privado `.ndjson` de usuarios, agentes, puntos, dispositivos, rondas y validaciones anteriores a los cambios. Conserva ese respaldo fuera del sitio web. No equivale a una exportación administrada de todo Firebase.

Después de revisar el resultado, aplica:

```sh
node --env-file=.env.local scripts/migrar.cjs --apply
```

Si quedan rondas antiguas EN_CURSO, ciérralas con motivo desde el nuevo panel. Si has decidido cerrar todas las antiguas como INCOMPLETAS durante el cambio:

```sh
node --env-file=.env.local scripts/migrar.cjs --apply --cerrar-antiguas
```

Ese último parámetro **sí cambia el estado de las rondas antiguas abiertas** y deja registro del motivo. No se aplica a rondas nuevas schemaVersion 2. El script se puede repetir: respeta los documentos de la versión nueva y no vuelve a activar notificaciones antiguas.

Las rondas anteriores no tenían fotos almacenadas ni una versión histórica de ruta; no se inventan ni reconstruyen esos datos. El detalle indica cuando no hay fotografía. Fechas antiguas que no puedan determinarse se marcan y se ordenan al final; la interfaz debe interpretarlas como desconocidas.

## 6. Desplegar la aplicación

1. Sustituye el contenido del proyecto anterior por la carpeta nueva completa. No mezcles sus JS antiguos con los nuevos. Mantén el dominio original para conservar los QR impresos.
2. En Vercel importa la raíz que contiene `package.json`. Framework: **Other**. Build command: `npm run build`. Output: `public`. Node: **22.x**. `vercel.json` contiene esas opciones de build y los encabezados.
3. La carpeta `api` y `lib` debe quedar en la raíz, no dentro de `public`.
4. Despliega y verifica `/login.html`. Inicia sesión con tu ADMIN existente.
5. Cierra todas las ventanas/PWA antiguas y vuelve a abrirlas para actualizar el service worker. Si el dispositivo sigue usando la versión anterior, borra los datos del sitio o reinstala la PWA después de confirmar que no quedan registros locales pendientes. Las rondas del servidor permanecen.
6. Puntos / QR: revisa la dirección de cada punto y el aviso de rutas válidas. Los puntos antiguos sin dirección siguen siendo reconocidos, pero conviene completarla antes de operar.
7. Agentes: pulsa **Crear acceso** para cada agente anterior o nuevo y entrega su código/contraseña en privado. Si el agente ya tiene acceso, Renovar contraseña invalida la anterior.
8. ADMIN y CLIENTE deben pulsar Activar notificaciones de nuevo desde cada dispositivo.

## 7. Reintentos automáticos de push con el panel cerrado

Los avisos se intentan enviar al iniciar, completar o cancelar una ronda. El panel abierto también procesa pendientes cada 30 segundos. Si no hay ninguna pantalla abierta después de un fallo, necesitas un proceso programado para reintentar sin intervención humana.

Se incluye `.github/workflows/reintentar-notificaciones.yml`: si subes el proyecto a un repositorio GitHub, configura los secretos de Actions `APP_ORIGIN` y `CRON_SECRET` con los mismos valores de Vercel. El workflow solicita la cola cada cinco minutos y admite ejecución manual. Los horarios de Actions pueden retrasarse; revisa la disponibilidad y límites de tu cuenta. No envía mensajes a personas ni publica datos del repositorio.

Alternativamente, configura un scheduler propio que llame por GET o POST a:

```
https://TU-DOMINIO/api/procesar-notificaciones
Authorization: Bearer TU_CRON_SECRET
```

No pongas el secreto en la URL, en el JavaScript público o en capturas. No se ha añadido un cron frecuente de Vercel que obligue a cambiar de plan. Si usas Vercel Cron, configura una frecuencia admitida por tu plan.

Después de 12 intentos fallidos, el evento figura FALLIDO en Avisos → Entrega de notificaciones; ADMIN puede reintentarlo. Cada token tiene un recibo persistido para saltar los envíos ya aceptados por FCM. Un corte entre aceptar FCM y guardar el recibo puede ocasionar reenvío; el mismo `tag` reduce duplicados visuales. **No se promete entrega exactamente una vez ni que el destinatario haya leído el aviso.** Con cero dispositivos autorizados el evento se considera procesado sin destinatarios; registra los dispositivos antes de operar.

## 8. Fotografías, cuotas y ubicación

Las fotos se comprimen a JPEG de **hasta 300 KB** y se guardan como bytes en documentos privados separados de Firestore. No se almacenan en el documento de la ronda ni se descargan al listar el historial. No hay enlaces públicos permanentes: la API vuelve a comprobar permisos al recuperar cada foto.

Esta decisión evita exigir Cloud Storage para esta versión. **No significa almacenamiento ilimitado o coste cero:** se consumen almacenamiento, lecturas y escrituras de Firestore y recursos de Vercel. Como referencia de capacidad, 1.000 fotografías de 300 KB suman aproximadamente 300 MB solo en imágenes; añade metadatos, índices y el resto del sistema. El archivado lógico conserva imágenes y no libera esa cuota. Para operación intensiva o retención prolongada, planifica migración a almacenamiento de objetos con acceso privado o un procedimiento de exportación/retención antes de alcanzar los límites.

La foto conserva una marca con nombre, cargo, turno, punto, dirección configurada y hora declarada por el dispositivo. La validación y duración oficiales usan el reloj del servidor. El GPS es opcional, aproximado y registra su precisión. No se envían coordenadas a un geocodificador externo. Un QR estático puede copiarse; ni el QR, ni una foto subida, ni GPS del navegador constituyen por sí solos una prueba infalible de presencia física.

## 9. Validación antes de usar con agentes

- ADMIN entra; CLIENTE ve rondas y avisos y no puede crear o editar registros administrativos.
- Cada agente entra con su código y contraseña. Deshabilitarlo bloquea operaciones incluso con una sesión previa.
- Realiza una ronda de prueba INICIO → PUNTO → FINAL. Escanea también uno fuera de orden.
- Comprueba la foto en el panel y repite el envío del mismo punto: el contador no debe duplicarse.
- Desconecta internet después de preparar la fotografía: aparece como pendiente; reconecta y reintenta.
- Cancela Compartir: debe seguir disponible Continuar ronda.
- Verifica recuperación de ronda desde otro dispositivo con la misma cuenta.
- Revisa filtros, paginación, archivo lógico y que las rutas anteriores no cambien al editar puntos.
- Instala ambas PWA en Android y en iPhone; verifica permisos y recepción real de push. Estas comprobaciones físicas no se pueden sustituir por las pruebas locales incluidas.

## 10. Pruebas incluidas

```sh
npm ci
npm run build
npm test
npm run test:rules
npm run test:integration
```

Para los emuladores se necesita Java 21 o superior compatible con la versión de Firebase CLI fijada. Las pruebas usan `demo-rondas`, nunca el proyecto productivo.

`npm run test:browser` se ejecuta dentro de los emuladores con el comando indicado en PRUEBAS.md. Los resultados ejecutados para esta entrega se detallan allí.

## Archivos principales

- `public/`: páginas, estilos, iconos, manifiestos y recursos compilados.
- `src/`: código del navegador, renderizado con nodos/textContent y borradores locales.
- `api/`: entradas para Vercel.
- `lib/`: autenticación, validación de recorridos, catálogos, fotos y cola de notificaciones.
- `firestore.rules`, `firestore.indexes.json`: protección y consultas.
- `scripts/migrar.cjs`: adaptación del historial con simulación y respaldo.
- `tests/`: pruebas de reglas, negocio y navegador.

Las credenciales temporales se muestran una vez en la respuesta; no se guardan como texto en Firestore ni en archivos del proyecto. Guarda tus variables privadas únicamente en Vercel y, si migras localmente, en un `.env.local` privado.
