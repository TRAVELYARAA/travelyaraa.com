/* TravelYaraa single Firebase authentication source.
   A Firebase currentUser on its own is NOT a TravelYaraa login.
   A page may only show logged-in UI once the backend has issued ty_user_auth_token. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
 import {
   getAuth,
   setPersistence,
   browserLocalPersistence,
   GoogleAuthProvider,
   signInWithPopup,
   signInWithRedirect,
   getRedirectResult,
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

 const TOKEN_KEY = "ty_user_auth_token";
 const PROFILE_KEY = "ty_user_profile";
 const LEGACY_PROFILE_KEY = "travelYaraaUser";
 const LOGGED_IN_KEY = "tyUserLoggedIn";
 const REDIRECT_GUARD_KEY = "ty_google_redirect_pending";

 window.firebaseAuthReady = true;
 window.auth = auth;
 window.db = db;
 window.googleProvider = googleProvider;
 window.firebaseFns = {
   signInWithPopup,
   signInWithRedirect,
   getRedirectResult,
   GoogleAuthProvider,
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

 function storedToken(){
   try{ return localStorage.getItem(TOKEN_KEY) || ""; }catch(e){ return ""; }
 }

 function storedProfile(){
   try{ return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); }catch(e){ return null; }
 }

 window.tyStoredAuthToken = storedToken;

 window.tyClearBackendSession = function(){
   try{
     [TOKEN_KEY, PROFILE_KEY, LEGACY_PROFILE_KEY, LOGGED_IN_KEY].forEach(function(key){ localStorage.removeItem(key); });
   }catch(e){}
 };

 /* Authoritative login condition for every TravelYaraa page. */
 window.tyIsLoggedIn = function(){
   const user = window.tyCurrentFirebaseUser || auth.currentUser;
   return Boolean(user && storedToken());
 };

 let backendAuthSyncPromise = null;
 let backendAuthSyncUid = "";

 window.tySyncFirebaseUserWithBackend = async function(user, extraPayload){
   if(!user) return null;
   const existingToken = storedToken();
   const existingProfile = storedProfile();
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
       error.status = response.status;
       throw error;
     }
     const profile = data.user || {};
     localStorage.setItem(TOKEN_KEY, data.authToken);
     localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
     localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(profile));
     localStorage.setItem(LOGGED_IN_KEY, "true");
     return Object.assign({}, data, {user:profile});
   })();

   try{
     return await backendAuthSyncPromise;
   }catch(error){
     /* Never leave a half-logged-in session behind. */
     window.tyClearBackendSession();
     throw error;
   }finally{
     backendAuthSyncPromise = null;
   }
 };

 function needsRedirectFallback(error){
   const code = String((error && error.code) || "");
   return code === "auth/popup-blocked"
     || code === "auth/operation-not-supported-in-this-environment"
     || code === "auth/cancelled-popup-request";
 }

 function redirectAlreadyAttempted(){
   try{ return sessionStorage.getItem(REDIRECT_GUARD_KEY) === "1"; }catch(e){ return false; }
 }

 /* Single Google login entry point: popup first, redirect only when the
    browser refuses the popup. A popup closed by the user is not retried. */
 window.tyGoogleLogin = async function(extraPayload){
   const alreadyRedirected = redirectAlreadyAttempted();
   try{
     const credential = await signInWithPopup(auth, googleProvider);
     return await window.tySyncFirebaseUserWithBackend(credential.user, extraPayload || {service:"account"});
   }catch(error){
     if(needsRedirectFallback(error) && !alreadyRedirected){
       try{ sessionStorage.setItem(REDIRECT_GUARD_KEY, "1"); }catch(e){}
       await signInWithRedirect(auth, googleProvider);
       return null;
     }
     throw error;
   }
 };

 let redirectError = null;

 const redirectSettled = getRedirectResult(auth)
   .then(function(result){
     if(result && result.user) return window.tySyncFirebaseUserWithBackend(result.user, {service:"account"});
     return null;
   })
   .catch(function(error){ redirectError = error; return null; })
   .then(function(value){
     try{ sessionStorage.removeItem(REDIRECT_GUARD_KEY); }catch(e){}
     return value;
   });

 function publishAuthState(user, state){
   window.tyAuthState = state;
   if(typeof window.tyApplyAuthUser === "function") window.tyApplyAuthUser(user, state);
 }

 async function applyBackendAuthState(user){
   await redirectSettled;
   if(!user){
     window.tyClearBackendSession();
     const pending = redirectError;
     redirectError = null;
     publishAuthState(null, {authorized:false, error:pending || null});
     return;
   }
   try{
     const result = await window.tySyncFirebaseUserWithBackend(user, {service:"account"});
     publishAuthState(user, {authorized:Boolean(storedToken()), error:null, result:result});
   }catch(error){
     publishAuthState(null, {authorized:false, error:error, firebaseUser:user});
   }
 }

 onAuthStateChanged(auth, function(user){
   window.tyCurrentFirebaseUser = user || null;
   void applyBackendAuthState(user || null);
 });
