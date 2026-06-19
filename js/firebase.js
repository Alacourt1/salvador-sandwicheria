import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
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
export { collection, getDocs, addDoc, updateDoc, deleteDoc, setDoc, doc, ref, uploadBytes, getDownloadURL, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup };