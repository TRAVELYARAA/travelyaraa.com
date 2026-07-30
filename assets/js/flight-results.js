(function(){
  'use strict';

  var API_BASE = String(window.TRAVELYARAA_API_BASE || 'https://api.travelyaraa.com').replace(/\/+$/, '');
  var root = document.getElementById('travelRoot');
  if(!root) return;

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function readJSON(key){
    try{ return JSON.parse(sessionStorage.getItem(key) || 'null'); }catch(_){ return null; }
  }
  function params(){
    try{ return new URLSearchParams(location.search || ''); }catch(_){ return new URLSearchParams(); }
  }
  function money(n){
    var value = Number(n);
    if(!Number.isFinite(value) || value <= 0) return '';
    try{ return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value); }
    catch(_){ return '₹' + Math.round(value).toLocaleString('en-IN'); }
  }
  function timeOf(v){
    var s = text(v);
    if(!s) return '--:--';
    var d = new Date(s);
    if(!Number.isNaN(d.getTime())){
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    var m = s.match(/(\d{2}:\d{2})/);
    return m ? m[1] : s.slice(11, 16) || s;
  }
  function duration(mins){
    var n = Number(mins);
    if(!Number.isFinite(n) || n <= 0) return '';
    var h = Math.floor(n / 60);
    var m = n % 60;
    return h + 'h' + (m ? (' ' + m + 'm') : '');
  }
  function stopsLabel(stops){
    var n = Number(stops) || 0;
    if(n <= 0) return 'Non-stop';
    return n + (n === 1 ? ' stop' : ' stops');
  }

  function injectStyles(){
    if(document.getElementById('ty-flight-results-css')) return;
    var style = document.createElement('style');
    style.id = 'ty-flight-results-css';
    style.textContent = [
      ':root{--navy:#071d49;--blue:#0062e3;--bg:#f4f8fd;--line:#dbe7f4;--muted:#64748b;--orange:#eb814b}',
      '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--navy);font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif}',
      '.ty-fr{max-width:980px;margin:0 auto;padding:0 0 40px}',
      '.ty-fr-top{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:12px;min-height:64px;padding:12px 16px;background:#fff;border-bottom:1px solid var(--line)}',
      '.ty-fr-back{width:40px;height:40px;border:0;border-radius:12px;background:#f5f9ff;color:var(--blue);font-size:20px;font-weight:900;cursor:pointer}',
      '.ty-fr-top h1{margin:0;font-size:22px;font-weight:900}',
      '.ty-fr-meta{margin:0;color:var(--muted);font-size:12px;font-weight:700}',
      '.ty-fr-body{padding:14px}',
      '.ty-fr-summary{margin:0 0 12px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:#fff;font-size:13px;font-weight:750;color:var(--muted)}',
      '.ty-fr-summary b{color:var(--navy)}',
      '.ty-fr-list{display:grid;gap:12px}',
      '.ty-fr-card{border:1px solid var(--line);border-radius:16px;background:#fff;padding:14px;box-shadow:0 8px 22px rgba(7,29,73,.06)}',
      '.ty-fr-airline{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px}',
      '.ty-fr-airline b{display:block;font-size:15px}.ty-fr-airline span{display:block;margin-top:3px;color:var(--muted);font-size:12px;font-weight:700}',
      '.ty-fr-price{color:var(--navy);font-size:20px;font-weight:950;white-space:nowrap}',
      '.ty-fr-route{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center}',
      '.ty-fr-point strong{display:block;font-size:22px}.ty-fr-point small{display:block;margin-top:3px;color:var(--muted);font-size:11px;font-weight:700}',
      '.ty-fr-point.right{text-align:right}',
      '.ty-fr-mid{text-align:center;color:var(--muted);font-size:11px;font-weight:800}',
      '.ty-fr-line{height:1px;margin:6px 0;background:#a9bed8;position:relative}',
      '.ty-fr-line:before,.ty-fr-line:after{content:"";position:absolute;top:-3px;width:7px;height:7px;border:1.5px solid var(--blue);border-radius:50%;background:#fff}',
      '.ty-fr-line:before{left:0}.ty-fr-line:after{right:0}',
      '.ty-fr-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '.ty-fr-tag{padding:5px 10px;border-radius:999px;background:#eef5ff;color:var(--blue);font-size:11px;font-weight:850}',
      '.ty-fr-book{display:block;width:100%;margin-top:12px;border:0;border-radius:12px;background:var(--blue);color:#fff;padding:12px 14px;font-weight:900;cursor:pointer}',
      '.ty-fr-state{min-height:280px;display:grid;place-items:center;padding:28px 20px;border:1px solid var(--line);border-radius:16px;background:#fff;text-align:center}',
      '.ty-fr-state h2{margin:0;font-size:20px}.ty-fr-state p{margin:8px 0 0;color:var(--muted);font-size:13px;line-height:1.5;font-weight:650}',
      '.ty-fr-state a,.ty-fr-state button{display:inline-block;margin-top:14px;border:0;border-radius:11px;background:var(--blue);color:#fff;padding:11px 18px;text-decoration:none;font-weight:900;cursor:pointer}',
      '.ty-fr-loader{width:44px;height:44px;border:4px solid #dce8f7;border-top-color:var(--blue);border-radius:50%;animation:ty-fr-spin .8s linear infinite}',
      '@keyframes ty-fr-spin{to{transform:rotate(360deg)}}',
      '@media(max-width:620px){.ty-fr-top h1{font-size:18px}.ty-fr-point strong{font-size:18px}.ty-fr-price{font-size:18px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function searchContext(){
    return readJSON('tySearchContext') || readJSON('tySearchPayload') && readJSON('tySearchPayload').search || {};
  }

  function searchPayload(){
    return readJSON('ty_last_search_payload') || (readJSON('tySearchPayload') && readJSON('tySearchPayload').livePayload) || null;
  }

  function extractResults(data){
    if(!data) return [];
    if(Array.isArray(data.results)) return data.results;
    if(Array.isArray(data.items)) return data.items;
    if(Array.isArray(data.flights)) return data.flights;
    if(Array.isArray(data)) return data;
    var tripInfos = data.raw && data.raw.searchResult && data.raw.searchResult.tripInfos;
    if(tripInfos && Array.isArray(tripInfos.ONWARD)) return tripInfos.ONWARD;
    return [];
  }

  function normalizeFlight(item, index){
    if(!item || typeof item !== 'object') return null;
    if(item.airline || item.airlineCode || item.origin){
      return {
        id: text(item.id || item.priceId || ('flight-' + index)),
        airline: text(item.airline || 'Airline'),
        airlineCode: text(item.airlineCode || ''),
        flightNo: text(item.flightNo || ''),
        origin: text(item.origin || ''),
        destination: text(item.destination || ''),
        dep: text(item.dep || item.departureTime || ''),
        arr: text(item.arr || item.arrivalTime || ''),
        durationMinutes: Number(item.durationMinutes || item.duration || 0),
        stops: Number(item.stops || 0),
        price: Number(item.resultDisplayAmount || item.displayPrice || item.finalPrice || item.totalAmount || item.price || item.amount || 0),
        cabin: text(item.cabin || ''),
        baggage: text(item.baggage || ''),
        refundable: !!item.refundable,
        raw: item
      };
    }

    var segments = Array.isArray(item.sI) ? item.sI : [];
    var first = segments[0] || {};
    var last = segments[segments.length - 1] || first;
    var ai = (first.fD && first.fD.aI) || {};
    var priceList = Array.isArray(item.totalPriceList) ? item.totalPriceList : [];
    var fare = priceList[0] || {};
    var adult = (fare.fd && fare.fd.ADULT && fare.fd.ADULT.fC) || {};
    return {
      id: text(fare.id || first.id || ('flight-' + index)),
      airline: text(ai.name || 'Airline'),
      airlineCode: text(ai.code || ''),
      flightNo: text([ai.code, first.fD && first.fD.fN].filter(Boolean).join(' ')),
      origin: text((first.da && first.da.code) || ''),
      destination: text((last.aa && last.aa.code) || ''),
      dep: text(first.dt || ''),
      arr: text(last.at || ''),
      durationMinutes: Number(first.duration || 0),
      stops: Math.max(0, segments.length - 1),
      price: Number(adult.TF || adult.NF || 0),
      cabin: text((fare.fd && fare.fd.ADULT && fare.fd.ADULT.cc) || ''),
      baggage: text((fare.fd && fare.fd.ADULT && fare.fd.ADULT.bI && fare.fd.ADULT.bI.iB) || ''),
      refundable: Number((fare.fd && fare.fd.ADULT && fare.fd.ADULT.rT) || 0) > 0,
      raw: item
    };
  }

  function shell(title, metaHtml, bodyHtml){
    root.innerHTML =
      '<div class="ty-fr">' +
        '<header class="ty-fr-top">' +
          '<button class="ty-fr-back" type="button" id="tyFrBack" aria-label="Back">←</button>' +
          '<div><h1>' + esc(title) + '</h1>' + (metaHtml || '') + '</div>' +
        '</header>' +
        '<div class="ty-fr-body">' + bodyHtml + '</div>' +
      '</div>';
    var back = document.getElementById('tyFrBack');
    if(back) back.onclick = function(){ location.href = '/index.html'; };
  }

  function loadingView(){
    shell('Flight Results', '', '<div class="ty-fr-state"><div class="ty-fr-loader" aria-label="Loading flights"></div></div>');
  }

  function emptyView(message){
    shell(
      'Flight Results',
      '',
      '<div class="ty-fr-state"><div><h2>No flights found</h2><p>' + esc(message || 'Try another date or route.') + '</p><a href="/index.html">Modify search</a></div></div>'
    );
  }

  function errorView(message){
    shell(
      'Flight Results',
      '',
      '<div class="ty-fr-state"><div><h2>Search unavailable</h2><p>' + esc(message || 'Please try again.') + '</p><button type="button" id="tyFrRetry">Try again</button> <a href="/index.html">Back to search</a></div></div>'
    );
    var retry = document.getElementById('tyFrRetry');
    if(retry) retry.onclick = function(){ runSearch(true); };
  }

  function card(flight){
    var tags = [
      stopsLabel(flight.stops),
      duration(flight.durationMinutes),
      flight.cabin,
      flight.baggage,
      flight.refundable ? 'Refundable' : ''
    ].filter(Boolean).map(function(tag){ return '<span class="ty-fr-tag">' + esc(tag) + '</span>'; }).join('');

    return (
      '<article class="ty-fr-card" data-flight-id="' + esc(flight.id) + '">' +
        '<div class="ty-fr-airline"><div><b>' + esc(flight.airline) + '</b><span>' + esc([flight.flightNo, flight.airlineCode].filter(Boolean).join(' • ')) + '</span></div>' +
        '<div class="ty-fr-price">' + esc(money(flight.price) || '—') + '</div></div>' +
        '<div class="ty-fr-route">' +
          '<div class="ty-fr-point"><strong>' + esc(timeOf(flight.dep)) + '</strong><small>' + esc(flight.origin) + '</small></div>' +
          '<div class="ty-fr-mid"><div class="ty-fr-line"></div><span>' + esc(duration(flight.durationMinutes) || stopsLabel(flight.stops)) + '</span></div>' +
          '<div class="ty-fr-point right"><strong>' + esc(timeOf(flight.arr)) + '</strong><small>' + esc(flight.destination) + '</small></div>' +
        '</div>' +
        (tags ? '<div class="ty-fr-tags">' + tags + '</div>' : '') +
        '<button class="ty-fr-book" type="button" data-select-flight="' + esc(flight.id) + '">Book</button>' +
      '</article>'
    );
  }

  function renderResults(data, ctx){
    var rows = extractResults(data).map(normalizeFlight).filter(Boolean);
    if(!rows.length){
      emptyView(data && data.message ? data.message : 'No flights matched this search.');
      return;
    }

    var summary =
      '<div class="ty-fr-summary"><b>' + esc(text(ctx.from || rows[0].origin) || 'Origin') +
      '</b> → <b>' + esc(text(ctx.to || rows[0].destination) || 'Destination') +
      '</b> • ' + esc(text(ctx.depart) || '') +
      (ctx.traveller ? (' • ' + esc(ctx.traveller)) : '') +
      ' • ' + rows.length + ' options</div>';

    shell(
      'Flight Results',
      '<p class="ty-fr-meta">' + esc(text(ctx.from || rows[0].origin)) + ' → ' + esc(text(ctx.to || rows[0].destination)) + '</p>',
      summary + '<div class="ty-fr-list">' + rows.map(card).join('') + '</div>'
    );

    root.querySelectorAll('[data-select-flight]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-select-flight');
        var selected = rows.find(function(row){ return row.id === id; });
        if(!selected) return;
        try{
          sessionStorage.setItem('ty_selected_flight', JSON.stringify(selected.raw || selected));
          sessionStorage.setItem('ty_selected_booking_context', JSON.stringify({
            service: 'flight',
            selectedFlight: selected.raw || selected,
            search: ctx,
            selectedAt: new Date().toISOString()
          }));
        }catch(_){}
        location.href = '/index.html?service=flight&step=book&flightId=' + encodeURIComponent(id);
      };
    });
  }

  async function fetchLive(payload){
    var response = await fetch(API_BASE + '/api/flights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload || {}),
      cache: 'no-store'
    });
    var data = await response.json().catch(function(){ return {}; });
    if(!response.ok || data.success === false){
      var error = new Error(data.message || data.code || 'Flight search failed');
      error.status = response.status;
      throw error;
    }
    try{ sessionStorage.setItem('ty_live_results_flight', JSON.stringify(data)); }catch(_){}
    return data;
  }

  async function loadBookingStatus(bookingId){
    shell('Booking Status', '', '<div class="ty-fr-state"><div class="ty-fr-loader" aria-label="Loading booking"></div></div>');
    var token = '';
    try{ token = text(localStorage.getItem('ty_user_auth_token')); }catch(_){}
    if(!token){
      shell('Booking Status', '', '<div class="ty-fr-state"><div><h2>Login required</h2><p>Sign in to view this booking.</p><a href="/index.html?openLogin=1&redirect=' + encodeURIComponent(location.pathname + location.search) + '">Login</a></div></div>');
      return;
    }
    try{
      var response = await fetch(API_BASE + '/api/bookings/' + encodeURIComponent(bookingId) + '/status', {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
        cache: 'no-store'
      });
      var data = await response.json().catch(function(){ return {}; });
      if(!response.ok || data.success === false) throw new Error(data.message || 'Could not load booking status');
      var booking = data.booking || data.data || data;
      shell(
        'Booking Status',
        '<p class="ty-fr-meta">Booking ID: ' + esc(bookingId) + '</p>',
        '<div class="ty-fr-state"><div><h2>' + esc(text(booking.bookingStatus || booking.status || 'Status available')) + '</h2><p>Your booking details are ready in My Bookings.</p><a href="/my-bookings.html">Open My Bookings</a></div></div>'
      );
    }catch(error){
      shell('Booking Status', '', '<div class="ty-fr-state"><div><h2>Status unavailable</h2><p>' + esc(error.message || 'Please try again later.') + '</p><a href="/my-bookings.html">Open My Bookings</a></div></div>');
    }
  }

  async function runSearch(forceNetwork){
    var ctx = searchContext() || {};
    var cached = readJSON('ty_live_results_flight');
    var payload = searchPayload();

    loadingView();
    if(window.TravelYaraaLoader) window.TravelYaraaLoader.show('Please Wait, We are searching for the flights on this route');

    try{
      var data = null;
      if(!forceNetwork && cached && (Array.isArray(cached.results) || cached.success !== false)){
        data = cached;
      }else if(payload && payload.from && payload.to){
        data = await fetchLive(payload);
      }else if(cached){
        data = cached;
      }else{
        emptyView('Search details were missing. Please start a new flight search.');
        return;
      }

      if(data && data.success === false && !extractResults(data).length){
        errorView(data.message || 'Search is currently unavailable.');
        return;
      }
      renderResults(data, ctx);
    }catch(error){
      errorView(error.message || 'Search is currently unavailable.');
    }finally{
      if(window.TravelYaraaLoader) window.TravelYaraaLoader.hide();
    }
  }

  injectStyles();
  var query = params();
  var step = text(query.get('step'));
  var bookingId = text(query.get('bookingId'));
  if(step === 'booking-status' && bookingId){
    loadBookingStatus(bookingId);
  }else{
    runSearch(false);
  }
})();
