import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbh-qcy3ZiS8azoxbqW3YDwafOq2Owzcw",
  authDomain: "travelyaraa-b9d83.firebaseapp.com",
  projectId: "travelyaraa-b9d83",
  storageBucket: "travelyaraa-b9d83.firebasestorage.app",
  messagingSenderId: "381036733294",
  appId: "1:381036733294:web:d36d35e88fed44e2e0d77f",
  measurementId: "G-3S0SHNRBHY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);

window.firebaseAuthReady = true;
window.auth = auth;
window.tyCurrentFirebaseUser = auth.currentUser || null;

onAuthStateChanged(auth, function(user) {
  window.tyCurrentFirebaseUser = user || null;
  if (user && typeof window.tySyncFirebaseUserWithBackend === "function") {
    window.tySyncFirebaseUserWithBackend(user).catch(function(){});
  }
  if (typeof window.tyApplyAuthUser === "function") {
    window.tyApplyAuthUser(user || null);
  }
});
