(function(global){
  'use strict';

  var overlay = null;

  function ensureOverlay(){
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ty-loader-overlay';
    overlay.id = 'tyLoaderOverlay';
    overlay.innerHTML = '<div class="ty-loader-card"><div class="ty-loader-spinner" aria-hidden="true"></div><p class="ty-loader-text" id="tyLoaderText">Please wait…</p></div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function show(message){
    var el = ensureOverlay();
    var text = el.querySelector('#tyLoaderText');
    if(text) text.textContent = message || 'Please wait…';
    el.classList.add('active');
    el.setAttribute('aria-busy', 'true');
  }

  function hide(){
    if(!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-busy', 'false');
  }

  global.TravelYaraaLoader = { show: show, hide: hide };
})(window);
