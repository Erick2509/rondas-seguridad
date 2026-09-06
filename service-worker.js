
/* =========================================================
   FIREBASE CLOUD MESSAGING - ADMINISTRACIÓN
   ========================================================= */
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDf8abFDocep8kEHa45IJ02r_nBY6X8ops",
  authDomain: "rondas-seguridad-63ba4.firebaseapp.com",
  projectId: "rondas-seguridad-63ba4",
  storageBucket: "rondas-seguridad-63ba4.firebasestorage.app",
  messagingSenderId: "924206639387",
  appId: "1:924206639387:web:2e730ce51c54cccb624bbe"
});

const fcmMessaging = firebase.messaging();

fcmMessaging.onBackgroundMessage((payload) => {
  // Si FCM envía un payload "notification", el navegador puede mostrarlo.
  // Para mensajes de datos, mostramos nosotros la notificación.
  if (payload.notification) return;

  const title = payload.data?.title || "Rondas de Seguridad";
  const options = {
    body: payload.data?.body || "Nueva notificación",
    icon: "/icons/admin-192.png",
    badge: "/icons/admin-192.png",
    data: { url: "/admin.html" }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification?.data?.url || "/admin.html";
  event.waitUntil(clients.openWindow(destino));
});

const CACHE_NAME = "rondas-seguridad-v10-rol-cliente";
const APP_SHELL = [
  "/",
  "/index.html",
  "/ronda.html",
  "/camara.html",
  "/login.html",
  "/admin.html",
  "/instalar-admin.html",
  "/css/estilos.css",
  "/manifest.json",
  "/manifest-admin.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/rondas-192.png",
  "/icons/rondas-512.png",
  "/icons/admin-192.png",
  "/icons/admin-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Firebase, Nominatim y recursos externos siempre por red.
  if (url.origin !== self.location.origin) return;

  // HTML: red primero para evitar usar versiones antiguas después de un deploy.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match("/index.html")))
    );
    return;
  }

  // Archivos locales: caché primero, con actualización desde red.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
