(function(){
'use strict';
if(window.TYHotelSearchLoader && window.TYHotelSearchLoader.__tyCanonical){
  return;
}

var OVERLAY_ID = 'tyHotelOnlyLoader';
var CSS_ID = 'tyHotelOnlyLoaderCss';
var TEXT_CLASS = 'tyh-hotel-loader-text';

function ensureCss(){
  if(document.getElementById(CSS_ID)) return;
  var st = document.createElement('style');
  st.id = CSS_ID;
  st.textContent =
    '.tyh-loading-lock{overflow:hidden!important}' +
    '#' + OVERLAY_ID + ',.tyh-hotel-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(7,29,73,.82);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}' +
    '#' + OVERLAY_ID + ' .tyh-hotel-loader-box{width:min(92vw,360px);min-height:220px;border-radius:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);box-shadow:0 22px 70px rgba(0,0,0,.22)}' +
    '#' + OVERLAY_ID + ' .tyh-hotel-spin{width:84px;height:84px;border-radius:50%;border:7px solid rgba(255,255,255,.22);border-top-color:#ffffff;border-right-color:#eb814b;animation:tyhHotelSpin .9s linear infinite;flex:0 0 auto}' +
    '#' + OVERLAY_ID + ' .' + TEXT_CLASS + '{margin:0;color:#fff;font-size:18px;line-height:1.35;font-weight:800;letter-spacing:.01em;max-width:260px}' +
    '#' + OVERLAY_ID + ' .' + TEXT_CLASS + ':empty{display:none}' +
    '#' + OVERLAY_ID + '[style*="none"]{pointer-events:none}' +
    '@keyframes tyhHotelSpin{to{transform:rotate(360deg)}}' +
    '@media(max-width:640px){#' + OVERLAY_ID + '{padding:18px}#' + OVERLAY_ID + ' .tyh-hotel-loader-box{width:92vw;min-height:200px;border-radius:24px}#' + OVERLAY_ID + ' .tyh-hotel-spin{width:76px;height:76px;border-width:6px}#' + OVERLAY_ID + ' .' + TEXT_CLASS + '{font-size:16px}}';
  (document.head || document.documentElement).appendChild(st);
}

function hideFlightLoader(){
  try{ if(window.TravelYaraaLoader && typeof window.TravelYaraaLoader.hide === 'function') window.TravelYaraaLoader.hide(); }catch(e){}
}

function pruneDuplicates(keep){
  var nodes = document.querySelectorAll('#' + OVERLAY_ID + ', .tyh-hotel-loader');
  for(var i = 0; i < nodes.length; i++){
    if(keep && nodes[i] === keep) continue;
    if(nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
  }
}

function overlay(){
  ensureCss();
  var el = document.getElementById(OVERLAY_ID);
  if(!el){
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'tyh-hotel-loader';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    var box = document.createElement('div');
    box.className = 'tyh-hotel-loader-box';
    var spin = document.createElement('div');
    spin.className = 'tyh-hotel-spin';
    spin.setAttribute('aria-hidden', 'true');
    var text = document.createElement('p');
    text.className = TEXT_CLASS;
    box.appendChild(spin);
    box.appendChild(text);
    el.appendChild(box);
  } else {
    var texts = el.querySelectorAll('.' + TEXT_CLASS);
    for(var i = 1; i < texts.length; i++){
      if(texts[i].parentNode) texts[i].parentNode.removeChild(texts[i]);
    }
    if(!el.querySelector('.' + TEXT_CLASS)){
      var p = document.createElement('p');
      p.className = TEXT_CLASS;
      var boxEl = el.querySelector('.tyh-hotel-loader-box') || el;
      boxEl.appendChild(p);
    }
  }
  var host = document.body || document.documentElement;
  if(el.parentNode !== host) host.appendChild(el);
  pruneDuplicates(el);
  return el;
}

function show(msg, hideText){
  hideFlightLoader();
  var el = overlay();
  var t = el.querySelector('.' + TEXT_CLASS);
  var label = hideText ? '' : (msg || 'Finding the best hotels for you...');
  if(t){
    t.textContent = label;
    t.hidden = !label;
  }
  el.setAttribute('aria-label', label || 'Loading hotels');
  el.style.display = 'flex';
  (document.body || document.documentElement).classList.add('tyh-loading-lock');
}

function hide(){
  var el = document.getElementById(OVERLAY_ID);
  if(el){
    el.style.display = 'none';
    var t = el.querySelector('.' + TEXT_CLASS);
    if(t) t.textContent = '';
  }
  if(document.body) document.body.classList.remove('tyh-loading-lock');
  document.documentElement.classList.remove('tyh-loading-lock');
  hideFlightLoader();
}

window.TYHotelSearchLoader = { show: show, hide: hide, __tyCanonical: true };

(function autoShowResultsFirstPaint(){
  var path = String(location.pathname || '');
  if(!/\/pages\/results\/hotels\.html$/i.test(path)) return;
  var step = String(new URLSearchParams(location.search).get('step') || 'results');
  if(step !== 'results') return;
  show('Finding the best hotels for you...');
})();
})();
