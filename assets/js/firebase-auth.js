import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
 import {
   getAuth,
   setPersistence,
   browserLocalPersistence,
   GoogleAuthProvider,
   signInWithPopup,
   RecaptchaVerifier,
   signInWithPhoneNumber,
   onAuthStateChanged,
   signOut
 } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
 import {
   getFirestore,
   doc,
   getDoc,
   setDoc,
   collection,
   getDocs,
   query,
   where,
   orderBy,
   serverTimestamp
 } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

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
 const db = getFirestore(app);
 const googleProvider = new GoogleAuthProvider();
 googleProvider.setCustomParameters({ prompt:"select_account" });

 window.firebaseAuthReady = true;
 window.auth = auth;
 window.db = db;
 window.googleProvider = googleProvider;
 window.firebaseFns = {
   signInWithPopup,
   RecaptchaVerifier,
   signInWithPhoneNumber,
   onAuthStateChanged,
   signOut,
   doc,
   getDoc,
   setDoc,
   collection,
   getDocs,
   query,
   where,
   orderBy,
   serverTimestamp
 };

 onAuthStateChanged(auth, function(user){
   window.tyCurrentFirebaseUser = user || null;
   if(typeof window.tyApplyAuthUser === "function") window.tyApplyAuthUser(user);
 });