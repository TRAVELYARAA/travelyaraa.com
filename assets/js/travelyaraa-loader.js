/* TravelYaraa Flight Search Loader
   Full replacement for existing loader JS.
   It keeps the loader connected to the same window.TravelYaraaLoader API.
   It does not show for non-flight services unless explicitly forced.
*/
(function(){
  "use strict";

  const DEFAULT_TEXT = "Please Wait, We are searching for the flights on this route";
  const LOADER_ID = "tyFlightApiLoader";
  const MARKUP_VERSION = "orbitTrail4";

  const ORBIT = {
    cx: 170,
    cy: 170,
    radius: 118,
    duration: 7500,
    trailArc: Math.PI,
    spawnEvery: 52,
    dotLife: 3750,
    maxDots: 48,
    seedDots: 28
  };

  const COLORS = {
    orange: "#eb814b",
    blue: "#0062E3"
  };

  const trailState = {
    raf: 0,
    lastSpawn: 0,
    sky: null
  };

  const LOADER_MARKUP =
    '<div class="ty-results-flight-loader__box" data-ty-loader-v="' + MARKUP_VERSION + '">' +
      '<div class="ty-results-flight-loader__sky" aria-hidden="true">' +
        '<div class="ty-results-flight-loader__trail" aria-hidden="true"></div>' +
        '<span class="ty-results-flight-loader__carrier">' +
          '<span class="ty-results-flight-loader__plane">' +
            '<svg viewBox="0 0 240 88" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
              '<path fill="#ffffff" d="M224 44 L206 34 L206 54 Z"/>' +
              '<path fill="#ffffff" d="M206 36 C188 30, 64 30, 48 36 C40 39, 40 49, 48 52 C64 58, 188 58, 206 52 C214 49, 214 39, 206 36 Z"/>' +
              '<path fill="#ffffff" d="M104 44 L148 8 L166 14 L126 44 L166 74 L148 80 L104 44 Z"/>' +
              '<path fill="#ffffff" d="M46 44 L30 30 L38 44 L30 58 Z"/>' +
              '<path fill="#ffffff" d="M52 44 L38 36 L38 40 L52 44 Z"/>' +
              '<path fill="#ffffff" d="M52 44 L38 48 L38 52 L52 44 Z"/>' +
              '<ellipse cx="128" cy="24" rx="8" ry="5" fill="#0062E3"/>' +
              '<ellipse cx="128" cy="64" rx="8" ry="5" fill="#0062E3"/>' +
              '<path fill="#0062E3" d="M196 40 L210 44 L196 48 Z" opacity=".5"/>' +
            '</svg>' +
          '</span>' +
        '</span>' +
      '</div>' +
      '<p class="ty-results-flight-loader__text">' + DEFAULT_TEXT + '</p>' +
    '</div>';

  function fallbackAngle(now){
    const t = now % ORBIT.duration;
    return (t / ORBIT.duration) * Math.PI * 2;
  }

  function readPlaneAngle(skyEl){
    const plane = skyEl.querySelector(".ty-results-flight-loader__plane");
    if(!plane) return fallbackAngle(performance.now());
    const skyRect = skyEl.getBoundingClientRect();
    const planeRect = plane.getBoundingClientRect();
    const x = planeRect.left + planeRect.width / 2 - skyRect.left;
    const y = planeRect.top + planeRect.height / 2 - skyRect.top;
    return Math.atan2(x - ORBIT.cx, -(y - ORBIT.cy));
  }

  function orbitPoint(angle){
    return {
      x: ORBIT.cx + ORBIT.radius * Math.sin(angle),
      y: ORBIT.cy - ORBIT.radius * Math.cos(angle)
    };
  }

  function angleBehind(current, dotAngle){
    let diff = current - dotAngle;
    while(diff < 0) diff += Math.PI * 2;
    while(diff >= Math.PI * 2) diff -= Math.PI * 2;
    return diff;
  }

  function styleTrailDot(dot, now, planeAngle){
    const born = Number(dot.dataset.born);
    const dotAngle = Number(dot.dataset.angle);
    const age = now - born;
    const behind = angleBehind(planeAngle, dotAngle);

    if(age > ORBIT.dotLife || behind > ORBIT.trailArc){
      dot.remove();
      return false;
    }

    const life = 1 - age / ORBIT.dotLife;
    const pos = orbitPoint(dotAngle);
    const size = 3 + life * 9;
    const opacity = Math.min(1, 0.18 + life * 0.92);
    const orangeMix = Math.max(0, 1 - age / (ORBIT.dotLife * 0.28));
    const color = orangeMix > 0.4 ? COLORS.orange : COLORS.blue;
    const glow = orangeMix > 0.4
      ? "0 0 12px rgba(235,129,75,.9), 0 0 4px rgba(235,129,75,.6)"
      : "0 0 10px rgba(0,98,227,.65), 0 0 3px rgba(0,98,227,.45)";

    dot.style.left = pos.x + "px";
    dot.style.top = pos.y + "px";
    dot.style.width = size + "px";
    dot.style.height = size + "px";
    dot.style.opacity = String(opacity);
    dot.style.background = color;
    dot.style.boxShadow = glow;
    return true;
  }

  function seedTrail(trailEl, planeAngle, now){
    trailEl.innerHTML = "";
    for(let i = 0; i < ORBIT.seedDots; i++){
      const t = i / ORBIT.seedDots;
      const behind = t * ORBIT.trailArc;
      const dot = document.createElement("i");
      dot.className = "ty-results-flight-loader__trail-dot";
      dot.dataset.born = String(now - t * ORBIT.dotLife);
      dot.dataset.angle = String(planeAngle - behind);
      trailEl.appendChild(dot);
    }
  }

  function stopOrbitTrail(){
    if(trailState.raf){
      cancelAnimationFrame(trailState.raf);
      trailState.raf = 0;
    }
    if(trailState.sky){
      const trail = trailState.sky.querySelector(".ty-results-flight-loader__trail");
      if(trail) trail.innerHTML = "";
      trailState.sky = null;
    }
    trailState.lastSpawn = 0;
  }

  function startOrbitTrail(skyEl){
    stopOrbitTrail();
    const trailEl = skyEl.querySelector(".ty-results-flight-loader__trail");
    if(!trailEl) return;

    trailState.sky = skyEl;
    trailState.lastSpawn = 0;

    const seedNow = performance.now();
    seedTrail(trailEl, readPlaneAngle(skyEl), seedNow);

    function tick(now){
      if(!trailState.sky || !trailState.sky.isConnected){
        stopOrbitTrail();
        return;
      }
      if(!trailState.sky.closest(".is-active")){
        stopOrbitTrail();
        return;
      }

      const angle = readPlaneAngle(trailState.sky);

      if(!trailState.lastSpawn || now - trailState.lastSpawn >= ORBIT.spawnEvery){
        trailState.lastSpawn = now;
        const dot = document.createElement("i");
        dot.className = "ty-results-flight-loader__trail-dot";
        dot.dataset.born = String(now);
        dot.dataset.angle = String(angle - 0.08);
        trailEl.appendChild(dot);

        while(trailEl.children.length > ORBIT.maxDots){
          trailEl.firstChild.remove();
        }
      }

      trailEl.querySelectorAll(".ty-results-flight-loader__trail-dot").forEach(function(dot){
        styleTrailDot(dot, now, angle);
      });

      trailState.raf = requestAnimationFrame(tick);
    }

    trailState.raf = requestAnimationFrame(tick);
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
      if(!ver || ver.getAttribute("data-ty-loader-v") !== MARKUP_VERSION){
        stopOrbitTrail();
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
    document.body.appendChild(el);
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

    const sky = el.querySelector(".ty-results-flight-loader__sky");
    if(sky) startOrbitTrail(sky);

    return true;
  }

  function hide(){
    const el = document.getElementById(LOADER_ID);
    if(el) el.classList.remove("is-active");
    stopOrbitTrail();
    unlockFlightScroll();
    return true;
  }

  function remove(){
    const el = document.getElementById(LOADER_ID);
    if(el) el.remove();
    stopOrbitTrail();
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
