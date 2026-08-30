/* TravelYaraa Flight Search Loader
   Full replacement for existing loader JS.
   It keeps the loader connected to the same window.TravelYaraaLoader API.
   It does not show for non-flight services unless explicitly forced.
*/
(function(){
  "use strict";

  const DEFAULT_TEXT = "Please Wait, We are searching for the flights on this route";
  const LOADER_ID = "tyFlightApiLoader";

  const ORBIT_MARKUP =
    '<div class="ty-results-flight-loader__box">' +
      '<div class="ty-results-flight-loader__orbit" aria-hidden="true">' +
        '<span class="ty-results-flight-loader__ring"></span>' +
        '<span class="ty-results-flight-loader__orbit-arm">' +
          '<span class="ty-results-flight-loader__plane">' +
            '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
              '<path fill="#ffffff" d="M32 3.5c.7 0 1.3.4 1.5 1L39 24l18.2 6.2c1.3.4 1.3 1.7 0 2.1L39 38.5l-5.5 19.5c-.3.9-1.2 1.4-2 1.4s-1.7-.5-2-1.4L24 38.5 5.8 32.3c-1.3-.4-1.3-1.7 0-2.1L24 24l5.5-19.5c.2-.6.8-1 1.5-1z"/>' +
              '<path fill="#0062E3" d="M32 18.5l8.2 2.8-8.2 2.8-8.2-2.8z"/>' +
            '</svg>' +
          '</span>' +
        '</span>' +
      '</div>' +
      '<p class="ty-results-flight-loader__text">' + DEFAULT_TEXT + '</p>' +
    '</div>';

  function isFlightContext(options){
    if(options && options.force === true) return true;
    const service = String((options && (options.service || options.type || options.module)) || "").toLowerCase();
    const text = String((options && (options.text || options.message)) || "").toLowerCase();
    const path = String(location.pathname || "").toLowerCase();

    if(service && service !== "flight" && service !== "flights" && service !== "air") return false;
    if(service === "flight" || service === "flights" || service === "air") return true;
    if(text.includes("flight") || text.includes("flights")) return true;
    if(path.includes("/flights") || path.includes("flight-results")) return true;

    const activeTab = document.querySelector('[data-service="flight"].active,[data-tab="flight"].active,[data-v5-tab="flight"].active,.active[data-service="flights"]');
    const flightForm = document.querySelector('#flightForm,[data-v5-panel="flight"],#flightSearchForm,.flight-search-form');
    return !!(activeTab || flightForm);
  }

  function ensureLoader(){
    let el = document.getElementById(LOADER_ID);
    if(el){
      /* Rebuild if a stale/pre-orbit markup shell is still in the DOM. */
      if(!el.querySelector(".ty-results-flight-loader__orbit-arm")){
        el.innerHTML = ORBIT_MARKUP;
      }
      return el;
    }

    el = document.createElement("div");
    el.id = LOADER_ID;
    el.className = "ty-results-flight-loader";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = ORBIT_MARKUP;
    document.body.appendChild(el);
    return el;
  }

  /* Never let a non-string reach textContent: that is what produced the
     literal "[object Object]" on the results page. */
  function readableText(value, depth){
    if(typeof value === "string") return value.trim();
    if(typeof value === "number" || typeof value === "boolean") return String(value);
    if(!value || typeof value !== "object") return "";
    if((depth || 0) >= 2) return "";
    if(value instanceof Error) return readableText(value.message, (depth || 0) + 1);
    const message = readableText(value.message, (depth || 0) + 1);
    if(message) return message;
    return readableText(value.code, (depth || 0) + 1);
  }

  function setText(el, options){
    const node = el.querySelector(".ty-results-flight-loader__text");
    if(!node) return;
    if(options && options.hideText === true){
      node.textContent = "";
      node.hidden = true;
      return;
    }
    node.hidden = false;
    const hasText = options && (Object.prototype.hasOwnProperty.call(options, "text") || Object.prototype.hasOwnProperty.call(options, "message"));
    const text = (hasText ? readableText(options.text) || readableText(options.message) : "") || DEFAULT_TEXT;
    node.textContent = text;
    node.hidden = !text;
  }

  function lockFlightScroll(){
    document.documentElement.classList.add("ty-flight-loader-active");
    document.body.classList.add("ty-flight-loader-active");
  }

  function unlockFlightScroll(){
    document.documentElement.classList.remove("ty-flight-loader-active");
    document.body.classList.remove("ty-flight-loader-active");
  }

  function show(options){
    options = options || {};
    if(!isFlightContext(options)) return false;

    const el = ensureLoader();
    setText(el, options);
    el.classList.add("is-active");
    lockFlightScroll();
    return true;
  }

  function hide(){
    const el = document.getElementById(LOADER_ID);
    if(el) el.classList.remove("is-active");
    unlockFlightScroll();
    return true;
  }

  function remove(){
    const el = document.getElementById(LOADER_ID);
    if(el) el.remove();
    unlockFlightScroll();
    return true;
  }

  window.TravelYaraaLoader = {
    show: show,
    hide: hide,
    remove: remove,
    ensure: ensureLoader,
    showFlight: function(){
      return show({service:"flight", force:true});
    }
  };
})();
