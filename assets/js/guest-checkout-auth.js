(function(){
  "use strict";

  if (window.TravelYaraaGuestCheckoutAuth) return;

  const API_BASE = window.API_BASE || "";
  const STORE_TOKEN = "ty_user_auth_token";
  const STORE_USER = "ty_user_profile";
  const STORE_GUEST = "ty_last_guest_otp";

  function esc(v){return String(v||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
  function cleanPhone(v){return String(v||"").replace(/\D/g,"");}
  function emailFromPayload(p){
    return p?.details?.contact?.email || p?.details?.contactEmail || p?.details?.email || p?.email || p?.customerEmail || p?.passenger?.email || "";
  }
  function phoneFromPayload(p){
    return p?.details?.contact?.phone || p?.details?.contactPhone || p?.details?.phone || p?.phone || p?.mobile || p?.customerPhone || p?.passenger?.mobile || "";
  }
  function nameFromPayload(p){
    const c = p?.details?.contact || p?.contact || p?.passenger || {};
    return c.name || [c.title, c.firstName, c.lastName].filter(Boolean).join(" ");
  }

  function modal(){
    let el=document.getElementById("tyGuestOtpModal");
    if(el) return el;
    el=document.createElement("div");
    el.id="tyGuestOtpModal";
    el.innerHTML='<div class="tygo-backdrop"></div><div class="tygo-card"><button class="tygo-x" type="button">×</button><h2>Verify booking contact</h2><p class="tygo-sub">Enter OTP sent to your email/mobile to continue to secure payment.</p><div class="tygo-sent"></div><input class="tygo-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 digit OTP"><button class="tygo-primary" type="button">Verify & Continue</button><button class="tygo-link" type="button">Resend OTP</button><p class="tygo-msg"></p></div>';
    const css=document.createElement("style");
    css.id="tyGuestOtpStyle";
    css.textContent='.tygo-backdrop{position:fixed;inset:0;background:rgba(7,29,73,.48);z-index:999998}.tygo-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:999999;width:min(430px,calc(100% - 28px));background:#fff;border-radius:24px;padding:24px;box-shadow:0 30px 90px rgba(7,29,73,.28);font-family:Inter,system-ui,sans-serif;color:#071d49}.tygo-x{position:absolute;right:14px;top:12px;width:34px;height:34px;border-radius:12px;border:1px solid #e5edf7;background:#fff;font-size:22px}.tygo-card h2{margin:0 34px 8px 0;font-size:23px}.tygo-sub{margin:0 0 12px;color:#667085;font-weight:750;line-height:1.45}.tygo-sent{font-size:12px;color:#0062e3;font-weight:900;margin-bottom:10px}.tygo-otp{width:100%;height:52px;border:1px solid #dbe7f5;border-radius:14px;padding:0 16px;font-size:22px;font-weight:900;letter-spacing:8px;text-align:center;outline:none}.tygo-primary{width:100%;height:50px;border:0;border-radius:999px;background:#0062e3;color:#fff;font-weight:950;font-size:15px;margin-top:13px}.tygo-link{width:100%;border:0;background:#fff;color:#0062e3;font-weight:900;margin-top:12px}.tygo-msg{min-height:18px;color:#b42318;font-weight:800;font-size:13px;margin:10px 0 0}@media(max-width:520px){.tygo-card{border-radius:20px;padding:20px}.tygo-card h2{font-size:20px}}';
    document.head.appendChild(css);
    document.body.appendChild(el);
    return el;
  }
  function closeModal(){ const el=document.getElementById("tyGuestOtpModal"); if(el) el.remove(); }

  async function post(path, body, token){
    const headers={"Content-Type":"application/json","Accept":"application/json"};
    if(token) headers.Authorization="Bearer "+token;
    const res=await fetch(API_BASE+path,{method:"POST",headers,body:JSON.stringify(body),cache:"no-store"});
    const data=await res.json().catch(()=>({}));
    if(!res.ok || data.success===false) throw new Error(data.message||data.error||("HTTP "+res.status));
    return data;
  }

  async function startOtp(payload){
    const body=Object.assign({}, payload || {}, {
      email: emailFromPayload(payload),
      phone: phoneFromPayload(payload),
      name: nameFromPayload(payload),
      payload
    });
    if(!body.email && !cleanPhone(body.phone)) throw new Error("Please enter contact email or mobile number before payment.");
    const data=await post("/api/bookings/guest-auth/start-otp", body);
    sessionStorage.setItem(STORE_GUEST, JSON.stringify({otpSessionId:data.otpSessionId,guestSessionId:data.guestSessionId, payload}));
    return data;
  }

  async function verifyOtp(otp){
    const saved=JSON.parse(sessionStorage.getItem(STORE_GUEST)||"{}");
    const data=await post("/api/bookings/guest-auth/verify-otp",{otpSessionId:saved.otpSessionId,guestSessionId:saved.guestSessionId,otp});
    if(data.authToken) localStorage.setItem(STORE_TOKEN, data.authToken);
    if(data.user) localStorage.setItem(STORE_USER, JSON.stringify(data.user));
    return data;
  }

  async function requireOtpBeforePayment(payload, options){
    options=options||{};
    const existing=localStorage.getItem(STORE_TOKEN);
    if(existing && !options.force) return {authToken:existing, user: JSON.parse(localStorage.getItem(STORE_USER)||"{}"), reused:true};

    const first=await startOtp(payload);
    const el=modal();
    const sent=el.querySelector(".tygo-sent");
    const msg=el.querySelector(".tygo-msg");
    const otpInput=el.querySelector(".tygo-otp");
    sent.textContent="Sent to: "+(first.sent||[]).map(x=>x.to).join(", ");
    msg.textContent="";
    otpInput.value="";
    otpInput.focus();

    return await new Promise((resolve,reject)=>{
      let active=true;
      function done(v){ if(!active) return; active=false; closeModal(); resolve(v); }
      function fail(e){ if(!active) return; active=false; closeModal(); reject(e); }
      el.querySelector(".tygo-x").onclick=function(){ fail(new Error("OTP verification cancelled.")); };
      el.querySelector(".tygo-primary").onclick=async function(){
        try{
          msg.textContent="Verifying...";
          const data=await verifyOtp(otpInput.value);
          done(data);
        }catch(e){ msg.textContent=e.message||"OTP verification failed."; }
      };
      el.querySelector(".tygo-link").onclick=async function(){
        try{
          msg.textContent="Sending new OTP...";
          const data=await startOtp(payload);
          sent.textContent="Sent to: "+(data.sent||[]).map(x=>x.to).join(", ");
          msg.textContent="New OTP sent.";
        }catch(e){ msg.textContent=e.message||"Could not resend OTP."; }
      };
    });
  }

  function authToken(){ return localStorage.getItem(STORE_TOKEN)||""; }
  function authHeaders(){ const t=authToken(); return t ? {Authorization:"Bearer "+t} : {}; }

  window.TravelYaraaGuestCheckoutAuth = {
    startOtp,
    verifyOtp,
    requireOtpBeforePayment,
    authToken,
    authHeaders,
    emailFromPayload,
    phoneFromPayload
  };
})();