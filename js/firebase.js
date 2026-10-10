import "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export const firebaseConfig = globalThis.FIREBASE_CONFIG;
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
