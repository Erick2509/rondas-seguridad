import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDf8abFDocep8kEHa45IJ02r_nBY6X8ops",
  authDomain: "rondas-seguridad-63ba4.firebaseapp.com",
  projectId: "rondas-seguridad-63ba4",
  storageBucket: "rondas-seguridad-63ba4.firebasestorage.app",
  messagingSenderId: "924206639387",
  appId: "1:924206639387:web:2e730ce51c54cccb624bbe"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);