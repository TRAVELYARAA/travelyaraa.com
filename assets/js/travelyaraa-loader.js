/* TravelYaraa Flight Search Loader
   Full replacement for existing loader JS.
   It keeps the loader connected to the same window.TravelYaraaLoader API.
   It does not show for non-flight services unless explicitly forced.
*/
(function(){
  "use strict";

  const DEFAULT_TEXT = "Please Wait, We are searching for the flights on this route";
  const LOADER_ID = "tyFlightApiLoader";
  const MARKUP_VERSION = "dotSpin3";
  const HOLD_KEY = "ty_flight_loader_hold";
  const LOADING_KEY = "ty_flight_search_loading";

  const LOADER_MARKUP =
    '<div class="ty-results-flight-loader__box" data-ty-loader-v="' + MARKUP_VERSION + '">' +
      '<div class="ty-results-flight-loader__spinner" aria-hidden="true">' +
        '<i></i><i></i><i></i><i></i><i></i><i></i>' +
        '<i></i><i></i><i></i><i></i><i></i><i></i>' +
      '</div>' +
      '<p class="ty-results-flight-loader__text">' + DEFAULT_TEXT + '</p>' +
    '</div>';

  let isVisible = false;

  function setFlag(key, on){
    try{
      if(on) sessionStorage.setItem(key, "1");
      else sessionStorage.removeItem(key);
    }catch(e){}
  }

  function getFlag(key){
    try{ return sessionStorage.getItem(key) === "1"; }catch(e){ return false; }
  }

  function isFlightSearchLoading(){
    return getFlag(LOADING_KEY) || getFlag(HOLD_KEY);
  }

  function isFlightResultsPath(){
    const path = String(location.pathname || "").toLowerCase();
    return path.includes("/flights") || path.includes("flight-results");
  }

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
      const ver = el.querySelector("[data-ty-loader-v]");
      /* Never remount while visible — remounting restarts the spinner. */
      if((!ver || ver.getAttribute("data-ty-loader-v") !== MARKUP_VERSION) && !el.classList.contains("is-active")){
        el.innerHTML = LOADER_MARKUP;
      }
      return el;
    }

    el = document.createElement("div");
    el.id = LOADER_ID;
    el.className = "ty-results-flight-loader";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = LOADER_MARKUP;
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

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
    if(document.body) document.body.classList.add("ty-flight-loader-active");
  }

  function unlockFlightScroll(){
    document.documentElement.classList.remove("ty-flight-loader-active");
    if(document.body) document.body.classList.remove("ty-flight-loader-active");
  }

  function applyHide(){
    setFlag(HOLD_KEY, false);
    setFlag(LOADING_KEY, false);
    const el = document.getElementById(LOADER_ID);
    if(el) el.classList.remove("is-active");
    isVisible = false;
    unlockFlightScroll();
  }

  function show(options){
    options = options || {};
    if(!isFlightContext(options)) return false;

    setFlag(HOLD_KEY, true);
    setFlag(LOADING_KEY, true);

    const mount = function(){
      const el = ensureLoader();
      setText(el, options);
      lockFlightScroll();

      /* Already up: keep the same DOM/animation — no remount / restart. */
      if(isVisible && el.classList.contains("is-active")) return true;

      el.classList.add("is-active");
      isVisible = true;
      return true;
    };

    if(document.body) return mount();
    document.addEventListener("DOMContentLoaded", mount, { once: true });
    return true;
  }

  /* Home page arms loading without mounting — results page mounts once. */
  function armFlightSearch(){
    setFlag(HOLD_KEY, true);
    setFlag(LOADING_KEY, true);
    return true;
  }

  /*
    Intermediate hide() calls are ignored while a flight search is loading.
    Callers must pass { final: true } only when results/error/timeout/navigation
    is fully ready (or back-forward / non-search cancel).
  */
  function hide(options){
    options = options || {};
    const isFinal = options.final === true || options.force === true || options.done === true;
    if(isFlightSearchLoading() && !isFinal){
      return false;
    }
    applyHide();
    return true;
  }

  function remove(options){
    options = options || {};
    const isFinal = options.final === true || options.force === true || options.done === true;
    if(isFlightSearchLoading() && !isFinal){
      return false;
    }
    applyHide();
    const el = document.getElementById(LOADER_ID);
    if(el) el.remove();
    return true;
  }

  /* Restore continuous loader across home → results navigation. */
  function bootFromHold(){
    if(!getFlag(HOLD_KEY) && !getFlag(LOADING_KEY)) return;
    if(!isFlightResultsPath()) return;
    show({ service: "flight", force: true });
  }

  if(document.body) bootFromHold();
  else document.addEventListener("DOMContentLoaded", bootFromHold, { once: true });

  window.TravelYaraaLoader = {
    show: show,
    hide: hide,
    remove: remove,
    ensure: ensureLoader,
    isLoading: isFlightSearchLoading,
    armFlightSearch: armFlightSearch,
    showFlight: function(){
      return show({ service: "flight", force: true });
    }
  };
})();
