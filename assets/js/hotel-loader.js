(function(){
'use strict';
/**
 * Hotel loader adapter — uses the approved TravelYaraaLoader (dotted spinner).
 * Does not invent a second spinner UI. Requires travelyaraa-loader.js + CSS on the page.
 */
if(window.TYHotelSearchLoader && window.TYHotelSearchLoader.__tyCanonical){
  return;
}

var DEFAULT_TEXT = 'Finding the best hotels for you...';

function show(msg, hideText){
  if(!(window.TravelYaraaLoader && typeof window.TravelYaraaLoader.show === 'function')){
    return;
  }
  var label = hideText ? '' : (msg || DEFAULT_TEXT);
  window.TravelYaraaLoader.show({
    force: true,
    service: 'hotel',
    text: label,
    hideText: !!hideText || !label
  });
}

function hide(){
  if(window.TravelYaraaLoader && typeof window.TravelYaraaLoader.hide === 'function'){
    // Hotel must always fully dismiss — not held by flight-search intermediate hides.
    window.TravelYaraaLoader.hide({ final: true });
  }
}

window.TYHotelSearchLoader = { show: show, hide: hide, __tyCanonical: true };

(function autoShowResultsFirstPaint(){
  var path = String(location.pathname || '');
  if(!/\/pages\/results\/hotels\.html$/i.test(path)) return;
  var step = String(new URLSearchParams(location.search).get('step') || 'results');
  if(step !== 'results') return;
  show(DEFAULT_TEXT);
})();
})();
