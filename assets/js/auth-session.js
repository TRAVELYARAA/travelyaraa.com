(function(global){
  'use strict';

  var TOKEN_KEY = 'ty_user_auth_token';
  var LOGIN_FLAG = 'tyUserLoggedIn';
  var LOGIN_REDIRECT_KEY = 'ty_login_redirect';
  var LOGIN_FLOW_KEY = 'ty_mybooking_login_flow';
  var LOGIN_ACTION_KEY = 'ty_mybooking_login_user_action';
  var AUTH_EVENT = 'ty-auth-changed';
  var syncPromise = null;
  var syncUid = '';

  function text(v){
    return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function apiBase(){
    return String(global.TRAVELYARAA_API_BASE || global.TY_API_BASE || 'https://api.travelyaraa.com').replace(/\/+$/, '');
  }

  function getToken(){
    try{ return text(global.localStorage.getItem(TOKEN_KEY)); }catch(_){ return ''; }
  }

  function getProfile(){
    try{
      var raw = global.localStorage.getItem('ty_user_profile') || global.localStorage.getItem('travelYaraaUser') || 'null';
      return JSON.parse(raw);
    }catch(_){ return null; }
  }

  function profileUid(profile){
    if(!profile || typeof profile !== 'object') return '';
    return text(profile.uid || profile.userId || profile.id || '');
  }

  function currentFirebaseUser(){
    try{
      return global.tyCurrentFirebaseUser || (global.auth && global.auth.currentUser) || null;
    }catch(_){ return null; }
  }

  function isLoggedIn(){
    if(currentFirebaseUser()) return true;
    var profile = getProfile();
    var hasProfile = !!(profile && (profileUid(profile) || profile.email || profile.phone));
    var hasFlag = false;
    try{ hasFlag = global.localStorage.getItem(LOGIN_FLAG) === 'true'; }catch(_){}
    if(getToken() && (hasFlag || hasProfile)) return true;
    if(hasFlag && hasProfile) return true;
    return false;
  }

  function tokenBelongsToUser(user){
    var token = getToken();
    if(!token || !user) return false;
    var profile = getProfile();
    var storedUid = profileUid(profile);
    if(!storedUid) return !!token;
    return storedUid === text(user.uid || '');
  }

  function persistSession(authToken, profile){
    if(!authToken) return;
    try{
      global.localStorage.setItem(TOKEN_KEY, authToken);
      if(profile){
        global.localStorage.setItem('ty_user_profile', JSON.stringify(profile));
        global.localStorage.setItem('travelYaraaUser', JSON.stringify(profile));
      }
      global.localStorage.setItem(LOGIN_FLAG, 'true');
    }catch(_){}
    broadcastAuth(true);
  }

  function clearSession(){
    try{
      [TOKEN_KEY, 'ty_user_profile', 'travelYaraaUser', LOGIN_FLAG, 'authToken', 'token', 'jwt'].forEach(function(key){
        global.localStorage.removeItem(key);
      });
    }catch(_){}
    broadcastAuth(false);
  }

  function broadcastAuth(loggedIn){
    try{
      global.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { loggedIn: !!loggedIn } }));
    }catch(_){}
  }

  function rememberLoginRedirect(redirect){
    try{
      global.localStorage.setItem(LOGIN_REDIRECT_KEY, redirect || '/my-bookings.html');
      global.sessionStorage.setItem(LOGIN_FLOW_KEY, '1');
      global.sessionStorage.setItem(LOGIN_ACTION_KEY, '1');
    }catch(_){}
  }

  function goToLogin(redirect){
    rememberLoginRedirect(redirect || '/my-bookings.html');
    global.location.href = '/index.html?openLogin=1&redirect=' + encodeURIComponent(redirect || '/my-bookings.html');
  }

  async function syncFirebaseUserWithBackend(user, extraPayload){
    if(!user || typeof user.getIdToken !== 'function') return null;

    var force = !!(extraPayload && extraPayload.force);
    var existingToken = getToken();
    var existingProfile = getProfile();

    // Reuse the existing account token. Never mint a guest/temp token on refresh/navigation.
    if(!force && tokenBelongsToUser(user)){
      return { authToken: existingToken, user: existingProfile || { uid: user.uid || '' }, reused: true };
    }

    if(syncPromise && syncUid === String(user.uid || '')) return syncPromise;

    syncUid = String(user.uid || '');
    syncPromise = (async function(){
      var idToken = await user.getIdToken(!!force);
      var provider = (user.providerData && user.providerData[0] && user.providerData[0].providerId) || 'firebase';
      var body = {
        provider: provider,
        firebaseIdToken: idToken,
        email: user.email || '',
        phone: user.phoneNumber || '',
        name: user.displayName || '',
        service: 'account'
      };
      if(extraPayload && typeof extraPayload === 'object'){
        Object.keys(extraPayload).forEach(function(key){
          if(key === 'force') return;
          body[key] = extraPayload[key];
        });
      }

      var response = await fetch(apiBase() + '/api/bookings/guest-auth/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store'
      });

      var data = await response.json().catch(function(){ return {}; });
      if(!response.ok || data.success === false || !data.authToken){
        // Keep existing account token if exchange fails.
        if(existingToken && tokenBelongsToUser(user)){
          return { authToken: existingToken, user: existingProfile, reused: true, syncFailed: true };
        }
        var error = new Error(data.message || 'Login sync failed');
        error.status = response.status;
        error.code = data.code || 'LOGIN_BACKEND_FAILED';
        throw error;
      }

      var profile = data.user || {
        uid: user.uid || '',
        userId: user.uid || '',
        email: user.email || '',
        phone: user.phoneNumber || '',
        name: user.displayName || ''
      };

      persistSession(data.authToken, profile);
      return Object.assign({}, data, { user: profile, reused: false });
    })();

    try{ return await syncPromise; }
    finally{ syncPromise = null; }
  }

  async function ensureToken(options){
    options = options || {};
    var existing = getToken();
    var user = options.firebaseUser || currentFirebaseUser();

    if(existing && (!user || tokenBelongsToUser(user) || isLoggedIn())){
      return existing;
    }

    if(options.firebaseReady && !options.firebaseResolved){
      await Promise.race([
        options.firebaseReady,
        new Promise(function(resolve){ setTimeout(resolve, options.waitMs || 1500); })
      ]);
      user = options.firebaseUser || currentFirebaseUser();
      existing = getToken();
      if(existing && (!user || tokenBelongsToUser(user) || isLoggedIn())) return existing;
    }

    if(user){
      try{
        var result = await syncFirebaseUserWithBackend(user, options.force ? { force: true } : null);
        return (result && result.authToken) || getToken() || '';
      }catch(_){
        return getToken() || '';
      }
    }

    return getToken() || '';
  }

  global.tyAuthSession = {
    TOKEN_KEY: TOKEN_KEY,
    AUTH_EVENT: AUTH_EVENT,
    getToken: getToken,
    getProfile: getProfile,
    isLoggedIn: isLoggedIn,
    currentFirebaseUser: currentFirebaseUser,
    tokenBelongsToUser: tokenBelongsToUser,
    persistSession: persistSession,
    clearSession: clearSession,
    syncFirebaseUserWithBackend: syncFirebaseUserWithBackend,
    ensureToken: ensureToken,
    rememberLoginRedirect: rememberLoginRedirect,
    goToLogin: goToLogin,
    broadcastAuth: broadcastAuth
  };

  global.tySyncFirebaseUserWithBackend = syncFirebaseUserWithBackend;
})(window);
