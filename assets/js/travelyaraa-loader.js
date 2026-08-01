/* TravelYaraa Flight Search Loader
   Full replacement for existing loader JS.
   It keeps the loader connected to the same window.TravelYaraaLoader API.
   It does not show for non-flight services unless explicitly forced.
*/
(function(){
  "use strict";

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
    el.className = "ty-results-flight-loader";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<div class="ty-results-flight-loader__box">' +
        '<div class="ty-results-flight-loader__ring" aria-hidden="true">' +
          '<span class="ty-results-flight-loader__plane"></span>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    return el;
  }

  function show(options){
    options = options || {};
    if(!isFlightContext(options)) return false;

    const el = ensureLoader();
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
    showFlight: function(){
      return show({service:"flight", force:true});
    }
  };
})();
