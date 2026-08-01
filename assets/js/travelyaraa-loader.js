/* TravelYaraa Flight Search Loader
   Full replacement for existing loader JS.
   It keeps the loader connected to the same window.TravelYaraaLoader API.
   It does not show for non-flight services unless explicitly forced.
*/
(function(){
  "use strict";

  const DEFAULT_TEXT = "Please Wait, We are searching for the flights on this route";
  const LOADER_ID = "tyFlightApiLoader";

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
    if(el) return el;

    el = document.createElement("div");
    el.id = LOADER_ID;
    el.className = "ty-flight-api-loader";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<div class="ty-flight-api-loader__box">' +
        '<div class="ty-flight-api-loader__ring" aria-hidden="true">' +
          '<span class="ty-flight-api-loader__plane"></span>' +
        '</div>' +
        '<p class="ty-flight-api-loader__text">' + DEFAULT_TEXT + '</p>' +
      '</div>';

    document.body.appendChild(el);
    return el;
  }

  function setText(el, options){
    const node = el.querySelector(".ty-flight-api-loader__text");
    if(!node) return;
    if(options && options.hideText === true){
      node.textContent = "";
      node.hidden = true;
      return;
    }
    node.hidden = false;
    const hasText = options && (Object.prototype.hasOwnProperty.call(options, "text") || Object.prototype.hasOwnProperty.call(options, "message"));
    const text = hasText ? (options.text || options.message || "") : DEFAULT_TEXT;
    node.textContent = text;
    node.hidden = !text;
  }

  function show(options){
    options = options || {};
    if(!isFlightContext(options)) return false;

    const el = ensureLoader();
    setText(el, options);
    el.classList.add("is-active");
    document.documentElement.classList.add("ty-flight-loader-active");
    document.body.classList.add("ty-flight-loader-active");
    return true;
  }

  function hide(){
    const el = document.getElementById(LOADER_ID);
    if(el) el.classList.remove("is-active");
    document.documentElement.classList.remove("ty-flight-loader-active");
    document.body.classList.remove("ty-flight-loader-active");
    return true;
  }

  function remove(){
    const el = document.getElementById(LOADER_ID);
    if(el) el.remove();
    document.documentElement.classList.remove("ty-flight-loader-active");
    document.body.classList.remove("ty-flight-loader-active");
    return true;
  }

  window.TravelYaraaLoader = {
    show: show,
    hide: hide,
    remove: remove,
    ensure: ensureLoader,
    showFlight: function(text){
      return show({service:"flight", text:text || DEFAULT_TEXT, force:true});
    }
  };
})();
