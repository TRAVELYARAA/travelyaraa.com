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

 let backendAuthSyncPromise = null;
 let backendAuthSyncUid = "";

 window.tySyncFirebaseUserWithBackend = async function(user, extraPayload){
   if(!user) return null;
   const existingToken = localStorage.getItem("ty_user_auth_token") || "";
   const existingProfile = JSON.parse(localStorage.getItem("ty_user_profile") || "null");
   if(existingToken && existingProfile && String(existingProfile.uid || existingProfile.userId || "") === String(user.uid || "")){
     return {authToken:existingToken, user:existingProfile, reused:true};
   }
   if(backendAuthSyncPromise && backendAuthSyncUid === String(user.uid || "")) return backendAuthSyncPromise;

   backendAuthSyncUid = String(user.uid || "");
   backendAuthSyncPromise = (async function(){
     const idToken = await user.getIdToken(true);
     const base = String(window.TRAVELYARAA_API_BASE || window.TY_API_BASE || "https://api.travelyaraa.com").replace(/\/$/,"");
     const response = await fetch(base + "/api/bookings/guest-auth/firebase-login", {
       method:"POST",
       headers:{"Content-Type":"application/json","Accept":"application/json"},
       body:JSON.stringify(Object.assign({
         provider:(user.providerData && user.providerData[0] && user.providerData[0].providerId) || "firebase",
         firebaseIdToken:idToken,
         email:user.email || "",
         phone:user.phoneNumber || "",
         name:user.displayName || "",
         service:"account"
       }, extraPayload || {})),
       cache:"no-store"
     });
     const data = await response.json().catch(function(){ return null; });
     if(!response.ok || !data || data.success === false || !data.authToken){
       const error = new Error((data && data.message) || "TravelYaraa login could not be completed.");
       error.code = (data && data.code) || "LOGIN_BACKEND_FAILED";
       throw error;
     }
     const profile = data.user || {};
     localStorage.setItem("ty_user_auth_token", data.authToken);
     localStorage.setItem("ty_user_profile", JSON.stringify(profile));
     localStorage.setItem("travelYaraaUser", JSON.stringify(profile));
     localStorage.setItem("tyUserLoggedIn", "true");
     return Object.assign({}, data, {user:profile});
   })();

   try{ return await backendAuthSyncPromise; }
   finally{ backendAuthSyncPromise = null; }
 };

 onAuthStateChanged(auth, function(user){
   window.tyCurrentFirebaseUser = user || null;
   if(typeof window.tyApplyAuthUser === "function") window.tyApplyAuthUser(user);
 });