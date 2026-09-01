/* TravelYaraa Flight Results - booking review policy and promo layout */
(function(){
  "use strict";

  const ROOT = document.getElementById("travelRoot") || document.body;
  const API_BASE = (window.TRAVELYARAA_API_BASE || window.TY_API_BASE || "https://api.travelyaraa.com").replace(/\/$/,"");

  const state = {
    search: readSearch(),
    rawFlights: [],
    flights: [],
    legFlights: {},
    selected: {
      onward: null,
      return: null,
      multicity: {}
    },
    filters: {
      stops: new Set(),
      times: new Set(),
      airlines: new Set(),
      maxPrice: 1000000
    },
    sort: "priceLow",
    selectedOffer: null,
    availableOffers: [],
    offersLoaded: false,
    offersLoading: false,
    selectedAddOns: {},
    reviewCache: {},
    seatMapCache: {},
    activeSeatPassenger: 0,
    activeSeatSegment: "",
    fareDateCache: {},
    fareDateNone: {},
    fareDateLoading: new Set(),
    fareFetchGen: 0,
    lookups: { airports: {}, airlines: {} },
    bookingHoldTimer: null,
    bookingHoldDeadline: 0,
    paymentReviewInProgress: false,
    savedTravellers: [],
    savedTravellersLoaded: false,
    savedTravellersLoading: false,
    savedTravellersAuthError: "",
    selectedSavedTravellerByPassenger: {},
    passportScanByPassenger: {}
  };


  const COUNTRY_CODES = [
    ["AF","Afghanistan","+93"],
    ["AL","Albania","+355"],
    ["DZ","Algeria","+213"],
    ["AD","Andorra","+376"],
    ["AO","Angola","+244"],
    ["AI","Anguilla","+1"],
    ["AG","Antigua and Barbuda","+1"],
    ["AR","Argentina","+54"],
    ["AM","Armenia","+374"],
    ["AW","Aruba","+297"],
    ["AU","Australia","+61"],
    ["AT","Austria","+43"],
    ["AZ","Azerbaijan","+994"],
    ["BS","Bahamas","+1"],
    ["BH","Bahrain","+973"],
    ["BD","Bangladesh","+880"],
    ["BB","Barbados","+1"],
    ["BY","Belarus","+375"],
    ["BE","Belgium","+32"],
    ["BZ","Belize","+501"],
    ["BJ","Benin","+229"],
    ["BM","Bermuda","+1"],
    ["BT","Bhutan","+975"],
    ["BO","Bolivia","+591"],
    ["BA","Bosnia and Herzegovina","+387"],
    ["BW","Botswana","+267"],
    ["BR","Brazil","+55"],
    ["BN","Brunei","+673"],
    ["BG","Bulgaria","+359"],
    ["BF","Burkina Faso","+226"],
    ["BI","Burundi","+257"],
    ["KH","Cambodia","+855"],
    ["CM","Cameroon","+237"],
    ["CA","Canada","+1"],
    ["CV","Cape Verde","+238"],
    ["KY","Cayman Islands","+1"],
    ["CF","Central African Republic","+236"],
    ["TD","Chad","+235"],
    ["CL","Chile","+56"],
    ["CN","China","+86"],
    ["CO","Colombia","+57"],
    ["KM","Comoros","+269"],
    ["CG","Congo","+242"],
    ["CD","Democratic Republic of Congo","+243"],
    ["CR","Costa Rica","+506"],
    ["CI","Cote d'Ivoire","+225"],
    ["HR","Croatia","+385"],
    ["CU","Cuba","+53"],
    ["CY","Cyprus","+357"],
    ["CZ","Czech Republic","+420"],
    ["DK","Denmark","+45"],
    ["DJ","Djibouti","+253"],
    ["DM","Dominica","+1"],
    ["DO","Dominican Republic","+1"],
    ["EC","Ecuador","+593"],
    ["EG","Egypt","+20"],
    ["SV","El Salvador","+503"],
    ["GQ","Equatorial Guinea","+240"],
    ["ER","Eritrea","+291"],
    ["EE","Estonia","+372"],
    ["ET","Ethiopia","+251"],
    ["FJ","Fiji","+679"],
    ["FI","Finland","+358"],
    ["FR","France","+33"],
    ["GF","French Guiana","+594"],
    ["PF","French Polynesia","+689"],
    ["GA","Gabon","+241"],
    ["GM","Gambia","+220"],
    ["GE","Georgia","+995"],
    ["DE","Germany","+49"],
    ["GH","Ghana","+233"],
    ["GI","Gibraltar","+350"],
    ["GR","Greece","+30"],
    ["GL","Greenland","+299"],
    ["GD","Grenada","+1"],
    ["GP","Guadeloupe","+590"],
    ["GU","Guam","+1"],
    ["GT","Guatemala","+502"],
    ["GN","Guinea","+224"],
    ["GW","Guinea-Bissau","+245"],
    ["GY","Guyana","+592"],
    ["HT","Haiti","+509"],
    ["HN","Honduras","+504"],
    ["HK","Hong Kong","+852"],
    ["HU","Hungary","+36"],
    ["IS","Iceland","+354"],
    ["IN","India","+91"],
    ["ID","Indonesia","+62"],
    ["IR","Iran","+98"],
    ["IQ","Iraq","+964"],
    ["IE","Ireland","+353"],
    ["IL","Israel","+972"],
    ["IT","Italy","+39"],
    ["JM","Jamaica","+1"],
    ["JP","Japan","+81"],
    ["JO","Jordan","+962"],
    ["KZ","Kazakhstan","+7"],
    ["KE","Kenya","+254"],
    ["KI","Kiribati","+686"],
    ["KW","Kuwait","+965"],
    ["KG","Kyrgyzstan","+996"],
    ["LA","Laos","+856"],
    ["LV","Latvia","+371"],
    ["LB","Lebanon","+961"],
    ["LS","Lesotho","+266"],
    ["LR","Liberia","+231"],
    ["LY","Libya","+218"],
    ["LI","Liechtenstein","+423"],
    ["LT","Lithuania","+370"],
    ["LU","Luxembourg","+352"],
    ["MO","Macau","+853"],
    ["MK","North Macedonia","+389"],
    ["MG","Madagascar","+261"],
    ["MW","Malawi","+265"],
    ["MY","Malaysia","+60"],
    ["MV","Maldives","+960"],
    ["ML","Mali","+223"],
    ["MT","Malta","+356"],
    ["MH","Marshall Islands","+692"],
    ["MQ","Martinique","+596"],
    ["MR","Mauritania","+222"],
    ["MU","Mauritius","+230"],
    ["YT","Mayotte","+262"],
    ["MX","Mexico","+52"],
    ["FM","Micronesia","+691"],
    ["MD","Moldova","+373"],
    ["MC","Monaco","+377"],
    ["MN","Mongolia","+976"],
    ["ME","Montenegro","+382"],
    ["MS","Montserrat","+1"],
    ["MA","Morocco","+212"],
    ["MZ","Mozambique","+258"],
    ["MM","Myanmar","+95"],
    ["NA","Namibia","+264"],
    ["NR","Nauru","+674"],
    ["NP","Nepal","+977"],
    ["NL","Netherlands","+31"],
    ["NC","New Caledonia","+687"],
    ["NZ","New Zealand","+64"],
    ["NI","Nicaragua","+505"],
    ["NE","Niger","+227"],
    ["NG","Nigeria","+234"],
    ["KP","North Korea","+850"],
    ["NO","Norway","+47"],
    ["OM","Oman","+968"],
    ["PK","Pakistan","+92"],
    ["PW","Palau","+680"],
    ["PS","Palestine","+970"],
    ["PA","Panama","+507"],
    ["PG","Papua New Guinea","+675"],
    ["PY","Paraguay","+595"],
    ["PE","Peru","+51"],
    ["PH","Philippines","+63"],
    ["PL","Poland","+48"],
    ["PT","Portugal","+351"],
    ["PR","Puerto Rico","+1"],
    ["QA","Qatar","+974"],
    ["RE","Reunion","+262"],
    ["RO","Romania","+40"],
    ["RU","Russia","+7"],
    ["RW","Rwanda","+250"],
    ["WS","Samoa","+685"],
    ["SM","San Marino","+378"],
    ["ST","Sao Tome and Principe","+239"],
    ["SA","Saudi Arabia","+966"],
    ["SN","Senegal","+221"],
    ["RS","Serbia","+381"],
    ["SC","Seychelles","+248"],
    ["SL","Sierra Leone","+232"],
    ["SG","Singapore","+65"],
    ["SK","Slovakia","+421"],
    ["SI","Slovenia","+386"],
    ["SB","Solomon Islands","+677"],
    ["SO","Somalia","+252"],
    ["ZA","South Africa","+27"],
    ["KR","South Korea","+82"],
    ["SS","South Sudan","+211"],
    ["ES","Spain","+34"],
    ["LK","Sri Lanka","+94"],
    ["KN","Saint Kitts and Nevis","+1"],
    ["LC","Saint Lucia","+1"],
    ["VC","Saint Vincent and the Grenadines","+1"],
    ["SD","Sudan","+249"],
    ["SR","Suriname","+597"],
    ["SZ","Eswatini","+268"],
    ["SE","Sweden","+46"],
    ["CH","Switzerland","+41"],
    ["SY","Syria","+963"],
    ["TW","Taiwan","+886"],
    ["TJ","Tajikistan","+992"],
    ["TZ","Tanzania","+255"],
    ["TH","Thailand","+66"],
    ["TL","Timor-Leste","+670"],
    ["TG","Togo","+228"],
    ["TO","Tonga","+676"],
    ["TT","Trinidad and Tobago","+1"],
    ["TN","Tunisia","+216"],
    ["TR","Turkey","+90"],
    ["TM","Turkmenistan","+993"],
    ["TC","Turks and Caicos Islands","+1"],
    ["TV","Tuvalu","+688"],
    ["UG","Uganda","+256"],
    ["UA","Ukraine","+380"],
    ["AE","United Arab Emirates","+971"],
    ["GB","United Kingdom","+44"],
    ["US","United States","+1"],
    ["UY","Uruguay","+598"],
    ["UZ","Uzbekistan","+998"],
    ["VU","Vanuatu","+678"],
    ["VA","Vatican City","+379"],
    ["VE","Venezuela","+58"],
    ["VN","Vietnam","+84"],
    ["YE","Yemen","+967"],
    ["ZM","Zambia","+260"],
    ["ZW","Zimbabwe","+263"]
  ];

  const NATIONALITY_COUNTRIES = [
    ["IN","India"],
    ["AF","Afghanistan"],
    ["AL","Albania"],
    ["DZ","Algeria"],
    ["AD","Andorra"],
    ["AO","Angola"],
    ["AI","Anguilla"],
    ["AG","Antigua and Barbuda"],
    ["AR","Argentina"],
    ["AM","Armenia"],
    ["AW","Aruba"],
    ["AU","Australia"],
    ["AT","Austria"],
    ["AZ","Azerbaijan"],
    ["BS","Bahamas"],
    ["BH","Bahrain"],
    ["BD","Bangladesh"],
    ["BB","Barbados"],
    ["BY","Belarus"],
    ["BE","Belgium"],
    ["BZ","Belize"],
    ["BJ","Benin"],
    ["BM","Bermuda"],
    ["BT","Bhutan"],
    ["BO","Bolivia"],
    ["BA","Bosnia and Herzegovina"],
    ["BW","Botswana"],
    ["BR","Brazil"],
    ["BN","Brunei"],
    ["BG","Bulgaria"],
    ["BF","Burkina Faso"],
    ["BI","Burundi"],
    ["KH","Cambodia"],
    ["CM","Cameroon"],
    ["CA","Canada"],
    ["CV","Cape Verde"],
    ["KY","Cayman Islands"],
    ["CF","Central African Republic"],
    ["TD","Chad"],
    ["CL","Chile"],
    ["CN","China"],
    ["CO","Colombia"],
    ["KM","Comoros"],
    ["CG","Congo"],
    ["CR","Costa Rica"],
    ["CI","Cote d'Ivoire"],
    ["HR","Croatia"],
    ["CU","Cuba"],
    ["CY","Cyprus"],
    ["CZ","Czech Republic"],
    ["CD","Democratic Republic of Congo"],
    ["DK","Denmark"],
    ["DJ","Djibouti"],
    ["DM","Dominica"],
    ["DO","Dominican Republic"],
    ["EC","Ecuador"],
    ["EG","Egypt"],
    ["SV","El Salvador"],
    ["GQ","Equatorial Guinea"],
    ["ER","Eritrea"],
    ["EE","Estonia"],
    ["SZ","Eswatini"],
    ["ET","Ethiopia"],
    ["FJ","Fiji"],
    ["FI","Finland"],
    ["FR","France"],
    ["GF","French Guiana"],
    ["PF","French Polynesia"],
    ["GA","Gabon"],
    ["GM","Gambia"],
    ["GE","Georgia"],
    ["DE","Germany"],
    ["GH","Ghana"],
    ["GI","Gibraltar"],
    ["GR","Greece"],
    ["GL","Greenland"],
    ["GD","Grenada"],
    ["GP","Guadeloupe"],
    ["GU","Guam"],
    ["GT","Guatemala"],
    ["GN","Guinea"],
    ["GW","Guinea-Bissau"],
    ["GY","Guyana"],
    ["HT","Haiti"],
    ["HN","Honduras"],
    ["HK","Hong Kong"],
    ["HU","Hungary"],
    ["IS","Iceland"],
    ["ID","Indonesia"],
    ["IR","Iran"],
    ["IQ","Iraq"],
    ["IE","Ireland"],
    ["IL","Israel"],
    ["IT","Italy"],
    ["JM","Jamaica"],
    ["JP","Japan"],
    ["JO","Jordan"],
    ["KZ","Kazakhstan"],
    ["KE","Kenya"],
    ["KI","Kiribati"],
    ["KW","Kuwait"],
    ["KG","Kyrgyzstan"],
    ["LA","Laos"],
    ["LV","Latvia"],
    ["LB","Lebanon"],
    ["LS","Lesotho"],
    ["LR","Liberia"],
    ["LY","Libya"],
    ["LI","Liechtenstein"],
    ["LT","Lithuania"],
    ["LU","Luxembourg"],
    ["MO","Macau"],
    ["MG","Madagascar"],
    ["MW","Malawi"],
    ["MY","Malaysia"],
    ["MV","Maldives"],
    ["ML","Mali"],
    ["MT","Malta"],
    ["MH","Marshall Islands"],
    ["MQ","Martinique"],
    ["MR","Mauritania"],
    ["MU","Mauritius"],
    ["YT","Mayotte"],
    ["MX","Mexico"],
    ["FM","Micronesia"],
    ["MD","Moldova"],
    ["MC","Monaco"],
    ["MN","Mongolia"],
    ["ME","Montenegro"],
    ["MS","Montserrat"],
    ["MA","Morocco"],
    ["MZ","Mozambique"],
    ["MM","Myanmar"],
    ["NA","Namibia"],
    ["NR","Nauru"],
    ["NP","Nepal"],
    ["NL","Netherlands"],
    ["NC","New Caledonia"],
    ["NZ","New Zealand"],
    ["NI","Nicaragua"],
    ["NE","Niger"],
    ["NG","Nigeria"],
    ["KP","North Korea"],
    ["MK","North Macedonia"],
    ["NO","Norway"],
    ["OM","Oman"],
    ["PK","Pakistan"],
    ["PW","Palau"],
    ["PS","Palestine"],
    ["PA","Panama"],
    ["PG","Papua New Guinea"],
    ["PY","Paraguay"],
    ["PE","Peru"],
    ["PH","Philippines"],
    ["PL","Poland"],
    ["PT","Portugal"],
    ["PR","Puerto Rico"],
    ["QA","Qatar"],
    ["RE","Reunion"],
    ["RO","Romania"],
    ["RU","Russia"],
    ["RW","Rwanda"],
    ["KN","Saint Kitts and Nevis"],
    ["LC","Saint Lucia"],
    ["VC","Saint Vincent and the Grenadines"],
    ["WS","Samoa"],
    ["SM","San Marino"],
    ["ST","Sao Tome and Principe"],
    ["SA","Saudi Arabia"],
    ["SN","Senegal"],
    ["RS","Serbia"],
    ["SC","Seychelles"],
    ["SL","Sierra Leone"],
    ["SG","Singapore"],
    ["SK","Slovakia"],
    ["SI","Slovenia"],
    ["SB","Solomon Islands"],
    ["SO","Somalia"],
    ["ZA","South Africa"],
    ["KR","South Korea"],
    ["SS","South Sudan"],
    ["ES","Spain"],
    ["LK","Sri Lanka"],
    ["SD","Sudan"],
    ["SR","Suriname"],
    ["SE","Sweden"],
    ["CH","Switzerland"],
    ["SY","Syria"],
    ["TW","Taiwan"],
    ["TJ","Tajikistan"],
    ["TZ","Tanzania"],
    ["TH","Thailand"],
    ["TL","Timor-Leste"],
    ["TG","Togo"],
    ["TO","Tonga"],
    ["TT","Trinidad and Tobago"],
    ["TN","Tunisia"],
    ["TR","Turkey"],
    ["TM","Turkmenistan"],
    ["TC","Turks and Caicos Islands"],
    ["TV","Tuvalu"],
    ["UG","Uganda"],
    ["UA","Ukraine"],
    ["AE","United Arab Emirates"],
    ["GB","United Kingdom"],
    ["US","United States"],
    ["UY","Uruguay"],
    ["UZ","Uzbekistan"],
    ["VU","Vanuatu"],
    ["VA","Vatican City"],
    ["VE","Venezuela"],
    ["VN","Vietnam"],
    ["YE","Yemen"],
    ["ZM","Zambia"],
    ["ZW","Zimbabwe"]
  ];

  function parseJSON(value, fallback){
    try { return value ? JSON.parse(value) : fallback; }
    catch(e){ return fallback; }
  }

  function esc(value){
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(char){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char];
    });
  }

  function qs(value){ return encodeURIComponent(String(value || "").trim()); }

  function pad(n){ return String(n).padStart(2,"0"); }

  function ymd(date){
    return date.getFullYear() + "-" + pad(date.getMonth()+1) + "-" + pad(date.getDate());
  }

  function toDate(value){
    if(!value) return null;
    if(value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const text = String(value).trim();
    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if(iso){
      const d = new Date(Number(iso[1]), Number(iso[2])-1, Number(iso[3]));
      d.setHours(0,0,0,0);
      return d;
    }
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dateText(value){
    const date = toDate(value);
    if(!date) return String(value || "");
    return date.toLocaleDateString("en-IN", {weekday:"short", day:"2-digit", month:"short"});
  }

  function money(value){
    const number = Number(value || 0);
    return number ? "₹" + Math.round(number).toLocaleString("en-IN") : "₹0";
  }

  /* Customer-facing only: never show supplier/API/HTTP technical text. */
  function tyLooksTechnicalCustomerError(message){
    return /tripjack|supplier|backend|\bapi\b|http\s*\d{3}|\b50[023]\b|\b500\b|ECONN|ENOTFOUND|gateway|provider error|request failed|network error|failed to fetch/i.test(String(message || ""));
  }

  function tyCustomerFacingSearchMessage(message){
    const raw = String(message || "")
      .replace(/\b[A-Z]{2,8}_[A-Z0-9]{2,16}\b/g, "")
      .replace(/tripjack/gi, "")
      .replace(/HTTP\s*\d{3}/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if(!raw || tyLooksTechnicalCustomerError(message) || tyLooksTechnicalCustomerError(raw)){
      return "Please modify your search and try again.";
    }
    if(/no flights|not found|empty|zero results/i.test(raw)){
      return "Please modify your search and try again.";
    }
    return raw.length > 160 ? "Please modify your search and try again." : raw;
  }

  function tyCustomerFacingActionError(message, fallback){
    const raw = String(message || "").replace(/tripjack/gi, "").replace(/HTTP\s*\d{3}/gi, "").replace(/\s+/g, " ").trim();
    if(!raw || tyLooksTechnicalCustomerError(message) || tyLooksTechnicalCustomerError(raw)){
      return fallback || "Something went wrong. Please try again.";
    }
    return raw.length > 180 ? (fallback || "Something went wrong. Please try again.") : raw;
  }

  function timeText(value){
    if(value === undefined || value === null || value === '') return "--:--";
    if(value instanceof Date && !Number.isNaN(value.getTime())){
      return String(value.getHours()).padStart(2,'0') + ':' + String(value.getMinutes()).padStart(2,'0');
    }
    if(typeof value === 'number'){
      const n = Math.round(value);
      if(n >= 0 && n <= 2359){
        const h = Math.floor(n / 100), m = n % 100;
        if(h <= 23 && m <= 59) return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
      }
    }
    const text = String(value).trim();
    if(!text) return "--:--";
    const iso = text.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if(iso) return String(iso[1]).padStart(2,'0') + ':' + iso[2];
    const plain = text.match(/\b(\d{1,2}):(\d{2})\b/);
    if(plain) return String(plain[1]).padStart(2,'0') + ':' + plain[2];
    const compact = text.match(/^\d{3,4}$/);
    if(compact){
      const raw = text.padStart(4,'0');
      const h = Number(raw.slice(0,2));
      const m = Number(raw.slice(2));
      if(h <= 23 && m <= 59) return raw.slice(0,2) + ':' + raw.slice(2);
    }
    const tailCompact = text.match(/(?:^|\D)(\d{3,4})(?:\D|$)/);
    if(tailCompact){
      const raw = tailCompact[1].padStart(4,'0');
      const h = Number(raw.slice(0,2));
      const m = Number(raw.slice(2));
      if(h <= 23 && m <= 59) return raw.slice(0,2) + ':' + raw.slice(2);
    }
    return "--:--";
  }

  

  function timeToMinutes(value){
    const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
    if(!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function durationMinutes(value){
    if(typeof value === "number") return value;
    const text = String(value || "");
    const h = (text.match(/(\d+)\s*h/i) || [])[1];
    const m = (text.match(/(\d+)\s*m/i) || [])[1];
    if(h || m) return Number(h || 0) * 60 + Number(m || 0);
    return Number(value || 0) || 0;
  }

  function durationText(value){
    const mins = durationMinutes(value);
    if(!mins) return "N/A";
    return Math.floor(mins/60) + "h " + (mins % 60) + "m";
  }

  function get(obj, path){
    return String(path).split(".").reduce(function(acc, key){
      return acc && acc[key];
    }, obj);
  }

  function pick(obj, paths, fallback){
    for(const path of paths){
      const value = get(obj, path);
      if(value !== undefined && value !== null && value !== "") return value;
    }
    return fallback;
  }

  function readSearch(){
    const a = parseJSON(sessionStorage.getItem("tySearchPayload"), {});
    const b = parseJSON(sessionStorage.getItem("tySearchContext"), {});
    const c = parseJSON(sessionStorage.getItem("ty_last_search_payload"), {});
    const base = Object.assign({}, a.search || {}, a.livePayload || {}, b || {}, c || {});
    const sq = base.searchQuery || {};
    const routeInfos = Array.isArray(sq.routeInfos) ? sq.routeInfos : [];
    const firstRoute = routeInfos[0] || {};
    const secondRoute = routeInfos[1] || {};
    const pax = sq.paxInfo || base.passengers || {};

    const origin = (firstRoute.fromCityOrAirport && firstRoute.fromCityOrAirport.code) || base.origin || base.from || base.fromCode || base.source || "DEL";
    const destination = (firstRoute.toCityOrAirport && firstRoute.toCityOrAirport.code) || base.destination || base.to || base.toCode || base.dest || "BOM";
    let departureDate = firstRoute.travelDate || base.departureDate || base.date || base.travelDate || base.departDate || ymd(new Date(Date.now()+86400000*7));
    let returnDate = secondRoute.travelDate || base.returnDate || base.retDate || base.return || (base.flight && base.flight.returnDate) || "";

    // : prevent timezone/old stored-data bug. Never allow search date earlier than today.
    const todayLocal = (function(){ const d = new Date(); d.setHours(0,0,0,0); return ymd(d); })();
    departureDate = normalizeFutureYmd(departureDate);
    if(returnDate){
      returnDate = normalizeFutureYmd(returnDate);
      if(returnDate < departureDate) returnDate = departureDate;
    }
    const tripRaw = String(base.tripType || base.trip || (base.flight && base.flight.trip) || (returnDate ? "roundtrip" : "oneway")).toLowerCase();

    return {
      origin,
      destination,
      departureDate,
      returnDate,
      tripType: tripRaw.includes("multi") ? "multicity" : (tripRaw.includes("round") || tripRaw.includes("return") ? "roundtrip" : "oneway"),
      adults: Number(pax.ADULT || pax.adults || base.adults || base.adult || 1),
      children: Number(pax.CHILD || pax.children || base.children || base.child || 0),
      infants: Number(pax.INFANT || pax.infants || base.infants || base.infant || 0),
      cabinClass: sq.cabinClass || base.cabinClass || base.cabin || base.travelClass || "ECONOMY",
      fareType: (sq.searchModifiers && sq.searchModifiers.pft) || base.fareType || base.pft || "REGULAR",
      routes: base.routes || base.multiCity || (base.flight && base.flight.multi) || routeInfos || []
    };
  }

  async function loadLookups(){
    try{
      const [airports, airlines] = await Promise.all([
        fetch("/assets/data/airports.json", {cache:"force-cache"}).then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch("/assets/data/airlines.json", {cache:"force-cache"}).then(r => r.ok ? r.json() : {}).catch(() => ({}))
      ]);
      state.lookups.airports = airports || {};
      state.lookups.airlines = airlines || {};
    }catch(e){
      state.lookups.airports = {};
      state.lookups.airlines = {};
    }
  }

  function airportInfo(code){
    return state.lookups.airports[String(code || "").toUpperCase()] || null;
  }

  function airportCity(code){
    const info = airportInfo(code);
    return info && info.city ? info.city : String(code || "");
  }

  function airportFull(code){
    const c = String(code || "").toUpperCase();
    const info = airportInfo(c);
    if(!info) return c;
    return [info.city || c, info.name || "", info.country || ""].filter(Boolean).join(" • ");
  }

  function routeIsInternational(){
    const legs = routeLegs();
    return legs.some(function(leg){
      const a = airportInfo(leg.from);
      const b = airportInfo(leg.to);
      return Boolean(a && b && a.countryCode && b.countryCode && String(a.countryCode).toUpperCase() !== String(b.countryCode).toUpperCase());
    });
  }

  function flagFromDeep(obj, names){
    let yes = false;
    walkDeep(obj,function(node,path){
      if(!node || typeof node !== 'object') return false;
      for(const n of names){
        if(Object.prototype.hasOwnProperty.call(node,n)){
          const v = node[n];
          if(v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'required' || String(v).toLowerCase() === 'mandatory') yes = true;
        }
      }
      return yes;
    },'',0,new Set());
    return yes;
  }

  function panRequiredForFlights(flights){
    return flights.some(function(f){ return Boolean(f.ipa || flagFromDeep(rawSourcesForFlight(f), ['ipa','panRequired','isPanRequired'])); });
  }

  function tyIsIndianCountryCode(value){
    const code = String(tyPassportCountryForSelect(value) || '').toUpperCase();
    return code === 'IN';
  }

  function tyPanFormatValid(value){
    return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value || '').trim().toUpperCase());
  }

  function tyPassengerLooksIndian(form, index){
    if(!form) return true;
    const i = Number(index || 0);
    const nat = form.querySelector('[name="nationality_' + i + '"]');
    const issue = form.querySelector('[name="passportIssueCountry_' + i + '"]');
    if(nat && String(nat.value || '').trim()) return tyIsIndianCountryCode(nat.value);
    if(issue && String(issue.value || '').trim()) return tyIsIndianCountryCode(issue.value);
    /* API requested PAN and nationality not chosen yet — default nationality options start at IN. */
    return true;
  }

  function tyPanRequiredForPassenger(form, index, flights){
    return panRequiredForFlights(flights || []) && tyPassengerLooksIndian(form, index);
  }

  function routeCountryStatus(){
    const legs = routeLegs();
    let known = false;
    for(const leg of legs){
      const a = airportInfo(leg.from);
      const b = airportInfo(leg.to);
      const ac = a && a.countryCode ? String(a.countryCode).toUpperCase() : '';
      const bc = b && b.countryCode ? String(b.countryCode).toUpperCase() : '';
      if(ac && bc){
        known = true;
        if(ac !== bc) return 'international';
      }
    }
    return known ? 'domestic' : 'unknown';
  }

  function supplierPassportFlagForFlights(flights){
    return flights.some(function(f){
      const raw = f.raw || {};
      const pcs = raw.pcs || raw.passportBookingCondition || {};
      return Boolean(raw.pm || pcs.pm || pcs.pped || pcs.pid || raw.pped || raw.pid || flagFromDeep(rawSourcesForFlight(f), ['passportRequired','isPassportRequired','passportMandatory','isPassportMandatory','PassportRequired','IsPassportMandatory','pm','pid','pped']));
    });
  }

  function passportRequiredForFlights(flights){
    if(routeCountryStatus() === 'domestic') return false;
    return supplierPassportFlagForFlights(flights);
  }

  function dobRequiredForFlights(flights){
    return flights.some(function(f){
      const raw = f.raw || {};
      const pcs = raw.pcs || raw.passportBookingCondition || {};
      return Boolean(raw.dobe || raw.adobr || pcs.dobe || pcs.adobr || flagFromDeep(rawSourcesForFlight(f), ['dobRequired','isDobRequired','dateOfBirthRequired','dateOfBirthMandatory','dobe','adobr']));
    });
  }

  
  function dateYmdAdd(baseYmd, days){
    const d = toDate(baseYmd) || new Date();
    d.setDate(d.getDate() + days);
    return ymd(d);
  }

  function todayYmd(){ const d = new Date(); d.setHours(0,0,0,0); return ymd(d); }
  function maxYmd(a,b){ return (String(a) < String(b)) ? b : a; }
  function normalizeFutureYmd(value){
    const today = todayYmd();
    const parsed = toDate(value);
    const y = parsed ? ymd(parsed) : String(value || "");
    return y && y >= today ? y : today;
  }

  function terminalText(obj){
    const t = pick(obj || {}, ["terminal","terminalName","t","tr","da.terminal","aa.terminal"], "");
    return t ? (String(t).toLowerCase().includes("terminal") ? String(t) : "Terminal " + String(t)) : "";
  }

  function airportDisplay(code, terminal){
    const c = String(code || "").toUpperCase();
    const info = airportInfo(c);
    const full = info ? [info.name || "", info.city || c].filter(Boolean).join(" • ") : c;
    return terminal ? full + " • " + terminal : full;
  }

  function minutesBetween(a,b){
    const da = new Date(a), db = new Date(b);
    if(!Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime())) return Math.max(0, Math.round((db-da)/60000));
    return 0;
  }

  

  function layoverText(minutes){
    minutes = Number(minutes || 0);
    if(!minutes) return "";
    return Math.floor(minutes/60) + "h " + (minutes%60) + "m";
  }

  
  const TY_TRIPJACK_DEP_KEYS = ["dt","dT","dep","departureTime","depTime","departure.time","departureDateTime","departure.datetime","departure.dateTime","departure.date","depDate","departureDate","fromDateTime","from.time","sourceTime","startTime","departTime","scheduledDeparture","departure.localTime","dD","departureDateLocal"];
  const TY_TRIPJACK_ARR_KEYS = ["at","aT","arr","arrivalTime","arrTime","arrival.time","arrivalDateTime","arrival.datetime","arrival.dateTime","arrival.date","arrDate","arrivalDate","toDateTime","to.time","destinationTime","endTime","scheduledArrival","arrival.localTime","aD","arrivalDateLocal"];

  function tyExactDateTimeFromApi(obj, side){
    if(!obj || typeof obj !== 'object') return '';
    const keys = side === 'arr' ? TY_TRIPJACK_ARR_KEYS : TY_TRIPJACK_DEP_KEYS;
    const direct = pick(obj, keys, '');
    if(direct) return direct;

    const pools = side === 'arr'
      ? [obj.arrival, obj.arrivalAirport, obj.toAirport, obj.aa, obj.destination, obj.to]
      : [obj.departure, obj.departureAirport, obj.fromAirport, obj.da, obj.source, obj.from];

    for(const p of pools){
      if(!p || typeof p !== 'object') continue;
      const v = pick(p, keys, '');
      if(v) return v;
    }
    return '';
  }
  function tyHasExplicitApiDate(value){
    const text = String(value || '').trim();
    return /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.test(text) || /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/.test(text);
  }

  function tyAddDaysToIsoDate(isoDate, days){
    const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return isoDate || state.search.departureDate;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    d.setUTCDate(d.getUTCDate() + Number(days || 0));
    return d.toISOString().slice(0, 10);
  }

  function tyDateOnlyFromAny(value, fallback){
    const text = String(value || '').trim();
    if(!text) return fallback || state.search.departureDate;
    let m = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(m) return [m[1], String(m[2]).padStart(2,'0'), String(m[3]).padStart(2,'0')].join('-');
    m = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
    if(m) return [m[3], String(m[2]).padStart(2,'0'), String(m[1]).padStart(2,'0')].join('-');
    return fallback || state.search.departureDate;
  }

  function tySegmentSideDate(seg, side){
    if(!seg || typeof seg !== 'object') return '';
    const keys = side === 'arr'
      ? ["at","aT","arr","arrivalDateTime","arrivalTime","arrTime","arrival.dateTime","arrival.datetime","arrival.date","arrivalDate","arrDate","aD","arrivalDateLocal","toDateTime","to.dateTime","to.date","aa.date","aa.arrivalDate"]
      : ["dt","dT","dep","departureDateTime","departureTime","depTime","departure.dateTime","departure.datetime","departure.date","departureDate","depDate","dD","departureDateLocal","fromDateTime","from.dateTime","from.date","da.date","da.departureDate"];
    return pick(seg, keys, '');
  }

  function tyResolveSegmentArrivalDate(seg, depRaw, arrRaw, depDate, durationMins){
    /*
      First priority is supplier/API arrival date (at/aT/arr/arrivalDate/arrival.date).
      If API only gives arrival time, compute only the date rollover from local dep/arr times.
    */
    const explicit = tySegmentSideDate(seg, 'arr') || arrRaw;
    if(tyHasExplicitApiDate(explicit)) return tyDateOnlyFromAny(explicit, depDate);

    const dep = depDate || tyDateOnlyFromAny(depRaw, state.search.departureDate);
    const depM = timeToMinutes(depRaw);
    const arrM = timeToMinutes(arrRaw);
    if(depM !== null && arrM !== null){
      let add = 0;
      if(arrM < depM) add = 1;
      if(Number(durationMins || 0) > 0 && depM + Number(durationMins || 0) >= 1440) add = Math.max(add, Math.floor((depM + Number(durationMins || 0)) / 1440));
      return tyAddDaysToIsoDate(dep, add);
    }
    return dep;
  }
  function tyDateFromApi(value, fallback){
    if(!value) return fallback || state.search.departureDate;
    return tyDateOnlyFromAny(value, fallback || state.search.departureDate);
  }

  function tyDurationMinutesFromApi(seg){
    const v = pick(seg || {}, ["duration","durationMinutes","d","journeyTime","elapsedTime","flightTime"], 0);
    return durationMinutes(v);
  }

  
  function tyObjectHasSegmentTime(obj){
    if(!obj || typeof obj !== 'object') return false;
    return Boolean(obj.dt || obj.at || obj.dT || obj.aT || obj.departureTime || obj.arrivalTime || obj.depTime || obj.arrTime || obj.da || obj.aa || obj.fD || obj.flightDesignator);
  }

  function tySegmentArrayScore(arr){
    if(!Array.isArray(arr) || !arr.length) return 0;
    let score = 0;
    arr.forEach(function(x){
      if(!x || typeof x !== 'object') return;
      if(x.dt || x.dT) score += 4;
      if(x.at || x.aT) score += 4;
      if(x.da || x.departure || x.from || x.departureAirport) score += 2;
      if(x.aa || x.arrival || x.to || x.arrivalAirport) score += 2;
      if(x.fD || x.flightDesignator || x.flightNumber || x.flightNo) score += 1;
      if(x.cT || x.connectionTime) score += 1;
    });
    return score;
  }

  function tyCollectTripjackSegments(root){
    const best = [];
    function pushCandidate(arr){
      if(!Array.isArray(arr) || !arr.length) return;
      const sc = tySegmentArrayScore(arr);
      if(sc > 0) best.push({arr:arr, score:sc});
    }
    function visit(node, depth, seen){
      if(!node || depth > 7) return;
      if(typeof node !== 'object') return;
      if(seen.has(node)) return;
      seen.add(node);
      if(Array.isArray(node)){
        pushCandidate(node);
        node.forEach(function(v){ visit(v, depth+1, seen); });
        return;
      }
      ['sI','SI','segments','seg','flightSegments'].forEach(function(k){ pushCandidate(node[k]); });
      ['tripInfos','totalTripInfos','searchResult','tripInfosMap','raw','trip','response','result','data','fd'].forEach(function(k){
        if(node[k] && node[k] !== node) visit(node[k], depth+1, seen);
      });
      Object.keys(node).forEach(function(k){
        if(k === 'raw' || k === 'data' || k === 'response' || k === 'result' || k === 'searchResult' || k === 'tripInfos' || k === 'totalTripInfos' || k === 'tripInfosMap') return;
        const v = node[k];
        if(Array.isArray(v)) pushCandidate(v);
        else if(v && typeof v === 'object') visit(v, depth+1, seen);
      });
    }
    visit(root, 0, new Set());
    best.sort(function(a,b){ return b.score - a.score || b.arr.length - a.arr.length; });
    return best.length ? best[0].arr : [];
  }

  function tyCodeFromAny(obj, side){
    if(!obj || typeof obj !== 'object') return '';
    const sideObj = side === 'arr'
      ? (obj.aa || obj.arrivalAirport || obj.toAirport || obj.arrival || obj.to || {})
      : (obj.da || obj.departureAirport || obj.fromAirport || obj.departure || obj.from || {});
    return String(pick(sideObj, ['code','cityCode','airportCode','iata'], pick(obj, side === 'arr' ? ['arrCode','to','destination','dest'] : ['depCode','from','origin','source'], '')) || '').toUpperCase();
  }

  function tyFlightNoFromAny(obj){
    if(!obj || typeof obj !== 'object') return '';
    const fd = obj.fD || obj.flightDesignator || {};
    return String(pick(obj, ['flightNumber','flightNo','fN'], pick(fd, ['fN','flightNumber','flightNo'], '')) || '').replace(/\s+/g,'').toUpperCase();
  }

  function tyAirCodeFromAny(obj){
    if(!obj || typeof obj !== 'object') return '';
    const fd = obj.fD || obj.flightDesignator || {};
    const ai = fd.aI || fd.al || obj.airline || obj.carrier || {};
    return String(pick(obj, ['airlineCode','carrierCode'], pick(ai, ['code','iata'], pick(fd, ['aI.code','al.code'], ''))) || '').toUpperCase();
  }

  function tySegmentMatchScore(rawSeg, seg){
    if(!rawSeg || !seg) return 0;
    let score = 0;
    const rd = tyCodeFromAny(rawSeg, 'dep');
    const ra = tyCodeFromAny(rawSeg, 'arr');
    const sd = String(seg.depCode || '').toUpperCase();
    const sa = String(seg.arrCode || '').toUpperCase();
    if(sd && rd && sd === rd) score += 6;
    if(sa && ra && sa === ra) score += 6;
    const rf = tyFlightNoFromAny(rawSeg);
    const sf = String(seg.flightNumber || seg.flightCode || '').replace(/[^0-9A-Z]/gi,'').toUpperCase();
    if(rf && sf && sf.includes(rf)) score += 4;
    const rc = tyAirCodeFromAny(rawSeg);
    const sc = String(seg.airlineCode || seg.flightCode || '').toUpperCase();
    if(rc && sc && sc.includes(rc)) score += 2;
    if(rawSeg.dt || rawSeg.at || rawSeg.dT || rawSeg.aT) score += 1;
    return score;
  }

  function tyFindMatchingRawSegment(seg, flight){
    if(seg && seg.raw && tyObjectHasSegmentTime(seg.raw)) return seg.raw;
    const sources = [];
    if(flight){
      sources.push(flight.raw, flight.reviewRaw, flight._reviewRaw, flight.reviewData, flight._reviewData, flight);
    }
    if(seg) sources.push(seg);
    let best = null, bestScore = 0;
    sources.filter(Boolean).forEach(function(src){
      tyCollectTripjackSegments(src).forEach(function(rawSeg){
        const sc = tySegmentMatchScore(rawSeg, seg || {});
        if(sc > bestScore){ best = rawSeg; bestScore = sc; }
      });
    });
    return bestScore > 0 ? best : null;
  }

  function normalizeSegments(rawSegments, fallbackFrom, fallbackTo, item, leg){
    const list = Array.isArray(rawSegments) && rawSegments.length ? rawSegments : [];

    if(!list.length){
      const depRaw = tyExactDateTimeFromApi(item, 'dep') || item.dep || item.departureTime || item.depTime || item.dt;
      const arrRaw = tyExactDateTimeFromApi(item, 'arr') || item.arr || item.arrivalTime || item.arrTime || item.at;
      const airlineName = String(pick(item, ["airlineName","airline"], ""));
      const airlineCode = String(pick(item, ["airlineCode","carrierCode"], "")).toUpperCase();
      const flightNumber = String(pick(item, ["flightNumber","flightNo"], ""));
      const flightCode = String(pick(item, ["flightCode"], (airlineCode && flightNumber) ? (airlineCode + " " + flightNumber) : (flightNumber || airlineCode)));
      if(!depRaw || !arrRaw || !(airlineName || airlineCode || flightNumber || flightCode)) return [];
      return [{
        airlineName,
        airlineCode,
        flightNumber,
        flightCode,
        depCode: String(fallbackFrom || item.origin || state.search.origin || "").toUpperCase(),
        arrCode: String(fallbackTo || item.destination || state.search.destination || "").toUpperCase(),
        depTime: timeText(depRaw),
        arrTime: timeText(arrRaw),
        depDate: tyDateFromApi(tySegmentSideDate(seg, 'dep') || depRaw, leg ? leg.date : state.search.departureDate),
        arrDate: tyResolveSegmentArrivalDate(seg, depRaw, arrRaw, tyDateFromApi(tySegmentSideDate(seg, 'dep') || depRaw, leg ? leg.date : state.search.departureDate), mins),
        depDateTimeRaw: depRaw,
        arrDateTimeRaw: arrRaw,
        depTerminal:"",
        arrTerminal:"",
        duration: durationText(pick(item,["duration","durationMinutes","d"],0)),
        durationMinutes: durationMinutes(pick(item,["duration","durationMinutes","d"],0)),
        raw:item
      }];
    }

    return list.map(function(seg, idx){
      const depObj = seg.da || seg.departureAirport || seg.fromAirport || seg.departure || seg.from || {};
      const arrObj = seg.aa || seg.arrivalAirport || seg.toAirport || seg.arrival || seg.to || {};
      const fd = seg.fD || seg.flightDesignator || {};
      const airline = fd.aI || fd.al || seg.airline || seg.carrier || {};
      const airlineCode = String(pick(seg, ["airlineCode","carrierCode"], pick(airline,["code"], pick(fd,["aI.code","al.code"],"")))).toUpperCase();
      const fno = String(pick(seg, ["flightNumber","flightNo"], pick(fd,["fN","flightNumber"],"")));
      const depCode = String(pick(depObj,["code","cityCode","airportCode","iata"], pick(seg,["from","origin","source","depCode"], idx===0 ? fallbackFrom : ""))).toUpperCase();
      const arrCode = String(pick(arrObj,["code","cityCode","airportCode","iata"], pick(seg,["to","destination","dest","arrCode"], idx===list.length-1 ? fallbackTo : ""))).toUpperCase();

      /* Tripjack official segment time keys are dt and at in sI[].
         These must be read from each segment, never from final journey-level
         values for intermediate segments. */
      const depRaw = tyExactDateTimeFromApi(seg, 'dep') || seg.dep || seg.departureTime || seg.depTime || seg.dt || seg.dT;
      const arrRaw = tyExactDateTimeFromApi(seg, 'arr') || seg.arr || seg.arrivalTime || seg.arrTime || seg.at || seg.aT;
      const nextDepRaw = idx < list.length-1 ? tyExactDateTimeFromApi(list[idx+1], 'dep') : "";
      const mins = tyDurationMinutesFromApi(seg);
      const depTerminal = terminalText(depObj) || terminalText({terminal:seg.dtT});
      const arrTerminal = terminalText(arrObj) || terminalText({terminal:seg.atT});

      return {
        airlineName: String(pick(airline,["name"], pick(seg,["airlineName","airline","carrierName"], ""))),
        airlineCode,
        flightNumber:fno,
        flightCode: (airlineCode && fno ? airlineCode + " " + fno : (airlineCode || fno)),
        depCode,
        arrCode,
        depTime: timeText(depRaw),
        arrTime: timeText(arrRaw),
        depDate: tyDateFromApi(tySegmentSideDate(seg, 'dep') || depRaw, leg ? leg.date : state.search.departureDate),
        arrDate: tyResolveSegmentArrivalDate(seg, depRaw, arrRaw, tyDateFromApi(tySegmentSideDate(seg, 'dep') || depRaw, leg ? leg.date : state.search.departureDate), mins),
        depDateTimeRaw: depRaw,
        arrDateTimeRaw: arrRaw,
        depTerminal,
        arrTerminal,
        duration: durationText(mins),
        durationMinutes: mins,
        raw: seg,
        layoverAfter: idx < list.length-1 ? Number(seg.cT || seg.connectionTime || seg.layoverAfter || minutesBetween(arrRaw, nextDepRaw) || 0) : 0,
        terminalChangeAfter: idx < list.length-1 ? terminalChangeText(arrCode, arrTerminal, list[idx+1]) : ""
      };
    });
  }

  function terminalChangeText(stopCode, arrTerminal, nextSeg){
    const nextDepObj = nextSeg.da || nextSeg.departureAirport || {};
    const nextTerminal = terminalText(nextDepObj) || terminalText({terminal:nextSeg.dtT});
    if(arrTerminal && nextTerminal && arrTerminal !== nextTerminal) return "Terminal change: " + arrTerminal + " to " + nextTerminal;
    return "";
  }

  function flightStopRoute(flight){
    const segs = flight.segments || [];
    if(segs.length <= 1) return `${esc(flight.departureCity)} - ${esc(flight.arrivalCity)}`;
    return segs.map(s => s.depCode).concat([segs[segs.length-1].arrCode]).filter(Boolean).join(" - ");
  }

  function renderSegmentDetails(flight){
    const segs = flight.segments || [];
    if(!segs.length) return "";
    return segs.map(function(seg, idx){
      const lay = seg.layoverAfter ? `<div class="ty-layover">${esc(layoverText(seg.layoverAfter))} layover at ${esc(airportFull(seg.arrCode))}${seg.terminalChangeAfter ? " • " + esc(seg.terminalChangeAfter) : ""}</div>` : "";
      return `<div class="ty-segment">
        <div class="ty-seg-air"><strong>${esc(seg.airlineName)}</strong><span>${esc(seg.flightCode)}</span></div>
        <div class="ty-seg-route">
          <div><b>${esc(seg.depTime)}</b><span>${esc(dateText(seg.depDate))}</span><em>${esc(seg.depCode)} • ${esc(airportDisplay(seg.depCode, seg.depTerminal))}</em></div>
          <i>${esc(seg.duration)}</i>
          <div><b>${esc(seg.arrTime)}</b><span>${esc(dateText(seg.arrDate))}</span><em>${esc(seg.arrCode)} • ${esc(airportDisplay(seg.arrCode, seg.arrTerminal))}</em></div>
        </div>
        ${lay}
      </div>`;
    }).join("");
  }

  function detailValueRows(rows){
    return rows.filter(r => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim()).map(r => `<div class="ty-detail-row"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('');
  }

  function deepFirstValue(src, names){
    const wanted = (names || []).map(x => String(x).toLowerCase());
    let found = '';
    rawSourcesForFlight(src && src.raw ? src : {raw:src}).forEach(function(root){
      if(found) return;
      walkDeep(root, function(node){
        if(found || !node || typeof node !== 'object' || Array.isArray(node)) return false;
        Object.keys(node).forEach(function(k){
          if(found) return;
          if(wanted.includes(String(k).toLowerCase()) && node[k] !== undefined && node[k] !== null && String(node[k]).trim()) found = node[k];
        });
        return false;
      },'',0,new Set());
    });
    return found;
  }

  function fareDetailHtml(flight){
    const rawPrice = Number(deepFirstValue(flight, ['TF','totalFare','totalPrice','amount','price'])) || Number(flight.price || 0);
    const base = Number(deepFirstValue(flight, ['BF','baseFare','baseAmount'])) || 0;
    const taxes = Number(deepFirstValue(flight, ['TAF','tax','taxes','totalTax'])) || 0;
    const rows = detailValueRows([
      ['Base Fare', base ? money(base) : ''],
      ['Taxes & Fees', taxes ? money(taxes) : ''],
      ['Total Fare', rawPrice ? money(rawPrice) : ''],
      ['Fare Type', flight.fareType || deepFirstValue(flight, ['fareType','fareIdentifier','pft'])],
      ['Refund Status', flight.refundable ? 'Refundable' : 'Non Refundable']
    ]);
    return rows ? `<div class="ty-detail-grid">${rows}</div>` : '';
  }

  function fareRulesHtml(flight){
    const rows = detailValueRows([
      ['Cancellation', deepFirstValue(flight, ['cancellationPolicy','cancellation','cancelPolicy','cp'])],
      ['Date Change', deepFirstValue(flight, ['dateChangePolicy','dateChange','changePolicy','dp'])],
      ['Refundable', flight.refundable ? 'Refundable' : (deepFirstValue(flight, ['refundable','rT']) || '')],
      ['Fare Rule', deepFirstValue(flight, ['fareRule','fareRules','rule','fr'])]
    ]);
    return rows ? `<div class="ty-detail-grid">${rows}</div>` : '';
  }

  function baggageHtml(flight){
    const segRows = (flight.segments || []).map(function(seg){
      const val = deepFirstValue(seg.raw || seg, ['baggage','checkInBaggage','iB','cabinBaggage','cB']) || flight.baggage || '';
      if(!val) return '';
      const label = [seg.depCode, seg.arrCode].filter(Boolean).join(' → ');
      return `<div class="ty-detail-row"><span>${esc(label || 'Baggage')}</span><b>${esc(val)}</b></div>`;
    }).join('');
    const fallback = !segRows && flight.baggage ? `<div class="ty-detail-row"><span>Baggage</span><b>${esc(flight.baggage)}</b></div>` : '';
    return (segRows || fallback) ? `<div class="ty-detail-grid">${segRows || fallback}</div>` : '';
  }


  function cancellationChangeHtml(flight){
    const rows = detailValueRows([
      ['Cancellation', deepFirstValue(flight, ['cancellationPolicy','cancellation','cancelPolicy','cp','cancelBeforeDeparture'])],
      ['Date Change', deepFirstValue(flight, ['dateChangePolicy','dateChange','changePolicy','dp','reschedule','reschedulePolicy'])],
      ['Refund Status', flight.refundable ? 'Refundable' : (deepFirstValue(flight, ['refundable','rT']) || 'Non Refundable')],
      ['Rule', deepFirstValue(flight, ['fareRule','fareRules','rule','fr','terms'])]
    ]);
    return rows ? `<div class="ty-detail-grid ty-rule-grid">${rows}</div>` : '';
  }

  function textFromFareSource(src, keys){
    const direct = firstTextFromDeep(src, keys);
    return changeTextValue(direct);
  }

  function numberFromFareSource(src, keys){
    return Number(firstNumberFromDeep(src, keys) || 0);
  }

  function fareBoolRefundable(src, fallback){
    const rt = textFromFareSource(src, ['rT','refundableType','refundType','isRefundable','refundable']);
    if(rt){
      const t = String(rt).toLowerCase();
      if(t === '1' || t === 'true' || t.includes('refund') && !t.includes('non')) return true;
      if(t === '0' || t === 'false' || t.includes('non')) return false;
    }
    return !!fallback;
  }
  function tyRealApiBaggageText(value){
    const text = changeTextValue(value).trim();
    if(!text) return '';

    /*
      Tripjack/API sometimes sends fare/class codes in cB/iB fields:
      N, Q, V, W, X, etc. Those are not baggage allowance text.
      Do not display them anywhere as Cabin/Check-in baggage.
      Show only real allowance text received from API: KG/KGS, PC/Piece,
      Unit(s), Bag(s), Included/Not Included, No baggage, NIL, etc.
    */
    if(!tyIsRealBaggageValue(text)) return '';

    return text
      .replace(/\s+/g, ' ')
      .replace(/\bKGS\b/ig, 'KG')
      .trim();
  }

  function tyFirstRealBaggageText(){
    for(let i = 0; i < arguments.length; i++){
      const value = tyRealApiBaggageText(arguments[i]);
      if(value) return value;
    }
    return '';
  }
  function readFareBaggage(src, flight){
    const cabinRaw = textFromFareSource(src, ['cB','cabBaggage','cabinBaggage','cabinBag','cabinAllowance','cabinBagAllowance','handBaggage','handBag','handBagAllowance']);
    const checkinRaw = textFromFareSource(src, ['iB','checkInBaggage','checkinBaggage','checkInBag','checkInAllowance','checkinAllowance','baggageAllowance','baggage']);
    const flightCabinRaw = textFromFareSource(flight, ['cB','cabBaggage','cabinBaggage','cabinBag','cabinAllowance','handBaggage']);
    const flightCheckinRaw = textFromFareSource(flight, ['baggage','checkInBaggage','checkinBaggage','iB','checkInAllowance','baggageAllowance']);

    return {
      cabin: tyFirstRealBaggageText(cabinRaw, flightCabinRaw),
      checkin: tyFirstRealBaggageText(checkinRaw, flightCheckinRaw)
    };
  }

  function readFareAddOns(src){
    return {
      seat: textFromFareSource(src, ['seat','seatInfo','seatInformation','seatSelection','seatIncluded']),
      meal: textFromFareSource(src, ['meal','mealInfo','mealInformation','mealIncluded','complimentaryMeals','isMealAvailable']),
      extra: textFromFareSource(src, ['benefit','benefits','inclusion','inclusions','extraServices'])
    };
  }

  
  /* ty-customer-fare-markup-v308
     Frontend safety layer:
     Backend result card price already includes API supplier price + ENV markup.
     Fare option modal and review-change modal must show customer price with same markup.
     Supplier price/markup is not shown to customer. */
  function flightPricingBreakup(flight){
    return (flight && (flight.pricingBreakup || (flight.raw && flight.raw.pricingBreakup))) || {};
  }

  function supplierPriceFromFlight(flight){
    const pb = flightPricingBreakup(flight);
    const fromPb = Number(pb.supplierTotal || pb.apiSupplierTotal || pb.rawSupplierTotal || pb.supplierAmount || 0);
    if(fromPb > 0) return fromPb;
    const raw = flight && (flight.raw || flight.rawPrice || flight.selectedFare || flight) || {};
    return Number(deepFirstValue(raw, ['TF','totalFare','totalPrice','amount','price'])) || Number(flight && (flight.supplierTotal || flight.rawSupplierTotal || 0)) || 0;
  }

  function markupAmountForSupplierFare(flight, supplierFare){
    const pb = flightPricingBreakup(flight);
    const supplier = Number(supplierFare || 0) || 0;
    if(!supplier) return 0;

    const type = String(pb.markupType || pb.type || '').toLowerCase();
    const value = Number(pb.markupValue || pb.value || 0);
    const baseSupplier = Number(pb.supplierTotal || pb.apiSupplierTotal || pb.rawSupplierTotal || 0) || supplierPriceFromFlight(flight);
    const pbMarkup = Number(pb.markupAmount || pb.markup || 0) || 0;
    const display = Number(flight && (flight.resultDisplayAmount || flight.displayPrice || flight.customerResultPrice || flight.price || flight.totalAmount || flight.amount) || 0) || 0;

    if((type.includes('percent') || type === 'pct') && value > 0){
      return Math.round((supplier * value) / 100);
    }
    if(pbMarkup > 0){
      if(baseSupplier > 0 && Math.abs(baseSupplier - supplier) > 1 && (type.includes('percent') || type === 'pct')){
        return Math.round((supplier * pbMarkup) / baseSupplier);
      }
      return Math.round(pbMarkup);
    }
    if(display > 0 && baseSupplier > 0){
      return Math.max(0, Math.round(display - baseSupplier));
    }
    return 0;
  }

  function customerFarePriceForSupplier(flight, supplierFare){
    const supplier = Number(supplierFare || 0) || 0;
    if(!supplier) return 0;
    return Math.max(0, Math.round(supplier + markupAmountForSupplierFare(flight, supplier)));
  }

  function markupDeltaForFlights(flights){
    return (Array.isArray(flights) ? flights : [flights]).filter(Boolean).reduce(function(sum, f){
      const supplier = supplierPriceFromFlight(f);
      const customer = Number(f && (f.resultDisplayAmount || f.displayPrice || f.customerResultPrice || f.price || f.totalAmount || f.amount) || 0) || 0;
      return sum + Math.max(0, Math.round(customer - supplier));
    }, 0);
  }

  function customerReviewPriceForSupplierTotal(flights, supplierTotal){
    const supplier = Number(supplierTotal || 0) || 0;
    if(!supplier) return 0;
    return Math.max(0, Math.round(supplier + markupDeltaForFlights(flights)));
  }

  function realFareOptions(flight){
    const rawTrip = flight.rawTrip || (flight.raw && (flight.raw.rawTrip || flight.raw.trip)) || {};
    const lists = [rawTrip.totalPriceList, rawTrip.priceInfoList, rawTrip.prices, flight.raw && flight.raw.totalPriceList, flight.raw && flight.raw.priceInfoList].filter(Array.isArray);
    const items = [];
    lists.forEach(function(list){
      list.forEach(function(p, idx){
        if(!p || typeof p !== 'object') return;
        const fdAdult = p.fd && (p.fd.ADULT || p.fd.Adult || p.fd.adult) || {};
        const fc = (p.totalFareDetail && p.totalFareDetail.fC) || (fdAdult && fdAdult.fC) || p.fC || {};
        const supplierPrice = Number(fc.TF || p.totalPrice || p.amount || p.price || p.totalFare || 0);
        const price = customerFarePriceForSupplier(flight, supplierPrice);
        if(!price) return;
        const bag = readFareBaggage(p, flight);
        const addOns = readFareAddOns(p);
        const fareType = changeTextValue(p.fareIdentifier || p.ft || p.fareType || p.name || fdAdult.fareIdentifier || flight.fareType) || 'Fare';
        const rawId = p.id || p.priceId || p.fareId || p.resultIndex || p.key || ('fare-' + idx);
        items.push({
          id: String(rawId),
          price: price,
          supplierPrice: supplierPrice,
          fareType: fareType,
          refundable: fareBoolRefundable(p, flight.refundable),
          rawPrice: p,
          cabinBaggage: bag.cabin,
          checkInBaggage: bag.checkin,
          cancellation: textFromFareSource(p, ['cancellation','cancellationPolicy','cancelPolicy','cp','refundPenalty','cancelBeforeDeparture']),
          dateChange: textFromFareSource(p, ['dateChange','dateChangePolicy','changePolicy','dp','reschedule','reschedulePolicy']),
          seat: addOns.seat,
          meal: addOns.meal,
          extra: addOns.extra
        });
      });
    });
    if(!items.length && flight){
      const bag = readFareBaggage(flight, flight);
      items.push({
        id:'selected',
        price:Number(flight.resultDisplayAmount || flight.displayPrice || flight.price || 0),
        supplierPrice:supplierPriceFromFlight(flight),
        fareType: changeTextValue(flight.fareType) || 'Fare',
        refundable: !!flight.refundable,
        rawPrice: flight.raw || flight,
        cabinBaggage: bag.cabin,
        checkInBaggage: bag.checkin,
        cancellation: textFromFareSource(flight, ['cancellation','cancellationPolicy','cancelPolicy','cp']),
        dateChange: textFromFareSource(flight, ['dateChange','dateChangePolicy','changePolicy','dp','reschedule']),
        seat: textFromFareSource(flight, ['seat','seatInfo','seatInformation','seatSelection']),
        meal: textFromFareSource(flight, ['meal','mealInfo','mealInformation','mealIncluded','complimentaryMeals']),
        extra: textFromFareSource(flight, ['benefit','benefits','inclusion','inclusions','extraServices'])
      });
    }
    const unique = [];
    const seen = new Set();
    items.forEach(function(x){
      const key = [x.id, x.price, x.fareType].join('-');
      if(!seen.has(key)){ seen.add(key); unique.push(x); }
    });
    return unique;
  }

  function hasMoreFares(flight){ return realFareOptions(flight).length > 1; }

  function renderMoreFarePanel(flight){ return ''; }

  function renderRoundTripDetailPanel(pair){
    return `<div class="ty-detail-panel" id="detail-${esc(pair.id)}" hidden>
      <div class="ty-detail-heading">Round Trip Flight Details</div>
      <h4>Departure Flight</h4>${renderSegmentDetails(pair.onward)}
      <h4>Return Flight</h4>${renderSegmentDetails(pair.returnFlight)}
    </div>`;
  }

  function renderRoundTripFarePanel(pair){ return ''; }

  function fareOptionIcon(label){
    const l = String(label || '').toLowerCase();
    if(l.includes('cabin')) return '🎒';
    if(l.includes('check')) return '🧳';
    if(l.includes('refund')) return '↩';
    if(l.includes('cancel')) return '✕';
    if(l.includes('date')) return '📅';
    if(l.includes('seat')) return '💺';
    if(l.includes('meal')) return '🍽';
    if(l.includes('extra')) return '＋';
    return '✓';
  }

  function fareSectionIcon(title){
    const t = String(title || '').toLowerCase();
    if(t.includes('baggage')) return '🧳';
    if(t.includes('flex')) return '↔';
    if(t.includes('seat') || t.includes('meal')) return '✨';
    return '✓';
  }

  function fareOptionRows(rows, cls){
    const clean = rows.filter(function(row){
      if(!row || row[1] === undefined || row[1] === null || !changeTextValue(row[1])) return false;
      const label = String(row[0] || '').toLowerCase();
      const forceDisplay = row[2] === true;
      if(label.includes('baggage') && !forceDisplay) return !!tyRealApiBaggageText(row[1]);
      return true;
    });
    if(!clean.length) return '';
    return `<div class="${cls || 'ty-fare-modal-list'}">${clean.map(function(row){ const icon = fareOptionIcon(row[0]); const label = String(row[0] || '').toLowerCase(); const forceDisplay = row[2] === true; const value = label.includes('baggage') && !forceDisplay ? tyRealApiBaggageText(row[1]) : changeTextValue(row[1]); return `<div class="ty-fare-modal-line"><i aria-hidden="true">${esc(icon)}</i><span>${esc(row[0])}</span><b>${esc(value)}</b></div>`;}).join('')}</div>`;
  }

  function renderFareOptionCard(flight, fare){
    const cabinBaggageText = tyRealApiBaggageText(fare.cabinBaggage);
    const checkInBaggageText = tyRealApiBaggageText(fare.checkInBaggage);
    const bagRows = fareOptionRows([
      ['Cabin Baggage', cabinBaggageText],
      ['Check-in Baggage', checkInBaggageText]
    ]);
    const flexRows = fareOptionRows([
      ['Refund Status', fare.refundable ? 'Refundable' : 'Non Refundable'],
      ['Cancellation', fare.cancellation],
      ['Date Change', fare.dateChange]
    ]);
    const addOnRows = fareOptionRows([
      ['Seats', fare.seat],
      ['Meals', fare.meal],
      ['Extra Services', fare.extra]
    ]);
    return `<article class="ty-fare-option-card" data-fare-card-id="${esc(fare.id)}">
      <div class="ty-fare-card-top">
        <div><strong>${money(fare.price)}</strong><span>per adult</span></div>
        <em>${esc(fare.fareType)}</em>
      </div>
      <div class="ty-fare-card-body">
        ${bagRows ? `<section><h4><i aria-hidden="true">${fareSectionIcon('Baggage')}</i>Baggage</h4>${bagRows}</section>` : ''}
        ${flexRows ? `<section><h4><i aria-hidden="true">${fareSectionIcon('Flexibility')}</i>Flexibility</h4>${flexRows}</section>` : ''}
        ${addOnRows ? `<section><h4><i aria-hidden="true">${fareSectionIcon('Seats, Meals & More')}</i>Seats, Meals & More</h4>${addOnRows}</section>` : ''}
      </div>
      <button type="button" class="ty-fare-card-book" data-book-fare-option="${esc(fare.id)}">Book Now</button>
    </article>`;
  }

  function selectedFareFlight(flight, fare){
    const out = Object.assign({}, flight);
    const supplierPrice = Number(fare.supplierPrice || supplierPriceFromFlight(flight) || fare.price || 0) || 0;
    const customerPrice = Number(fare.price || customerFarePriceForSupplier(flight, supplierPrice) || flight.price || 0) || 0;
    const oldPb = flightPricingBreakup(flight);

    out.price = customerPrice;
    out.displayPrice = customerPrice;
    out.resultDisplayAmount = customerPrice;
    out.customerResultPrice = customerPrice;
    out.totalAmount = customerPrice;
    out.fareType = fare.fareType || flight.fareType;
    out.refundable = !!fare.refundable;
    out.selectedFare = Object.assign({}, fare, { price: customerPrice, supplierPrice: supplierPrice });
    out.raw = Object.assign({}, flight.raw || {}, {selectedPrice: fare.rawPrice || fare, supplierFarePrice: supplierPrice});
    out.rawPrice = fare.rawPrice || fare;
    out.baggage = tyFirstRealBaggageText(fare.checkInBaggage, flight.baggage, fare.cabinBaggage);
    out.pricingBreakup = Object.assign({}, oldPb, {
      supplierTotal: supplierPrice || oldPb.supplierTotal,
      markupAmount: Math.max(0, Math.round(customerPrice - supplierPrice)),
      resultDisplayAmount: customerPrice,
      customerResultPrice: customerPrice,
      ticketAmount: customerPrice
    });
    return out;
  }

  function tyFareSegmentAirportDetails(segment, side, fallbackCode){
    const seg = segment || {};
    const raw = seg.raw || {};
    const obj = side === 'dep'
      ? (raw.da || raw.departureAirport || raw.fromAirport || raw.departure || raw.from || {})
      : (raw.aa || raw.arrivalAirport || raw.toAirport || raw.arrival || raw.to || {});
    const code = String((side === 'dep' ? seg.depCode : seg.arrCode) || obj.code || obj.airportCode || obj.iata || fallbackCode || '').toUpperCase();
    const lookup = airportInfo(code) || {};
    const city = String(obj.city || obj.cityName || lookup.city || code).trim();
    const airport = String(obj.name || obj.airportName || obj.airport || lookup.name || '').trim();
    const terminal = String((side === 'dep' ? seg.depTerminal : seg.arrTerminal) || obj.terminal || obj.terminalName || '').trim();
    return { code, city, airport, terminal };
  }

  function tyFareCarrierLogos(flight){
    return tyFlightCardCarriers(flight).map(function(carrier){
      return `<span class="ty-fare-carrier-logo">${airlineLogoHTML(carrier, 'ty-fare-head-logo-img')}</span>`;
    }).join('');
  }

  function tyFareCarrierLine(flight){
    return tyFlightCardCarriers(flight).map(function(carrier){
      return [carrier.airlineName || carrier.airlineCode || 'Airline', carrier.flightCode || ''].filter(Boolean).join(' ');
    }).join(' • ');
  }

  function tyFareAirportSubline(info){
    return [info.airport, info.terminal ? ('Terminal ' + info.terminal) : ''].filter(Boolean).join(' • ');
  }

  function showFareOptionsModal(flight, legKey){
    const fares = realFareOptions(flight).filter(function(f){ return Number(f.price || 0) > 0; });
    if(!fares.length){ openReviewWithAirReview([flight]); return; }

    const first = firstSegment(flight);
    const last = lastSegment(flight);
    const fromCode = String(first.depCode || flight.departureCity || state.search.origin || '').toUpperCase();
    const toCode = String(last.arrCode || flight.arrivalCity || state.search.destination || '').toUpperCase();
    const fromInfo = tyFareSegmentAirportDetails(first, 'dep', fromCode);
    const toInfo = tyFareSegmentAirportDetails(last, 'arr', toCode);
    const routeTitle = `${fromInfo.city} (${fromInfo.code}) → ${toInfo.city} (${toInfo.code})`;
    const airlineLine = tyFareCarrierLine(flight);
    const flightDate = compactDateForSegment(first.depDate || state.search.departureDate);

    const modal = document.createElement('div');
    modal.className = 'ty-fare-modal ty-fare-sheet-v306';
    modal.innerHTML = `<div class="ty-fare-modal-backdrop" data-close-fare-modal></div>
      <section class="ty-fare-modal-card ty-fare-sheet-card" role="dialog" aria-modal="true">
        <button type="button" class="ty-fare-modal-close" data-close-fare-modal>×</button>
        <header class="ty-fare-sheet-head">
          <h2>Flight & Fare Details</h2>
          <div class="ty-fare-route-line">
            <span class="ty-fare-one-logo ty-fare-carrier-logos">${tyFareCarrierLogos(flight)}</span>
            <span><b>${esc(routeTitle)}</b><em>${esc(flightDate)}${airlineLine ? ` • ${esc(airlineLine)}` : ''}</em></span>
          </div>
        </header>
        <div class="ty-fare-price-strip">
          <div><small>Depart</small><b>${esc(first.depTime || flight.departureTime || '--:--')}</b><span>${esc(fromInfo.city)} (${esc(fromInfo.code)})</span><em>${esc(tyFareAirportSubline(fromInfo))}</em></div>
          <i>${esc(flight.duration || '')}${Number(flight.stops || 0) === 0 ? ' • Non Stop' : ` • ${esc(flight.stops)} Stop${Number(flight.stops || 0) > 1 ? 's' : ''}`}</i>
          <div><small>Arrive</small><b>${esc(last.arrTime || flight.arrivalTime || '--:--')}</b><span>${esc(toInfo.city)} (${esc(toInfo.code)})</span><em>${esc(tyFareAirportSubline(toInfo))}</em></div>
        </div>
        <h3>${fares.length} Fare${fares.length > 1 ? 's' : ''} available for your trip</h3>
        <div class="ty-fare-card-scroll">${fares.map(function(f){ return renderFareOptionCard(flight, f); }).join('')}</div>
      </section>`;

    document.body.appendChild(modal);
    const close = function(){ modal.remove(); };
    modal.querySelectorAll('[data-close-fare-modal]').forEach(function(btn){ btn.onclick = close; });
    modal.querySelectorAll('[data-book-fare-option]').forEach(function(btn){
      btn.onclick = async function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        if(btn.dataset.tyFareProceeding === '1') return;
        btn.dataset.tyFareProceeding = '1';
        btn.disabled = true;

        const fare = fares.find(function(f){ return String(f.id) === String(btn.getAttribute('data-book-fare-option')); }) || fares[0];
        const selected = selectedFareFlight(flight, fare);
        setSelectedForLeg(legKey || 'onward', selected);

        /*
          Investigation result:
          The modal was being removed before the review/passenger page finished rendering.
          On mobile this exposed the result page behind it, so it looked like Book Now went back.
          Keep the fare modal visible while real review/fare-validate runs, then remove it
          after openReviewWithAirReview() has rendered the next step.
        */
        showBookingLoader();
        try{
          await openReviewWithAirReview([selected]);
        }finally{
          try{ modal.remove(); }catch(e){}
        }
      };
    });
  }

  async function openFareOptionsForFlight(flight, legKey){
    if(tyIsPassportScanBusy() || tyPassportScanLockActive() || tyPassportUploadIntentActive()) return;
    if(!flight) return;
    showBookingLoader();
    try{
      const review = await fetchAirReviewForFlights([flight]);
      applyReviewDataToFlights([flight], review);
    }catch(e){}
    hideBookingLoader();
    showFareOptionsModal(flight, legKey || 'onward');
  }

  function rawSourcesForFlight(flight){
    if(!flight) return [];
    const raw = flight.raw || {};
    return [flight.reviewRaw, flight._reviewRaw, flight.reviewData, flight._reviewData, raw.reviewRaw, raw.reviewData, raw.rawReview, raw.selectedPrice, raw.rawPrice, raw.rawTrip, raw.trip, raw, flight].filter(Boolean);
  }

  function walkDeep(obj, fn, path, depth, seen){
    if(!obj || depth > 7) return;
    if(typeof obj !== 'object') return;
    if(seen.has(obj)) return;
    seen.add(obj);
    if(fn(obj, path || '')) return;
    if(Array.isArray(obj)){
      obj.forEach((v,i)=>walkDeep(v,fn,(path||'')+'['+i+']',depth+1,seen));
      return;
    }
    Object.keys(obj).forEach(k=>walkDeep(obj[k],fn,(path?path+'.':'')+k,depth+1,seen));
  }

  function normalizeSsrOption(item, type, idx, ownerId){
    if(!item || typeof item !== 'object') return null;
    const code = pick(item,['code','ssrCode','sSRCode','key','id','seatNo'],'');
    const desc = pick(item,['desc','description','name','text','label','seatNo'], code || type);
    const amount = Number(pick(item,['amount','price','totalAmount','fare','charge','fee'],0)) || 0;
    if(!code && !desc) return null;
    return { id: ownerId+'-'+type+'-'+idx+'-'+String(code||desc), type, code:String(code||desc), desc:String(desc||code||type), amount, raw:item };
  }

  function collectSsrOptionsFromSources(flights, type){
    const keyNeedles = type === 'BAGGAGE' ? ['baggage','bag'] : type === 'MEAL' ? ['meal'] : type === 'SEAT' ? ['seat','tripseatmap','seatmap'] : ['extraservices','extra service','extra_service','extra'];
    const out=[];
    (Array.isArray(flights)?flights:[flights]).filter(Boolean).forEach(function(flight){
      rawSourcesForFlight(flight).forEach(function(src){
        walkDeep(src,function(node,path){
          if(!node) return false;
          const p=String(path||'').toLowerCase();
          if(Array.isArray(node) && keyNeedles.some(k=>p.includes(k))){
            node.forEach((it,i)=>{ const opt=normalizeSsrOption(it,type,i,flight.id||'flight'); if(opt) out.push(opt); });
          }
          if(type==='SEAT' && node && typeof node==='object' && (node.seatNo || node.seatNumber) && (node.code || node.amount || node.price)){
            const opt=normalizeSsrOption(node,type,out.length,flight.id||'flight'); if(opt) out.push(opt);
          }
          return false;
        },'',0,new Set());
      });
    });
    const unique=[]; const seen=new Set();
    out.forEach(o=>{ const k=o.type+'|'+o.code+'|'+o.desc+'|'+o.amount; if(!seen.has(k)){seen.add(k); unique.push(o);} });
    return unique;
  }

  function collectSeatMapOptions(flights){
    const out = [];
    (Array.isArray(flights) ? flights : [flights]).filter(Boolean).forEach(function(flight){
      const sources = [flight.seatMapRaw, flight.seatMapData && seatMapRawFromResponse(flight.seatMapData)].filter(Boolean);
      sources.forEach(function(src){
        walkDeep(src,function(node,path){
          if(!node || typeof node !== 'object' || Array.isArray(node) || !Array.isArray(node.sInfo)) return false;
          const pathParts = String(path || '').split('.').filter(Boolean);
          const segmentId = String(node.segmentKey || node.key || pathParts[pathParts.length - 1] || 'segment');
          node.sInfo.forEach(function(seat,index){
            if(!seat || typeof seat !== 'object') return;
            const code = String(seat.code || seat.seatNo || seat.seatNumber || '').trim();
            if(!code) return;
            const features = [];
            if(seat.isAisle) features.push('Aisle');
            if(seat.isLegroom) features.push('Extra legroom');
            if(seat.isWindow) features.push('Window');
            out.push({
              id:String(flight.id || 'flight') + '-SEAT-' + segmentId + '-' + code + '-' + index,
              type:'SEAT',
              code:code,
              desc:features.length ? features.join(' • ') : 'Seat ' + code,
              amount:Number(seat.amount || seat.price || seat.fare || 0) || 0,
              segmentId:segmentId,
              row:Number(seat.seatPosition && seat.seatPosition.row || seat.row || 0) || 0,
              column:Number(seat.seatPosition && seat.seatPosition.column || seat.column || 0) || 0,
              isBooked:Boolean(seat.isBooked || seat.booked || seat.available === false),
              isAisle:Boolean(seat.isAisle),
              isLegroom:Boolean(seat.isLegroom),
              raw:seat
            });
          });
          return false;
        },'',0,new Set());
      });
    });
    const unique=[];
    const seen=new Set();
    out.forEach(function(o){
      const key=o.segmentId+'|'+o.code;
      if(!seen.has(key)){ seen.add(key); unique.push(o); }
    });
    return unique.sort(function(a,b){ return (a.segmentId.localeCompare(b.segmentId) || a.row-b.row || a.column-b.column || a.code.localeCompare(b.code,undefined,{numeric:true})); });
  }

  function addOnOptions(flights,type){
    if(type === 'SEAT'){
      const seatMapOptions = collectSeatMapOptions(flights);
      if(seatMapOptions.length) return seatMapOptions;
    }
    return collectSsrOptionsFromSources(flights,type);
  }
  function hasAddOnOptions(flight,type){ return addOnOptions([flight],type).length > 0; }
  function selectedAddOnsArray(){
    return Object.values(state.selectedAddOns || {}).filter(Boolean).map(function(o){
      return {
        type: o.type || "",
        code: o.code || "",
        desc: o.desc || "",
        amount: Number(o.amount || 0) || 0,
        passengerIndex: Number(o.passengerIndex || 0) || 0,
        segmentId: o.segmentId || o.segment || "segment"
      };
    });
  }

  function selectedAddOnTotal(){ return selectedAddOnsArray().reduce((sum,o)=>sum+Number(o&&o.amount||0),0); }

  function renderAddOnPanel(flight,type){
    const opts = addOnOptions([flight],type);
    if(!opts.length) return '';
    const label = type==='BAGGAGE' ? 'Baggage Options' : type==='MEAL' ? 'Meal Options' : type==='SEAT' ? 'Seat Options' : 'Extra Services';
    return `<div class="ty-detail-panel ty-addon-panel" id="addon-${esc(type)}-${esc(flight.id)}" hidden><div class="ty-detail-heading">${esc(label)}</div>${opts.map(o=>`<div class="ty-more-fare-row"><div><b>${esc(o.code)}</b><span>${esc(o.desc)}</span></div><strong>${money(o.amount)}</strong></div>`).join('')}</div>`;
  }

  function renderReviewAddOns(flights){
    const groups = [
      ['BAGGAGE','Add Baggage'],
      ['MEAL','Add Meal'],
      ['SEAT','Select Seat'],
      ['EXTRASERVICES','Extra Services']
    ].map(([type,title])=>({type,title,options:addOnOptions(flights,type)})).filter(g=>g.options.length);
    if(!groups.length) return '';
    return `<article class="ty-review-card"><div class="ty-section-head"><h2>Add-ons</h2><p>Select only the add-on you need for this booking.</p></div><div class="ty-section-body"><div class="ty-addon-review">${groups.map(g=>`<section><button type="button" class="ty-addon-toggle" data-review-addon-toggle="${esc(g.type)}">${esc(g.title)}</button><div class="ty-addon-options" data-review-addon-panel="${esc(g.type)}" hidden>${g.options.map(o=>`<div class="ty-addon-card ${state.selectedAddOns[g.type]&&state.selectedAddOns[g.type].code===o.code?'active':''}" data-review-addon-type="${esc(g.type)}" data-review-addon-code="${esc(o.code)}" data-review-addon-amount="${esc(o.amount)}" data-review-addon-desc="${esc(o.desc)}"><span class="ty-offer-radio"></span><div><b>${esc(o.code)}</b><p>${esc(o.desc)}</p></div><strong>${money(o.amount)}</strong></div>`).join('')}</div></section>`).join('')}</div></div></article>`;
  }

  function reviewRawFromResponse(data){ return data && (data.raw || data.data && data.data.raw || data.response || data.result || data); }
  async function fetchAirReviewForFlights(flights){
    const priceIds = flights.map(f=>f.priceId || f.id || (f.raw && (f.raw.priceId || f.raw.id))).filter(Boolean);
    if(!priceIds.length) return null;
    const key = priceIds.join('|');
    if(state.reviewCache[key]) return state.reviewCache[key];
    try{
      const res = await fetch(API_BASE + '/api/flights/review', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({priceIds}),cache:'no-store'});
      const data = await res.json().catch(()=>({}));
      if(res.ok && data && data.success !== false){ state.reviewCache[key]=data; return data; }
    }catch(e){}
    return null;
  }

  function applyReviewDataToFlights(flights, reviewData){
    if(!reviewData) return flights;
    const raw = reviewRawFromResponse(reviewData);
    const reviewBookingId = firstTextFromDeep(raw, ['bookingId']);
    flights.forEach(f=>{
      f.reviewData=reviewData;
      f.reviewRaw=raw;
      f._reviewData=reviewData;
      f._reviewRaw=raw;
      if(reviewBookingId) f.tripjackReviewBookingId = reviewBookingId;
    });
    return flights;
  }

  function seatMapRawFromResponse(data){
    return data && (data.raw || data.data && data.data.raw || data.response || data.result || data);
  }

  async function fetchSeatMapForFlights(flights, reviewData){
    const rawReview = reviewRawFromResponse(reviewData || (flights[0] && flights[0].reviewData));
    const bookingId = firstTextFromDeep(rawReview, ['bookingId']) || firstTextFromDeep(flights[0], ['tripjackReviewBookingId','bookingId']);
    if(!bookingId) return null;
    if(state.seatMapCache[bookingId]){
      const cached = state.seatMapCache[bookingId];
      const cachedRaw = seatMapRawFromResponse(cached);
      flights.forEach(function(f){ f.seatMapData = cached; f.seatMapRaw = cachedRaw; });
      return cached;
    }
    try{
      const res = await fetch(API_BASE + '/api/flights/seat', {
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({bookingId}),
        cache:'no-store'
      });
      const data = await res.json().catch(function(){ return {}; });
      if(!res.ok || !data || data.success === false) return null;
      state.seatMapCache[bookingId] = data;
      const raw = seatMapRawFromResponse(data);
      flights.forEach(function(f){ f.seatMapData = data; f.seatMapRaw = raw; });
      return data;
    }catch(_error){
      return null;
    }
  }

  function tyIsBackForwardNavigation(){
    try{
      const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      return !!(nav && nav.type === 'back_forward');
    }catch(e){ return false; }
  }

  let tyPassportScanBusy = false;
  let tyPassportUploadIntentUntil = 0;
  const TY_PASSPORT_SCAN_LOCK_KEY = 'ty_passport_scan_lock_until';
  const TY_PASSPORT_UPLOAD_INTENT_KEY = 'ty_passport_upload_intent_until';

  function tyStoreUntil(key, until){
    try{ sessionStorage.setItem(key, String(until)); }catch(e){}
    try{ localStorage.setItem(key, String(until)); }catch(e){}
  }

  function tyReadUntil(key){
    let until = 0;
    try{ until = Math.max(until, Number(sessionStorage.getItem(key) || 0)); }catch(e){}
    try{ until = Math.max(until, Number(localStorage.getItem(key) || 0)); }catch(e){}
    return until;
  }

  function tyClearUntil(key){
    try{ sessionStorage.removeItem(key); }catch(e){}
    try{ localStorage.removeItem(key); }catch(e){}
  }

  function tySetPassportUploadIntent(ms){
    const until = Date.now() + Number(ms || 180000);
    tyPassportUploadIntentUntil = Math.max(tyPassportUploadIntentUntil, until);
    window.__TY_PASSPORT_UPLOAD_INTENT_UNTIL = tyPassportUploadIntentUntil;
    tyStoreUntil(TY_PASSPORT_UPLOAD_INTENT_KEY, tyPassportUploadIntentUntil);
    try{ hideBookingLoader(); }catch(e){}
  }

  function tyPassportUploadIntentActive(){
    const until = Math.max(
      Number(tyPassportUploadIntentUntil || 0),
      Number(window.__TY_PASSPORT_UPLOAD_INTENT_UNTIL || 0),
      tyReadUntil(TY_PASSPORT_UPLOAD_INTENT_KEY)
    );
    if(until && until > Date.now()) return true;
    tyPassportUploadIntentUntil = 0;
    window.__TY_PASSPORT_UPLOAD_INTENT_UNTIL = 0;
    tyClearUntil(TY_PASSPORT_UPLOAD_INTENT_KEY);
    return false;
  }

  function tyIsPassportUploadTarget(target){
    if(!target || !target.closest) return false;
    return !!target.closest('[data-passport-upload], #tyPassportUploadInput, .ty-passport-upload-mini, .ty-upload-main');
  }

  ['pointerdown','touchstart','mousedown','click','change','input'].forEach(function(evtName){
    try{
      document.addEventListener(evtName, function(e){
        if(tyIsPassportUploadTarget(e && e.target)){
          tySetPassportUploadIntent(180000);
          try{ hideBookingLoader(); }catch(_e){}
        }
      }, true);
    }catch(e){}
  });

  function tySetPassportScanLock(ms){
    const until = Date.now() + Number(ms || 180000);
    window.__TY_PASSPORT_SCAN_BUSY = true;
    tyStoreUntil(TY_PASSPORT_SCAN_LOCK_KEY, until);
    tySetPassportUploadIntent(ms || 180000);
  }

  function tyClearPassportScanLock(){
    tyClearUntil(TY_PASSPORT_SCAN_LOCK_KEY);
    tyPassportUploadIntentUntil = 0;
    window.__TY_PASSPORT_UPLOAD_INTENT_UNTIL = 0;
    tyClearUntil(TY_PASSPORT_UPLOAD_INTENT_KEY);
  }

  function tyPassportScanLockActive(){
    const until = tyReadUntil(TY_PASSPORT_SCAN_LOCK_KEY);
    if(until && until > Date.now()) return true;
    if(until) tyClearUntil(TY_PASSPORT_SCAN_LOCK_KEY);
    return false;
  }

  function tyIsPassportScanBusy(){
    return !!(tyPassportScanBusy || window.__TY_PASSPORT_SCAN_BUSY === true || tyPassportScanLockActive() || tyPassportUploadIntentActive() || (ROOT.querySelector('#tyPassengerForm') && ROOT.querySelector('#tyPassengerForm').dataset.tyPassportScanning === '1'));
  }

  function tyBeginPassportScan(form){
    tyPassportScanBusy = true;
    tySetPassportScanLock(120000);
    try{ if(form) form.dataset.tyPassportScanning = '1'; }catch(e){}
    try{ hideBookingLoader(); }catch(e){}
  }

  function tyEndPassportScan(form){
    setTimeout(function(){
      tyPassportScanBusy = false;
      window.__TY_PASSPORT_SCAN_BUSY = false;
      tyClearPassportScanLock();
      try{ if(form) delete form.dataset.tyPassportScanning; }catch(e){}
    }, 250);
  }

  function showFlightSearchLoader(){
    if(tyIsBackForwardNavigation()) return;
    hideBookingLoader();
    try{
      if(window.TravelYaraaLoader){
        if(typeof window.TravelYaraaLoader.showFlight === "function") window.TravelYaraaLoader.showFlight();
        else window.TravelYaraaLoader.show({service:"flight", force:true});
      }
    }catch(e){}
  }
  function hideFlightSearchLoader(){
    /* Final hide only — intermediate TravelYaraaLoader.hide() is ignored while loading. */
    try{ window.TravelYaraaLoader && window.TravelYaraaLoader.hide({ final: true }); }catch(e){}
  }

  function showBookingLoader(){
    /* Book Now / fare-review loader only.
       Do not show this during passport upload/scan; passport has its own overlay. */
    if(tyIsPassportScanBusy() || tyPassportScanLockActive() || tyPassportUploadIntentActive()) return;
    hideBookingLoader();
    const loader = document.createElement('div');
    loader.id = 'tyBookingLoader';
    loader.className = 'ty-booking-loader';
    loader.setAttribute('role','status');
    loader.setAttribute('aria-live','polite');
    loader.innerHTML = '<strong>Fetching flight<br>information...</strong><div class="ty-booking-spinner" aria-hidden="true"></div>';
    document.body.appendChild(loader);
  }

  function hideBookingLoader(){
    const loader = document.getElementById('tyBookingLoader');
    if(loader) loader.remove();
  }

  function firstNumberFromDeep(obj, keys){
    const wanted = keys.map(k=>String(k).toLowerCase());
    let out = 0;
    walkDeep(obj,function(node){
      if(out || !node || typeof node !== 'object' || Array.isArray(node)) return false;
      Object.keys(node).forEach(function(k){
        if(out) return;
        if(wanted.includes(String(k).toLowerCase())){
          const n = Number(node[k]);
          if(Number.isFinite(n) && n > 0) out = n;
        }
      });
      return false;
    },'',0,new Set());
    return out;
  }

  function firstTextFromDeep(obj, keys){
    const wanted = keys.map(k=>String(k).toLowerCase());
    let out = '';
    walkDeep(obj,function(node){
      if(out || !node || typeof node !== 'object' || Array.isArray(node)) return false;
      Object.keys(node).forEach(function(k){
        if(out) return;
        if(wanted.includes(String(k).toLowerCase()) && node[k] !== undefined && node[k] !== null){
          const v = node[k];
          if(typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'){
            const text = String(v).trim();
            if(text && text !== '[object Object]') out = text;
          }
        }
      });
      return false;
    },'',0,new Set());
    return out;
  }

  function changeTextValue(value){
    if(value === undefined || value === null) return '';
    if(typeof value === 'object') return '';
    const text = String(value).trim();
    return text === '[object Object]' ? '' : text;
  }
  function tyDirectValue(obj, keys){
    if(!obj || typeof obj !== 'object') return '';
    for(const key of keys){
      if(obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    }
    return '';
  }

  function tyDirectNumber(obj, keys){
    const v = tyDirectValue(obj, keys);
    const n = Number(String(v || '').replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function tyDirectFareAmount(obj){
    if(!obj || typeof obj !== 'object') return 0;
    return tyDirectNumber(obj, ['TF','totalFare','totalPrice','totalAmount','amount','fare','price'])
      || tyDirectNumber(obj.fC, ['TF','NF','BF'])
      || tyDirectNumber(obj.fareComponents, ['TF','totalFare','totalPrice','amount'])
      || tyDirectNumber(obj.totalFareDetail && obj.totalFareDetail.fC, ['TF','NF','BF'])
      || tyDirectNumber(obj.fd && obj.fd.ADULT && obj.fd.ADULT.fC, ['TF','NF','BF'])
      || tyDirectNumber(obj.fd && obj.fd.Adult && obj.fd.Adult.fC, ['TF','NF','BF'])
      || tyDirectNumber(obj.fd && obj.fd.adult && obj.fd.adult.fC, ['TF','NF','BF']);
  }

  function tyFlightSelectedPriceIds(flights){
    const ids = new Set();
    (Array.isArray(flights) ? flights : [flights]).filter(Boolean).forEach(function(f){
      [
        f.priceId, f.id, f.fareId, f.resultIndex, f.key,
        f.raw && f.raw.priceId, f.raw && f.raw.id, f.raw && f.raw.fareId,
        f.rawPrice && f.rawPrice.id, f.rawPrice && f.rawPrice.priceId,
        f.selectedFare && f.selectedFare.id, f.selectedFare && f.selectedFare.priceId
      ].forEach(function(v){
        const s = String(v || '').trim();
        if(s) ids.add(s);
      });
    });
    return ids;
  }

  function tyReviewSelectedSupplierTotal(raw, flights){
    const ids = tyFlightSelectedPriceIds(flights);
    if(!ids.size || !raw) return 0;
    let total = 0;
    walkDeep(raw,function(node){
      if(total || !node || typeof node !== 'object' || Array.isArray(node)) return false;
      const nodeIds = [
        node.id, node.priceId, node.fareId, node.resultIndex, node.key,
        node.sI, node.sri, node.bookingId, node.priceInfoId
      ].map(function(v){ return String(v || '').trim(); }).filter(Boolean);
      const idMatch = nodeIds.some(function(id){ return ids.has(id); });
      if(!idMatch) return false;
      const amount = tyDirectFareAmount(node);
      if(amount > 0) total = amount;
      return false;
    },'',0,new Set());
    return total;
  }

  function tyMoneyChangeIsReal(oldAmount, newAmount){
    const oldN = Number(oldAmount || 0) || 0;
    const newN = Number(newAmount || 0) || 0;
    if(!oldN || !newN) return false;
    /*
      Ignore tiny supplier/customer rounding noise.
      The old logic was showing ₹1 changes on almost every review call.
    */
    return Math.abs(newN - oldN) >= 10;
  }

  function tyIsRealBaggageValue(value){
    const text = changeTextValue(value).trim();
    if(!text) return false;
    if(/^[A-Z]$/i.test(text)) return false; // N/Q/W etc are fare/cabin/code values, not baggage.
    if(/^\d+$/.test(text)) return false;
    return /(\bkg\b|\bkgs\b|kilogram|piece|pieces|\bpc\b|\bpcs\b|unit|units|bag|bags|lb|lbs|included|not included|nil|no baggage)/i.test(text);
  }

  function tyNormalizeBaggageValue(value){
    return changeTextValue(value)
      .trim()
      .replace(/\s+/g,' ')
      .replace(/\bunit\(s\)/ig,'unit')
      .toLowerCase();
  }

  function tyNormalizeChangeTime(value){
    const t = timeText(value);
    return t && t !== '--:--' ? t : '';
  }

  function tyExplicitChangePath(path, node){
    const p = String(path || '').toLowerCase();
    const keys = Object.keys(node || {}).join(' ').toLowerCase();
    return /(change|changed|updated|modified|alert|warning|farechange|fare-change|reviewchange|farevalidate|fare-validate|reprice|repriced|schedulechange|schedule-change)/i.test(p + ' ' + keys);
  }

  function tyExplicitChangePair(node){
    if(!node || typeof node !== 'object' || Array.isArray(node)) return null;
    const oldValue = tyDirectValue(node, ['oldValue','old','previousValue','previous','prevValue','before','fromValue','from','oV','oldVal']);
    const newValue = tyDirectValue(node, ['newValue','new','updatedValue','updated','currentValue','current','after','toValue','to','nV','newVal']);
    if(oldValue === '' || newValue === '') return null;
    return { oldValue: oldValue, newValue: newValue };
  }

  function tyClassifyExplicitChange(node, path){
    const text = [
      path,
      node && node.label,
      node && node.type,
      node && node.field,
      node && node.name,
      node && node.key,
      node && node.changeType,
      node && node.category,
      node && node.code
    ].map(function(v){ return String(v || '').toLowerCase(); }).join(' ');

    if(/fare|price|amount|total|tf|reprice/.test(text)) return 'Price';
    if(/baggage|checkin|check-in|cabin baggage|bag/.test(text)) return 'Baggage';
    if(/departure|depart|deptime|\bdt\b|dep time|schedule dep/.test(text)) return 'Departure Time';
    if(/arrival|arrive|arrtime|\bat\b|arr time|schedule arr/.test(text)) return 'Arrival Time';
    if(/segment|flight|schedule|time/.test(text)) return 'Flight Details';
    return '';
  }

  function tyExplicitReviewChanges(raw){
    const out = [];
    if(!raw) return out;

    walkDeep(raw,function(node,path){
      if(!node || typeof node !== 'object' || Array.isArray(node)) return false;
      if(!tyExplicitChangePath(path, node)) return false;

      const pair = tyExplicitChangePair(node);
      if(!pair) return false;

      const label = tyClassifyExplicitChange(node, path);
      if(!label) return false;

      if(label === 'Price'){
        const oldN = parseMoneyNumber(pair.oldValue);
        const newN = parseMoneyNumber(pair.newValue);
        if(!tyMoneyChangeIsReal(oldN, newN)) return false;
        out.push({label:'Price', oldValue:money(oldN), newValue:money(newN)});
        return false;
      }

      if(label === 'Baggage'){
        if(!tyIsRealBaggageValue(pair.oldValue) || !tyIsRealBaggageValue(pair.newValue)) return false;
        if(tyNormalizeBaggageValue(pair.oldValue) === tyNormalizeBaggageValue(pair.newValue)) return false;
        out.push({label:'Baggage', oldValue:changeTextValue(pair.oldValue), newValue:changeTextValue(pair.newValue)});
        return false;
      }

      if(label === 'Departure Time' || label === 'Arrival Time'){
        const oldT = tyNormalizeChangeTime(pair.oldValue);
        const newT = tyNormalizeChangeTime(pair.newValue);
        if(!oldT || !newT || oldT === newT) return false;
        out.push({label:label, oldValue:oldT, newValue:newT});
        return false;
      }

      const oldText = changeTextValue(pair.oldValue);
      const newText = changeTextValue(pair.newValue);
      if(oldText && newText && oldText !== newText){
        out.push({label:label, oldValue:oldText, newValue:newText});
      }
      return false;
    },'',0,new Set());

    const seen = new Set();
    return out.filter(function(c){
      const key = [c.label, c.oldValue, c.newValue].join('|').toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function detectReviewChanges(flights, reviewData){
    const raw = reviewRawFromResponse(reviewData);
    if(!raw) return [];

    const changes = tyExplicitReviewChanges(raw);

    /*
      Price can be validated without a generic deep search, but only from the selected fare id.
      Do not read the first random TF/price/amount from the whole review response.
    */
    const oldSupplierTotal = (Array.isArray(flights) ? flights : [flights]).filter(Boolean)
      .reduce(function(sum, f){ return sum + Number(supplierPriceFromFlight(f) || 0); }, 0);
    const oldCustomerTotal = (Array.isArray(flights) ? flights : [flights]).filter(Boolean)
      .reduce(function(sum, f){ return sum + Number(f && (f.price || f.resultDisplayAmount || f.displayPrice) || 0); }, 0);

    const selectedSupplierTotal = tyReviewSelectedSupplierTotal(raw, flights);
    if(selectedSupplierTotal && oldSupplierTotal && tyMoneyChangeIsReal(oldSupplierTotal, selectedSupplierTotal)){
      const newCustomerTotal = customerReviewPriceForSupplierTotal(flights, selectedSupplierTotal);
      if(newCustomerTotal && oldCustomerTotal && tyMoneyChangeIsReal(oldCustomerTotal, newCustomerTotal)){
        changes.push({label:'Price', oldValue:money(oldCustomerTotal), newValue:money(newCustomerTotal)});
      }
    }

    /*
      No more generic baggage/time deep-search here.
      Single-letter values like N/Q/W must never trigger baggage changes.
      Segment times must only trigger when the API explicitly sends an old/new schedule change.
    */
    const seen = new Set();
    return changes.filter(function(c){
      if(!c || !c.label || changeTextValue(c.oldValue) === '' || changeTextValue(c.newValue) === '') return false;
      const key = [c.label, c.oldValue, c.newValue].join('|').toLowerCase();
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function openFlightSearchPage(){
    try{
      sessionStorage.setItem("ty_modify_search_request", "flight");
      sessionStorage.setItem("tySelectedService", "flight");
      sessionStorage.setItem("ty_restore_search_bar", "1");
    }catch(e){}
    showFlightSearchLoader();
    location.href = "/?service=flight&modify=1#flight-search";
  }

  function parseMoneyNumber(value){
    const n = Number(String(value || '').replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function applyDetectedChangesToFlights(flights, changes){
    if(!Array.isArray(changes) || !changes.length) return;
    const list = Array.isArray(flights) ? flights.filter(Boolean) : [flights].filter(Boolean);
    changes.forEach(function(c){
      const label = String(c && c.label || '').toLowerCase();
      const value = changeTextValue(c && c.newValue);
      if(!value || !list.length) return;
      if(label.includes('price')){
        const amount = parseMoneyNumber(value);
        if(amount > 0){
          const each = Math.round(amount / Math.max(1, list.length));
          list.forEach(function(f){ f.price = each; });
        }
      }else if(label.includes('baggage')){
        list.forEach(function(f){ f.baggage = value; if(f.raw) f.raw.baggage = value; });
      }else if(label.includes('departure')){
        list[0].departureTime = value;
        if(list[0].segments && list[0].segments[0]) list[0].segments[0].depTime = value;
      }else if(label.includes('arrival')){
        const last = list[list.length - 1];
        last.arrivalTime = value;
        if(last.segments && last.segments.length) last.segments[last.segments.length - 1].arrTime = value;
      }
    });
  }
  function tyInjectChangeModalForceCss(){
    let style = document.getElementById('ty-change-force-mobile-css-v921');
    if(!style){
      style = document.createElement('style');
      style.id = 'ty-change-force-mobile-css-v921';
      style.textContent = `
        @media(max-width:767px){
          html,body{overflow-x:hidden!important;}
          .ty-change-modal-page{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:100dvh!important;background:rgba(7,29,73,.58)!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:8px!important;box-sizing:border-box!important;overflow:hidden!important;z-index:99999!important;}
          .ty-change-backdrop{position:absolute!important;inset:0!important;background:rgba(7,29,73,.38)!important;backdrop-filter:blur(2px)!important;}
          .ty-change-card{position:relative!important;z-index:1!important;display:flex!important;flex-direction:column!important;width:calc(100vw - 20px)!important;max-width:520px!important;height:auto!important;max-height:calc(100dvh - 18px)!important;overflow:hidden!important;background:#fff!important;border-radius:22px!important;padding:13px!important;border:1px solid #dce8f7!important;box-shadow:0 18px 55px rgba(7,29,73,.24)!important;}
          .ty-change-icon{width:32px!important;height:32px!important;margin:0 auto 5px!important;font-size:19px!important;line-height:1!important;}
          .ty-change-card h1{font-size:21px!important;line-height:1.12!important;margin:0!important;}
          .ty-change-card>p{font-size:12px!important;line-height:1.25!important;margin:5px 0 8px!important;font-weight:800!important;}
          .ty-change-table{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important;display:grid!important;gap:7px!important;margin:6px 0 8px!important;padding-right:1px!important;}
          .ty-change-row{display:grid!important;grid-template-columns:72px minmax(0,1fr) minmax(0,1fr)!important;gap:5px!important;padding:7px!important;border-radius:13px!important;background:#f8fbff!important;border:1px solid #e5edf7!important;}
          .ty-change-row>span{font-size:11.5px!important;line-height:1.15!important;font-weight:950!important;align-self:center!important;color:#071d49!important;}
          .ty-change-row div{padding:6px!important;border-radius:10px!important;background:#fff!important;border:1px solid #edf2f7!important;min-width:0!important;}
          .ty-change-row small{font-size:9px!important;line-height:1!important;color:#64748b!important;font-weight:900!important;text-transform:uppercase!important;}
          .ty-change-row b,.ty-change-row strong{font-size:12px!important;line-height:1.15!important;overflow-wrap:anywhere!important;color:#071d49!important;}
          .ty-change-row strong{color:#0062e3!important;}
          .ty-change-actions{flex:0 0 auto!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:0!important;padding-top:4px!important;background:#fff!important;}
          .ty-change-actions button{min-height:40px!important;border-radius:999px!important;font-size:12.5px!important;font-weight:950!important;}
        }
      `;
      document.head.appendChild(style);
    }
  }


  function renderChangeConfirm(flights, changes, options){
    hideBookingLoader();
    injectReviewTimerUpdateCss();
    tyInjectChangeModalForceCss();
    options = options || {};
    const rows = (changes || []).map(function(c){
      const oldValue = changeTextValue(c.oldValue);
      const newValue = changeTextValue(c.newValue);
      if(!oldValue && !newValue) return '';
      return `<div class="ty-change-row"><span>${esc(c.label)}</span><div><small>Old</small><b>${esc(oldValue || 'Previous')}</b></div><div><small>New</small><strong>${esc(newValue || 'Updated')}</strong></div></div>`;
    }).filter(Boolean).join('');
    ROOT.innerHTML = `<div class="ty-change-modal-page">
      <div class="ty-change-backdrop"></div>
      <section class="ty-change-card" role="dialog" aria-modal="true" aria-labelledby="tyChangeTitle">
        <div class="ty-change-icon">!</div>
        <h1 id="tyChangeTitle">Confirm to Proceed</h1>
        <p>Please review the latest airline changes before continuing.</p>
        <div class="ty-change-table">${rows || '<p class="ty-muted">Updated details are not available from airline.</p>'}</div>
        <div class="ty-change-actions"><button type="button" class="back" data-change-back>Back</button><button type="button" class="continue" data-change-continue>Continue</button></div>
      </section>
    </div>`;
    const back = ROOT.querySelector('[data-change-back]');
    const cont = ROOT.querySelector('[data-change-continue]');
    if(back) back.onclick = function(){ if(typeof options.onBack === 'function') options.onBack(); else openFlightSearchPage(); };
    if(cont) cont.onclick = function(){
      try{ cont.disabled = true; }catch(e){}
      try{ applyDetectedChangesToFlights(flights, changes || []); }catch(e){}
      try{
        if(typeof options.onContinue === 'function') options.onContinue();
        else renderFlightReviewStep(flights);
      }catch(e){
        try{ renderFlightReviewStep(flights); }catch(ignore){}
      }
    };
  }

  async function openReviewWithAirReview(flights){
    if(tyIsPassportScanBusy() || tyPassportScanLockActive() || tyPassportUploadIntentActive()){
      const current = Array.isArray(flights) ? flights.filter(Boolean) : [flights].filter(Boolean);
      try{ hideBookingLoader(); }catch(e){}
      if(current.length) renderFlightReviewStep(current);
      return;
    }
    flights = Array.isArray(flights)?flights.filter(Boolean):[flights].filter(Boolean);
    if(!flights.length) return;
    showBookingLoader();
    try{
      const review = await fetchAirReviewForFlights(flights);
      applyReviewDataToFlights(flights, review);
      const changes = detectReviewChanges(flights, review);
      hideBookingLoader();
      if(changes.length){ renderChangeConfirm(flights, changes, {onContinue:function(){ renderFlightReviewStep(flights); }, onBack:openFlightSearchPage}); return; }
      renderFlightReviewStep(flights);
    }catch(e){
      hideBookingLoader();
      renderFlightReviewStep(flights);
    }
  }

  function dateOnly(value){
    const d = value ? new Date(value) : new Date();
    if(Number.isNaN(d.getTime())) return null;
    d.setHours(0,0,0,0);
    return d;
  }

  function addDays(date, days){
    const d = dateOnly(date) || dateOnly(new Date());
    d.setDate(d.getDate() + Number(days || 0));
    return d;
  }

  function addYears(date, years){
    const d = dateOnly(date) || dateOnly(new Date());
    d.setFullYear(d.getFullYear() + Number(years || 0));
    return d;
  }

  function dateRangeForSelect(mode, passengerType){
    const today = dateOnly(new Date());
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);
    const travel = dateOnly(state.search && state.search.departureDate) || today;
    const t = String(passengerType || '').toLowerCase();

    if(mode === 'passportIssue'){
      return { min:addYears(today, -100), max:yesterday, order:'desc' };
    }
    if(mode === 'passportExpiry'){
      const minExp = minPassportExpiryDate();
      const tomorrow = addDays(today, 1);
      return { min: minExp > tomorrow ? minExp : tomorrow, max:addYears(today, 30), order:'asc' };
    }
    if(mode === 'dob'){
      if(t.includes('adult')) return { min:addYears(travel, -120), max:addYears(travel, -12), order:'desc' };
      if(t.includes('child')) return { min:addDays(addYears(travel, -12), 1), max:addYears(travel, -2), order:'desc' };
      if(t.includes('infant')) return { min:addDays(addYears(travel, -2), 1), max: today < travel ? today : travel, order:'desc' };
      return { min:addYears(today, -120), max:today, order:'desc' };
    }
    if(mode === 'future') return { min:tomorrow, max:addYears(today, 30), order:'asc' };
    return { min:addYears(today, -120), max:today, order:'desc' };
  }

  function renderDateSelects(prefix, required, mode, passengerType){
    const req = required ? "required" : "";
    const range = dateRangeForSelect(mode, passengerType);
    const minDate = ymd(range.min);
    const maxDate = ymd(range.max);
    const days = Array.from({length:31},(_,i)=>{ const d=String(i+1).padStart(2,'0'); return `<option value="${d}">${d}</option>`; }).join("");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join("");
    const years = [];
    const start = range.min.getFullYear();
    const end = range.max.getFullYear();
    if(range.order === 'asc'){
      for(let y=start; y<=end; y++) years.push(y);
    }else{
      for(let y=end; y>=start; y--) years.push(y);
    }
    const common = `data-date-select="1" data-date-prefix="${esc(prefix)}" data-date-mode="${esc(mode || '')}" data-min-date="${esc(minDate)}" data-max-date="${esc(maxDate)}"`;
    return `<div class="ty-date3" data-date-range="${esc(prefix)}" data-min-date="${esc(minDate)}" data-max-date="${esc(maxDate)}"><select name="${prefix}Day" ${common} data-date-part="day" ${req}><option value="">Day</option>${days}</select><select name="${prefix}Month" ${common} data-date-part="month" ${req}><option value="">Month</option>${months}</select><select name="${prefix}Year" ${common} data-date-part="year" ${req}><option value="">Year</option>${years.map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div>`;
  }

  function renderDOBSelects(prefix, required, passengerType){ return renderDateSelects(prefix, required, 'dob', passengerType); }


  function orderedCountryCodes(){
    const list = COUNTRY_CODES.slice();
    list.sort(function(a,b){
      if(a[0] === "IN") return -1;
      if(b[0] === "IN") return 1;
      return String(a[1] || a[0]).localeCompare(String(b[1] || b[0]));
    });
    return list;
  }

  function countryFlagEmoji(countryCode){
    const cc = String(countryCode || '').trim().toUpperCase();
    if(!/^[A-Z]{2}$/.test(cc)) return '';
    return cc.replace(/./g, function(ch){
      return String.fromCodePoint(127397 + ch.charCodeAt(0));
    });
  }

  function tyPhoneCountryOptionLabel(row, expanded){
    const flag = countryFlagEmoji(row && row[0]);
    const code = row && row[2] ? String(row[2]) : '+91';
    const name = row && row[1] ? String(row[1]) : '';
    return `${flag ? flag + ' ' : ''}${code}${expanded && name ? ' ' + name : ''}`;
  }

  function countryCodeOptions(expanded){
    return orderedCountryCodes().map(function(c){
      const selected = c[0] === "IN" ? " selected" : "";
      const flag = countryFlagEmoji(c[0]);
      const label = tyPhoneCountryOptionLabel(c, !!expanded);
      return `<option value="${esc(c[2])}" data-country="${esc(c[0])}" data-name="${esc(c[1])}" data-flag="${esc(flag)}"${selected}>${esc(label)}</option>`;
    }).join("");
  }

  function tySetPhoneCountryOptions(select, expanded){
    if(!select) return;
    const current = String(select.value || '+91');
    select.innerHTML = countryCodeOptions(!!expanded);
    if(Array.from(select.options || []).some(function(o){ return String(o.value) === current; })) select.value = current;
    select.dataset.tyPhoneExpanded = expanded ? '1' : '0';
  }

  function tyBindPhoneCountryCodeSelects(scope){
    (scope || document).querySelectorAll('select[name="mobileCountryCode"]').forEach(function(select){
      if(!select || select.dataset.tyPhoneCompactBound === '1') return;
      select.dataset.tyPhoneCompactBound = '1';
      tySetPhoneCountryOptions(select, false);
      ['pointerdown','touchstart','mousedown','focus'].forEach(function(evt){
        select.addEventListener(evt, function(){ tySetPhoneCountryOptions(select, true); }, {passive:true});
      });
      ['change','blur'].forEach(function(evt){
        select.addEventListener(evt, function(){ setTimeout(function(){ tySetPhoneCountryOptions(select, false); }, 120); });
      });
    });
  }
  function selectedPhoneCountry(form){
    const select = form && form.querySelector('[name="mobileCountryCode"]');
    const option = select && select.options ? select.options[select.selectedIndex] : null;
    const dialCode = String(select && select.value || '+91').trim();
    let country = String(option && option.getAttribute('data-country') || '').toUpperCase();
    if(!country){
      const dialDigits = phoneDigits(dialCode);
      const row = COUNTRY_CODES.find(function(c){ return phoneDigits(c[2]) === dialDigits; });
      country = row ? String(row[0]).toUpperCase() : 'IN';
    }
    return {
      select: select,
      country: country,
      dialCode: dialCode
    };
  }

  function phoneDigits(value){
    return String(value || '').replace(/[^0-9]/g, '');
  }

  function normalizeNationalPhone(value, dialCode){
    let digits = phoneDigits(value);
    const dialDigits = phoneDigits(dialCode);
    if(dialDigits && digits.length > 8 && digits.startsWith(dialDigits)){
      digits = digits.slice(dialDigits.length);
    }
    return digits;
  }

  function phoneCountryName(country){
    const row = COUNTRY_CODES.find(function(c){ return c[0] === country; });
    return row ? row[1] : 'selected country';
  }

  function validPhoneForCountry(country, value, dialCode){
    const national = normalizeNationalPhone(value, dialCode);
    let c = String(country || '').toUpperCase();
    if(phoneDigits(dialCode) === '91') c = 'IN';
    const commonRules = {
      IN: {re:/^[6-9]\d{9}$/, msg:'Enter a valid 10 digit Indian mobile number.'},
      JP: {re:/^(?:0[789]0\d{8}|[789]0\d{8})$/, msg:'Enter a valid Japan mobile number for +81.'},
      US: {re:/^[2-9]\d{9}$/, msg:'Enter a valid 10 digit US mobile number.'},
      CA: {re:/^[2-9]\d{9}$/, msg:'Enter a valid 10 digit Canada mobile number.'},
      AE: {re:/^5\d{8}$/, msg:'Enter a valid UAE mobile number.'},
      SA: {re:/^5\d{8}$/, msg:'Enter a valid Saudi Arabia mobile number.'},
      QA: {re:/^[3567]\d{7}$/, msg:'Enter a valid Qatar mobile number.'},
      KW: {re:/^[569]\d{7}$/, msg:'Enter a valid Kuwait mobile number.'},
      BH: {re:/^[36]\d{7}$/, msg:'Enter a valid Bahrain mobile number.'},
      OM: {re:/^[79]\d{7}$/, msg:'Enter a valid Oman mobile number.'},
      SG: {re:/^[89]\d{7}$/, msg:'Enter a valid Singapore mobile number.'},
      MY: {re:/^1\d{8,9}$/, msg:'Enter a valid Malaysia mobile number.'},
      TH: {re:/^(?:0?)[689]\d{8}$/, msg:'Enter a valid Thailand mobile number.'},
      ID: {re:/^(?:0?8)\d{8,11}$/, msg:'Enter a valid Indonesia mobile number.'},
      BD: {re:/^(?:0?1)[3-9]\d{8}$/, msg:'Enter a valid Bangladesh mobile number.'},
      PK: {re:/^(?:0?3)\d{9}$/, msg:'Enter a valid Pakistan mobile number.'},
      NP: {re:/^[97]\d{9}$/, msg:'Enter a valid Nepal mobile number.'},
      LK: {re:/^(?:0?7)\d{8}$/, msg:'Enter a valid Sri Lanka mobile number.'},
      GB: {re:/^(?:0?7)\d{9}$/, msg:'Enter a valid UK mobile number.'},
      AU: {re:/^(?:0?4)\d{8}$/, msg:'Enter a valid Australia mobile number.'},
      NZ: {re:/^(?:0?2)\d{7,9}$/, msg:'Enter a valid New Zealand mobile number.'}
    };
    const rule = commonRules[c];
    if(rule){ return {valid: rule.re.test(national), national: national, message: rule.msg}; }
    const ok = /^\d{6,15}$/.test(national);
    return {valid: ok, national: national, message: 'Enter a valid mobile number for ' + phoneCountryName(c) + '.'};
  }

  function isValidEmailAddress(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
  }

  function contactPhoneFull(form){
    const phone = selectedPhoneCountry(form);
    const national = normalizeNationalPhone(form && form.querySelector('[name="mobile"]') && form.querySelector('[name="mobile"]').value, phone.dialCode);
    return phone.dialCode + national;
  }

  function nationalityOptions(selected){
    const current = String(selected || "IN").toUpperCase();
    return NATIONALITY_COUNTRIES.map(c=>`<option value="${esc(c[0])}" ${c[0]===current?'selected':''}>${esc(c[1])} (${esc(c[0])})</option>`).join("");
  }

  function requiredPassport(flights){ return passportRequiredForFlights(flights); }
  function requiredDob(flights){ return dobRequiredForFlights(flights); }

function normalizeCabin(value){
    const text = String(value || "ECONOMY").toUpperCase();
    if(text.includes("/") && text.includes("ECONOMY")) return "ECONOMY";
    if(text.includes("PREMIUM") && text.includes("ECONOMY")) return "PREMIUM_ECONOMY";
    if(text.includes("BUSINESS")) return "BUSINESS";
    if(text.includes("FIRST")) return "FIRST";
    return "ECONOMY";
  }

  function normalizeFare(value){
    const text = String(value || "REGULAR").toUpperCase();
    if(text.includes("STUDENT")) return "STUDENT";
    if(text.includes("SENIOR")) return "SENIOR_CITIZEN";
    return "REGULAR";
  }

  function addRoute(routeInfos, from, to, date){
    if(from && to && date){
      routeInfos.push({
        fromCityOrAirport: { code: String(from).toUpperCase() },
        toCityOrAirport: { code: String(to).toUpperCase() },
        travelDate: String(date).slice(0,10)
      });
    }
  }

  function routeLegs(){
    const s = state.search;
    if(s.tripType === "roundtrip" && s.returnDate){
      return [
        {key:"onward", label:"Departure Flight", from:s.origin, to:s.destination, date:s.departureDate},
        {key:"return", label:"Return Flight", from:s.destination, to:s.origin, date:s.returnDate}
      ];
    }

    if(s.tripType === "multicity"){
      const routes = Array.isArray(s.routes) ? s.routes : [];
      const out = [];
      routes.forEach(function(r, index){
        const from = (r.fromCityOrAirport && r.fromCityOrAirport.code) || r.fromCode || r.from || r.origin || r.source;
        const to = (r.toCityOrAirport && r.toCityOrAirport.code) || r.toCode || r.to || r.destination || r.dest;
        const date = r.travelDate || r.date || r.departureDate;
        if(from && to && date) out.push({key:"leg"+index, label:"Flight " + (index+1), from, to, date});
      });
      if(out.length) return out;
    }

    return [{key:"onward", label:"Flights", from:s.origin, to:s.destination, date:s.departureDate}];
  }

  /* Same shape as homepage search-bar supplierPayload, so date-chip search
     matches the working initial search (from/to/cabin/passengers/searchModifiers). */
  function buildWorkingFlightSearchPayload(opts){
    opts = opts || {};
    const s = state.search || {};
    const from = String(opts.from || s.origin || "").toUpperCase();
    const to = String(opts.to || s.destination || "").toUpperCase();
    const departureDate = String(opts.departureDate || s.departureDate || "").slice(0, 10);
    const tripType = opts.forceOneway ? "oneway" : String(opts.tripType || s.tripType || "oneway");
    let returnDate = "";
    if(tripType === "roundtrip"){
      returnDate = String(opts.returnDate != null ? opts.returnDate : (s.returnDate || "")).slice(0, 10);
      if(returnDate && departureDate && returnDate < departureDate) returnDate = departureDate;
    }
    const fareType = normalizeFare(s.fareType);
    const cabin = normalizeCabin(s.cabinClass);
    const adults = Math.max(1, Number(s.adults || 1));
    const children = Math.max(0, Number(s.children || 0));
    const infants = Math.max(0, Number(s.infants || 0));
    const pftMod = (fareType === "STUDENT" || fareType === "SENIOR_CITIZEN") ? fareType : "REGULAR";
    const routeInfos = [];
    if(opts.forceOneway || tripType === "oneway"){
      addRoute(routeInfos, from, to, departureDate);
    }else{
      routeLegs().forEach(function(leg){
        const legDate = leg.key === "onward" ? departureDate : (leg.key === "return" ? (returnDate || leg.date) : leg.date);
        addRoute(routeInfos, leg.from, leg.to, legDate);
      });
      if(!routeInfos.length){
        addRoute(routeInfos, from, to, departureDate);
        if(returnDate) addRoute(routeInfos, to, from, returnDate);
      }
    }
    return {
      from: from,
      to: to,
      departureDate: departureDate,
      returnDate: tripType === "oneway" ? "" : returnDate,
      tripType: tripType,
      passengers: {adults: adults, children: children, infants: infants},
      cabin: cabin,
      cabinClass: cabin,
      fareType: fareType,
      pft: fareType,
      adults: adults,
      children: children,
      infants: infants,
      searchModifiers: {pft: pftMod},
      searchQuery: {
        cabinClass: cabin,
        preferredAirline: [],
        searchModifiers: {pft: pftMod},
        routeInfos: routeInfos,
        paxInfo: {ADULT: adults, CHILD: children, INFANT: infants}
      }
    };
  }

  function buildSingleLegPayload(from, to, date){
    return buildWorkingFlightSearchPayload({
      from: from,
      to: to,
      departureDate: date,
      forceOneway: true
    });
  }

  function buildApiPayload(){
    return buildWorkingFlightSearchPayload({});
  }

  function persistFlightSearchSession(pickedDate){
    const picked = normalizeFutureYmd(pickedDate || state.search.departureDate);
    state.search.departureDate = picked;
    if(state.search.tripType === "roundtrip" && state.search.returnDate){
      state.search.returnDate = normalizeFutureYmd(state.search.returnDate);
      if(state.search.returnDate < picked) state.search.returnDate = picked;
    }
    const live = buildWorkingFlightSearchPayload({departureDate: picked, returnDate: state.search.returnDate});
    try{
      sessionStorage.setItem("tySearchContext", JSON.stringify(state.search));
      sessionStorage.setItem("ty_last_search_payload", JSON.stringify(Object.assign({type: "flight", service: "flight"}, live)));
      const existing = parseJSON(sessionStorage.getItem("tySearchPayload"), {});
      existing.service = "flight";
      existing.search = Object.assign({}, existing.search || {}, {
        from: state.search.origin,
        to: state.search.destination,
        origin: state.search.origin,
        destination: state.search.destination,
        departureDate: picked,
        depart: picked,
        returnDate: state.search.returnDate || "",
        tripType: state.search.tripType,
        adults: state.search.adults,
        children: state.search.children,
        infants: state.search.infants,
        cabin: live.cabin,
        cabinClass: live.cabin,
        fareType: live.fareType
      });
      existing.livePayload = Object.assign({}, existing.livePayload || {}, live);
      existing.createdAt = new Date().toISOString();
      sessionStorage.setItem("tySearchPayload", JSON.stringify(existing));
      sessionStorage.removeItem("ty_live_results_flight");
      sessionStorage.removeItem("ty_flight_search_error");
    }catch(e){}
    return live;
  }
  function readCachedFlightResults(){
    try{
      const raw = sessionStorage.getItem("ty_live_results_flight");
      if(!raw) return [];
      return extractArray(JSON.parse(raw));
    }catch(e){ return []; }
  }

  function extractArray(raw){
    if(!raw) return [];

    if(Array.isArray(raw)){
      return raw;
    }

    /*
      REAL RESULT ARRAYS ONLY:
      Do not read searchQuery.routeInfos, routes, sI/SI or segments as top-level results.
      Those are request/segment objects and are not customer-search results.
    */
    const directKeys = [
      "flights","results","items","list","fareOptions",
      "tripInfos","totalTripInfos","searchResult","tripInfosMap",
      "ONWARD","RETURN","COMBO"
    ];

    for(const key of directKeys){
      const value = raw[key];
      if(Array.isArray(value)){
        if(value.length) return value;
        continue;
      }
      if(value && typeof value === "object"){
        const found = extractArray(value);
        if(found.length) return found;
      }
    }

    if(raw.data){
      const found = extractArray(raw.data);
      if(found.length) return found;
    }

    const nested = [
      raw.tripjackRaw,
      raw.response,
      raw.result,
      raw.searchResult,
      raw.raw,
      raw.data && raw.data.raw,
      raw.data && raw.data.searchResult
    ];
    for(const item of nested){
      if(item && item !== raw){
        const found = extractArray(item);
        if(found.length) return found;
      }
    }

    const skipKeys = {
      routeInfos:true,
      routeInfo:true,
      routes:true,
      searchQuery:true,
      searchModifiers:true,
      preferredAirline:true,
      paxInfo:true,
      sI:true,
      SI:true,
      segments:true,
      flightSegments:true,
      seg:true
    };

    if(raw && typeof raw === "object"){
      const collected = [];
      Object.keys(raw).forEach(function(key){
        if(skipKeys[key]) return;
        const value = raw[key];
        if(Array.isArray(value)){
          value.forEach(function(x){ collected.push(x); });
        }else if(value && typeof value === "object"){
          const found = extractArray(value);
          if(found.length) found.forEach(function(x){ collected.push(x); });
        }
      });
      if(collected.length) return collected;
    }

    return [];
  }
  function tyResultAmount(item){
    if(!item || typeof item !== "object") return 0;
    const direct = Number(pick(item, [
      "price","amount","totalAmount","totalFare","fare.total","fare.totalFare","pricing.total",
      "fd.ADULT.fC.TF","totalPriceInfo.totalFareDetail.fC.TF",
      "totalPriceList.0.fd.ADULT.fC.TF",
      "totalPriceList.0.fareDetail.ADULT.fC.TF",
      "totalPriceList.0.totalFareDetail.fC.TF",
      "totalPriceList.0.totalPriceInfo.totalFareDetail.fC.TF",
      "priceList.0.fd.ADULT.fC.TF",
      "priceList.0.totalPriceInfo.totalFareDetail.fC.TF"
    ], 0)) || 0;
    if(direct > 0) return direct;

    const lists = [item.totalPriceList, item.priceList, item.fares, item.fareOptions, item.prices].filter(Array.isArray);
    for(const rows of lists){
      for(const row of rows){
        const value = Number(pick(row || {}, [
          "price","amount","totalAmount","totalFare","totalPrice",
          "fd.ADULT.fC.TF","fareDetail.ADULT.fC.TF",
          "totalFareDetail.fC.TF","totalPriceInfo.totalFareDetail.fC.TF"
        ], 0)) || 0;
        if(value > 0) return value;
      }
    }
    return 0;
  }

  function tyRealFlightCard(flight){
    if(!flight || typeof flight !== "object") return false;
    if(!(Number(flight.price || 0) > 0)) return false;
    const airlineName = String(flight.airlineName || "").trim();
    const flightCode = String(flight.flightCode || "").trim();
    if((!airlineName || airlineName.toLowerCase() === "airline") && !flightCode) return false;
    if(!flight.departureCity || !flight.arrivalCity) return false;
    if(!flight.departureTime || !flight.arrivalTime || flight.departureTime === "--:--" || flight.arrivalTime === "--:--") return false;
    return true;
  }


  function normalizeFlight(item, index, leg){
    const apiSegments = tyCollectTripjackSegments(item);
    const segments = apiSegments.length ? apiSegments : (Array.isArray(item.segments) ? item.segments : (Array.isArray(item.sI) ? item.sI : []));
    const first = segments[0] || {};
    const last = segments[segments.length-1] || first;
    const price = tyResultAmount(item);
    const depTime = pick(item, ["departureTime","depTime","departure.time","departureDateTime","departureDate","depDate","dt","dT","dep"], pick(first, ["dt","dT","dep","departureTime","depTime","departure.time","departureDateTime","departureDate","depDate"], ""));
    const arrTime = pick(item, ["arrivalTime","arrTime","arrival.time","arrivalDateTime","arrivalDate","arrDate","at","aT","arr"], pick(last, ["at","aT","arr","arrivalTime","arrTime","arrival.time","arrivalDateTime","arrivalDate","arrDate"], ""));
    const airlineName = pick(item, ["airlineName","airline","carrierName","carrier"], pick(first, ["fD.aI.name","fD.al.name","airlineName","airline"], ""));
    const airlineCode = pick(item, ["airlineCode","carrierCode"], pick(first, ["fD.aI.code","fD.al.code"], ""));
    const flightNumber = pick(item, ["flightCode","flightNumber","flightNo"], pick(first, ["fD.fN","flightNumber","flightNo"], ""));
    const stops = Number(pick(item, ["stops","stopCount"], segments.length ? Math.max(0, segments.length-1) : 0)) || 0;

    const from = String(pick(item, ["departureCity","from","origin","source"], pick(first, ["da.code","da.cityCode","from","origin"], leg ? leg.from : state.search.origin)));
    const to = String(pick(item, ["arrivalCity","to","destination","dest"], pick(last, ["aa.code","aa.cityCode","to","destination"], leg ? leg.to : state.search.destination)));

    return {
      id: String(pick(item, ["id","priceId","fareId"], (leg ? leg.key : "FLIGHT") + "-" + index)),
      legKey: leg ? leg.key : "onward",
      legLabel: leg ? leg.label : "Flight",
      raw: item,
      ipa: Boolean(pick(item, ["ipa","review.ipa"], false)),
      airlineName: String(airlineName || ""),
      airlineCode: String(airlineCode || "").toUpperCase(),
      airlineLogoUrl: String(pick(item, ["airlineLogoUrl","logo","logoUrl"], "")),
      flightCode: String((airlineCode || "") + (flightNumber ? (" " + flightNumber) : "")) || String(flightNumber || ""),
      departureTime: timeText(depTime),
      departureCity: from,
      arrivalTime: timeText(arrTime),
      arrivalCity: to,
      duration: durationText(pick(item, ["duration","durationMinutes","journeyTime","totalDuration"], segments.reduce((sum, seg) => sum + Number(seg.duration || seg.d || 0), 0))),
      durationMinutes: durationMinutes(pick(item, ["duration","durationMinutes","journeyTime","totalDuration"], segments.reduce((sum, seg) => sum + Number(seg.duration || seg.d || 0), 0))),
      stops,
      price,
      pricingBreakup: item.pricingBreakup || item.priceBreakup || item.priceBreakdown || {},
      resultDisplayAmount: item.resultDisplayAmount || item.displayPrice || price,
      displayPrice: item.displayPrice || item.resultDisplayAmount || price,
      segments: normalizeSegments(segments, from, to, item, leg),
      baggage: tyFirstRealBaggageText(pick(item, ["baggage","checkInBaggage","checkinBaggage","baggage.checkIn","iB"], "")),
      refundable: pick(item, ["refundable","isRefundable"], false) === true || Number(pick(item, ["refundableType","rT"], 0)) === 1,
      seatsLeft: String(pick(item, ["seatsLeft","availableSeats"], "")),
      fareType: String(pick(item, ["fareType","fareIdentifier","fareName"], "Published"))
    };
  }

  function injectStyles(){
    if(document.getElementById("ty-flight-style")) return;
    const style = document.createElement("style");
    style.id = "ty-flight-style";
    style.textContent = `
      :root{--emt-blue:#0066cc;--emt-orange:#ef6614;--emt-dark:#222;--emt-muted:#666;--emt-bg:#f5f7fa;--emt-white:#fff;--emt-border:#e7edf4;--emt-shadow:0 4px 16px rgba(7,29,73,.08);--emt-radius:8px;--emt-font:Inter,Roboto,Arial,sans-serif}
      body.travel-page{margin:0;background:var(--emt-bg);font-family:var(--emt-font);color:var(--emt-dark);overflow-x:hidden}
      button,input,select{font-family:inherit}
      .ty-fr-page{min-height:100vh;background:var(--emt-bg);max-width:100vw;overflow-x:hidden}
      .ty-fr-top{position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 30px 14px 16px;background:#fff;border-bottom:1px solid var(--emt-border);box-shadow:0 2px 10px rgba(7,29,73,.04);max-width:100vw;overflow:hidden}
      .ty-fr-back{border:0;background:#eef6ff;color:#071d49;border-radius:12px;width:44px;height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;font-size:34px;line-height:1;font-weight:900;cursor:pointer}.ty-fr-back:active{transform:scale(.98)}
      .ty-fr-head-text{min-width:0;flex:1}
      .ty-fr-title{margin:0;color:#071d49;font-size:18px;line-height:1.25;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ty-fr-meta{margin:4px 0 0;color:var(--emt-muted);font-size:13px;line-height:1.35;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ty-fr-modify{border:1px solid #dbe7f3;background:#fff;color:var(--emt-blue);border-radius:10px;padding:0;width:34px;height:34px;min-width:34px;display:inline-flex;align-items:center;justify-content:center;font-size:0;line-height:1;font-weight:950;cursor:pointer;box-shadow:0 4px 12px rgba(7,29,73,.08);white-space:nowrap}.ty-fr-modify:before{content:'✎';font-size:17px;line-height:1}.ty-fr-modify:hover{border-color:var(--emt-blue);background:#eef7ff}
      .ty-fr-shell{width:min(1180px,calc(100% - 32px));margin:18px auto 44px;display:grid;grid-template-columns:minmax(230px,25%) minmax(0,75%);gap:20px;align-items:start}
      .ty-fr-filter{position:sticky;top:78px;display:flex;flex-direction:column;gap:15px;background:#fff;border:1px solid var(--emt-border);border-radius:var(--emt-radius);box-shadow:var(--emt-shadow);padding:16px}
      .ty-fr-filter-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--emt-border);padding-bottom:10px;gap:10px}
      .ty-fr-filter-head h2{margin:0;color:#071d49;font-size:16px;line-height:1.25;font-weight:800}
      .ty-fr-clear{border:0;background:transparent;color:var(--emt-blue);font-size:12px;line-height:1;font-weight:800;padding:4px;cursor:pointer}
      .ty-fr-filter-foot{position:sticky;bottom:0;background:#fff;border-top:1px solid #e5edf7;margin:14px -2px -2px;padding:12px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:10px}.ty-fr-filter-foot button{border:1px solid #dbe7f3;border-radius:12px;min-height:42px;font-size:13px;font-weight:950;background:#fff;color:#071d49}.ty-fr-filter-foot button[data-apply-filters]{border-color:#0062e3;background:linear-gradient(135deg,#0062e3,#071d49);color:#fff}.ty-filter-body{display:flex;flex-direction:column;gap:15px;min-height:0}.ty-fr-range{width:100%;max-width:100%;box-sizing:border-box;}
      .ty-fr-group{display:flex;flex-direction:column;gap:10px}
      .ty-fr-group h3{margin:0;color:#222;font-size:14px;line-height:1.25;font-weight:800}
      .ty-fr-check{display:flex;align-items:center;gap:8px;color:#333;font-size:13px;line-height:1.3;font-weight:600;min-height:22px;cursor:pointer}
      .ty-fr-check input{width:15px;height:15px;margin:0;accent-color:var(--emt-blue)}
      .ty-fr-range{width:100%;accent-color:var(--emt-blue)}
      .ty-fr-range-label{display:flex;justify-content:space-between;gap:8px;color:#666;font-size:12px;line-height:1.2;font-weight:700}
      .ty-filter-sort-list{display:flex;flex-wrap:wrap;gap:8px}.ty-filter-sort-list button{font-size:12px;min-height:34px;border-radius:10px}
      .ty-fr-results{min-width:0;display:flex;flex-direction:column;gap:16px;overflow:hidden}
      .ty-fr-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px}
      .ty-fr-count{margin:0;color:#071d49;font-size:16px;line-height:1.25;font-weight:800}
      .ty-fr-sort{border:1px solid #dce6f1;background:#fff;color:#222;border-radius:4px;padding:8px 10px;font-size:13px;font-weight:700;outline:none;max-width:180px}
      .ty-fr-list{display:flex;flex-direction:column;gap:16px;min-width:0;overflow:hidden}
      .ty-leg-title{margin:6px 0 0;color:#071d49;font-size:16px;font-weight:900;line-height:1.3}
      .ty-leg-sub{margin:2px 0 8px;color:#666;font-size:12px;font-weight:700}
      .ty-flight-card{display:flex;width:100%;min-width:0;background:#fff;border:1px solid var(--emt-border);border-radius:var(--emt-radius);box-shadow:var(--emt-shadow);overflow:hidden}
      .ty-flight-card.selected{border-color:#0066cc;box-shadow:0 0 0 2px rgba(0,102,204,.14),var(--emt-shadow)}
      .ty-airline-col{flex:0 0 120px;width:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px 12px;border-right:1px solid #f0f2f5;text-align:center;min-height:142px}
      .ty-logo-box{width:48px;height:48px;border-radius:12px;background:#eef6ff;display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--emt-blue);font-size:18px;font-weight:800;flex:0 0 auto}.ty-logo-box-small{width:34px;height:34px;border-radius:9px;font-size:12px}.ty-multi-logo-set{display:flex;align-items:center;gap:5px;flex:0 0 auto}.ty-airline-multi{align-items:flex-start}.ty-multi-airline-names{min-width:0;display:flex;flex-direction:column;gap:2px}.ty-multi-airline-names b{display:block;font-size:14px!important;line-height:1.25;white-space:normal;word-break:break-word}.ty-multi-airline-names b span{display:inline!important;color:#333!important;font-size:13px!important;font-weight:700!important}
      .ty-logo-img{width:100%;height:100%;object-fit:contain;display:block}
      .ty-airline-name{max-width:100%;margin:0;color:#222;font-size:13px;line-height:1.3;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ty-flight-code{margin:0;color:#666;font-size:12px;line-height:1.2;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
      .ty-timeline-col{flex:1 1 auto;min-width:0;padding:18px 18px 16px;display:flex;flex-direction:column;justify-content:center;gap:10px}
      .ty-time-row{display:grid;grid-template-columns:minmax(76px,92px) minmax(120px,1fr) minmax(76px,92px);gap:14px;align-items:center;min-width:0}
      .ty-time-block{min-width:0}.ty-time-block.arrival{text-align:right}
      .ty-time{display:block;color:#222;font-size:20px;line-height:1;font-weight:800;white-space:nowrap}
      .ty-city{display:block;margin-top:8px;color:#666;font-size:13px;line-height:1.2;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ty-duration-block{text-align:center;min-width:0}
      .ty-duration{display:block;color:#666;font-size:13px;line-height:1.2;font-weight:700;white-space:nowrap}
      .ty-route-line{display:block;position:relative;height:2px;margin:8px 0;background:#d9dde5}
      .ty-route-line:before,.ty-route-line:after{content:"";position:absolute;top:50%;width:9px;height:9px;border-radius:50%;background:#fff;border:2px solid #d9dde5;transform:translateY(-50%)}
      .ty-route-line:before{left:0}.ty-route-line:after{right:0}
      .ty-stops{display:block;color:#314b8d;font-size:13px;line-height:1.2;font-weight:800;white-space:nowrap}
      .ty-detail-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0}
      .ty-chip{display:inline-flex;align-items:center;border-radius:999px;background:#f1f8e9;border:1px solid #d9edc7;color:#2b641f;padding:6px 10px;font-size:12px;line-height:1;font-weight:800;white-space:nowrap}
      .ty-price-col{flex:0 0 180px;width:180px;border-left:1px solid #eee;padding:18px 24px 18px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;background:#fff}
      .ty-price{color:#222;font-size:24px;line-height:1;font-weight:900;white-space:nowrap}
      .ty-price-sub{color:#666;font-size:11px;line-height:1.2;font-weight:600;margin-top:-6px}
      .ty-book-btn{border:0;border-radius:4px;background:var(--emt-orange);color:#fff;padding:10px 16px;min-width:108px;font-size:14px;line-height:1;font-weight:800;cursor:pointer;white-space:nowrap}
      .ty-continue-box{position:sticky;bottom:12px;z-index:20;background:#fff;border:1px solid #dce6f1;border-radius:12px;box-shadow:0 10px 28px rgba(7,29,73,.14);padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .ty-continue-box span{font-size:13px;color:#666;font-weight:800}
      .ty-continue-box button{border:0;background:#ef6614;color:#fff;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:900}
      .ty-empty{background:#fff;border:1px solid var(--emt-border);border-radius:var(--emt-radius);box-shadow:var(--emt-shadow);padding:34px 18px;text-align:center;color:#071d49}
      .ty-empty h2{margin:0 0 8px;font-size:18px;line-height:1.3;font-weight:800}
      .ty-empty p{margin:0;color:#666;font-size:13px;line-height:1.5;font-weight:600}
      .ty-fr-mobile-filter{display:none;position:fixed;left:12px;right:24px;bottom:0;z-index:60;background:transparent;padding:10px 0 calc(10px + env(safe-area-inset-bottom));box-shadow:none}
      .ty-fr-mobile-filter button{width:100%;border:0;border-radius:999px;background:var(--emt-blue);color:#fff;min-height:44px;font-size:14px;line-height:1;font-weight:800}
      .ty-fr-overlay{display:none;position:fixed;inset:0;z-index:70;background:rgba(7,29,73,.42)}
      @keyframes tyFly{from{transform:translateY(6px)}to{transform:translateY(-8px)}}

      .ty-review-page{min-height:100vh;background:#f5f7fa;color:#222;font-family:Inter,Roboto,Arial,sans-serif;max-width:100vw;overflow-x:hidden}
      .ty-review-top{display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;align-items:center;background:#fff;border-bottom:1px solid #e7edf4;padding:12px 16px;box-shadow:0 2px 10px rgba(7,29,73,.04)}
      .ty-review-back{border:0;background:#fff;color:#071d49;font-size:36px;font-weight:900;line-height:1}
      .ty-review-top h1{margin:0;color:#222;font-size:20px;line-height:1.25;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ty-review-top p{margin:3px 0 0;color:#666;font-size:13px;line-height:1.35;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ty-review-shell{width:min(1180px,calc(100% - 32px));margin:18px auto 44px;display:grid;grid-template-columns:minmax(0,70%) minmax(280px,30%);gap:20px;align-items:start}
      .ty-review-left{display:flex;flex-direction:column;gap:16px;min-width:0}
      .ty-review-card,.ty-fare{background:#fff;border:1px solid #e7edf4;border-radius:8px;box-shadow:0 4px 16px rgba(7,29,73,.08);padding:18px;min-width:0;max-width:100%}
      .ty-review-card h2,.ty-fare h2{margin:0 0 14px;color:#222;font-size:20px;line-height:1.3;font-weight:900}
      .ty-review-card h3{margin:16px 0 12px;color:#222;font-size:18px;line-height:1.3;font-weight:900}
      .ty-summary-list{display:flex;flex-direction:column;gap:12px}
      .ty-summary-item{display:grid;grid-template-columns:52px minmax(0,1fr);gap:12px;align-items:start;border:1px solid #eef2f7;border-radius:10px;padding:12px}
      .ty-review-logo{width:48px;height:48px;border-radius:12px;background:#eef6ff;color:#0066cc;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;overflow:hidden}
      .ty-review-logo-img{width:100%;height:100%;object-fit:contain;display:block}
      .ty-review-air{margin:0;color:#222;font-size:15px;line-height:1.35;font-weight:900;overflow-wrap:anywhere}
      .ty-review-route{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px}
      .ty-review-route span{display:flex;flex-direction:column;gap:4px}
      .ty-review-route b{color:#222;font-size:18px;line-height:1;font-weight:900}
      .ty-review-route em{font-style:normal;color:#666;font-size:13px;font-weight:800}
      .ty-review-route i{font-style:normal;color:#0066cc;font-weight:900}
      .ty-review-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .ty-review-tags span{border-radius:999px;background:#f1f8e9;border:1px solid #d9edc7;color:#2b641f;padding:6px 10px;font-size:12px;line-height:1;font-weight:900;white-space:nowrap}
      .ty-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .ty-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
      .ty-form-grid label{display:flex;flex-direction:column;gap:6px;min-width:0}
      .ty-form-grid span{color:#666;font-size:12px;line-height:1.2;font-weight:800}
      .ty-form-grid input,.ty-form-grid select{width:100%;min-height:42px;border:1px solid #dce6f1;border-radius:4px;background:#fff;padding:8px;color:#222;font-size:14px;font-weight:700;outline:none}
      .ty-form-error{display:none;color:#d93025;font-size:12px;font-weight:800;margin:12px 0 0}
      .ty-offers{display:flex;flex-direction:column;gap:10px}
      .ty-offer-card{border:1px solid #dce6f1;background:#fff;border-radius:10px;padding:12px;display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:10px;align-items:start;cursor:pointer}
      .ty-offer-card.active{border-color:#0066cc;background:#f5faff;box-shadow:0 0 0 2px rgba(0,102,204,.08)}
      .ty-offer-radio{width:16px;height:16px;border-radius:50%;border:2px solid #94a3b8;margin-top:2px}
      .ty-offer-card.active .ty-offer-radio{border-color:#0066cc;background:radial-gradient(circle,#0066cc 45%,transparent 48%)}
      .ty-offer-card b{display:block;color:#222;font-size:13px;font-weight:900}
      .ty-offer-card p{margin:4px 0 0;color:#666;font-size:12px;line-height:1.35;font-weight:700}
      .ty-offer-code{color:#0066cc;background:#eef6ff;border-radius:999px;padding:6px 8px;font-size:11px;font-weight:900;white-space:nowrap}
      .ty-fare{position:sticky;top:18px;overflow:hidden}
      .ty-fare h2{font-size:16px}
      .ty-fare-row,.ty-total-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0;color:#333;font-size:14px;font-weight:700;min-width:0}
      .ty-fare-row span,.ty-total-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ty-fare-row b,.ty-total-row b{white-space:nowrap}
      .ty-total-row{font-size:20px;color:#222;font-weight:900}
      .ty-discount{color:#17803d!important}
      .ty-divider{height:1px;background:#e7edf4;margin:12px 0}
      .ty-payment-btn{width:100%;border:0;border-radius:4px;background:#ef6614;color:#fff;padding:12px;font-size:16px;line-height:1;font-weight:900}
      .ty-payment-btn:disabled{background:#cbd5e1;cursor:not-allowed}
      .ty-booking-loader{position:fixed;inset:0;z-index:2147483200;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:24px;text-align:left;color:#111827;font-family:Inter,Roboto,Arial,sans-serif}
      .ty-booking-loader strong{font-size:24px;line-height:1.18;font-weight:900;max-width:260px}
      .ty-booking-spinner{width:28px;height:28px;border:5px solid #e5eef8;border-top-color:#0b8bea;border-radius:50%;animation:tyBookingSpin .8s linear infinite}
      @keyframes tyBookingSpin{to{transform:rotate(360deg)}}
      .ty-pay-msg{font-size:12px;line-height:1.4;font-weight:800;margin:10px 0 0;color:#666}
      .ty-pay-msg.error{color:#d93025}

      .ty-chip-sort{display:flex;flex-direction:column;gap:10px;margin:-2px 0 14px!important;align-items:stretch!important;}
      .ty-smart-chips{display:flex!important;gap:10px!important;align-items:center!important;flex-wrap:wrap!important;justify-content:flex-start!important;}
      .ty-smart-chips button,.ty-main-sort button,.ty-filter-inline,.ty-filter-sort-list button{border:1px solid #dce6f1;background:#fff;border-radius:12px;padding:8px 12px;color:#071d49;font-weight:900;min-height:38px;white-space:nowrap;cursor:pointer;}
      .ty-smart-chips button[data-chip-sort="priceLow"],.ty-smart-chips button[data-chip-sort="durationLow"]{min-width:150px;text-align:center;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;}.ty-smart-chips button small{font-size:10px!important;line-height:1!important;color:#eb5e28!important;font-weight:950!important;letter-spacing:0!important;white-space:nowrap!important;}.ty-filter-inline{min-width:126px;text-align:center;border-color:#0062e3!important;color:#0062e3!important;background:#fff!important;}
      .ty-smart-chips button.active,.ty-filter-sort-list button.active{border-color:#0062e3;background:#eef6ff;color:#0062e3;}.ty-main-sort button.active{border-color:transparent!important;background:transparent!important;color:#071d49!important;}
      .ty-other-sort-stack{display:flex;flex-direction:column;gap:8px;align-items:stretch;flex:0 0 auto;margin-left:auto;}
      .ty-filter-under-other{display:none;border-color:#0062e3!important;color:#0062e3!important;background:#fff!important;text-align:center!important;}
      .ty-result-sort-row{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:12px!important;width:100%!important;position:relative!important;}
      .ty-main-sort{display:flex!important;gap:34px!important;align-items:center!important;flex-wrap:nowrap!important;padding:0 0 0 6px!important;}
      .ty-other-sort{position:relative!important;margin-left:auto!important;flex:0 0 auto!important;}
      .ty-other-sort-menu{position:absolute!important;right:0!important;top:calc(100% + 8px)!important;z-index:55!important;background:#fff!important;border:1px solid #dce6f1!important;border-radius:12px!important;box-shadow:0 18px 44px rgba(7,29,73,.16)!important;padding:8px!important;min-width:190px!important;}
      .ty-other-sort-menu button{display:block!important;width:100%!important;border:0!important;background:#fff!important;text-align:left!important;border-radius:9px!important;padding:10px 12px!important;color:#071d49!important;font-weight:850!important;}
      .ty-filter-top-row{display:flex!important;gap:10px!important;align-items:center!important;justify-content:flex-start!important;flex-wrap:nowrap!important;width:100%!important;}
      .ty-filter-top-row .ty-smart-chips{flex:1 1 auto!important;}
      .ty-main-sort button{border:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;min-height:auto!important;border-radius:0!important;color:#071d49!important;font-size:13px!important;line-height:1.2!important;font-weight:900!important;}
      .ty-main-sort button:focus,.ty-main-sort button:hover,.ty-main-sort button.active{border:0!important;background:transparent!important;color:#071d49!important;outline:none!important;}
      @media(max-width:767px){
        .ty-fr-top{padding:12px 30px 12px 12px}.ty-fr-title{font-size:16px}.ty-fr-meta{font-size:12px}.ty-fr-modify{width:32px!important;height:32px!important;min-width:32px!important;margin-right:8px}
        .ty-fr-shell{width:100%;margin:8px 0 84px;display:block;overflow:hidden}.ty-fr-results{padding:0 10px;gap:12px}.ty-fr-actions{padding:0 2px}.ty-smart-chips button[data-chip-sort="priceLow"],.ty-smart-chips button[data-chip-sort="durationLow"]{min-width:0!important;}.ty-smart-chips button small{font-size:9px!important;margin-left:3px!important}.ty-main-sort{gap:30px!important;padding-left:4px!important}.ty-main-sort button{font-size:12px!important}
        .ty-fr-filter{position:fixed;inset:0!important;z-index:80;transform:translateY(105%);transition:transform .24s ease;max-height:none;overflow:hidden!important;-webkit-overflow-scrolling:touch;border-radius:0!important;padding:0!important;background:#fff!important;display:flex!important;flex-direction:column!important}
        body.ty-filter-open{overflow:hidden!important}body.ty-filter-open .ty-fr-filter{transform:translateY(0)}body.ty-filter-open .ty-fr-overlay{display:block}.ty-fr-mobile-filter{display:none!important}.ty-filter-under-other{display:none!important}.ty-fr-filter-head{position:relative!important;top:auto!important;left:auto!important;right:auto!important;z-index:3;flex:0 0 auto!important;background:#fff;margin:0;padding:14px 16px 12px!important;border-bottom:1px solid #e5edf7!important}.ty-filter-back{border:0;background:#eef6ff;color:#071d49;border-radius:12px;min-width:40px;min-height:38px;font-size:24px;font-weight:900}.ty-filter-body{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding:16px 16px 14px!important;display:flex!important;flex-direction:column!important;gap:16px!important}.ty-fr-filter-foot{grid-template-columns:1fr!important;position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;z-index:4!important;flex:0 0 auto!important;background:#fff!important;padding:12px 16px calc(14px + env(safe-area-inset-bottom))!important;margin:0!important;border-top:1px solid #e5edf7!important}.ty-fr-filter-foot [data-clear-filters]{display:none!important}.ty-fr-filter-foot [data-apply-filters]{width:100%!important;min-height:52px!important;border-radius:14px!important}
        .ty-flight-card{flex-direction:column;border-radius:10px;width:100%;max-width:100%;overflow:hidden}
        .ty-airline-col{width:100%;flex:0 0 auto;min-height:auto;flex-direction:row;justify-content:space-between;border-right:0;border-bottom:1px solid #f0f2f5;padding:12px 14px;text-align:left}
        .ty-airline-identity{min-width:0;display:flex;align-items:center;gap:10px}.ty-logo-box{width:36px;height:36px;border-radius:10px;font-size:15px}
        .ty-airline-name{font-size:13px}.ty-flight-code{font-size:12px;text-align:right;flex:0 0 auto}
        .ty-timeline-col{padding:14px}.ty-time-row{grid-template-columns:minmax(58px,1fr) minmax(92px,1.35fr) minmax(58px,1fr);gap:8px}
        .ty-time{font-size:16px;font-weight:800}.ty-city{font-size:12px;margin-top:6px}.ty-duration,.ty-stops{font-size:12px}.ty-detail-row{margin-top:2px}
        .ty-price-col{width:100%;flex:0 0 auto;border-left:0;border-top:1px solid #f0f2f5;padding:12px 26px 12px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;text-align:left;align-items:center;background:#fbfcfe;max-width:100%;overflow:hidden}
        .ty-price{font-size:18px;grid-column:1}.ty-price-sub{grid-column:1;margin:0}.ty-book-btn{grid-column:2;grid-row:1/3;min-width:88px;max-width:102px;padding:10px 12px;font-size:14px;margin-right:12px}
        .ty-continue-box{left:10px;right:10px;bottom:72px;position:fixed}
        .ty-review-top{padding:12px 12px}
        .ty-review-top h1{font-size:18px}
        .ty-review-shell{width:100%;margin:12px 0 40px;padding:0 10px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
        .ty-review-card,.ty-fare{padding:14px;width:100%;max-width:100%;overflow:hidden}
        .ty-review-card h2{font-size:20px}.ty-review-card h3{font-size:18px}
        .ty-summary-item{grid-template-columns:44px minmax(0,1fr);gap:10px;padding:10px}
        .ty-review-logo{width:42px;height:42px;font-size:16px}
        .ty-review-route b{font-size:16px}
        .ty-form-grid,.ty-form-grid.two{grid-template-columns:1fr;gap:12px}
        .ty-fare{position:static;width:100%}
        .ty-total-row{font-size:19px}
        .ty-offer-card{grid-template-columns:20px minmax(0,1fr);gap:10px}
        .ty-offer-code{grid-column:2;justify-self:start}
      }

      /* : mobile right-clipping fix for review/fare/payment page */
      .ty-review-page,.ty-review-shell,.ty-review-card,.ty-fare,.ty-offer-card{box-sizing:border-box;max-width:100%}
      @media(max-width:767px){
        html,body{width:100%!important;max-width:100vw!important;overflow-x:hidden!important}
        #travelRoot,.ty-review-page{width:100%!important;max-width:100vw!important;overflow-x:hidden!important}
        .ty-review-top{width:100%!important;max-width:100vw!important;padding-right:18px!important;overflow:hidden!important}
        .ty-review-shell{
          width:100%!important;
          max-width:100vw!important;
          margin-left:0!important;
          margin-right:0!important;
          padding-left:10px!important;
          padding-right:18px!important;
          overflow:hidden!important;
        }
        .ty-review-left,.ty-review-card,.ty-fare{
          width:100%!important;
          max-width:100%!important;
          overflow:hidden!important;
        }
        .ty-summary-item,.ty-form-grid,.ty-form-grid.two,.ty-offer-card{
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
        }
        .ty-form-grid input,.ty-form-grid select{
          width:100%!important;
          max-width:100%!important;
        }
        .ty-fare-row,.ty-total-row{
          display:grid!important;
          grid-template-columns:minmax(0,1fr) auto!important;
          gap:10px!important;
          width:100%!important;
          max-width:100%!important;
          overflow:hidden!important;
        }
        .ty-fare-row b,.ty-total-row b{
          max-width:42vw!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          white-space:nowrap!important;
          justify-self:end!important;
        }
        .ty-total-row{font-size:18px!important}
        .ty-payment-btn{
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          display:block!important;
        }
        .ty-pay-msg{display:none!important}
      }

      .ty-roundtrip-card .ty-rt-body{gap:12px}
      .ty-rt-seg{border:1px solid #eef2f7;border-radius:10px;padding:10px;background:#fff}
      .ty-rt-seg-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
      .ty-rt-seg-head b{font-size:13px;font-weight:950;color:#071d49;white-space:nowrap}
      .ty-rt-seg-head span{font-size:12px;font-weight:800;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ty-rt-route{display:grid;grid-template-columns:82px minmax(80px,1fr) 82px;gap:8px;align-items:center}
      .ty-rt-route span{display:flex;flex-direction:column;gap:5px;min-width:0}
      .ty-rt-route span:last-child{text-align:right}
      .ty-rt-route strong{font-size:18px;line-height:1;font-weight:950;color:#222;white-space:nowrap}
      .ty-rt-route em{font-style:normal;font-size:12px;font-weight:800;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ty-rt-route i{font-style:normal;text-align:center;font-size:12px;font-weight:900;color:#314b8d;white-space:nowrap;position:relative}
      .ty-rt-route i:before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:#d9dde5;z-index:0}
      .ty-rt-route i{z-index:1}
      .ty-rt-route i::after{content:attr(data-text);background:#fff}
      @media(max-width:767px){
        .ty-roundtrip-card .ty-airline-col{align-items:center}
        .ty-roundtrip-card .ty-rt-body{padding:12px}
        .ty-rt-seg{padding:9px;max-width:100%;overflow:hidden}
        .ty-rt-seg-head{display:block}
        .ty-rt-seg-head span{display:block;margin-top:3px;max-width:100%}
        .ty-rt-route{grid-template-columns:58px minmax(70px,1fr) 58px;gap:6px}
        .ty-rt-route strong{font-size:16px}
        .ty-rt-route em,.ty-rt-route i{font-size:11px}
      }

      /* : hard mobile no-cut fix + open round-trip card */
      *,*::before,*::after{box-sizing:border-box}
      @media(max-width:767px){
        html,body{width:100%!important;max-width:100vw!important;overflow-x:hidden!important}
        #travelRoot{width:100%!important;max-width:100vw!important;overflow-x:hidden!important}
        .ty-fr-page,.ty-review-page{width:100%!important;max-width:100vw!important;overflow-x:hidden!important}
        .ty-fr-shell,.ty-review-shell{
          width:calc(100vw - 20px)!important;
          max-width:calc(100vw - 20px)!important;
          margin-left:10px!important;
          margin-right:10px!important;
          padding-left:0!important;
          padding-right:0!important;
          overflow:hidden!important;
        }
        .ty-fr-results,.ty-fr-list,.ty-flight-card,.ty-review-left,.ty-review-card,.ty-fare{
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          overflow:hidden!important;
        }
        .ty-review-card,.ty-fare{padding:12px!important}
        .ty-summary-item{
          grid-template-columns:42px minmax(0,1fr)!important;
          padding:10px!important;
          width:100%!important;
          overflow:hidden!important;
        }
        .ty-review-logo{width:40px!important;height:40px!important}
        .ty-review-air{font-size:14px!important;line-height:1.35!important}
        .ty-form-grid,.ty-form-grid.two{
          display:block!important;
          width:100%!important;
          max-width:100%!important;
        }
        .ty-form-grid label{display:block!important;margin-bottom:12px!important;width:100%!important}
        .ty-form-grid input,.ty-form-grid select{
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          display:block!important;
        }
        .ty-fare-row,.ty-total-row{
          display:grid!important;
          grid-template-columns:minmax(0,1fr) auto!important;
          width:100%!important;
          max-width:100%!important;
          overflow:hidden!important;
          gap:8px!important;
        }
        .ty-fare-row b,.ty-total-row b{
          justify-self:end!important;
          max-width:40vw!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          white-space:nowrap!important;
        }
        .ty-total-row{font-size:18px!important}
        .ty-payment-btn{width:100%!important;max-width:100%!important}
        .ty-pay-msg{display:none!important}
        .ty-roundtrip-card{
          border-radius:10px!important;
          overflow:hidden!important;
        }
        .ty-roundtrip-card .ty-airline-col{
          padding:12px!important;
          border-bottom:1px solid #edf2f7!important;
        }
        .ty-roundtrip-card .ty-rt-body{
          padding:12px!important;
          background:#fff!important;
        }
        .ty-rt-seg{
          border:0!important;
          border-radius:0!important;
          padding:12px 0!important;
          border-bottom:1px dashed #dce6f1!important;
          max-width:100%!important;
          overflow:hidden!important;
        }
        .ty-rt-seg:last-child{border-bottom:0!important}
        .ty-rt-route{
          grid-template-columns:62px minmax(74px,1fr) 62px!important;
          gap:8px!important;
        }
        .ty-rt-route strong{font-size:18px!important}
        .ty-rt-route em{font-size:12px!important}
        .ty-rt-route i{font-size:12px!important}
      }

      /* : compact traveller form, airport/phone fields, no mobile right cut */
      .ty-info-note{background:#fff3d9;color:#444;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.4;font-weight:800;margin-bottom:12px}
      .ty-gender-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
      .ty-gender-row label{border:1px solid #dce6f1;border-radius:8px;background:#fff;min-height:42px;display:flex;align-items:center;justify-content:center;color:#0066cc;font-size:13px;font-weight:950;cursor:pointer}
      .ty-gender-row input{display:none}.ty-gender-row label:has(input:checked){border-color:#0066cc;background:#eef6ff}
      .ty-form-grid.passenger{grid-template-columns:110px minmax(0,1fr) minmax(0,1fr)}
      .ty-form-grid.passport{grid-template-columns:repeat(3,minmax(0,1fr))}.ty-form-grid.contact{grid-template-columns:1fr 1fr}
      .ty-form-grid label span{margin-bottom:5px;display:block}.ty-form-grid input,.ty-form-grid select{min-height:38px!important;height:38px!important;padding:7px 9px!important}
      .ty-phone-row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:8px;width:100%}.ty-phone-row select,.ty-phone-row input{width:100%!important}
      @media(max-width:767px){
        .ty-review-shell{width:calc(100vw - 24px)!important;max-width:calc(100vw - 24px)!important;margin:12px 12px 40px!important;padding:0!important;overflow:hidden!important}
        .ty-review-card,.ty-fare{width:100%!important;max-width:100%!important;overflow:hidden!important;padding:12px!important}
        .ty-form-grid.passenger,.ty-form-grid.passport,.ty-form-grid.contact,.ty-form-grid.two{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
        .ty-form-grid input,.ty-form-grid select{height:38px!important;min-height:38px!important;font-size:13px!important}
        .ty-phone-row{grid-template-columns:86px minmax(0,1fr)!important}
        .ty-gender-row{grid-template-columns:1fr 1fr 1fr!important;gap:8px}.ty-gender-row label{min-height:38px;font-size:12px}
        .ty-review-route em{white-space:normal!important;overflow-wrap:anywhere!important}
        .ty-review-top,.ty-fr-top{max-width:100vw!important;overflow:hidden!important}
      }

      /*  final clean flight/result/review UI */
      .ty-fr-top.compact{padding:12px 14px 12px 14px}.ty-fr-head-text{min-width:0;overflow:hidden}.ty-fr-modify{flex:0 0 34px!important;margin-right:2px!important;max-width:34px!important;white-space:nowrap}.ty-fr-actions,.ty-fr-count{display:none!important}
      .ty-date-strip{display:flex;gap:8px;overflow-x:auto;padding:6px 0 10px;scrollbar-width:none}.ty-date-strip::-webkit-scrollbar{display:none}.ty-date-pill{min-width:108px;border:1px solid #dce6f1;background:#fff;border-radius:8px;padding:7px 8px;text-align:center;box-shadow:0 2px 7px rgba(7,29,73,.05)}.ty-date-pill.active{border-color:#ef6614;background:#fff8f3}.ty-date-pill b{display:block;color:#071d49;font-size:13px;line-height:1.1}.ty-date-pill span{display:block;margin-top:4px;color:#c4511a;font-size:12px;font-weight:800;white-space:nowrap}
      .ty-chip-sort{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.ty-smart-chips{display:flex;gap:8px;overflow-x:auto}.ty-smart-chips button{border:1px solid #dce6f1;background:#fff;border-radius:10px;padding:8px 12px;min-height:42px;min-width:108px}.ty-smart-chips b{font-size:13px;color:#071d49}.ty-smart-chips span{display:block;color:#666;font-size:11px;font-weight:800;margin-top:3px;white-space:nowrap}.ty-fr-sort{height:40px!important;min-width:154px}
      .ty-flight-card{display:grid;grid-template-columns:minmax(0,1fr) 170px;background:#fff;border:1px solid #e7edf4;border-radius:10px;box-shadow:0 4px 16px rgba(7,29,73,.08);overflow:hidden}.ty-card-main{padding:14px;min-width:0}.ty-airline{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;min-width:0}.ty-airline-left{display:flex;align-items:center;gap:10px;min-width:0}.ty-airline-left>div:last-child{min-width:0}.ty-airline-multi{gap:8px}.ty-multi-logo-set{gap:4px}.ty-logo-box-small{width:30px!important;height:30px!important;border-radius:8px}.ty-multi-airline-names b{font-size:13px!important}.ty-multi-airline-names b span{font-size:12px!important}.ty-airline b{font-size:15px;display:block;white-space:normal;word-break:break-word}.ty-airline span{display:block;font-size:12px;color:#666;font-weight:800}.ty-refund-badge{flex:0 0 auto;border-radius:999px;border:1px solid #d9edc7;background:#f1f8e9;color:#2b641f;padding:6px 9px;font-size:12px!important;line-height:1!important;font-weight:900!important;white-space:nowrap}.ty-refund-badge.no{border-color:#ffe0c2;background:#fff7ed;color:#b45309}.ty-time-grid{display:grid;grid-template-columns:145px minmax(170px,1fr) 145px;gap:12px;align-items:center}.ty-time-grid b{font-size:22px;color:#222}.ty-time-grid span{display:block;font-size:13px;font-weight:900;color:#071d49}.ty-time-grid em{display:block;font-style:normal;font-size:12px;line-height:1.35;color:#666;overflow:hidden;text-overflow:ellipsis}.ty-line{text-align:center}.ty-line span{font-size:12px;color:#666}.ty-line i{display:block;height:2px;background:#d9dde5;margin:7px 0}.ty-line small{font-size:12px;color:#314b8d;font-weight:900}.ty-card-tags,.ty-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ty-card-tags span{background:#f1f8e9;border:1px solid #d9edc7;border-radius:999px;padding:6px 10px;color:#2b641f;font-size:12px;font-weight:900}.ty-card-actions button{border:0;background:#eef6ff;color:#0066cc;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900}.ty-card-price{border-left:1px solid #eef2f7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:14px}.ty-card-price strong{font-size:23px}.ty-card-price span{font-size:11px;color:#666;font-weight:800}.ty-card-price .ty-book-btn{border:0;background:#ef6614;color:#fff;border-radius:7px;padding:10px 16px;font-size:14px;font-weight:900}
      
      /*  small modify icon safety */
      .ty-fr-modify{width:34px!important;height:34px!important;min-width:34px!important;max-width:34px!important;padding:0!important;border-radius:10px!important;font-size:0!important;overflow:hidden!important}
      .ty-fr-modify:before{content:'✎'!important;font-size:17px!important;line-height:1!important}
      @media(max-width:767px){.ty-fr-modify{width:32px!important;height:32px!important;min-width:32px!important;max-width:32px!important}.ty-fr-meta{max-width:calc(100vw - 92px)!important}}
.ty-detail-panel{grid-column:1/-1;border-top:1px solid #eef2f7;background:#fbfcfe;padding:12px 14px}.ty-detail-heading{font-size:14px;font-weight:950;color:#071d49;margin-bottom:10px}.ty-segment{background:#fff;border:1px solid #edf2f7;border-radius:10px;padding:10px;margin-bottom:10px}.ty-seg-air{display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:8px}.ty-seg-air span{color:#666;font-weight:800}.ty-seg-route{display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr);gap:10px;align-items:center}.ty-seg-route b{font-size:18px}.ty-seg-route span{display:block;font-size:12px;color:#666}.ty-seg-route em{font-style:normal;font-size:12px;color:#333;line-height:1.35}.ty-seg-route i{text-align:center;font-style:normal;font-size:12px;color:#314b8d;font-weight:900}.ty-layover{text-align:center;background:#eef6ff;border-radius:999px;padding:6px 10px;font-size:12px;color:#071d49;font-weight:800;margin-top:10px}.ty-detail-footer{display:flex;gap:8px;flex-wrap:wrap}.ty-detail-footer span{font-size:12px;background:#f1f8e9;border-radius:999px;padding:6px 10px;color:#2b641f;font-weight:900}
      .ty-rt-open h3{font-size:14px;color:#071d49;margin:10px 0 8px}.ty-review-shell{width:min(1180px,calc(100% - 32px));margin:16px auto 44px;display:grid;grid-template-columns:minmax(0,70%) minmax(300px,30%);gap:18px}.ty-review-top{display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;background:#fff;border-bottom:1px solid #e7edf4;padding:12px 16px}.ty-review-top h1{font-size:20px;margin:0}.ty-review-top p{margin:3px 0 0;color:#666;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ty-review-back{border:0;background:#fff;font-size:34px;color:#071d49}.ty-review-left{display:flex;flex-direction:column;gap:14px;min-width:0}.ty-review-card,.ty-fare{background:#fff;border:1px solid #e7edf4;border-radius:10px;box-shadow:0 4px 16px rgba(7,29,73,.08);padding:16px;min-width:0;max-width:100%;overflow:hidden}.ty-review-card h2,.ty-fare h2{font-size:18px;margin:0 0 12px}.ty-review-card h3{font-size:14px;color:#071d49;margin:16px 0 10px}.ty-alert{background:#fde8e8;border-left:4px solid #d93025;color:#9b1c1c;border-radius:8px;padding:10px 12px;font-size:13px;font-weight:900}.ty-summary-item{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;border:1px solid #eef2f7;border-radius:10px;padding:10px;margin-bottom:10px}.ty-review-logo{width:42px;height:42px;border-radius:10px;background:#eef6ff;display:flex;align-items:center;justify-content:center;color:#0066cc;font-weight:900}.ty-review-logo-img{width:100%;height:100%;object-fit:contain}.ty-review-air{font-size:14px;font-weight:900;margin:0 0 8px}.ty-review-tags{display:flex;gap:7px;flex-wrap:wrap}.ty-review-tags span{font-size:11px;background:#f1f8e9;border-radius:999px;padding:5px 8px;color:#2b641f;font-weight:900}.ty-info-note{background:#e9fff8;border-radius:8px;padding:9px 10px;font-size:12px;font-weight:800;color:#166534;margin-bottom:12px}.ty-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.ty-form-grid.two,.ty-form-grid.contact{grid-template-columns:repeat(2,minmax(0,1fr))}.ty-form-grid label{display:flex;flex-direction:column;gap:5px;min-width:0}.ty-form-grid span{font-size:12px;color:#555;font-weight:800}.ty-form-grid input,.ty-form-grid select{width:100%;height:38px;border:1px solid #dce6f1;border-radius:6px;padding:7px 9px;font-size:13px;font-weight:700;min-width:0}.ty-date3{display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:6px}.ty-phone-row{display:grid;grid-template-columns:96px minmax(0,1fr);gap:6px}.ty-form-error{color:#d93025;font-size:12px;font-weight:900;margin:10px 0 0}.ty-fare{position:sticky;top:14px}.ty-fare-row,.ty-total-row{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;margin:9px 0}.ty-total-row{font-size:18px;font-weight:950}.ty-divider{height:1px;background:#e7edf4;margin:12px 0}.ty-payment-btn{width:100%;border:0;border-radius:8px;background:#ef6614;color:#fff;padding:12px;font-size:15px;font-weight:950}.ty-offer-box{margin-top:16px}.ty-code-box{border:1px solid #dce6f1;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px}.ty-code-box strong{font-size:13px}.ty-code-box button{border:0;background:#fff;color:#0066cc;font-weight:900}.ty-offer-success{color:#17803d;font-size:12px;font-weight:900;line-height:1.35}.ty-offer-list{display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto}.ty-offer-card{border:1px solid #dce6f1;border-radius:10px;padding:10px;display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;cursor:pointer}.ty-offer-card.active{border-color:#0066cc;background:#f5faff}.ty-offer-radio{width:15px;height:15px;border-radius:50%;border:2px solid #94a3b8;margin-top:2px}.ty-offer-card.active .ty-offer-radio{border-color:#0066cc;background:radial-gradient(circle,#0066cc 45%,transparent 48%)}.ty-offer-card b{font-size:13px}.ty-offer-card p{font-size:12px;margin:4px 0 0;color:#666;line-height:1.35}
      @media(max-width:767px){html,body,#travelRoot{max-width:100vw!important;overflow-x:hidden!important}.ty-fr-top.compact{padding:10px 12px 10px 10px;align-items:center}.ty-fr-back{width:40px!important;height:40px!important;min-width:40px!important;font-size:30px!important}.ty-fr-title{font-size:16px!important}.ty-fr-meta{font-size:11px!important;max-width:calc(100vw - 90px)}.ty-fr-modify{width:32px!important;height:32px!important;min-width:32px!important;max-width:32px!important;padding:0!important;margin-right:0!important}.ty-fr-shell{width:calc(100vw - 20px)!important;max-width:calc(100vw - 20px)!important;margin:10px 10px 82px!important;display:block!important;overflow:hidden}.ty-fr-results{padding:0!important;overflow:hidden!important}.ty-date-pill{min-width:96px;padding:6px}.ty-chip-sort{display:block}.ty-smart-chips{padding-bottom:8px}.ty-smart-chips button{min-width:100px;min-height:38px;padding:6px 10px}.ty-fr-sort{width:100%;max-width:100%;height:38px!important}.ty-flight-card{grid-template-columns:1fr!important;width:100%!important;max-width:100%!important}.ty-card-main{padding:12px}.ty-time-grid{grid-template-columns:62px minmax(78px,1fr) 62px;gap:8px}.ty-time-grid b{font-size:18px}.ty-time-grid em{display:none}.ty-card-price{border-left:0;border-top:1px solid #eef2f7;display:grid;grid-template-columns:minmax(0,1fr) auto;text-align:left;padding:12px 24px 12px 12px}.ty-card-price .ty-book-btn{grid-column:2;grid-row:1/3;align-self:center;min-width:92px;max-width:110px}.ty-seg-route{grid-template-columns:1fr 68px 1fr}.ty-seg-route b{font-size:16px}.ty-review-shell{width:calc(100vw - 20px)!important;max-width:calc(100vw - 20px)!important;margin:10px 10px 40px!important;display:flex!important;flex-direction:column!important;gap:12px;overflow:hidden}.ty-review-card,.ty-fare{width:100%;max-width:100%;padding:12px}.ty-review-card h2{font-size:17px}.ty-form-grid,.ty-form-grid.two,.ty-form-grid.contact{display:block}.ty-form-grid label{margin-bottom:10px}.ty-form-grid input,.ty-form-grid select{height:36px}.ty-date3{grid-template-columns:1fr 1.1fr 1fr}.ty-phone-row{grid-template-columns:84px minmax(0,1fr)}.ty-fare{position:static}.ty-fare-row,.ty-total-row{display:grid;grid-template-columns:minmax(0,1fr) auto}.ty-fare-row b,.ty-total-row b{max-width:44vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ty-offer-list{max-height:none}.ty-fr-mobile-filter{left:10px!important;right:18px!important}}

      .ty-chip-sort{display:flex;align-items:center;gap:10px;margin:10px 0 14px;justify-content:space-between}.ty-smart-chips{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ty-smart-chips button{border:1px solid #dce6f1;background:#fff;border-radius:12px;padding:8px 12px;min-width:118px;text-align:left;color:#222;font-weight:900}.ty-smart-chips button.active{border-color:#0066cc;background:#eef6ff;color:#0066cc}.ty-smart-chips b{display:block;font-size:13px;line-height:1.1}.ty-smart-chips span{display:block;font-size:11px;line-height:1.2;color:#666;margin-top:3px}.ty-inline-filter{background:#0066cc!important;color:#fff!important;text-align:center!important;min-width:92px!important;border-color:#0066cc!important}.ty-card-actions{grid-column:1/-1;border-top:1px solid #eef2f7;padding:10px 14px;display:flex;gap:10px;justify-content:flex-end;background:#fff}.ty-card-actions button{border:1px solid #dce6f1;background:#fff;color:#0066cc;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:900}.ty-more-fare-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #eef2f7;border-radius:10px;padding:10px;margin:8px 0}.ty-more-fare-row b{font-size:13px}.ty-more-fare-row span{display:block;color:#666;font-size:12px;margin-top:3px}.ty-more-fare-row strong{white-space:nowrap;color:#222}

      /* mobile booking sheet CSS is defined once in injectCss() */
      @media(max-width:767px){.ty-chip-sort{display:block!important;margin-top:-4px!important}.ty-smart-chips{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 96px!important;gap:10px!important}.ty-smart-chips button{min-width:0!important;padding:7px 8px!important;border-radius:10px!important}.ty-smart-chips b{font-size:12px!important}.ty-smart-chips span{font-size:10px!important}.ty-main-sort{gap:16px!important;justify-content:flex-start!important}.ty-main-sort button{min-width:86px!important;text-align:center!important}.ty-card-actions{padding:10px 12px;justify-content:space-between}.ty-card-actions button{flex:1;min-width:0;padding:9px 8px}.ty-fr-mobile-filter{display:none!important}}

      .ty-addon-panel .ty-more-fare-row{grid-template-columns:minmax(0,1fr) auto}.ty-addon-review{display:flex;flex-direction:column;gap:12px}.ty-addon-review section{border:1px solid #eef2f7;border-radius:10px;padding:10px}.ty-addon-card{border:1px solid #dce6f1;border-radius:10px;padding:10px;display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:8px;align-items:start;margin-top:8px;cursor:pointer}.ty-addon-card.active{border-color:#0066cc;background:#f5faff}.ty-addon-card b{font-size:13px}.ty-addon-card p{font-size:12px;margin:3px 0 0;color:#666}.ty-addon-card strong{font-size:13px;white-space:nowrap;color:#222}.ty-addon-card.active .ty-offer-radio{border-color:#0066cc;background:radial-gradient(circle,#0066cc 45%,transparent 48%)}.ty-addon-toggle{width:100%;border:1px solid #dce6f1;background:#fff;color:#071d49;border-radius:10px;min-height:42px;padding:10px 12px;font-size:13px;font-weight:950;text-align:left;cursor:pointer}.ty-addon-toggle:after{content:'⌄';float:right;color:#0062e3;font-weight:950}.ty-addon-toggle.active{border-color:#0062e3;background:#eef7ff}.ty-addon-toggle.active:after{content:'⌃'}.ty-addon-options{margin-top:8px}.ty-pax-tabs button{border:1px solid #dce6f1;background:#fff;color:#071d49;border-radius:10px;padding:9px 12px;font-size:13px;font-weight:950;cursor:pointer}.ty-pax-tabs button.active{border-color:#0062e3;background:#eef7ff;color:#0062e3}
      @media(max-width:767px){.ty-addon-card{grid-template-columns:18px minmax(0,1fr);}.ty-addon-card strong{grid-column:2;justify-self:start}.ty-card-actions{padding-bottom:10px!important}}


      /*  final requested fixes */
      @media(min-width:768px){
        .ty-fr-top.compact{width:min(1180px,calc(100% - 32px))!important;max-width:min(1180px,calc(100% - 32px))!important;margin:0 auto!important;padding:14px 0!important;border-bottom:0!important;box-shadow:none!important;background:transparent!important;position:relative!important;top:auto!important;z-index:20!important}
        .ty-fr-page{padding-top:12px!important}.ty-fr-head-text{padding-left:0!important}.ty-fr-title{font-size:18px!important}.ty-fr-meta{font-size:13px!important}.ty-fr-modify{margin-right:0!important}.ty-fr-shell{margin-top:8px!important}.ty-inline-filter{display:none!important}.ty-fr-mobile-filter{display:none!important}
      }
      .ty-date-strip-shell{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr) 34px;gap:8px;align-items:center;margin:0 0 8px}
      .ty-date-strip{display:flex;gap:8px;overflow-x:auto;scroll-behavior:smooth;scrollbar-width:none;padding:6px 0 10px}.ty-date-strip::-webkit-scrollbar{display:none}
      .ty-date-pill{flex:0 0 108px;border:1px solid #dce6f1;background:#fff;border-radius:9px;padding:7px 8px;text-align:center;box-shadow:0 2px 7px rgba(7,29,73,.05)}.ty-date-pill.active{border-color:#ef6614;background:#fff8f3}.ty-date-pill b{display:block;color:#071d49;font-size:13px;line-height:1.1;white-space:nowrap}.ty-date-pill span{display:block;margin-top:4px;color:#c4511a;font-size:12px;font-weight:850;white-space:nowrap}
      .ty-date-nav{display:grid;place-items:center;width:32px;height:32px;border:1px solid #dce6f1;border-radius:50%;background:#fff;color:#0066cc;font-size:24px;font-weight:950;box-shadow:0 4px 12px rgba(7,29,73,.08)}
      @media(max-width:767px){.ty-date-strip-shell{display:block;margin-bottom:2px}.ty-date-nav{display:none!important}.ty-date-strip{padding:5px 0 6px}.ty-date-pill{flex-basis:96px;padding:6px}.ty-inline-filter{display:block!important}}

      .ty-review-card,.ty-price-card,.ty-offer-box,.ty-contact-card,.ty-gst-card{background:#fff;border:1px solid #e7edf4;border-radius:12px;box-shadow:0 5px 18px rgba(7,29,73,.07);padding:0;overflow:hidden;min-width:0}
      .ty-section-head{background:linear-gradient(90deg,#eef7ff,#fff7ed);border-bottom:1px solid #e5edf7;padding:12px 16px}.ty-section-head h2{margin:0;color:#071d49;font-size:16px;font-weight:950;line-height:1.2}.ty-section-head p{margin:4px 0 0;color:#556273;font-size:12px;font-weight:750;line-height:1.35}.ty-section-body{padding:14px 16px}
      .ty-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 12px}.ty-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.ty-form-grid.contact{grid-template-columns:repeat(2,minmax(0,1fr))}.ty-form-field{display:flex;flex-direction:column;gap:4px;min-width:0;margin:0}.ty-form-field>span{font-size:12px;color:#405065;font-weight:900;line-height:1.15;margin:0 0 1px}.ty-form-field input,.ty-form-field select{width:100%;height:38px;min-height:38px;border:1px solid #dce6f1;border-radius:8px;padding:7px 9px;font-size:13px;font-weight:750;min-width:0;background:#fff;color:#071d49}.ty-form-field input:focus,.ty-form-field select:focus{outline:2px solid rgba(0,98,227,.12);border-color:#0062e3}
      .ty-date3{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:6px}.ty-date3 select{min-width:0}.ty-phone-row{display:grid;grid-template-columns:112px minmax(0,1fr);gap:7px}.ty-side{position:sticky;top:14px;display:flex;flex-direction:column;gap:14px;min-width:0}.ty-price-card .ty-price-pax{display:flex;gap:14px;justify-content:flex-end;color:#071d49;font-size:12px;font-weight:900}.ty-price-card .ty-fare-row,.ty-price-card .ty-total-row{padding:0;margin:10px 0}.ty-price-card .ty-total-row{font-size:20px;color:#b42318}
      .ty-offer-box .ty-code-box{margin-bottom:10px;background:#fff;border-radius:9px}.ty-offer-box .ty-offer-success{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;padding:8px 10px}.ty-offer-box .ty-offer-list{max-height:260px}.ty-contact-note{margin:0 0 12px;color:#556273;font-size:13px;font-weight:750;line-height:1.4}
      .ty-agree{display:flex;gap:10px;align-items:flex-start;margin:14px 0 0;color:#334155;font-size:13px;font-weight:750;line-height:1.45}.ty-agree input{width:18px;height:18px;accent-color:#0062e3;margin-top:1px;flex:0 0 auto}.ty-agree a{color:#0062e3;font-weight:900;text-decoration:none}.ty-agree a:hover{text-decoration:underline}
      .ty-gst-toggle{display:flex;gap:10px;align-items:flex-start;color:#071d49;font-size:14px;font-weight:950}.ty-gst-toggle input{width:18px;height:18px;accent-color:#0062e3;margin-top:1px}.ty-gst-fields-holder{display:none;margin-top:12px}.ty-gst-fields-holder[hidden]{display:none!important}.ty-gst-card.gst-open .ty-gst-fields-holder{display:block}.ty-gst-fields{display:grid;margin-top:12px}.ty-side .ty-payment-btn{height:44px;border-radius:999px;background:linear-gradient(90deg,#ef6614,#df5a0b);box-shadow:0 10px 22px rgba(239,102,20,.20)}
      @media(max-width:767px){.ty-review-shell{width:calc(100vw - 20px)!important;max-width:calc(100vw - 20px)!important;display:flex!important;flex-direction:column!important;margin:10px 10px 40px!important}.ty-side{position:static!important;width:100%!important}.ty-section-head{padding:11px 12px}.ty-section-body{padding:12px}.ty-form-grid,.ty-form-grid.two,.ty-form-grid.contact{grid-template-columns:1fr!important;gap:10px!important}.ty-phone-row{grid-template-columns:96px minmax(0,1fr)}.ty-form-field input,.ty-form-field select{height:38px;min-height:38px}.ty-price-card .ty-price-pax{justify-content:flex-start}}


      /*  final no-duplicate override: quick prices, text-only sort, fixed filter header/body/apply */
      .ty-smart-chips button[data-chip-sort="priceLow"],.ty-smart-chips button[data-chip-sort="durationLow"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;white-space:nowrap!important;}
      .ty-smart-chips button small{display:inline!important;font-size:10px!important;line-height:1!important;margin:0!important;color:#c4511a!important;font-weight:950!important;letter-spacing:0!important;white-space:nowrap!important;}
      .ty-main-sort{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:34px!important;flex-wrap:nowrap!important;padding:0 0 0 6px!important;}
      .ty-main-sort button,.ty-main-sort button.active,.ty-main-sort button:hover,.ty-main-sort button:focus{border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;min-width:0!important;min-height:0!important;padding:0!important;color:#071d49!important;outline:none!important;text-align:left!important;font-size:13px!important;line-height:1.2!important;font-weight:900!important;}
      @media(max-width:767px){
        .ty-smart-chips button small{font-size:9px!important;}
        .ty-main-sort{gap:32px!important;padding-left:4px!important;}
        .ty-main-sort button{font-size:12px!important;min-width:0!important;text-align:left!important;}
        body.ty-filter-open{overflow:hidden!important;}
        body.ty-filter-open .ty-fr-filter{transform:translateY(0)!important;}
        .ty-fr-filter{position:fixed!important;inset:0!important;z-index:80!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;padding:0!important;background:#fff!important;border-radius:0!important;}
        .ty-fr-filter-head{position:relative!important;flex:0 0 auto!important;top:auto!important;left:auto!important;right:auto!important;background:#fff!important;z-index:3!important;border-bottom:1px solid #e5edf7!important;}
        .ty-filter-body{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding:16px 16px 14px!important;}
        .ty-fr-filter-foot{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;flex:0 0 auto!important;margin:0!important;padding:12px 16px calc(14px + env(safe-area-inset-bottom))!important;background:#fff!important;border-top:1px solid #e5edf7!important;z-index:4!important;display:grid!important;grid-template-columns:1fr!important;}
        .ty-fr-filter-foot [data-clear-filters]{display:none!important;}
        .ty-fr-filter-foot [data-apply-filters]{width:100%!important;min-height:52px!important;border-radius:14px!important;}
      }


      /*  desktop/mobile filter layout fix */
      .ty-result-sort-row{margin:10px 0 14px!important;width:100%!important;}
      .ty-main-sort{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:42px!important;flex-wrap:nowrap!important;padding:0 4px!important;}
      .ty-main-sort button{border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;padding:0!important;min-width:auto!important;min-height:auto!important;height:auto!important;color:#071d49!important;font-size:14px!important;font-weight:900!important;line-height:1.2!important;white-space:nowrap!important;}
      .ty-main-sort button.active,.ty-main-sort button:focus,.ty-main-sort button:hover{border:0!important;background:transparent!important;color:#071d49!important;box-shadow:none!important;outline:none!important;}
      .ty-chip-sort{margin:10px 0 12px!important;}
      .ty-fr-list{margin-top:0!important;}
      @media(min-width:768px){
        .ty-filter-inline{display:none!important;}
        .ty-fr-filter-head .ty-filter-back,.ty-fr-filter-head>.ty-fr-clear{display:none!important;}
        .ty-fr-filter-head{justify-content:center!important;padding-bottom:12px!important;}
        .ty-fr-filter-head h2{text-align:center!important;width:100%!important;}
        .ty-fr-top.compact{display:flex!important;}
        .ty-fr-back{display:inline-flex!important;}
        .ty-main-sort{gap:54px!important;margin-left:6px!important;}
      }
      @media(max-width:767px){
        .ty-filter-inline{display:inline-flex!important;align-items:center!important;justify-content:center!important;}
        .ty-main-sort{gap:34px!important;padding:0 2px!important;}
        .ty-main-sort button{font-size:13px!important;}
        .ty-fr-filter-head .ty-filter-back,.ty-fr-filter-head>.ty-fr-clear{display:inline-flex!important;}
      }

      /*  fare option modal - fixed one-line detail rows and visible Book Now */
      .ty-fare-modal{position:fixed;inset:0;z-index:99980;font-family:Inter,Roboto,Arial,sans-serif;color:#111827}
      .ty-fare-modal-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.48)}
      .ty-fare-modal-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1120px,calc(100vw - 56px));max-height:88vh;overflow:hidden;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.28);padding:24px 26px 28px;display:flex;flex-direction:column;gap:16px}
      .ty-fare-modal-close{position:absolute;right:18px;top:14px;border:0;background:transparent;color:#6b7280;font-size:36px;line-height:1;cursor:pointer}
      .ty-fare-modal-head{flex:0 0 auto;min-width:0}.ty-fare-modal-head h2{margin:0 44px 10px 0;color:#111827;font-size:24px;line-height:1.25;font-weight:900}.ty-fare-modal-head p{margin:0;color:#374151;font-size:14px;line-height:1.5;font-weight:700;overflow-wrap:anywhere}
      .ty-fare-modal-flight{flex:0 0 auto;display:grid;grid-template-columns:minmax(150px,1fr) minmax(120px,.7fr) minmax(150px,1fr);gap:18px;align-items:center;padding:14px 0 18px;border-bottom:1px dashed #d1d5db}
      .ty-fare-modal-flight div{min-width:0}.ty-fare-modal-flight div:last-child{text-align:right}.ty-fare-modal-flight b{display:block;color:#111827;font-size:28px;line-height:1.05;font-weight:950;white-space:nowrap}.ty-fare-modal-flight span{display:block;margin-top:8px;color:#4b5563;font-size:13px;font-weight:800}.ty-fare-modal-flight em{display:block;margin-top:8px;color:#6b7280;font-size:14px;font-style:normal;font-weight:700;line-height:1.35;overflow-wrap:anywhere}
      .ty-fare-modal-flight i{display:block;text-align:center;color:#374151;font-style:normal;font-size:17px;font-weight:900;white-space:nowrap;position:relative;z-index:1}.ty-fare-modal-flight i:before{content:"";position:absolute;left:0;right:0;top:calc(100% + 6px);height:2px;background:#dce3ec;z-index:-1}
      .ty-fare-modal-card h3{flex:0 0 auto;margin:0;text-align:center;color:#111827;font-size:20px;font-weight:950;line-height:1.35}.ty-fare-card-scroll{flex:1 1 auto;min-height:0;display:flex;gap:18px;overflow-x:auto;overflow-y:hidden;padding:2px 2px 8px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;align-items:stretch}
      .ty-fare-option-card{flex:0 0 320px;min-height:0;max-height:100%;border:1px solid #dbe3ee;border-radius:14px;background:#fff;padding:18px;position:relative;scroll-snap-align:start;box-shadow:0 4px 18px rgba(15,23,42,.06);display:flex;flex-direction:column;overflow:hidden}
      .ty-fare-card-top{flex:0 0 auto;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.ty-fare-card-top strong{display:inline-block;color:#111827;font-size:25px;font-weight:950;line-height:1}.ty-fare-card-top span{margin-left:6px;color:#374151;font-size:13px;font-weight:800}.ty-fare-card-top em{font-style:normal;color:#111827;font-size:13px;font-weight:900;line-height:1.25;text-align:right;overflow-wrap:anywhere;max-width:118px}
      .ty-fare-card-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding-right:2px;-webkit-overflow-scrolling:touch}.ty-fare-card-body section{border-top:1px solid #eef2f7;padding-top:13px;margin-top:13px}.ty-fare-card-body h4{margin:0 0 10px;color:#111827;font-size:15px;font-weight:950}.ty-fare-modal-list{display:flex;flex-direction:column;gap:10px}.ty-fare-modal-line{display:flex;align-items:flex-start;gap:8px;color:#111827;font-size:13px;line-height:1.35;min-width:0;width:100%}.ty-fare-modal-line:before{content:"✓";flex:0 0 18px;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#d7f8ec;color:#08936b;font-size:12px;font-weight:900}.ty-fare-modal-line span{flex:0 1 auto;min-width:0;font-weight:800;color:#111827;white-space:normal}.ty-fare-modal-line b{flex:1 1 auto;min-width:0;font-weight:700;color:#374151;overflow-wrap:anywhere;white-space:normal}.ty-fare-modal-line b:before{content:" ";}
      .ty-fare-card-book{flex:0 0 auto;position:static;width:100%;margin-top:14px;min-height:48px;border:0;border-radius:10px;background:#0066e6;color:#fff;font-size:15px;font-weight:950;cursor:pointer}
      @media(max-width:767px){.ty-fare-modal-card{left:0;right:0;bottom:0;top:0;transform:none;width:100vw;max-height:100dvh;height:100dvh;border-radius:0;padding:calc(env(safe-area-inset-top,0px) + 58px) 14px calc(18px + env(safe-area-inset-bottom));gap:13px;overflow:auto}.ty-fare-modal-close{position:fixed!important;right:14px;top:calc(env(safe-area-inset-top,0px) + 10px)!important;width:42px!important;height:42px!important;border-radius:999px!important;background:#fff!important;color:#111827!important;border:1px solid #dfe7f1!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:34px!important;z-index:10000!important}.ty-fare-modal-head h2{font-size:20px;margin-right:44px}.ty-fare-modal-head p{font-size:13px}.ty-fare-modal-flight{grid-template-columns:minmax(84px,1fr) minmax(86px,.8fr) minmax(84px,1fr);gap:8px;padding:10px 0 14px}.ty-fare-modal-flight b{font-size:24px}.ty-fare-modal-flight span{font-size:12px}.ty-fare-modal-flight em{font-size:12px}.ty-fare-modal-flight i{font-size:14px}.ty-fare-modal-card h3{font-size:18px}.ty-fare-card-scroll{gap:14px;padding-bottom:10px}.ty-fare-option-card{flex-basis:82vw;padding:16px;max-height:100%}.ty-fare-card-top strong{font-size:23px}.ty-fare-card-book{min-height:50px}.ty-fare-modal-line{font-size:13px;gap:8px}.ty-fare-modal-line span{max-width:48%}.ty-fare-modal-line b{max-width:52%}}
      /* END  fare option modal */

      /* END  desktop/mobile filter layout fix */

      /* ty-fare-sheet-bottom-mobile-v920 */
      @media(max-width:767px){
        .ty-fare-sheet-v306 .ty-fare-modal-card.ty-fare-sheet-card{
          top:auto!important;
          bottom:0!important;
          left:0!important;
          right:0!important;
          transform:none!important;
          width:100vw!important;
          max-width:100vw!important;
          max-height:calc(100dvh - 56px)!important;
          border-radius:24px 24px 0 0!important;
          padding:22px 18px calc(env(safe-area-inset-bottom,0px) + 14px)!important;
          margin:0!important;
        }
        .ty-fare-sheet-v306 .ty-fare-card-scroll{
          max-height:calc(100dvh - 330px)!important;
          overflow:auto!important;
          padding-bottom:8px!important;
        }
        .ty-fare-sheet-v306 .ty-fare-modal-card.ty-fare-sheet-card{
          overflow:hidden!important;
        }
        .ty-fare-sheet-v306 .ty-fare-modal-close{
          position:absolute!important;
          top:12px!important;
          right:14px!important;
          z-index:10050!important;
          width:44px!important;
          height:44px!important;
          border-radius:999px!important;
          background:#fff!important;
          border:1px solid #dfe7f1!important;
          box-shadow:0 8px 22px rgba(7,29,73,.16)!important;
        }
      }

    `;
    document.head.appendChild(style);
  }

  function summaryText(){
    const s = state.search;
    return [
      dateText(s.departureDate),
      s.tripType === "roundtrip" && s.returnDate ? "Return " + dateText(s.returnDate) : "",
      (s.adults+s.children+s.infants) + " Traveller" + ((s.adults+s.children+s.infants)>1 ? "s" : ""),
      normalizeCabin(s.cabinClass).replace(/_/g," ")
    ].filter(Boolean).join(" • ");
  }

  async function postFlightSearch(payload){
    return fetch(API_BASE + "/api/flights/search", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload),
      cache:"no-store"
    }).then(res => res.json());
  }

  async function searchLegThroughAvailableRoutes(from, to, date){
    const payload = buildSingleLegPayload(from, to, date);
    const res = await fetch(API_BASE + "/api/flights/search", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload),
      cache:"no-store"
    });
    const data = await res.json().catch(function(){ return {}; });
    if(!res.ok || data.success === false){
      throw new Error(tyCustomerFacingSearchMessage(data.message || data.code || ("HTTP " + res.status)));
    }
    return extractArray(data);
  }

  async function fetchLeg(leg){
    let list = await searchLegThroughAvailableRoutes(leg.from, leg.to, leg.date);
    return list.map((item, index) => normalizeFlight(item, index, leg)).filter(tyRealFlightCard);
  }

  async function loadFlights(forceFresh){
    const cached = forceFresh ? [] : readCachedFlightResults();
    /* One continuous loader from search until final results/error paint. */
    const showLoader = !tyIsBackForwardNavigation();
    state.searchError = '';
    try{
      try{
        const priorErr = sessionStorage.getItem("ty_flight_search_error");
        if(priorErr){
          state.searchError = tyCustomerFacingSearchMessage(priorErr);
          sessionStorage.removeItem("ty_flight_search_error");
        }
      }catch(e){}

      if(showLoader) showFlightSearchLoader();
      else hideFlightSearchLoader();

      if(!ROOT.querySelector('.ty-fr-page')) renderShell('', { skipDateFares: true });
      if(showLoader && !cached.length){
        state.rawFlights = [];
        state.legFlights = {};
        state.flights = [];
        renderShell('', { skipDateFares: true });
      }

      const legs = routeLegs();
      state.legFlights = {};
      if(cached.length){
        if(state.search.tripType === "roundtrip"){
          state.legFlights[legs[0].key] = cached.map((item,index)=>normalizeFlight(item,index,legs[0])).filter(tyRealFlightCard);
          if(legs[1]) state.legFlights[legs[1].key] = [];
          state.rawFlights = state.legFlights[legs[0].key].slice();
        }else{
          const leg = legs[0];
          state.rawFlights = cached.map((item,index)=>normalizeFlight(item,index,leg)).filter(tyRealFlightCard);
          state.legFlights[leg.key] = state.rawFlights.slice();
        }
      }else{
        if(state.search.tripType === "oneway"){
          const leg = legs[0];
          state.rawFlights = await fetchLeg(leg);
          state.legFlights[leg.key] = state.rawFlights.slice();
        }else if(state.search.tripType === "roundtrip"){
          const combined = await postFlightSearch(buildApiPayload());
          const combinedList = extractArray(combined);
          if(combinedList.length){
            const onwardList = combinedList.map((item,index) => normalizeFlight(item,index,legs[0])).filter(tyRealFlightCard);
            const returnList = legs[1] ? await fetchLeg(legs[1]) : [];
            state.legFlights[legs[0].key] = onwardList;
            if(legs[1]) state.legFlights[legs[1].key] = returnList;
            state.rawFlights = onwardList.concat(returnList);
          }else{
            const all = [];
            for(const leg of legs){
              const legList = await fetchLeg(leg);
              state.legFlights[leg.key] = legList;
              legList.forEach(f => all.push(f));
            }
            state.rawFlights = all;
          }
        }else{
          const all = [];
          for(const leg of legs){
            const legList = await fetchLeg(leg);
            state.legFlights[leg.key] = legList;
            legList.forEach(f => all.push(f));
          }
          state.rawFlights = all;
        }
      }
      const maxPrice = Math.max(100000, ...state.rawFlights.map(f => Number(f.price || 0)));
      state.filters.maxPrice = maxPrice;
      applyFilters();
      hideFlightSearchLoader();
    }catch(error){
      state.rawFlights = [];
      state.legFlights = {};
      state.searchError = tyCustomerFacingSearchMessage(error && error.message ? error.message : '');
      applyFilters();
      hideFlightSearchLoader();
    }
  }

  function dateStripItems(){
    const today = todayYmd();
    const selected = maxYmd(state.search.departureDate, today);
    const center = toDate(selected) || toDate(today);
    const arr = [];
    for(let i=-4;i<=10;i++){
      const d = new Date(center); d.setDate(d.getDate()+i); const dy = ymd(d);
      if(dy >= today) arr.push(dy);
    }
    return arr.slice(0,15);
  }

  function dateChipFareLabel(d){
    const fare = Number(state.fareDateCache[d] || 0);
    if(fare > 0) return money(fare);
    if(state.fareDateNone[d]) return "No fare";
    return "Check fare";
  }

  function setDateChipFareLabel(d, label){
    const el = ROOT.querySelector('[data-date-pick="' + CSS.escape(String(d)) + '"] span');
    if(el) el.textContent = label;
  }

  function renderDateFareStrip(){
    const activeDate = String(normalizeFutureYmd(state.search.departureDate));
    const pills = dateStripItems().map(function(d){
      const active = String(d) === activeDate;
      return `<button type="button" class="ty-date-pill ${active?'active':''}" data-date-pick="${esc(d)}"><b>${esc(dateText(d).replace(',', ''))}</b><span>${esc(dateChipFareLabel(d))}</span></button>`;
    }).join('');
    return `<div class="ty-date-strip-shell"><button type="button" class="ty-date-nav prev" data-date-scroll="-1" aria-label="Previous dates">‹</button><div class="ty-date-strip" data-date-strip>${pills}</div><button type="button" class="ty-date-nav next" data-date-scroll="1" aria-label="Next dates">›</button></div>`;
  }

  function minPrice(list){
    const nums = (list || []).map(f=>Number(f.price||0)).filter(Boolean);
    return nums.length ? Math.min.apply(null, nums) : 0;
  }

  function fastestPrice(list){
    const source = (Array.isArray(list) && list.length ? list : state.rawFlights || []).filter(f => Number(f.durationMinutes || 0) > 0);
    if(!source.length) return 0;
    const fastest = source.slice().sort((a,b) => Number(a.durationMinutes || 999999999) - Number(b.durationMinutes || 999999999))[0];
    return Number(fastest && fastest.price || 0);
  }

  function extraSortOptions(){
    return [
      ['departLate','Late Take-off'],
      ['arrivalLate','Late Arrival'],
      ['durationHigh','Slowest'],
      ['priceHigh','Highest Price']
    ];
  }

  function renderSmartChips(){
    const source = state.flights && state.flights.length ? state.flights : state.rawFlights;
    const cheapest = minPrice(source);
    const fastest = fastestPrice(source);
    const quickOptions = [
      ['priceLow','Cheapest',cheapest],
      ['durationLow','Fastest',fastest]
    ];
    const sortOptions = [
      ['departEarly','Departure'],
      ['arrivalEarly','Arrival'],
      ['priceLow','Price']
    ];
    return `<div class="ty-chip-sort">
      <div class="ty-filter-top-row"><div class="ty-smart-chips">${quickOptions.map(o=>`<button type="button" class="${state.sort===o[0]?'active':''}" data-chip-sort="${esc(o[0])}"><b>${esc(o[1])}</b>${o[2]?`<small>${esc(money(o[2]))}</small>`:''}</button>`).join('')}<button type="button" class="ty-filter-inline" data-filter-open><b>Filter</b></button></div></div>
      <div class="ty-result-sort-row"><div class="ty-main-sort">${sortOptions.map(o=>`<button type="button" data-chip-sort="${esc(o[0])}">${esc(o[1])}</button>`).join('')}</div></div>
    </div>`;
  }


  async function fetchDateFares(){
    const gen = ++state.fareFetchGen;
    const dates = dateStripItems();
    const current = minPrice(state.rawFlights && state.rawFlights.length ? state.rawFlights : state.flights);
    const selected = normalizeFutureYmd(state.search.departureDate);
    if(current > 0){
      state.fareDateCache[selected] = current;
      delete state.fareDateNone[selected];
      setDateChipFareLabel(selected, money(current));
    }

    for(let i = 0; i < dates.length; i++){
      if(gen !== state.fareFetchGen) return;
      const d = dates[i];
      if(Number(state.fareDateCache[d] || 0) > 0 || state.fareDateNone[d] || state.fareDateLoading.has(d)) continue;
      state.fareDateLoading.add(d);
      try{
        const payload = buildSingleLegPayload(state.search.origin, state.search.destination, d);
        const res = await fetch(API_BASE + "/api/flights/search", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload),
          cache: "no-store"
        });
        if(gen !== state.fareFetchGen) return;
        const data = await res.json().catch(function(){ return {}; });
        if(!res.ok || data.success === false){
          /* Keep "Check fare" on temporary/API failures; never show technical text. */
          continue;
        }
        const list = extractArray(data);
        const leg = {from: state.search.origin, to: state.search.destination, date: d, key: "faredate", label: "Fare Date"};
        const normalized = list.map(function(it, idx){ return normalizeFlight(it, idx, leg); }).filter(tyRealFlightCard);
        const low = minPrice(normalized);
        if(low > 0){
          state.fareDateCache[d] = low;
          delete state.fareDateNone[d];
          setDateChipFareLabel(d, money(low));
        }else{
          state.fareDateNone[d] = true;
          delete state.fareDateCache[d];
          setDateChipFareLabel(d, "No fare");
        }
      }catch(e){
        /* Leave chip as Check fare; do not expose technical errors. */
      }finally{
        state.fareDateLoading.delete(d);
      }
      if(gen !== state.fareFetchGen) return;
      await new Promise(function(resolve){ setTimeout(resolve, 180); });
    }
  }

function renderShell(content, opts){
    opts = opts || {};
    injectStyles();
  injectReviewTimerUpdateCss();
    ROOT.innerHTML = `
      <div class="ty-fr-page">
        <header class="ty-fr-top compact">
          <button class="ty-fr-back" type="button" data-result-back aria-label="Back" title="Back">‹</button>
          <div class="ty-fr-head-text"><h1 class="ty-fr-title">${esc(state.search.origin)} to ${esc(state.search.destination)}</h1><p class="ty-fr-meta">${esc(summaryText())}</p></div>
          <button class="ty-fr-modify" type="button" data-modify-search aria-label="Modify Search" title="Modify Search"></button>
        </header>
        <div class="ty-fr-overlay" data-filter-close></div>
        <main class="ty-fr-shell">
          <aside class="ty-fr-filter" aria-label="Flight filters">
            <div class="ty-fr-filter-head"><button class="ty-filter-back" type="button" data-filter-close aria-label="Back">‹</button><h2>Filters</h2><button class="ty-fr-clear" type="button" data-clear-filters>Clear</button></div>
            <div class="ty-filter-body">
              <section class="ty-fr-group ty-fr-sort-filter"><h3>Sort</h3><div class="ty-filter-sort-list">${extraSortOptions().map(o=>`<button type="button" class="${state.sort===o[0]?'active':''}" data-filter-sort="${esc(o[0])}">${esc(o[1])}</button>`).join('')}</div></section>
              <section class="ty-fr-group"><h3>Stops</h3><label class="ty-fr-check"><input type="checkbox" data-filter-stop value="0"> Non Stop</label><label class="ty-fr-check"><input type="checkbox" data-filter-stop value="1"> 1 Stop</label><label class="ty-fr-check"><input type="checkbox" data-filter-stop value="2"> 2+ Stops</label></section>
              <section class="ty-fr-group"><h3>Departure Time</h3><label class="ty-fr-check"><input type="checkbox" data-filter-time value="morning"> 06:00 - 12:00</label><label class="ty-fr-check"><input type="checkbox" data-filter-time value="afternoon"> 12:00 - 18:00</label><label class="ty-fr-check"><input type="checkbox" data-filter-time value="evening"> After 18:00</label></section>
              <section class="ty-fr-group"><h3>Price</h3><input class="ty-fr-range" type="range" min="0" max="100000" value="100000" data-filter-price><div class="ty-fr-range-label"><span>₹0</span><span data-price-label>₹100,000</span></div></section>
              <section class="ty-fr-group"><h3>Airlines</h3><div data-airline-filters></div></section>
            </div>
            <div class="ty-fr-filter-foot"><button type="button" data-clear-filters>Clear All</button><button type="button" data-apply-filters>Apply</button></div>
          </aside>
          <section class="ty-fr-results">
            <div class="ty-date-strip-wrap">${renderDateFareStrip()}</div>
            <div class="ty-chip-sort">${renderSmartChips()}</div>
            <div class="ty-fr-list">${content}</div>
          </section>
        </main>
        <div class="ty-fr-mobile-filter"><button type="button" data-filter-open>Filter</button></div>
      </div>
    `;
    bindStaticEvents();
    if(!opts.skipDateFares) fetchDateFares();
  }

  function renderAirlineFilters(){
    const wrap = ROOT.querySelector("[data-airline-filters]");
    if(!wrap) return;
    const airlines = Array.from(new Set(state.rawFlights.map(f => f.airlineName).filter(Boolean))).sort();
    wrap.innerHTML = airlines.map(name => `<label class="ty-fr-check"><input type="checkbox" data-filter-airline value="${esc(name)}"> ${esc(name)}</label>`).join("");
  }

  function applyFilters(){
    let list = state.rawFlights.filter(function(flight){
      if(flight.price && flight.price > state.filters.maxPrice) return false;
      if(state.filters.stops.size){
        const stopKey = flight.stops >= 2 ? "2" : String(flight.stops);
        if(!state.filters.stops.has(stopKey)) return false;
      }
      if(state.filters.airlines.size && !state.filters.airlines.has(flight.airlineName)) return false;
      if(state.filters.times.size){
        const mins = timeToMinutes(flight.departureTime);
        const bucket = mins >= 360 && mins < 720 ? "morning" : mins >= 720 && mins < 1080 ? "afternoon" : mins >= 1080 ? "evening" : "night";
        if(!state.filters.times.has(bucket)) return false;
      }
      return true;
    });

    if(state.sort === "priceLow") list.sort((a,b) => (a.price || 999999999) - (b.price || 999999999));
    if(state.sort === "priceHigh") list.sort((a,b) => (b.price || 0) - (a.price || 0));
    if(state.sort === "durationLow") list.sort((a,b) => (a.durationMinutes || 999999999) - (b.durationMinutes || 999999999));
    if(state.sort === "durationHigh") list.sort((a,b) => (b.durationMinutes || 0) - (a.durationMinutes || 0));
    if(state.sort === "departEarly") list.sort((a,b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));
    if(state.sort === "departLate") list.sort((a,b) => timeToMinutes(b.departureTime) - timeToMinutes(a.departureTime));
    if(state.sort === "arrivalEarly") list.sort((a,b) => timeToMinutes(a.arrivalTime) - timeToMinutes(b.arrivalTime));
    if(state.sort === "arrivalLate") list.sort((a,b) => timeToMinutes(b.arrivalTime) - timeToMinutes(a.arrivalTime));

    state.flights = list;
    renderResults();
  }

  function filteredForLeg(key){
    return state.flights.filter(f => f.legKey === key);
  }


  function renderNoFlightsFound(message){
    const friendly = tyCustomerFacingSearchMessage(message);
    return `<section class="ty-empty ty-no-flights"><h2>Oops! No flights found</h2><p>${esc(friendly)}</p><button type="button" data-modify-search>Modify Search & Try Again</button></section>`;
  }

  function renderResults(){
    let listHtml = "";

    if(state.search.tripType === "roundtrip"){
      const pairs = roundTripPairs();
      listHtml = pairs.length
        ? pairs.map(renderRoundTripPairCard).join("")
        : renderNoFlightsFound(state.searchError);
    }else if(state.search.tripType === "multicity"){
      routeLegs().forEach(function(leg){
        const list = filteredForLeg(leg.key);
        listHtml += `<h2 class="ty-leg-title">${esc(leg.label)}</h2><p class="ty-leg-sub">${esc(leg.from)} → ${esc(leg.to)} • ${esc(dateText(leg.date))}</p>`;
        listHtml += list.length ? list.map(f => renderFlightCard(f, leg.key)).join("") : renderNoFlightsFound();
      });
      listHtml += renderRoundTripContinue();
    }else{
      const displayFlights = (state.flights || []).filter(tyRealFlightCard);
      listHtml = displayFlights.length
        ? displayFlights.map(f => renderFlightCard(f, "onward")).join("")
        : renderNoFlightsFound(state.searchError);
    }

    renderShell(listHtml);

    const count = ROOT.querySelector("[data-results-count]");
    if(count) count.textContent = state.search.tripType === "roundtrip" ? (roundTripPairs().length + " round trips found") : (state.flights.length + " flights found");

    const sort = ROOT.querySelector("[data-sort]");
    if(sort) sort.value = state.sort;

    const range = ROOT.querySelector("[data-filter-price]");
    const priceLabel = ROOT.querySelector("[data-price-label]");
    if(range){
      range.max = String(Math.max(100000, state.filters.maxPrice));
      range.value = String(state.filters.maxPrice);
    }
    if(priceLabel) priceLabel.textContent = money(state.filters.maxPrice);

    renderAirlineFilters();
    restoreCheckedFilters();
    bindDynamicEvents();
  }

  function roundTripPairs(){
    if(state.search.tripType !== "roundtrip") return [];
    const onward = filteredForLeg("onward");
    const ret = filteredForLeg("return");
    const count = Math.min(onward.length, ret.length);
    const pairs = [];
    for(let i=0;i<count;i++){
      pairs.push({
        id: "RT-" + onward[i].id + "-" + ret[i].id,
        onward: onward[i],
        returnFlight: ret[i],
        totalPrice: tyResultCardFareAmount(onward[i]) + tyResultCardFareAmount(ret[i])
      });
    }
    if(state.sort === "priceLow") pairs.sort((a,b)=>a.totalPrice-b.totalPrice);
    if(state.sort === "durationLow") pairs.sort((a,b)=>(a.onward.durationMinutes+a.returnFlight.durationMinutes)-(b.onward.durationMinutes+b.returnFlight.durationMinutes));
    if(state.sort === "departEarly") pairs.sort((a,b)=>timeToMinutes(a.onward.departureTime)-timeToMinutes(b.onward.departureTime));
    return pairs;
  }

  function renderMiniSegment(flight, label){
    return `
      <div class="ty-rt-seg">
        <div class="ty-rt-seg-head">
          <b>${esc(label)}</b>
          <span>${esc(flight.airlineName)} ${flight.flightCode ? "• " + esc(flight.flightCode) : ""}</span>
        </div>
        <div class="ty-rt-route">
          <span><strong>${esc(flight.departureTime)}</strong><em>${esc(flight.departureCity)}</em></span>
          <i>${esc(flight.duration)}</i>
          <span><strong>${esc(flight.arrivalTime)}</strong><em>${esc(flight.arrivalCity)}</em></span>
        </div>
        <div class="ty-detail-row">
          <span class="ty-chip">${flight.stops === 0 ? "Non Stop" : flight.stops + " Stop"}</span>
          ${flight.baggage ? `<span class="ty-chip">${esc(flight.baggage)} Baggage</span>` : ""}
        </div>
      </div>
    `;
  }

  function renderRoundTripPairCard(pair){
    const logoText = airlineLogoHTML(pair.onward, "ty-logo-img");
    const totalDuration = durationText((pair.onward.durationMinutes||0)+(pair.returnFlight.durationMinutes||0));
    return `
      <article class="ty-flight-card ty-roundtrip-card">
        <div class="ty-card-main">
          <div class="ty-airline"><div class="ty-logo-box">${logoText}</div><div><b>Round Trip</b><span>${esc(pair.onward.departureCity)} ⇄ ${esc(pair.onward.arrivalCity)}</span></div></div>
          <div class="ty-rt-open">
            <div><h3>Departure Flight</h3>${renderSegmentDetails(pair.onward)}</div>
            <div><h3>Return Flight</h3>${renderSegmentDetails(pair.returnFlight)}</div>
          </div>
          <div class="ty-card-tags"><span>${esc(totalDuration)}</span><span>${pair.onward.refundable && pair.returnFlight.refundable ? 'Refundable' : 'Non Refundable'}</span>${(pair.onward.baggage || pair.returnFlight.baggage) ? `<span>${esc(pair.onward.baggage || pair.returnFlight.baggage)}</span>` : ''}</div>
        </div>
        <div class="ty-card-price"><strong>${money(pair.totalPrice)}</strong><span>Total Fare</span><button class="ty-book-btn" type="button" data-book-pair="${esc(pair.id)}">Book Now</button><button type="button" class="ty-flight-detail-btn" data-pair-detail-toggle="${esc(pair.id)}">Flight Details</button></div>
        ${renderRoundTripDetailPanel(pair)}
      </article>
    `;
  }

  function renderRoundTripContinue(){
    if(state.search.tripType === "oneway") return "";
    const legs = routeLegs();
    const selectedCount = legs.filter(leg => selectedForLeg(leg.key)).length;
    return `
      <div class="ty-continue-box">
        <span>${selectedCount}/${legs.length} flights selected</span>
        <button type="button" data-continue-roundtrip ${selectedCount === legs.length ? "" : "disabled"}>${selectedCount === legs.length ? "Continue" : "Select Flights"}</button>
      </div>
    `;
  }

  function selectedForLeg(key){
    if(key === "onward") return state.selected.onward;
    if(key === "return") return state.selected.return;
    return state.selected.multicity[key];
  }

  function setSelectedForLeg(key, flight){
    if(key === "onward") state.selected.onward = flight;
    else if(key === "return") state.selected.return = flight;
    else state.selected.multicity[key] = flight;
  }

  function selectedItineraryFlights(){
    if(state.search.tripType === "oneway") return [state.selected.onward].filter(Boolean);
    return routeLegs().map(leg => selectedForLeg(leg.key)).filter(Boolean);
  }

  function airlineLogoCandidates(flight){
    const code = String(flight.airlineCode || (flight.flightCode || "").split(/\s+/)[0] || "").toUpperCase().replace(/[^A-Z0-9]/g,"");
    const out = [];
    if(flight.airlineLogoUrl) out.push(flight.airlineLogoUrl);
    if(code){
      out.push("/assets/airline-logo/" + code + ".png");
      out.push("/assets/airline-logo/" + code + ".jpg");
      out.push("/airline-logo/" + code + ".png");
      out.push("/Airline-logo/" + code + ".png");
      out.push("/assets/img/airlines/" + code + ".png");
      out.push("/images/airlines/" + code + ".png");
    }
    return out.filter(Boolean);
  }

  function airlineLogoHTML(flight, cls){
    const fallback = esc((flight.airlineName || flight.airlineCode || "FL").slice(0,2).toUpperCase());
    const sources = airlineLogoCandidates(flight);
    if(!sources.length) return fallback;
    const data = esc(JSON.stringify(sources));
    return `<img class="${cls||"ty-logo-img"}" src="${esc(sources[0])}" alt="${esc(flight.airlineName||"Airline")}" data-logo-sources='${data}' data-logo-index="0" onerror="(function(img){try{var arr=JSON.parse(img.getAttribute('data-logo-sources')||'[]');var i=Number(img.getAttribute('data-logo-index')||0)+1;if(i<arr.length){img.setAttribute('data-logo-index',String(i));img.src=arr[i];}else{img.parentNode.textContent='${fallback}';}}catch(e){img.parentNode.textContent='${fallback}';}})(this)">`;
  }

  function compactAirportLabel(code){
    const c = String(code || '').toUpperCase();
    const info = airportInfo(c);
    const city = info && info.city ? info.city : c;
    return city + ' (' + c + ')';
  }

  function firstSegment(flight){ return flight && flight.segments && flight.segments[0] ? flight.segments[0] : {}; }
  function lastSegment(flight){ return flight && flight.segments && flight.segments.length ? flight.segments[flight.segments.length-1] : {}; }

  function renderFlightTags(flight){
    return '';
  }


  function tyFlightCardCarriers(flight){
    const segments = Array.isArray(flight && flight.segments) ? flight.segments : [];
    const carriers = [];
    const seen = new Set();

    function addCarrier(src){
      if(!src) return;
      const raw = src.raw || {};
      const airlineObj = raw.airline || raw.carrier || (raw.fD && (raw.fD.aI || raw.fD.al)) || {};
      const code = String(src.airlineCode || src.carrierCode || airlineObj.code || airlineObj.iata || '').toUpperCase().trim();
      const name = String(src.airlineName || src.airline || src.carrierName || airlineObj.name || '').trim();
      const flightCode = String(src.flightCode || ((code && src.flightNumber) ? (code + ' ' + src.flightNumber) : (src.flightNumber || code || ''))).trim();
      const logo = String(src.airlineLogoUrl || src.logoUrl || src.logo || raw.airlineLogoUrl || raw.logoUrl || raw.logo || '').trim();
      const key = (code || name).toUpperCase();
      if(!key || seen.has(key)) return;
      seen.add(key);
      carriers.push({
        airlineName: name || code || 'Airline',
        airlineCode: code,
        airlineLogoUrl: logo,
        flightCode: flightCode
      });
    }

    segments.forEach(addCarrier);

    if(!carriers.length){
      addCarrier({
        airlineName: flight && flight.airlineName,
        airlineCode: flight && flight.airlineCode,
        airlineLogoUrl: flight && flight.airlineLogoUrl,
        flightCode: flight && flight.flightCode,
        flightNumber: flight && flight.flightNumber
      });
    }

    return carriers.length ? carriers : [{
      airlineName: flight && flight.airlineName ? flight.airlineName : 'Airline',
      airlineCode: flight && flight.airlineCode ? flight.airlineCode : '',
      airlineLogoUrl: flight && flight.airlineLogoUrl ? flight.airlineLogoUrl : '',
      flightCode: flight && flight.flightCode ? flight.flightCode : ''
    }];
  }

  function renderFlightAirlineIdentity(flight){
    const carriers = tyFlightCardCarriers(flight);
    if(carriers.length <= 1){
      const c = carriers[0] || {};
      return `<div class="ty-airline-left"><div class="ty-logo-box">${airlineLogoHTML(c, "ty-logo-img")}</div><div><b>${esc(c.airlineName || flight.airlineName)}</b><span>${esc(c.flightCode || flight.flightCode || '')}</span></div></div>`;
    }

    const logos = carriers.map(function(c){
      return `<div class="ty-logo-box ty-logo-box-small">${airlineLogoHTML(c, "ty-logo-img")}</div>`;
    }).join('');

    const names = carriers.map(function(c){
      const flightCode = c.flightCode ? ` <span>| ${esc(c.flightCode)}</span>` : '';
      return `<b>${esc(c.airlineName || c.airlineCode || 'Airline')}${flightCode}</b>`;
    }).join('');

    return `<div class="ty-airline-left ty-airline-multi"><div class="ty-multi-logo-set">${logos}</div><div class="ty-multi-airline-names">${names}</div></div>`;
  }

  function renderFlightCard(flight, legKey){
    if(!tyRealFlightCard(flight)) return "";
    const airlineIdentity = renderFlightAirlineIdentity(flight);
    const isSelected = selectedForLeg(legKey) && selectedForLeg(legKey).id === flight.id;
    const buttonLabel = (state.search.tripType === "oneway") ? "Book Now" : (isSelected ? "Selected" : "Select");
    const refundLabel = flight.refundable ? 'Refundable' : 'Non Refundable';
    return `
      <article class="ty-flight-card ${isSelected ? "selected" : ""}" data-card-book-flight="${esc(flight.id)}" data-leg-key="${esc(legKey)}" role="button" tabindex="0">
        <div class="ty-card-main">
          <div class="ty-airline">
            ${airlineIdentity}
            <span class="ty-refund-badge ${flight.refundable ? 'yes' : 'no'}">${esc(refundLabel)}</span>
          </div>
          <div class="ty-time-grid">
            <div><b>${esc(flight.departureTime)}</b><span>${esc(compactAirportLabel(flight.departureCity))}</span><em>${esc(dateText(firstSegment(flight).depDate || state.search.departureDate))}</em></div>
            <div class="ty-line"><span>${esc(flight.duration)} | ${flight.stops===0?'Non Stop':flight.stops+' Stop'}</span><i></i><small>${esc(flightStopRoute(flight))}</small></div>
            <div><b>${esc(flight.arrivalTime)}</b><span>${esc(compactAirportLabel(flight.arrivalCity))}</span><em>${esc(dateText(lastSegment(flight).arrDate || state.search.departureDate))}</em></div>
          </div>
        </div>
        <div class="ty-card-price"><strong>${money(tyResultCardFareAmount(flight))}</strong><span>Per Adult</span><button class="ty-book-btn" type="button" data-book-flight="${esc(flight.id)}" data-leg-key="${esc(legKey)}">${buttonLabel}</button></div>
      </article>
    `;
  }


  function restoreCheckedFilters(){
    ROOT.querySelectorAll("[data-filter-stop]").forEach(input => { input.checked = state.filters.stops.has(input.value); });
    ROOT.querySelectorAll("[data-filter-time]").forEach(input => { input.checked = state.filters.times.has(input.value); });
    ROOT.querySelectorAll("[data-filter-airline]").forEach(input => { input.checked = state.filters.airlines.has(input.value); });
    ROOT.querySelectorAll("[data-filter-sort]").forEach(btn => { btn.classList.toggle('active', btn.getAttribute('data-filter-sort') === state.sort); });
  }

  function openModifySearch(){
    openFlightSearchPage();
  }

  function bindStaticEvents(){
    ROOT.querySelectorAll("[data-result-back]").forEach(function(btn){
      btn.onclick = function(){
        hideFlightSearchLoader();
        hideBookingLoader();
        try{
          if(window.history && window.history.length > 1){ window.history.back(); return; }
        }catch(e){}
        location.href = "/?service=flight#flight-search";
      };
    });

    ROOT.querySelectorAll("[data-modify-search]").forEach(function(modify){
      modify.onclick = openModifySearch;
    });

    ROOT.querySelectorAll("[data-filter-open]").forEach(open => {
      open.onclick = () => document.body.classList.add("ty-filter-open");
    });
    ROOT.querySelectorAll("[data-filter-close]").forEach(close => {
      close.onclick = () => document.body.classList.remove("ty-filter-open");
    });
  }

  function bindDynamicEvents(){
    ROOT.querySelectorAll("[data-filter-stop]").forEach(input => {
      input.onchange = () => {
        if(input.checked) state.filters.stops.add(input.value);
        else state.filters.stops.delete(input.value);
        applyFilters();
      };
    });

    ROOT.querySelectorAll("[data-filter-time]").forEach(input => {
      input.onchange = () => {
        if(input.checked) state.filters.times.add(input.value);
        else state.filters.times.delete(input.value);
        applyFilters();
      };
    });

    ROOT.querySelectorAll("[data-filter-airline]").forEach(input => {
      input.onchange = () => {
        if(input.checked) state.filters.airlines.add(input.value);
        else state.filters.airlines.delete(input.value);
        applyFilters();
      };
    });

    const price = ROOT.querySelector("[data-filter-price]");
    if(price){
      price.oninput = () => {
        state.filters.maxPrice = Number(price.value);
        const label = ROOT.querySelector("[data-price-label]");
        if(label) label.textContent = money(state.filters.maxPrice);
        applyFilters();
      };
    }

    const sort = ROOT.querySelector("[data-sort]");
    if(sort){
      sort.onchange = () => {
        state.sort = sort.value;
        applyFilters();
      };
    }

    ROOT.querySelectorAll("[data-clear-filters]").forEach(clear => {
      clear.onclick = () => {
        state.filters.stops.clear();
        state.filters.times.clear();
        state.filters.airlines.clear();
        state.filters.maxPrice = Math.max(100000, ...state.rawFlights.map(f => Number(f.price || 0)));
        applyFilters();
      };
    });
    ROOT.querySelectorAll("[data-apply-filters]").forEach(btn => btn.onclick = () => { document.body.classList.remove("ty-filter-open"); applyFilters(); });

    ROOT.querySelectorAll("[data-book-flight]").forEach(button => {
      button.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = button.getAttribute("data-book-flight");
        const key = button.getAttribute("data-leg-key") || "onward";
        const flight = state.rawFlights.find(f => String(f.id) === String(id) && String(f.legKey) === String(key));
        if(flight) openFareOptionsForFlight(flight, key);
      };
    });

    ROOT.querySelectorAll("[data-card-book-flight]").forEach(card => {
      const openCardBooking = () => {
        const id = card.getAttribute("data-card-book-flight");
        const key = card.getAttribute("data-leg-key") || "onward";
        const flight = state.rawFlights.find(f => String(f.id) === String(id) && String(f.legKey) === String(key));
        if(flight) openFareOptionsForFlight(flight, key);
      };
      card.onclick = (ev) => {
        const interactive = ev.target && ev.target.closest && ev.target.closest('button,a,input,select,textarea,label');
        if(interactive) return;
        openCardBooking();
      };
      card.onkeydown = (ev) => {
        if(ev.key === 'Enter' || ev.key === ' '){
          ev.preventDefault();
          openCardBooking();
        }
      };
    });

    ROOT.querySelectorAll("[data-book-pair]").forEach(button => {
      button.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const pair = roundTripPairs().find(p => p.id === button.getAttribute("data-book-pair"));
        if(pair) openReviewWithAirReview([pair.onward, pair.returnFlight]);
      };
    });

    ROOT.querySelectorAll("[data-fare-toggle]").forEach(btn => btn.onclick = () => { const id=btn.getAttribute("data-fare-toggle"); const panel=ROOT.querySelector("#fares-"+CSS.escape(id)); if(panel) panel.hidden = !panel.hidden; });
    ROOT.querySelectorAll("[data-pair-detail-toggle]").forEach(btn => btn.onclick = () => { const id=btn.getAttribute("data-pair-detail-toggle"); const panel=ROOT.querySelector("#detail-"+CSS.escape(id)); if(panel) panel.hidden = !panel.hidden; });
    ROOT.querySelectorAll("[data-pair-fare-toggle]").forEach(btn => btn.onclick = () => { const id=btn.getAttribute("data-pair-fare-toggle"); const panel=ROOT.querySelector("#fares-"+CSS.escape(id)); if(panel) panel.hidden = !panel.hidden; });
    ROOT.querySelectorAll("[data-addon-toggle]").forEach(btn => btn.onclick = () => { const id=btn.getAttribute("data-addon-toggle"); const kind=btn.getAttribute("data-addon-kind"); const panel=ROOT.querySelector("#addon-"+CSS.escape(kind)+"-"+CSS.escape(id)); if(panel) panel.hidden = !panel.hidden; });
    ROOT.querySelectorAll("[data-date-scroll]").forEach(btn => btn.onclick = () => {
      const strip = ROOT.querySelector("[data-date-strip]");
      if(strip){
        const dir = Number(btn.getAttribute("data-date-scroll") || 1);
        strip.scrollBy({left: dir * Math.max(240, Math.round(strip.clientWidth * 0.75)), behavior:"smooth"});
      }
    });
    ROOT.querySelectorAll("[data-date-pick]").forEach(btn => btn.onclick = () => {
      const d = btn.getAttribute("data-date-pick");
      if(!d) return;
      const picked = normalizeFutureYmd(d);
      const current = normalizeFutureYmd(state.search.departureDate);
      if(picked === current && state.rawFlights && state.rawFlights.length) return;
      /* Cancel in-flight fare calendar requests so they cannot race the full search. */
      state.fareFetchGen += 1;
      state.fareDateLoading.clear();
      state.searchError = "";
      persistFlightSearchSession(picked);
      /* Same full search path as search-bar flow; forceFresh clears stale date results. */
      loadFlights(true);
    });
    ROOT.querySelectorAll("[data-chip-sort]").forEach(btn => btn.onclick = () => { state.sort=btn.getAttribute("data-chip-sort") || "priceLow"; applyFilters(); });
    ROOT.querySelectorAll("[data-filter-sort]").forEach(btn => btn.onclick = () => { state.sort=btn.getAttribute("data-filter-sort") || state.sort; applyFilters(); });
    ROOT.querySelectorAll("[data-other-sort-toggle]").forEach(btn => btn.onclick = () => { const menu = btn.parentElement && btn.parentElement.querySelector(".ty-other-sort-menu"); if(menu) menu.hidden = !menu.hidden; });
    ROOT.querySelectorAll("[data-other-sort]").forEach(btn => btn.onclick = () => { state.sort=btn.getAttribute("data-other-sort") || "priceLow"; applyFilters(); });
    ROOT.querySelectorAll("[data-detail-tab]").forEach(btn => btn.onclick = () => {
      const panel = btn.closest('.ty-detail-panel');
      if(!panel) return;
      panel.querySelectorAll('[data-detail-tab]').forEach(x=>x.classList.toggle('active', x===btn));
      const key = btn.getAttribute('data-detail-tab');
      panel.querySelectorAll('[data-detail-body]').forEach(body=>body.classList.toggle('active', body.getAttribute('data-detail-body')===key));
    });

    const cont = ROOT.querySelector("[data-continue-roundtrip]");
    if(cont){
      cont.onclick = () => {
        const legs = routeLegs();
        const ok = legs.every(leg => selectedForLeg(leg.key));
        if(ok) openReviewWithAirReview(selectedItineraryFlights());
      };
    }
  }

  function handleSelectFlight(flightId, legKey){
    const selectedFlight = state.rawFlights.find(f => String(f.id) === String(flightId) && String(f.legKey) === String(legKey));
    if(!selectedFlight) return;

    setSelectedForLeg(legKey, selectedFlight);

    if(state.search.tripType === "oneway"){
      openReviewWithAirReview([selectedFlight]);
      return;
    }

    const legs = routeLegs();
    const ok = legs.every(leg => selectedForLeg(leg.key));
    if(ok){
      openReviewWithAirReview(selectedItineraryFlights());
    }else{
      renderResults();
      setTimeout(() => {
        const nextLeg = legs.find(leg => !selectedForLeg(leg.key));
        if(nextLeg){
          const title = Array.from(ROOT.querySelectorAll(".ty-leg-title")).find(x => x.textContent.trim() === nextLeg.label);
          if(title) title.scrollIntoView({behavior:"smooth", block:"start"});
        }
      }, 50);
    }
  }

  function tyNumber(){
    for(const v of arguments){
      if(v === undefined || v === null || v === '') continue;
      const x = Number(v);
      if(Number.isFinite(x)) return x;
    }
    return 0;
  }

  function tyPriceBreakup(f){
    const raw = f && (f.raw || f.rawPrice || f.selectedFare || f.totalPriceInfo || f) || {};
    const sources = [
      f && f.pricingBreakup,
      f && f.priceBreakup,
      f && f.priceBreakdown,
      raw && raw.pricingBreakup,
      raw && raw.priceBreakup,
      raw && raw.priceBreakdown,
      raw && raw.FareBreakup,
      raw && raw.fareBreakup,
      raw && raw.FareBreakdown,
      raw && raw.fareBreakdown,
      raw && raw.TaxBreakdown,
      raw && raw.taxBreakdown,
      raw && raw.totalFareDetail,
      raw && raw.totalPriceInfo,
      raw && raw.totalPriceInfo && raw.totalPriceInfo.totalFareDetail,
      raw && raw.totalPriceList && raw.totalPriceList[0],
      raw && raw.totalPriceList && raw.totalPriceList[0] && raw.totalPriceList[0].totalFareDetail,
      raw && raw.totalPriceList && raw.totalPriceList[0] && raw.totalPriceList[0].totalPriceInfo,
      raw && raw.totalPriceList && raw.totalPriceList[0] && raw.totalPriceList[0].fd && (raw.totalPriceList[0].fd.ADULT || raw.totalPriceList[0].fd.Adult || raw.totalPriceList[0].fd.adult),
      raw && raw.totalPriceList && raw.totalPriceList[0] && raw.totalPriceList[0].fd && (raw.totalPriceList[0].fd.ADULT || raw.totalPriceList[0].fd.Adult || raw.totalPriceList[0].fd.adult) && (raw.totalPriceList[0].fd.ADULT || raw.totalPriceList[0].fd.Adult || raw.totalPriceList[0].fd.adult).fC,
      raw && raw.fd && (raw.fd.ADULT || raw.fd.Adult || raw.fd.adult),
      raw && raw.fd && (raw.fd.ADULT || raw.fd.Adult || raw.fd.adult) && (raw.fd.ADULT || raw.fd.Adult || raw.fd.adult).fC,
      raw && raw.fC
    ].filter(function(x){ return x && typeof x === 'object' && !Array.isArray(x); });
    const out = {};
    sources.forEach(function(src){ Object.keys(src).forEach(function(k){ if(out[k] === undefined || out[k] === null || out[k] === '') out[k] = src[k]; }); });

    const adultFC = raw && raw.totalPriceList && raw.totalPriceList[0] && raw.totalPriceList[0].fd && (raw.totalPriceList[0].fd.ADULT || raw.totalPriceList[0].fd.Adult || raw.totalPriceList[0].fd.adult) && (raw.totalPriceList[0].fd.ADULT || raw.totalPriceList[0].fd.Adult || raw.totalPriceList[0].fd.adult).fC || raw && raw.fd && (raw.fd.ADULT || raw.fd.Adult || raw.fd.adult) && (raw.fd.ADULT || raw.fd.Adult || raw.fd.adult).fC || raw && raw.fC || {};
    const deepTotal = tyNumber(out.supplierTotal, out.apiSupplierTotal, out.rawSupplierTotal, out.TF, out.NF, out.totalFare, out.publishFare, out.PublishedFare, out.TotalFare, adultFC.TF, adultFC.NF, deepFirstValue(raw, ['TF','NF','TotalFare','PublishedFare','PublishFare','totalFare','totalAmount','fare']));
    const deepBase = tyNumber(out.baseFare, out.baseAmount, out.BF, out.ticketBaseFare, out.BaseFare, adultFC.BF, deepFirstValue(raw, ['BF','BaseFare','baseFare','baseAmount']));
    const deepTax = tyNumber(out.taxes, out.taxAmount, out.TAF, out.YQ, out.OtherCharges, out.airlineTaxes, out.apiTaxes, out.apiFeeAndSurcharges, out.Tax, out.TaxAmount, adultFC.TAF, adultFC.YQ, adultFC.OC, deepFirstValue(raw, ['TAF','YQ','Tax','TaxAmount','OtherCharges','taxes','taxAmount','totalTax']));
    if(deepTotal && !out.supplierTotal) out.supplierTotal = deepTotal;
    if(deepTotal && !out.apiSupplierTotal) out.apiSupplierTotal = deepTotal;
    if(deepBase && !out.baseFare) out.baseFare = deepBase;
    if(deepTax && !out.taxes) out.taxes = deepTax;
    if(deepTax && !out.apiTaxes) out.apiTaxes = deepTax;
    return out;
  }

  function tyResultDisplayAmount(f){
    const pb = tyPriceBreakup(f);
    return tyNumber(
      f && f.resultDisplayAmount,
      f && f.displayPrice,
      f && f.customerResultPrice,
      pb.resultDisplayAmount,
      pb.displayPrice,
      pb.customerPayable,
      pb.totalPayable,
      pb.ticketAmount,
      f && f.price,
      f && f.totalAmount,
      f && f.amount
    );
  }

  function priceFromSelectedFlight(f){
    return tyResultDisplayAmount(f);
  }

  function tyFlightFareParts(f){
    const pb = tyPriceBreakup(f);
    const displayTotal = Math.max(0, Math.round(tyResultDisplayAmount(f)));

    /* API/supplier amount is the real airline ticket amount returned by flight API.
       Hidden TravelYaraa markup is included inside the customer-facing ticket fare/result card.
       Open TravelYaraa booking/service charge is shown later in Price Summary and can be discounted. */
    const supplierTotal = Math.max(0, Math.round(tyNumber(
      pb.supplierTotal, pb.apiSupplierTotal, pb.rawSupplierTotal,
      pb.apiTotal, pb.rawTotal, pb.TF, pb.totalFare, pb.supplierAmount
    )));

    const apiBase = Math.max(0, Math.round(tyNumber(pb.baseFare, pb.baseAmount, pb.BF, pb.ticketBaseFare)));
    const apiTaxes = Math.max(0, Math.round(tyNumber(pb.taxes, pb.taxAmount, pb.TAF, pb.airlineTaxes, pb.apiTaxes, pb.apiFeeAndSurcharges)));
    const apiTicketTotal = Math.max(0, apiBase + apiTaxes);
    const supplierTicketAmount = Math.max(0, supplierTotal || apiTicketTotal);

    const explicitMarkup = Math.max(0, Math.round(tyNumber(
      pb.markupAmount, pb.markup, pb.envMarkup, pb.travelYaraaMarkup, f && f.markupAmount
    )));

    const openBookingCharge = Math.max(0, Math.round(tyNumber(
      pb.convenienceFee, pb.platformFee, pb.bookingFee, pb.serviceCharge, pb.travelYaraaCharge,
      f && f.convenienceFee, f && f.bookingFee, f && f.serviceCharge
    )));

    /* If backend already sends display/result amount, use it only to infer hidden markup.
       Do not treat hidden markup as an open fee. Customer must not see markup separately.
       displayTotal/resultDisplayAmount is already supplier + ENV markup (no convenience fee). */
    let hiddenMarkup = explicitMarkup;
    if(!hiddenMarkup && displayTotal && supplierTicketAmount){
      hiddenMarkup = Math.max(0, displayTotal - supplierTicketAmount);
    }

    const customerTicketAmount = Math.max(0, Math.round(
      displayTotal || (supplierTicketAmount + hiddenMarkup)
    ));

    let baseFare = apiBase;
    let airlineSurcharge = apiTaxes;

    if(!baseFare && supplierTicketAmount && airlineSurcharge && supplierTicketAmount >= airlineSurcharge){
      baseFare = Math.max(0, supplierTicketAmount - airlineSurcharge);
    }

    if(!baseFare && supplierTicketAmount){
      baseFare = Math.max(0, supplierTicketAmount - airlineSurcharge);
    }

    if(!airlineSurcharge && supplierTicketAmount){
      airlineSurcharge = Math.max(0, supplierTicketAmount - baseFare);
    }

    return {
      displayTotal,
      supplierTotal: supplierTicketAmount,
      supplierTicketAmount: Math.round(supplierTicketAmount),
      apiTicketAmount: Math.round(supplierTicketAmount),
      ticketAmount: Math.round(customerTicketAmount),
      customerTicketAmount: Math.round(customerTicketAmount),
      resultCardAmount: Math.round(customerTicketAmount || displayTotal),
      baseFare: Math.round(baseFare),
      airlineSurcharge: Math.round(airlineSurcharge),
      hiddenMarkup: Math.round(hiddenMarkup),
      markupAmount: Math.round(hiddenMarkup),
      bookingFee: Math.round(openBookingCharge),
      openBookingCharge: Math.round(openBookingCharge),
      convenienceFee: Math.round(openBookingCharge),
      feeSurcharge: Math.round(openBookingCharge)
    };
  }

  function tyResultCardFareAmount(flight){
    const parts = tyFlightFareParts(flight);
    return Math.max(0, Math.round(parts.resultCardAmount || parts.ticketAmount || tyResultDisplayAmount(flight)));
  }

  function flightConvenienceFee(flights){
    return flights.reduce(function(sum, f){ return sum + tyFlightFareParts(f).convenienceFee; }, 0);
  }

  function selectedOfferForFare(){
    /* Live-safe rule: discount is applied only after backend verification.
       Static offer cards are only quick coupon buttons; they do not change total locally. */
    if(state.selectedOffer && typeof state.selectedOffer === 'object' && state.selectedOffer.type === 'backend') return state.selectedOffer;
    return null;
  }

  function tyOfferCode(selectedOffer){
    return String(selectedOffer && (selectedOffer.code || selectedOffer.offerCode || selectedOffer.couponCode) || '').trim().toUpperCase();
  }

  function tyIsFeeWaiverOffer(selectedOffer){
    const code = tyOfferCode(selectedOffer);
    const type = String(selectedOffer && (selectedOffer.discountType || selectedOffer.typeOfDiscount || selectedOffer.kind) || '').toLowerCase();
    return code.includes('0FEE') || code.includes('ZEROFEES') || code.includes('NOFEE') || type.includes('fee');
  }

  function tyCheckoutConvenienceFee(ticketAmount, explicitFee){
    const given = Math.max(0, Math.round(Number(explicitFee || 0)));
    if(given > 0) return given;
    const base = Math.max(0, Math.round(Number(ticketAmount || 0)));
    if(!base) return 0;
    const flat = Math.max(0, Math.round(Number(window.TY_CONVENIENCE_FEE_FLAT || window.TRAVELYARAA_CONVENIENCE_FEE_FLAT || 0)));
    if(flat > 0) return flat;
    const pct = Number(window.TY_CONVENIENCE_FEE_PERCENT || window.TRAVELYARAA_CONVENIENCE_FEE_PERCENT || 2);
    if(Number.isFinite(pct) && pct > 0) return Math.round((base * pct) / 100);
    return 0;
  }

  function offerDiscountForFare(selectedOffer, fareBase){
    if(!selectedOffer || selectedOffer.type !== 'backend') return 0;
    const subtotal = Math.max(0, Number(fareBase && fareBase.subtotalBeforeDiscount || 0));
    const bookingFee = Math.max(0, Number(fareBase && (fareBase.bookingFee || fareBase.convenienceFee) || 0));
    let discount = Math.max(0, Number(selectedOffer.discountAmount || selectedOffer.discount || selectedOffer.value || 0));

    /* Fee-waiver offer: show full booking fee as green minus discount after backend verifies offer. */
    if(!discount && tyIsFeeWaiverOffer(selectedOffer)) discount = bookingFee;

    return Math.min(subtotal, discount);
  }

  function computeFare(flights){
    flights = Array.isArray(flights) ? flights.filter(Boolean) : [flights].filter(Boolean);
    const s = state.search || {};
    const adult = Math.max(1, Number(s.adults || 1));
    const child = Math.max(0, Number(s.children || 0));
    const infant = Math.max(0, Number(s.infants || 0));
    const paxCount = Math.max(1, adult + child + infant);

    /* One source of truth for price everywhere:
       1) Search result card/customer ticket fare = API ticket fare + hidden ENV markup.
       2) Price Summary open Fee & Surcharges = only TravelYaraa booking/service charge.
       3) Discount is shown green minus and reduces customer Grand Total.
       4) Supplier/API payable is kept separately so backend can use real API fare, not customer markup/charges. */
    const parts = flights.map(tyFlightFareParts);
    const supplierPayable = Math.round(parts.reduce(function(sum, p){ return sum + (p.supplierTicketAmount || p.supplierTotal || 0); }, 0));
    const apiBaseFare = Math.round(parts.reduce(function(sum, p){ return sum + (p.baseFare || 0); }, 0));
    const apiTaxes = Math.round(parts.reduce(function(sum, p){ return sum + (p.airlineSurcharge || 0); }, 0));
    const markupAmount = Math.round(parts.reduce(function(sum, p){ return sum + (p.markupAmount || p.hiddenMarkup || 0); }, 0));
    let openBookingCharge = Math.round(parts.reduce(function(sum, p){ return sum + (p.openBookingCharge || p.bookingFee || 0); }, 0));
    let ticketAmount = Math.round(parts.reduce(function(sum, p){ return sum + (p.customerTicketAmount || p.ticketAmount || p.resultCardAmount || 0); }, 0));

    if(!ticketAmount){
      ticketAmount = Math.max(0, supplierPayable + markupAmount);
    }
    openBookingCharge = tyCheckoutConvenienceFee(ticketAmount, openBookingCharge);

    const selectedOffer = selectedOfferForFare();
    const addOnTotal = Math.max(0, Math.round(selectedAddOnTotal()));
    const subtotalBeforeDiscount = Math.max(0, ticketAmount + openBookingCharge + addOnTotal);
    const offerDiscount = offerDiscountForFare(selectedOffer, {
      subtotalBeforeDiscount,
      bookingFee: openBookingCharge,
      convenienceFee: openBookingCharge
    });
    const total = Math.max(0, Math.round(subtotalBeforeDiscount - offerDiscount));

    return {
      baseFare: ticketAmount,
      ticketAmount,
      customerTicketAmount: ticketAmount,
      perTravellerFare: paxCount ? Math.round(ticketAmount / paxCount) : ticketAmount,
      paxCount,
      adult,
      child,
      infant,
      adultBaseFare: adult ? Math.round((ticketAmount / paxCount) * adult) : 0,
      childBaseFare: child ? Math.round((ticketAmount / paxCount) * child) : 0,
      infantBaseFare: infant ? Math.round((ticketAmount / paxCount) * infant) : 0,
      taxes: openBookingCharge,
      feeSurcharge: openBookingCharge,
      bookingFee: openBookingCharge,
      openBookingCharge,
      convenienceFee: openBookingCharge,
      feeAfterOffer: openBookingCharge,
      airlineSurcharge: apiTaxes,
      apiBaseFare,
      apiTaxes,
      supplierPayable,
      supplierAmount: supplierPayable,
      apiPayable: supplierPayable,
      supplierTicketAmount: supplierPayable,
      markupAmount,
      hiddenMarkup: markupAmount,
      travelYaraaMarkup: markupAmount,
      travelYaraaCharge: openBookingCharge,
      subtotalBeforeDiscount,
      selectedOffer,
      offerDiscount,
      discountAmount: offerDiscount,
      addOnTotal,
      selectedAddOns: state.selectedAddOns,
      total,
      customerPayable: total,
      payableByCustomer: total,
      resultDisplayAmount: ticketAmount,
      displayPrice: ticketAmount,
      currency: 'INR'
    };
  }


  function tyDiscountLabel(fare){
    const code = fare && fare.selectedOffer ? tyOfferCode(fare.selectedOffer) : '';
    return code ? `Discount (${esc(code)})` : 'Discount';
  }

  function renderBaseFarePassengerRows(fare){
    const rows = [];
    if(Number(fare.adult || 0) > 0) rows.push(['Adult', Number(fare.adult || 0), Number(fare.adultBaseFare || 0)]);
    if(Number(fare.child || 0) > 0) rows.push(['Child', Number(fare.child || 0), Number(fare.childBaseFare || 0)]);
    if(Number(fare.infant || 0) > 0) rows.push(['Infant', Number(fare.infant || 0), Number(fare.infantBaseFare || 0)]);
    return rows.map(function(row){
      return `<div class="ty-fare-row"><span>${row[1]} X ${esc(row[0])}</span><b>${money(row[2])}</b></div>`;
    }).join('');
  }

  function renderPriceSummaryBox(fare){
    const baseRows = renderBaseFarePassengerRows(fare);
    return `<section class="ty-price-card">
      <div class="ty-section-head"><h2>Price Summary</h2></div>
      <div class="ty-section-body">
        ${baseRows}
        <div class="ty-fare-row"><span>Total (Base Fare)</span><b>${money(fare.baseFare)}</b></div>
        <div class="ty-fare-row"><span>Fee & Surcharges</span><b>${money(fare.feeSurcharge || 0)}</b></div>
        ${fare.addOnTotal?`<div class="ty-fare-row"><span>Add-ons</span><b>${money(fare.addOnTotal)}</b></div>`:""}
        ${fare.offerDiscount?`<div class="ty-fare-row"><span>${tyDiscountLabel(fare)}</span><b class="ty-discount">- ${money(fare.offerDiscount)}</b></div>`:""}
        <div class="ty-divider"></div><div class="ty-total-row"><span>Grand Total</span><b>${money(fare.total)}</b></div>
      </div>
    </section>`;
  }

  function passengerMetas(){
    const s = state.search || {};
    const out = [];
    const add = (type, n) => { for(let i=0;i<Number(n||0);i++) out.push({index:out.length, type}); };
    add('Adult', Math.max(1, Number(s.adults || 1)));
    add('Child', Number(s.children || 0));
    add('Infant', Number(s.infants || 0));
    return out;
  }

  function paxDisplayIndex(meta){
    return passengerMetas().filter(x=>x.type===meta.type && x.index<=meta.index).length;
  }

  function renderPassengerTabs(metas){ return ''; }

  function ageOptionsForType(type){ return ''; }
  function isValidAgeForType(type, value){ return true; }

  function dobRequiredForPassengerType(type, airlineDobReq){
    const t = String(type || '').toLowerCase();
    if(t.includes('child') || t.includes('infant')) return true;
    if(t.includes('adult')) return Boolean(airlineDobReq);
    return Boolean(airlineDobReq);
  }

  function ageOnDate(dobYmd, travelDate){
    const dob = toDate(dobYmd);
    const ref = toDate(travelDate) || new Date();
    if(!dob || Number.isNaN(dob.getTime()) || Number.isNaN(ref.getTime())) return null;
    let years = ref.getFullYear() - dob.getFullYear();
    const beforeBirthday = (ref.getMonth() < dob.getMonth()) || (ref.getMonth() === dob.getMonth() && ref.getDate() < dob.getDate());
    if(beforeBirthday) years--;
    return years;
  }

  function isDobValidForPassenger(type, dobYmd){
    const years = ageOnDate(dobYmd, state.search && state.search.departureDate);
    if(years === null || years < 0) return false;
    const t = String(type || '').toLowerCase();
    if(t.includes('adult')) return years >= 12;
    if(t.includes('child')) return years >= 2 && years < 12;
    if(t.includes('infant')) return years < 2;
    return true;
  }

  function dobHintForType(type, airlineDobReq){
    const t = String(type || '').toLowerCase();
    if(t.includes('adult')) return airlineDobReq ? 'Required by selected airline' : 'Optional for adult';
    if(t.includes('child')) return 'Required for child: 2 to 11 years';
    if(t.includes('infant')) return 'Required for infant: below 2 years';
    return airlineDobReq ? 'Required' : 'Optional';
  }

  function requiredLabel(text){
    return esc(text) + '<em class="ty-required-star" aria-label="required">*</em>';
  }

  function passengerDisplayLabel(meta){
    return `${meta.type || 'Traveller'} ${paxDisplayIndex(meta)}`;
  }

  function renderPassengerFormPanel(meta, active, passReq, dobReq, panReq){
    const i = meta.index;
    const personLabel = passengerDisplayLabel(meta);
    const dobReqThis = dobRequiredForPassengerType(meta.type, dobReq);
    const previousSummary = i > 0 ? `<div class="ty-prev-pax-summary" data-prev-summary-for="${i}" hidden></div>` : '';
    const desktopPanel = !isMobileView();
    const dobFieldHtml = `<label class="ty-form-field ty-dob-field"><span>${dobReqThis ? requiredLabel('Date of Birth') : 'Date of Birth'}</span>${renderDOBSelects('dob_'+i, dobReqThis, meta.type)}</label>`;
    const passportDobHtml = (desktopPanel && passReq) ? `<label class="ty-form-field ty-passport-dob-field"><span>${dobReqThis ? requiredLabel('Date of Birth') : 'Date of Birth'}</span>${renderDOBSelects('dob_'+i, dobReqThis, meta.type)}</label>` : '';
    return `<div class="ty-pax-panel ${active?'active':''}" data-pax-panel="${i}">
      ${previousSummary}
      <h3 class="ty-pax-panel-title">${esc(personLabel)}</h3>
      <div class="ty-form-grid ty-name-grid"><label class="ty-form-field ty-title-field"><span>${requiredLabel('Title')}</span><select name="title_${i}" required><option value="">Title</option><option>Mr</option><option>Ms</option><option>Mrs</option></select></label><label class="ty-form-field ty-first-field"><span>${requiredLabel('First & Middle Name')}</span><input name="firstName_${i}" required autocomplete="given-name"></label><label class="ty-form-field ty-last-field"><span>${requiredLabel('Last Name')}</span><input name="lastName_${i}" required autocomplete="family-name"></label>${desktopPanel && passReq ? '' : dobFieldHtml}</div>
      ${passReq ? `<div class="ty-passport-box"><h3>Passport Details <em class="ty-required-star" aria-label="required">*</em></h3><div class="ty-field-note">Required for this selected flight as per airline rules.</div><div class="ty-form-grid two ty-passport-grid">${passportDobHtml}<label class="ty-form-field"><span>${requiredLabel('Passport Number')}</span><input name="passportNumber_${i}" required minlength="6" maxlength="15" pattern="[A-Za-z0-9]{6,15}" autocomplete="off"></label><label class="ty-form-field"><span>${requiredLabel('Passport Issuing Country')}</span><select name="passportIssueCountry_${i}" required data-doc-country="${i}">${nationalityOptions("IN")}</select></label><label class="ty-form-field"><span>${requiredLabel('Nationality')}</span><select name="nationality_${i}" required data-doc-nationality="${i}">${nationalityOptions("IN")}</select></label><label class="ty-form-field"><span>${requiredLabel('Passport Issue Date')}</span>${renderDateSelects('passportIssue_'+i, true, 'passportIssue')}</label><label class="ty-form-field"><span>${requiredLabel('Passport Expiry Date')}</span>${renderDateSelects('passportExpiry_'+i, true, 'passportExpiry')}</label></div></div>` : ''}
      ${panReq ? `<div class="ty-pan-wrap" data-pan-wrap="${i}" style="margin-top:10px"><div class="ty-form-grid two"><label class="ty-form-field"><span>${requiredLabel('PAN')}</span><input name="pan_${i}" maxlength="10" minlength="10" pattern="[A-Z]{5}[0-9]{4}[A-Z]" autocomplete="off" inputmode="text" autocapitalize="characters" spellcheck="false" data-pan-input="${i}" style="text-transform:uppercase"></label></div></div>` : ''}
    </div>`;
  }

  function tyJsonRead(keys){
    const out = {};
    function merge(data){
      if(!data || typeof data !== 'object') return;
      Object.assign(out, data);
      ['user','profile','customer','contact','guest','firebaseUser','currentUser'].forEach(function(k){
        if(data[k] && typeof data[k] === 'object') Object.assign(out, data[k]);
      });
    }
    (Array.isArray(keys) ? keys : [keys]).forEach(function(key){
      try{
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
        if(!raw) return;
        merge(JSON.parse(raw));
      }catch(e){}
    });
    return out;
  }

  function tySavedTravellerIdentity(form){
    const u = (typeof tyRecognizedLoggedInUser === 'function' && tyRecognizedLoggedInUser()) || null;
    if(!u) return { userId:'', email:'', phone:'' };
    const email = u.email || u.customerEmail || u.userEmail || '';
    const phoneRaw = u.phone || u.phoneNumber || u.mobile || '';
    const phone = String(phoneRaw || '').replace(/\D/g,'');
    const userId = u.userId || u.uid || u.id || u.customerId || '';
    return { userId:String(userId||'').trim(), email:String(email||'').trim().toLowerCase(), phone:phone };
  }


  function tyCanLoadSavedTravellers(){
    return Boolean(tyGuestAuthToken());
  }

  async function tyEnsureSavedTravellerAuth(){
    if(tyCanLoadSavedTravellers()) return true;
    const firebaseUser = window.tyCurrentFirebaseUser || (window.auth && window.auth.currentUser) || null;
    if(!firebaseUser || typeof window.tySyncFirebaseUserWithBackend !== 'function') return false;
    try{
      await window.tySyncFirebaseUserWithBackend(firebaseUser, {service:'flight'});
      state.savedTravellersAuthError = '';
      return tyCanLoadSavedTravellers();
    }catch(error){
      state.savedTravellersAuthError = (error && error.message) || 'Saved travellers could not be loaded.';
      return false;
    }
  }

  function tyActivePassengerIndex(form){
    const active = form && form.querySelector('.ty-pax-panel.active');
    const v = active && active.getAttribute('data-pax-panel');
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }

  function tyTravellerDisplayName(t){
    return [t.title || t.ti, t.firstName || t.first_name || t.fN, t.middleName || t.middle_name, t.lastName || t.last_name || t.lN].filter(Boolean).join(' ').replace(/\s+/g,' ').trim() || 'Traveller';
  }

  function tyTravellerSearchText(t){
    return [
      tyTravellerDisplayName(t),
      t && (t.firstName || t.first_name || t.givenName || t.fN),
      t && (t.middleName || t.middle_name),
      t && (t.lastName || t.last_name || t.surname || t.lN),
      t && (t.travellerType || t.type),
      t && (t.nationality || t.pNat),
      t && (t.passportNumber || t.passport_number || t.pNum),
      t && (t.passportLast4 || t.passportMasked),
      t && (t.passportExpiry || t.passport_expiry || t.eD),
      t && (t.dob || t.dateOfBirth || t.date_of_birth)
    ].join(' ').toLowerCase().replace(/\s+/g,' ').trim();
  }

  function tySavedTravellerSearchQuery(){
    return String(ROOT.querySelector('#tySavedTravellerSearch')?.value || '').trim().toLowerCase().replace(/\s+/g,' ');
  }

  function tySetInput(form, name, value){
    const el = form && form.querySelector(`[name="${CSS.escape(name)}"]`);
    if(!el || value === undefined || value === null || value === '') return;
    el.value = String(value);
    try{ el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
  }

  function tySetDate3(form, prefix, value){
    const s = normalizePassportDateToYmd(value);
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return;
    tySetInput(form, prefix + 'Year', m[1]);
    tySetInput(form, prefix + 'Month', m[2]);
    tySetInput(form, prefix + 'Day', m[3]);
  }

  function normalizePassportDateToYmd(value, role){
    const raw = String(value == null ? '' : value).trim();
    if(!raw) return '';
    let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m) return tyValidYmdParts(m[1], m[2], m[3]);
    m = raw.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
    if(m) return tyValidYmdParts(m[3], m[2], m[1]);
    m = raw.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})$/);
    if(m){
      const yy = Number(m[3]);
      const year = yy <= 49 ? (2000 + yy) : (1900 + yy);
      return tyValidYmdParts(String(year), m[2], m[1]);
    }
    const compact = raw.replace(/\D/g, '');
    if(/^\d{8}$/.test(compact)){
      /* Prefer YYYYMMDD when year looks plausible. */
      const y1 = Number(compact.slice(0, 4));
      if(y1 >= 1900 && y1 <= 2100) return tyValidYmdParts(compact.slice(0, 4), compact.slice(4, 6), compact.slice(6, 8));
      return tyValidYmdParts(compact.slice(4, 8), compact.slice(2, 4), compact.slice(0, 2));
    }
    if(/^\d{6}$/.test(compact)){
      const yy = Number(compact.slice(0, 2));
      const mm = compact.slice(2, 4);
      const dd = compact.slice(4, 6);
      let year = 2000 + yy;
      const as20 = new Date(year, Number(mm) - 1, Number(dd));
      if(role === 'dob'){
        if(!Number.isNaN(as20.getTime()) && as20.getTime() > Date.now()) year = 1900 + yy;
      }else if(role === 'expiry'){
        year = 2000 + yy;
      }else if(!Number.isNaN(as20.getTime()) && as20.getTime() > Date.now() + 1000 * 60 * 60 * 24 * 365 * 40){
        year = 1900 + yy;
      }
      return tyValidYmdParts(String(year), mm, dd);
    }
    return '';
  }

  function tyValidYmdParts(year, month, day){
    const y = Number(year), m = Number(month), d = Number(day);
    if(!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return '';
    const dt = new Date(y, m - 1, d);
    if(Number.isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
    return ymd(dt);
  }

  function tyKnownNationalityCode(value){
    const code = String(tyPassportCountryForSelect(value) || '').toUpperCase();
    if(!code || code.length !== 2) return '';
    const known = NATIONALITY_COUNTRIES.some(function(row){ return row[0] === code; });
    return known ? code : '';
  }

  function tyPassportCountryForSelect(value){
    const raw = String(value || '').trim().toUpperCase();
    if(!raw) return '';
    const map = { IND:'IN', INDIA:'IN', INDIAN:'IN', JPN:'JP', JAPAN:'JP', USA:'US', UNITEDSTATES:'US', UNITED_STATES:'US', GBR:'GB', UK:'GB', UNITEDKINGDOM:'GB', UNITED_KINGDOM:'GB', ARE:'AE', UAE:'AE' };
    const compact = raw.replace(/[^A-Z]/g, '');
    if(map[raw]) return map[raw];
    if(map[compact]) return map[compact];
    if(raw.length === 2 && /^[A-Z]{2}$/.test(raw)) return raw;
    if(compact.length === 2 && /^[A-Z]{2}$/.test(compact)) return compact;
    /* Do not invent country codes from partial OCR text. */
    return '';
  }

  function tyPassportNumberForDisplay(value){
    /* Clean only — never invent or rewrite passport numbers. */
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function tyPassportNameForDisplay(value){
    let v = String(value || '').trim().toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
    v = v.replace(/\bN\s+AMS\s+J\b/g, '').replace(/\bNAMSJ\b/g, '').replace(/\bGIVEN\b|\bNAME\b|\bSURNAME\b/g, '').replace(/\s+/g, ' ').trim();
    v = v.replace(/\b([A-Z])\1([A-Z]{2,})\b/g, '$1$2');
    return v;
  }

  function tyFillPassengerFromTraveller(form, index, t){
    if(!form || !t) return;
    const i = Number(index || 0);
    if(typeof setPassengerPanelActive === 'function') setPassengerPanelActive(form, i);
    const selectedTravellerId = String(t.travellerId || t.id || '').trim();
    if(selectedTravellerId) state.selectedSavedTravellerByPassenger[i] = selectedTravellerId;

    const first = tyPassportNameForDisplay(t.firstName || t.first_name || t.givenName || t.fN || '');
    const middle = tyPassportNameForDisplay(t.middleName || t.middle_name || '');
    const last = tyPassportNameForDisplay(t.lastName || t.last_name || t.surname || t.lN || '');
    const nationality = tyKnownNationalityCode(t.nationality || t.pNat || '');
    const issueCountry = tyKnownNationalityCode(t.passportIssueCountry || t.passportIssuingCountry || t.issuingCountry || '');
    const passportNumber = tyPassportNumberForDisplay(t.passportNumber || t.pNum || '');
    const dob = normalizePassportDateToYmd(t.dob || t.dateOfBirth || t.date_of_birth || '', 'dob');
    const issueDate = normalizePassportDateToYmd(t.passportIssueDate || t.passport_issue_date || t.pid || '', 'issue');
    const expiryDate = normalizePassportDateToYmd(t.passportExpiry || t.passport_expiry || t.eD || '', 'expiry');
    const gender = String(t.gender || t.sex || '').trim().toUpperCase();
    const titleFromGender = gender === 'M' || gender === 'MALE' ? 'Mr' : (gender === 'F' || gender === 'FEMALE' ? 'Ms' : '');

    if(t.title || t.ti || titleFromGender) tySetInput(form, `title_${i}`, t.title || t.ti || titleFromGender);
    if(first || middle) tySetInput(form, `firstName_${i}`, [first, middle].filter(Boolean).join(' '));
    if(last) tySetInput(form, `lastName_${i}`, last);
    if(dob) tySetDate3(form, `dob_${i}`, dob);
    if(nationality) tySetInput(form, `nationality_${i}`, nationality);
    if(passportNumber) tySetInput(form, `passportNumber_${i}`, passportNumber);
    if(issueCountry) tySetInput(form, `passportIssueCountry_${i}`, issueCountry);
    if(issueDate) tySetDate3(form, `passportIssue_${i}`, issueDate);
    if(expiryDate) tySetDate3(form, `passportExpiry_${i}`, expiryDate);
    try{ form.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
    try{ tyRenderSelectedTravellerUpdate(form, i); }catch(e){}
    try{
      const flights = state.reviewFlights && state.reviewFlights.length ? state.reviewFlights : [];
      tySyncPanVisibility(form, flights);
    }catch(e){}
  }

  function tySyncPanVisibility(form, flights){
    if(!form) return;
    const panApi = panRequiredForFlights(flights || []);
    passengerMetas().forEach(function(meta){
      const i = meta.index;
      const wrap = form.querySelector('[data-pan-wrap="' + i + '"]');
      const input = form.querySelector('[name="pan_' + i + '"]');
      if(!wrap || !input) return;
      const show = panApi && tyPassengerLooksIndian(form, i);
      wrap.hidden = !show;
      if(show){
        input.required = true;
        input.setAttribute('aria-required', 'true');
      }else{
        input.required = false;
        input.removeAttribute('aria-required');
        input.value = '';
        const field = validationFieldFor(input);
        if(field){
          field.classList.remove('ty-field-invalid');
          field.querySelectorAll('.ty-field-error').forEach(function(node){ node.remove(); });
        }
      }
    });
  }

  function tyBindPanAndNationalityControls(form, flights){
    if(!form || form.dataset.tyPanNatBound === '1') return;
    form.dataset.tyPanNatBound = '1';
    form.addEventListener('input', function(e){
      const t = e && e.target;
      if(!t || !t.getAttribute) return;
      if(t.getAttribute('data-pan-input') != null || /^pan_\d+$/.test(String(t.name || ''))){
        const cleaned = String(t.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
        if(t.value !== cleaned) t.value = cleaned;
      }
    }, true);
    form.addEventListener('change', function(e){
      const t = e && e.target;
      if(!t || !t.name) return;
      if(/^nationality_\d+$/.test(t.name) || /^passportIssueCountry_\d+$/.test(t.name)){
        tySyncPanVisibility(form, flights || []);
      }
    }, true);
    tySyncPanVisibility(form, flights || []);
  }

  function tyPassengerSlotOptions(){
    return passengerMetas().map(function(m){ return `<option value="${esc(m.index)}">${esc(passengerDisplayLabel(m))}</option>`; }).join('');
  }
  function renderSavedTravellerAssist(passReq){
    const passportUpload = passReq ? `<div class="ty-passport-upload-mini">
      <div class="ty-upload-main">
        <span class="ty-upload-icon" aria-hidden="true">▧</span>
        <div class="ty-upload-copy"><b>Upload Passport</b><small>PNG, JPG, JPEG, WEBP & PDF | Max 8 MB</small></div>
        <div class="ty-passport-inline-scan" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <button type="button" class="ty-passport-upload-button" data-passport-upload aria-controls="tyPassportUploadInput">Upload</button>
        <input id="tyPassportUploadInput" class="ty-passport-file-input" type="file" accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf" aria-label="Upload passport file">
      </div>
      <p class="ty-scan-review">Please review all scanned passport details before continuing.</p>
      <p class="ty-scan-status" id="tyPassportScanStatus" aria-live="polite"></p>
    </div>` : '';

    return `<div class="ty-saved-traveller-tools">
      <div class="ty-saved-search-box">
        <span class="ty-saved-search-icon" aria-hidden="true">⌕</span>
        <input id="tySavedTravellerSearch" type="search" placeholder="Search from Travellers List" autocomplete="off">
      </div>
      <div class="ty-saved-traveller-list" id="tySavedTravellerList"></div>
      <div class="ty-saved-traveller-update" id="tySavedTravellerUpdate" hidden>
        <span id="tySavedTravellerUpdateText"></span>
        <button type="button" data-update-saved-traveller>Update saved traveller</button>
      </div>
      ${passportUpload}
    </div>`;
  }
  function tyNormTravellerText(value){
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function tyTravellerFullNameKey(t){
    return [
      t && (t.title || t.ti),
      t && (t.firstName || t.first_name || t.givenName || t.fN),
      t && (t.lastName || t.last_name || t.surname || t.lN)
    ].map(tyNormTravellerText).filter(Boolean).join('|');
  }

  function tyPassportKey(t){
    const full = tyNormTravellerText(t && (t.passportNumber || t.passport_number || t.pNum));
    if(full) return full;
    const masked = tyNormTravellerText(t && (t.passportMasked || t.passportLast4));
    return masked ? masked.slice(-4) : '';
  }

  function tyDobKey(t){
    return String((t && (t.dob || t.dateOfBirth || t.date_of_birth)) || '').slice(0, 10);
  }

  function tyPassportExpiryKey(t){
    return String((t && (t.passportExpiry || t.passport_expiry || t.eD)) || '').slice(0, 10);
  }

  function tyTravellerAlreadySaved(current){
    const name = tyTravellerFullNameKey(current);
    if(!name) return false;
    const dob = tyDobKey(current);
    const pass = tyPassportKey(current);
    const exp = tyPassportExpiryKey(current);
    return (state.savedTravellers || []).some(function(saved){
      if(tyTravellerFullNameKey(saved) !== name) return false;
      const savedDob = tyDobKey(saved);
      const savedPass = tyPassportKey(saved);
      const savedExp = tyPassportExpiryKey(saved);
      if(dob && savedDob && dob !== savedDob) return false;
      if(pass && savedPass && pass !== savedPass && pass.slice(-4) !== savedPass.slice(-4)) return false;
      if(exp && savedExp && exp !== savedExp) return false;
      return true;
    });
  }

  function tyPassengerDetailsCompleteForSave(form){
    if(!form) return false;
    return passengerMetas().every(function(m){
      const i = m.index;
      const title = form.querySelector(`[name="title_${i}"]`)?.value || '';
      const firstName = form.querySelector(`[name="firstName_${i}"]`)?.value || '';
      const lastName = form.querySelector(`[name="lastName_${i}"]`)?.value || '';
      if(!String(title).trim() || !String(firstName).trim() || !String(lastName).trim()) return false;

      const dobDay = form.querySelector(`[name="dob_${i}Day"]`);
      const dobMonth = form.querySelector(`[name="dob_${i}Month"]`);
      const dobYear = form.querySelector(`[name="dob_${i}Year"]`);
      const dobRequired = Boolean((dobDay && dobDay.required) || (dobMonth && dobMonth.required) || (dobYear && dobYear.required));
      if(dobRequired && !getDate3(form, `dob_${i}`).value) return false;

      const passport = form.querySelector(`[name="passportNumber_${i}"]`);
      if(passport && passport.required && !String(passport.value || '').trim()) return false;

      const expDay = form.querySelector(`[name="passportExpiry_${i}Day"]`);
      const expMonth = form.querySelector(`[name="passportExpiry_${i}Month"]`);
      const expYear = form.querySelector(`[name="passportExpiry_${i}Year"]`);
      const expRequired = Boolean((expDay && expDay.required) || (expMonth && expMonth.required) || (expYear && expYear.required));
      if(expRequired && !getDate3(form, `passportExpiry_${i}`).value) return false;

      return true;
    });
  }

  function renderTravellerSaveConsent(){
    return `<div class="ty-save-traveller-after-details" id="tySaveTravellerAfterDetails" hidden>
      <label class="ty-save-traveller-line">
        <input id="tySaveTravellersForFuture" type="checkbox" checked>
        <span>Save these traveller details for future bookings.</span>
      </label>
      <p class="ty-save-traveller-status" id="tySaveTravellerStatus" aria-live="polite"></p>
    </div>`;
  }

  function tySetSaveTravellerStatus(message, type){
    const status = ROOT.querySelector('#tySaveTravellerStatus');
    if(!status) return;
    status.textContent = message || '';
    status.className = 'ty-save-traveller-status' + (type ? (' ' + type) : '');
  }

  function tyRefreshSaveTravellerLine(form){
    const wrap = ROOT.querySelector('#tySaveTravellerAfterDetails');
    if(!wrap) return;
    const ready = tyPassengerDetailsCompleteForSave(form);
    wrap.hidden = !ready;
    if(!ready){
      tySetSaveTravellerStatus('', '');
      return;
    }
    const travellers = collectTravellers(form).filter(function(t){ return t && (t.firstName || t.lastName || t.fN || t.lN); });
    if(!travellers.length) return;
    const allSaved = travellers.every(tyTravellerAlreadySaved);
    if(allSaved){
      tySetSaveTravellerStatus('Already passenger saved.', 'already');
    }else{
      tySetSaveTravellerStatus('', '');
    }
  }

  function tyBindSaveTravellerConsent(form){
    if(!form || form.dataset.tySaveTravellerBound === '1') return;
    form.dataset.tySaveTravellerBound = '1';

    const update = function(){
      try{ tyRefreshSaveTravellerLine(form); }catch(e){}
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);

    const checkbox = ROOT.querySelector('#tySaveTravellersForFuture');
    if(checkbox){
      checkbox.addEventListener('change', function(){
        if(!checkbox.checked) tySetSaveTravellerStatus('Traveller details will not be saved.', 'off');
        else update();
      });
    }

    setTimeout(update, 60);
    setTimeout(update, 500);
  }


  function tySelectedSavedTraveller(index){
    const id = String(state.selectedSavedTravellerByPassenger[Number(index || 0)] || '').trim();
    if(!id) return null;
    return (state.savedTravellers || []).find(function(t){ return String(t && (t.travellerId || t.id) || '') === id; }) || null;
  }

  function tyRenderSelectedTravellerUpdate(form, index){
    const wrap = ROOT.querySelector('#tySavedTravellerUpdate');
    const text = ROOT.querySelector('#tySavedTravellerUpdateText');
    if(!wrap || !text) return;
    const i = Number(index === undefined ? tyActivePassengerIndex(form) : index);
    const selected = tySelectedSavedTraveller(i);
    if(!selected){ wrap.hidden = true; text.textContent = ''; return; }
    wrap.hidden = false;
    text.textContent = 'Selected: ' + tyTravellerDisplayName(selected) + '. Edit the details above, then update for future bookings.';
    wrap.setAttribute('data-passenger-index', String(i));
  }

  async function tyUpdateSelectedTraveller(form){
    if(!form || !tyCanLoadSavedTravellers(form)){
      tySetSaveTravellerStatus('Login required to update traveller details.', 'off');
      return;
    }
    const i = Number(tyActivePassengerIndex(form));
    const selected = tySelectedSavedTraveller(i);
    const travellerId = String(selected && (selected.travellerId || selected.id) || '').trim();
    if(!travellerId){
      tySetSaveTravellerStatus('Select a saved traveller first.', 'off');
      return;
    }
    const traveller = collectTravellers(form)[i] || {};
    traveller.travellerId = travellerId;
    const button = ROOT.querySelector('[data-update-saved-traveller]');
    if(button){ button.disabled = true; button.textContent = 'Updating...'; }
    try{
      const res = await fetch(API_BASE + '/api/travellers/' + encodeURIComponent(travellerId), {
        method:'PUT',
        headers:Object.assign({'Content-Type':'application/json'}, tyGuestAuthHeaders()),
        body:JSON.stringify({traveller}),
        cache:'no-store'
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || data.success === false || !data.traveller){
        throw new Error(data.message || data.error || 'Traveller could not be updated.');
      }
      state.savedTravellers = (state.savedTravellers || []).map(function(item){
        return String(item && (item.travellerId || item.id) || '') === travellerId ? data.traveller : item;
      });
      state.selectedSavedTravellerByPassenger[i] = String(data.traveller.travellerId || travellerId);
      tySetSaveTravellerStatus('Traveller details updated for future bookings.', 'saved');
      tyRenderSavedTravellerList(form);
      tyRenderSelectedTravellerUpdate(form, i);
    }catch(e){
      tySetSaveTravellerStatus(e && e.message ? e.message : 'Traveller could not be updated.', 'off');
    }finally{
      if(button){ button.disabled = false; button.textContent = 'Update saved traveller'; }
    }
  }

  function tyRenderSavedTravellerList(form){
    const box = ROOT.querySelector('#tySavedTravellerList');
    if(!box) return;
    const q = tySavedTravellerSearchQuery();
    if(!q){
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    if(!tyCanLoadSavedTravellers(form)){
      if(state.savedTravellersAuthError){
        box.innerHTML = '<p class="ty-muted">'+esc(state.savedTravellersAuthError)+'</p>';
        return;
      }
      box.innerHTML = '<p class="ty-muted">Login to load your saved travellers.</p>';
      return;
    }
    const list = (state.savedTravellers || []).filter(function(t){ return tyTravellerSearchText(t).includes(q); });
    if(state.savedTravellersLoading){ box.innerHTML = '<p class="ty-muted">Loading saved travellers...</p>'; return; }
    if(!list.length){ box.innerHTML = '<p class="ty-muted">No traveller found for this search.</p>'; return; }
    box.innerHTML = list.slice(0, 8).map(function(t){
      const name = tyTravellerDisplayName(t);
      const passport = t.passportMasked || (t.passportLast4 ? ('Passport ending ' + t.passportLast4) : 'Passport not saved');
      const dob = t.dob || t.dateOfBirth || '';
      const nat = t.nationality || '';
      const exp = t.passportExpiry || t.passport_expiry || '';
      return `<button type="button" class="ty-saved-traveller-row" data-traveller-id="${esc(t.travellerId || t.id || '')}"><b>${esc(name)}</b><span>${esc(t.travellerType || t.type || 'Traveller')} • ${esc(passport)}</span><div>${dob?`<em>DOB: ${esc(dob)}</em>`:''}${nat?`<em>Nationality: ${esc(nat)}</em>`:''}${exp?`<em>Passport Expiry: ${esc(exp)}</em>`:''}</div></button>`;
    }).join('');
    box.querySelectorAll('[data-traveller-id]').forEach(function(btn){
      btn.addEventListener('click', function(){
        const id = btn.getAttribute('data-traveller-id');
        const t = (state.savedTravellers || []).find(function(x){ return String(x.travellerId || x.id) === String(id); });
        if(t){
          tyFillPassengerFromTraveller(form, ROOT.querySelector('#tyTravellerSlot')?.value || tyActivePassengerIndex(form), t);
          tySetSaveTravellerStatus('Already passenger saved.', 'already');
          tyRefreshSaveTravellerLine(form);
          tyRenderSelectedTravellerUpdate(form, ROOT.querySelector('#tyTravellerSlot')?.value || tyActivePassengerIndex(form));
        }
      });
    });
  }

  async function tyLoadSavedTravellers(form, force){
    if(!await tyEnsureSavedTravellerAuth()){ tyRenderSavedTravellerList(form); return; }
    if(state.savedTravellersLoaded && !force){ tyRenderSavedTravellerList(form); return; }
    state.savedTravellersLoading = true;
    tyRenderSavedTravellerList(form);
    try{
      const res = await fetch(API_BASE + '/api/travellers', {
        headers:tyGuestAuthHeaders(),
        cache:'no-store'
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || data.success === false){
        throw new Error(data.message || data.error || 'Saved travellers could not be loaded.');
      }
      state.savedTravellers = Array.isArray(data.travellers) ? data.travellers : [];
      state.savedTravellersLoaded = true;
    }catch(e){
      state.savedTravellers = [];
      state.savedTravellersLoaded = false;
      tySetSaveTravellerStatus(e && e.message ? e.message : 'Saved travellers could not be loaded.', 'off');
    }
    state.savedTravellersLoading = false;
    tyRenderSavedTravellerList(form);
    tyRefreshSaveTravellerLine(form);
  }

  async function tySaveReviewTravellers(form){
    const checked = ROOT.querySelector('#tySaveTravellersForFuture');
    if(checked && !checked.checked){
      tySetSaveTravellerStatus('Traveller details will not be saved.', 'off');
      return;
    }

    if(!await tyEnsureSavedTravellerAuth()){
      tySetSaveTravellerStatus(state.savedTravellersAuthError || 'Login required to save traveller details.', 'off');
      return;
    }

    if(!state.savedTravellersLoaded && !state.savedTravellersLoading){
      await tyLoadSavedTravellers(form, true);
    }

    const travellers = collectTravellers(form).filter(function(t){ return t && (t.firstName || t.lastName || t.fN || t.lN); });
    if(!travellers.length) return;

    const notSaved = travellers.filter(function(t){ return !tyTravellerAlreadySaved(t); });
    if(!notSaved.length){
      tySetSaveTravellerStatus('Already passenger saved.', 'already');
      return;
    }

    try{
      const saved = [];
      for(const traveller of notSaved){
        const res = await fetch(API_BASE + '/api/travellers', {
          method:'POST',
          headers:Object.assign({'Content-Type':'application/json'}, tyGuestAuthHeaders()),
          body:JSON.stringify({traveller}),
          cache:'no-store'
        });
        const data = await res.json().catch(()=>({}));
        if(!res.ok || data.success === false || !data.traveller){
          throw new Error(data.message || data.error || 'Traveller could not be saved.');
        }
        saved.push(data.traveller);
      }
      state.savedTravellers = saved.concat(state.savedTravellers || []).filter(function(item, index, list){
        const id = String(item && (item.travellerId || item.id) || '');
        return id ? list.findIndex(function(x){ return String(x && (x.travellerId || x.id) || '') === id; }) === index : true;
      });
      state.savedTravellersLoaded = true;
      tySetSaveTravellerStatus(saved.length > 1 ? 'Traveller details saved.' : 'Traveller detail saved.', 'saved');
      tyRenderSavedTravellerList(form);
      tyRefreshSaveTravellerLine(form);
    }catch(e){
      tySetSaveTravellerStatus(e && e.message ? e.message : 'Traveller could not be saved.', 'off');
      throw e;
    }
  }

  function tyLoadScript(src, marker){
    return new Promise(function(resolve, reject){
      if(marker && window[marker]){ resolve(window[marker]); return; }
      const existing = document.querySelector(`script[data-ty-script="${CSS.escape(src)}"]`);
      if(existing){ existing.addEventListener('load',()=>resolve(marker?window[marker]:true)); existing.addEventListener('error',()=>reject(new Error('Scanner library could not load.'))); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.setAttribute('data-ty-script', src);
      s.onload = ()=>resolve(marker?window[marker]:true);
      s.onerror = ()=>reject(new Error('Scanner library could not load.'));
      document.head.appendChild(s);
    });
  }

  function tyPassportCanvasCopy(canvas){
    if(!canvas || !canvas.getContext) return null;
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    out.getContext('2d', {willReadFrequently:true}).drawImage(canvas, 0, 0);
    return out;
  }

  function tyEnhancePassportCanvas(canvas, threshold){
    const out = tyPassportCanvasCopy(canvas);
    if(!out) return canvas;
    const ctx = out.getContext('2d', {willReadFrequently:true});
    const img = ctx.getImageData(0, 0, out.width, out.height);
    for(let i=0; i<img.data.length; i+=4){
      const gray = Math.round((img.data[i] * 0.299) + (img.data[i+1] * 0.587) + (img.data[i+2] * 0.114));
      const boosted = threshold
        ? (gray > threshold ? 255 : 0)
        : Math.max(0, Math.min(255, Math.round((gray - 45) * 1.55)));
      img.data[i] = boosted;
      img.data[i+1] = boosted;
      img.data[i+2] = boosted;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  function tyPassportCropCanvas(canvas, topRatio, heightRatio){
    if(!canvas || !canvas.getContext) return null;
    const sourceW = canvas.width;
    const sourceH = canvas.height;
    if(!sourceW || !sourceH) return null;
    const cropY = Math.max(0, Math.floor(sourceH * Number(topRatio || 0)));
    const cropH = Math.max(1, Math.min(sourceH - cropY, Math.floor(sourceH * Number(heightRatio || 1))));
    const out = document.createElement('canvas');
    out.width = sourceW;
    out.height = cropH;
    out.getContext('2d', {willReadFrequently:true}).drawImage(canvas, 0, cropY, sourceW, cropH, 0, 0, out.width, out.height);
    return out;
  }

  function tyPassportMrzCropCanvas(canvas){
    return tyEnhancePassportCanvas(tyPassportCropCanvas(canvas, 0.45, 0.55), 0);
  }

  async function tyPassportOcrSource(file){
    const type = String(file && file.type || '').toLowerCase();
    const name = String(file && file.name || '').toLowerCase();
    if(type === 'application/pdf' || /\.pdf$/.test(name)){
      await tyLoadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib');
      if(!window.pdfjsLib) throw new Error('PDF scanner could not load. Please upload a clear JPG/PNG photo.');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({scale:3.4});
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d', {willReadFrequently:true}), viewport}).promise;
      return canvas;
    }

    const img = document.createElement('img');
    img.decoding = 'async';
    const url = URL.createObjectURL(file);
    try{
      await new Promise(function(resolve, reject){ img.onload = resolve; img.onerror = reject; img.src = url; });
      const scale = Math.max(1, Math.min(2.4, 2100 / Math.max(1, img.width)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d', {willReadFrequently:true}).drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    }finally{
      try{ URL.revokeObjectURL(url); }catch(e){}
    }
  }

  function tyCleanPassportMrzLine(line){
    return String(line || '')
      .toUpperCase()
      .replace(/[«‹❮〈]/g, '<')
      .replace(/[|]/g, 'I')
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9<]/g, '');
  }

  function tyExtractPassportMrzLines(text){
    const out = [];
    String(text || '').split(/\r?\n/).forEach(function(line){
      const clean = tyCleanPassportMrzLine(line);
      if(clean.length >= 15 && /[<0-9]/.test(clean)) out.push(clean);
    });
    return out;
  }

  function tyUniqueLines(lines){
    const seen = new Set();
    return (lines || []).filter(function(line){
      const clean = tyCleanPassportMrzLine(line);
      if(!clean || seen.has(clean)) return false;
      seen.add(clean);
      return true;
    });
  }

  function tyPassportOcrVariants(source){
    const variants = [];
    const add = function(label, canvas, threshold, psm){
      if(canvas) variants.push({ label: label, canvas: threshold === false ? canvas : tyEnhancePassportCanvas(canvas, threshold || 0), psm: psm || 6 });
    };
    add('bottom MRZ enhanced', tyPassportCropCanvas(source, 0.46, 0.54), 0, 6);
    return variants;
  }

  async function tyRunPassportOcr(canvas, psm){
    const result = await window.Tesseract.recognize(canvas, 'eng', {
      tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
      preserve_interword_spaces:'0',
      tessedit_pageseg_mode:String(psm || 6)
    });
    const text = result && result.data && result.data.text || '';
    const confidence = Number(result && result.data && result.data.confidence || 0);
    return { text: text, confidence: confidence, lines: tyExtractPassportMrzLines(text) };
  }

  function tyPassportCropBoxCanvas(canvas, leftRatio, topRatio, widthRatio, heightRatio){
    if(!canvas || !canvas.getContext) return null;
    const sw = canvas.width, sh = canvas.height;
    const sx = Math.max(0, Math.floor(sw * Number(leftRatio || 0)));
    const sy = Math.max(0, Math.floor(sh * Number(topRatio || 0)));
    const cw = Math.max(1, Math.min(sw - sx, Math.floor(sw * Number(widthRatio || 1))));
    const ch = Math.max(1, Math.min(sh - sy, Math.floor(sh * Number(heightRatio || 1))));
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    out.getContext('2d', {willReadFrequently:true}).drawImage(canvas, sx, sy, cw, ch, 0, 0, cw, ch);
    return out;
  }

  function tyScalePassportCanvas(canvas, scale){
    if(!canvas || !canvas.getContext) return null;
    const s = Math.max(1, Number(scale || 1));
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * s);
    out.height = Math.round(canvas.height * s);
    const ctx = out.getContext('2d', {willReadFrequently:true});
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  }


  function tyEnsurePassportScanLoaderCss(){
    /* .ty-passport-scan-loader styles ship in assets/css/travelyaraa-loader.css,
       which every results page already links. */
    return true;
  }

  function tyShowPassportScanLoader(message){
    const cssReady = tyEnsurePassportScanLoaderCss();
    let loader = document.getElementById('tyPassportScanLoader');
    if(!loader){
      loader = document.createElement('div');
      loader.id = 'tyPassportScanLoader';
      loader.className = 'ty-passport-scan-loader';
      loader.hidden = true;
      loader.innerHTML = '<div class="ty-passport-scan-loader__box" role="status" aria-live="polite"><div class="ty-passport-scan-loader__dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="ty-passport-scan-loader__text"></p></div>';
      document.body.appendChild(loader);
    }else{
      const dots = loader.querySelector('.ty-passport-scan-loader__dots');
      if(dots && dots.querySelectorAll('i').length !== 4){
        dots.innerHTML = '<i></i><i></i><i></i><i></i>';
      }
    }
    const text = loader.querySelector('.ty-passport-scan-loader__text');
    if(text) text.textContent = message || 'Uploading passport...';
    loader.hidden = false;
    requestAnimationFrame(function(){ loader.classList.add('is-active'); });
    Promise.resolve(cssReady).catch(function(){});
  }

  function tySetPassportScanOverlayText(message){
    const loader = document.getElementById('tyPassportScanLoader');
    const text = loader && loader.querySelector('.ty-passport-scan-loader__text');
    if(text && message) text.textContent = message;
  }

  function tyHidePassportScanLoader(){
    const loader = document.getElementById('tyPassportScanLoader');
    if(loader){
      loader.classList.remove('is-active');
      loader.hidden = true;
    }
  }

  function tyPassportFriendlyScanError(message){
    const raw = String(message || '');
    if(tyLooksTechnicalCustomerError(raw) || !raw.trim()){
      return 'We could not read this passport. Please upload a clearer photo or enter details manually.';
    }
    if(/clearer|manually|could not read|not clear|unsupported|too large/i.test(raw)){
      return raw.length > 160
        ? 'We could not read this passport. Please upload a clearer photo or enter details manually.'
        : raw;
    }
    return 'We could not read this passport. Please upload a clearer photo or enter details manually.';
  }

  function tyTravellerScanUsable(t){
    if(!t) return false;
    const first = String(t.firstName || t.first_name || t.givenName || t.fN || '').trim();
    const last = String(t.lastName || t.last_name || t.surname || t.lN || '').trim();
    const pass = String(t.passportNumber || t.pNum || '').trim();
    const dob = normalizePassportDateToYmd(t.dob || t.dateOfBirth || t.date_of_birth || '', 'dob');
    const exp = normalizePassportDateToYmd(t.passportExpiry || t.passport_expiry || t.eD || '', 'expiry');
    return Boolean((first || last) && pass && (dob || exp));
  }

  async function tyPostPassportScanPayload(payload){
    const res = await fetch(API_BASE + '/api/travellers/passport-scan', {
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'}, tyGuestAuthHeaders()),
      body:JSON.stringify(payload || {}),
      cache:'no-store'
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || data.success === false || !data.traveller){
      throw new Error(tyPassportFriendlyScanError(data.message || data.error || ''));
    }
    return data;
  }

  async function tyRunPassportVisualOcr(canvas){
    /* Fast printed-field OCR. One pass per targeted zone keeps passport upload fast
       and avoids running many duplicate OCR variants on the customer phone. */
    const visualJobs = [
      {label:'full printed fields', canvas:canvas, psm:11, scale:1.7},
      {label:'name and date block', canvas:tyPassportCropBoxCanvas(canvas, 0.00, 0.22, 0.78, 0.56), psm:6, scale:2.05},
      {label:'passport number and dates block', canvas:tyPassportCropBoxCanvas(canvas, 0.38, 0.12, 0.60, 0.76), psm:11, scale:2.05}
    ].filter(function(job){ return job.canvas; });

    const texts = [];
    let confidence = 0;
    for(const job of visualJobs){
      const scaled = tyScalePassportCanvas(job.canvas, job.scale || 2);
      const c = tyEnhancePassportCanvas(scaled || job.canvas, 0) || scaled || job.canvas;
      const result = await window.Tesseract.recognize(c, 'eng', {
        preserve_interword_spaces:'1',
        tessedit_pageseg_mode:String(job.psm || 11)
      });
      const outText = result && result.data && result.data.text || '';
      if(outText) texts.push('[' + job.label + ']\n' + outText);
      confidence = Math.max(confidence, Number(result && result.data && result.data.confidence || 0));
    }
    return { text:texts.join('\n'), confidence:confidence };
  }

  async function tyScanPassportFile(file, form){
    const status = ROOT.querySelector('#tyPassportScanStatus');
    const set = function(msg, bad){
      if(status){
        status.textContent = bad ? (msg || '') : '';
        status.classList.toggle('bad', !!bad);
      }
      if(!bad && msg) tySetPassportScanOverlayText(msg);
    };
    if(!file) return;
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    const rejectEarly = function(msg){
      set(msg, true);
      tyHidePassportScanLoader();
      tySetPassportInlineScanning(false);
      tyClearPassportScanLock();
    };
    if(!(/^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/i.test(type) || /\.(jpg|jpeg|png|webp|pdf)$/i.test(name))){
      rejectEarly('Unsupported file. Please use PNG, JPG, JPEG, WEBP or PDF.');
      return;
    }
    if(file.size > 8 * 1024 * 1024){
      rejectEarly('File is too large. Please upload a file under 8 MB.');
      return;
    }

    tyBeginPassportScan(form);

    const uploadWrap = ROOT.querySelector('.ty-passport-upload-mini');
    const uploadBtn = ROOT.querySelector('[data-passport-upload]');
    const uploadInput = ROOT.querySelector('#tyPassportUploadInput');
    if(uploadBtn) uploadBtn.disabled = true;
    if(uploadInput) uploadInput.disabled = true;
    if(uploadWrap) uploadWrap.classList.add('is-scanning');
    tySetPassportInlineScanning(true);

    try{
      tyShowPassportScanLoader('Uploading passport...');
      await tyLoadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'Tesseract');
      tySetPassportScanOverlayText('Reading passport details...');
      const source = await tyPassportOcrSource(file);

      let visualOut = {text:'', confidence:0};
      try{
        tySetPassportScanOverlayText('Reading passport details...');
        visualOut = await tyRunPassportVisualOcr(source);
      }catch(_visualError){ visualOut = {text:'', confidence:0}; }

      const idx = Number(ROOT.querySelector('#tyTravellerSlot')?.value || tyActivePassengerIndex(form));
      if(visualOut.text && visualOut.text.replace(/\s+/g,'').length >= 12){
        try{
          tySetPassportScanOverlayText('Reading passport details...');
          const visualData = await tyPostPassportScanPayload({
            ocrText: visualOut.text,
            text: visualOut.text,
            mrzText: '',
            mrzLines: [],
            visualText: visualOut.text,
            passportVisualText: visualOut.text,
            confidence: Number(visualOut.confidence || 0),
            scanMode: 'printed-fields-fast'
          });
          if(tyTravellerScanUsable(visualData.traveller)){
            tyFillPassengerFromTraveller(form, idx, visualData.traveller);
            state.passportScanByPassenger[String(idx)] = Object.assign({}, visualData.traveller, {scannedAt:Date.now()});
            set('', false);
            return;
          }
        }catch(_fastParseError){ /* fall back to MRZ scan below */ }
      }

      tySetPassportScanOverlayText('Reading passport details...');
      const variants = tyPassportOcrVariants(source);
      let best = { text:'', lines:[], confidence:0, label:'' };
      const allTexts = [];
      let allLines = [];

      for(let i = 0; i < variants.length; i++){
        const v = variants[i];
        const out = await tyRunPassportOcr(v.canvas, v.psm);
        out.label = v.label;
        allTexts.push(out.text || '');
        allLines = allLines.concat(out.lines || []);
        if((out.lines || []).length > (best.lines || []).length || String(out.text || '').replace(/\s+/g,'').length > String(best.text || '').replace(/\s+/g,'').length){
          best = out;
        }
        const joined = (out.lines || []).join('\n');
        if((out.lines || []).length >= 2 && /^P[A-Z0-9<]/.test(joined)){
          best = out;
          break;
        }
      }

      allLines = tyUniqueLines(allLines);
      const combinedText = [visualOut.text || '', best.text || '', allLines.join('\n'), allTexts.join('\n')].filter(Boolean).join('\n');
      if(!combinedText || combinedText.replace(/\s+/g,'').length < 6){
        throw new Error('We could not read this passport. Please upload a clearer photo or enter details manually.');
      }

      tySetPassportScanOverlayText('Reading passport details...');
      const data = await tyPostPassportScanPayload({
        ocrText: combinedText,
        text: combinedText,
        mrzText: allLines.join('\n') || best.text || combinedText,
        mrzLines: allLines,
        visualText: visualOut.text || '',
        passportVisualText: visualOut.text || '',
        confidence: Math.max(Number(best.confidence || 0), Number(visualOut.confidence || 0)),
        scanMode: best.label || 'mrz-fallback'
      });
      if(!tyTravellerScanUsable(data.traveller)){
        throw new Error('We could not read this passport. Please upload a clearer photo or enter details manually.');
      }
      tyFillPassengerFromTraveller(form, idx, data.traveller);
      state.passportScanByPassenger[String(idx)] = Object.assign({}, data.traveller, {scannedAt:Date.now()});
      set('', false);
    }catch(e){
      set(tyPassportFriendlyScanError(e && e.message), true);
    }finally{
      tyHidePassportScanLoader();
      try{ hideBookingLoader(); }catch(e){}
      tyEndPassportScan(form);
      if(uploadBtn) uploadBtn.disabled = false;
      if(uploadInput) uploadInput.disabled = false;
      if(uploadWrap) uploadWrap.classList.remove('is-scanning');
      tySetPassportInlineScanning(false);
    }
  }


  function tySetPassportInlineScanning(active){
    try{
      const wrap = ROOT.querySelector('.ty-passport-upload-mini');
      const dots = ROOT.querySelector('.ty-passport-inline-scan');
      if(wrap) wrap.classList.toggle('is-scanning', !!active);
      if(dots){
        dots.style.display = active ? 'flex' : '';
        dots.setAttribute('aria-hidden', active ? 'false' : 'true');
      }
    }catch(_e){}
  }

  function bindSavedTravellerAssist(flights, form){
    if(!form) return;
    const search = ROOT.querySelector('#tySavedTravellerSearch');
    const refresh = ROOT.querySelector('#tyRefreshTravellers');
    const upload = ROOT.querySelector('[data-passport-upload]');
    const input = ROOT.querySelector('#tyPassportUploadInput');
    const updateSaved = ROOT.querySelector('[data-update-saved-traveller]');
    if(search && search.dataset.tyBound !== '1'){
      search.dataset.tyBound = '1';
      search.addEventListener('input', function(){ tyLoadSavedTravellers(form, false); tyRenderSavedTravellerList(form); });
    }
    if(updateSaved && updateSaved.dataset.tyBound !== '1'){
      updateSaved.dataset.tyBound = '1';
      updateSaved.addEventListener('click', function(){ tyUpdateSelectedTraveller(form); });
    }
    if(refresh && refresh.dataset.tyBound !== '1'){
      refresh.dataset.tyBound = '1';
      refresh.addEventListener('click', function(){ tyLoadSavedTravellers(form, true); });
    }
    if(upload && input && upload.dataset.tyPassportBound !== '1'){
      upload.dataset.tyPassportBound = '1';
      ['pointerdown','touchstart','mousedown'].forEach(function(evtName){
        upload.addEventListener(evtName, function(){
          tySetPassportUploadIntent(180000);
          try{ hideBookingLoader(); }catch(_e){}
        }, true);
      });
      upload.addEventListener('click', function(e){
        tySetPassportUploadIntent(180000);
        try{ hideBookingLoader(); }catch(_e){}
        if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
        try{ input.click(); }catch(_clickErr){}
      }, true);
    }
    if(input && input.dataset.tyPassportBound !== '1'){
      input.dataset.tyPassportBound = '1';
      input.addEventListener('click', function(e){
        tySetPassportUploadIntent(180000);
        try{ hideBookingLoader(); }catch(_e){}
        if(e) e.stopPropagation();
      }, true);
      input.addEventListener('input', function(e){ if(e) e.stopPropagation(); }, true);
      input.addEventListener('change', function(e){
        if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
        const selectedFile = input.files && input.files[0];
        if(!selectedFile){
          tyClearPassportScanLock();
          tySetPassportInlineScanning(false);
          return;
        }
        tySetPassportUploadIntent(180000);
        tySetPassportScanLock(180000);
        try{ hideBookingLoader(); }catch(_e){}
        tySetPassportInlineScanning(true);
        /* Show overlay immediately so upload never looks silent. */
        tyShowPassportScanLoader('Uploading passport...');
        requestAnimationFrame(function(){ tyScanPassportFile(selectedFile, form); });
        input.value='';
      }, true);
    }
    if(form.dataset.tyPassportFormGuard !== '1'){
      form.dataset.tyPassportFormGuard = '1';
      /* Capture guard must NOT stop input/change on #tyPassportUploadInput — that
         blocked the file input's own scan handler (loader + OCR never ran). */
      ['input','change','submit'].forEach(function(evtName){
        form.addEventListener(evtName, function(e){
          const target = e && e.target;
          if(!tyIsPassportUploadTarget(target)) return;
          if(evtName === 'input' || evtName === 'change') return;
          if(evtName === 'submit'){
            e.preventDefault();
            e.stopPropagation();
            if(e.stopImmediatePropagation) e.stopImmediatePropagation();
          }
        }, true);
      });
      form.querySelectorAll('[name="email"],[name="mobile"]').forEach(function(el){
        if(el.dataset.tySavedReloadBound === '1') return;
        el.dataset.tySavedReloadBound = '1';
        el.addEventListener('change', function(){ tyLoadSavedTravellers(form, true); });
      });
      form.addEventListener('input', function(){ tyRenderSelectedTravellerUpdate(form); });
      form.addEventListener('change', function(){ tyRenderSelectedTravellerUpdate(form); });
    }
    tyBindPanAndNationalityControls(form, flights || []);
    tyLoadSavedTravellers(form, false);
    tyRenderSelectedTravellerUpdate(form);
  }


  function renderPassengerDetails(flights, passReq, dobReq, panReq){
    const metas = passengerMetas();
    const first = metas[0];
    const rest = metas.slice(1);
    const parts = [];
    if(first){
      parts.push(renderPassengerFormPanel(first, true, passReq, dobReq, panReq));
    }
    rest.forEach(function(m){ parts.push(renderPassengerFormPanel(m, false, passReq, dobReq, panReq)); });
    if(rest.length){
      parts.push(`<div class="ty-pax-add-row" aria-label="Add passenger details">${rest.map(function(m){
        return `<button type="button" class="ty-pax-open-btn" data-pax-tab="${m.index}" data-pax-type="${esc(m.type || 'Traveller')}" data-pax-label="${esc(passengerDisplayLabel(m))}">Add ${esc(passengerDisplayLabel(m))}</button>`;
      }).join('')}<p class="ty-pax-lock-msg" id="tyPaxLockMsg" aria-live="polite"></p></div>`);
    }
    return `<article class="ty-review-card ty-traveller-card"><div class="ty-section-head ty-traveller-head"><h2>Travellers Details</h2><p>Name should be same as in government ID proof / Passport</p></div><div class="ty-section-body">${renderSavedTravellerAssist(passReq)}${parts.join('')}${renderTravellerSaveConsent()}</div></article>`;
  }

  function tyEnsureSavedTravellerToolsMounted(passReq){
    const form = ROOT.querySelector('#tyPassengerForm');
    if(!form) return;
    const card = ROOT.querySelector('.ty-traveller-card');
    const body = card && card.querySelector('.ty-section-body');
    if(!body) return;
    if(body.querySelector('.ty-saved-traveller-tools')) return;

    const holder = document.createElement('div');
    holder.innerHTML = renderSavedTravellerAssist(!!passReq);
    const tools = holder.firstElementChild;
    if(!tools) return;

    const firstPanel = body.querySelector('.ty-pax-panel,.ty-passenger-panel,.ty-form-panel,[data-pax-index],label.ty-form-field');
    if(firstPanel && firstPanel.parentNode === body) body.insertBefore(tools, firstPanel);
    else body.insertBefore(tools, body.firstChild);

    if(!body.querySelector('#tySaveTravellerAfterDetails')){
      const saveHolder = document.createElement('div');
      saveHolder.innerHTML = renderTravellerSaveConsent();
      body.appendChild(saveHolder.firstElementChild);
    }

    try{ bindSavedTravellerAssist(state.reviewFlights && state.reviewFlights.length ? state.reviewFlights : [], form); tyBindSaveTravellerConsent(form); }catch(e){}
  }

  function travelInsuranceDateValue(value){
    const text = String(value || '').trim();
    if(!text) return '';
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const date = new Date(text);
    if(Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function travelInsuranceContext(){
    const search = state.search || {};
    const start = travelInsuranceDateValue(search.departureDate || search.departDate || search.depart || search.date);
    const end = travelInsuranceDateValue(search.returnDate || search.arrivalDate || search.return || '');
    return {
      destination: String(search.destination || search.to || search.arrival || '').trim(),
      tripStartDate: start,
      tripEndDate: end && end !== start ? end : ''
    };
  }

  function renderTravelInsuranceCard(){
    const ctx = travelInsuranceContext();
    const travelDateText = ctx.tripStartDate ? (ctx.tripEndDate ? `${ctx.tripStartDate} to ${ctx.tripEndDate}` : ctx.tripStartDate) : '';
    const routeText = [ctx.destination, travelDateText].filter(Boolean).join(' • ');
    return `<article class="ty-travel-insurance-card" id="tyTravelInsuranceCard">
      <div class="ty-section-body">
        <button type="button" class="ty-travel-insurance-toggle" id="tyTravelInsuranceToggle" aria-expanded="false" aria-controls="tyTravelInsuranceOptions">
          <span class="ty-travel-insurance-icon" aria-hidden="true">🛡</span>
          <span class="ty-travel-insurance-title"><b>Travel Insurance</b><small>Optional${routeText ? ` • ${esc(routeText)}` : ''}</small></span>
          <span class="ty-travel-insurance-action">View options</span>
          <span class="ty-travel-insurance-arrow" aria-hidden="true">⌄</span>
        </button>
        <div class="ty-travel-insurance-options" id="tyTravelInsuranceOptions" hidden aria-hidden="true">
          <p class="ty-travel-insurance-intro">Add travel protection for eligible trip-related emergencies. Available benefits and price will be shown before you confirm.</p>
          <label class="ty-travel-insurance-choice active">
            <input type="radio" name="travelInsuranceChoice" value="none" checked>
            <span><b>Continue without travel insurance</b><small>Your flight booking will continue normally.</small></span>
          </label>
          <label class="ty-travel-insurance-choice">
            <input type="radio" name="travelInsuranceChoice" value="request">
            <span><b>Add travel insurance</b><small>Show available coverage for all travellers before final confirmation.</small></span>
          </label>
          <input type="hidden" name="travelInsuranceRequested" value="false">
          <p class="ty-travel-insurance-note" id="tyTravelInsuranceNote">Travel insurance is optional. Nothing is added unless you review and confirm the available plan.</p>
        </div>
      </div>
    </article>`;
  }

  function bindTravelInsuranceCard(form){
    if(!form) return;
    const toggle = form.querySelector('#tyTravelInsuranceToggle');
    const options = form.querySelector('#tyTravelInsuranceOptions');
    const action = form.querySelector('.ty-travel-insurance-action');
    const arrow = form.querySelector('.ty-travel-insurance-arrow');
    const hidden = form.querySelector('[name="travelInsuranceRequested"]');
    const note = form.querySelector('#tyTravelInsuranceNote');
    const choices = Array.from(form.querySelectorAll('[name="travelInsuranceChoice"]'));

    function setOpen(open){
      if(!options || !toggle) return;
      options.hidden = !open;
      options.setAttribute('aria-hidden', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.classList.toggle('active', open);
      if(action) action.textContent = open ? 'Close options' : 'View options';
      if(arrow) arrow.textContent = open ? '⌃' : '⌄';
    }

    function syncChoice(){
      const selected = form.querySelector('[name="travelInsuranceChoice"]:checked');
      const requested = Boolean(selected && selected.value === 'request');
      if(hidden) hidden.value = requested ? 'true' : 'false';
      choices.forEach(function(input){
        const row = input.closest('.ty-travel-insurance-choice');
        if(row) row.classList.toggle('active', input.checked);
      });
      if(note){
        note.textContent = requested
          ? 'Available coverage and price will be shown for your review before anything is added to the booking.'
          : 'Travel insurance is optional. Nothing is added unless you review and confirm the available plan.';
      }
    }

    if(toggle) toggle.onclick = function(){ setOpen(options ? options.hidden : true); };
    choices.forEach(function(input){ input.addEventListener('change', syncChoice); });
    syncChoice();
  }

  function collectTravelInsuranceIntent(form){
    const selected = form && form.querySelector('[name="travelInsuranceChoice"]:checked');
    const requested = Boolean(selected && selected.value === 'request');
    const ctx = travelInsuranceContext();
    return {
      requested,
      status: requested ? 'REQUESTED_PENDING_QUOTE' : 'NOT_REQUESTED',
      scope: 'ALL_TRAVELLERS',
      destination: ctx.destination,
      tripStartDate: ctx.tripStartDate,
      tripEndDate: ctx.tripEndDate,
      travellerCount: passengerMetas().length,
      source: 'FLIGHT_CHECKOUT'
    };
  }

  function renderFrequentTravellerCard(){
    return `<article class="ty-ff-card"><div class="ty-section-body"><button type="button" class="ty-ff-toggle" id="tyFrequentTravellerToggle" aria-expanded="false"><span>Frequent Traveller No</span><b>⌄</b></button><div class="ty-ff-fields" id="tyFrequentTravellerFields" hidden aria-hidden="true"><div class="ty-form-grid two"><label class="ty-form-field"><span>Frequent Flyer Airline</span><input name="frequentFlyerAirline" autocomplete="off"></label><label class="ty-form-field"><span>Frequent Flyer No</span><input name="frequentFlyerNo" autocomplete="off"></label></div><p class="ty-field-note">Frequent Flyer Number is subject to airline acceptance.</p></div></div></article>`;
  }


  function bookingViewportWidth(){
    const values = [
      window.innerWidth,
      document.documentElement && document.documentElement.clientWidth,
      window.visualViewport && window.visualViewport.width,
      window.screen && window.screen.width
    ].map(Number).filter(function(v){ return Number.isFinite(v) && v > 0; });
    return values.length ? Math.min.apply(null, values) : 1366;
  }

  function isMobileView(){
    const width = bookingViewportWidth();
    const ua = String(navigator.userAgent || navigator.vendor || '').toLowerCase();
    const mobileUa = /iphone|ipad|ipod|android|mobile|phone|tablet|wv/.test(ua);
    const coarsePointer = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || false;
    const hoverNone = (window.matchMedia && window.matchMedia('(hover: none)').matches) || false;
    const touchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    return width <= 1024 || mobileUa || coarsePointer || hoverNone || touchDevice;
  }

  function isDesktopView(){
    return !isMobileView();
  }

  function desktopContinueSelectors(){
    return [
      '.ty-desktop-continue',
      '.ty-left-continue',
      '#tyProceedPayment',
      '#tyProceedPaymentLeft',
      '#tyAddonPay',
      '#tyAddonPayLeft',
      '.ty-review-page.ty-booking-page .ty-payment-btn',
      '.ty-review-page.ty-addon-page .ty-payment-btn',
      '.ty-contact-card .ty-payment-btn',
      '.ty-booking-left > .ty-payment-btn',
      '.ty-review-left > .ty-payment-btn',
      '.ty-side > .ty-payment-btn',
      'form .ty-payment-btn',
      'aside .ty-payment-btn'
    ].join(',');
  }

  function removeDesktopContinueButtonsOnMobile(){
    if(isDesktopView()){
      document.body.classList.remove('ty-mobile-booking-view');
      document.body.classList.add('ty-desktop-booking-view');
      return;
    }
    document.body.classList.add('ty-mobile-booking-view');
    document.body.classList.remove('ty-desktop-booking-view');
    ROOT.querySelectorAll(desktopContinueSelectors()).forEach(function(btn){
      if(btn.closest('.ty-mobile-sticky') || btn.closest('.ty-mobile-sheet')) return;
      btn.remove();
    });
    ROOT.querySelectorAll('button').forEach(function(btn){
      if(btn.closest('.ty-mobile-sticky') || btn.closest('.ty-mobile-sheet')) return;
      const text = String(btn.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      if(text === 'continue booking' || text === 'continue payment'){
        btn.remove();
      }
    });
  }


  function enforceMobileDesktopBookingLayout(){
    const mobile = isMobileView();
    document.body.classList.toggle('ty-mobile-booking-view', mobile);
    document.body.classList.toggle('ty-desktop-booking-view', !mobile);

    if(mobile){
      ROOT.querySelectorAll('button,input[type="button"],input[type="submit"],a').forEach(function(el){
        if(el.closest && (el.closest('.ty-mobile-sticky') || el.closest('.ty-mobile-sheet'))) return;
        const text = String((el.textContent || el.value || '')).replace(/\s+/g,' ').trim().toLowerCase();
        const isContinue = text === 'continue booking' || text === 'continue payment';
        const isDesktopSelector = el.matches && el.matches(desktopContinueSelectors());
        if(isContinue || isDesktopSelector){
          if(el.parentNode) el.parentNode.removeChild(el);
        }
      });
    }

    ROOT.querySelectorAll('.ty-gst-card').forEach(function(card){
      const gst = card.querySelector('#tyGstUse,[name="gstUse"]');
      const checked = !!(gst && gst.checked);
      card.classList.toggle('gst-open', checked);
      card.querySelectorAll('[name="gstNumber"],[name="gstCompany"],[name="gstAddress"]').forEach(function(input){
        const holder = input.closest('label') || input.closest('.ty-form-field') || input.parentElement;
        const target = holder || input;
        target.style.setProperty('display', checked ? '' : 'none', 'important');
        target.hidden = !checked;
        if(!checked) input.value = '';
      });
      card.querySelectorAll('.ty-gst-fields,#tyGstFieldsHolder,.ty-gst-fields-holder').forEach(function(box){
        box.style.setProperty('display', checked ? '' : 'none', 'important');
        box.hidden = !checked;
        box.setAttribute('aria-hidden', checked ? 'false' : 'true');
      });
      if(gst && !gst.dataset.tyGstBound){
        gst.dataset.tyGstBound = '1';
        gst.addEventListener('change', enforceMobileDesktopBookingLayout);
      }
    });
  }

  function installMobileDesktopBookingGuard(){
    enforceMobileDesktopBookingLayout();
    if(window.__tyBookingLayoutObserver) return;
    window.__tyBookingLayoutObserver = new MutationObserver(function(){
      enforceMobileDesktopBookingLayout();
    });
    window.__tyBookingLayoutObserver.observe(ROOT, {childList:true, subtree:true});
    window.addEventListener('resize', enforceMobileDesktopBookingLayout, {passive:true});
    window.addEventListener('orientationchange', enforceMobileDesktopBookingLayout, {passive:true});
    setTimeout(enforceMobileDesktopBookingLayout, 0);
    setTimeout(enforceMobileDesktopBookingLayout, 300);
    setTimeout(enforceMobileDesktopBookingLayout, 900);
  }

function mobileFareSheets(flights, fare, options){
    options = options || {};
    const buttonText = options.buttonText || "Continue Booking";
    const includeReview = options.includeReview !== false;
    const travellerCount = fare.paxCount || passengerMetas().length || 1;
    const mobileBaseRows = renderBaseFarePassengerRows(fare).replace(/ty-fare-row/g, 'ty-break-row');
    const fareSheet = `<div class="ty-mobile-sticky" id="tyMobileSticky"><div><span>Grand Total</span><div class="ty-total-line"><b>${money(fare.total)}</b><button type="button" class="ty-info-btn" data-open-fare-sheet>i</button></div></div><button type="button" class="ty-continue" id="tyMobileContinue">${esc(buttonText)}</button></div>
    <div class="ty-mobile-sheet" id="tyFareSheet"><div class="ty-sheet-card"><button type="button" class="ty-sheet-close" data-close-sheet aria-label="Close">×</button><h2>Payment Details</h2><div class="ty-sheet-pane active" data-sheet-pane="breakup">${mobileBaseRows}<div class="ty-break-row"><span>Total (Base Fare)</span><b>${money(fare.baseFare || 0)}</b></div><div class="ty-break-row"><span>Fee & Surcharges</span><b>${money(fare.feeSurcharge || 0)}</b></div>${fare.addOnTotal?`<div class="ty-break-row"><span>Add-ons</span><b>${money(fare.addOnTotal)}</b></div>`:''}${fare.offerDiscount?`<div class="ty-break-row"><span>${tyDiscountLabel(fare)}</span><b class="ty-discount">- ${money(fare.offerDiscount)}</b></div>`:''}<div class="ty-break-row total"><span>Grand Total</span><b>${money(fare.total)}</b></div></div></div></div>`;
    if(!includeReview) return fareSheet;
    return fareSheet + `<div class="ty-mobile-sheet" id="tyReviewConfirm"><div class="ty-sheet-card"><button type="button" class="ty-sheet-close" data-close-sheet aria-label="Close">×</button><h2>Review Details</h2><p>Please verify itinerary and passenger details carefully.</p><div class="ty-review-flight"><div>${airlineLogoHTML(flights[0], 'ty-review-logo-img')}</div><div><b>${esc(state.search.origin)} to ${esc(state.search.destination)}</b><span>${esc(dateText(firstSegment(flights[0]).depDate || state.search.departureDate))} | ${esc(flights[0].departureTime)}-${esc(flights[flights.length-1].arrivalTime)} | ${esc(flights[0].duration || '')}</span></div></div><div id="tyReviewPassengerSummary"></div><div class="ty-review-actions"><button type="button" class="edit" data-close-sheet>Edit</button><button type="button" class="confirm" id="tyConfirmPay">Continue</button></div></div></div>`;
  }

  function fillReviewPassengerSummary(form){
    const box = ROOT.querySelector('#tyReviewPassengerSummary');
    if(!box || !form) return;
    const travellers = collectTravellers(form).filter(x=>x.firstName || x.fN || x.lastName || x.lN);
    box.innerHTML = travellers.map((t,i)=>`<div class="ty-break-row"><span>${esc(t.passengerType || 'Traveller')} ${i+1}</span><b>${esc([t.title || t.ti, t.firstName || t.fN, t.lastName || t.lN].filter(Boolean).join(' '))}</b></div>`).join('') || '<p class="ty-muted">Passenger details are not filled yet.</p>';
  }

  function bindMobileSheets(flights, form, error, msg, validate){
    ROOT.querySelectorAll('[data-open-fare-sheet]').forEach(btn=>btn.onclick=()=>ROOT.querySelector('#tyFareSheet')?.classList.add('active'));
    ROOT.querySelectorAll('[data-close-sheet]').forEach(btn=>btn.onclick=()=>btn.closest('.ty-mobile-sheet')?.classList.remove('active'));
    const cont = ROOT.querySelector('#tyMobileContinue');
    if(cont) cont.onclick = async () => {
      if(!validate(true)) return;
      cont.disabled = true;
      cont.textContent = '';
      if(msg){ msg.textContent = ''; msg.style.display = 'none'; }
      try{
        await tySaveReviewTravellers(form);
        renderAddOnsPage(flights, form);
      }catch(e){
        cont.disabled = false;
        cont.textContent = 'Continue Booking';
        if(error){ error.textContent = (e && e.message) || 'Unable to continue booking. Please try again.'; error.style.display = 'block'; }
        else alert((e && e.message) || 'Unable to continue booking. Please try again.');
      }
    };
    const confirm = ROOT.querySelector('#tyConfirmPay');
    if(confirm) confirm.onclick = async () => {
      if(!validate(true)) return;
      ROOT.querySelector('#tyReviewConfirm')?.classList.remove('active');
      if(msg){ msg.textContent = ''; msg.style.display = 'none'; }
      try{
        await tySaveReviewTravellers(form);
        renderAddOnsPage(flights, form);
      }catch(e){
        if(error){ error.textContent = (e && e.message) || 'Unable to continue booking. Please try again.'; error.style.display = 'block'; }
        else alert((e && e.message) || 'Unable to continue booking. Please try again.');
      }
    };
  }

  function routeSummaryForBooking(flights){
    const firstFlight = flights && flights[0] || {};
    const lastFlight = flights && flights[flights.length - 1] || firstFlight;
    const first = firstSegment(firstFlight);
    const last = lastSegment(lastFlight);
    const from = compactAirportLabel(firstFlight.departureCity || state.search.origin || first.depCode || '');
    const to = compactAirportLabel(lastFlight.arrivalCity || state.search.destination || last.arrCode || '');
    const airlineBits = [];
    flights.forEach(function(f){
      const text = [f.airlineName, f.flightCode].filter(Boolean).join(' | ');
      if(text && !airlineBits.includes(text)) airlineBits.push(text);
    });
    return { firstFlight, lastFlight, first, last, from, to, airlineText: airlineBits.join(' • ') };
  }

  function travelYaraaLogo(){
    return '<div class="ty-brand-logo"><img src="/travelyaraa-logo-transparent.png" alt="TravelYaraa"><span>TravelYaraa</span></div>';
  }

  function visaNoticeText(flight, seg){
    const src = seg && seg.raw ? seg.raw : seg || flight || {};
    const raw = textFromFareSource(src, ['transitVisa','visaRequired','transitVisaRequired','isVisaRequired','visaInfo','visaRequirement']);
    if(!raw) return '';
    const low = String(raw).toLowerCase();
    if(low === 'false' || low === 'no' || low === '0') return '';
    if(low === 'true' || low === 'yes' || low === '1') return 'Transit Visa required';
    return changeTextValue(raw);
  }

  function cityNameFromCode(code){
    const c = String(code || '').toUpperCase();
    const info = airportInfo(c);
    return (info && (info.city || info.name)) || compactAirportLabel(c) || c;
  }
  function compactDateForSegment(value){
    const raw = value || state.search.departureDate || '';
    const text = String(raw || '').trim();
    let y, m, d;

    // Keep supplier/API local date exactly; do not convert timezone.
    let match = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(match){
      y = Number(match[1]);
      m = Number(match[2]);
      d = Number(match[3]);
    }else{
      match = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
      if(match){
        d = Number(match[1]);
        m = Number(match[2]);
        y = Number(match[3]);
      }
    }

    if(y && m && d){
      const date = new Date(y, m - 1, d);
      if(!Number.isNaN(date.getTime())){
        return date.toLocaleDateString("en-IN", {weekday:"short", day:"2-digit", month:"short", year:"numeric"}).replace(/,/g,'').replace(/\s+/g,' ');
      }
    }

    return dateText(raw).replace(/,/g,'');
  }

  function segAirlineLogo(seg, flight){
    return airlineLogoHTML(Object.assign({}, flight || {}, {
      airlineName: seg.airlineName || (flight && flight.airlineName) || 'Airline',
      airlineCode: seg.airlineCode || (flight && flight.airlineCode) || '',
      airlineLogoUrl: (flight && flight.airlineLogoUrl) || ''
    }), 'ty-itin-logo-img');
  }

  function collectFlightSegmentsForCard(flights){
    const list = [];
    (Array.isArray(flights) ? flights : [flights]).filter(Boolean).forEach(function(f){
      const segs = Array.isArray(f.segments) && f.segments.length ? f.segments : [firstSegment(f) || {}];
      segs.forEach(function(seg){ list.push({flight:f, seg:seg}); });
    });
    return list;
  }

  function cleanLayoverLabel(minutes, code){
    const txt = layoverText(minutes);
    if(!txt) return '';
    const city = cityNameFromCode(code);
    return txt + ' layover' + (code ? (' in ' + city + ' (' + String(code).toUpperCase() + ')') : '');
  }

  const TY_DEP_TIME_KEYS = ["dt","dT","departureTime","depTime","departure.time","departureDateTime","departure.datetime","departure.dateTime","fromDateTime","from.time","origin.time","departure.at","departTime","startTime"];
  const TY_ARR_TIME_KEYS = ["at","aT","arrivalTime","arrTime","arrival.time","arrivalDateTime","arrival.datetime","arrival.dateTime","toDateTime","to.time","destination.time","arrival.at","reachTime","endTime"];

  function cardSegmentTime(seg, flight, side){
    const own = side === 'arr' ? seg.arrTime : seg.depTime;
    if(own && own !== '--:--') return timeText(own);

    const rawSeg = tyFindMatchingRawSegment(seg, flight);
    const rawApi = side === 'arr'
      ? (seg.arrDateTimeRaw || tyExactDateTimeFromApi(seg.raw || {}, 'arr') || tyExactDateTimeFromApi(rawSeg || {}, 'arr'))
      : (seg.depDateTimeRaw || tyExactDateTimeFromApi(seg.raw || {}, 'dep') || tyExactDateTimeFromApi(rawSeg || {}, 'dep'));
    if(rawApi) return timeText(rawApi);

    /* Last safety fallback: derive from API duration only when one real endpoint
       time is present and derived from real API duration/connection data. */
    const dur = durationMinutes((rawSeg && (rawSeg.duration || rawSeg.d)) || seg.durationMinutes || seg.duration || 0);
    if(dur > 0){
      if(side === 'arr'){
        const depRaw = seg.depDateTimeRaw || tyExactDateTimeFromApi(seg.raw || {}, 'dep') || tyExactDateTimeFromApi(rawSeg || {}, 'dep');
        const dt = depRaw ? new Date(depRaw) : null;
        if(dt && !Number.isNaN(dt.getTime())){ dt.setMinutes(dt.getMinutes() + dur); return timeText(dt.toISOString()); }
      }else{
        const arrRaw = seg.arrDateTimeRaw || tyExactDateTimeFromApi(seg.raw || {}, 'arr') || tyExactDateTimeFromApi(rawSeg || {}, 'arr');
        const at = arrRaw ? new Date(arrRaw) : null;
        if(at && !Number.isNaN(at.getTime())){ at.setMinutes(at.getMinutes() - dur); return timeText(at.toISOString()); }
      }
    }

    const segs = Array.isArray(flight && flight.segments) ? flight.segments : [];
    const idx = segs.indexOf(seg);
    const isSingle = segs.length <= 1 || idx === -1;
    const isFirst = idx === 0;
    const isLast = idx === segs.length - 1;
    const allowFlightLevel = isSingle || (side === 'dep' && isFirst) || (side === 'arr' && isLast);
    if(allowFlightLevel){
      const flightRaw = tyExactDateTimeFromApi(flight.raw || {}, side);
      if(flightRaw) return timeText(flightRaw);
      return timeText((side === 'arr' ? flight.arrivalTime : flight.departureTime) || '');
    }

    return '--:--';
  }

  function cardSegmentDateTime(seg, flight, side){
    const rawSeg = tyFindMatchingRawSegment(seg, flight);
    const rawValue = side === 'arr'
      ? (seg.arrDateTimeRaw || tyExactDateTimeFromApi(seg.raw || {}, 'arr') || tyExactDateTimeFromApi(rawSeg || {}, 'arr'))
      : (seg.depDateTimeRaw || tyExactDateTimeFromApi(seg.raw || {}, 'dep') || tyExactDateTimeFromApi(rawSeg || {}, 'dep'));
    const rawDate = rawValue ? new Date(rawValue) : null;
    if(rawDate && !Number.isNaN(rawDate.getTime())) return rawDate;

    const dateValue = side === 'arr' ? (seg.arrDate || state.search.departureDate) : (seg.depDate || state.search.departureDate);
    const date = dateValue ? new Date(dateValue) : null;
    const time = cardSegmentTime(seg, flight, side);
    if(!date || Number.isNaN(date.getTime()) || !time || time === '--:--') return null;
    const parts = String(time).match(/(\d{1,2}):(\d{2})/);
    if(!parts) return null;
    date.setHours(Number(parts[1]), Number(parts[2]), 0, 0);
    return date;
  }

  function computedLayoverMinutes(currentItem, nextItem){
    const cur = currentItem && currentItem.seg || {};
    const next = nextItem && nextItem.seg || {};
    const curFlight = currentItem && currentItem.flight || {};
    const nextFlight = nextItem && nextItem.flight || {};
    const rawCur = tyFindMatchingRawSegment(cur, curFlight) || cur.raw || {};
    const explicit = Number(cur.layoverAfter || cur.layoverMinutesAfter || cur.connectionMinutes || cur.connectionTime || cur.cT || rawCur.cT || rawCur.connectionTime || 0);
    if(explicit > 0) return explicit;
    const arr = cardSegmentDateTime(cur, curFlight, 'arr');
    const dep = cardSegmentDateTime(next, nextFlight, 'dep');
    if(arr && dep){
      let mins = Math.round((dep.getTime() - arr.getTime()) / 60000);
      if(mins < 0) mins += 24 * 60;
      if(mins > 0 && mins < 72 * 60) return mins;
    }
    return 0;
  }
  function cleanTerminal(value){
    const text = String(value || '').trim();
    if(!text) return '';
    const cleaned = text.replace(/^terminal\s*[-:]?\s*/i, '').replace(/^term\s*[-:]?\s*/i, '').trim();
    if(!cleaned) return '';
    return /^terminal\b/i.test(cleaned) ? cleaned : ('Terminal ' + cleaned);
  }

  function renderItinerarySegment(item, idx){
    const seg = item.seg || {};
    const flight = item.flight || {};
    const depCode = String(seg.depCode || flight.departureCity || '').toUpperCase();
    const arrCode = String(seg.arrCode || flight.arrivalCity || '').toUpperCase();
    const airlineName = seg.airlineName || flight.airlineName || 'Airline';
    const flightNo = seg.flightCode || flight.flightCode || [seg.airlineCode || flight.airlineCode, seg.flightNumber].filter(Boolean).join(' ');
    const cabin = normalizeCabin(state.search.cabinClass || flight.cabinClass || flight.cabin || 'ECONOMY').replace(/_/g,' ');
    const aircraft = changeTextValue(textFromFareSource(seg.raw || flight.raw || flight, ['equipment','aircraft','aircraftType','equipType','eT','ac'])) || changeTextValue(flight.aircraft || flight.equipment || '');
    const refundable = flight.refundable ? 'Refundable' : 'Non Refundable';
    const depTime = cardSegmentTime(seg, flight, 'dep');
    const arrTime = cardSegmentTime(seg, flight, 'arr');
    const depDateLine = compactDateForSegment(seg.depDate);
    const arrDateLine = compactDateForSegment(seg.arrDate);
    const depCity = cityNameFromCode(depCode);
    const arrCity = cityNameFromCode(arrCode);
    const depTerminal = seg.depTerminal ? cleanTerminal(seg.depTerminal) : '';
    const arrTerminal = seg.arrTerminal ? cleanTerminal(seg.arrTerminal) : '';
    return `<div class="ty-itin-segment">
      <div class="ty-itin-airrow">
        <div class="ty-itin-logo">${segAirlineLogo(seg, flight)}</div>
        <div class="ty-itin-airtext"><b>${esc(airlineName)}</b><span>${esc(flightNo || '')}</span></div>
        <em class="ty-itin-refund">${esc(refundable)}</em>
      </div>
      <div class="ty-itin-pills"><span>${esc(cabin || 'ECONOMY')}</span>${aircraft ? `<span>${esc(aircraft)}</span>` : ''}</div>
      <div class="ty-itin-routebox">
        <div class="ty-itin-point left">
          <small class="ty-itin-date-time">${esc(depDateLine)}</small>
          <strong class="ty-itin-code-time"><span class="ty-itin-code">${esc(depCode)}</span><span class="ty-itin-time">${esc(depTime)}</span></strong>
          ${depCity ? `<span class="ty-itin-city">${esc(depCity)}</span>` : ''}
          ${depTerminal ? `<i class="ty-itin-terminal">${esc(depTerminal)}</i>` : ''}
        </div>
        <div class="ty-itin-mid"><b>${esc(seg.duration || flight.duration || '')}</b><span></span></div>
        <div class="ty-itin-point right">
          <small class="ty-itin-date-time">${esc(arrDateLine)}</small>
          <strong class="ty-itin-code-time"><span class="ty-itin-time">${esc(arrTime)}</span><span class="ty-itin-code">${esc(arrCode)}</span></strong>
          ${arrCity ? `<span class="ty-itin-city">${esc(arrCity)}</span>` : ''}
          ${arrTerminal ? `<i class="ty-itin-terminal">${esc(arrTerminal)}</i>` : ''}
        </div>
      </div>
    </div>`;
  }

  
  function tyConnectionMinutesFallback(currentItem, nextItem){
    const cur = currentItem && currentItem.seg || {};
    const next = nextItem && nextItem.seg || {};
    const curFlight = currentItem && currentItem.flight || {};
    const nextFlight = nextItem && nextItem.flight || {};
    let mins = Number(cur.layoverAfter || cur.layoverMinutesAfter || cur.connectionMinutes || cur.connectionTime || cur.cT || 0);
    if(mins > 0) return mins;

    mins = Number(computedLayoverMinutes(currentItem, nextItem) || 0);
    if(mins > 0) return mins;

    const arrTime = cardSegmentTime(cur, curFlight, 'arr');
    const depTime = cardSegmentTime(next, nextFlight, 'dep');
    const arrParts = String(arrTime || '').match(/(\d{1,2}):(\d{2})/);
    const depParts = String(depTime || '').match(/(\d{1,2}):(\d{2})/);
    if(arrParts && depParts){
      const a = Number(arrParts[1]) * 60 + Number(arrParts[2]);
      const d = Number(depParts[1]) * 60 + Number(depParts[2]);
      mins = d - a;
      if(mins < 0) mins += 24 * 60;
      if(mins > 0 && mins < 72 * 60) return mins;
    }

    return 0;
  }

  function tyRenderItineraryConnection(currentItem, nextItem, idx){
    const cur = currentItem && currentItem.seg || {};
    const next = nextItem && nextItem.seg || {};
    const code = String(cur.arrCode || next.depCode || '').toUpperCase();
    if(!code) return '';

    const mins = tyConnectionMinutesFallback(currentItem, nextItem);
    if(!mins) return '';
    const city = cityNameFromCode(code);
    const timeText = layoverText(mins);
    return `<div class="ty-itin-layover">${esc(timeText)} layover in ${esc(city)} (${esc(code)})</div>`;
  }

  function renderItineraryCard(flights, opts){
    opts = opts || {};
    const segments = collectFlightSegmentsForCard(flights);
    if(!segments.length) return '';
    const first = segments[0].seg || {};
    const last = segments[segments.length-1].seg || first;
    const fromCode = String(first.depCode || state.search.origin || '').toUpperCase();
    const toCode = String(last.arrCode || state.search.destination || '').toUpperCase();
    const title = `${cityNameFromCode(fromCode)} to ${cityNameFromCode(toCode)}`;
    const departDate = compactDateForSegment(first.depDate || state.search.departureDate);

    const html = segments.map(function(item, idx){
      const segHtml = renderItinerarySegment(item, idx);
      const connectionHtml = idx < segments.length - 1 ? tyRenderItineraryConnection(item, segments[idx + 1], idx) : '';
      return segHtml + connectionHtml;
    }).join('');

    return `<section class="ty-itin-card ${opts.compact ? 'ty-itin-card-compact' : ''}">
      ${opts.hideTitle ? '' : `<div class="ty-itin-title"><h2>${esc(title)}</h2><p>${esc(departDate)} <span>Depart</span></p></div>`}
      <div class="ty-itin-segments">${html}</div>
      <div class="ty-itin-footer"><button type="button" data-open-policy data-policy-target="cancel">Fare Rules</button><button type="button" data-open-policy data-policy-target="baggage">Baggage</button></div>
    </section>`;
  }

  function renderBookingHero(flights){
    return renderItineraryCard(flights, {compact:false});
  }

  

  function renderPolicyButton(){
    return `<button type="button" class="ty-policy-open" data-open-policy><span>Refund, Date Change & Baggage Policy</span><b>›</b></button>`;
  }

  function baggageRowsForPolicy(flights){
    const rows=[];
    flights.forEach(function(f){
      const fare = f.selectedFare || f.rawPrice || f;
      const bag = readFareBaggage(fare, f);
      const segs = f.segments && f.segments.length ? f.segments : [{depCode:f.departureCity, arrCode:f.arrivalCity, raw:f.raw || {}}];
      segs.forEach(function(seg){
        const cabin = textFromFareSource(seg.raw || seg, ['cB','cabinBaggage','cabinBag','cabin']) || bag.cabin || '';
        const checkin = textFromFareSource(seg.raw || seg, ['iB','checkInBaggage','checkinBaggage','baggage']) || bag.checkin || '';
        if(cabin || checkin){ rows.push({route:[seg.depCode,seg.arrCode].filter(Boolean).join('-'), cabin, checkin}); }
      });
    });
    const unique=[]; const seen=new Set();
    rows.forEach(function(r){ const k=[r.route,r.cabin,r.checkin].join('|'); if(!seen.has(k)){seen.add(k); unique.push(r);} });
    return unique;
  }

  function policyTextRows(flights, type){
    const rows=[];
    flights.forEach(function(f){
      const fare = f.selectedFare || f.rawPrice || f;
      const route = [firstSegment(f).depCode || f.departureCity, lastSegment(f).arrCode || f.arrivalCity].filter(Boolean).join('-');
      let val = '';
      if(type === 'cancel') val = fare.cancellation || textFromFareSource(fare, ['cancellation','cancellationPolicy','cancelPolicy','cp','refundPenalty']) || deepFirstValue(f, ['cancellation','cancellationPolicy','cancelPolicy','cp','refundPenalty']);
      if(type === 'change') val = fare.dateChange || textFromFareSource(fare, ['dateChange','dateChangePolicy','changePolicy','dp','reschedule','reschedulePolicy']) || deepFirstValue(f, ['dateChange','dateChangePolicy','changePolicy','dp','reschedule','reschedulePolicy']);
      if(!val && type === 'cancel') val = f.refundable ? 'Refundable' : 'Non Refundable';
      if(val) rows.push({route, value: changeTextValue(val)});
    });
    return rows;
  }

  function policyPaneHtml(flights, type){
    if(type === 'baggage'){
      const rows = baggageRowsForPolicy(flights);
      if(!rows.length) return '<p class="ty-policy-empty">No baggage policy returned for this fare.</p>';
      return rows.map(function(r){return `<section class="ty-policy-route"><h3>${esc(r.route || 'Selected flight')}</h3><table><thead><tr><th>Passenger</th><th>Cabin</th><th>Check-in</th></tr></thead><tbody><tr><td>Adult</td><td>${esc(r.cabin || '-')}</td><td>${esc(r.checkin || '-')}</td></tr></tbody></table></section>`;}).join('');
    }
    const rows = policyTextRows(flights, type);
    if(!rows.length) return '<p class="ty-policy-empty">No policy detail returned for this fare.</p>';
    return rows.map(function(r){return `<section class="ty-policy-route"><h3>${esc(r.route || 'Selected flight')}</h3><div class="ty-policy-text">${esc(r.value)}</div></section>`;}).join('');
  }

  function openPolicyModal(flights, initialTab){
    initialTab = ['cancel','change','baggage'].includes(initialTab) ? initialTab : 'cancel';
    const old = document.getElementById('tyPolicyModal'); if(old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'tyPolicyModal';
    modal.className = 'ty-policy-modal';
    modal.innerHTML = `<section class="ty-policy-page" role="dialog" aria-modal="true">
      <header><h2>Refund and Baggage Policy</h2><button type="button" data-close-policy>×</button></header>
      <nav><button type="button" class="${initialTab==='cancel'?'active':''}" data-policy-tab="cancel">Cancellation</button><button type="button" class="${initialTab==='change'?'active':''}" data-policy-tab="change">Date Change</button><button type="button" class="${initialTab==='baggage'?'active':''}" data-policy-tab="baggage">Baggage</button></nav>
      <main><div class="ty-policy-pane ${initialTab==='cancel'?'active':''}" data-policy-pane="cancel">${policyPaneHtml(flights,'cancel')}</div><div class="ty-policy-pane ${initialTab==='change'?'active':''}" data-policy-pane="change">${policyPaneHtml(flights,'change')}</div><div class="ty-policy-pane ${initialTab==='baggage'?'active':''}" data-policy-pane="baggage">${policyPaneHtml(flights,'baggage')}</div></main>
    </section>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close-policy]').onclick = function(){ modal.remove(); };
    modal.querySelectorAll('[data-policy-tab]').forEach(function(btn){
      btn.onclick = function(){
        const key = btn.getAttribute('data-policy-tab');
        modal.querySelectorAll('[data-policy-tab]').forEach(x=>x.classList.toggle('active', x===btn));
        modal.querySelectorAll('[data-policy-pane]').forEach(p=>p.classList.toggle('active', p.getAttribute('data-policy-pane')===key));
      };
    });
  }

  function selectedOfferObject(fare){
    const fromFare = fare && fare.selectedOffer && fare.selectedOffer.type === 'backend' ? fare.selectedOffer : null;
    const fromState = state.selectedOffer && typeof state.selectedOffer === 'object' && state.selectedOffer.type === 'backend' ? state.selectedOffer : null;
    return fromFare || fromState || null;
  }

  function renderPromoCard(fare){
    const offer = selectedOfferObject(fare);
    return `<button type="button" class="ty-promo-card" data-open-promo><span class="ty-promo-icon">🏷</span><span><b>${esc(offer && (offer.code || offer.offerCode) || 'Apply promo code')}</b><small>${esc(offer && (offer.success || offer.message) || 'Discount will apply only after TravelYaraa verifies the offer.')}</small></span><em>›</em></button>`;
  }

  async function openPromoModal(flights){
    const old = document.getElementById('tyPromoModal'); if(old) old.remove();
    await loadFlightOffers();
    const fare = computeFare(flights);
    const selected = selectedOfferObject(fare);
    const modal = document.createElement('div');
    modal.id = 'tyPromoModal';
    modal.className = 'ty-promo-modal';
    modal.innerHTML = `<section class="ty-promo-page" role="dialog" aria-modal="true"><button type="button" class="ty-promo-close" data-close-promo>×</button><div class="ty-promo-gift">🎁</div><h2>Apply Promo Code</h2><div class="ty-promo-input"><input type="text" id="tyPromoInput" value="${esc(selected && (selected.code || selected.offerCode) || '')}"><button type="button" data-promo-apply-input>Apply</button></div><div class="ty-promo-list">${state.availableOffers.map(function(o){ const code=String(o.code||o.offerCode||'').toUpperCase(); const active = selected && String(selected.code || selected.offerCode).toUpperCase() === code; return `<article class="${active?'active':''}" data-promo-option="${esc(code)}"><b>${esc(code)} - ${esc(o.title||'Offer')}</b><p>${esc(o.customer_text||o.terms||'')}</p><button type="button" data-promo-apply-option="${esc(code)}">${active?'Applied':'Apply'}</button></article>`;}).join('') || '<p>No active flight offer is available right now.</p>'}</div></section>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close-promo]').onclick = function(){ modal.remove(); };
    modal.querySelectorAll('[data-promo-apply-option]').forEach(function(btn){
      btn.onclick = async function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        const code = btn.getAttribute('data-promo-apply-option');
        btn.disabled = true;
        btn.textContent = 'Applying...';
        const data = await applyCoupon(code, fare);
        if(data){ state.selectedOffer = Object.assign({}, data, {code:data.offerCode||data.code||code, type:'backend', value:Number(data.discountAmount||data.discount||0), discountAmount:Number(data.discountAmount||data.discount||0), success:data.message}); modal.remove(); renderFlightReviewStep(flights); return; }
        btn.disabled = false;
        btn.textContent = 'Apply';
      };
    });
    const apply = modal.querySelector('[data-promo-apply-input]');
    if(apply) apply.onclick = async function(){
      const input = modal.querySelector('#tyPromoInput');
      const data = await applyCoupon(input && input.value, fare);
      if(data){ state.selectedOffer = Object.assign({}, data, {code:data.offerCode||data.code, type:'backend', value:Number(data.discountAmount||data.discount||0), discountAmount:Number(data.discountAmount||data.discount||0), success:data.message}); modal.remove(); renderFlightReviewStep(flights); }
    };
  }

  function stopBookingHoldTimer(){
    if(state.bookingHoldTimer){ clearInterval(state.bookingHoldTimer); state.bookingHoldTimer = null; }
  }

  function startBookingHoldTimer(){
    stopBookingHoldTimer();
    state.bookingHoldDeadline = Date.now() + 10 * 60 * 1000;
    const box = ROOT.querySelector('#tyBookingTimer');
    const tick = function(){
      const left = Math.max(0, state.bookingHoldDeadline - Date.now());
      const mm = String(Math.floor(left / 60000)).padStart(2,'0');
      const ss = String(Math.floor((left % 60000) / 1000)).padStart(2,'0');
      if(box) box.textContent = `Expires in ${mm}:${ss}`;
      if(left <= 0){
        stopBookingHoldTimer();
        try{ sessionStorage.removeItem('ty_flight_review_form_values'); }catch(e){}
        openFlightSearchPage();
      }
    };
    tick();
    state.bookingHoldTimer = setInterval(tick, 1000);
  }



  function injectReviewTimerUpdateCss(){
    if(document.getElementById('ty-review-timer-update-css')) return;
    const style = document.createElement('style');
    style.id = 'ty-review-timer-update-css';
    style.textContent = `
      .ty-change-modal-page{min-height:100vh;background:rgba(7,29,73,.16);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}.ty-change-backdrop{position:fixed;inset:0;background:rgba(7,29,73,.45);backdrop-filter:blur(3px)}.ty-change-card{position:relative;z-index:1;width:min(560px,calc(100vw - 28px));max-height:calc(100vh - 70px);overflow:auto;background:#fff;border-radius:24px;box-shadow:0 22px 60px rgba(7,29,73,.28);padding:24px;border:1px solid #dce8f7}.ty-change-icon{width:46px;height:46px;border-radius:999px;background:#fff4e9;color:#f56b12;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:950;margin:0 auto 10px}.ty-change-card h1{margin:0;color:#071d49;font-size:26px;text-align:center;font-weight:950}.ty-change-card>p{margin:10px 0 18px;color:#475569;font-size:15px;line-height:1.5;text-align:center;font-weight:800}.ty-change-table{display:grid;gap:10px;margin:14px 0 18px}.ty-change-row{display:grid;grid-template-columns:92px minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:stretch;border:1px solid #e5edf7;border-radius:16px;background:#f8fbff;padding:12px}.ty-change-row>span{color:#071d49;font-size:13px;font-weight:950;align-self:center}.ty-change-row div{background:#fff;border:1px solid #edf2f7;border-radius:12px;padding:8px;min-width:0}.ty-change-row small{display:block;color:#64748b;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.ty-change-row b,.ty-change-row strong{display:block;color:#071d49;font-size:14px;line-height:1.3;overflow-wrap:anywhere}.ty-change-row strong{color:#0062e3}.ty-change-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ty-change-actions button{min-height:52px;border-radius:999px;font-size:15px;font-weight:950;cursor:pointer}.ty-change-actions .back{background:#fff;color:#071d49;border:1px solid #dce8f7}.ty-change-actions .continue{background:#f56b12;color:#fff;border:0}.ty-expire-timer{margin-left:auto;align-self:center;color:#f56b12;background:#fff4e9;border:1px solid #ffd5b5;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:950;white-space:nowrap}.ty-addon-icon{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border:2px solid #0062e3;border-radius:8px;position:relative;box-sizing:border-box}.ty-addon-icon-seat:before{content:'';width:10px;height:12px;border-left:3px solid #0062e3;border-bottom:3px solid #0062e3;border-radius:2px;display:block}.ty-addon-icon-meal:before{content:'';width:4px;height:14px;background:#0062e3;border-radius:3px;box-shadow:8px 0 0 #0062e3}.ty-addon-icon-baggage:before{content:'';width:13px;height:9px;border:2px solid #0062e3;border-radius:3px;display:block}.ty-addon-icon-baggage:after{content:'';position:absolute;top:2px;width:8px;height:4px;border:2px solid #0062e3;border-bottom:0;border-radius:4px 4px 0 0}.ty-addon-icon-extra:before{content:'+';font-size:20px;line-height:1;color:#0062e3;font-weight:950}.ty-addon-tabs button{font-size:14px!important;font-weight:950!important}.ty-addon-tabs button span:last-child{font-size:14px!important}
      @media(max-width:1024px){.ty-change-card{padding:20px 16px;border-radius:22px}.ty-change-row{grid-template-columns:1fr;gap:8px}.ty-change-card h1{font-size:22px}.ty-change-actions{grid-template-columns:1fr}.ty-expire-timer{position:absolute;right:12px;top:12px;font-size:11px;padding:6px 9px}.ty-review-top{position:relative;padding-right:118px!important}.ty-addon-tabs button{min-height:58px!important;font-size:13px!important}.ty-addon-tabs button span:last-child{font-size:13px!important}.ty-addon-icon{width:24px;height:24px}}

      /* ty-expire-desktop-top-v281: keep expiry timer above desktop price/right column */
      @media(min-width:1025px){
        .ty-review-page>.ty-expire-timer{position:fixed!important;right:26px!important;top:72px!important;z-index:140!important;margin:0!important;box-shadow:0 8px 22px rgba(245,107,18,.16)!important;}
        .ty-review-top.ty-booking-top{padding-right:170px!important;}
      }


      /* ty-contact-offer-required-v281 */
      .ty-contact-card .ty-section-head p{color:#475569!important;font-size:13px!important;font-weight:750!important;margin:0 0 14px!important}.ty-phone-row select{font-family:Inter,system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif!important;font-weight:900!important}.ty-phone-row select option{font-family:Inter,system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif!important}.ty-code-input-v2{display:grid!important;grid-template-columns:minmax(0,1fr) 92px!important;gap:0!important;align-items:center!important;border:1px solid #dce6f1!important;border-radius:10px!important;overflow:hidden!important;background:#fff!important}.ty-code-input-v2 input{width:100%!important;height:44px!important;border:0!important;padding:0 12px!important;font-size:14px!important;font-weight:850!important;color:#071d49!important;min-width:0!important}.ty-code-input-v2 button{height:44px!important;border:0!important;border-left:1px solid #dce6f1!important;background:#fff!important;color:#0062e3!important;font-size:14px!important;font-weight:950!important;cursor:pointer!important}.ty-code-input-v2 button[data-remove-coupon]{color:#d93025!important}.ty-offer-card{position:relative!important;grid-template-columns:24px minmax(0,1fr)!important;align-items:flex-start!important}.ty-offer-card .ty-offer-radio{display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:12px!important;font-weight:950!important}.ty-offer-card.active .ty-offer-radio{background:#0062e3!important;border-color:#0062e3!important}.ty-offer-card.active b{color:#0062e3!important}@media(min-width:768px){.ty-offer-box-v2 .ty-section-body{padding:14px!important}.ty-offer-box-v2 .ty-offer-list{max-height:none!important;gap:10px!important}.ty-offer-box-v2 .ty-offer-card{padding:12px!important}}@media(max-width:767px){.ty-code-input-v2{grid-template-columns:minmax(0,1fr) 86px!important}.ty-code-input-v2 input{height:42px!important}.ty-code-input-v2 button{height:42px!important}}


      /* ty-fare-modal-polish-v291 */
      .ty-fare-modal-head-v2 h2{color:#071d49!important;font-size:24px!important;font-weight:950!important;margin:0 44px 8px 0!important}.ty-fare-modal-title-row{display:flex!important;align-items:center!important;gap:14px!important;min-width:0!important}.ty-fare-modal-logo{width:52px!important;height:52px!important;border-radius:14px!important;background:#f5f8fc!important;border:1px solid #e5edf7!important;display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 52px!important;overflow:hidden!important}.ty-fare-modal-logo img,.ty-fare-modal-logo-img{max-width:42px!important;max-height:42px!important;object-fit:contain!important}.ty-fare-modal-flight-v2{display:grid!important;grid-template-columns:230px minmax(0,1fr)!important;gap:18px!important;align-items:center!important;padding:12px 0 14px!important;border-bottom:1px dashed #d1d5db!important}.ty-fare-flight-airline{display:flex!important;align-items:center!important;gap:12px!important;min-width:0!important}.ty-fare-flight-logo{width:54px!important;height:54px!important;border-radius:14px!important;background:#f5f8fc!important;border:1px solid #e5edf7!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;flex:0 0 54px!important}.ty-fare-flight-logo img{max-width:44px!important;max-height:44px!important;object-fit:contain!important}.ty-fare-flight-airline strong{display:block!important;color:#071d49!important;font-size:17px!important;font-weight:950!important;line-height:1.15!important}.ty-fare-flight-airline span{display:block!important;color:#64748b!important;font-size:13px!important;font-weight:900!important;margin-top:3px!important}.ty-fare-flight-route{display:grid!important;grid-template-columns:minmax(110px,1fr) minmax(88px,.72fr) minmax(110px,1fr)!important;gap:12px!important;align-items:center!important}.ty-fare-flight-route>div{min-width:0!important}.ty-fare-flight-route>div:last-child{text-align:right!important}.ty-fare-flight-route b{display:block!important;color:#111827!important;font-size:22px!important;line-height:1!important;font-weight:950!important}.ty-fare-flight-route span{display:block!important;margin-top:5px!important;color:#64748b!important;font-size:12px!important;font-weight:850!important}.ty-fare-flight-route em{display:block!important;margin-top:5px!important;color:#071d49!important;font-style:normal!important;font-size:13px!important;font-weight:850!important;line-height:1.3!important}.ty-fare-flight-route i{display:block!important;text-align:center!important;color:#071d49!important;font-size:14px!important;font-style:normal!important;font-weight:950!important;position:relative!important;white-space:nowrap!important}.ty-fare-flight-route i:before{content:""!important;position:absolute!important;left:0!important;right:0!important;top:calc(100% + 5px)!important;height:2px!important;background:#dce3ec!important;z-index:-1!important}.ty-fare-card-scroll{gap:14px!important}.ty-fare-option-card{flex-basis:285px!important;padding:14px!important;border-radius:14px!important}.ty-fare-card-top strong{font-size:22px!important}.ty-fare-card-top span{font-size:12px!important}.ty-fare-card-top em{font-size:12px!important;max-width:100px!important}.ty-fare-card-body section{padding-top:10px!important;margin-top:10px!important}.ty-fare-card-body h4{display:flex!important;align-items:center!important;gap:8px!important;font-size:14px!important;color:#071d49!important}.ty-fare-card-body h4 i{width:22px!important;height:22px!important;border-radius:999px!important;background:#eef6ff!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-style:normal!important;font-size:13px!important}.ty-fare-modal-line{display:grid!important;grid-template-columns:22px minmax(72px,.9fr) minmax(0,1fr)!important;gap:8px!important;align-items:center!important;font-size:12px!important}.ty-fare-modal-line:before{content:none!important}.ty-fare-modal-line i{width:20px!important;height:20px!important;border-radius:999px!important;background:#d7f8ec!important;color:#078a66!important;display:flex!important;align-items:center!important;justify-content:center!important;font-style:normal!important;font-size:11px!important;font-weight:950!important}.ty-fare-modal-line span{font-weight:900!important;color:#071d49!important;white-space:nowrap!important}.ty-fare-modal-line b{font-weight:750!important;color:#475569!important;overflow-wrap:anywhere!important}.ty-fare-card-book{min-height:44px!important;border-radius:10px!important;background:#0062e3!important}.ty-no-flights button[data-modify-search]{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:46px!important;min-width:240px!important;padding:12px 22px!important;border:0!important;border-radius:999px!important;background:#0062e3!important;color:#fff!important;font-size:15px!important;font-weight:950!important;box-shadow:0 12px 26px rgba(0,98,227,.22)!important}.ty-no-flights p{font-size:15px!important;line-height:1.5!important}.ty-no-flights h2{color:#071d49!important}@media(max-width:767px){.ty-fare-modal-title-row{gap:10px!important}.ty-fare-modal-logo{width:44px!important;height:44px!important;flex-basis:44px!important}.ty-fare-modal-head-v2 h2{font-size:20px!important}.ty-fare-modal-flight-v2{grid-template-columns:1fr!important;gap:10px!important}.ty-fare-flight-route{grid-template-columns:minmax(78px,1fr) 72px minmax(78px,1fr)!important;gap:6px!important}.ty-fare-flight-route b{font-size:18px!important}.ty-fare-option-card{flex-basis:280px!important}.ty-no-flights button[data-modify-search]{width:100%!important;max-width:280px!important;min-width:0!important}}


      /* ty-fare-sheet-v306 + ty-review-mobile-inset-v306 */
      .ty-fare-sheet-card{background:#fff!important;border-radius:22px!important;border:1px solid #e3ebf5!important;box-shadow:0 24px 80px rgba(7,29,73,.24)!important;overflow:hidden!important}.ty-fare-sheet-head{padding:18px 22px 12px!important;border-bottom:1px solid #eef2f7!important}.ty-fare-sheet-head h2{margin:0 54px 12px 0!important;color:#071d49!important;font-size:24px!important;font-weight:950!important;line-height:1.15!important}.ty-fare-route-line{display:flex!important;align-items:center!important;gap:12px!important;min-width:0!important;color:#071d49!important}.ty-fare-one-logo{width:46px!important;height:46px!important;min-width:46px!important;border-radius:14px!important;background:#f5f8fc!important;border:1px solid #e5edf7!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important}.ty-fare-one-logo img,.ty-fare-head-logo-img{max-width:36px!important;max-height:36px!important;object-fit:contain!important}.ty-fare-carrier-logos{width:auto!important;min-width:46px!important;max-width:160px!important;padding:4px!important;gap:4px!important;display:flex!important;overflow:hidden!important}.ty-fare-carrier-logo{width:38px!important;height:38px!important;min-width:38px!important;border-radius:10px!important;background:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important}.ty-fare-route-line b{display:block!important;font-size:16px!important;font-weight:950!important;color:#071d49!important;line-height:1.18!important}.ty-fare-route-line em{display:block!important;font-style:normal!important;font-size:12.5px!important;font-weight:800!important;color:#667085!important;line-height:1.35!important;margin-top:3px!important}.ty-fare-price-strip{display:grid!important;grid-template-columns:minmax(0,1fr) 110px minmax(0,1fr)!important;align-items:center!important;gap:12px!important;padding:14px 22px 8px!important}.ty-fare-price-strip>div{min-width:0!important}.ty-fare-price-strip>div:last-child{text-align:right!important}.ty-fare-price-strip small{display:block!important;color:#64748b!important;font-size:11px!important;font-weight:950!important;text-transform:uppercase!important;letter-spacing:.08em!important}.ty-fare-price-strip b{display:block!important;color:#111827!important;font-size:24px!important;font-weight:950!important;line-height:1.05!important;margin-top:3px!important}.ty-fare-price-strip span{display:block!important;color:#071d49!important;font-size:12.5px!important;font-weight:850!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;margin-top:4px!important}.ty-fare-price-strip em{display:block!important;margin-top:4px!important;color:#64748b!important;font-size:10.8px!important;font-style:normal!important;font-weight:750!important;line-height:1.35!important;white-space:normal!important}.ty-fare-price-strip i{font-style:normal!important;text-align:center!important;color:#071d49!important;font-size:13px!important;font-weight:950!important;position:relative!important;white-space:nowrap!important}.ty-fare-price-strip i:after{content:""!important;position:absolute!important;left:8px!important;right:8px!important;top:calc(100% + 6px)!important;border-top:2px solid #dbe3ee!important}.ty-fare-sheet-card>h3{margin:10px 22px 14px!important;color:#071d49!important;font-size:19px!important;font-weight:950!important}.ty-fare-sheet-card .ty-fare-card-scroll{padding:0 22px 22px!important;display:flex!important;gap:14px!important;overflow-x:auto!important;scroll-snap-type:x proximity!important}.ty-fare-sheet-card .ty-fare-option-card{flex:0 0 285px!important;max-height:520px!important;overflow:hidden!important;scroll-snap-align:start!important}.ty-fare-sheet-card .ty-fare-option-card:hover{overflow:auto!important}.ty-fare-sheet-card .ty-fare-modal-line i{background:#eef7ff!important;color:#0062e3!important}@media(max-width:767px){.ty-fare-sheet-card{width:100%!important;max-height:84vh!important;border-radius:24px 24px 0 0!important}.ty-fare-sheet-head{padding:18px 20px 10px!important}.ty-fare-sheet-head h2{font-size:22px!important;margin-right:54px!important}.ty-fare-price-strip{grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr)!important;gap:6px!important;padding:12px 20px 6px!important}.ty-fare-price-strip b{font-size:20px!important}.ty-fare-sheet-card>h3{font-size:17px!important;margin:10px 20px!important}.ty-fare-sheet-card .ty-fare-card-scroll{padding:0 20px 20px!important}.ty-fare-sheet-card .ty-fare-option-card{flex-basis:82vw!important;max-height:58vh!important;overflow:auto!important}.ty-review-page.ty-booking-page .ty-itin-card,.ty-review-page.ty-addon-page .ty-itin-card{width:calc(100vw - 24px)!important;margin-left:12px!important;margin-right:12px!important;border-left:1px solid #dce4ef!important;border-right:1px solid #dce4ef!important;border-radius:16px!important}.ty-review-page.ty-booking-page .ty-review-card.ty-flight-review-card,.ty-review-page.ty-addon-page .ty-review-card.ty-flight-review-card{width:calc(100vw - 24px)!important;margin-left:12px!important;margin-right:12px!important;border-left:1px solid #dce4ef!important;border-right:1px solid #dce4ef!important;border-radius:16px!important}.ty-review-page.ty-booking-page .ty-itin-segments,.ty-review-page.ty-addon-page .ty-itin-segments{padding-left:8px!important;padding-right:8px!important}}


      /* ty-addon-card-size-fix-v307
         Mobile Add-ons page: keep Flight Details card inside its parent,
         equal left/right spacing, no 100vw overflow. */
      @media(max-width:767px){
        .ty-review-page.ty-addon-page{
          overflow-x:hidden!important;
          max-width:100vw!important;
        }
        .ty-review-page.ty-addon-page .ty-booking-left,
        .ty-review-page.ty-addon-page .ty-section-body,
        .ty-review-page.ty-addon-page .ty-itin-segments{
          box-sizing:border-box!important;
          max-width:100%!important;
          overflow-x:hidden!important;
        }
        .ty-review-page.ty-addon-page .ty-review-card.ty-flight-review-card{
          width:calc(100vw - 24px)!important;
          max-width:calc(100vw - 24px)!important;
          margin-left:12px!important;
          margin-right:12px!important;
          border-radius:16px!important;
          overflow:hidden!important;
          box-sizing:border-box!important;
        }
        .ty-review-page.ty-addon-page .ty-review-card.ty-flight-review-card .ty-section-body{
          padding:12px!important;
        }
        .ty-review-page.ty-addon-page .ty-itin-card{
          width:100%!important;
          max-width:100%!important;
          margin:0!important;
          border-radius:14px!important;
          border:1px solid #dce4ef!important;
          box-sizing:border-box!important;
          overflow:hidden!important;
        }
        .ty-review-page.ty-addon-page .ty-itin-title{
          padding:12px 14px 10px!important;
          box-sizing:border-box!important;
        }
        .ty-review-page.ty-addon-page .ty-itin-title h2{
          font-size:22px!important;
          line-height:1.12!important;
          margin:0 0 6px!important;
          white-space:normal!important;
        }
        .ty-review-page.ty-addon-page .ty-itin-title p{
          font-size:14px!important;
          line-height:1.2!important;
        }
        .ty-review-page.ty-addon-page .ty-itin-segments{
          padding:10px 12px 0!important;
        }
        .ty-review-page.ty-addon-page .ty-itin-seg{
          padding:12px 0!important;
          gap:10px!important;
        }
        .ty-review-page.ty-addon-page .ty-seg-airline{
          gap:10px!important;
          min-width:0!important;
        }
        .ty-review-page.ty-addon-page .ty-seg-airline img,
        .ty-review-page.ty-addon-page .ty-seg-logo{
          width:46px!important;
          height:46px!important;
          min-width:46px!important;
          object-fit:contain!important;
        }
        .ty-review-page.ty-addon-page .ty-seg-airline h3,
        .ty-review-page.ty-addon-page .ty-seg-airline b{
          font-size:20px!important;
          line-height:1.12!important;
          white-space:normal!important;
          overflow-wrap:anywhere!important;
        }
        .ty-review-page.ty-addon-page .ty-seg-airline p,
        .ty-review-page.ty-addon-page .ty-seg-airline span{
          font-size:15px!important;
          line-height:1.18!important;
        }
        .ty-review-page.ty-addon-page .ty-seg-route-box{
          width:100%!important;
          max-width:100%!important;
          margin:10px 0 0!important;
          padding:10px 10px!important;
          box-sizing:border-box!important;
          grid-template-columns:minmax(0,1fr) 72px minmax(0,1fr)!important;
          gap:6px!important;
        }
        .ty-review-page.ty-addon-page .ty-seg-route-box b{
          font-size:23px!important;
          line-height:1.08!important;
          white-space:nowrap!important;
        }
        .ty-review-page.ty-addon-page .ty-seg-route-box span,
        .ty-review-page.ty-addon-page .ty-seg-route-box small{
          font-size:13px!important;
          line-height:1.15!important;
        }
        .ty-review-page.ty-addon-page .ty-itin-footer{
          padding:10px 14px 12px!important;
          justify-content:flex-end!important;
          gap:24px!important;
        }
      }


      /* ty-fare-bottom-sheet-v308
         Mobile fare options sheet should sit at bottom with no bottom gap. */
      @media(max-width:767px){
        .ty-fare-modal.ty-fare-sheet-v306{
          align-items:flex-end!important;
          justify-content:center!important;
          padding:0!important;
        }
        .ty-fare-modal.ty-fare-sheet-v306 .ty-fare-sheet-card{
          margin:0!important;
          width:100%!important;
          max-width:100%!important;
          border-radius:24px 24px 0 0!important;
          max-height:88vh!important;
          transform:none!important;
        }
        .ty-fare-modal.ty-fare-sheet-v306 .ty-fare-card-scroll{
          padding-bottom:14px!important;
        }
      }

      /* ty-change-compact-mobile-v920 */
      @media(max-width:767px){
        .ty-change-modal-page{min-height:100dvh!important;align-items:center!important;justify-content:center!important;padding:8px!important;overflow:hidden!important;}
        .ty-change-card{display:flex!important;flex-direction:column!important;width:calc(100vw - 22px)!important;max-height:calc(100dvh - 18px)!important;overflow:hidden!important;border-radius:22px!important;padding:14px!important;}
        .ty-change-icon{width:34px!important;height:34px!important;font-size:20px!important;margin:0 auto 6px!important;}
        .ty-change-card h1{font-size:22px!important;line-height:1.15!important;}
        .ty-change-card>p{font-size:12.5px!important;line-height:1.3!important;margin:6px 0 9px!important;}
        .ty-change-table{flex:1 1 auto!important;overflow:auto!important;max-height:none!important;margin:8px 0 10px!important;gap:8px!important;padding-right:2px!important;}
        .ty-change-row{grid-template-columns:74px minmax(0,1fr) minmax(0,1fr)!important;gap:6px!important;padding:8px!important;border-radius:14px!important;}
        .ty-change-row>span{font-size:12px!important;line-height:1.2!important;}
        .ty-change-row div{padding:7px!important;border-radius:11px!important;}
        .ty-change-row small{font-size:9.5px!important;}
        .ty-change-row b,.ty-change-row strong{font-size:12.5px!important;line-height:1.2!important;}
        .ty-change-actions{flex:0 0 auto!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin-top:2px!important;}
        .ty-change-actions button{min-height:42px!important;font-size:12.5px!important;border-radius:999px!important;}
      }

    `;
    document.head.appendChild(style);
  }

  function injectDesktopReviewRedesignCss(){
    if(document.getElementById('ty-desktop-review-redesign-css')) return;
    const style=document.createElement('style');
    style.id='ty-desktop-review-redesign-css';
    style.textContent=`
      @media(min-width:768px){
        .ty-review-page.ty-booking-page{position:relative!important;background:#f4f7fb!important;color:#071d49!important;}
        .ty-review-top.ty-booking-top{position:sticky!important;top:0!important;z-index:80!important;display:grid!important;grid-template-columns:46px 178px minmax(0,1fr)!important;align-items:center!important;gap:14px!important;min-height:74px!important;padding:12px max(24px,calc((100vw - 1180px)/2))!important;background:#fff!important;border-bottom:1px solid #e5edf7!important;box-shadow:0 4px 14px rgba(7,29,73,.06)!important;}
        .ty-review-top .ty-review-back{width:44px!important;height:44px!important;border-radius:12px!important;background:#eef6ff!important;color:#071d49!important;font-size:34px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;}
        .ty-review-top .ty-brand-logo{display:flex!important;justify-content:flex-start!important;align-items:center!important;margin:0!important;min-width:0!important;}
        .ty-review-top .ty-brand-logo img{height:48px!important;max-width:172px!important;width:auto!important;object-fit:contain!important;}
        .ty-review-top .ty-brand-logo span{display:none!important;}
        .ty-review-top h1{font-size:24px!important;line-height:1.05!important;color:#071d49!important;font-weight:950!important;margin:0!important;}
        .ty-review-top p{font-size:13px!important;color:#64748b!important;margin:5px 0 0!important;font-weight:850!important;}
        .ty-review-page>.ty-expire-timer{position:absolute!important;top:88px!important;right:max(24px,calc((100vw - 1180px)/2))!important;left:auto!important;width:auto!important;max-width:178px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;padding:7px 13px!important;margin:0!important;background:#fff4e9!important;border:1px solid #ffd4ad!important;color:#f05d0e!important;font-size:12px!important;font-weight:950!important;white-space:nowrap!important;box-shadow:0 4px 12px rgba(7,29,73,.06)!important;}
        .ty-review-shell.ty-booking-shell{width:min(1180px,calc(100% - 48px))!important;margin:28px auto 56px!important;display:grid!important;grid-template-columns:minmax(0,1fr) 350px!important;gap:24px!important;align-items:start!important;}
        .ty-review-left.ty-booking-left{gap:18px!important;}
        .ty-section-head h2,.ty-passport-box h3,.ty-pax-panel-title{color:#071d49!important;font-weight:950!important;}
        .ty-section-head h2{font-size:18px!important;}.ty-section-head p{font-size:13px!important;color:#64748b!important;}
        .ty-pax-panel-title{font-size:16px!important;margin:4px 0 12px!important;}
        .ty-form-grid.ty-name-grid{display:grid!important;grid-template-columns:124px minmax(0,1.1fr) minmax(0,1fr)!important;gap:12px!important;align-items:start!important;}
        .ty-title-field select{max-width:124px!important;}
        .ty-form-field span{color:#334155!important;font-size:12px!important;font-weight:900!important;}
        .ty-passport-box{margin-top:16px!important;border:1px solid #e5edf7!important;border-radius:14px!important;background:#fff!important;padding:16px!important;}
        .ty-passport-box h3{font-size:15px!important;margin:0 0 6px!important;}
        .ty-passport-box .ty-field-note{font-size:12px!important;color:#64748b!important;margin-bottom:12px!important;}
        .ty-passport-box .ty-passport-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;}
        .ty-passport-dob-field{grid-column:auto!important;}
        .ty-form-field input,.ty-form-field select{border-radius:10px!important;min-height:42px!important;border:1px solid #cfd8e6!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function injectItineraryCardCss(){
    if(document.getElementById('ty-itinerary-card-css')) return;
    const style = document.createElement('style');
    style.id = 'ty-itinerary-card-css';
    style.textContent = `
      .ty-itin-card{background:#fff!important;color:#071d49!important;border:1px solid #dfe8f3!important;border-radius:16px!important;box-shadow:0 8px 22px rgba(7,29,73,.07)!important;padding:0!important;overflow:hidden!important;margin:0!important;max-width:100%!important;box-sizing:border-box!important;}
      .ty-itin-card *{box-sizing:border-box!important;text-shadow:none!important;letter-spacing:.02em!important;}
      .ty-itin-title{padding:14px 18px 10px!important;border-bottom:1px solid #e5edf7!important;background:#fff!important;position:relative!important;}
      .ty-itin-title h2{margin:0!important;color:#111!important;font-size:24px!important;line-height:1.15!important;font-weight:950!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      .ty-itin-title p{margin:6px 0 0!important;color:#454b57!important;font-size:14px!important;line-height:1.2!important;font-weight:800!important;}
      .ty-itin-title p span{display:inline-flex!important;margin-left:10px!important;padding:4px 10px!important;border-radius:8px!important;background:#eef6ff!important;color:#0062e3!important;font-size:14px!important;font-weight:900!important;}
      .ty-itin-segments{display:grid!important;gap:0!important;padding:0 16px 14px!important;}
      .ty-itin-segment{padding:18px 0!important;border-bottom:1px solid #eef2f7!important;background:#fff!important;}
      .ty-itin-segment:last-child{border-bottom:0!important;}
      .ty-itin-airrow{display:grid!important;grid-template-columns:52px minmax(0,1fr) auto!important;gap:12px!important;align-items:start!important;margin-bottom:12px!important;}
      .ty-itin-logo{width:52px!important;height:52px!important;border-radius:14px!important;background:#f6f8fb!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;}
      .ty-itin-logo-img{width:46px!important;height:46px!important;object-fit:contain!important;display:block!important;}
      .ty-itin-airtext{min-width:0!important;}
      .ty-itin-airtext b{display:block!important;color:#111!important;font-size:20px!important;line-height:1.18!important;font-weight:950!important;white-space:normal!important;overflow-wrap:anywhere!important;}
      .ty-itin-airtext span{display:block!important;margin-top:4px!important;color:#111!important;font-size:18px!important;line-height:1.15!important;font-weight:900!important;}
      .ty-itin-refund{justify-self:end!important;margin-top:4px!important;background:#e8fff3!important;color:#25996b!important;border-radius:999px!important;padding:5px 12px!important;font-size:14px!important;line-height:1!important;font-style:normal!important;font-weight:900!important;white-space:nowrap!important;}
      .ty-itin-pills{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:0 0 12px 64px!important;}
      .ty-itin-pills span{display:inline-flex!important;align-items:center!important;min-height:24px!important;border-radius:999px!important;background:#f1f2f4!important;color:#2b2f38!important;padding:4px 12px!important;font-size:12px!important;font-weight:900!important;white-space:nowrap!important;}
      .ty-itin-routebox{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(122px,.55fr) minmax(0,1fr)!important;gap:14px!important;align-items:center!important;border:1px solid #d8dee8!important;background:#fafbfc!important;border-radius:18px!important;padding:16px!important;min-width:0!important;min-height:132px!important;}
      .ty-itin-point{min-width:0!important;display:flex!important;flex-direction:column!important;gap:5px!important;align-self:stretch!important;justify-content:center!important;}
      .ty-itin-point.right{text-align:right!important;align-items:flex-end!important;}
      .ty-itin-point small{display:block!important;color:#1f2937!important;font-size:14px!important;line-height:1.1!important;font-weight:850!important;white-space:nowrap!important;}
      .ty-itin-point strong{display:flex!important;align-items:baseline!important;gap:7px!important;color:#000!important;font-size:0!important;line-height:1!important;font-weight:950!important;white-space:nowrap!important;}
      .ty-itin-point .ty-itin-code,.ty-itin-point .ty-itin-time{display:inline-block!important;color:#000!important;font-size:32px!important;line-height:1!important;font-weight:950!important;letter-spacing:-.03em!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;max-width:none!important;}
      .ty-itin-point .ty-itin-city{display:block!important;color:#111!important;font-size:15px!important;line-height:1.12!important;font-weight:850!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;}
      .ty-itin-point i{display:block!important;color:#111!important;font-size:14px!important;line-height:1.1!important;font-style:normal!important;font-weight:750!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;}
      .ty-itin-mid{min-width:0!important;text-align:center!important;color:#111!important;align-self:center!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;overflow:visible!important;}
      .ty-itin-mid b{display:block!important;color:#111!important;font-size:14px!important;line-height:1!important;font-weight:900!important;white-space:nowrap!important;margin:0 0 8px!important;text-align:center!important;}
      .ty-itin-mid span{display:block!important;position:relative!important;width:100%!important;max-width:150px!important;height:12px!important;border:0!important;background:linear-gradient(#b8c7da,#b8c7da) center/100% 2px no-repeat!important;margin:0 auto!important;}
      .ty-itin-mid span:after{content:''!important;position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:10px!important;height:10px!important;border-radius:999px!important;background:#1394ff!important;box-shadow:0 0 0 2px #d7ecff!important;}
      .ty-itin-layover{justify-self:center!important;margin:10px auto!important;max-width:88%!important;border:1px dashed #e6b325!important;border-radius:999px!important;background:#fff!important;color:#111!important;padding:7px 16px!important;text-align:center!important;font-size:13px!important;line-height:1.1!important;font-weight:800!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.ty-itin-footer{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:18px!important;border-top:1px solid #eef2f7!important;padding:12px 18px 14px!important;min-width:0!important;}
      .ty-itin-footer b{display:none!important;}
      .ty-itin-footer button{border:0!important;background:transparent!important;color:#1e8cdc!important;font-size:14px!important;font-weight:850!important;padding:4px 0!important;white-space:nowrap!important;}
      .ty-policy-open{min-height:52px!important;padding:0 16px!important;background:#fff!important;border:0!important;border-radius:0!important;box-shadow:none!important;border-top:1px solid #eef2f7!important;font-size:16px!important;font-weight:900!important;}
      .ty-policy-page header h2{font-size:22px!important}.ty-policy-page nav button{font-size:13px!important;font-weight:850!important}.ty-policy-pane{font-size:14px!important;line-height:1.45!important;}
      .ty-secure-payment-screen{position:fixed!important;inset:0!important;z-index:999999!important;display:none;align-items:center!important;justify-content:center!important;background:#f4f7fb!important;color:#071d49!important;padding:24px!important;}
      .ty-secure-payment-box{text-align:center!important;width:min(520px,100%)!important;background:#fff!important;border:1px solid #e5edf7!important;border-radius:24px!important;box-shadow:0 20px 60px rgba(7,29,73,.18)!important;padding:32px 20px!important;}
      .ty-secure-spinner{width:54px!important;height:54px!important;border-radius:50%!important;border:6px solid #e9eef6!important;border-top-color:#ef6614!important;margin:0 auto 18px!important;animation:tySpin .8s linear infinite!important;}
      .ty-secure-payment-box h2{margin:0!important;font-size:20px!important;line-height:1.35!important;font-weight:950!important;color:#071d49!important;}.ty-secure-payment-box p{margin:12px 0 0!important;font-size:13px!important;line-height:1.35!important;color:#667085!important;font-weight:850!important;}@keyframes tySpin{to{transform:rotate(360deg)}}
      
      

      .ty-status-page{min-height:100vh!important;background:#f4f7fb!important;color:#071d49!important;font-family:Inter,Roboto,Arial,sans-serif!important;}

      






    
      /* ty-itin-balanced-final-overlap-fix-v2 single active sizing
         Placed LAST inside ty-itinerary-card-css so it wins over the large base itinerary CSS. */
      @media(max-width:767px){
        html body .ty-review-page .ty-review-card.ty-flight-review-card,
        html body .ty-booking-status-page .ty-review-card.ty-flight-review-card{
          width:calc(100vw - 10px)!important;
          max-width:calc(100vw - 10px)!important;
          margin-left:auto!important;
          margin-right:auto!important;
          left:auto!important;
          right:auto!important;
          transform:none!important;
          box-sizing:border-box!important;
        }
        html body .ty-review-page.ty-addon-page .ty-review-shell,
        html body .ty-review-page.ty-addon-page .ty-review-left,
        html body .ty-review-page.ty-addon-page .ty-booking-left,
        html body .ty-review-page.ty-addon-page .ty-addon-main,
        html body .ty-review-page.ty-addon-page .ty-booking-shell,
        html body .ty-review-page.ty-booking-page .ty-review-shell,
        html body .ty-review-page.ty-booking-page .ty-review-left,
        html body .ty-review-page.ty-booking-page .ty-booking-left,
        html body .ty-review-page.ty-booking-page .ty-booking-shell{
          width:100%!important;
          max-width:100%!important;
          margin-left:auto!important;
          margin-right:auto!important;
          padding-left:0!important;
          padding-right:0!important;
          box-sizing:border-box!important;
        }
        html body .ty-review-page.ty-addon-page .ty-flight-review-card .ty-section-body{
          padding-left:0!important;
          padding-right:0!important;
        }
        html body .ty-review-page.ty-addon-page .ty-itin-card{
          width:calc(100% + 24px)!important;
          max-width:calc(100% + 24px)!important;
          margin-left:-12px!important;
          margin-right:-12px!important;
        }
        html body .ty-itin-card{
          width:100%!important;
          max-width:100%!important;
          margin-left:0!important;
          margin-right:0!important;
          overflow:hidden!important;
          box-sizing:border-box!important;
        }
        html body .ty-itin-title{
          padding:12px 12px 10px!important;
          box-sizing:border-box!important;
        }
        html body .ty-itin-title h2{
          font-size:16px!important;
          line-height:1.15!important;
          font-weight:900!important;
          margin:0 0 6px!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        html body .ty-itin-title p{
          font-size:11px!important;
          line-height:1.2!important;
          margin:0!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        html body .ty-itin-title p span{
          font-size:11px!important;
          padding:4px 9px!important;
          margin-left:8px!important;
          border-radius:8px!important;
        }
        html body .ty-itin-segments{
          padding-left:4px!important;
          padding-right:4px!important;
          box-sizing:border-box!important;
        }
        html body .ty-itin-segment{
          padding:13px 0!important;
        }
        html body .ty-itin-airrow{
          display:grid!important;
          grid-template-columns:32px minmax(0,1fr) auto!important;
          gap:7px!important;
          margin:0 0 8px!important;
          align-items:center!important;
          box-sizing:border-box!important;
        }
        html body .ty-itin-logo{
          width:38px!important;
          height:32px!important;
          min-width:38px!important;
          max-width:38px!important;
          border-radius:9px!important;
          flex:0 0 32px!important;
        }
        html body .ty-itin-logo-img{
          width:27px!important;
          height:27px!important;
        }
        html body .ty-itin-airtext{
          min-width:0!important;
          max-width:100%!important;
          overflow:hidden!important;
        }
        html body .ty-itin-airtext b{
          display:block!important;
          font-size:12px!important;
          line-height:1.12!important;
          font-weight:900!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          max-width:100%!important;
        }
        html body .ty-itin-airtext span{
          display:block!important;
          font-size:10.7px!important;
          line-height:1.12!important;
          font-weight:800!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
          max-width:100%!important;
        }
        html body .ty-itin-refund{
          font-size:10.3px!important;
          line-height:1!important;
          padding:5px 7px!important;
          border-radius:999px!important;
          white-space:nowrap!important;
        }
        html body .ty-itin-pills{
          margin-left:39px!important;
          gap:6px!important;
          margin-bottom:8px!important;
        }
        html body .ty-itin-pills span{
          font-size:9.7px!important;
          min-height:18px!important;
          padding:3px 8px!important;
          white-space:nowrap!important;
        }
        html body .ty-itin-routebox{
          width:100%!important;
          max-width:100%!important;
          margin-left:0!important;
          margin-right:0!important;
          display:grid!important;
          grid-template-columns:minmax(0,1fr) 88px minmax(0,1fr)!important;
          gap:6px!important;
          padding:10px 8px!important;
          min-height:100px!important;
          align-items:center!important;
          overflow:hidden!important;
          border-radius:15px!important;
          box-sizing:border-box!important;
        }
        html body .ty-itin-point{
          min-width:0!important;
          max-width:100%!important;
          overflow:hidden!important;
          display:flex!important;
          flex-direction:column!important;
          justify-content:center!important;
          box-sizing:border-box!important;
        }
        html body .ty-itin-point.left{
          text-align:left!important;
          align-items:flex-start!important;
          padding-right:3px!important;
        }
        html body .ty-itin-point.right{
          text-align:right!important;
          align-items:flex-end!important;
          padding-left:3px!important;
        }
        html body .ty-itin-point small{
          display:block!important;
          width:100%!important;
          font-size:9.2px!important;
          line-height:1.15!important;
          font-weight:800!important;
          margin:0 0 3px 0!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        html body .ty-itin-point strong{
          display:block!important;
          width:100%!important;
          max-width:100%!important;
          white-space:nowrap!important;
          overflow:visible!important;
          text-overflow:clip!important;
          font-size:0!important;
          line-height:1.05!important;
          margin:0!important;
        }
        html body .ty-itin-point strong .ty-itin-code,
        html body .ty-itin-point strong .ty-itin-time{
          display:inline!important;
          font-size:14px!important;
          line-height:1.05!important;
          font-weight:900!important;
          letter-spacing:0!important;
          white-space:nowrap!important;
          max-width:none!important;
        }
        html body .ty-itin-point strong .ty-itin-time::before{content:' '!important}
        html body .ty-itin-point.right strong .ty-itin-code::before{content:' '!important}
        html body .ty-itin-point .ty-itin-city{
          display:block!important;
          width:100%!important;
          font-size:10.4px!important;
          line-height:1.15!important;
          font-weight:800!important;
          margin-top:3px!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        html body .ty-itin-point i{
          display:block!important;
          width:100%!important;
          font-size:9.8px!important;
          line-height:1.15!important;
          font-weight:750!important;
          margin-top:3px!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        html body .ty-itin-mid{
          width:88px!important;
          min-width:88px!important;
          max-width:88px!important;
          overflow:visible!important;
          text-align:center!important;
          position:relative!important;
          display:flex!important;
          flex-direction:column!important;
          align-items:center!important;
          justify-content:center!important;
        }
        html body .ty-itin-mid b{
          display:block!important;
          width:100%!important;
          text-align:center!important;
          font-size:10.6px!important;
          line-height:1!important;
          font-weight:900!important;
          white-space:nowrap!important;
          transform:none!important;
          transform-origin:center!important;
        }
        html body .ty-itin-mid span{
          display:block!important;
          width:100%!important;
          height:12px!important;
          border:0!important;
          background:linear-gradient(#b8c7da,#b8c7da) center/100% 2px no-repeat!important;
          margin:6px auto 0!important;
          position:relative!important;
          transform:none!important;
          transform-origin:center!important;
        }
        html body .ty-itin-mid span:after{
          content:''!important;
          position:absolute!important;
          left:50%!important;
          top:50%!important;
          width:6px!important;
          height:6px!important;
          border-radius:50%!important;
          background:#1da4ff!important;
          transform:translate(-50%,-50%)!important;
          box-shadow:0 0 0 2px rgba(29,164,255,.14)!important;
        }
        html body .ty-itin-mid i{display:none!important;}
        html body .ty-itin-mid:before{display:none!important;content:none!important;}
        html body .ty-itin-layover{
          font-size:10.4px!important;
          line-height:1.1!important;
          font-weight:850!important;
          padding:6px 10px!important;
          max-width:90%!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
      }
      /* END ty-itin-balanced-final-overlap-fix-v2 */
`;

    document.head.appendChild(style);
  }

  function tyInjectForceUiPatchCss(){
    let style = document.getElementById('ty-force-ui-saved-addon-v921');
    if(style) return;
    style = document.createElement('style');
    style.id = 'ty-force-ui-saved-addon-v921';
    style.textContent = `
      .ty-saved-traveller-tools{display:grid!important;gap:8px!important;margin:0 0 16px!important;width:100%!important;max-width:100%!important;}
      .ty-saved-search-box{display:grid!important;grid-template-columns:40px minmax(0,1fr)!important;align-items:center!important;border:1px solid #e2eaf4!important;border-radius:12px!important;background:#fff!important;min-height:48px!important;padding:0 12px!important;box-shadow:0 2px 8px rgba(7,29,73,.03)!important;}
      .ty-saved-search-icon{font-size:25px!important;line-height:1!important;color:#334155!important;font-weight:900!important;}
      .ty-saved-search-box input{border:0!important;background:transparent!important;outline:0!important;min-height:46px!important;font-size:16px!important;color:#071d49!important;font-weight:850!important;padding:0!important;width:100%!important;}
      .ty-saved-search-box input::placeholder{color:#9aa3ad!important;font-weight:850!important;}
      .ty-saved-traveller-row{width:100%!important;text-align:left!important;border:1px solid #dce8f7!important;border-radius:13px!important;background:#fff!important;padding:9px 11px!important;color:#071d49!important;font-family:inherit!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:4px 8px!important;align-items:start!important;}
      .ty-saved-traveller-row b{font-size:13px!important;font-weight:950!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
      .ty-saved-traveller-row>span{font-size:11px!important;color:#64748b!important;font-weight:850!important;text-align:right!important;white-space:nowrap!important;}
      .ty-saved-traveller-row div{grid-column:1/-1!important;display:flex!important;gap:6px!important;flex-wrap:wrap!important;}
      .ty-saved-traveller-row em{font-style:normal!important;font-size:10.5px!important;color:#475569!important;background:#f1f5f9!important;border-radius:999px!important;padding:4px 7px!important;font-weight:850!important;}
      .ty-save-traveller-line{display:flex!important;gap:7px!important;align-items:flex-start!important;font-size:11px!important;color:#334155!important;font-weight:850!important;}
      .ty-save-traveller-line input{accent-color:#0062e3!important;margin-top:2px!important;}
      .ty-passport-upload-mini{display:grid!important;gap:5px!important;margin:6px 0 10px!important;}
      .ty-upload-main{position:relative!important;border:1px solid #edf1f7!important;border-radius:13px!important;background:#fff!important;padding:8px 106px 8px 9px!important;display:grid!important;grid-template-columns:30px minmax(0,1fr)!important;gap:8px!important;align-items:center!important;min-height:54px!important;max-width:100%!important;overflow:hidden!important;}
      .ty-upload-icon{width:30px!important;height:30px!important;border-radius:8px!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#071d49!important;background:#f1f5f9!important;font-size:18px!important;font-weight:950!important;}
      .ty-upload-main b{display:block!important;color:#071d49!important;font-size:14px!important;line-height:1.15!important;font-weight:950!important;}
      .ty-upload-main small{display:block!important;margin-top:2px!important;color:#8b95a1!important;font-size:10.5px!important;line-height:1.22!important;font-weight:850!important;}
      .ty-upload-main [data-passport-upload]{position:absolute!important;right:8px!important;top:50%!important;transform:translateY(-50%)!important;border:1px solid rgba(235,129,75,.24)!important;background:#fff6ef!important;color:#eb814b!important;border-radius:12px!important;min-height:36px!important;min-width:82px!important;padding:0 12px!important;font-size:13px!important;font-weight:950!important;font-family:inherit!important;z-index:3!important;pointer-events:none!important;}
      .ty-upload-main .ty-passport-file-input{position:absolute!important;right:8px!important;top:50%!important;transform:translateY(-50%)!important;width:96px!important;height:42px!important;opacity:0!important;z-index:4!important;cursor:pointer!important;}
      .ty-passport-inline-scan{position:absolute!important;right:102px!important;top:50%!important;transform:translateY(-50%)!important;display:none!important;align-items:center!important;justify-content:center!important;gap:4px!important;height:20px!important;z-index:2!important;}
      .ty-passport-inline-scan i{width:6px!important;height:6px!important;border-radius:999px!important;background:#0062e3!important;display:block!important;opacity:.35!important;animation:tyPassportInlineDot .9s ease-in-out infinite!important;}
      .ty-passport-inline-scan i:nth-child(2){animation-delay:.1s!important}.ty-passport-inline-scan i:nth-child(3){animation-delay:.2s!important}.ty-passport-inline-scan i:nth-child(4){animation-delay:.3s!important}.ty-passport-inline-scan i:nth-child(5){animation-delay:.4s!important}
      .ty-passport-upload-mini.is-scanning .ty-passport-inline-scan{display:flex!important;}
      @keyframes tyPassportInlineDot{0%,100%{opacity:.28;transform:translateY(0) scale(.82)}50%{opacity:1;transform:translateY(-5px) scale(1.08)}}
      .ty-scan-review{margin:2px 2px 0!important;color:#64748b!important;font-size:10.5px!important;line-height:1.25!important;font-weight:750!important;}
      .ty-scan-status:empty{display:none!important;}.ty-scan-status{margin:2px 2px 0!important;color:#047857!important;font-size:11px!important;line-height:1.3!important;font-weight:850!important;}.ty-scan-status.bad{color:#d93025!important;}
      .ty-passport-upload-mini.is-scanning [data-passport-upload]{opacity:.62!important;cursor:wait!important;}
    `;
    document.head.appendChild(style);
  }


  function tyInjectDobCleanCss(){
    let style = document.getElementById('ty-dob-clean-css-v922');
    if(style) return;
    style = document.createElement('style');
    style.id = 'ty-dob-clean-css-v922';
    style.textContent = `
      .ty-dob-field .ty-age-note,
      .ty-passport-dob-field .ty-age-note{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }
  function tyInjectSaveTravellerBottomCss(){
    let style = document.getElementById('ty-save-traveller-bottom-v923');
    if(style) return;
    style = document.createElement('style');
    style.id = 'ty-save-traveller-bottom-v923';
    style.textContent = `
      .ty-save-traveller-after-details{
        margin:10px 0 0!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
        border-radius:0!important;
      }
      .ty-save-traveller-after-details[hidden]{
        display:none!important;
      }
      .ty-save-traveller-line{
        display:flex!important;
        gap:8px!important;
        align-items:center!important;
        color:#334155!important;
        font-size:12px!important;
        line-height:1.25!important;
        font-weight:850!important;
      }
      .ty-save-traveller-line input{
        width:16px!important;
        height:16px!important;
        margin:0!important;
        flex:0 0 auto!important;
        accent-color:#0062e3!important;
      }
      .ty-save-traveller-status{
        margin:4px 0 0 24px!important;
        min-height:14px;
        color:#0062e3!important;
        font-size:10.8px!important;
        line-height:1.2!important;
        font-weight:850!important;
      }
      .ty-save-traveller-status.already{color:#0f766e!important;}
      .ty-save-traveller-status.saved{color:#0f9f6e!important;}
      .ty-save-traveller-status.off{color:#dc2626!important;}
      @media(max-width:767px){
        .ty-save-traveller-after-details{
          margin-top:9px!important;
          padding:0!important;
          border:0!important;
          background:transparent!important;
        }
        .ty-save-traveller-line{
          font-size:11px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function renderFlightReviewStep(flights){
    hideBookingLoader();
    flights = Array.isArray(flights) ? flights.filter(Boolean) : [flights].filter(Boolean);
    if(!flights.length){ renderShell(renderNoFlightsFound()); return; }
  
  injectStyles();
    injectCss();
    injectReviewTimerUpdateCss();
    injectDesktopReviewRedesignCss();
    injectItineraryCardCss();
    tyInjectDobCleanCss();
    tyInjectSaveTravellerBottomCss();
    tyInjectForceUiPatchCss();
    tyInjectCheckoutFinalPatchCss();
    await loadFlightOffers();
    const fare = computeFare(flights);
    const passReq = requiredPassport(flights);
    const dobReq = requiredDob(flights);
    const panReq = panRequiredForFlights(flights);
    const payload = {service:"flight",selectedFlight:flights[0],selectedFlights:flights,item:flights[0],search:state.search,offer:fare.selectedOffer||null,amount:fare.total,selectedAt:new Date().toISOString()};
    sessionStorage.setItem("ty_selected_flight", JSON.stringify(payload));
    sessionStorage.setItem("ty_selected_booking_item", JSON.stringify(payload));
    localStorage.setItem("ty_selected_flight", JSON.stringify(payload));
    try{ history.pushState({step:"flight-review"},"","/pages/results/flights.html?service=flight&step=review"); }catch(e){}
    const summary = `${esc(state.search.origin)} → ${esc(state.search.destination)} • ${esc(dateText(firstSegment(flights[0]).depDate || state.search.departureDate))} • ${esc(normalizeCabin(state.search.cabinClass).replace(/_/g," "))}`;
    const mobileReview = isMobileView();
    const desktopLeftContinueHtml = mobileReview ? '' : '<button type="button" class="ty-payment-btn ty-left-continue ty-desktop-continue" data-desktop-continue="true" id="tyProceedPaymentLeft">Continue Booking</button>';
    const desktopSideContinueHtml = mobileReview ? '' : '<button type="button" class="ty-payment-btn ty-desktop-continue" data-desktop-continue="true" id="tyProceedPayment">Continue Booking</button>';
    const contactOptional = false;
    /* Contact Details always follow the complete traveller list on both
       viewports; they must never sit inside passenger 1's panel. */
    const contactCardHtml = `<article class="ty-contact-card"><div class="ty-section-head"><h2>Contact Details</h2><p>Your ticket & flight details will be shared here</p></div><div class="ty-section-body"><div class="ty-form-grid contact"><label class="ty-form-field"><span>${requiredLabel('Email Address')}</span><input name="email" type="email" required autocomplete="email" placeholder="Enter Email Address"></label><label class="ty-form-field"><span>${requiredLabel('Phone Number')}</span><div class="ty-phone-row"><select name="mobileCountryCode" required aria-label="Country code">${countryCodeOptions()}</select><input name="mobile" type="tel" required inputmode="numeric" autocomplete="tel-national" placeholder="Enter Mobile no."></div><small class="ty-field-note">Use the mobile number linked with this booking.</small></label></div></div></article>`;
    const reviewTopHtml = mobileReview
      ? `<button type="button" class="ty-review-back ty-mobile-review-back" data-review-back aria-label="Back">‹</button>`
      : `<header class="ty-review-top ty-booking-top"><button type="button" class="ty-review-back" data-review-back>‹</button>${travelYaraaLogo()}<div><h1>Flight Review</h1><p>${summary}</p></div></header>`;
    ROOT.innerHTML = `<div class="ty-review-page ty-booking-page">
      ${reviewTopHtml}
      <div class="ty-expire-timer" id="tyBookingTimer">Expires in 10:00</div>
      <main class="ty-review-shell ty-booking-shell">
        <section class="ty-review-left ty-booking-left">
          <div class="ty-alert" id="tyTopAlert" hidden></div>
          ${renderBookingHero(flights)}
          ${renderPolicyButton()}
          ${renderPromoCard(fare)}
          <form id="tyPassengerForm" novalidate data-contact-optional="${contactOptional?'true':'false'}">
            ${renderPassengerDetails(flights, passReq, dobReq, panReq)}
            ${contactCardHtml}
            ${renderTravelInsuranceCard()}
            ${renderFrequentTravellerCard()}
            <article class="ty-gst-card"><div class="ty-section-body"><label class="ty-gst-toggle"><input id="tyGstUse" type="checkbox" name="gstUse" value="yes"><span>Use GST for this booking (Optional)</span></label><div class="ty-gst-fields-holder" id="tyGstFieldsHolder" hidden aria-hidden="true"></div></div></article>
            <article class="ty-contact-card"><div class="ty-section-body"><label class="ty-agree"><input type="checkbox" name="agreement" value="accepted" checked required><span>I understand and agree to the rules, <a href="/legal/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>, <a href="/legal/user-agreement.html" target="_blank" rel="noopener">User Agreement</a> and <a href="/legal/terms-and-conditions.html" target="_blank" rel="noopener">Terms & Conditions</a> of TravelYaraa.</span></label><p class="ty-form-error" id="tyFormError"></p>${desktopLeftContinueHtml}</div></article>
          </form>
        </section>
        <aside class="ty-side">${renderPriceSummaryBox(fare)}${renderOfferBox(fare)}${desktopSideContinueHtml}<p class="ty-pay-msg" id="tyPaymentMsg"></p></aside>
      </main>${mobileFareSheets(flights, fare)}</div>`;
    tyEnsureSavedTravellerToolsMounted(passReq);
    tyBindSaveTravellerConsent(ROOT.querySelector('#tyPassengerForm'));
    installMobileDesktopBookingGuard();
    bindReviewEvents(flights);
    startBookingHoldTimer();
    restoreReviewFormSnapshot(ROOT.querySelector("#tyPassengerForm"));
    const restoredForm = ROOT.querySelector("#tyPassengerForm");
    if(restoredForm){ try{ restoredForm.dispatchEvent(new Event("change", {bubbles:true})); }catch(e){} }
    tyBindPhoneCountryCodeSelects(ROOT);
    window.scrollTo({top:0,behavior:"smooth"});
  }



  function tyInjectCheckoutFinalPatchCss(){
    if(document.getElementById('ty-checkout-final-patch-css')) return;
    const css = document.createElement('style');
    css.id = 'ty-checkout-final-patch-css';
    css.textContent = `
      .ty-phone-row select[name="mobileCountryCode"]{min-width:88px!important;white-space:nowrap!important;}
      .ty-upload-main [data-passport-upload], .ty-passport-upload-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;text-decoration:none!important;}
      .ty-offer-card{cursor:default!important;}
      .ty-offer-apply-btn{margin-top:10px!important;min-height:36px!important;border:0!important;border-radius:999px!important;background:#0062e3!important;color:#fff!important;padding:0 18px!important;font-size:13px!important;font-weight:950!important;box-shadow:0 8px 18px rgba(0,98,227,.18)!important;}
      .ty-offer-apply-btn:disabled{opacity:.65!important;cursor:wait!important;}
      .ty-offer-card.active .ty-offer-apply-btn{background:#10b981!important;box-shadow:none!important;}
      .ty-travel-insurance-card{margin:14px 0!important;border:1px solid #dbe6f3!important;border-radius:16px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 8px 24px rgba(7,29,73,.06)!important;}
      .ty-travel-insurance-card .ty-section-body{padding:0!important;}
      .ty-travel-insurance-toggle{width:100%!important;min-height:74px!important;border:0!important;background:#fff!important;display:grid!important;grid-template-columns:42px minmax(0,1fr) auto 24px!important;align-items:center!important;gap:10px!important;padding:14px 16px!important;text-align:left!important;cursor:pointer!important;color:#071d49!important;}
      .ty-travel-insurance-toggle.active{background:#f7fbff!important;border-bottom:1px solid #e2eaf4!important;}
      .ty-travel-insurance-icon{width:40px!important;height:40px!important;border-radius:12px!important;background:#eaf3ff!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:21px!important;}
      .ty-travel-insurance-title{display:flex!important;flex-direction:column!important;gap:3px!important;min-width:0!important;}
      .ty-travel-insurance-title b{font-size:15px!important;font-weight:950!important;color:#071d49!important;}
      .ty-travel-insurance-title small{font-size:11px!important;font-weight:750!important;color:#65758b!important;white-space:normal!important;}
      .ty-travel-insurance-action{font-size:12px!important;font-weight:900!important;color:#0062e3!important;white-space:nowrap!important;}
      .ty-travel-insurance-arrow{font-size:18px!important;font-weight:900!important;color:#071d49!important;text-align:center!important;}
      .ty-travel-insurance-options{padding:15px 16px 16px!important;background:#fff!important;}
      .ty-travel-insurance-options[hidden]{display:none!important;}
      .ty-travel-insurance-intro{margin:0 0 11px!important;font-size:12px!important;line-height:1.5!important;color:#485a70!important;font-weight:700!important;}
      .ty-travel-insurance-choice{display:flex!important;align-items:flex-start!important;gap:10px!important;border:1px solid #dce5f0!important;border-radius:13px!important;padding:12px!important;margin:9px 0!important;cursor:pointer!important;background:#fff!important;}
      .ty-travel-insurance-choice.active{border-color:#0062e3!important;background:#f2f8ff!important;box-shadow:0 0 0 2px rgba(0,98,227,.08)!important;}
      .ty-travel-insurance-choice input{margin-top:3px!important;accent-color:#0062e3!important;flex:0 0 auto!important;}
      .ty-travel-insurance-choice span{display:flex!important;flex-direction:column!important;gap:3px!important;}
      .ty-travel-insurance-choice b{font-size:13px!important;color:#071d49!important;font-weight:950!important;}
      .ty-travel-insurance-choice small{font-size:11px!important;color:#5d6c80!important;line-height:1.45!important;font-weight:650!important;}
      .ty-travel-insurance-note{margin:10px 1px 0!important;padding:10px 11px!important;border-radius:10px!important;background:#fff8e8!important;color:#7a5311!important;font-size:10.8px!important;font-weight:750!important;line-height:1.45!important;}
      @media(max-width:767px){.ty-travel-insurance-toggle{grid-template-columns:38px minmax(0,1fr) 21px!important;min-height:68px!important;padding:12px!important}.ty-travel-insurance-action{display:none!important}.ty-travel-insurance-icon{width:36px!important;height:36px!important}.ty-travel-insurance-options{padding:13px!important}.ty-dob-field,.ty-passport-dob-field{grid-column:1/-1!important;max-width:none!important}.ty-date3{grid-template-columns:minmax(72px,.9fr) minmax(94px,1.1fr) minmax(82px,1fr)!important;gap:7px!important}.ty-date3 select{height:42px!important;font-size:12px!important}.ty-saved-traveller-update{align-items:flex-start!important;flex-direction:column!important}.ty-saved-traveller-update button{width:100%!important}}
    `;
    document.head.appendChild(css);
  }

  function renderReviewFlight(flight){
    const logo = airlineLogoHTML(flight, "ty-review-logo-img");
    const first = firstSegment(flight);
    const last = lastSegment(flight);
    const aircraft = deepFirstValue(flight, ['aircraftType','aircraft','equipment','equipType']) || '';
    const refundable = flight.refundable ? 'Refundable' : 'Non Refundable';
    const routeTitle = `${compactAirportLabel(flight.departureCity)} to ${compactAirportLabel(flight.arrivalCity)}`;
    return `<div class="ty-summary-item ty-review-flight">
      <div class="ty-review-flight-head"><div class="ty-review-logo">${logo}</div><div><p class="ty-review-air">${esc(flight.airlineName||'Airline')} ${flight.flightCode?('| '+esc(flight.flightCode)):''}</p><div class="ty-review-sub">${aircraft?`<span>${esc(aircraft)}</span>`:''}${flight.fareType?`<span>${esc(flight.fareType)}</span>`:''}</div></div></div>
      <h3>${esc(routeTitle)}</h3>
      <div class="ty-review-route-line"><div><b>${esc(first.depTime || flight.departureTime)}</b><span>${esc(compactAirportLabel(flight.departureCity))}</span><small>${esc(dateText(first.depDate || state.search.departureDate))}</small></div><div><em>${esc(flight.duration)}</em><i></i><strong>${esc(refundable)}</strong></div><div><b>${esc(last.arrTime || flight.arrivalTime)}</b><span>${esc(compactAirportLabel(flight.arrivalCity))}</span><small>${esc(dateText(last.arrDate || state.search.departureDate))}</small></div></div>
    </div>`;
  }

  async function loadFlightOffers(){
    if(state.offersLoaded || state.offersLoading) return state.availableOffers;
    state.offersLoading = true;
    try{
      const res = await fetch(API_BASE + '/api/offers?service=flight', {cache:'no-store'});
      const data = await res.json().catch(()=>({}));
      if(!res.ok || data.success === false) throw new Error(data.message || data.error || 'Offers are not available.');
      state.availableOffers = Array.isArray(data.offers) ? data.offers.filter(o=>String(o.status||'active').toLowerCase()==='active') : [];
    }catch(e){
      state.availableOffers = [];
    }finally{
      state.offersLoaded = true;
      state.offersLoading = false;
    }
    return state.availableOffers;
  }

  function renderOfferBox(fare){
    const selected = selectedOfferObject(fare);
    const hasSelected = Boolean(selected && selected.code);
    const cards = state.availableOffers.length
      ? state.availableOffers.map(function(o){ return renderOfferCard(o, fare); }).join('')
      : '<p class="ty-offer-empty">No active flight offer is available right now.</p>';
    return `<section class="ty-offer-box ty-offer-box-v2"><div class="ty-section-head"><h2>Offers & Promo Code</h2></div><div class="ty-section-body"><div class="ty-code-input ty-code-input-v2"><input id="tyCouponInput" type="text" placeholder="ENTER COUPON CODE" value="${hasSelected?esc(selected.code||selected.offerCode):''}"><button type="button" ${hasSelected?'data-remove-coupon':'data-apply-coupon'}>${hasSelected?'Remove':'Apply'}</button></div>${hasSelected?`<p class="ty-offer-success">${esc(selected.message || selected.success || 'Offer applied successfully.')}</p>`:''}<div class="ty-offer-list">${cards}</div></div></section>`;
  }

  function tyOfferCardSaving(offer, fare){
    const code = String(offer && (offer.code || offer.offerCode) || '').toUpperCase();
    const type = String(offer && (offer.discountType || offer.type) || '').toLowerCase();
    if(code === 'TY0FEES' || type.includes('convenience_fee') || type.includes('fee_waiver')){
      const fee = Math.max(0, Math.round(Number(fare && (fare.bookingFee || fare.convenienceFee || fare.openBookingCharge) || 0)));
      if(fee > 0) return '₹' + fee.toLocaleString('en-IN') + ' OFF';
      return 'Zero Convenience Fee';
    }
    const flat = Math.max(0, Number(offer && (offer.discountValue != null ? offer.discountValue : offer.maxDiscount) || 0));
    if(flat > 0) return '₹' + flat.toLocaleString('en-IN') + ' OFF';
    return '';
  }

  function renderOfferCard(offer, fare){
    const code = String(offer.code || offer.offerCode || '').toUpperCase();
    const activeCode = String((state.selectedOffer && (state.selectedOffer.code || state.selectedOffer.offerCode)) || '').toUpperCase();
    const active = activeCode === code;
    const saving = tyOfferCardSaving(offer, fare);
    const blurb = offer.customer_text || offer.terms || '';
    return `<div class="ty-offer-card ${active?'active':''}" data-offer-code="${esc(code)}"><span class="ty-offer-radio">${active?'✓':''}</span><div><b>${esc(code)} - ${esc(offer.title||'Offer')}</b>${saving?`<strong class="ty-offer-saving">${esc(saving)}</strong>`:''}<p>${esc(blurb)}</p><button type="button" class="ty-offer-apply-btn" data-offer-apply="${esc(code)}">${active?'Applied':'Apply'}</button></div></div>`;
  }

  function tyOfferForCode(code){
    const key = String(code || '').trim().toUpperCase();
    return state.availableOffers.find(o=>String(o.code||o.offerCode||'').toUpperCase()===key) || null;
  }

  function tyNormalizeAppliedOffer(code, data, fare){
    if(!data || data.success === false) return null;
    const normalizedCode = String(data.offerCode || data.code || code || '').trim().toUpperCase();
    const discount = Math.max(0, Number(data.discountAmount || 0));
    if(!normalizedCode || discount <= 0) return null;
    return Object.assign({}, tyOfferForCode(normalizedCode) || {}, data, {
      code: normalizedCode,
      offerCode: normalizedCode,
      type: 'backend',
      discountAmount: discount,
      discount: discount,
      value: discount,
      convenienceFeeWaived: Boolean(data.convenienceFeeWaived),
      backendVerified: true,
      success: data.message || 'Offer applied successfully.',
      message: data.message || 'Offer applied successfully.'
    });
  }

  function tyOfferApplyPayload(code, fare){
    const bookingAmount = Math.max(0, Math.round(Number(fare && (fare.subtotalBeforeDiscount || fare.customerPayable || fare.total || fare.ticketAmount) || 0)));
    const bookingFee = Math.max(0, Math.round(Number(fare && (fare.bookingFee || fare.convenienceFee || fare.openBookingCharge) || 0)));
    return {
      service: 'flight',
      offerCode: String(code || '').trim().toUpperCase(),
      bookingAmount,
      convenienceFee: bookingFee
    };
  }

  async function applyCoupon(code, fare){
    code = String(code||'').trim().toUpperCase();
    if(!code) return null;
    const payload = tyOfferApplyPayload(code, fare);
    const headers = Object.assign({'Content-Type':'application/json'}, tyGuestAuthHeaders());
    try{
      const res = await fetch(API_BASE + '/api/offers/apply', {
        method:'POST',
        headers,
        body:JSON.stringify(payload),
        cache:'no-store'
      });
      const data = await res.json().catch(()=>({}));
      if(res.ok && data && data.success !== false){
        const normalized = tyNormalizeAppliedOffer(code, data, fare);
        if(normalized) return normalized;
      }
      alert((data && (data.message || data.error)) || 'Offer is not available.');
    }catch(_e){
      alert('Offer could not be validated. Please check your connection and try again.');
    }
    return null;
  }

  function bindReviewEvents(flights){
    tyBindPhoneCountryCodeSelects(ROOT);
    const back = ROOT.querySelector("[data-review-back]");
    if(back){ back.onclick = () => { try{history.replaceState({},"","/pages/results/flights.html?service=flight")}catch(e){} applyFilters(); }; }
    ROOT.querySelectorAll('[data-open-policy]').forEach(btn => { btn.onclick = () => openPolicyModal(flights, btn.getAttribute('data-policy-target') || 'cancel'); });
    if(!ROOT.dataset.tyPolicyDelegateFixV306){
      ROOT.dataset.tyPolicyDelegateFixV306 = "1";
      ROOT.addEventListener('click', function(ev){
        const btn = ev.target && ev.target.closest ? ev.target.closest('[data-open-policy]') : null;
        if(!btn || !ROOT.contains(btn)) return;
        ev.preventDefault();
        ev.stopPropagation();
        const activeFlights = state.reviewFlights && state.reviewFlights.length ? state.reviewFlights : flights;
        openPolicyModal(activeFlights, btn.getAttribute('data-policy-target') || 'cancel');
      }, true);
    } /* ty-policy-delegate-fix-v306 */
    ROOT.querySelectorAll('[data-open-promo]').forEach(btn => { btn.onclick = () => openPromoModal(flights); });
    ROOT.querySelectorAll("[data-offer-apply]").forEach(btn => {
      btn.onclick = async (ev) => {
        if(ev){ ev.preventDefault(); ev.stopPropagation(); }
        const fare = computeFare(flights);
        const code = btn.getAttribute("data-offer-apply");
        btn.disabled = true;
        const oldText = btn.textContent;
        btn.textContent = 'Applying...';
        const data = await applyCoupon(code, fare);
        if(data){
          state.selectedOffer = Object.assign({}, data, {code:data.offerCode||data.code||code, type:'backend', value:Number(data.discountAmount||data.discount||0), discountAmount:Number(data.discountAmount||data.discount||0), success:data.message});
          renderFlightReviewStep(flights);
          return;
        }
        btn.disabled = false;
        btn.textContent = oldText || 'Apply';
      };
    });
    ROOT.querySelectorAll('[data-apply-coupon]').forEach(btn=>btn.onclick=async()=>{ const fare=computeFare(flights); const input=ROOT.querySelector('#tyCouponInput'); const data=await applyCoupon(input && input.value, fare); if(data){ state.selectedOffer = Object.assign({}, data, {code:data.offerCode||data.code, type:'backend', value:Number(data.discountAmount||data.discount||0), discountAmount:Number(data.discountAmount||data.discount||0), success:data.message}); renderFlightReviewStep(flights); } });
    ROOT.querySelectorAll('[data-remove-coupon]').forEach(btn=>btn.onclick=()=>{ state.selectedOffer = null; renderFlightReviewStep(flights); });
    ROOT.querySelectorAll('[data-review-flight-tab]').forEach(btn=>btn.onclick=()=>{ const box=btn.closest('.ty-review-flight'); if(!box) return; const key=btn.getAttribute('data-review-flight-tab'); const target=box.querySelector(`[data-review-flight-pane="${CSS.escape(key)}"]`); const willOpen = !target || target.hidden; box.querySelectorAll('[data-review-flight-pane]').forEach(p=>{p.hidden=true; p.classList.remove('active');}); if(target && willOpen){target.hidden=false; target.classList.add('active');} });
    ROOT.querySelectorAll('[data-review-addon-toggle]').forEach(btn => { btn.onclick = () => { const type=btn.getAttribute('data-review-addon-toggle'); const panel=ROOT.querySelector(`[data-review-addon-panel="${CSS.escape(type)}"]`); if(!panel) return; const open = panel.hidden; ROOT.querySelectorAll('[data-review-addon-panel]').forEach(p=>p.hidden=true); ROOT.querySelectorAll('[data-review-addon-toggle]').forEach(b=>b.classList.remove('active')); panel.hidden = !open; btn.classList.toggle('active', open); }; });
    const form = ROOT.querySelector("#tyPassengerForm");
    const error = ROOT.querySelector("#tyFormError");
    const alertBox = ROOT.querySelector("#tyTopAlert");
    const msg = ROOT.querySelector("#tyPaymentMsg");
    bindTravelInsuranceCard(form);
    function validate(show){ return validateReviewForm(flights, form, error, alertBox, show); }
    ROOT.querySelectorAll('[data-pax-tab]').forEach(btn => btn.onclick = () => {
      const id = btn.getAttribute('data-pax-tab');
      const blocked = firstIncompletePassengerBefore(form, Number(id), flights, true);
      const lockMsg = ROOT.querySelector('#tyPaxLockMsg');
      if(blocked){
        const label = passengerDisplayLabel(blocked.meta);
        if(lockMsg) lockMsg.textContent = `${label} details not complete.`;
        setPassengerPanelActive(form, blocked.meta.index);
        const first = blocked.errors.find(function(e){ return e && e.el; });
        if(first && first.el){ try{ first.el.focus({preventScroll:true}); }catch(e){} }
        refreshPassengerAddButtons(form, flights);
        return;
      }
      if(lockMsg) lockMsg.textContent = '';
      setPassengerPanelActive(form, id);
      refreshPassengerAddButtons(form, flights);
    });
    const ffToggle = ROOT.querySelector('#tyFrequentTravellerToggle');
    const ffFields = ROOT.querySelector('#tyFrequentTravellerFields');
    if(ffToggle && ffFields){
      const setFrequentOpen = function(open){
        ffFields.hidden = !open;
        ffFields.setAttribute('aria-hidden', open ? 'false' : 'true');
        ffToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        ffToggle.classList.toggle('active', open);
        const icon = ffToggle.querySelector('b');
        if(icon) icon.textContent = open ? '⌃' : '⌄';
      };
      setFrequentOpen(false);
      ffToggle.onclick = function(){ setFrequentOpen(ffFields.hidden); };
    }

    const gst = ROOT.querySelector('#tyGstUse');
    if(gst){
      const card = gst.closest('.ty-gst-card');
      const holder = ROOT.querySelector('#tyGstFieldsHolder');
      const gstFieldsHtml = '<div class="ty-form-grid two ty-gst-fields"><label class="ty-form-field"><span>GST Number<em class="ty-required-star" aria-label="required">*</em></span><input name="gstNumber" maxlength="15" autocomplete="off"></label><label class="ty-form-field"><span>Company Name<em class="ty-required-star" aria-label="required">*</em></span><input name="gstCompany" autocomplete="organization"></label><label class="ty-form-field" style="grid-column:1/-1"><span>Company Address<em class="ty-required-star" aria-label="required">*</em></span><input name="gstAddress" autocomplete="street-address"></label></div>';
      const setGstOpen = function(open){
        if(!holder) return;
        if(open){
          holder.innerHTML = gstFieldsHtml;
          holder.hidden = false;
          holder.setAttribute('aria-hidden','false');
          holder.style.setProperty('display','block','important');
          holder.style.setProperty('margin-top','12px','important');
          holder.style.setProperty('height','auto','important');
          holder.style.setProperty('overflow','visible','important');
          if(card) card.classList.add('gst-open');
        }else{
          holder.querySelectorAll('input').forEach(function(input){ input.value = ''; });
          holder.innerHTML = '';
          holder.hidden = true;
          holder.setAttribute('aria-hidden','true');
          holder.style.setProperty('display','none','important');
          holder.style.setProperty('margin-top','0','important');
          holder.style.setProperty('height','0','important');
          holder.style.setProperty('overflow','hidden','important');
          if(card) card.classList.remove('gst-open');
        }
      };
      gst.checked = false;
      setGstOpen(false);
      gst.onclick = function(){ setTimeout(function(){ setGstOpen(gst.checked); }, 0); };
      gst.onchange = function(){ setGstOpen(gst.checked); };
    }
    if(form){
      tyEnsureSavedTravellerToolsMounted(requiredPassport(flights));
      bindSavedTravellerAssist(flights, form);
      tyBindSaveTravellerConsent(form);
      bindDateRangeControls(form);
      const refreshFormState = function(){ bindDateRangeControls(form); validate(false); refreshPassengerAddButtons(form, flights); };
      form.addEventListener('input', refreshFormState);
      form.addEventListener('change', refreshFormState);
      refreshPassengerAddButtons(form, flights);
    }
    async function openAddons(){
      if(!validate(true)) return;
      await tySaveReviewTravellers(form);
      showBookingLoader();
      try{ await fetchSeatMapForFlights(flights, flights[0] && flights[0].reviewData); }
      finally{ hideBookingLoader(); }
      renderAddOnsPage(flights, form);
    }
    ROOT.querySelectorAll('#tyProceedPayment,#tyProceedPaymentLeft').forEach(btn=>{ if(btn) btn.onclick=openAddons; });
    bindMobileSheets(flights, form, error, msg, validate);
    validate(false);
  }

  function renderTravellerSummary(travellers){
    const counters = {};
    return `<article class="ty-review-card"><div class="ty-section-head"><h2>Traveller Details</h2></div><div class="ty-section-body"><div class="ty-trav-summary">${travellers.map(function(t){
      const type = t.passengerType || t.type || 'Traveller';
      counters[type] = (counters[type] || 0) + 1;
      const name = [t.title,t.firstName,t.lastName].filter(Boolean).join(' ');
      const fields = [
        ['Date of Birth', t.dob || t.dateOfBirth],
        ['Nationality', t.nationality || t.pNat],
        ['Passport Number', t.passportNumber || t.pNum],
        ['Passport Issue Country', t.passportIssuingCountry || t.passportIssueCountry],
        ['Passport Issue Date', t.passportIssueDate || t.pid],
        ['Passport Expiry Date', t.passportExpiry || t.passportExpiryDate || t.eD],
        ['PAN', t.pan || t.panNumber]
      ].filter(function(row){ return String(row[1] || '').trim(); });
      return `<section class="ty-trav-detail-card"><header><span>${esc(type)} ${counters[type]}</span><b>${esc(name || 'Traveller')}</b></header>${fields.length ? `<div class="ty-trav-detail-grid">${fields.map(function(row){ return `<div><small>${esc(row[0])}</small><strong>${esc(row[1])}</strong></div>`; }).join('')}</div>` : ''}</section>`;
    }).join('')}</div></div></article>`;
  }


  function saveReviewFormSnapshot(form){
    if(!form) return;
    try{
      const data = {};
      form.querySelectorAll('input,select,textarea').forEach(function(el){
        if(!el.name) return;
        if(el.type === 'checkbox') data[el.name] = el.checked ? '1' : '0';
        else data[el.name] = el.value || '';
      });
      sessionStorage.setItem('ty_flight_review_form_values', JSON.stringify(data));
    }catch(e){}
  }

  function restoreReviewFormSnapshot(form){
    if(!form) return;
    try{
      const raw = sessionStorage.getItem('ty_flight_review_form_values');
      if(!raw) return;
      const data = JSON.parse(raw) || {};
      Object.keys(data).forEach(function(name){
        const el = form.querySelector(`[name="${CSS.escape(name)}"]`);
        if(!el) return;
        if(el.type === 'checkbox') el.checked = data[name] === '1';
        else el.value = data[name] || '';
      });
    }catch(e){}
  }

  function addOnGroupsForFlights(flights){
    return [
      ['SEAT','Seats','seat'],
      ['MEAL','Meals','meal'],
      ['BAGGAGE','Baggage','baggage'],
      ['EXTRASERVICES','Packages / Extra Services','extra']
    ].map(function(row){
      return {type:row[0], title:row[1], icon:row[2], options:addOnOptions(flights,row[0])};
    }).filter(function(group){ return group.options && group.options.length; });
  }

  function baggageSummaryForFlight(flight){
    const fare = flight && (flight.selectedFare || flight.rawPrice || flight.raw || flight) || {};
    const bag = readFareBaggage(fare, flight || {});
    const cabin = changeTextValue(bag.cabin || deepFirstValue(flight, ['cB','cabinBaggage','cabinBag']));
    const checkin = changeTextValue(bag.checkin || (flight && flight.baggage) || deepFirstValue(flight, ['iB','checkInBaggage','baggage']));
    return {
      cabin: cabin || 'Details not available from airline',
      checkin: checkin || 'Details not available from airline'
    };
  }

  function renderAddOnsFlightDetails(flights){
    return renderItineraryCard(flights, {compact:true, hideTitle:false});
  }

  
  function renderSeatMapOptions(options, flights){
    const travellers = passengerMetas();
    const grouped = new Map();
    options.forEach(function(option){
      const segmentId = String(option.segmentId || 'segment');
      if(!grouped.has(segmentId)) grouped.set(segmentId, []);
      grouped.get(segmentId).push(option);
    });
    const segmentIds = Array.from(grouped.keys());
    if(!segmentIds.length) return '<p class="ty-muted ty-no-addons">Seat map is not available for this fare.</p>';
    if(!segmentIds.includes(state.activeSeatSegment)) state.activeSeatSegment = segmentIds[0];
    if(state.activeSeatPassenger >= travellers.length) state.activeSeatPassenger = 0;
    const activePax = Number(state.activeSeatPassenger || 0);
    const activeSegment = state.activeSeatSegment;
    const seats = grouped.get(activeSegment) || [];
    const selectedByOther = new Map();
    Object.values(state.selectedAddOns || {}).filter(Boolean).forEach(function(item){
      if(String(item.type || '').toUpperCase() !== 'SEAT' || String(item.segmentId || '') !== String(activeSegment)) return;
      selectedByOther.set(String(item.code || ''), Number(item.passengerIndex || 0));
    });
    const segmentTabs = segmentIds.length > 1 ? `<div class="ty-seat-segment-tabs">${segmentIds.map(function(id,index){ return `<button type="button" class="${id === activeSegment ? 'active' : ''}" data-seat-segment-tab="${esc(id)}">Flight ${index + 1}</button>`; }).join('')}</div>` : '';
    const passengerTabs = `<div class="ty-seat-passenger-tabs">${travellers.map(function(meta){ return `<button type="button" class="${meta.index === activePax ? 'active' : ''}" data-seat-pax="${meta.index}">${esc(passengerDisplayLabel(meta))}</button>`; }).join('')}</div>`;
    const grid = seats.map(function(seat){
      const owner = selectedByOther.get(String(seat.code));
      const key = 'SEAT-' + activeSegment + '-' + activePax;
      const chosen = state.selectedAddOns && state.selectedAddOns[key];
      const active = chosen && String(chosen.code) === String(seat.code);
      const taken = owner !== undefined && owner !== activePax;
      const disabled = seat.isBooked || taken;
      const classes = ['ty-seat-cell'];
      if(active) classes.push('active');
      if(seat.isBooked) classes.push('booked');
      if(taken) classes.push('taken');
      if(seat.isLegroom) classes.push('legroom');
      return `<button type="button" class="${classes.join(' ')}" data-seat-select data-seat-code="${esc(seat.code)}" data-seat-desc="${esc(seat.desc)}" data-seat-amount="${esc(seat.amount)}" data-seat-segment="${esc(activeSegment)}" ${disabled ? 'disabled' : ''}><b>${esc(seat.code)}</b><small>${seat.isBooked ? 'Booked' : taken ? 'Selected' : seat.amount ? money(seat.amount) : 'Free'}</small></button>`;
    }).join('');
    return `${segmentTabs}${passengerTabs}<div class="ty-seat-legend"><span><i class="available"></i>Available</span><span><i class="selected"></i>Selected</span><span><i class="booked"></i>Booked</span></div><div class="ty-seat-map-grid">${grid}</div>`;
  }

  function renderAddOnTabs(flights){
    const groups = addOnGroupsForFlights(flights);
    if(!groups.length){
      return '<p class="ty-muted ty-no-addons">No paid add-ons are available from the selected airline for this fare.</p>';
    }
    const activeType = (state.activeAddonTab && groups.some(function(g){ return g.type === state.activeAddonTab; }))
      ? state.activeAddonTab
      : groups[0].type;
    state.activeAddonTab = activeType;
    return `<div class="ty-addon-tabs" aria-label="Available add-ons">${groups.map(function(g){
      const active = g.type === activeType;
      return `<button type="button" class="${active ? 'active' : ''}" data-addon-tab="${esc(g.type)}"><span class="ty-addon-icon ty-addon-icon-${esc(g.icon)}" aria-hidden="true"></span><span>${esc(g.title)}</span></button>`;
    }).join('')}</div><div class="ty-addon-panels">${groups.map(function(g){
      const active = g.type === activeType;
      const content = g.type === 'SEAT' ? renderSeatMapOptions(g.options, flights) : g.options.map(o=>renderAddonOption(g.type,o)).join('');
      return `<section data-addon-pane="${esc(g.type)}" class="${active ? 'active' : ''}" ${active ? '' : 'hidden'}><h3>${esc(g.title)}</h3>${content}</section>`;
    }).join('')}</div>`;
  }

  function renderAddonOption(type,o){
    const travellers=passengerMetas();
    return `<div class="ty-addon-option"><div><b>${esc(o.code)}</b><p>${esc(o.desc)}</p></div><strong>${money(o.amount)}</strong><div class="ty-addon-pax">${travellers.map(function(m){
      const key = type + '-' + m.index;
      const chosen = state.selectedAddOns && state.selectedAddOns[key];
      const checked = chosen && String(chosen.code) === String(o.code) ? ' checked' : '';
      return `<label><input type="checkbox"${checked} data-addon-select data-addon-type="${esc(type)}" data-addon-code="${esc(o.code)}" data-addon-desc="${esc(o.desc)}" data-addon-amount="${esc(o.amount)}" data-addon-pax="${m.index}"> ${esc(passengerDisplayLabel(m))}</label>`;
    }).join('')}</div></div>`;
  }

  function renderAddOnsPage(flights, form){
    injectItineraryCardCss();
    tyInjectForceUiPatchCss();
    tyInjectCheckoutFinalPatchCss();
    stopBookingHoldTimer();
    saveReviewFormSnapshot(form);
    const travellers=collectTravellers(form);
    const fare=computeFare(flights);
    const desktopAddOns = isDesktopView();
    const desktopAddonLeftHtml = desktopAddOns ? '<button type="button" class="ty-payment-btn ty-left-continue ty-desktop-continue" data-desktop-continue="true" id="tyAddonPayLeft">Continue Payment</button>' : "";
    const desktopAddonSideHtml = desktopAddOns ? '<button type="button" class="ty-payment-btn ty-desktop-continue" data-desktop-continue="true" id="tyAddonPay">Continue Payment</button>' : "";
    sessionStorage.setItem('ty_flight_travellers', JSON.stringify(travellers));
    try{ history.pushState({step:'flight-addons'},'', '/pages/results/flights.html?service=flight&step=addons'); }catch(e){}
    ROOT.innerHTML=`<div class="ty-review-page ty-addon-page"><header class="ty-review-top"><button type="button" class="ty-review-back" data-addon-back>‹</button><div><h1>Add-ons</h1><p>${esc(state.search.origin)} → ${esc(state.search.destination)} • ${esc(dateText(firstSegment(flights[0]).depDate || state.search.departureDate))}</p></div></header><main class="ty-review-shell"><section class="ty-review-left"><article class="ty-review-card ty-flight-review-card"><div class="ty-section-head"><h2>Flight Details</h2></div><div class="ty-section-body">${renderAddOnsFlightDetails(flights)}</div></article>${renderTravellerSummary(travellers)}<article class="ty-review-card ty-addons-card"><div class="ty-section-head"><h2>Add-ons</h2><p>Select available seats, meals, baggage or extra services passenger-wise.</p></div><div class="ty-section-body">${renderAddOnTabs(flights)}</div></article>${desktopAddonLeftHtml}</section><aside class="ty-side">${renderPriceSummaryBox(fare)}${renderOfferBox(fare)}${desktopAddonSideHtml}<p class="ty-pay-msg" id="tyPaymentMsg"></p></aside></main>${mobileFareSheets(flights, fare, {buttonText:"Continue Payment", includeReview:false})}</div>`;
    removeDesktopContinueButtonsOnMobile();
    bindAddOnsEvents(flights, travellers, form);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function bindAddOnsEvents(flights, travellers, originalForm){
    ROOT.querySelector('[data-addon-back]')?.addEventListener('click',()=>renderFlightReviewStep(flights));
    ROOT.querySelectorAll('[data-review-flight-tab]').forEach(btn=>btn.onclick=()=>{ const box=btn.closest('.ty-review-flight'); if(!box) return; const key=btn.getAttribute('data-review-flight-tab'); const target=box.querySelector(`[data-review-flight-pane="${CSS.escape(key)}"]`); const willOpen = !target || target.hidden; box.querySelectorAll('[data-review-flight-pane]').forEach(p=>{p.hidden=true; p.classList.remove('active');}); if(target && willOpen){target.hidden=false; target.classList.add('active');} });
    ROOT.querySelectorAll('[data-addon-tab]').forEach(btn=>btn.onclick=()=>{
      const key=btn.getAttribute('data-addon-tab');
      state.activeAddonTab = key;
      const pane=ROOT.querySelector(`[data-addon-pane="${CSS.escape(key)}"]`);
      ROOT.querySelectorAll('[data-addon-tab]').forEach(x=>x.classList.remove('active'));
      ROOT.querySelectorAll('[data-addon-pane]').forEach(p=>{ p.classList.remove('active'); p.hidden = true; });
      if(pane){ btn.classList.add('active'); pane.classList.add('active'); pane.hidden = false; }
    });
    ROOT.querySelectorAll('[data-seat-pax]').forEach(function(btn){
      btn.onclick = function(){
        state.activeSeatPassenger = Number(btn.getAttribute('data-seat-pax') || 0) || 0;
        state.activeAddonTab = 'SEAT';
        renderAddOnsPage(flights, originalForm);
      };
    });
    ROOT.querySelectorAll('[data-seat-segment-tab]').forEach(function(btn){
      btn.onclick = function(){
        state.activeSeatSegment = btn.getAttribute('data-seat-segment-tab') || '';
        state.activeAddonTab = 'SEAT';
        renderAddOnsPage(flights, originalForm);
      };
    });
    ROOT.querySelectorAll('[data-seat-select]').forEach(function(btn){
      btn.onclick = function(){
        if(btn.disabled) return;
        const pax = Number(state.activeSeatPassenger || 0) || 0;
        const segmentId = btn.getAttribute('data-seat-segment') || 'segment';
        const key = 'SEAT-' + segmentId + '-' + pax;
        const code = btn.getAttribute('data-seat-code') || '';
        const current = state.selectedAddOns && state.selectedAddOns[key];
        state.activeAddonTab = 'SEAT';
        if(current && String(current.code) === String(code)) delete state.selectedAddOns[key];
        else state.selectedAddOns[key] = {
          type:'SEAT',
          code:code,
          desc:btn.getAttribute('data-seat-desc') || ('Seat ' + code),
          amount:Number(btn.getAttribute('data-seat-amount') || 0) || 0,
          passengerIndex:pax,
          segmentId:segmentId
        };
        try{ sessionStorage.setItem('ty_selected_addons', JSON.stringify(state.selectedAddOns || {})); }catch(_e){}
        renderAddOnsPage(flights, originalForm);
      };
    });
    ROOT.querySelectorAll('[data-addon-select]').forEach(input=>input.onchange=()=>{
      const type=input.getAttribute('data-addon-type');
      const pax=input.getAttribute('data-addon-pax');
      const key=type+'-'+pax;
      state.activeAddonTab = type;
      if(input.checked){
        state.selectedAddOns[key]={
          type,
          code:input.getAttribute('data-addon-code'),
          desc:input.getAttribute('data-addon-desc'),
          amount:Number(input.getAttribute('data-addon-amount')||0),
          passengerIndex:Number(pax),
          segmentId:input.getAttribute('data-addon-segment') || 'segment'
        };
      } else {
        delete state.selectedAddOns[key];
      }
      try{ sessionStorage.setItem('ty_selected_addons', JSON.stringify(state.selectedAddOns || {})); }catch(_e){}
      renderAddOnsPage(flights, originalForm);
    });
    ROOT.querySelectorAll('[data-open-fare-sheet]').forEach(function(btn){ btn.onclick = function(){ ROOT.querySelector('#tyFareSheet')?.classList.add('active'); }; });
    ROOT.querySelectorAll('[data-close-sheet]').forEach(function(btn){ btn.onclick = function(){ btn.closest('.ty-mobile-sheet')?.classList.remove('active'); }; });
    const msg=ROOT.querySelector('#tyPaymentMsg');
    function payNow(){ proceedToPayment(flights, originalForm, null, msg, ()=>true); }
    ROOT.querySelectorAll('#tyAddonPay,#tyAddonPayLeft,#tyMobileContinue').forEach(btn=>{ if(btn) btn.onclick=payNow; });
  }

  function getDate3(form, prefix){
    const d = form.querySelector(`[name="${prefix}Day"]`)?.value || "";
    const m = form.querySelector(`[name="${prefix}Month"]`)?.value || "";
    const y = form.querySelector(`[name="${prefix}Year"]`)?.value || "";
    return {d,m,y,complete:Boolean(d&&m&&y),value:y&&m&&d?`${y}-${m}-${String(d).padStart(2,'0')}`:""};
  }

  function dateValueMs(form, prefix){
    const v = getDate3(form, prefix);
    return v.complete ? new Date(v.value + 'T00:00:00').getTime() : NaN;
  }

  function dateSelectRange(form, prefix){
    const el = form && (form.querySelector(`[name="${prefix}Day"]`) || form.querySelector(`[name="${prefix}Month"]`) || form.querySelector(`[name="${prefix}Year"]`));
    const min = el && el.getAttribute('data-min-date');
    const max = el && el.getAttribute('data-max-date');
    return {
      min: min ? new Date(min + 'T00:00:00').getTime() : NaN,
      max: max ? new Date(max + 'T00:00:00').getTime() : NaN,
      minText: min || '',
      maxText: max || ''
    };
  }

  function daysInMonth(year, month){
    const y = Number(year || 2000);
    const m = Number(month || 1);
    return new Date(y, m, 0).getDate();
  }

  function updateDateRangeBox(box){
    if(!box) return;
    const day = box.querySelector('[data-date-part="day"]');
    const month = box.querySelector('[data-date-part="month"]');
    const year = box.querySelector('[data-date-part="year"]');
    if(!day || !month || !year) return;
    const min = box.getAttribute('data-min-date');
    const max = box.getAttribute('data-max-date');
    const minD = min ? new Date(min + 'T00:00:00') : null;
    const maxD = max ? new Date(max + 'T00:00:00') : null;
    const y = Number(year.value || 0);
    const m = Number(month.value || 0);
    Array.from(month.options).forEach(function(opt){
      if(!opt.value){ opt.disabled = false; return; }
      const optMonth = Number(opt.value);
      let disabled = false;
      if(minD && y === minD.getFullYear() && optMonth < minD.getMonth()+1) disabled = true;
      if(maxD && y === maxD.getFullYear() && optMonth > maxD.getMonth()+1) disabled = true;
      opt.disabled = disabled;
    });
    if(month.value && month.selectedOptions[0] && month.selectedOptions[0].disabled) month.value = '';
    const maxDayForMonth = y && m ? daysInMonth(y, m) : 31;
    Array.from(day.options).forEach(function(opt){
      if(!opt.value){ opt.disabled = false; return; }
      const optDay = Number(opt.value);
      let disabled = optDay > maxDayForMonth;
      if(minD && y === minD.getFullYear() && m === minD.getMonth()+1 && optDay < minD.getDate()) disabled = true;
      if(maxD && y === maxD.getFullYear() && m === maxD.getMonth()+1 && optDay > maxD.getDate()) disabled = true;
      opt.disabled = disabled;
    });
    if(day.value && day.selectedOptions[0] && day.selectedOptions[0].disabled) day.value = '';
  }

  function bindDateRangeControls(scope){
    (scope || ROOT).querySelectorAll('[data-date-range]').forEach(function(box){
      if(!box.dataset.dateRangeBound){
        box.dataset.dateRangeBound = '1';
        box.addEventListener('change', function(){ updateDateRangeBox(box); });
      }
      updateDateRangeBox(box);
    });
  }

  function addMonths(date, months){
    const d = dateOnly(date) || dateOnly(new Date());
    const day = d.getDate();
    d.setMonth(d.getMonth() + Number(months || 0));
    /* Clamp month overflow (e.g. Jan 31 + 1 month). */
    if(d.getDate() < day) d.setDate(0);
    return d;
  }

  function minPassportExpiryDate(){
    const travel = dateOnly(state.search && state.search.departureDate) || dateOnly(new Date());
    /* Must be valid for more than 6 months from travel date. */
    const min = addMonths(travel, 6);
    min.setDate(min.getDate() + 1);
    min.setHours(0, 0, 0, 0);
    return min;
  }

  function minPassportExpiryMs(){
    return minPassportExpiryDate().getTime();
  }

  function minPassportExpiryYmd(){
    return ymd(minPassportExpiryDate());
  }

  function passengerCompletionErrors(form, meta, flights, show){
    const errors = [];
    if(!form || !meta) return errors;
    const i = meta.index;
    const passReq = requiredPassport(flights || []);
    const airlineDobReq = requiredDob(flights || []);
    const addMissing = function(el, message){
      errors.push({el:el, message:message || 'This field is required.'});
      if(show && el) markFieldError(el, message || 'This field is required.');
    };
    const need = function(name, message){
      const el = form.querySelector(`[name="${name}"]`);
      if(!el || !hasFilled(el) || !el.checkValidity()) addMissing(el, message);
    };
    need(`title_${i}`, 'Title is required.');
    need(`firstName_${i}`, 'First and middle name is required.');
    need(`lastName_${i}`, 'Last name is required.');
    const dob = getDate3(form, `dob_${i}`);
    const dobReqThis = dobRequiredForPassengerType(meta.type, airlineDobReq);
    if(dobReqThis && !dob.complete){
      const el = form.querySelector(`[name="dob_${i}Day"]`) || form.querySelector(`[name="dob_${i}Month"]`) || form.querySelector(`[name="dob_${i}Year"]`);
      addMissing(el, 'Date of birth is required.');
    }else if((dob.d || dob.m || dob.y) && !dob.complete){
      const el = form.querySelector(`[name="dob_${i}Day"]`) || form.querySelector(`[name="dob_${i}Month"]`) || form.querySelector(`[name="dob_${i}Year"]`);
      addMissing(el, 'Complete date of birth is required.');
    }else if(dob.complete && dateValueMs(form, `dob_${i}`) > dateOnly(new Date()).getTime()){
      const el = form.querySelector(`[name="dob_${i}Day"]`) || form.querySelector(`[name="dob_${i}Month"]`) || form.querySelector(`[name="dob_${i}Year"]`);
      addMissing(el, 'Date of birth cannot be in the future.');
    }else if(dob.complete && !isDobValidForPassenger(meta.type, dob.value)){
      const el = form.querySelector(`[name="dob_${i}Day"]`) || form.querySelector(`[name="dob_${i}Month"]`) || form.querySelector(`[name="dob_${i}Year"]`);
      addMissing(el, 'Date of birth is not valid for this passenger type.');
    }
    if(passReq){
      need(`passportNumber_${i}`, 'Passport number is required.');
      const pno = form.querySelector(`[name="passportNumber_${i}"]`);
      if(pno && String(pno.value || '').trim() && !/^[A-Za-z0-9]{6,15}$/.test(String(pno.value || '').trim())) addMissing(pno, 'Passport number must be 6 to 15 letters or numbers.');
      need(`passportIssueCountry_${i}`, 'Passport issuing country is required.');
      need(`nationality_${i}`, 'Nationality is required.');
      const issue = getDate3(form, `passportIssue_${i}`);
      const expiry = getDate3(form, `passportExpiry_${i}`);
      if(!issue.complete){
        const el = form.querySelector(`[name="passportIssue_${i}Day"]`) || form.querySelector(`[name="passportIssue_${i}Month"]`) || form.querySelector(`[name="passportIssue_${i}Year"]`);
        addMissing(el, 'Passport issue date is required.');
      }else if(dateValueMs(form, `passportIssue_${i}`) > dateSelectRange(form, `passportIssue_${i}`).max){
        const el = form.querySelector(`[name="passportIssue_${i}Day"]`) || form.querySelector(`[name="passportIssue_${i}Month"]`) || form.querySelector(`[name="passportIssue_${i}Year"]`);
        addMissing(el, 'Passport issue date must be before today.');
      }
      if(!expiry.complete){
        const el = form.querySelector(`[name="passportExpiry_${i}Day"]`) || form.querySelector(`[name="passportExpiry_${i}Month"]`) || form.querySelector(`[name="passportExpiry_${i}Year"]`);
        addMissing(el, 'Passport expiry date is required.');
      }else if(dateValueMs(form, `passportExpiry_${i}`) < minPassportExpiryMs()){
        const el = form.querySelector(`[name="passportExpiry_${i}Day"]`) || form.querySelector(`[name="passportExpiry_${i}Month"]`) || form.querySelector(`[name="passportExpiry_${i}Year"]`);
        addMissing(el, 'Passport must be valid for more than 6 months from the travel date.');
      }else if(issue.complete && dateValueMs(form, `passportExpiry_${i}`) <= dateValueMs(form, `passportIssue_${i}`)){
        const el = form.querySelector(`[name="passportExpiry_${i}Day"]`) || form.querySelector(`[name="passportExpiry_${i}Month"]`) || form.querySelector(`[name="passportExpiry_${i}Year"]`);
        addMissing(el, 'Passport expiry date must be after issue date.');
      }
    }else{
      /* Passport not required by API — validate only if customer entered passport fields. */
      const pnoEl = form.querySelector(`[name="passportNumber_${i}"]`);
      const expiry = getDate3(form, `passportExpiry_${i}`);
      if(pnoEl && String(pnoEl.value || '').trim()){
        if(!/^[A-Za-z0-9]{6,15}$/.test(String(pnoEl.value || '').trim())) addMissing(pnoEl, 'Passport number must be 6 to 15 letters or numbers.');
      }
      if(expiry.complete && dateValueMs(form, `passportExpiry_${i}`) < minPassportExpiryMs()){
        const el = form.querySelector(`[name="passportExpiry_${i}Day"]`) || form.querySelector(`[name="passportExpiry_${i}Month"]`) || form.querySelector(`[name="passportExpiry_${i}Year"]`);
        addMissing(el, 'Passport must be valid for more than 6 months from the travel date.');
      }
    }
    if(tyPanRequiredForPassenger(form, i, flights || [])){
      const panEl = form.querySelector(`[name="pan_${i}"]`);
      const panVal = String(panEl && panEl.value || '').trim().toUpperCase();
      if(panEl) panEl.value = panVal;
      if(!panVal) addMissing(panEl, 'PAN number is required.');
      else if(!tyPanFormatValid(panVal)) addMissing(panEl, 'Please enter a valid PAN number.');
    }
    return errors;
  }

  function firstIncompletePassengerBefore(form, targetIndex, flights, show){
    const metas = passengerMetas().filter(function(m){ return Number(m.index) < Number(targetIndex); });
    for(const meta of metas){
      const errors = passengerCompletionErrors(form, meta, flights, show);
      if(errors.length) return {meta:meta, errors:errors};
    }
    return null;
  }

  function passengerSummaryCard(form, meta){
    const i = meta.index;
    const label = passengerDisplayLabel(meta);
    const title = form.querySelector(`[name="title_${i}"]`)?.value || '';
    const firstName = form.querySelector(`[name="firstName_${i}"]`)?.value || '';
    const lastName = form.querySelector(`[name="lastName_${i}"]`)?.value || '';
    const dob = getDate3(form, `dob_${i}`).value;
    const passport = form.querySelector(`[name="passportNumber_${i}"]`)?.value || '';
    const name = [title, firstName, lastName].filter(Boolean).join(' ') || 'Details filled';
    return `<div class="ty-prev-pax-card"><span>${esc(label)}</span><b>${esc(name)}</b>${dob?`<small>DOB: ${esc(dob)}</small>`:''}${passport?`<small>Passport: ${esc(passport)}</small>`:''}</div>`;
  }

  function updatePreviousPassengerSummary(form, targetIndex){
    const box = ROOT.querySelector(`[data-prev-summary-for="${CSS.escape(String(targetIndex))}"]`);
    if(!box || !form) return;
    const metas = passengerMetas().filter(function(m){ return Number(m.index) < Number(targetIndex); });
    if(!metas.length){ box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = `<h4>Completed traveller details</h4>${metas.map(function(m){ return passengerSummaryCard(form, m); }).join('')}`;
    box.hidden = false;
  }

  function setPassengerPanelActive(form, id){
    if(!form) return;
    form.querySelectorAll('[data-pax-panel]').forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-pax-panel') === String(id)); });
    ROOT.querySelectorAll('[data-pax-tab]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-pax-tab') === String(id)); });
    updatePreviousPassengerSummary(form, id);
    const panel = ROOT.querySelector(`[data-pax-panel="${CSS.escape(String(id))}"]`);
    if(panel) panel.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function refreshPassengerAddButtons(form, flights){
    if(!form) return;
    ROOT.querySelectorAll('[data-pax-tab]').forEach(function(btn){
      const id = Number(btn.getAttribute('data-pax-tab'));
      const locked = !!firstIncompletePassengerBefore(form, id, flights, false);
      btn.classList.toggle('locked', locked);
      btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
      btn.title = locked ? 'Previous traveller details not complete' : 'Open ' + (btn.getAttribute('data-pax-label') || 'traveller');
    });
  }

  function openPanelForField(form, el){
    if(!form || !el) return;
    const panel = el.closest('[data-pax-panel]');
    if(!panel) return;
    const id = panel.getAttribute('data-pax-panel');
    form.querySelectorAll('[data-pax-panel]').forEach(p=>p.classList.toggle('active', p===panel));
    ROOT.querySelectorAll('[data-pax-tab]').forEach(b=>b.classList.toggle('active', b.getAttribute('data-pax-tab')===id));
  }

  function validationFieldFor(el){
    if(!el) return null;
    return el.closest('.ty-form-field') || el.closest('label') || el.parentElement;
  }

  function clearValidationMarks(form){
    if(!form) return;
    form.querySelectorAll('.ty-field-invalid').forEach(function(field){ field.classList.remove('ty-field-invalid'); });
    form.querySelectorAll('.ty-field-error').forEach(function(node){ node.remove(); });
    const error = ROOT.querySelector('#tyFormError');
    const alert = ROOT.querySelector('#tyTopAlert');
    if(error){ error.textContent = ''; error.style.display = 'none'; }
    if(alert){ alert.textContent = ''; alert.hidden = true; alert.style.display = 'none'; }
  }

  function markFieldError(el, message){
    const field = validationFieldFor(el);
    if(!field) return;
    field.classList.add('ty-field-invalid');
    field.querySelectorAll('.ty-field-error').forEach(function(node){ node.remove(); });
    const msg = document.createElement('small');
    msg.className = 'ty-field-error';
    msg.textContent = message || 'This field is required.';
    field.appendChild(msg);
  }

  function hasFilled(el){
    if(!el) return false;
    if(el.type === 'checkbox') return !!el.checked;
    return String(el.value || '').trim() !== '';
  }

  function validateControl(form, name, message, show, errors, openPanel){
    const el = form.querySelector(`[name="${name}"]`);
    const invalid = !el || !hasFilled(el) || !el.checkValidity();
    if(invalid){
      errors.push({el:el, message:message || 'This field is required.', openPanel:openPanel !== false});
      if(show && el) markFieldError(el, message || 'This field is required.');
    }
    return !invalid;
  }

  function markDateError(form, prefix, message, show, errors, openPanel){
    const el = form.querySelector(`[name="${prefix}Day"]`) || form.querySelector(`[name="${prefix}Month"]`) || form.querySelector(`[name="${prefix}Year"]`);
    errors.push({el:el, message:message || 'Date is required.', openPanel:openPanel !== false});
    if(show && el) markFieldError(el, message || 'Date is required.');
  }

  function validateReviewForm(flights, form, error, alert, show){
    if(form) clearValidationMarks(form);
    if(!form){ return false; }
    const errors = [];
    const metas = passengerMetas();
    const passReq = requiredPassport(flights);
    const minExpiry = minPassportExpiryMs();
    for(const m of metas){
      const i = m.index;
      validateControl(form, `title_${i}`, 'Title is required.', show, errors, true);
      validateControl(form, `firstName_${i}`, 'First and middle name is required.', show, errors, true);
      validateControl(form, `lastName_${i}`, 'Last name is required.', show, errors, true);
      const dob = getDate3(form, `dob_${i}`);
      const dobReqThis = dobRequiredForPassengerType(m.type, requiredDob(flights));
      if(dobReqThis && !dob.complete){ markDateError(form, `dob_${i}`, 'Date of birth is required.', show, errors, true); }
      else if((dob.d || dob.m || dob.y) && !dob.complete){ markDateError(form, `dob_${i}`, 'Complete date of birth is required.', show, errors, true); }
      else if(dob.complete && dateValueMs(form, `dob_${i}`) > dateOnly(new Date()).getTime()){ markDateError(form, `dob_${i}`, 'Date of birth cannot be in the future.', show, errors, true); }
      else if(dob.complete && !isDobValidForPassenger(m.type, dob.value)){ markDateError(form, `dob_${i}`, 'Date of birth is not valid for this passenger type.', show, errors, true); }
      if(passReq){
        validateControl(form, `passportNumber_${i}`, 'Passport number is required.', show, errors, true);
        validateControl(form, `passportIssueCountry_${i}`, 'Passport issuing country is required.', show, errors, true);
        validateControl(form, `nationality_${i}`, 'Nationality is required.', show, errors, true);
        const pno = form.querySelector(`[name="passportNumber_${i}"]`);
        if(pno && String(pno.value||'').trim() && !/^[A-Za-z0-9]{6,15}$/.test(String(pno.value||'').trim())){
          errors.push({el:pno, message:'Passport number must be 6 to 15 letters or numbers.', openPanel:true});
          if(show) markFieldError(pno, 'Passport number must be 6 to 15 letters or numbers.');
        }
        const issue = getDate3(form, `passportIssue_${i}`);
        const expiry = getDate3(form, `passportExpiry_${i}`);
        if(!issue.complete){ markDateError(form, `passportIssue_${i}`, 'Passport issue date is required.', show, errors, true); }
        else if(dateValueMs(form, `passportIssue_${i}`) > dateSelectRange(form, `passportIssue_${i}`).max){ markDateError(form, `passportIssue_${i}`, 'Passport issue date must be before today.', show, errors, true); }
        if(!expiry.complete){ markDateError(form, `passportExpiry_${i}`, 'Passport expiry date is required.', show, errors, true); }
        else if(dateValueMs(form, `passportExpiry_${i}`) < minExpiry){ markDateError(form, `passportExpiry_${i}`, 'Passport must be valid for more than 6 months from the travel date.', show, errors, true); }
        else if(issue.complete && dateValueMs(form, `passportExpiry_${i}`) <= dateValueMs(form, `passportIssue_${i}`)){ markDateError(form, `passportExpiry_${i}`, 'Passport expiry date must be after issue date.', show, errors, true); }
      }else{
        const pno = form.querySelector(`[name="passportNumber_${i}"]`);
        const expiry = getDate3(form, `passportExpiry_${i}`);
        if(pno && String(pno.value||'').trim() && !/^[A-Za-z0-9]{6,15}$/.test(String(pno.value||'').trim())){
          errors.push({el:pno, message:'Passport number must be 6 to 15 letters or numbers.', openPanel:true});
          if(show) markFieldError(pno, 'Passport number must be 6 to 15 letters or numbers.');
        }
        if(expiry.complete && dateValueMs(form, `passportExpiry_${i}`) < minExpiry){
          markDateError(form, `passportExpiry_${i}`, 'Passport must be valid for more than 6 months from the travel date.', show, errors, true);
        }
      }
      if(tyPanRequiredForPassenger(form, i, flights)){
        const panEl = form.querySelector(`[name="pan_${i}"]`);
        const panVal = String(panEl && panEl.value || '').trim().toUpperCase();
        if(panEl) panEl.value = panVal;
        if(!panVal){
          errors.push({el:panEl, message:'PAN number is required.', openPanel:true});
          if(show && panEl) markFieldError(panEl, 'PAN number is required.');
        }else if(!tyPanFormatValid(panVal)){
          errors.push({el:panEl, message:'Please enter a valid PAN number.', openPanel:true});
          if(show && panEl) markFieldError(panEl, 'Please enter a valid PAN number.');
        }
      }
    }
    const gstUse = form.querySelector('[name="gstUse"]');
    if(gstUse && gstUse.checked){
      validateControl(form, 'gstNumber', 'GST number is required.', show, errors, false);
      validateControl(form, 'gstCompany', 'Company name is required.', show, errors, false);
      validateControl(form, 'gstAddress', 'Company address is required.', show, errors, false);
    }
    const contactOptional = form && form.dataset && form.dataset.contactOptional === 'true';
    const emailEl = form.querySelector('[name="email"]');
    if(contactOptional){
      if(emailEl && String(emailEl.value||'').trim() && !isValidEmailAddress(emailEl.value)){
        errors.push({el:emailEl, message:'Enter a valid email address.', openPanel:false});
        if(show) markFieldError(emailEl, 'Enter a valid email address.');
      }
    }else{
      if(!validateControl(form, 'email', 'Email address is required.', show, errors, false)){
        // required email handled by validateControl
      }else if(emailEl && !isValidEmailAddress(emailEl.value)){
        errors.push({el:emailEl, message:'Enter a valid email address.', openPanel:false});
        if(show) markFieldError(emailEl, 'Enter a valid email address.');
      }
    }

    const mobileEl = form.querySelector('[name="mobile"]');
    if(contactOptional){
      if(mobileEl && String(mobileEl.value||'').trim()){
        const phone = selectedPhoneCountry(form);
        const result = validPhoneForCountry(phone.country, mobileEl.value, phone.dialCode);
        if(!result.valid){
          errors.push({el:mobileEl, message:result.message, openPanel:false});
          if(show) markFieldError(mobileEl, result.message);
        }
      }
    }else{
      validateControl(form, 'mobileCountryCode', 'Country code is required.', show, errors, false);
      if(!validateControl(form, 'mobile', 'Phone number is required.', show, errors, false)){
        // required phone handled by validateControl
      }else if(mobileEl){
        const phone = selectedPhoneCountry(form);
        const result = validPhoneForCountry(phone.country, mobileEl.value, phone.dialCode);
        if(!result.valid){
          errors.push({el:mobileEl, message:result.message, openPanel:false});
          if(show) markFieldError(mobileEl, result.message);
        }
      }
    }
    validateControl(form, 'agreement', 'Please accept TravelYaraa terms and conditions.', show, errors, false);
    if(errors.length){
      if(show){
        const first = errors.find(function(e){ return e && e.el; });
        if(first){
          if(first.openPanel) openPanelForField(form, first.el);
          setTimeout(function(){ try{ first.el.scrollIntoView({behavior:'smooth', block:'center'}); first.el.focus && first.el.focus({preventScroll:true}); }catch(e){} }, 80);
        }
      }
      return false;
    }
    if(error){ error.textContent=''; error.style.display='none'; }
    if(alert){ alert.hidden=true; alert.textContent=''; alert.style.display='none'; }
    return true;
  }

  function travellerAgeFromDob(dob, travelDate){
    if(!dob) return null;
    const birth = new Date(String(dob) + 'T00:00:00');
    const travel = new Date(String(travelDate || (state.search && state.search.departureDate) || new Date().toISOString().slice(0,10)) + 'T00:00:00');
    if(Number.isNaN(birth.getTime()) || Number.isNaN(travel.getTime())) return null;
    let age = travel.getFullYear() - birth.getFullYear();
    const m = travel.getMonth() - birth.getMonth();
    if(m < 0 || (m === 0 && travel.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  }

  function collectTravellers(form){
    return passengerMetas().map(function(m){
      const i = m.index;
      const title = form.querySelector(`[name="title_${i}"]`)?.value || '';
      const firstName = form.querySelector(`[name="firstName_${i}"]`)?.value || '';
      const lastName = form.querySelector(`[name="lastName_${i}"]`)?.value || '';
      const nationality = form.querySelector(`[name="nationality_${i}"]`)?.value || '';
      const dob = getDate3(form, `dob_${i}`).value;
      const obj = { passengerType:m.type, type:m.type, title, firstName, lastName, nationality, dob, ti:title, pt:String(m.type||'Adult').toUpperCase(), fN:firstName, lN:lastName };
      if(dob){
        obj.dateOfBirth = dob;
        const age = travellerAgeFromDob(dob);
        if(age !== null) obj.age = age;
      }
      const pno = String(form.querySelector(`[name="passportNumber_${i}"]`)?.value || '').trim();
      if(pno){
        const issueCountry = form.querySelector(`[name="passportIssueCountry_${i}"]`)?.value || '';
        const issue = getDate3(form, `passportIssue_${i}`).value;
        const expiry = getDate3(form, `passportExpiry_${i}`).value;
        obj.passportNumber = pno; obj.passportIssuingCountry = issueCountry; obj.passportIssueCountry = issueCountry; obj.passportIssueDate = issue; obj.passportExpiry = expiry; obj.pNum = pno; obj.eD = expiry; obj.pid = issue; obj.pNat = nationality || issueCountry;
      }
      const pan = form.querySelector(`[name="pan_${i}"]`)?.value || ''; if(pan){ obj.pan = pan; obj.panNumber = pan; }
      return obj;
    });
  }

  function showValidation(message, el, error, alert){
    if(alert){ alert.hidden = true; alert.textContent = ''; alert.style.display = 'none'; }
    if(error){ error.textContent = ''; error.style.display = 'none'; }
    if(el) markFieldError(el, message || 'This field is required.');
    if(el && el.focus) setTimeout(function(){ try{ el.focus({preventScroll:true}); }catch(e){ el.focus(); } }, 120);
  }

  function loadRazorpayScript(){
    return new Promise(function(resolve, reject){
      if(window.Razorpay){ resolve(); return; }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
      document.head.appendChild(s);
    });
  }

  
  function tyReadJsonStorage(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }

  function tyFirebaseStoredUser(){
    try{
      const keys = Object.keys(localStorage || {});
      for(const key of keys){
        if(!/^firebase:authUser:/i.test(key)) continue;
        const user = tyReadJsonStorage(key);
        if(user && (user.uid || user.email || user.phoneNumber)){
          return user;
        }
      }
    }catch(e){}
    return null;
  }

  function tyRecognizedLoggedInUser(){
    try{
      /* A Firebase identity alone is not a TravelYaraa login. Every protected
         API needs the backend authToken, so without it treat the user as
         logged out and let the existing login panel run. */
      if(!tyGuestAuthToken()) return null;

      if(window.tyCurrentFirebaseUser && (window.tyCurrentFirebaseUser.uid || window.tyCurrentFirebaseUser.email || window.tyCurrentFirebaseUser.phoneNumber)){
        return {
          uid: window.tyCurrentFirebaseUser.uid || "",
          userId: window.tyCurrentFirebaseUser.uid || "",
          email: window.tyCurrentFirebaseUser.email || "",
          phone: window.tyCurrentFirebaseUser.phoneNumber || "",
          name: window.tyCurrentFirebaseUser.displayName || "",
          source: "window.tyCurrentFirebaseUser"
        };
      }

      if(window.auth && window.auth.currentUser && (window.auth.currentUser.uid || window.auth.currentUser.email || window.auth.currentUser.phoneNumber)){
        return {
          uid: window.auth.currentUser.uid || "",
          userId: window.auth.currentUser.uid || "",
          email: window.auth.currentUser.email || "",
          phone: window.auth.currentUser.phoneNumber || "",
          name: window.auth.currentUser.displayName || "",
          source: "window.auth.currentUser"
        };
      }

      const flag = String(localStorage.getItem("tyUserLoggedIn") || "").toLowerCase();

      const storedProfile = tyReadJsonStorage("ty_user_profile");
      if(storedProfile && (storedProfile.userId || storedProfile.uid || flag === "true")){
        return Object.assign({source:"ty_user_profile"}, storedProfile, {
          userId: storedProfile.userId || storedProfile.uid || "",
          phone: storedProfile.phone || storedProfile.phoneNumber || ""
        });
      }

      const travelUser = tyReadJsonStorage("travelYaraaUser");
      if(travelUser && (flag === "true" || travelUser.userId || travelUser.uid)){
        return Object.assign({source:"travelYaraaUser"}, travelUser, {
          userId: travelUser.userId || travelUser.uid || "",
          phone: travelUser.phone || travelUser.phoneNumber || ""
        });
      }

      const firebaseUser = tyFirebaseStoredUser();
      if(firebaseUser){
        return {
          uid: firebaseUser.uid || "",
          userId: firebaseUser.uid || "",
          email: firebaseUser.email || "",
          phone: firebaseUser.phoneNumber || firebaseUser.phone || "",
          name: firebaseUser.displayName || "",
          source: "firebaseLocalStorage"
        };
      }
    }catch(e){}
    return null;
  }

  function tySyncLoggedInUserForBooking(payload){
    const user = tyRecognizedLoggedInUser();
    if(!user) return null;

    payload.passenger = Object.assign({}, payload.passenger || {});
    if(!payload.passenger.email && user.email) payload.passenger.email = user.email;
    if(!payload.passenger.mobile && (user.phone || user.phoneNumber)) payload.passenger.mobile = user.phone || user.phoneNumber;
    payload.user = Object.assign({}, payload.user || {}, user);
    payload.userId = payload.userId || user.userId || user.uid || "";
    payload.authenticated = true;
    payload.loginSource = user.source || "existing-login";

    try{
      localStorage.setItem("ty_user_profile", JSON.stringify(user));
    }catch(e){}

    return user;
  }

  function tyGuestAuthToken(){
    try{
      return localStorage.getItem("ty_user_auth_token") || "";
    }catch(e){ return ""; }
  }

  function tyGuestAuthHeaders(){
    const token = tyGuestAuthToken();
    return token ? {"Authorization":"Bearer " + token} : {};
  }

  function tyIsAuthRequiredError(error){
    if(!error) return false;
    if(Number(error.status) === 401) return true;
    if(String(error.code || '') === 'AUTH_REQUIRED') return true;
    return /please log in|auth[_ ]required/i.test(String(error.message || ''));
  }

  function tyGuestEmail(payload){
    return payload?.passenger?.email || payload?.details?.contact?.email || payload?.details?.email || payload?.email || "";
  }

  function tyGuestPhone(payload){
    return payload?.passenger?.mobile || payload?.passenger?.mobileFull || payload?.details?.contact?.phone || payload?.details?.phone || payload?.phone || "";
  }

  /* Payment popup uses the shared Firebase module only. No second initializeApp. */
  async function tyAwaitSharedFirebaseAuth(){
    if(!window.tyFirebaseAuthReady){
      throw new Error("Login module could not be loaded. Please refresh the page and try again.");
    }
    await window.tyFirebaseAuthReady;
    if(typeof window.tySyncFirebaseUserWithBackend !== "function"){
      throw new Error("Login module is outdated in your browser. Please reload the page to continue.");
    }
  }

  async function tyFirebaseSocialLogin(providerName, payload){
    await tyAwaitSharedFirebaseAuth();
    const provider = String(providerName || "google").toLowerCase();
    let data;

    if(provider === "google"){
      if(typeof window.tyGoogleLogin !== "function"){
        throw new Error("Login module is outdated in your browser. Please reload the page to continue.");
      }
      data = await window.tyGoogleLogin({provider:"google", service:"flight"});
    }else if(provider === "facebook"){
      const authMod = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");
      if(!window.auth) throw new Error("Login module could not be loaded. Please refresh the page and try again.");
      const fbProvider = new authMod.FacebookAuthProvider();
      if(fbProvider.setCustomParameters) fbProvider.setCustomParameters({prompt:"select_account"});
      const credential = await authMod.signInWithPopup(window.auth, fbProvider);
      const fbUser = credential && credential.user;
      if(!fbUser) throw new Error("Social login did not return a user.");
      data = await window.tySyncFirebaseUserWithBackend(fbUser, {provider:"facebook", service:"flight"});
    }else{
      throw new Error("Unsupported login provider.");
    }

    if(!data || !data.authToken){
      throw new Error("TravelYaraa login token was not returned by backend.");
    }

    const profile = data.user || {};
    const email = profile.email || tyGuestEmail(payload);
    const phone = profile.phone || profile.phoneNumber || tyGuestPhone(payload);
    const name = profile.name || profile.displayName || [payload?.passenger?.title, payload?.passenger?.firstName, payload?.passenger?.lastName].filter(Boolean).join(" ");
    payload.passenger = Object.assign({}, payload.passenger || {});
    if(email) payload.passenger.email = email;
    if(phone) payload.passenger.mobile = phone;
    if(name && !payload.passenger.firstName) payload.passenger.firstName = name;

    return Object.assign({authToken: data.authToken, user: profile}, data);
  }


  function tyGuestOtpModal(){
    let el = document.getElementById("tyFlightGuestOtpModal");
    if(el) return el;
    el = document.createElement("div");
    el.id = "tyFlightGuestOtpModal";
    el.innerHTML = '<div class="tygo-backdrop"></div><div class="tygo-sheet" role="dialog" aria-modal="true" aria-label="Login or Create account"><button class="tygo-close" type="button" aria-label="Close">×</button><h2>Login or Create an account</h2><p class="tygo-sub">Continue with your email id or mobile number. If your account does not exist, TravelYaraa will create it automatically after OTP verification.</p><label class="tygo-label">Enter Email Id / Mobile Number</label><div class="tygo-input-wrap"><span class="tygo-input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/><path d="M7 20h10"/></svg></span><input class="tygo-login-input" type="text" autocomplete="email tel" inputmode="email" placeholder="Enter your Email Id / Mobile no."></div><button class="tygo-primary" type="button">LOGIN</button><div class="tygo-otp-area" hidden><label class="tygo-label">Enter OTP</label><input class="tygo-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 digit OTP"><button class="tygo-link" type="button">Resend OTP</button></div><div class="tygo-or"><span></span><b>Or Login Via</b><span></span></div><div class="tygo-social-row"><button class="tygo-social tygo-google" type="button" aria-label="Continue with Google"><span class="tygo-g">G</span><em>Google</em></button><button class="tygo-social tygo-facebook" type="button" aria-label="Continue with Facebook"><span class="tygo-f">f</span><em>Facebook</em></button></div><p class="tygo-sent"></p><p class="tygo-msg"></p></div>';
    if(!document.getElementById("tyGuestOtpStyle")){
      const css = document.createElement("style");
      css.id = "tyGuestOtpStyle";
      css.textContent = '.tygo-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:999998}.tygo-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:999999;width:min(520px,100%);background:#fff;border-radius:24px 24px 0 0;padding:26px 24px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -18px 70px rgba(7,29,73,.25);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#071d49;box-sizing:border-box}.tygo-sheet *{box-sizing:border-box}.tygo-close{position:absolute;right:16px;top:14px;width:38px;height:38px;border-radius:50%;border:0;background:#071d49;color:#fff;font-size:28px;line-height:36px;font-weight:400}.tygo-sheet h2{margin:0 46px 22px 0;font-size:25px;line-height:1.12;font-weight:950;color:#111}.tygo-sub{display:none}.tygo-label{display:block;margin:0 0 10px;color:#222;font-weight:750;font-size:16px}.tygo-input-wrap{height:58px;border:1px solid #d8dce4;border-radius:14px;background:#fff;display:flex;align-items:center;gap:12px;padding:0 16px}.tygo-input-icon{width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:#111;flex:0 0 28px}.tygo-input-icon svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.tygo-login-input{border:0;outline:0;width:100%;height:100%;font-size:17px;font-weight:650;color:#111;min-width:0}.tygo-login-input::placeholder{color:#a8a8a8}.tygo-primary{width:100%;height:60px;border:0;border-radius:999px;background:linear-gradient(90deg,#2678ff,#4fd2ef);color:#fff;font-weight:900;font-size:18px;letter-spacing:.05em;margin-top:20px;box-shadow:0 14px 28px rgba(38,120,255,.20)}.tygo-primary:disabled{opacity:.65}.tygo-otp-area{margin-top:18px}.tygo-otp{width:100%;height:52px;border:1px solid #d8dce4;border-radius:14px;padding:0 14px;font-size:22px;font-weight:900;letter-spacing:8px;text-align:center;outline:0}.tygo-link{display:block;width:100%;border:0;background:#fff;color:#0062e3;font-size:15px;font-weight:900;margin-top:12px}.tygo-or{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;margin:22px 0 12px;color:#777;font-weight:650}.tygo-or span{height:1px;background:#ddd}.tygo-or b{font-size:14px;font-weight:650;white-space:nowrap}.tygo-social-row{display:flex;justify-content:center;gap:18px}.tygo-social{border:0;background:#fff;min-width:78px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#333;font-weight:700}.tygo-social span{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;box-shadow:0 2px 12px rgba(7,29,73,.13);font-weight:950;font-size:28px}.tygo-g{color:#ea4335}.tygo-f{color:#1877f2;font-family:Arial,sans-serif}.tygo-social em{font-style:normal;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:1px 10px;font-size:13px;color:#555}.tygo-sent{min-height:18px;margin:12px 0 0;color:#0062e3;font-size:13px;font-weight:850}.tygo-msg{min-height:18px;margin:8px 0 0;color:#b42318;font-size:13px;font-weight:850;line-height:1.3}@media(min-width:760px){.tygo-sheet{top:50%;bottom:auto;transform:translate(-50%,-50%);border-radius:24px;padding:28px}}';
      document.head.appendChild(css);
    }
    document.body.appendChild(el);
    return el;
  }

  function tyCloseGuestOtpModal(){
    const el = document.getElementById("tyFlightGuestOtpModal");
    if(el) el.remove();
  }

  async function tyGuestPost(path, body, token){
    const headers = Object.assign({"Content-Type":"application/json","Accept":"application/json"}, token ? {"Authorization":"Bearer "+token} : {});
    const cleanPath = String(path || "");
    const candidates = [cleanPath];

    /* Backward-compatible real API aliases; no guest identity is invented.
       It only avoids "API route not found" when Hostinger backend has mounted
       guest-auth under an older alias. */
    if(cleanPath === "/api/bookings/guest-auth/start-otp"){
      candidates.push("/api/bookings/guest-auth/send-otp", "/api/guest-auth/start-otp", "/api/auth/guest/start-otp");
    }
    if(cleanPath === "/api/bookings/guest-auth/verify-otp"){
      candidates.push("/api/guest-auth/verify-otp", "/api/auth/guest/verify-otp");
    }
    if(cleanPath === "/api/bookings/guest-auth/firebase-login"){
      candidates.push("/api/bookings/guest-auth/social-login", "/api/guest-auth/firebase-login", "/api/auth/firebase-login");
    }

    let lastMessage = "";
    for(const route of candidates){
      const res = await fetch(API_BASE + route, {method:"POST", headers, body:JSON.stringify(body), cache:"no-store"});
      const data = await res.json().catch(()=>({}));
      if(res.ok && data.success !== false) return data;
      lastMessage = data.message || data.error || ("HTTP " + res.status);
      if(res.status !== 404){
        const error = new Error(lastMessage);
        error.code = data.code || '';
        throw error;
      }
    }
    throw new Error(lastMessage || "API route not found");
  }

  async function tyStartGuestOtp(payload){
    const body = Object.assign({}, payload || {}, {
      service:"flight",
      email: tyGuestEmail(payload),
      phone: tyGuestPhone(payload),
      name: [payload?.passenger?.title, payload?.passenger?.firstName, payload?.passenger?.lastName].filter(Boolean).join(" "),
      payload
    });
    if(!body.email && !body.phone) throw new Error("Please enter email or mobile number before payment.");
    const data = await tyGuestPost("/api/bookings/guest-auth/start-otp", body);
    sessionStorage.setItem("ty_last_guest_otp", JSON.stringify({otpSessionId:data.otpSessionId, guestSessionId:data.guestSessionId, payload}));
    return data;
  }

  async function tyVerifyGuestOtp(otp){
    const saved = JSON.parse(sessionStorage.getItem("ty_last_guest_otp") || "{}");
    const data = await tyGuestPost("/api/bookings/guest-auth/verify-otp", {otpSessionId:saved.otpSessionId, guestSessionId:saved.guestSessionId, otp});
    if(data.authToken){
      localStorage.setItem("ty_user_auth_token", data.authToken);
      localStorage.setItem("ty_guest_otp_verified_at", String(Date.now()));
    }
    if(data.user){
      localStorage.setItem("ty_user_profile", JSON.stringify(data.user));
      localStorage.setItem("travelYaraaUser", JSON.stringify(data.user));
      localStorage.setItem("tyUserLoggedIn", "true");
    }
    return data;
  }

  function tyLoginErrorText(error){
    const text = String((error && error.message) || '').trim();
    const code = String((error && error.code) || '').trim();
    if(text && code && !text.includes(code)) return text + ' (' + code + ')';
    return text || code || 'Login could not be completed. Please try again.';
  }

  async function requireGuestOtpBeforePayment(payload, msg){
    const existingUser = tyGuestAuthToken() ? tySyncLoggedInUserForBooking(payload) : null;
    if(existingUser && tyGuestAuthToken()){
      return {authToken:tyGuestAuthToken(), user:existingUser, reused:true};
    }

    const existingToken = tyGuestAuthToken();
    if(existingToken){
      const user = JSON.parse(localStorage.getItem("ty_user_profile") || localStorage.getItem("travelYaraaUser") || "{}");
      if(user && (user.userId || user.uid || user.email || user.phone)){
        tySyncLoggedInUserForBooking(payload);
        return {authToken:existingToken, user, reused:true};
      }
    }

    const el = tyGuestOtpModal();
    const loginInput = el.querySelector(".tygo-login-input");
    const otpArea = el.querySelector(".tygo-otp-area");
    const otpInput = el.querySelector(".tygo-otp");
    const sentBox = el.querySelector(".tygo-sent");
    const message = el.querySelector(".tygo-msg");
    const primary = el.querySelector(".tygo-primary");
    const resend = el.querySelector(".tygo-link");
    const googleBtn = el.querySelector(".tygo-google");
    const facebookBtn = el.querySelector(".tygo-facebook");

    const existingEmail = tyGuestEmail(payload) || '';
    const existingPhone = tyGuestPhone(payload) || '';
    loginInput.value = existingEmail || existingPhone || '';

    return await new Promise(function(resolve, reject){
      let active = true;
      let otpSent = false;

      function finish(v){ if(!active) return; active=false; tyCloseGuestOtpModal(); resolve(v); }
      function fail(e){ if(!active) return; active=false; tyCloseGuestOtpModal(); reject(e); }

      function syncContactFromInput(){
        const value = String(loginInput.value || '').trim();
        payload.passenger = Object.assign({}, payload.passenger || {});
        if(value.includes("@")){
          payload.passenger.email = value;
          payload.passenger.mobile = payload.passenger.mobile || existingPhone || "";
        }else{
          payload.passenger.mobile = value.replace(/\s+/g, "");
          payload.passenger.email = payload.passenger.email || existingEmail || "";
        }
        return value;
      }

      async function socialNow(provider){
        try{
          message.textContent = "Opening " + (provider === "facebook" ? "Facebook" : "Google") + " login...";
          if(provider === "facebook") facebookBtn.disabled = true; else googleBtn.disabled = true;
          const ok = await tyFirebaseSocialLogin(provider, payload);
          message.textContent = "Login successful. Continuing payment...";
          finish(ok);
        }catch(e){
          message.textContent = tyLoginErrorText(e);
          if(msg){ msg.classList.add("error"); msg.textContent = message.textContent; }
        }finally{
          if(provider === "facebook") facebookBtn.disabled = false; else googleBtn.disabled = false;
        }
      }

      async function sendOtpNow(){
        const value = syncContactFromInput();
        if(!value){
          message.textContent = "Enter mobile number or use Google/Facebook login.";
          return;
        }

        /* Email/Gmail should not use OTP in booking payment popup.
           If user enters an email and clicks LOGIN, open Google account selector directly.
           Mobile number continues with OTP. */
        if(value.includes("@")){
          await socialNow("google");
          return;
        }

        try{
          primary.disabled = true;
          message.textContent = "Sending OTP...";
          if(msg) msg.textContent = "Sending OTP to verify mobile...";
          const sent = await tyStartGuestOtp(payload);
          otpSent = true;
          otpArea.hidden = false;
          primary.textContent = "VERIFY & CONTINUE";
          sentBox.textContent = "OTP sent" + ((sent.sent || []).length ? " to " + (sent.sent || []).map(x=>x.to).join(", ") : ".");
          message.textContent = "";
          otpInput.value = "";
          setTimeout(()=>otpInput.focus(), 60);
        }catch(e){
          message.textContent = (e && e.message) ? e.message : "OTP could not be sent. Please check backend guest-auth route / SMS settings.";
          if(msg){ msg.classList.add("error"); msg.textContent = message.textContent; }
        }finally{
          primary.disabled = false;
        }
      }

      async function verifyOtpNow(){
        try{
          primary.disabled = true;
          message.textContent = "Verifying OTP...";
          const ok = await tyVerifyGuestOtp(otpInput.value);
          finish(ok);
        }catch(e){
          message.textContent = (e && e.message) ? e.message : "Invalid OTP.";
        }finally{
          primary.disabled = false;
        }
      }

      el.querySelector(".tygo-close").onclick = function(){ fail(new Error("Login verification cancelled.")); };
      primary.onclick = async function(){ otpSent ? await verifyOtpNow() : await sendOtpNow(); };
      resend.onclick = async function(){ await sendOtpNow(); };
      googleBtn.onclick = async function(){ await socialNow("google"); };
      facebookBtn.onclick = async function(){ await socialNow("facebook"); };
      loginInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); primary.click(); }});
      otpInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); primary.click(); }});
      setTimeout(()=>loginInput.focus(), 60);
    });
  }

  function tyPaymentReviewRawFromPayload(payload){
    payload = payload || {};
    const selected = payload.selectedFlight || (Array.isArray(payload.selectedFlights) ? payload.selectedFlights[0] : null) || payload.selectedResult || {};
    const sources = [
      payload.tripjackReviewRaw,
      payload.reviewRaw,
      payload.review && payload.review.raw,
      selected.reviewRaw,
      selected._reviewRaw,
      selected.reviewData && (selected.reviewData.raw || selected.reviewData.data && selected.reviewData.data.raw || selected.reviewData.response || selected.reviewData.result || selected.reviewData),
      selected._reviewData && (selected._reviewData.raw || selected._reviewData.data && selected._reviewData.data.raw || selected._reviewData.response || selected._reviewData.result || selected._reviewData),
      selected.raw && (selected.raw.reviewRaw || selected.raw.rawReview || selected.raw.reviewData || selected.raw)
    ];
    for(const src of sources){
      if(src && typeof src === 'object') return src;
    }
    return null;
  }

  function newClientRequestId(){
    try{
      if(window.crypto && typeof window.crypto.randomUUID === 'function') return 'TYREQ-' + window.crypto.randomUUID();
    }catch(_e){}
    return 'TYREQ-' + Date.now() + '-' + Math.random().toString(36).slice(2,12);
  }

  async function createPaymentOrder(fare, bookingPayload){
    const selectedAddOnsList = selectedAddOnsArray();
    const paymentReviewRaw = tyPaymentReviewRawFromPayload(bookingPayload);
    const details = {
      contact: {
        email: bookingPayload.passenger && bookingPayload.passenger.email,
        phone: bookingPayload.passenger && bookingPayload.passenger.mobile,
        countryCode: bookingPayload.passenger && bookingPayload.passenger.mobileCountryCode
      },
      passengers: bookingPayload.travellers || [],
      travelInsurance: bookingPayload.travelInsurance || null,
      addons: selectedAddOnsList,
      addonsTotal: Number(fare.addOnTotal || 0) || 0,
      email: bookingPayload.passenger && bookingPayload.passenger.email,
      phone: bookingPayload.passenger && bookingPayload.passenger.mobile,
      searchPayload: bookingPayload.search || {},
      tripjackReviewRaw: paymentReviewRaw || null,
      reviewRaw: paymentReviewRaw || null,
      clientRequestId: bookingPayload.clientRequestId
    };
    const body = {
      service: 'flight',
      clientRequestId: bookingPayload.clientRequestId,
      selectedResult: bookingPayload.selectedFlight || bookingPayload.selectedFlights && bookingPayload.selectedFlights[0] || {},
      details,
      search: bookingPayload.search || {},
      offer: bookingPayload.offer || null,
      offerCode: bookingPayload.offer && (bookingPayload.offer.code || bookingPayload.offer.offerCode) || '',
      tripjackReviewRaw: paymentReviewRaw || null,
      reviewRaw: paymentReviewRaw || null
    };
    const response = await fetch(API_BASE + '/api/bookings/create-payment-order', {
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json','Accept':'application/json'}, tyGuestAuthHeaders()),
      body:JSON.stringify(body),
      cache:'no-store'
    });
    const data = await response.json().catch(()=>({}));
    if(!response.ok || !data || data.success === false){
      const error = new Error(data.message || data.error || ('HTTP ' + response.status));
      error.status = response.status;
      error.code = data.code || '';
      throw error;
    }
    return data;
  }

  async function verifyPayment(response, bookingPayload){
    const verifyResponse = await fetch(API_BASE + '/api/bookings/verify-payment', {
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json','Accept':'application/json'}, tyGuestAuthHeaders()),
      body:JSON.stringify({
        bookingId: bookingPayload.bookingId,
        payment: {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        }
      }),
      cache:'no-store'
    });
    const data = await verifyResponse.json().catch(()=>({}));
    if(!verifyResponse.ok || !data || data.success === false){
      throw new Error(data.message || data.error || ('HTTP ' + verifyResponse.status));
    }
    return data;
  }

  function showSecurePaymentOverlay(){
    let el = document.getElementById('tySecurePaymentOverlay');
    if(!el){
      el = document.createElement('div');
      el.id = 'tySecurePaymentOverlay';
      el.className = 'ty-secure-payment-screen';
      document.body.appendChild(el);
    }
    el.innerHTML = '<div class="ty-secure-payment-box" role="status" aria-label="Processing"><div class="ty-secure-spinner"></div></div>';
    el.style.display = 'flex';
  }

  function hideSecurePaymentOverlay(){
    const el = document.getElementById('tySecurePaymentOverlay');
    if(el) el.style.display = 'none';
  }


  function statusDeepValue(obj, keys){
    const wanted = (keys || []).map(k=>String(k).toLowerCase());
    const seen = new Set();
    function walk(v){
      if(v === undefined || v === null) return '';
      if(typeof v !== 'object') return '';
      if(seen.has(v)) return '';
      seen.add(v);
      for(const k of Object.keys(v)){
        if(wanted.includes(String(k).toLowerCase())){
          const val = v[k];
          if(val !== undefined && val !== null && String(val).trim() !== '') return val;
        }
      }
      for(const k of Object.keys(v)){
        const val = walk(v[k]);
        if(val !== undefined && val !== null && String(val).trim() !== '') return val;
      }
      return '';
    }
    return walk(obj);
  }


  function airlineWebsiteMap(){
    return {
      AI:'https://www.airindia.com', IX:'https://www.airindiaexpress.com', I5:'https://www.airindia.com', UK:'https://www.airindia.com',
      '6E':'https://www.goindigo.in', SG:'https://www.spicejet.com', QP:'https://www.akasaair.com',
      JL:'https://www.jal.co.jp', NH:'https://www.ana.co.jp', SQ:'https://www.singaporeair.com', CX:'https://www.cathaypacific.com',
      HX:'https://www.hkairlines.com', EK:'https://www.emirates.com', QR:'https://www.qatarairways.com', EY:'https://www.etihad.com',
      WY:'https://www.omanair.com', GF:'https://www.gulfair.com', KU:'https://www.kuwaitairways.com',
      MH:'https://www.malaysiaairlines.com', TG:'https://www.thaiairways.com', VN:'https://www.vietnamairlines.com',
      LH:'https://www.lufthansa.com', BA:'https://www.britishairways.com', AF:'https://www.airfrance.com', KL:'https://www.klm.com',
      TK:'https://www.turkishairlines.com', VS:'https://www.virginatlantic.com',
      UA:'https://www.united.com', DL:'https://www.delta.com', AA:'https://www.aa.com', AC:'https://www.aircanada.com',
      KE:'https://www.koreanair.com', OZ:'https://flyasiana.com', QF:'https://www.qantas.com'
    };
  }
  function airlineWebsiteFromFlight(f){
    f=f||{};
    const direct = f.airlineWebsite || f.website || f.airlineUrl || f.raw?.airlineWebsite || f.raw?.website || '';
    if(direct && /^https?:\/\//i.test(String(direct))) return String(direct);
    const code = String(f.airlineCode || (f.flightCode||'').split(/\s+/)[0] || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const map = airlineWebsiteMap();
    if(code && map[code]) return map[code];
    const name = String(f.airlineName || '').toLowerCase();
    const byName = [
      [/air india express/, map.IX], [/air india|vistara/, map.AI], [/indigo/, map['6E']], [/spicejet/, map.SG], [/akasa/, map.QP],
      [/japan airlines/, map.JL], [/ana|all nippon/, map.NH], [/singapore airlines/, map.SQ], [/cathay/, map.CX], [/hong kong airlines/, map.HX],
      [/emirates/, map.EK], [/qatar/, map.QR], [/etihad/, map.EY], [/lufthansa/, map.LH], [/british airways/, map.BA],
      [/air france/, map.AF], [/klm/, map.KL], [/turkish/, map.TK], [/malaysia/, map.MH], [/thai/, map.TG]
    ];
    for(const row of byName){ if(row[0].test(name)) return row[1]; }
    return '';
  }
  function airlineWebsiteFromStatus(booking, flights){
    const list = (flights && flights.length ? flights : []).concat((booking && booking.selectedFlights) || [], booking && booking.selectedResult ? [booking.selectedResult] : []);
    for(const f of list){
      const url = airlineWebsiteFromFlight(f);
      if(url) return url;
    }
    return '';
  }


  function statusBookingObject(responseData, bookingPayload){
    return (responseData && (responseData.booking || responseData.data && responseData.data.booking || responseData.bookingData)) || bookingPayload || {};
  }

  function statusValueFrom(booking, responseData, fallback){
    return String(
      responseData && (responseData.bookingStatus || responseData.status || responseData.paymentStatus) ||
      booking && (booking.bookingStatus || booking.status || booking.orderStatus || booking.tripjackStatus) ||
      fallback || 'PENDING'
    ).toUpperCase();
  }

  function customerStatusLabel(raw){
    const s = String(raw || '').toUpperCase();
    if(/SUPPLIER_BOOKING_FAILED|TICKET_FAILED|REFUND_REQUIRED|UNCONFIRMED/.test(s)) return 'Unsuccessful';
    if(/PAYMENT_FAILED|DECLINED|FAILED|ERROR|ABORTED/.test(s)) return 'Failed';
    if(/HOLD|PENDING|PROCESS|PNR_PENDING|PAYMENT_PENDING/.test(s)) return 'Pending';
    if(/PAYMENT_CANCELLED/.test(s)) return 'Cancelled';
    if(/CANCEL|REFUND/.test(s)) return 'Cancelled';
    if(/CONFIRM|SUCCESS|PAID|BOOKED|TICKETED|COMPLETED/.test(s)) return 'Confirmed';
    return 'Pending';
  }

  function statusMeta(raw){
    const s = String(raw || '').toUpperCase();
    if(/SUPPLIER_BOOKING_FAILED|REFUND_REQUIRED|TICKET_FAILED|UNCONFIRMED/.test(s)) return {kind:'failed', title:'Booking unsuccessful', badge:'Unsuccessful', note:'Ticketing could not be completed. If any amount was charged, refund handling follows your TravelYaraa booking record. Contact support if you need help.'};
    if(/PAYMENT_FAILED|DECLINED|FAILED|ERROR|ABORTED/.test(s)) return {kind:'failed', title:'Booking failed', badge:'Failed', note:'This booking could not be completed. If any amount was charged, please contact TravelYaraa support with your Booking ID.'};
    if(/PAYMENT_CANCELLED/.test(s)) return {kind:'cancelled', title:'Payment cancelled', badge:'Cancelled', note:'Payment was not completed for this booking.'};
    if(/CANCEL|REFUND/.test(s)) return {kind:'cancelled', title:'Booking cancelled', badge:'Cancelled', note:'Cancellation and refund details below are from your latest TravelYaraa booking record.'};
    if(/HOLD|PENDING|PROCESS|PNR_PENDING|PAYMENT_PENDING|SUPPLIER_BOOKING_IN_PROGRESS/.test(s)) return {kind:'hold', title:'Booking pending', badge:'Pending', note:'We are confirming your booking with the airline. Ticket actions appear only after confirmation.'};
    if(/CONFIRM|SUCCESS|PAID|COMPLETED|TICKETED|BOOKED/.test(s)) return {kind:'ok', title:'Booking confirmed', badge:'Confirmed', note:'Your booking is confirmed. Use the details below for travel and support.'};
    return {kind:'hold', title:'Booking status', badge:customerStatusLabel(s), note:'Latest booking status is shown below. Refresh to check for updates.'};
  }

  function statusBookingId(booking, responseData){
    return (responseData && (responseData.bookingId || responseData.id)) || booking.bookingId || booking.id || 'Pending';
  }

  function statusPresentText(value){
    const text = String(value == null ? '' : value).trim();
    if(!text || /^pending$/i.test(text) || text === '-' || text === 'N/A') return '';
    return text;
  }

  function pnrValue(booking){
    return statusPresentText(statusDeepValue(booking, ['pnr','airlinePnr','airlinePNR','gdsPnr','gdsPNR','pnrDetails'])) || 'Pending';
  }

  function ticketValue(booking){
    return statusPresentText(statusDeepValue(booking, ['ticketNumber','ticketNo','ticketNum','ticketNumberDetails','tktNo'])) || 'Pending';
  }

  function bookingReferenceValue(booking, responseData){
    const fromBooking = statusPresentText(statusDeepValue(booking, [
      'bookingReference','bookingRef','orderId','supplierBookingId','airlineBookingId','confirmationId','bookingConfirmationId'
    ]));
    const fromResponse = statusPresentText(
      responseData && (responseData.bookingReference || responseData.bookingRef || responseData.supplierBookingId || responseData.orderId)
    );
    const value = fromBooking || fromResponse;
    const bookingId = String(statusBookingId(booking, responseData) || '').trim();
    if(!value || value === bookingId) return '';
    return value;
  }

  function paymentIdValue(booking, responseData){
    return statusPresentText(
      (booking.payment && (booking.payment.razorpay_payment_id || booking.payment.paymentId || booking.payment.id)) ||
      booking.razorpayPaymentId ||
      statusDeepValue(booking, ['razorpay_payment_id','paymentId']) ||
      (responseData && (responseData.paymentId || responseData.razorpay_payment_id || (responseData.payment && (responseData.payment.paymentId || responseData.payment.id))))
    );
  }

  function paymentStatusValue(booking, responseData){
    const raw = statusPresentText(
      (responseData && (responseData.paymentStatus || (responseData.payment && responseData.payment.status))) ||
      booking.paymentStatus ||
      (booking.payment && booking.payment.status)
    );
    if(!raw) return '';
    return customerStatusLabel(raw);
  }

  function paidAmountDisplay(booking, responseData){
    const raw =
      statusDeepValue(booking, ['paidAmount','amountPaid','totalPaid','totalAmount','amount','fare','finalAmount']) ||
      (booking.payment && (booking.payment.paidAmount || booking.payment.amount || booking.payment.totalAmount)) ||
      (responseData && (responseData.paidAmount || responseData.amountPaid || responseData.totalAmount || responseData.amount));
    const n = Number(raw);
    if(!Number.isFinite(n) || n <= 0) return '';
    return money(n);
  }

  function travellerName(t){
    return [t.title || t.ti, t.firstName || t.fN, t.lastName || t.lN].filter(Boolean).join(' ').trim() || 'Traveller';
  }

  function statusContact(booking, bookingPayload){
    const details = booking.details || bookingPayload && bookingPayload.passenger || {};
    const first = Array.isArray(booking.details && booking.details.passengers) ? booking.details.passengers[0] : null;
    return {
      name: [details.title || details.ti || first && (first.title || first.ti), details.firstName || details.fN || first && (first.firstName || first.fN), details.lastName || details.lN || first && (first.lastName || first.lN)].filter(Boolean).join(' ') || travellerName(first || {}),
      email: details.contactEmail || details.email || booking.user && booking.user.email || '',
      phone: details.mobileFull || details.contactPhone || details.phone || booking.user && booking.user.phone || ''
    };
  }

  function statusKv(label, value, copy){
    const val = value || 'Pending';
    return `<div class="ty-final-kv"><span>${esc(label)}</span><b>${esc(val)}</b>${copy && val !== 'Pending' ? `<button type="button" data-copy="${esc(val)}">Copy</button>` : ''}</div>`;
  }

  function statusKvIf(label, value, copy){
    const val = statusPresentText(value);
    if(!val) return '';
    return statusKv(label, val, copy);
  }

  function statusBaggageSummaryHtml(flights){
    const rows = baggageRowsForPolicy(flights || []);
    if(!rows.length) return '';
    const body = rows.map(function(r){
      return `<div class="ty-final-passenger"><span>${esc(r.route || 'Flight')}</span><b>${esc([r.cabin ? ('Cabin ' + r.cabin) : '', r.checkin ? ('Check-in ' + r.checkin) : ''].filter(Boolean).join(' · ') || '-')}</b></div>`;
    }).join('');
    return `<article class="ty-final-card"><h2 class="ty-final-card-title">Baggage summary</h2><div class="ty-final-card-body ty-final-passengers">${body}</div></article>`;
  }

  function statusRefundDetailsHtml(booking, responseData){
    const source = responseData || booking || {};
    const refund = statusDeepValue(source, ['refundAmount','refundableAmount','refund','netRefund']) ||
      statusDeepValue(booking, ['refundAmount','refundableAmount','refund','netRefund']) ||
      (booking.refund && (booking.refund.amount || booking.refund.refundAmount));
    const charge = statusDeepValue(source, ['cancellationCharge','cancellationCharges','cancelCharge']) ||
      statusDeepValue(booking, ['cancellationCharge','cancellationCharges','cancelCharge']);
    const refundStatus = statusPresentText(
      responseData && (responseData.refundStatus || responseData.cancellationStatus) ||
      booking.refundStatus || booking.cancellationStatus || (booking.refund && booking.refund.status)
    );
    const note = statusPresentText(
      (responseData && (responseData.refundMessage || responseData.cancellationMessage || responseData.message)) ||
      booking.refundMessage || booking.cancellationMessage
    );
    const rows = [
      statusKvIf('Refund status', refundStatus ? customerStatusLabel(refundStatus) : ''),
      statusKvIf('Cancellation charge', (charge !== '' && typeof charge !== 'object') ? String(charge) : ''),
      statusKvIf('Refund amount', (refund !== '' && typeof refund !== 'object') ? String(refund) : ''),
      statusKvIf('Notes', note && !tyLooksTechnicalCustomerError(note) ? note : '')
    ].join('');
    if(!rows) return '';
    return `<article class="ty-final-card"><h2 class="ty-final-card-title">Cancellation & refund</h2><div class="ty-final-card-body ty-final-reference-grid">${rows}</div></article>`;
  }

  function ensureBookingStatusStyles(){
    if(document.getElementById('tyBookingStatusFinalStyles')) return;
    const style = document.createElement('style');
    style.id = 'tyBookingStatusFinalStyles';
    style.textContent = `
      .ty-final-status{min-height:100vh;background:#f3f5f7;padding:18px 12px 56px;font-family:Inter,Roboto,Arial,sans-serif;color:#071d49}
      .ty-final-status-shell{max-width:1020px;margin:0 auto;display:grid;gap:14px}
      .ty-final-status-hero{border-radius:16px;background:#fff;padding:20px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-shadow:0 5px 20px rgba(7,29,73,.08);border-top:5px solid #f59e0b}
      .ty-final-status-hero.ok{border-top-color:#16a34a}.ty-final-status-hero.failed{border-top-color:#dc2626}.ty-final-status-hero.cancelled{border-top-color:#64748b}.ty-final-status-hero.hold{border-top-color:#f59e0b}
      .ty-final-status-hero h1{font-size:25px;margin:4px 0 7px;color:#071d49}.ty-final-status-hero p{margin:0;color:#556274;font-size:14px;line-height:1.55;max-width:720px}
      .ty-final-status-badge{white-space:nowrap;border-radius:999px;padding:9px 14px;background:#fff7dd;color:#8a5a00;font-weight:900;font-size:13px}
      .ty-final-status-hero.ok .ty-final-status-badge{background:#e8f8ed;color:#137333}.ty-final-status-hero.failed .ty-final-status-badge{background:#fff0f0;color:#b42318}.ty-final-status-hero.cancelled .ty-final-status-badge{background:#edf1f5;color:#475569}
      .ty-final-card{background:#fff;border-radius:16px;box-shadow:0 5px 20px rgba(7,29,73,.07);overflow:hidden}
      .ty-final-card-title{margin:0;padding:14px 17px;background:#eaf5ff;font-size:17px;font-weight:950}
      .ty-final-card-body{padding:15px 17px}.ty-final-reference-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
      .ty-final-kv{display:flex;flex-direction:column;gap:4px;padding:10px 0;border-bottom:1px solid #edf1f5}.ty-final-kv:last-child{border-bottom:0}.ty-final-kv span{color:#64748b;font-size:12px;font-weight:800}.ty-final-kv b{font-size:14px;word-break:break-word}.ty-final-kv button{align-self:flex-start;margin-top:4px;border:0;background:#eaf5ff;color:#0062e3;border-radius:8px;padding:5px 10px;font-weight:900;cursor:pointer}
      .ty-final-passengers{display:grid;gap:9px}.ty-final-passenger{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #edf1f5;padding:10px 0}.ty-final-passenger:last-child{border-bottom:0}
      .ty-final-passenger span{color:#64748b;font-size:12px;font-weight:800}.ty-final-passenger b{font-size:14px;text-align:right}
      .ty-final-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:16px}
      .ty-final-action{min-height:48px;border-radius:11px;border:1px solid #d9e2ed;background:#fff;color:#071d49;font-size:14px;font-weight:950;padding:10px 14px;cursor:pointer}
      .ty-final-action.primary{background:#0062e3;border-color:#0062e3;color:#fff}.ty-final-action.orange{background:#eb814b;border-color:#eb814b;color:#fff}.ty-final-action.full{grid-column:1/-1}
      .ty-final-message{margin:0 16px 16px;padding:11px 13px;border-radius:9px;background:#edf6ff;color:#0b4f93;font-weight:800;font-size:13px}.ty-final-message.bad{background:#fff0f0;color:#b42318}
      @media(max-width:700px){.ty-final-status{padding:0 0 34px}.ty-final-status-shell{gap:10px}.ty-final-status-hero,.ty-final-card{border-radius:0}.ty-final-status-hero{padding:17px 14px}.ty-final-status-hero h1{font-size:21px}.ty-final-status-badge{font-size:11px;padding:7px 9px}.ty-final-reference-grid{grid-template-columns:1fr}.ty-final-card-body{padding:12px}.ty-final-actions{grid-template-columns:1fr;padding:12px}.ty-final-action.full{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function statusAction(label, attrs, variant){
    return `<button type="button" class="ty-final-action ${variant || ''}" ${attrs || ''}>${esc(label)}</button>`;
  }

  function statusSafeNavActions(includeRefresh){
    return (includeRefresh ? statusAction('Refresh status','data-refresh-status','primary') : '') +
      statusAction('My Bookings','data-my-bookings','') +
      statusAction('TravelYaraa support','data-contact-support','') +
      statusAction('New booking','data-new-booking','orange full');
  }

  function tySupportPageUrlForBooking(bookingId){
    const id = encodeURIComponent(String(bookingId || '').trim());
    return '/customer-support.html' + (id ? '?bookingId=' + id + '&service=flight&source=status' : '?service=flight&source=status');
  }

  async function statusPost(route, body){
    const res = await fetch(API_BASE + route, {method:'POST', headers:Object.assign({'Content-Type':'application/json'}, tyGuestAuthHeaders()), body:JSON.stringify(body || {}), cache:'no-store'});
    const data = await res.json().catch(()=>({}));
    if(!res.ok || data.success === false) throw new Error(tyCustomerFacingActionError(data.message || data.error || ('HTTP ' + res.status)));
    return data;
  }

  async function recordPaymentStatus(bookingId, status, failure){
    if(!bookingId) return {success:false, message:'Booking ID is missing.'};
    return statusPost('/api/bookings/' + encodeURIComponent(bookingId) + '/payment-status', {status, failure:failure || {}});
  }

  function statusFromPaymentVerifyResponse(responseData, fallback){
    const data = responseData || {};
    const booking = data.booking || data.bookingData || {};
    return String(data.bookingStatus || data.status || data.paymentStatus || booking.bookingStatus || booking.status || booking.paymentStatus || fallback || '').trim() || fallback || '';
  }

  function uniqueTravellersForStatus(list){
    const rows = Array.isArray(list) ? list : [];
    const seen = new Set();
    return rows.filter(function(traveller){
      if(!traveller || typeof traveller !== 'object') return false;
      const name = travellerName(traveller).toLowerCase();
      const type = String(traveller.passengerType || traveller.type || traveller.pt || 'adult').toLowerCase();
      const key = name + '|' + type;
      if(!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function statusGet(route){
    const res = await fetch(API_BASE + route, {headers:tyGuestAuthHeaders(), cache:'no-store'});
    const data = await res.json().catch(()=>({}));
    if(!res.ok || data.success === false) throw new Error(tyCustomerFacingActionError(data.message || data.error || ('HTTP ' + res.status), 'We could not load this booking right now. Please try again.'));
    return data;
  }

  async function downloadBookingFile(route, filename){
    const response = await fetch(API_BASE + route, {headers:tyGuestAuthHeaders(), cache:'no-store'});
    if(!response.ok){
      const data = await response.json().catch(()=>({}));
      throw new Error(tyCustomerFacingActionError(data.message || data.error || ('HTTP ' + response.status), 'Download failed. Please try again.'));
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'TravelYaraa-document.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function setFinalStatusMessage(message, bad){
    const node = ROOT.querySelector('#tyFinalStatusMessage');
    if(!node) return;
    const text = bad ? tyCustomerFacingActionError(message, message || 'Something went wrong. Please try again.') : String(message || '');
    node.textContent = text;
    node.hidden = !text;
    node.classList.toggle('bad', !!bad);
  }

  function statusCancellationSummary(data){
    const raw = data && (data.charges || data.policy || data);
    const currency = statusDeepValue(raw, ['currency','currencyCode','ccy']) || 'INR';
    const charge = statusDeepValue(raw, ['cancellationCharge','cancellationCharges','charge','charges','totalCharge','fee','fees','amount']);
    const refund = statusDeepValue(raw, ['refundAmount','refundableAmount','refund','netRefund']);
    const parts = [];
    if(charge !== '' && typeof charge !== 'object') parts.push('Cancellation charge: ' + currency + ' ' + charge);
    if(refund !== '' && typeof refund !== 'object') parts.push('Estimated refund: ' + currency + ' ' + refund);
    if(!parts.length && data && data.message && !tyLooksTechnicalCustomerError(data.message)) parts.push(String(data.message));
    return parts.join('\n') || 'Airline cancellation charges were received. Submit the cancellation request?';
  }

  let tyStatusPollTimer = null;
  let tyStatusPollCount = 0;

  function stopPendingStatusPoll(){
    if(tyStatusPollTimer){
      clearInterval(tyStatusPollTimer);
      tyStatusPollTimer = null;
    }
    tyStatusPollCount = 0;
  }

  function startPendingStatusPoll(bookingId, bookingPayload){
    stopPendingStatusPoll();
    const id = String(bookingId || '').trim();
    if(!id) return;
    tyStatusPollTimer = setInterval(async function(){
      tyStatusPollCount += 1;
      if(tyStatusPollCount > 5){
        stopPendingStatusPoll();
        return;
      }
      try{
        const data = await statusGet('/api/bookings/' + encodeURIComponent(id) + '/status');
        const booking = statusBookingObject(data, bookingPayload);
        const rawStatus = statusValueFrom(booking, data, data.bookingStatus || data.status || 'PENDING');
        let meta = statusMeta(rawStatus);
        const airlineReference = pnrValue(booking);
        const ticketNumber = ticketValue(booking);
        const confirmed = meta.kind === 'ok' && (airlineReference !== 'Pending' || ticketNumber !== 'Pending');
        if(meta.kind === 'ok' && !confirmed) meta = {kind:'hold'};
        if(meta.kind !== 'hold'){
          stopPendingStatusPoll();
          renderBookingStatusView(rawStatus, bookingPayload, data);
        }
      }catch(_e){}
    }, 8000);
  }

  function bindStatusPolicyButtons(flights){
    ROOT.querySelectorAll('[data-open-policy]').forEach(function(btn){
      btn.onclick = function(){
        const hasBaggage = baggageRowsForPolicy(flights || []).length > 0;
        const hasCancel = policyTextRows(flights || [], 'cancel').length > 0;
        const hasChange = policyTextRows(flights || [], 'change').length > 0;
        const target = btn.getAttribute('data-policy-target') || 'cancel';
        if(target === 'baggage' && !hasBaggage){
          setFinalStatusMessage('Baggage details are not available for this booking yet.', true);
          return;
        }
        if((target === 'cancel' || target === 'change') && !hasCancel && !hasChange && !hasBaggage){
          setFinalStatusMessage('Fare rules are not available for this booking yet.', true);
          return;
        }
        openPolicyModal(flights || [], target);
      };
    });
  }

  function bindFinalBookingStatusActions(bookingId, bookingPayload, responseData, confirmed, metaKind, flights){
    const safeId = encodeURIComponent(String(bookingId || ''));
    ROOT.querySelectorAll('[data-copy]').forEach(function(button){
      button.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(button.getAttribute('data-copy') || ''); button.textContent = 'Copied'; setTimeout(()=>button.textContent='Copy', 1200); }catch(_e){}
      });
    });
    ROOT.querySelector('[data-new-booking]')?.addEventListener('click', function(){ location.href='/index.html?service=flight'; });
    ROOT.querySelector('[data-my-bookings]')?.addEventListener('click', function(){ location.href='/my-bookings.html'; });
    ROOT.querySelector('[data-contact-support]')?.addEventListener('click', function(){ location.href=tySupportPageUrlForBooking(bookingId); });
    ROOT.querySelector('[data-refresh-status]')?.addEventListener('click', async function(){
      try{
        setFinalStatusMessage('Refreshing booking status...');
        const data = await statusGet('/api/bookings/' + safeId + '/status');
        renderBookingStatusView(data.bookingStatus || data.status || data.booking && data.booking.bookingStatus || 'PENDING', bookingPayload, data);
      }catch(error){
        setFinalStatusMessage(error.message || 'Could not refresh status.', true);
      }
    });
    bindStatusPolicyButtons(flights || []);
    if(!confirmed) return;
    ROOT.querySelector('[data-download-ticket]')?.addEventListener('click', async function(){
      try{ setFinalStatusMessage('Preparing e-ticket...'); await downloadBookingFile('/api/bookings/' + safeId + '/ticket', 'TravelYaraa-E-Ticket-' + bookingId + '.pdf'); setFinalStatusMessage('E-ticket download started.'); }catch(error){ setFinalStatusMessage(error.message || 'Ticket download failed.', true); }
    });
    ROOT.querySelector('[data-download-receipt]')?.addEventListener('click', async function(){
      try{ setFinalStatusMessage('Preparing receipt...'); await downloadBookingFile('/api/bookings/' + safeId + '/receipt', 'TravelYaraa-Receipt-' + bookingId + '.pdf'); setFinalStatusMessage('Receipt download started.'); }catch(error){ setFinalStatusMessage(error.message || 'Receipt download failed.', true); }
    });
    ROOT.querySelector('[data-resend-email]')?.addEventListener('click', async function(){
      const current = statusContact(statusBookingObject(responseData, bookingPayload), bookingPayload || {}).email || '';
      const email = window.prompt('Enter email address:', current.split(',')[0].trim());
      if(email === null) return;
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return setFinalStatusMessage('Please enter a valid email address.', true);
      try{
        const data = await statusPost('/api/bookings/' + safeId + '/resend-email', {email:String(email).trim()});
        setFinalStatusMessage(data.message && !tyLooksTechnicalCustomerError(data.message) ? data.message : 'Email sent.');
      }catch(error){ setFinalStatusMessage(error.message || 'Email could not be sent.', true); }
    });
    ROOT.querySelector('[data-change-request]')?.addEventListener('click', async function(){
      const requestedDate = window.prompt('Enter preferred new travel date (YYYY-MM-DD):', '');
      if(!requestedDate) return;
      try{
        const data = await statusPost('/api/bookings/' + safeId + '/change-request', {requestedDate});
        setFinalStatusMessage(data.message && !tyLooksTechnicalCustomerError(data.message) ? data.message : 'Change request recorded.');
      }catch(error){ setFinalStatusMessage(error.message || 'Change request failed.', true); }
    });
    ROOT.querySelector('[data-cancel-booking]')?.addEventListener('click', async function(){
      if(!window.confirm('Check airline cancellation charges for this booking?')) return;
      try{
        const reason = 'Customer requested from TravelYaraa booking page';
        const review = await statusPost('/api/bookings/' + safeId + '/cancel', {confirm:false, reason});
        const summary = statusCancellationSummary(review);
        if(!window.confirm(summary + '\n\nThis action may be irreversible. Submit cancellation now?')){
          setFinalStatusMessage('Cancellation was not submitted.');
          return;
        }
        const submitted = await statusPost('/api/bookings/' + safeId + '/cancel', {confirm:true, reason});
        setFinalStatusMessage(submitted.message && !tyLooksTechnicalCustomerError(submitted.message) ? submitted.message : 'Cancellation/refund request submitted.');
        try{
          const fresh = await statusGet('/api/bookings/' + safeId + '/status');
          renderBookingStatusView(fresh.bookingStatus || fresh.status || 'CANCELLED', bookingPayload, fresh);
        }catch(_e){}
      }catch(error){
        setFinalStatusMessage(error.message || 'Cancellation request failed.', true);
      }
    });
  }

  function renderBookingStatusView(status, bookingPayload, responseData){
    ensureBookingStatusStyles();
    stopPendingStatusPoll();
    const booking = statusBookingObject(responseData, bookingPayload);
    const flights = (booking.selectedFlights || (booking.selectedResult ? [booking.selectedResult] : []) || []).filter(Boolean).length
      ? (booking.selectedFlights || [booking.selectedResult]).filter(Boolean)
      : ((bookingPayload && (bookingPayload.selectedFlights || [bookingPayload.selectedFlight]).filter(Boolean)) || []);
    const travellers = uniqueTravellersForStatus((booking.details && booking.details.passengers) || booking.travellers || bookingPayload && bookingPayload.travellers || []);
    const rawStatus = statusValueFrom(booking, responseData, status);
    let meta = statusMeta(rawStatus);
    const bookingId = statusBookingId(booking, responseData);
    const airlineReference = pnrValue(booking);
    const ticketNumber = ticketValue(booking);
    const bookingRef = bookingReferenceValue(booking, responseData);
    const contact = statusContact(booking, bookingPayload || {});
    const payStatus = paymentStatusValue(booking, responseData);
    const payId = paymentIdValue(booking, responseData);
    const paidAmt = paidAmountDisplay(booking, responseData);
    const confirmed = meta.kind === 'ok' && (airlineReference !== 'Pending' || ticketNumber !== 'Pending');
    if(meta.kind === 'ok' && !confirmed){
      meta = {kind:'hold', title:'Booking confirmation pending', badge:'Pending', note:'Payment has been processed. Airline reference and ticket actions will appear only after confirmed ticketing.'};
    }

    const passengerHtml = travellers.map(function(traveller, index){
      return `<div class="ty-final-passenger"><span>${esc(traveller.passengerType || traveller.type || traveller.pt || 'Traveller')} ${index + 1}</span><b>${esc(travellerName(traveller))}</b></div>`;
    }).join('');

    const contactRows = [
      statusKvIf('Name', contact.name),
      statusKvIf('Email', contact.email),
      statusKvIf('Phone', contact.phone)
    ].join('');

    const paymentRows = [
      statusKvIf('Payment status', payStatus),
      statusKvIf('Payment ID', payId, true),
      statusKvIf('Amount paid', paidAmt)
    ].join('');

    let detailCards = '';
    if(confirmed){
      detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Booking references</h2><div class="ty-final-card-body ty-final-reference-grid">${statusKv('Booking ID', bookingId, true)}${statusKvIf('Airline Reference', airlineReference !== 'Pending' ? airlineReference : '', true)}${statusKvIf('Ticket number', ticketNumber !== 'Pending' ? ticketNumber : '', true)}${statusKvIf('Booking Reference', bookingRef, true)}</div></article>`;
      if(passengerHtml) detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Traveller details</h2><div class="ty-final-card-body ty-final-passengers">${passengerHtml}</div></article>`;
      if(contactRows) detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Contact details</h2><div class="ty-final-card-body ty-final-reference-grid">${contactRows}</div></article>`;
      if(paymentRows) detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Payment</h2><div class="ty-final-card-body ty-final-reference-grid">${paymentRows}</div></article>`;
      detailCards += statusBaggageSummaryHtml(flights);
    }else if(meta.kind === 'cancelled'){
      detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Booking details</h2><div class="ty-final-card-body ty-final-reference-grid">${statusKv('Booking ID', bookingId, true)}${statusKvIf('Status', meta.badge)}</div></article>`;
      detailCards += statusRefundDetailsHtml(booking, responseData);
      if(passengerHtml) detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Traveller details</h2><div class="ty-final-card-body ty-final-passengers">${passengerHtml}</div></article>`;
    }else if(meta.kind === 'failed'){
      detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Booking details</h2><div class="ty-final-card-body ty-final-reference-grid">${statusKv('Booking ID', bookingId, true)}${statusKvIf('Payment status', payStatus)}${statusKvIf('Amount', paidAmt)}</div></article>`;
    }else{
      detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Booking details</h2><div class="ty-final-card-body ty-final-reference-grid">${statusKv('Booking ID', bookingId, true)}${statusKvIf('Payment status', payStatus)}${statusKvIf('Amount paid', paidAmt)}</div></article>`;
      if(passengerHtml) detailCards += `<article class="ty-final-card"><h2 class="ty-final-card-title">Traveller details</h2><div class="ty-final-card-body ty-final-passengers">${passengerHtml}</div></article>`;
    }

    let actions = '';
    if(confirmed){
      actions = statusAction('Download e-ticket','data-download-ticket','primary') +
        statusAction('Download receipt','data-download-receipt','') +
        statusAction('Resend confirmation email','data-resend-email','') +
        statusAction('Change flight request','data-change-request','') +
        statusAction('Cancel / refund options','data-cancel-booking','') +
        statusAction('My Bookings','data-my-bookings','') +
        statusAction('TravelYaraa support','data-contact-support','') +
        statusAction('New booking','data-new-booking','orange full');
    }else if(meta.kind === 'hold'){
      actions = statusSafeNavActions(true);
    }else{
      actions = statusSafeNavActions(false);
    }

    try{ history.replaceState({step:'booking-status', bookingId},'', '/pages/results/flights.html?service=flight&step=booking-status&bookingId=' + encodeURIComponent(bookingId)); }catch(_e){}
    ROOT.innerHTML = `<div class="ty-final-status"><main class="ty-final-status-shell">
      <section class="ty-final-status-hero ${esc(meta.kind)}"><div><small>TravelYaraa booking status</small><h1>${esc(meta.title)}</h1><p>${esc(meta.note)}</p></div><b class="ty-final-status-badge">${esc(meta.badge)}</b></section>
      ${renderItineraryCard(flights, {compact:true})}
      ${detailCards}
      <article class="ty-final-card"><div class="ty-final-actions">${actions}</div><p id="tyFinalStatusMessage" class="ty-final-message" hidden></p></article>
    </main></div>`;
    bindFinalBookingStatusActions(bookingId, bookingPayload, responseData || {}, confirmed, meta.kind, flights);
    if(meta.kind === 'hold') startPendingStatusPoll(bookingId, bookingPayload);
  }



async function proceedToPayment(flights, form, error, msg, validate, skipAirReview){
    if(!validate()){
      if(error) error.style.display = "block";
      return;
    }

    if(!skipAirReview && !state.paymentReviewInProgress){
      state.paymentReviewInProgress = true;
      try{
        if(msg){ msg.classList.remove("error"); msg.textContent = "Checking latest airline fare..."; }
        const review = await fetchAirReviewForFlights(flights);
        applyReviewDataToFlights(flights, review);
        const changes = detectReviewChanges(flights, review);
        state.paymentReviewInProgress = false;
        if(changes.length){
          renderChangeConfirm(flights, changes, {onBack:openFlightSearchPage, onContinue:function(){ proceedToPayment(flights, form, error, msg, validate, true); }});
          return;
        }
      }catch(e){
        state.paymentReviewInProgress = false;
      }
    }

    const fare = computeFare(flights);
    const selectedAddOnsList = selectedAddOnsArray();
    const bookingPayload = {
      service: "flight",
      clientRequestId: newClientRequestId(),
      selectedFlight: flights[0],
      selectedFlights: flights,
      search: state.search,
      passenger: Object.assign({}, collectTravellers(form)[0] || {}, Object.fromEntries(new FormData(form).entries()), {email:form.querySelector('[name="email"]')?.value || '', mobile:normalizeNationalPhone(form.querySelector('[name="mobile"]')?.value || '', form.querySelector('[name="mobileCountryCode"]')?.value || '+91'), mobileCountryCode:form.querySelector('[name="mobileCountryCode"]')?.value || '+91', mobileFull:contactPhoneFull(form), mobileCountry:selectedPhoneCountry(form).country}),
      travellers: collectTravellers(form),
      travelInsurance: collectTravelInsuranceIntent(form),
      offer: fare.selectedOffer || null,
      addOns: state.selectedAddOns,
      addons: selectedAddOnsList,
      addOnsArray: selectedAddOnsList,
      selectedAddOns: state.selectedAddOns,
      fare,
      price: fare,
      amount: fare.total,
      totalAmount: fare.total,
      createdAt: new Date().toISOString()
    };

    sessionStorage.setItem("ty_flight_booking_review", JSON.stringify(bookingPayload));
    sessionStorage.setItem("ty_selected_booking_item", JSON.stringify(bookingPayload));
    localStorage.setItem("ty_selected_flight", JSON.stringify(bookingPayload));

    try{
      if(msg){ msg.classList.remove("error"); msg.textContent = "Verifying booking contact..."; }
      const guestAuth = await requireGuestOtpBeforePayment(bookingPayload, msg);
      if(guestAuth && guestAuth.user){
        bookingPayload.user = Object.assign({}, bookingPayload.user || {}, guestAuth.user);
        bookingPayload.userId = guestAuth.user.userId || guestAuth.user.uid || "";
        bookingPayload.email = guestAuth.user.email || bookingPayload.passenger.email || "";
        bookingPayload.phone = guestAuth.user.phone || bookingPayload.passenger.mobile || "";
      }
      if(msg){ msg.classList.remove("error"); msg.textContent = "Starting secure payment..."; }
      showSecurePaymentOverlay();
      const orderRes = await createPaymentOrder(fare, bookingPayload);
      if(orderRes.bookingId) bookingPayload.bookingId = orderRes.bookingId;
      if(orderRes.clientRequestId) bookingPayload.clientRequestId = orderRes.clientRequestId;
      sessionStorage.setItem('ty_flight_booking_review', JSON.stringify(bookingPayload));
      sessionStorage.setItem('ty_selected_booking_item', JSON.stringify(bookingPayload));
      localStorage.setItem('ty_selected_flight', JSON.stringify(bookingPayload));
      const order = orderRes.order || orderRes.data || orderRes;
      const key = orderRes.key || orderRes.razorpayKey || order.key || window.RAZORPAY_KEY_ID;
      const orderId = order.id || order.order_id || order.orderId || order.razorpay_order_id || orderRes.orderId || orderRes.razorpayOrderId;
      const rawAmount = Number(order.amount || orderRes.amount || 0);
      /* Razorpay order amount from backend is already in paise.
         Do not multiply it again, otherwise Checkout can fail with amount mismatch. */
      const amount = rawAmount > 0 ? Math.round(rawAmount) : Math.round(Number(fare.total || 0) * 100);
      const currency = order.currency || orderRes.currency || "INR";
      if(!key || !orderId) throw new Error("Payment order could not be created.");
      await loadRazorpayScript();
      let tyRazorpayTerminalHandled = false;
      const rz = new window.Razorpay({
        key, amount, currency, name:"TravelYaraa", description:"Flight Booking", order_id:orderId,
        prefill:{name:((bookingPayload.passenger.title||"")+" "+(bookingPayload.passenger.firstName||"")+" "+(bookingPayload.passenger.lastName||"")).trim(), email:bookingPayload.passenger.email||"", contact:bookingPayload.passenger.mobile||""},
        handler:async function(response){
          tyRazorpayTerminalHandled = true;
          showSecurePaymentOverlay();
          if(msg) msg.textContent = "Verifying payment...";
          try{
            const verify = await verifyPayment(response, bookingPayload);
            const verifiedStatus = statusFromPaymentVerifyResponse(verify, "PENDING");
            sessionStorage.setItem("ty_last_booking_success", JSON.stringify(verify));
            hideSecurePaymentOverlay();
            if(msg){ msg.classList.remove("error"); msg.textContent = /FAIL|ERROR|REJECT|UNSUCCESS|REFUND_REQUIRED|SUPPLIER_BOOKING_FAILED/i.test(verifiedStatus) ? "Booking could not be completed." : "Payment processed."; }
            renderBookingStatusView(verifiedStatus, bookingPayload, verify);
          }catch(verifyErr){
            hideSecurePaymentOverlay();
            renderBookingStatusView("PAYMENT_VERIFICATION_PENDING", bookingPayload, {
              success:false,
              bookingId:bookingPayload.bookingId,
              bookingStatus:"PAYMENT_VERIFICATION_PENDING",
              paymentStatus:"PENDING",
              message:verifyErr && verifyErr.message || "Payment verification is pending. Refresh status before trying again."
            });
          }
        },
        modal:{ondismiss:async function(){
          hideSecurePaymentOverlay();
          if(tyRazorpayTerminalHandled) return;
          tyRazorpayTerminalHandled = true;
          if(msg) msg.textContent = "Payment cancelled.";
          let result = {bookingId:bookingPayload.bookingId, bookingStatus:"PAYMENT_CANCELLED", paymentStatus:"CANCELLED"};
          try{ result = await recordPaymentStatus(bookingPayload.bookingId, "PAYMENT_CANCELLED", {description:"Customer closed Razorpay checkout."}); }catch(_e){}
          renderBookingStatusView("PAYMENT_CANCELLED", bookingPayload, result);
        }},
        theme:{color:"#0066cc"}
      });
      if(rz && rz.on){
        rz.on("payment.failed", async function(resp){
          if(tyRazorpayTerminalHandled) return;
          tyRazorpayTerminalHandled = true;
          hideSecurePaymentOverlay();
          try{ sessionStorage.setItem("ty_last_payment_failed", JSON.stringify(resp || {})); }catch(_e){}
          let result = {bookingId:bookingPayload.bookingId, bookingStatus:"PAYMENT_FAILED", paymentStatus:"FAILED"};
          try{ result = await recordPaymentStatus(bookingPayload.bookingId, "PAYMENT_FAILED", resp && resp.error ? resp.error : resp); }catch(_e){}
          renderBookingStatusView("PAYMENT_FAILED", bookingPayload, result);
        });
      }
      rz.open();
      setTimeout(hideSecurePaymentOverlay, 450);
    }catch(e){
      hideSecurePaymentOverlay();
      const text = (e && e.message) ? e.message : "Payment could not be started. Please try again.";
      if(tyIsAuthRequiredError(e)){
        /* Stale or missing backend session: drop it so the next Continue
           Payment click reopens the existing TravelYaraa login panel. */
        if(typeof window.tyClearBackendSession === "function") window.tyClearBackendSession();
      }
      if(msg){ msg.classList.add("error"); msg.textContent = text; }
      else { try{ alert(text); }catch(_e){} }
    }
  }


  function cachedStatusPayloadForBooking(bookingId){
    const id = String(bookingId || '').trim();
    const keys = ['ty_last_booking_success','ty_flight_booking_review','ty_selected_booking_item','ty_selected_flight'];
    let payload = {};
    keys.forEach(function(k){
      try{
        const raw = sessionStorage.getItem(k) || localStorage.getItem(k);
        if(!raw) return;
        const data = JSON.parse(raw);
        const candidate = data && (data.booking || data.bookingData || data.bookingPayload || data);
        const candidateId = String((candidate && (candidate.bookingId || candidate.id)) || data.bookingId || data.id || '').trim();
        if(!id || candidateId === id || raw.indexOf(id) !== -1){
          payload = Object.assign({}, payload || {}, candidate || {}, data.bookingPayload || {});
        }
      }catch(_e){}
    });
    if(id && !payload.bookingId) payload.bookingId = id;
    return payload;
  }

  function renderBookingStatusLoadError(bookingId, message){
    ensureBookingStatusStyles();
    stopPendingStatusPoll();
    const payload = cachedStatusPayloadForBooking(bookingId);
    const safeId = String(bookingId || payload.bookingId || 'Pending');
    const flights = (payload && (payload.selectedFlights || [payload.selectedFlight]).filter(Boolean)) || [];
    const authMissing = /log in|login|auth/i.test(String(message || ''));
    const friendly = authMissing
      ? 'Please log in to the same TravelYaraa account used for this booking.'
      : tyCustomerFacingActionError(message, 'Booking could not be loaded. Open it again from My Bookings or contact support.');
    ROOT.innerHTML = `<div class="ty-final-status"><main class="ty-final-status-shell">
      <section class="ty-final-status-hero failed"><div><small>TravelYaraa booking status</small><h1>${authMissing ? 'Login required' : 'Booking details unavailable'}</h1><p>${esc(friendly)}</p></div><b class="ty-final-status-badge">Action required</b></section>
      ${flights.length ? renderItineraryCard(flights, {compact:true}) : ''}
      <article class="ty-final-card"><div class="ty-final-actions">${authMissing ? statusAction('Login / Sign up','data-login-booking','primary full') : ''}${statusAction('My Bookings','data-my-bookings','')}${statusAction('TravelYaraa support','data-contact-support','')}${statusAction('New booking','data-new-booking','orange full')}</div></article>
    </main></div>`;
    ROOT.querySelector('[data-new-booking]')?.addEventListener('click', function(){ location.href='/index.html?service=flight'; });
    ROOT.querySelector('[data-my-bookings]')?.addEventListener('click', function(){ location.href='/my-bookings.html'; });
    ROOT.querySelector('[data-contact-support]')?.addEventListener('click', function(){ location.href=tySupportPageUrlForBooking(safeId); });
    ROOT.querySelector('[data-login-booking]')?.addEventListener('click', function(){ location.href='/index.html?openLogin=1&redirect=' + encodeURIComponent(location.pathname + location.search); });
  }

  async function openBookingStatusFromUrl(bookingId){
    const id = String(bookingId || '').trim();
    if(!id) return renderBookingStatusLoadError('', 'Booking ID is missing in page URL.');
    if(!tyGuestAuthToken()) return renderBookingStatusLoadError(id, 'Please log in to the same TravelYaraa account used for this booking.');
    ROOT.innerHTML = '';
    try{ window.TravelYaraaLoader && window.TravelYaraaLoader.show({service:'flight',force:true,hideText:true}); }catch(_e){}
    const payload = cachedStatusPayloadForBooking(id);
    try{
      const data = await statusGet('/api/bookings/' + encodeURIComponent(id) + '/status');
      renderBookingStatusView(data.bookingStatus || data.status || data.booking?.bookingStatus || 'PENDING', payload, data);
    }catch(error){
      renderBookingStatusLoadError(id, error && error.message ? error.message : 'Booking not found');
    }finally{
      try{ window.TravelYaraaLoader && window.TravelYaraaLoader.hide({ final: true }); }catch(_e){}
    }
  }


  function readSelectedFlightForReview(){
    try{
      const raw = sessionStorage.getItem("ty_selected_flight") || localStorage.getItem("ty_selected_flight");
      if(!raw) return [];
      const data = JSON.parse(raw);
      if(Array.isArray(data.selectedFlights)) return data.selectedFlights;
      if(data.selectedFlight) return [data.selectedFlight];
      if(data.item) return [data.item];
      return [];
    }catch(e){ return []; }
  }


  




  function injectCss(){
    if(document.getElementById('ty-booking-style')) return;
    const style = document.createElement('style');
    style.id = 'ty-booking-style';
    style.textContent = `
      .ty-review-page.ty-booking-page{min-height:100vh;background:#f4f7fa;color:#071d49;font-family:Inter,Roboto,Arial,sans-serif;overflow-x:hidden}
      .ty-booking-top{display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;align-items:center;background:#fff;border-bottom:1px solid #e7edf4;padding:12px 16px;box-shadow:0 2px 10px rgba(7,29,73,.04)}
      .ty-review-back{border:0;background:transparent;color:#071d49;font-size:34px;line-height:1;font-weight:900;padding:0;cursor:pointer}
      .ty-booking-top h1{margin:0;font-size:20px;line-height:1.2;font-weight:950;color:#071d49}.ty-booking-top p{margin:3px 0 0;color:#667085;font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ty-booking-shell{width:min(1180px,calc(100% - 32px));margin:16px auto 44px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}.ty-booking-left{display:flex;flex-direction:column;gap:14px;min-width:0}.ty-side{position:sticky;top:14px;display:flex;flex-direction:column;gap:12px}
      .ty-review-card,.ty-price-card,.ty-offer-box,.ty-contact-card,.ty-gst-card{background:#fff;border:1px solid #e2eaf4;border-radius:14px;box-shadow:0 6px 18px rgba(7,29,73,.07);overflow:hidden;min-width:0;padding:0}.ty-section-head,.ty-traveller-head{background:#eaf5ff;padding:13px 16px}.ty-section-head h2,.ty-traveller-head h2{margin:0;color:#071d49;font-size:17px;line-height:1.15;font-weight:950}.ty-section-head p,.ty-traveller-head p{margin:5px 0 0;color:#667085;font-size:12px;line-height:1.35;font-weight:800}.ty-section-body{padding:14px 16px}.ty-form-grid,.ty-form-grid.two,.ty-form-grid.contact{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}.ty-form-grid.passenger{grid-template-columns:110px minmax(0,1fr) minmax(0,1fr)}.ty-form-grid.passport{grid-template-columns:repeat(3,minmax(0,1fr))}.ty-form-field{display:flex;flex-direction:column;gap:5px;min-width:0}.ty-form-field>span{color:#405065;font-size:12px;font-weight:900}.ty-form-field input,.ty-form-field select{width:100%;height:38px;border:1px solid #dce6f1;border-radius:8px;padding:7px 9px;background:#fff;color:#071d49;font-size:13px;font-weight:750;min-width:0}.ty-dob-field,.ty-passport-dob-field{grid-column:1/-1;max-width:520px}.ty-date3{display:grid;grid-template-columns:minmax(86px,.9fr) minmax(112px,1.15fr) minmax(94px,1fr);gap:8px}.ty-date3 select{height:44px!important;padding:8px 10px!important;font-size:13px!important}.ty-phone-row{display:grid;grid-template-columns:112px minmax(0,1fr);gap:7px}.ty-agree{display:flex;gap:10px;align-items:flex-start;margin-top:14px;color:#334155;font-size:13px;font-weight:750;line-height:1.45}.ty-agree input{width:18px;height:18px;accent-color:#0062e3;flex:0 0 auto}.ty-agree a{color:#0062e3;font-weight:900;text-decoration:none}
      .ty-fare-row,.ty-total-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0;color:#334155;font-size:14px;font-weight:800}.ty-total-row{font-size:20px;color:#071d49;font-weight:950}.ty-divider{height:1px;background:#e7edf4;margin:12px 0}.ty-payment-btn,.ty-book-btn{border:0;background:#ef6614;color:#fff;border-radius:999px;min-height:44px;padding:0 18px;font-size:15px;font-weight:950}.ty-price-card .ty-payment-btn{width:100%}.ty-promo-card,.ty-policy-open{width:100%;border:0;background:#fff;color:#071d49;border-radius:14px;box-shadow:0 6px 18px rgba(7,29,73,.07);padding:15px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;font-weight:950;min-height:58px}.ty-promo-card{display:grid;grid-template-columns:42px minmax(0,1fr) auto;background:#e9fff8}.ty-promo-icon{width:36px;height:36px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center}.ty-promo-card b{display:block;color:#071d49;font-size:16px}.ty-promo-card small{display:block;color:#288b78;font-size:13px;line-height:1.35;font-weight:800}.ty-policy-open b,.ty-promo-card em{font-size:28px;color:#0062e3;font-style:normal}
      .ty-mobile-sticky,.ty-mobile-sheet{display:none}.ty-pax-tabs{display:flex;flex-wrap:wrap;gap:8px}.ty-pax-tabs button{border:1px solid #dce6f1;background:#fff;color:#071d49;border-radius:12px;padding:9px 12px;font-size:13px;font-weight:950}.ty-pax-tabs button.active{border-color:#0062e3;background:#eef7ff;color:#0062e3}.ty-pax-panel:not(.active){display:none}
      .ty-policy-modal,.ty-promo-modal{position:fixed;inset:0;z-index:10050;background:#f4f7fa;font-family:Inter,Roboto,Arial,sans-serif;color:#111827}.ty-policy-page,.ty-promo-page{height:100%;width:100%;background:#fff;overflow:auto}.ty-policy-page header{position:sticky;top:0;z-index:3;background:#fff;padding:18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5edf7}.ty-policy-page h2,.ty-promo-page h2{margin:0;font-size:22px;line-height:1.2;font-weight:950;color:#111827}.ty-policy-page header button,.ty-promo-close{border:0;background:transparent;font-size:40px;line-height:1;color:#8a8f98}.ty-policy-page nav{position:sticky;top:69px;z-index:2;display:grid;grid-template-columns:1fr 1fr 1fr;background:#fff;border-bottom:10px solid #e5e5e5}.ty-policy-page nav button{border:0;background:#fff;color:#666;font-size:15px;font-weight:900;padding:15px 6px;border-bottom:4px solid transparent}.ty-policy-page nav button.active{color:#111;border-bottom-color:#0062e3}.ty-policy-page main{padding:18px}.ty-policy-pane{display:none}.ty-policy-pane.active{display:block}.ty-policy-route{margin-bottom:22px}.ty-policy-route table{width:100%;border-collapse:collapse;border:1px solid #edf1f6}.ty-policy-route th,.ty-policy-route td{border:1px solid #edf1f6;padding:12px 10px;text-align:left;font-size:14px;line-height:1.35}.ty-policy-text{border:1px solid #edf1f6;border-radius:8px;padding:14px;font-size:14px;line-height:1.45;white-space:pre-wrap}.ty-promo-page{padding:22px 18px}.ty-promo-close{position:absolute;right:18px;top:14px}.ty-promo-input{display:flex;border:1px solid #cfd7e2;border-radius:10px;overflow:hidden;margin:18px 0;background:#fff}.ty-promo-input input{flex:1;min-width:0;border:0;padding:15px 14px;font-size:15px}.ty-promo-input button{border:0;background:#0062e3;color:#fff;font-weight:950;padding:0 20px;min-width:92px;font-size:15px}.ty-promo-list{display:flex;flex-direction:column;gap:12px}.ty-promo-list article{border:1px solid #dce6f1;border-radius:12px;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.ty-promo-list article.active{background:#d9fff2;border-color:#97ead0}.ty-promo-list article p{grid-column:1/-1;margin:0;color:#288b78;font-size:13px;line-height:1.35}.ty-promo-list article button{grid-column:1/-1;border:0;border-radius:999px;background:#0062e3;color:#fff;min-height:42px;padding:0 18px;font-size:15px;font-weight:950;width:100%;margin-top:8px}.ty-promo-list article.active button{background:#0f9f6e}.ty-promo-list article button:disabled{opacity:.68}
      @media(max-width:767px){
        body.travel-page,#travelRoot{margin:0;padding:0;max-width:100vw;overflow-x:hidden}.ty-review-page.ty-booking-page{padding-bottom:118px}.ty-booking-top{display:none}.ty-booking-shell{width:100%;max-width:100%;margin:0;display:block;padding:0}.ty-booking-left{gap:10px}.ty-side{position:static;display:block}.ty-mobile-review-back{position:relative!important;left:auto!important;top:auto!important;z-index:30;width:44px;height:44px;margin:10px 0 8px 14px!important;border-radius:14px;background:rgba(255,255,255,.94);box-shadow:0 6px 18px rgba(7,29,73,.12);display:flex;align-items:center;justify-content:center;color:#071d49;font-size:34px;flex:0 0 44px!important}.ty-review-page.ty-booking-page .ty-booking-shell{margin-top:0!important}.ty-review-card,.ty-contact-card,.ty-gst-card{border-radius:0;border-left:0;border-right:0}.ty-section-head,.ty-traveller-head{padding:11px 12px}.ty-section-head h2,.ty-traveller-head h2{font-size:16px}.ty-section-body{padding:12px}.ty-form-grid,.ty-form-grid.two,.ty-form-grid.contact,.ty-form-grid.passenger,.ty-form-grid.passport{display:grid;grid-template-columns:1fr;gap:10px}.ty-phone-row{grid-template-columns:96px minmax(0,1fr)}.ty-policy-open,.ty-promo-card{border-radius:0;margin:0;box-shadow:0 2px 10px rgba(7,29,73,.08)}.ty-price-card,.ty-offer-box{display:none}.ty-mobile-sticky{position:fixed;left:0;right:0;bottom:0;z-index:1000;background:#17202d;color:#fff;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:12px;align-items:center;padding:13px 20px calc(13px + env(safe-area-inset-bottom));border-radius:16px 16px 0 0;box-shadow:0 -8px 28px rgba(7,29,73,.22)}.ty-mobile-sticky span{display:block;font-size:13px;font-weight:800;color:#e7edf7}.ty-mobile-sticky b{font-size:22px;font-weight:950;color:#fff}.ty-mobile-sticky .ty-total-line{display:flex;align-items:center;gap:6px}.ty-mobile-sticky .ty-info-btn{width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,.7);background:transparent;color:#fff;font-weight:950}.ty-mobile-sticky .ty-continue{border:0;border-radius:999px;background:#f56b12;color:#fff;min-height:52px;font-size:16px;font-weight:950}.ty-left-continue,#tyProceedPayment,#tyProceedPaymentLeft,#tyAddonPay,#tyAddonPayLeft{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}.ty-mobile-sheet{position:fixed;inset:0;background:rgba(15,23,42,.56);z-index:1200;align-items:flex-end;justify-content:center;overflow:visible}.ty-mobile-sheet.active{display:flex}.ty-sheet-card{position:relative;width:100%;max-height:58vh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;padding:48px 16px calc(22px + env(safe-area-inset-bottom))}.ty-sheet-close{position:absolute;right:14px;top:12px;width:40px;height:40px;border:1px solid #dfe7f1;border-radius:999px;background:#fff;color:#17202d;font-size:30px;line-height:1;display:flex;align-items:center;justify-content:center;z-index:3;box-shadow:0 4px 12px rgba(7,29,73,.12)}.ty-sheet-card h2{margin:0 48px 16px 0;color:#071d49}.ty-sheet-pane{display:block}.ty-break-row{display:flex;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid #e5edf7;font-weight:900}.ty-break-row.total{font-size:18px;color:#0062e3}.ty-review-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.ty-review-actions button{min-height:50px;border-radius:999px;font-size:15px;font-weight:950}.ty-review-actions .edit{border:1px solid #f56b12;background:#fff;color:#f56b12}.ty-review-actions .confirm{border:0;background:#f56b12;color:#fff}.ty-review-flight{border:1px solid #dfe7f1;border-radius:14px;padding:10px;display:grid;grid-template-columns:38px minmax(0,1fr);gap:10px;margin:10px 0 14px}.ty-policy-page main{padding:16px 14px}.ty-policy-route th,.ty-policy-route td{padding:11px 8px;font-size:13px}.ty-promo-page{padding:22px 14px}}
      @media (max-width:1024px), (hover:none), (pointer:coarse){
        .ty-review-page.ty-booking-page .ty-desktop-continue,
        .ty-review-page.ty-booking-page .ty-left-continue,
        .ty-review-page.ty-booking-page #tyProceedPayment,
        .ty-review-page.ty-booking-page #tyProceedPaymentLeft,
        .ty-review-page.ty-booking-page form > .ty-payment-btn,
        .ty-review-page.ty-booking-page .ty-side > .ty-payment-btn,
        .ty-review-page.ty-addon-page .ty-desktop-continue,
        .ty-review-page.ty-addon-page .ty-left-continue,
        .ty-review-page.ty-addon-page #tyAddonPay,
        .ty-review-page.ty-addon-page #tyAddonPayLeft,
        .ty-review-page.ty-addon-page form > .ty-payment-btn,
        .ty-review-page.ty-addon-page .ty-side > .ty-payment-btn{display:none!important;visibility:hidden!important;opacity:0!important;height:0!important;min-height:0!important;max-height:0!important;width:0!important;min-width:0!important;max-width:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;pointer-events:none!important;position:absolute!important;left:-999999px!important;top:auto!important}
        .ty-mobile-sticky{display:grid!important}
        .ty-mobile-sticky .ty-continue{display:block!important;visibility:visible!important;opacity:1!important;height:auto!important;width:auto!important;min-width:0!important;max-width:none!important;min-height:52px!important;position:static!important;left:auto!important;margin:0!important;padding:0 16px!important;pointer-events:auto!important;overflow:visible!important}
        .ty-gst-card:not(.gst-open) .ty-gst-fields-holder{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
      }
      @media (min-width:1025px) and (hover:hover) and (pointer:fine){
        .ty-review-page .ty-desktop-continue{display:block!important;visibility:visible!important;height:auto!important;min-height:44px!important;margin:0!important;padding:0 18px!important;position:static!important;left:auto!important;pointer-events:auto!important;overflow:visible!important}
        .ty-mobile-sticky,.ty-mobile-sheet{display:none!important}
      }

      .ty-required-star{color:#d93025;font-style:normal;font-size:12px;font-weight:950;margin-left:3px;line-height:1}.ty-field-invalid input,.ty-field-invalid select,.ty-field-invalid textarea{border-color:#d93025!important;background:#fffafa!important;box-shadow:0 0 0 1px rgba(217,48,37,.10)!important}.ty-field-invalid .ty-date3 select,.ty-field-invalid .ty-phone-row input,.ty-field-invalid .ty-phone-row select{border-color:#d93025!important;background:#fffafa!important}.ty-field-error{display:block;color:#d93025;font-size:11px;line-height:1.3;font-weight:850;margin-top:3px}.ty-alert,#tyTopAlert,.ty-form-error,#tyFormError{display:none!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;visibility:hidden!important}.ty-contact-card .ty-agree{margin-top:8px;margin-bottom:0}.ty-contact-card .ty-section-body:has(.ty-agree){padding-bottom:10px}
      .ty-ff-card{background:#fff;border:1px solid #e7edf4;border-radius:12px;box-shadow:0 5px 18px rgba(7,29,73,.07);overflow:hidden}.ty-ff-toggle{width:100%;min-height:46px;border:1px solid #dce6f1;background:#fff;color:#071d49;border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;font-size:14px;font-weight:950;text-align:left}.ty-ff-toggle span{text-transform:none;letter-spacing:.01em}.ty-ff-toggle b{color:#0062e3;font-size:22px;line-height:1}.ty-ff-fields{margin-top:12px}.ty-ff-fields[hidden]{display:none!important}.ty-field-note{margin:8px 0 0;color:#64748b;font-size:12px;font-weight:750;line-height:1.4}.ty-gst-fields-holder[hidden]{display:none!important}.ty-gst-fields-holder{display:none;margin-top:0}.ty-gst-card.gst-open .ty-gst-fields-holder{display:block;margin-top:12px}.ty-gst-card:not(.gst-open) .ty-gst-fields,.ty-gst-card:not(.gst-open) .ty-gst-fields-holder{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}.ty-pax-add-row{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 8px}.ty-pax-open-btn{border:1px solid #dce6f1;background:#eef7ff;color:#0062e3;border-radius:999px;min-height:36px;padding:0 14px;font-size:13px;font-weight:950}.ty-pax-open-btn.active{background:#0062e3;color:#fff;border-color:#0062e3}.ty-pax-open-btn.locked{background:#f1f5f9!important;color:#64748b!important;border-color:#d8e0eb!important}.ty-pax-lock-msg{flex-basis:100%;margin:2px 0 0;color:#d93025;font-size:12px;font-weight:900;line-height:1.35}.ty-pax-panel:not(.active){display:none}.ty-pax-panel-title{margin:0 0 12px;color:#071d49;font-size:15px;font-weight:950}.ty-prev-pax-summary{border:1px solid #dce6f1;background:#f8fbff;border-radius:12px;padding:10px 12px;margin:0 0 14px}.ty-prev-pax-summary[hidden]{display:none!important}.ty-prev-pax-summary h4{margin:0 0 9px;color:#071d49;font-size:13px;font-weight:950}.ty-prev-pax-card{display:grid;gap:3px;border-top:1px dashed #dce6f1;padding:9px 0 0;margin-top:8px}.ty-prev-pax-card:first-of-type{border-top:0;padding-top:0;margin-top:0}.ty-prev-pax-card span{color:#0062e3;font-size:12px;font-weight:950}.ty-prev-pax-card b{color:#071d49;font-size:14px;font-weight:950;line-height:1.25}.ty-prev-pax-card small{color:#64748b;font-size:12px;font-weight:800;line-height:1.25}
      @media(max-width:1024px){.ty-policy-open span{font-size:16px!important;line-height:1.3!important;font-weight:950!important}.ty-ff-card,.ty-gst-card{border-radius:0;border-left:0;border-right:0}.ty-review-page.ty-booking-page{padding-bottom:96px!important}.ty-contact-card .ty-section-body{padding-bottom:12px!important}}

      .ty-addon-flight-list{display:grid;gap:12px}.ty-addon-flight-card{border:1px solid #dce8f7;border-radius:16px;background:#fff;box-shadow:0 8px 20px rgba(7,29,73,.05);padding:14px;min-width:0;overflow:hidden}.ty-addon-flight-head{display:grid;grid-template-columns:54px minmax(0,1fr);gap:12px;align-items:center;margin-bottom:14px}.ty-addon-flight-head h3{margin:0;color:#071d49;font-size:17px;line-height:1.25;font-weight:950;overflow-wrap:anywhere}.ty-addon-flight-head p{margin:4px 0 0;color:#334155;font-size:13px;line-height:1.35;font-weight:850;overflow-wrap:anywhere}.ty-addon-route-row{display:grid;grid-template-columns:minmax(0,1fr) 110px minmax(0,1fr);gap:12px;align-items:start}.ty-addon-route-row>div{min-width:0}.ty-addon-route-row>div:nth-child(2){text-align:center}.ty-addon-route-row>div:last-child{text-align:right}.ty-addon-route-row b{display:block;color:#071d49;font-size:24px;line-height:1;font-weight:950}.ty-addon-route-row span,.ty-addon-route-row small{display:block;color:#334155;font-size:12px;line-height:1.35;font-weight:850;overflow-wrap:anywhere}.ty-addon-route-row em{display:block;color:#071d49;font-style:normal;font-size:14px;font-weight:950}.ty-addon-route-row i{display:block;height:2px;background:#b8c7da;margin:9px 0}.ty-addon-route-row strong{display:block;color:#16803a;font-size:12px;font-weight:950}.ty-addon-bag-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #e5edf7;color:#334155;font-size:12px;font-weight:850}.ty-addon-bag-row b{color:#071d49}.ty-addons-card .ty-section-head h2{font-size:18px}.ty-addon-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}.ty-addon-tabs button{border:1px solid #dce6f1;background:#fff;color:#0062e3;border-radius:14px;min-height:50px;padding:7px 6px;font-size:13px;font-weight:950;display:flex;align-items:center;justify-content:center;gap:6px;text-align:center}.ty-addon-tabs button.active{border-color:#0062e3;background:#eef7ff;color:#071d49}.ty-addon-icon{font-size:16px;line-height:1}.ty-addon-panels section{border:1px solid #e5edf7;border-radius:14px;background:#fff;padding:12px;margin-top:10px}.ty-addon-panels section[hidden]{display:none!important}.ty-addon-panels h3{margin:0 0 10px;color:#071d49;font-size:16px;font-weight:950}.ty-addon-option{border:1px solid #e5edf7;border-radius:12px;padding:12px;margin:10px 0;background:#fbfdff}.ty-addon-option>div:first-child b{display:block;color:#071d49;font-size:14px;font-weight:950}.ty-addon-option>div:first-child p{margin:4px 0 0;color:#334155;font-size:13px;font-weight:800;line-height:1.35}.ty-addon-option>strong{display:block;margin-top:8px;color:#071d49;font-size:15px;font-weight:950}.ty-addon-pax{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.ty-addon-pax label{display:inline-flex;align-items:center;gap:5px;border:1px solid #dce6f1;border-radius:999px;padding:7px 10px;color:#071d49;font-size:12px;font-weight:900;background:#fff}.ty-no-addons{margin:0;color:#64748b;font-size:13px;font-weight:850;line-height:1.45}.ty-trav-summary{display:grid;gap:10px}.ty-trav-detail-card{border:1px solid #dce8f7;border-radius:13px;background:#fbfdff;padding:12px}.ty-trav-detail-card header{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:9px}.ty-trav-detail-card header span{color:#0062e3;font-size:12px;font-weight:950}.ty-trav-detail-card header b{color:#071d49;font-size:15px;font-weight:950}.ty-trav-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ty-trav-detail-grid div{border:1px solid #e8eef6;border-radius:9px;background:#fff;padding:8px;min-width:0}.ty-trav-detail-grid small{display:block;color:#64748b;font-size:10px;line-height:1.2;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.ty-trav-detail-grid strong{display:block;margin-top:3px;color:#071d49;font-size:12px;line-height:1.3;font-weight:900;overflow-wrap:anywhere}.ty-seat-segment-tabs,.ty-seat-passenger-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 10px}.ty-seat-segment-tabs button,.ty-seat-passenger-tabs button{border:1px solid #dce6f1;border-radius:999px;background:#fff;color:#071d49;padding:7px 11px;font-size:11px;font-weight:950}.ty-seat-segment-tabs button.active,.ty-seat-passenger-tabs button.active{border-color:#0062e3;background:#eef7ff;color:#0062e3}.ty-seat-legend{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 10px;color:#475569;font-size:10px;font-weight:850}.ty-seat-legend span{display:flex;align-items:center;gap:5px}.ty-seat-legend i{width:13px;height:13px;border-radius:4px;border:1px solid #b8c7da;background:#fff}.ty-seat-legend i.selected{background:#0062e3;border-color:#0062e3}.ty-seat-legend i.booked{background:#e5e7eb;border-color:#cbd5e1}.ty-seat-map-grid{display:grid;grid-template-columns:repeat(6,minmax(48px,1fr));gap:7px;max-height:430px;overflow:auto;padding:3px}.ty-seat-cell{min-height:50px;border:1px solid #bcd0e7;border-radius:9px;background:#fff;color:#071d49;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:5px;font-family:inherit}.ty-seat-cell b{font-size:12px;font-weight:950}.ty-seat-cell small{font-size:9px;font-weight:850;color:#64748b}.ty-seat-cell.active{background:#0062e3;border-color:#0062e3;color:#fff}.ty-seat-cell.active small{color:#fff}.ty-seat-cell.booked,.ty-seat-cell.taken{background:#e5e7eb;border-color:#cbd5e1;color:#94a3b8}.ty-seat-cell.legroom:not(.booked):not(.taken){border-color:#f59e0b}.ty-seat-cell:disabled{cursor:not-allowed}
      @media(max-width:1024px){.ty-review-page.ty-addon-page{padding-bottom:98px}.ty-review-page.ty-addon-page .ty-review-top{padding:14px 16px;background:#fff;border-bottom:1px solid #e5edf7}.ty-review-page.ty-addon-page .ty-review-top h1{font-size:22px}.ty-addon-flight-card{border-radius:14px;padding:12px}.ty-addon-flight-head{grid-template-columns:48px minmax(0,1fr);gap:10px}.ty-addon-flight-head h3{font-size:16px}.ty-addon-route-row{grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr);gap:8px}.ty-addon-route-row b{font-size:21px}.ty-addon-route-row em{font-size:12px}.ty-addon-bag-row{grid-template-columns:1fr;gap:7px;font-size:12px}.ty-addon-tabs{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.ty-addon-tabs button{min-height:48px;border-radius:13px;padding:5px 3px;font-size:11px;flex-direction:column;gap:3px}.ty-addon-icon{font-size:17px}.ty-addon-option{padding:11px}.ty-addon-pax label{font-size:12px}.ty-trav-detail-grid{grid-template-columns:1fr}.ty-seat-map-grid{grid-template-columns:repeat(4,minmax(52px,1fr));max-height:390px}.ty-trav-summary div{padding:8px 0}}
      /* ty-saved-traveller-compact-and-addon-center-v920 */
      .ty-saved-traveller-tools{margin:0 0 16px;padding:0;display:grid;gap:8px}
      .ty-saved-search-box{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;border:1px solid #e2eaf4;border-radius:12px;background:#fff;min-height:48px;padding:0 12px;box-shadow:0 2px 8px rgba(7,29,73,.03)}
      .ty-saved-search-icon{font-size:26px;line-height:1;color:#334155;font-weight:900}
      .ty-saved-search-box input{border:0!important;background:transparent!important;outline:0!important;min-height:46px!important;font-size:16px!important;color:#071d49!important;font-weight:850!important;padding:0!important}
      .ty-saved-search-box input::placeholder{color:#9aa3ad;font-weight:850}
      .ty-saved-traveller-list{display:grid;gap:7px}
      .ty-saved-traveller-row{width:100%;text-align:left;border:1px solid #dce8f7;border-radius:13px;background:#fff;padding:9px 11px;color:#071d49;font-family:inherit;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;align-items:start}
      .ty-saved-traveller-row b{font-size:13px;font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ty-saved-traveller-row>span{font-size:11px;color:#64748b;font-weight:850;text-align:right;white-space:nowrap}
      .ty-saved-traveller-row div{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}
      .ty-saved-traveller-row em{font-style:normal;font-size:10.5px;color:#475569;background:#f1f5f9;border-radius:999px;padding:4px 7px;font-weight:850}.ty-saved-traveller-update{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 2px;padding:9px 11px;border:1px solid #cfe0f5;border-radius:12px;background:#f7fbff}.ty-saved-traveller-update[hidden]{display:none!important}.ty-saved-traveller-update span{font-size:11px;line-height:1.4;color:#475569;font-weight:750}.ty-saved-traveller-update button{flex:0 0 auto;border:0;border-radius:9px;background:#0062e3;color:#fff;min-height:34px;padding:0 12px;font-size:11px;font-weight:950;cursor:pointer}.ty-saved-traveller-update button:disabled{opacity:.65;cursor:wait}
      .ty-save-traveller-line{display:flex;gap:7px;align-items:flex-start;font-size:11px;color:#334155;font-weight:850}
      .ty-save-traveller-line input{accent-color:#0062e3;margin-top:2px}
      .ty-passport-upload-mini{display:grid;gap:5px;margin-top:6px}
      .ty-upload-main{position:relative;border:1px solid #edf1f7;border-radius:13px;background:#fff;padding:8px 104px 8px 9px;display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;align-items:center;min-height:54px}
      .ty-upload-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#071d49;background:#f1f5f9;font-size:18px;font-weight:950}
      .ty-upload-main b{display:block;color:#071d49;font-size:14px;line-height:1.15;font-weight:950}
      .ty-upload-main small{display:block;margin-top:2px;color:#8b95a1;font-size:10.5px;line-height:1.22;font-weight:850}
      .ty-upload-main [data-passport-upload]{position:absolute;right:9px;top:50%;transform:translateY(-50%);border:1px solid rgba(235,129,75,.24);background:#fff6ef;color:#eb814b;border-radius:12px;min-height:36px;min-width:82px;padding:0 13px;font-size:13px;font-weight:950;font-family:inherit}
      .ty-passport-inline-scan{position:absolute;right:102px;top:50%;transform:translateY(-50%);display:none;align-items:center;justify-content:center;gap:4px;height:20px;z-index:2}
      .ty-passport-inline-scan i{width:6px;height:6px;border-radius:999px;background:#0062e3;display:block;opacity:.35;animation:tyPassportInlineDot .9s ease-in-out infinite}
      .ty-passport-inline-scan i:nth-child(2){animation-delay:.1s}.ty-passport-inline-scan i:nth-child(3){animation-delay:.2s}.ty-passport-inline-scan i:nth-child(4){animation-delay:.3s}.ty-passport-inline-scan i:nth-child(5){animation-delay:.4s}
      .ty-passport-upload-mini.is-scanning .ty-passport-inline-scan{display:flex}
      @keyframes tyPassportInlineDot{0%,100%{opacity:.28;transform:translateY(0) scale(.82)}50%{opacity:1;transform:translateY(-5px) scale(1.08)}}
      .ty-upload-main .ty-passport-file-input{position:absolute;right:9px;top:50%;transform:translateY(-50%);width:100px;height:42px;opacity:0;z-index:4;cursor:pointer}
      .ty-upload-main .ty-passport-upload-button{z-index:3;pointer-events:none}
      .ty-scan-review{margin:2px 2px 0;color:#64748b;font-size:10.5px;line-height:1.25;font-weight:750}
      .ty-scan-status:empty{display:none}.ty-scan-status{margin:2px 2px 0;color:#047857;font-size:11px;line-height:1.3;font-weight:850}.ty-scan-status.bad{color:#d93025}.ty-passport-upload-mini.is-scanning [data-passport-upload]{opacity:.62;cursor:wait}
      .ty-scan-status{margin:0 2px;color:#0f9f6e;font-size:11px;font-weight:850;line-height:1.25}
      .ty-scan-status.bad{color:#dc2626}
      
      @media(max-width:767px){
        body .ty-saved-search-box{min-height:46px!important;grid-template-columns:38px minmax(0,1fr)!important}
        body .ty-upload-main{padding-right:104px!important}
        body .ty-upload-main [data-passport-upload]{right:8px!important;padding:0 11px!important}
        body .ty-upload-main .ty-passport-file-input{right:8px!important;width:92px!important;height:42px!important}
        body .ty-passport-inline-scan{right:94px!important}
      }


    `;
    document.head.appendChild(style);
  }

  


  window.handleSelectFlight = handleSelectFlight;
  window.addEventListener("pageshow", function(ev){ if(ev.persisted || tyIsBackForwardNavigation()){ hideFlightSearchLoader(); hideBookingLoader(); } });

  loadLookups().finally(function(){
    const params = new URLSearchParams(location.search);
    const step = String(params.get("step") || "").toLowerCase();
    if(step === "booking-status"){
      injectStyles();
      injectCss();
      injectReviewTimerUpdateCss();
      injectItineraryCardCss();
      openBookingStatusFromUrl(params.get("bookingId") || params.get("id") || params.get("booking_id") || "");
      return;
    }
    if(step === "review"){
      if(tyPassportUploadIntentActive()) try{ hideBookingLoader(); }catch(e){}
      const selected = readSelectedFlightForReview();
      if(selected.length){
        try{ hideBookingLoader(); }catch(e){}
        renderFlightReviewStep(selected);
      }else loadFlights();
    }else{
      loadFlights();
    }
  });
})();

