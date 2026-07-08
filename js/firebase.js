import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
// FIX CRÍTICO: faltaban sendPasswordResetEmail y
// fetchSignInMethodsForEmail. index.html las importaba para
// "olvidé mi contraseña" y para detectar cuentas duplicadas
// Google/email, pero como no existían acá, ESE import fallaba
// con SyntaxError y tumbaba TODO el <script type="module">
// que lo contenía — el mismo módulo que carga el título y la
// imagen del hero desde Firestore. Por eso lo publicado en el
// admin nunca se veía reflejado en el sitio: el código que lo
// aplica (cargarConfiguracion/revelarHero) nunca llegaba a
// correr.

const firebaseConfig = {
  apiKey: "AIzaSyCkzgIF9DDhpy-W6yi1RFR1qVXlWe5PWSg",
  authDomain: "salvador-sandwicheria.firebaseapp.com",
  projectId: "salvador-sandwicheria",
  storageBucket: "salvador-sandwicheria.firebasestorage.app",
  messagingSenderId: "1047155406372",
  appId: "1:1047155406372:web:884e0bc3cc89e379724ab1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// FIX: faltaba exportar `getDoc` (lectura de un documento puntual,
// distinto de `getDocs` que lee una colección completa). El
// index.html lo importa para leer /usuarios/{uid} al cargar los
// datos de puntos de cada cliente — al no existir este export,
// el import fallaba con SyntaxError y tumbaba TODO el módulo que
// lo importaba (auth admin, login con Google, botón de puntos,
// banner de ofertas, imagen de fondo del hero: todo vivía en ese
// mismo bloque <script type="module">).
export {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  ref,
  uploadBytes,
  getDownloadURL,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail
};