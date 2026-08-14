(function(){
'use strict';
if(window.TYHotelSearchLoader && window.TYHotelSearchLoader.__tyCanonical) return;

function ensureCss(){
  if(document.getElementById('tyHotelOnlyLoaderCss')) return;
  const st=document.createElement('style');
  st.id='tyHotelOnlyLoaderCss';
  st.textContent=
  '.tyh-loading-lock{overflow:hidden!important}'+
  '.tyh-hotel-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(7,29,73,.82);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}'+
  '.tyh-hotel-loader-box{width:min(92vw,360px);min-height:260px;border-radius:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);box-shadow:0 22px 70px rgba(0,0,0,.22)}'+
  '.tyh-hotel-spin{width:92px;height:92px;border-radius:50%;border:7px solid rgba(255,255,255,.22);border-top-color:#ffffff;border-right-color:#eb814b;animation:tyhHotelSpin .9s linear infinite}'+
  '.tyh-hotel-loader-text{margin:0;color:#fff;font-size:20px;line-height:1.35;font-weight:900;letter-spacing:.01em}'+
  '@keyframes tyhHotelSpin{to{transform:rotate(360deg)}}'+
  '@media(max-width:640px){.tyh-hotel-loader{padding:18px}.tyh-hotel-loader-box{width:92vw;min-height:240px;border-radius:24px;gap:20px}.tyh-hotel-spin{width:86px;height:86px;border-width:6px}.tyh-hotel-loader-text{font-size:18px;max-width:260px}}';
  (document.head||document.documentElement).appendChild(st);
}
function mount(el){
  const host=document.body||document.documentElement;
  if(el.parentNode!==host) host.appendChild(el);
}
function show(msg, hideText){
  try{ if(window.TravelYaraaLoader && typeof window.TravelYaraaLoader.hide==='function') window.TravelYaraaLoader.hide(); }catch(e){}
  ensureCss();
  let el=document.getElementById('tyHotelOnlyLoader');
  if(!el){
    el=document.createElement('div');
    el.id='tyHotelOnlyLoader';
    el.className='tyh-hotel-loader';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.innerHTML='<div class="tyh-hotel-loader-box"><div class="tyh-hotel-spin" aria-hidden="true"></div><p class="tyh-hotel-loader-text"></p></div>';
  }
  mount(el);
  const t=el.querySelector('.tyh-hotel-loader-text');
  if(t){ t.textContent=hideText ? '' : (msg || 'Finding the best hotels for you...'); t.hidden=!!hideText; }
  el.style.display='flex';
  (document.body||document.documentElement).classList.add('tyh-loading-lock');
}
function hide(){
  const el=document.getElementById('tyHotelOnlyLoader');
  if(el) el.style.display='none';
  if(document.body) document.body.classList.remove('tyh-loading-lock');
  document.documentElement.classList.remove('tyh-loading-lock');
  try{ if(window.TravelYaraaLoader && typeof window.TravelYaraaLoader.hide==='function') window.TravelYaraaLoader.hide(); }catch(e){}
}

window.TYHotelSearchLoader={show:show,hide:hide,__tyCanonical:true};

if(/\/pages\/results\/hotels\.html$/i.test(String(location.pathname||''))){
  show('Finding the best hotels for you...');
}
})();
