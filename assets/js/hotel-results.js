(function(){
'use strict';

function showLoader(msg, hideText){
  if(window.TYHotelSearchLoader && typeof window.TYHotelSearchLoader.show==='function') window.TYHotelSearchLoader.show(msg, hideText);
}
function hideLoader(){
  if(window.TYHotelSearchLoader && typeof window.TYHotelSearchLoader.hide==='function') window.TYHotelSearchLoader.hide();
}

const API = String(window.TRAVELYARAA_API_BASE || window.TY_API_BASE || 'https://api.travelyaraa.com').replace(/\/$/, '');
const root = document.getElementById('travelRoot') || document.getElementById('tyHotelResultsRoot');
if(!root) return;

const KEY = {
  payload:'ty_last_search_payload',
  search:'tySearchPayload',
  results:'ty_live_results_hotel',
  selected:'ty_selected_result_hotel',
  draft:'ty_booking_draft_hotel',
  status:'ty_hotel_booking_status'
};

const S = {
  all:[], shown:[], search:{}, sort:'api',
  filters:{
    priceRanges:new Set(), gst:null, propertyTypes:new Set(), places:new Set(),
    stars:new Set(), meals:new Set(), amenities:new Set(), min:0, max:0,
    freeCancel:false, nameQuery:''
  },
  filterTab:'price', roomHotel:null, selectedHotel:null, selectedOption:null, review:null,
  guestIndex:0, detailHotel:null, detailStatus:'idle', detailError:'',
  ui:{ calOpen:false, calStep:'start', calOffset:0, cityOpen:false, guestOpen:false, cityQuery:'', cityRows:[], cityStatus:'' }
};

function q(sel, ctx){ return (ctx||document).querySelector(sel); }
function qa(sel, ctx){ return Array.from((ctx||document).querySelectorAll(sel)); }
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(v){ return esc(v).replace(/`/g, '&#96;'); }
function read(k,d){ try{ const raw=sessionStorage.getItem(k); return raw?JSON.parse(raw):d; }catch(e){ return d; } }
function save(k,v){ try{ sessionStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function money(v){ const n=Number(v||0); return n>0 ? '₹' + Math.round(n).toLocaleString('en-IN') : 'Pending'; }
function arr(v){ return Array.isArray(v)?v:[]; }
function unwrap(d){ return d && d.data ? d.data : d; }
function text(v, fb){ return String(v == null || v === '' ? (fb||'') : v); }
function todayISO(){ const d=new Date(); return d.toISOString().slice(0,10); }
function newHotelClientRequestId(){
  try{ if(window.crypto && typeof window.crypto.randomUUID==='function') return 'TYHREQ-'+window.crypto.randomUUID(); }catch(e){}
  return 'TYHREQ-'+Date.now()+'-'+Math.random().toString(36).slice(2,12);
}
function nights(ci,co){ try{ const a=new Date(ci), b=new Date(co); const n=Math.round((b-a)/86400000); return n>0?n:1; }catch(e){ return 1; } }
function fmtDate(v){ if(!v) return ''; try{ return new Date(v).toLocaleDateString('en-GB',{weekday:'short', day:'2-digit', month:'short', year:'numeric'}).replace(',',''); }catch(e){ return String(v); } }
function friendlyError(err){
  const code = String((err && err.data && err.data.code) || (err && err.code) || '').toUpperCase();
  const m = String((err && err.message) || '').toLowerCase();
  if (code === 'HOTEL_CITY_AMBIGUOUS') return 'Multiple matching locations were found. Please choose an exact location from the suggestions.';
  if (code === 'HOTEL_CITY_NOT_FOUND' || code === 'HOTEL_CITY_REQUIRED') return 'Please select a valid hotel location from the suggestions and search again.';
  if (code === 'HOTEL_MAPPING_EMPTY') return 'Hotels are not available for this exact location yet. Please choose another nearby location.';
  if (code === 'HOTEL_NO_AVAILABILITY' || code === 'NO_AVAILABILITY') return 'No hotels are available for this location and these dates. Try another nearby location or different dates.';
  if (code === 'HOTEL_REVIEW_CONTEXT_REQUIRED') return 'Please wait for live room rates, then choose the room again.';
  if (code === 'HOTEL_SEARCH_EXPIRED') return 'Hotel rates have expired. Please search again for current availability and price.';
  if (code === 'HOTEL_SEARCH_CONTEXT_REQUIRED') return 'Your hotel search session expired. Please search again, then continue.';
  if (code === 'HOTEL_CITY_CATALOG_EMPTY') return 'We couldn’t load hotels right now. Please try again.';
  if (code === 'TRIPJACK_TIMEOUT') return 'Hotel search timed out. Please try again.';
  if (code === 'TRIPJACK_NETWORK_ERROR') return 'Unable to reach the hotel supplier. Please try again.';
  if (Number(err && err.status) === 403 || code === 'TRIPJACK_API_ERROR' && /403|forbidden|not allowed|access/i.test(String((err && err.message) || ''))) {
    return 'Hotel price validation was declined by the supplier. Please choose another room or search again.';
  }
  if (m.includes('city id') || m.includes('hotel city')) return 'Please select a valid hotel location from the suggestions and search again.';
  if (/failed to fetch|networkerror|load failed|network request failed/.test(m)) {
    return 'Network error while contacting the hotel API. Please check your connection and try again.';
  }
  if (/tripjack|supplier|provider|\/api\/|endpoint|regionid|\btoken\b|\bapi key\b/.test(m)) return 'We couldn’t load hotels right now. Please try again.';
  if (Number(err && err.status) >= 500) return 'We couldn’t load hotels right now. Please try again.';
  return (err && err.message) || 'We couldn’t load hotels right now. Please try again.';
}
function requestHeaders(path, json){
  const headers={Accept:'application/json'};
  if(json) headers['Content-Type']='application/json';
  if(/^\/api\/(bookings|travellers)(?:\/|$)/.test(String(path||''))){
    const auth=tyhGuestAuthToken();
    if(auth) headers.Authorization='Bearer '+auth;
  }
  return headers;
}
async function api(path, body, method){
  const verb=method||'POST';
  let res;
  try{
    res=await fetch(API+path,{method:verb,headers:requestHeaders(path,verb!=='GET'),body:(verb==='GET'?undefined:JSON.stringify(body||{})),cache:'no-store'});
  }catch(networkErr){
    const e=new Error((networkErr && networkErr.message) || 'Failed to fetch');
    e.code='NETWORK_FETCH_ERROR';
    e.cause=networkErr;
    e.request={method:verb,url:API+path};
    throw e;
  }
  const data=await res.json().catch(()=>({}));
  if(!res.ok || data.success===false){
    const e=new Error(data.message||data.error||data.code||('Request failed '+res.status));
    e.data=data; e.status=res.status; e.code=data.code||e.code;
    throw e;
  }
  return unwrap(data);
}
async function apiGet(path){ const res=await fetch(API+path,{headers:requestHeaders(path,false),cache:'no-store'}); const data=await res.json().catch(()=>({})); if(!res.ok || data.success===false){ const e=new Error(data.message||data.error||data.code||('Request failed '+res.status)); e.data=data; e.status=res.status; throw e; } return unwrap(data); }

function searchPayload(){
  const p = read(KEY.payload,{}) || {};
  const s = read(KEY.search,{}) || {};
  const live = s.livePayload || p.livePayload || p || {};
  return Object.assign({}, live, { service:'hotel', type:'hotel' });
}


function lower(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
function rawOf(h){ return (h && (h.raw || h.hInfo || h)) || {}; }
function firstText(){ for(const v of arguments){ if(v!==undefined && v!==null && String(v).trim()) return String(v).trim(); } return ''; }
function deepFind(obj, keys){
  const wanted=new Set(keys.map(k=>lower(k))); const seen=new Set(); let found='';
  (function walk(o){
    if(found || !o || typeof o!=='object' || seen.has(o)) return; seen.add(o);
    if(Array.isArray(o)){ o.slice(0,30).forEach(walk); return; }
    Object.keys(o).forEach(k=>{
      if(found) return;
      const v=o[k];
      if(wanted.has(lower(k)) && v!==undefined && v!==null && String(v).trim()) found=String(v).trim();
      else if(typeof v==='object') walk(v);
    });
  })(obj);
  return found;
}
function boolFind(obj, keys){ const v=deepFind(obj,keys); return /true|yes|y|1|applicable|available/i.test(v); }
function propertyTypeOf(h){ const r=rawOf(h); return firstText(h.propertyType,h.pt,r.propertyType,r.ht,r.pt,deepFind(r,['propertyType','property_type','hotelType','accommodationType'])); }
function placeOf(h){ const r=rawOf(h); return firstText(h.area,h.locality,h.location,r.area,r.locality,r.ad,deepFind(r,['area','locality','landmark','zone'])); }
function mealBasisOf(h){ const ops=optionList(h); const vals=ops.map(o=>o.mealBasis).filter(Boolean); return firstText(vals[0],h.mealBasis,deepFind(rawOf(h),['mealBasis','mb','boardBasis','roomPlan'])); }
function gstOf(h){
  const r=rawOf(h);
  const v=h.gstApplicable;
  if(v===true||v===false) return !!v;
  if(r.isGstApplicable===true||r.gstApplicable===true||r.gstEligible===true) return true;
  if(r.isGstApplicable===false||r.gstApplicable===false||r.gstEligible===false) return false;
  return null;
}
function hasRealGst(h){ return gstOf(h)!==null; }
function rankingOf(h){ const r=rawOf(h); const v=firstText(h.rank,h.popularity,h.score,r.rank,r.popularityScore,deepFind(r,['rank','popularity','popularityScore'])); const n=Number(v); return Number.isFinite(n)?n:NaN; }
function ratingCountOf(h){ const r=rawOf(h); const v=firstText(h.ratingCount,h.reviewCount,r.ratingCount,r.reviewCount); const x=Number(String(v).replace(/[^0-9.]/g,'')); return Number.isFinite(x)&&x>0?x:0; }
function priceRangeKey(p){ p=Number(p||0); if(!p) return ''; if(p<=2200) return '0-2200'; if(p<=2500) return '2201-2500'; if(p<=3000) return '2501-3000'; if(p<=3900) return '3001-3900'; if(p<=5600) return '3901-5600'; return '5601+'; }
function priceRangeLabel(k){ return ({'0-2200':'Up to ₹ 2,200','2201-2500':'₹ 2,201 – ₹ 2,500','2501-3000':'₹ 2,501 – ₹ 3,000','3001-3900':'₹ 3,001 – ₹ 3,900','3901-5600':'₹ 3,901 – ₹ 5,600','5601+':'₹ 5,601 +'}[k]||k); }
function countFor(fn){ return S.all.filter(fn).length; }
function hotelFreeCancel(h){
  if(h && (h.freeCancellation || (h.cancellation && h.cancellation.freeCancellation))) return true;
  return optionList(h).some(function(o){ return !!(o && o.freeCancellation); });
}
function hotelCancelText(h){
  const ops=optionList(h);
  const hit=ops.find(function(o){ return o && o.freeCancellation; })||{};
  const c=hit.cancellation||cancellationOf(hit);
  if(!c.freeCancellation) return '';
  return 'Free cancellation'+(c.freeCancellationUntil?' until '+fmtDate(c.freeCancellationUntil):'');
}
function searchIso(v){
  const s=String(v||'');
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t=Date.parse(s);
  if(!Number.isFinite(t)) return '';
  const d=new Date(t);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function uniqueValues(fn, max){ return [...new Set(S.all.map(fn).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,max||12); }

function mediaUrl(v){
  if(!v) return '';
  if(typeof v==='string') return /^https?:\/\//i.test(v) ? v : '';
  const links=v.links||{};
  const href=(links.Standard&&(links.Standard.href||links.Standard.url))||(links.XXL&&(links.XXL.href||links.XXL.url))||(links.original&&(links.original.href||links.original.url))||v.url||v.imageUrl||v.src||v.href||'';
  return /^https?:\/\//i.test(String(href)) ? String(href) : '';
}
function imageOf(h){ const raw=h.raw||h; const imgs=[h.image,h.imageUrl,h.heroImage,h.thumbnail,mediaUrl(h.images&&h.images[0]),mediaUrl(h.imgs&&h.imgs[0]),mediaUrl(raw.heroImage),mediaUrl(raw.images&&raw.images[0]),mediaUrl(raw.img&&raw.img[0])].filter(Boolean); return String(imgs[0]||''); }
function customerStayPrice(o,h){
  const pb=o&&o.pricingBreakup||{};
  const optionVals=[o&&o.resultDisplayAmount,o&&o.displayPrice,pb.resultDisplayAmount,pb.displayPrice,o&&o.price,o&&o.amount,o&&o.finalPrice,o&&o.totalAmount];
  for(const v of optionVals){ const n=Number(v); if(n>0) return n; }
  if(o&&(o.optionId||o.id||o.pricing||o.cancellation||o.roomInfo||o.roomSummary)) return 0;
  const hotelVals=[h&&h.resultDisplayAmount,h&&h.displayPrice,h&&h.price];
  for(const v of hotelVals){ const n=Number(v); if(n>0) return n; }
  return 0;
}
function priceOf(o,h){ return customerStayPrice(o,h); }
function penaltyAmount(p){ const n=Number(p&&(p.amount!=null?p.amount:p.am)); return Number.isFinite(n)?n:NaN; }
function penaltyTime(p, keys){ for(const k of keys){ const t=Date.parse(p&&p[k]); if(Number.isFinite(t)) return t; } return NaN; }
function currentZeroPenaltyUntil(penalties){
  const list=arr(penalties);
  if(!list.length) return '';
  const now=Date.now();
  const current=list.find(p=>{
    const amount=penaltyAmount(p);
    if(!Number.isFinite(amount)) return false;
    const from=penaltyTime(p,['from','fdt','fromDate']);
    const to=penaltyTime(p,['to','tdt','toDate']);
    if(Number.isFinite(from)&&Number.isFinite(to)) return now>=from && now<to;
    if(Number.isFinite(from)&&!Number.isFinite(to)) return now>=from;
    if(!Number.isFinite(from)&&Number.isFinite(to)) return now<to;
    return false;
  });
  if(!current || penaltyAmount(current)!==0) return '';
  return String(current.to||current.tdt||current.toDate||'');
}
function cancellationOf(op){
  const nested=op&&(op.cancellation&&(op.cancellation.raw||op.cancellation));
  const c=nested||(op&&op.cancellationPolicy)||(op&&op.cnp)||{};
  const penalties=arr(c.penalties).length?arr(c.penalties):(arr(c.pd).length?arr(c.pd):arr(op&&op.cancellation&&op.cancellation.penalties));
  const refundable=c.isRefundable!==undefined?!!c.isRefundable:(c.refundable!==undefined?!!c.refundable:!(c.isNonRefundable===true||c.nonRefundable===true||c.inra===true));
  const freeUntil=currentZeroPenaltyUntil(penalties);
  return {refundable,freeCancellation:!!freeUntil,freeCancellationUntil:freeUntil,penalties,raw:c};
}
function cancelBadge(o){
  const c=o&&o.cancellation||cancellationOf(o||{});
  if(!c.freeCancellation) return '';
  return '<span>Free cancellation'+(c.freeCancellationUntil?' until '+esc(fmtDate(c.freeCancellationUntil)):'')+'</span>';
}
function stayNightsLabel(){
  const s=S.search||{};
  const ctx=s.searchContext||{};
  const n=nights(s.checkIn||s.checkinDate||ctx.checkIn, s.checkOut||s.checkoutDate||ctx.checkOut);
  return 'Total for '+n+' night'+(n===1?'':'s');
}
function normOption(op, h, i){ op=op||{}; const rooms=arr(op.roomInfo).length?arr(op.roomInfo):(arr(op.rooms).length?arr(op.rooms):arr(op.ris)); const first=rooms[0]||{}; const id=String(op.optionId||op.id||op.code||op.op||'').trim(); const cancel=cancellationOf(op); const roomName=op.roomSummary||op.roomName||first.roomCategory||first.roomType||first.name||first.rc||first.rt||''; const meal=op.mealBasis||op.boardBasis||op.mb||first.mealBasis||first.boardBasis||first.mb||''; return { id:id, optionId:id, roomType:String(roomName), roomSummary:String(roomName), mealBasis:String(meal), totalPrice:priceOf(op,h), resultDisplayAmount:priceOf(op,h), baseFare:Number(op.baseFare||op.pricing&&op.pricing.basePrice||0), taxes:Number(op.taxes||op.pricing&&op.pricing.taxes||0), currency:op.currency||op.pricing&&op.pricing.currency||h.currency||'INR', refundable:cancel.refundable, freeCancellation:cancel.freeCancellation, cancellation:cancel, cancellationPolicy:cancel.raw, bookingNotes:op.bookingNotes||op.notes||[], rooms:rooms, raw:op }; }
function optionList(h){ const raw=h.raw||h; let ops=[]; if(arr(h.options).length) ops=arr(h.options); else if(arr(raw.options).length) ops=raw.options; else if(raw.option) ops=[raw.option]; else if(arr(raw.ops).length) ops=raw.ops; else if(arr(raw.hInfo&&raw.hInfo.ops).length) ops=raw.hInfo.ops; else if(arr(raw.data&&raw.data.hInfo&&raw.data.hInfo.ops).length) ops=raw.data.hInfo.ops; return ops.map((op,i)=>normOption(op,h,i)); }
function realHotelId(h){ return String((h&&(h.hotelId||h.tjHotelId||h.id))||'').trim(); }
function realOptionId(o){ const id=String((o&&(o.optionId||o.id))||'').trim(); if(!id||/^room_\d+$/i.test(id)) return ''; return id; }
function realReviewHash(h){ return String((h&&h.reviewHash)||'').trim(); }
function hasPricingReviewContext(h){ return S.detailStatus==='ready' && !!realHotelId(h) && !!realReviewHash(h) && optionList(h).some(function(o){ return !!realOptionId(o); }); }
function roomRateArticle(o, allowContinue){
  const id=realOptionId(o);
  const action=allowContinue&&id?'<button type="button" data-review-room="'+attr(id)+'">Continue</button>':'';
  return '<article class="tyh-rate"><div class="tyh-rate-main">'+(o.roomSummary||o.roomType?'<b>'+esc(o.roomSummary||o.roomType)+'</b>':'')+(o.mealBasis?'<p>'+esc(o.mealBasis)+'</p>':'')+cancelBadge(o)+'</div><div class="tyh-rate-side"><strong>'+esc(money(o.totalPrice||o.resultDisplayAmount))+'</strong><em>'+esc(stayNightsLabel())+'</em>'+action+'</div></article>';
}
function roomRatesHtml(h){
  if(S.detailStatus==='loading'){
    const listing=optionList(h);
    return (listing.length?'<div class="tyh-detail-rooms">'+listing.map(function(o){ return roomRateArticle(o,false); }).join('')+'</div>':'')+'<p class="tyh-muted">Loading live room rates…</p>';
  }
  if(S.detailStatus==='error'){
    return '<p class="tyh-muted">'+esc(S.detailError||'We couldn’t load hotels right now. Please try again.')+'</p><button type="button" data-retry-detail>Try again</button>';
  }
  if(!hasPricingReviewContext(h)){
    return '<p class="tyh-muted">Live room rates are not ready yet. Please wait or try again.</p><button type="button" data-retry-detail>Try again</button>';
  }
  const ops=optionList(h).filter(function(o){ return !!realOptionId(o); });
  if(!ops.length) return '<p class="tyh-muted">Room options are unavailable for this hotel.</p>';
  return '<div class="tyh-detail-rooms">'+ops.map(function(o){ return roomRateArticle(o,true); }).join('')+'</div>';
}
function amenityName(x){ return typeof x==='string'?x:(x&&x.name||x&&x.label||x&&x.description||x&&x.value||''); }
function amenitiesOf(h){ const raw=h.raw||h; const vals=[].concat(arr(h.amenities),arr(h.facilities),arr(raw.amenities),arr(raw.facilities),arr(raw.hotelFacilities),arr(raw.fl),arr(raw.inst).map(x=>x&&x.msg),arr(raw.ops&&raw.ops[0]&&raw.ops[0].ris&&raw.ops[0].ris[0]&&raw.ops[0].ris[0].fcs)); return vals.map(amenityName).filter(Boolean).map(String); }
function normHotel(h,i){
  h=h||{};
  const raw=h.raw||h;
  const hInfo=raw.hotel||raw.hotelInfo||raw.hInfo || (raw.data&&(raw.data.hotel||raw.data.hotelInfo||raw.data.hInfo)) || h.hInfo || null;
  if(hInfo) h=Object.assign({}, hInfo, h, {raw:raw});
  const name=h.name||h.hotelName||h.propertyName||(hInfo&&hInfo.name)||'';
  const options=optionList(Object.assign({},h,{raw:raw}));
  const optionPrice=options.reduce(function(min,o){ const n=Number(o.totalPrice||0); return n>0&&(min===0||n<min)?n:min; },0);
  const price=Number(h.resultDisplayAmount||h.displayPrice||h.price||optionPrice||0);
  const context=h.searchContext||raw.searchContext||S.search.searchContext||{};
  const id=h.tjHotelId||h.hotelId||h.id||h.hid||'';
  const base={
    key:String(id||h.uid||('hotel_'+i)),
    id:id, hotelId:id, tjHotelId:id,
    name:name, area:h.area||h.locality||h.location||'', address:typeof h.address==='string'?h.address:(h.address&&h.address.addressLine1)||h.ad||'',
    city:h.city||h.cityName||context.cityName||'', country:h.country||h.countryName||h.cnt||context.countryName||'',
    star:Number(h.starRating||h.star||h.rt||0), rating:Number(h.userRating||h.rating||h.ur||0),
    ratingCount:ratingCountOf(Object.assign({},h,{raw:raw})),
    image:imageOf(Object.assign({},h,{raw:raw})), amenities:amenitiesOf(Object.assign({},h,{raw:raw})),
    options:options, price:price, currency:h.currency||context.currency||'INR', reviewHash:h.reviewHash||raw.reviewHash||'', searchContext:context, correlationId:h.correlationId||context.correlationId||'', raw:raw
  };
  base.propertyType=propertyTypeOf(Object.assign({},base,h,{raw:raw}));
  base.place=placeOf(Object.assign({},base,h,{raw:raw}));
  base.mealBasis=mealBasisOf(Object.assign({},base,h,{raw:raw}));
  base.gstApplicable=gstOf(Object.assign({},base,h,{raw:raw}));
  base.rank=rankingOf(Object.assign({},base,h,{raw:raw}));
  return base;
}
function extractResults(data){ data=unwrap(data)||{}; const context=data.searchContext||{}; const list=data.results||data.hotels||data.items||data.data||data.hotelInfos||data.hInfoList||data.searchResult||[]; return arr(list).map((h,i)=>normHotel(Object.assign({},h,{searchContext:h.searchContext||context}),i)); }

function setPage(step, extra){ const url='/pages/results/hotels.html?service=hotel&step='+encodeURIComponent(step||'results')+(extra?'&'+extra:''); try{ history.pushState({service:'hotel',step},'',url); }catch(e){} }
function logoHtml(){ return '<a class="tyh-logo" href="/" aria-label="TravelYaraa"><img src="/travelyaraa-logo-transparent.png" alt="TravelYaraa"></a>'; }
function shell(content, opts){
  opts=opts||{};
  const s=S.search||{};
  const title=opts.title || s.cityName || s.city || s.destination || s.location || 'Hotels';
  const sub=[s.checkIn||s.checkinDate, s.checkOut||s.checkoutDate].filter(Boolean).map(fmtDate).join(' to ');
  root.innerHTML = '<style>'+css()+'</style><div class="tyh-page"><div class="tyh-shell"><header class="tyh-top"><button type="button" class="tyh-back" data-back>‹</button>'+logoHtml()+'<div class="tyh-top-title"><h1>'+esc(title)+'</h1><p>'+esc(opts.sub||sub||'Select your stay')+'</p></div>'+(opts.status?'<span class="tyh-status-pill">'+esc(opts.status)+'</span>':'')+'</header>'+content+'</div></div>';
  bindBase();
}
function bindBase(){ const b=q('[data-back]',root); if(b) b.onclick=()=>{ if(new URLSearchParams(location.search).get('step')&&new URLSearchParams(location.search).get('step')!=='results') { setPage('results'); renderResults(); } else history.back(); }; }

function hotelSearchExpired(data){ const d=unwrap(data)||{}; const expires=d.expiresAt||d.searchContext&&d.searchContext.expiresAt; return !!(expires && Date.parse(expires)<=Date.now()); }
function cacheMatchesCurrentSearch(stored, search){
  const d=unwrap(stored)||{};
  const want=String((search&& (search.regionId||search.cityId))||'');
  const got=String(d.selectedRegionId || (d.searchContext&&d.searchContext.regionId) || '');
  if(!/^\d+$/.test(want) || !/^\d+$/.test(got) || want!==got) return false;
  return true;
}
let hotelSearchLock=null;
async function loadResults(){
  S.search=searchPayload();
  const pendingTitle=S.search.cityName||S.search.city||S.search.destination||'Hotels';
  shell('<main class="tyh-results tyh-results-pending"><section class="tyh-list-wrap"><div class="tyh-list-head"><div><strong>Searching hotels in '+esc(pendingTitle)+'</strong><span>'+esc([fmtDate(S.search.checkIn||S.search.checkinDate),fmtDate(S.search.checkOut||S.search.checkoutDate)].filter(Boolean).join(' • '))+'</span></div></div><div class="tyh-cards"></div></section></main>',{title:pendingTitle});
  showLoader('Finding the best hotels for you...');
  if(!/^\d+$/.test(String(S.search.regionId||S.search.cityId||''))){
    hideLoader();
    shell('<main class="tyh-empty"><h2>Select a location</h2><p>'+esc('Please select a valid hotel location from the suggestions and search again.')+'</p><button type="button" data-try>Back to search</button></main>',{title:'Hotels'});
    const t=q('[data-try]',root); if(t)t.onclick=()=>location.href='/';
    return;
  }
  const searchKey=JSON.stringify({regionId:String(S.search.regionId||S.search.cityId||''),checkIn:S.search.checkIn||S.search.checkinDate||'',checkOut:S.search.checkOut||S.search.checkoutDate||'',rooms:S.search.rooms||[]});
  if(hotelSearchLock && hotelSearchLock.key===searchKey) return hotelSearchLock.promise;
  const job={key:searchKey, promise:null};
  job.promise=(async function(){
    try{
      const res=await api('/api/hotels/search',S.search);
      save(KEY.results,res);
      const d=unwrap(res)||{};
      S.search=Object.assign({},S.search,{searchContext:d.searchContext||{}});
      const list=extractResults(res);
      if(!list.length){
        const reason=String(d.emptyReason||'').toUpperCase();
        const message = reason==='NO_AVAILABILITY'
          ? 'No hotels are available for this location and these dates. Try another nearby location or different dates.'
          : reason==='HOTEL_MAPPING_EMPTY'
            ? 'Hotels are not available for this exact location yet. Please choose another nearby location.'
          : reason==='NO_BOOKABLE_PRICE'
            ? 'Hotels were found, but none currently have a bookable price for these dates.'
            : reason==='FILTERED_EMPTY'
              ? 'No hotels match the selected filters.'
              : 'No bookable hotels were found for this location and dates.';
        shell('<main class="tyh-empty"><h2>No hotels found</h2><p>'+esc(message)+'</p><button type="button" data-try>Back to search</button></main>',{title:'Hotels'});
        const t=q('[data-try]',root); if(t)t.onclick=()=>location.href='/';
        return;
      }
      setResults(list);
    }catch(e){
      shell('<main class="tyh-empty"><h2>Unable to load hotels</h2><p>'+esc(friendlyError(e))+'</p><button type="button" data-try>Back to search</button></main>',{title:'Hotels'});
      const t=q('[data-try]',root); if(t)t.onclick=()=>location.href='/';
    }finally{
      hideLoader();
      if(hotelSearchLock===job) hotelSearchLock=null;
    }
  })();
  hotelSearchLock=job;
  return job.promise;
}
function setResults(list){ S.all=list; applyFilters(); maybeShowHotelDetailsFromUrl(); }
function applyFilters(){
  let list=S.all.slice();
  if(S.filters.priceRanges.size) list=list.filter(h=>S.filters.priceRanges.has(priceRangeKey(h.price)));
  if(S.filters.gst!==null) list=list.filter(h=>gstOf(h)===S.filters.gst);
  if(S.filters.propertyTypes.size) list=list.filter(h=>S.filters.propertyTypes.has(lower(propertyTypeOf(h))));
  if(S.filters.places.size) list=list.filter(h=>S.filters.places.has(lower(placeOf(h))));
  if(S.filters.stars.size) list=list.filter(h=>S.filters.stars.has(String(Math.round(h.star)||0)));
  if(S.filters.meals.size) list=list.filter(h=>S.filters.meals.has(lower(mealBasisOf(h))));
  if(S.filters.amenities.size){ list=list.filter(h=>{ const hay=(h.amenities||[]).join(' ').toLowerCase(); return [...S.filters.amenities].every(a=>hay.includes(a)); }); }
  if(S.filters.freeCancel) list=list.filter(hotelFreeCancel);
  if(S.filters.nameQuery) list=list.filter(h=>lower(h.name).includes(lower(S.filters.nameQuery)));
  if(S.filters.min) list=list.filter(h=>Number(h.price||0)>=S.filters.min);
  if(S.filters.max) list=list.filter(h=>Number(h.price||0)<=S.filters.max);
  if(S.sort==='priceLow') list.sort((a,b)=>(a.price||9999999)-(b.price||9999999));
  else if(S.sort==='priceHigh') list.sort((a,b)=>(b.price||0)-(a.price||0));
  else if(S.sort==='starHigh') list.sort((a,b)=>(b.star||0)-(a.star||0)||((a.price||9999999)-(b.price||9999999)));
  else if(S.sort==='rank') list.sort((a,b)=>(Number.isFinite(b.rank)?b.rank:-Infinity)-(Number.isFinite(a.rank)?a.rank:-Infinity));
  S.shown=list;
  renderResults();
}
function activeFilterCount(){ return S.filters.priceRanges.size + (S.filters.gst!==null?1:0) + S.filters.propertyTypes.size + S.filters.places.size + S.filters.stars.size + S.filters.meals.size + S.filters.amenities.size + (S.filters.min?1:0) + (S.filters.max?1:0) + (S.filters.freeCancel?1:0) + (S.filters.nameQuery?1:0); }
function filterOption(kind,value,label,count){ const key=String(value); const checked = kind==='gst' ? (S.filters.gst===value) : kind==='freeCancel' ? !!S.filters.freeCancel : (S.filters[kind]&&S.filters[kind].has(key)); return '<label class="tyh-fcheck"><input type="checkbox" data-fkind="'+attr(kind)+'" data-fvalue="'+attr(key)+'" '+(checked?'checked':'')+'><span></span><b>'+esc(label)+'</b><em>('+(count||0)+')</em></label>'; }
function sortOptions(){
  const opts=[{value:'api',label:'Relevance',sub:'Search order'}];
  if(S.all.some(function(h){ return Number.isFinite(h.rank); })) opts.unshift({value:'rank',label:'Most popular',sub:'Highest rank first'});
  opts.push({value:'priceLow',label:'Price',sub:'Lowest first'},{value:'priceHigh',label:'Price',sub:'Highest first'});
  if(S.all.some(function(h){ return Number(h.star||0)>0; })) opts.push({value:'starHigh',label:'Star rating',sub:'High to low'});
  return opts;
}
function filterPanel(){
  const mealVals=uniqueValues(mealBasisOf,16);
  const typeVals=uniqueValues(propertyTypeOf,16);
  const placeVals=uniqueValues(placeOf,16);
  const priceKeys=['0-2200','2201-2500','2501-3000','3001-3900','3901-5600','5601+'].filter(function(k){ return countFor(function(h){ return priceRangeKey(h.price)===k; })>0; });
  const starBody=[5,4,3,2,1].filter(function(v){ return countFor(function(h){ return String(Math.round(h.star)||0)===String(v); }); }).map(function(v){ return filterOption('stars',String(v),v+' star',countFor(function(h){ return String(Math.round(h.star)||0)===String(v); })); }).join('');
  const mealBody=mealVals.map(function(v){ return filterOption('meals',lower(v),v,countFor(function(h){ return lower(mealBasisOf(h))===lower(v); })); }).join('');
  const typeBody=typeVals.map(function(v){ return filterOption('propertyTypes',lower(v),v,countFor(function(h){ return lower(propertyTypeOf(h))===lower(v); })); }).join('');
  const placeBody=placeVals.map(function(v){ return filterOption('places',lower(v),v,countFor(function(h){ return lower(placeOf(h))===lower(v); })); }).join('');
  const freeCount=countFor(hotelFreeCancel);
  const gstYes=countFor(function(h){ return gstOf(h)===true; });
  const gstKnown=S.all.some(hasRealGst);
  const priceBody=priceKeys.map(function(k){ return filterOption('priceRanges',k,priceRangeLabel(k),countFor(function(h){ return priceRangeKey(h.price)===k; })); }).join('');
  const amenityKeys=['wifi','pool','parking','breakfast','air conditioning'].filter(function(a){
    return countFor(function(h){ const hay=(h.amenities||[]).join(' ').toLowerCase(); return hay.includes(a); })>0;
  });
  const amenityBody=amenityKeys.map(function(a){
    const label=a.replace(/\b\w/g,function(c){ return c.toUpperCase(); });
    return filterOption('amenities',a,label,countFor(function(h){ const hay=(h.amenities||[]).join(' ').toLowerCase(); return hay.includes(a); }));
  }).join('');
  return '<aside class="tyh-filter" data-filter-panel><div class="tyh-filter-head"><button type="button" data-filter-close aria-label="Close filters">‹</button><h2>Filters</h2><button type="button" data-clear-top>Reset</button></div><div class="tyh-filter-stack">'
    +'<div class="tyh-filter-section"><h3>Search by Hotel Name</h3><input type="search" data-hotel-name value="'+attr(S.filters.nameQuery||'')+'" placeholder="Hotel name"></div>'
    +(freeCount?'<div class="tyh-filter-section"><h3>Free Cancellation Available</h3>'+filterOption('freeCancel','true','Free cancellation',freeCount)+'</div>':'')
    +(starBody?'<div class="tyh-filter-section"><h3>Star Category</h3>'+starBody+'</div>':'')
    +(mealBody?'<div class="tyh-filter-section"><h3>Meal Basis</h3>'+mealBody+'</div>':'')
    +(priceBody?'<div class="tyh-filter-section"><h3>Price Range</h3>'+priceBody+'</div>':'')
    +(amenityBody?'<div class="tyh-filter-section"><h3>Amenities</h3>'+amenityBody+'</div>':'')
    +(gstKnown&&gstYes?'<div class="tyh-filter-section"><h3>GST Applicable</h3>'+filterOption('gst',true,'GST applicable',gstYes)+'</div>':'')
    +(typeBody?'<div class="tyh-filter-section"><h3>Property Type</h3>'+typeBody+'</div>':'')
    +(placeBody?'<div class="tyh-filter-section"><h3>Popular Places</h3>'+placeBody+'</div>':'')
    +'</div><div class="tyh-filter-actions"><button type="button" data-filter-close>Close</button><button type="button" data-apply>Apply filter</button></div></aside>';
}
function sortSheet(){
  return '<div class="tyh-sort-bg" data-sort-close></div><section class="tyh-sort-sheet"><header><h2>Sort by</h2><button type="button" data-sort-close>×</button></header>'+sortOptions().map(function(x){ return '<button type="button" class="'+(S.sort===x.value?'active':'')+'" data-sort-pick="'+x.value+'"><b>'+esc(x.label)+(x.sub?' <span>'+esc(x.sub)+'</span>':'')+'</b><i></i></button>'; }).join('')+'</section>';
}
function startDay(d){ const x=new Date(d||new Date()); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=startDay(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d,n){ const s=startDay(d), day=s.getDate(); let x=new Date(s.getFullYear(), s.getMonth()+n, day); if(x.getDate()!==day) x=new Date(x.getFullYear(), x.getMonth(), 0); x.setHours(0,0,0,0); return x; }
function sameDay(a,b){ return a&&b&&startDay(a).getTime()===startDay(b).getTime(); }
function isoFromDate(d){ const x=startDay(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
function parseIsoDate(v){ const s=searchIso(v); if(!s) return null; const p=s.split('-').map(Number); return startDay(new Date(p[0],p[1]-1,p[2])); }
function todayBound(){ return startDay(new Date()); }
function maxBound(){ return addMonths(todayBound(),12); }
function searchDates(){
  const s=S.search||{};
  let ci=parseIsoDate(s.checkIn||s.checkinDate)||todayBound();
  let co=parseIsoDate(s.checkOut||s.checkoutDate)||addDays(ci,1);
  const min=todayBound(), max=maxBound();
  if(ci<min) ci=min;
  if(ci>max) ci=max;
  if(co<=ci) co=addDays(ci,1);
  if(co>max) co=max;
  if(co<=ci){ ci=addDays(max,-1); if(ci<min) ci=min; co=max; if(co<=ci) co=addDays(ci,1); }
  return {checkIn:isoFromDate(ci), checkOut:isoFromDate(co), nights:nights(isoFromDate(ci),isoFromDate(co))};
}
function guestState(){
  const s=S.search||{};
  const room=arr(s.rooms)[0]||{};
  return {
    rooms:Math.max(1, Math.min(6, Number(arr(s.rooms).length||s.roomCount||1))),
    adults:Math.max(1, Math.min(12, Number(room.adults||s.adults||1))),
    children:Math.max(0, Math.min(12, Number(room.children||s.children||0)))
  };
}
function guestSummary(){
  const g=guestState();
  return g.rooms+' Room'+(g.rooms===1?'':'s')+' '+g.adults+' Adult'+(g.adults===1?'':'s')+(g.children?(' '+g.children+' Child'+(g.children===1?'':'ren')):'');
}
function hotelCityNorm(s){ return String(s||'').toUpperCase().replace(/[.,]/g,' ').replace(/\s+/g,' ').trim(); }
function hotelCityParts(r){
  const full=String((r&&(r.fullRegionName||r.fullName||r.label))||'').trim();
  if(full) return full.split(/\s*,\s*/).map(function(x){ return String(x||'').trim(); }).filter(Boolean);
  return [r&&(r.cityName||r.name||r.city), r&&r.state, r&&r.country].map(function(x){ return String(x||'').trim(); }).filter(Boolean);
}
function rankHotelCityRows(rows, query){
  const q=hotelCityNorm(query);
  const list=(rows||[]).slice();
  if(!q||!list.length) return list;
  list.forEach(function(r,i){ r._ord=i; });
  function typeRank(r){ const t=String(r.regionType||'').toUpperCase(); if(t==='MULTI_CITY_VICINITY') return 0; if(t==='CITY') return 1; if(t==='PROVINCE_STATE') return 2; return 3; }
  function partsOf(r){ return hotelCityParts(r).map(hotelCityNorm); }
  function exactName(r){ return hotelCityNorm(r.cityName||r.name||r.city)===q; }
  function clusterKey(r){ const parts=partsOf(r); const hit=parts.find(function(p){ return p===q||p.split(' ').indexOf(q)>=0||p.indexOf(q)>=0; }); return String(hit||parts.slice(-2).join('|'))+'|'+hotelCityNorm(r.country); }
  const counts={}; list.forEach(function(r){ const k=clusterKey(r); counts[k]=(counts[k]||0)+1; });
  let bestK='', bestN=0; Object.keys(counts).forEach(function(k){ if(counts[k]>bestN){ bestN=counts[k]; bestK=k; } });
  list.sort(function(a,b){
    const aDom=bestN>=3&&clusterKey(a)===bestK?0:1, bDom=bestN>=3&&clusterKey(b)===bestK?0:1;
    if(aDom!==bDom) return aDom-bDom;
    const ta=typeRank(a), tb=typeRank(b); if(ta!==tb) return ta-tb;
    const ea=exactName(a)?0:1, eb=exactName(b)?0:1; if(ea!==eb) return ea-eb;
    const na=hotelCityNorm(a.cityName||a.name), nb=hotelCityNorm(b.cityName||b.name);
    const sa=na.indexOf(q)===0?0:1, sb=nb.indexOf(q)===0?0:1; if(sa!==sb) return sa-sb;
    return (a._ord||0)-(b._ord||0);
  });
  return list;
}
function normalizeCityRows(raw){
  const base=raw&&raw.data?raw.data:raw;
  const source=base&&(Array.isArray(base.results)?base.results:Array.isArray(base.cities)?base.cities:Array.isArray(base.items)?base.items:Array.isArray(base)?base:[]);
  const list=[]; const seen=new Set();
  (Array.isArray(source)?source:[]).forEach(function(item){
    if(!item||typeof item!=='object') return;
    const nested=item.raw&&typeof item.raw==='object'?item.raw:{};
    const id=String(item.regionId||item.cityRegionId||nested.regionId||nested.cityRegionId||item.id||item.cityId||'');
    if(!/^\d+$/.test(id)||seen.has(id)) return;
    const name=item.cityName||item.regionName||item.name||item.city||nested.cityName||nested.regionName||item.fullRegionName||'';
    if(!name) return;
    seen.add(id);
    list.push({id:id,cityId:id,regionId:id,name:String(name),cityName:String(item.cityName||nested.cityName||name),regionName:String(item.regionName||nested.regionName||''),regionType:String(item.regionType||nested.regionType||''),fullRegionName:String(item.fullRegionName||nested.fullRegionName||item.fullName||item.label||''),state:String(item.state||item.stateName||''),country:String(item.country||item.countryName||nested.countryName||''),lat:item.lat||item.latitude||'',lng:item.lng||item.lon||item.longitude||''});
  });
  return list;
}
async function fetchHotelCities(term){
  const q=String(term||'').trim();
  const url=API+'/api/hotels/static-cities?query='+encodeURIComponent(q)+'&limit='+encodeURIComponent(q?40:20)+(q?'':'&popular=1');
  const res=await fetch(url,{cache:'no-store'});
  const data=await res.json().catch(function(){ return {}; });
  return rankHotelCityRows(normalizeCityRows(data), q);
}
function cityPickerHtml(){
  if(!S.ui.cityOpen) return '';
  const rows=arr(S.ui.cityRows);
  return '<div class="tyh-pop-bg" data-city-close></div><section class="tyh-city-pop" role="dialog" aria-label="City / Area / Property"><header><h2>City / Area / Property</h2><button type="button" data-city-close>×</button></header><input type="search" data-city-input value="'+attr(S.ui.cityQuery||'')+'" placeholder="Location, landmark, or property" autofocus><div class="tyh-city-list">'+(S.ui.cityStatus?'<p class="tyh-muted">'+esc(S.ui.cityStatus)+'</p>':'')+rows.map(function(r){ const parts=hotelCityParts(r); const title=parts[0]||r.cityName||r.name; const sub=parts.slice(1).join(', '); return '<button type="button" class="tyh-city-row" data-pick-city="'+attr(r.regionId)+'" data-city-name="'+attr(title)+'" data-city-sub="'+attr(sub)+'" data-city-country="'+attr(r.country||'')+'"><b>'+esc(title)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</button>'; }).join('')+'</div></section>';
}
function guestPopupHtml(){
  if(!S.ui.guestOpen) return '';
  const g=guestState();
  function row(title,sub,key,val,minusOff,plusOff){ return '<div class="tyh-guest-row-ctrl"><div><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div><div class="tyh-step"><button type="button" data-guest-delta="'+key+':-1" '+(minusOff?'disabled':'')+'>-</button><span>'+esc(val)+'</span><button type="button" data-guest-delta="'+key+':1" '+(plusOff?'disabled':'')+'>+</button></div></div>'; }
  const total=g.adults+g.children;
  return '<div class="tyh-pop-bg" data-guest-close></div><section class="tyh-guest-pop" role="dialog" aria-label="Rooms & Guests"><header><h2>Rooms &amp; Guests</h2><button type="button" data-guest-close>×</button></header>'+row('Rooms','Maximum 6 rooms','rooms',g.rooms,g.rooms<=1,g.rooms>=6)+row('Adults','12 yrs & above','adults',g.adults,g.adults<=1,total>=12)+row('Children','Below 12 yrs','children',g.children,g.children<=0,total>=12)+'<button type="button" class="tyh-guest-done" data-guest-close>Done</button></section>';
}
function calendarHtml(){
  if(!S.ui.calOpen) return '';
  const dates=searchDates();
  const start=parseIsoDate(dates.checkIn);
  const end=parseIsoDate(dates.checkOut);
  const min=todayBound();
  const max=maxBound();
  const step=S.ui.calStep||'start';
  const minSel=step==='end'&&start?addDays(start,1):min;
  const offset=Math.max(0, Math.min(11, Number(S.ui.calOffset||0)));
  const mobile=isMobileHotelUi();
  function monthHtml(off){
    const base=new Date(min.getFullYear(), min.getMonth()+off, 1);
    let html='<div class="tyh-cal-month"><div class="tyh-cal-month-title">'+esc(base.toLocaleDateString('en-GB',{month:'long',year:'numeric'}))+'</div><div class="tyh-cal-week">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function(x){ return '<span>'+x+'</span>'; }).join('')+'</div><div class="tyh-cal-days">';
    for(let b=0;b<base.getDay();b++) html+='<button type="button" class="tyh-cal-day blank" disabled></button>';
    const maxDays=new Date(base.getFullYear(), base.getMonth()+1, 0).getDate();
    for(let d=1;d<=maxDays;d++){
      const date=startDay(new Date(base.getFullYear(), base.getMonth(), d));
      const iso=isoFromDate(date);
      const disabled=date<minSel||date>max;
      const cls=['tyh-cal-day'];
      if(sameDay(date,min)) cls.push('today');
      if(sameDay(date,start)) cls.push('selected','range-start');
      if(sameDay(date,end)) cls.push('selected','range-end');
      if(start&&end&&date>start&&date<end) cls.push('in-range');
      if(disabled) cls.push('disabled');
      html+='<button type="button" class="'+cls.join(' ')+'" data-cal-day="'+iso+'" '+(disabled?'disabled':'')+'>'+d+'</button>';
    }
    return html+'</div></div>';
  }
  let months='';
  if(mobile){ for(let i=0;i<12;i++) months+=monthHtml(i); }
  else { months=monthHtml(offset)+monthHtml(offset+1); }
  return '<div class="tyh-pop-bg" data-cal-close></div><section class="tyh-cal" role="dialog" aria-label="Select dates"><header><button type="button" data-cal-prev '+(offset<=0||mobile?'hidden':'')+'>‹</button><div><h2>Select Check-in &amp; Check-out</h2></div><button type="button" data-cal-next '+(offset>=11||mobile?'hidden':'')+'>›</button><button type="button" data-cal-close>×</button></header><div class="tyh-cal-selected"><button type="button" class="'+(step==='start'?'active':'')+'" data-cal-step="start"><small>Check-in</small><b>'+esc(fmtDate(dates.checkIn))+'</b></button><button type="button" class="'+(step==='end'?'active':'')+'" data-cal-step="end"><small>Check-out</small><b>'+esc(fmtDate(dates.checkOut))+'</b></button></div><div class="tyh-cal-months">'+months+'</div></section>';
}
function modifySearchBar(){
  const s=S.search||{};
  const dates=searchDates();
  const dest=s.cityName||s.city||'';
  const sub=s.area||s.fullRegionName||'';
  return '<form class="tyh-modify" data-modify-search>'
    +'<button type="button" class="tyh-mod-box tyh-mod-city" data-open-city><small>City / Area / Property</small><b>'+esc(dest||'Select location')+'</b>'+(sub?'<em>'+esc(sub)+'</em>':'')+'</button>'
    +'<button type="button" class="tyh-mod-box" data-open-cal="start"><small>Check-in</small><b>'+esc(fmtDate(dates.checkIn))+'</b></button>'
    +'<div class="tyh-mod-nights" aria-label="Nights"><small>Nights</small><div class="tyh-step tyh-nights-step"><button type="button" data-nights-delta="-1" '+(dates.nights<=1?'disabled':'')+'>-</button><b>'+esc(dates.nights)+'</b><button type="button" data-nights-delta="1">+</button></div></div>'
    +'<button type="button" class="tyh-mod-box" data-open-cal="end"><small>Check-out</small><b>'+esc(fmtDate(dates.checkOut))+'</b></button>'
    +'<button type="button" class="tyh-mod-box" data-open-guest><small>Rooms &amp; Guests</small><b>'+esc(guestSummary())+'</b></button>'
    +'<button type="submit" class="tyh-mod-search">Search</button></form>'
    +cityPickerHtml()+guestPopupHtml()+calendarHtml();
}
function renderResults(){
  const s=S.search||{};
  const city=s.cityName||s.city||s.destination||s.location||'Hotels';
  const count=activeFilterCount();
  const opts=sortOptions();
  const content=modifySearchBar()+'<main class="tyh-results">'+filterPanel()+'<section class="tyh-list-wrap"><div class="tyh-list-head"><div><strong>'+esc(S.shown.length)+' hotels in '+esc(city)+'</strong><span>'+esc([fmtDate(s.checkIn||s.checkinDate),fmtDate(s.checkOut||s.checkoutDate)].filter(Boolean).join(' • '))+'</span></div><label class="tyh-desktop-sort">Sort by <select data-sort-select>'+opts.map(function(o){ return '<option value="'+attr(o.value)+'"'+(S.sort===o.value?' selected':'')+'>'+esc(o.label)+(o.sub?(' — '+o.sub):'')+'</option>'; }).join('')+'</select></label></div><div class="tyh-result-tools"><button type="button" data-open-filter>Filters'+(count?' ('+count+')':'')+'</button><button type="button" data-open-sort>Sort by</button></div><div class="tyh-cards">'+(S.shown.length?S.shown.map(hotelCard).join(''):'<div class="tyh-empty"><h2>No hotels found</h2><p>Try changing filters or search again.</p></div>')+'</div></section></main>'+(document.body.classList.contains('tyh-sort-open')?sortSheet():'')+(S.roomHotel?roomSheet(S.roomHotel):'');
  shell(content,{title:city, sub:'Hotel results'});
  bindResults();
}
function taxLabel(h){
  const pb=(arr(h.options)[0]&&arr(h.options)[0].taxes)||h.taxes;
  if(Number(pb)>0) return 'Incl. taxes';
  return '';
}
function hotelCard(h){
  const hid=String(h.hotelId||h.id||'');
  const starN=Math.round(Number(h.star||0));
  const stars=starN>0?'<div class="tyh-stars" aria-label="'+esc(starN)+' star">'+"★".repeat(Math.max(0,Math.min(5,starN)))+'</div>':'';
  const facilities=arr(h.amenities).slice(0,4).map(function(a){ return '<span>'+esc(a)+'</span>'; }).join('');
  const meal=mealBasisOf(h);
  const cancel=hotelCancelText(h);
  const ptype=propertyTypeOf(h);
  const location=[h.area||h.place,h.city].filter(Boolean).join(', ')||(typeof h.address==='string'?h.address:'');
  const href='/pages/results/hotels.html?service=hotel&step=hotel-details&hotelId='+encodeURIComponent(hid);
  const tax=taxLabel(h);
  return '<a class="tyh-card" href="'+attr(href)+'" data-hotel-id="'+attr(hid)+'"><div class="tyh-img">'+(imageOf(h)?'<img src="'+attr(imageOf(h))+'" alt="'+attr(h.name)+'">':'<span>'+esc((h.name||'H').slice(0,1))+'</span>')+'</div><div class="tyh-info"><div class="tyh-title-row"><h2>'+esc(h.name)+'</h2>'+stars+'</div>'+(location?'<p class="tyh-location">'+esc(location)+'</p>':'')+(ptype?'<p class="tyh-ptype">'+esc(ptype)+'</p>':'')+(facilities?'<div class="tyh-facilities">'+facilities+'</div>':'')+(meal?'<p class="tyh-meal">'+esc(meal)+'</p>':'')+(cancel?'<p class="tyh-free">'+esc(cancel)+'</p>':'')+'<div class="tyh-card-foot"><div class="tyh-price"><small>'+esc(stayNightsLabel())+'</small><b>'+esc(money(h.price))+'</b>'+(tax?'<em>'+esc(tax)+'</em>':'')+'</div></div></div></a>';
}
function setFilterValue(kind,value,checked){
  if(kind==='gst'){ S.filters.gst = checked ? (value===true||value==='true') : null; return; }
  if(kind==='freeCancel'){ S.filters.freeCancel = !!checked; return; }
  const set=S.filters[kind]; if(!set) return;
  checked ? set.add(value) : set.delete(value);
}
function clearFilters(){ S.filters.priceRanges.clear(); S.filters.gst=null; S.filters.propertyTypes.clear(); S.filters.places.clear(); S.filters.stars.clear(); S.filters.meals.clear(); S.filters.amenities.clear(); S.filters.min=0; S.filters.max=0; S.filters.freeCancel=false; S.filters.nameQuery=''; }
function closeFilter(){ document.body.classList.remove('tyh-filter-open'); }
function closeSort(){ document.body.classList.remove('tyh-sort-open'); renderResults(); }
function isMobileHotelUi(){ return window.matchMedia('(max-width:860px)').matches; }
function persistHotelSearch(patch){
  const live=Object.assign({}, searchPayload(), S.search, patch||{});
  const regionId=String(live.regionId||live.cityId||'');
  if(/^\d+$/.test(regionId)){ live.regionId=regionId; live.cityId=regionId; }
  const dates=searchDates();
  live.checkIn=searchIso(live.checkIn||live.checkinDate)||dates.checkIn;
  live.checkOut=searchIso(live.checkOut||live.checkoutDate)||dates.checkOut;
  live.checkinDate=live.checkIn;
  live.checkoutDate=live.checkOut;
  const roomCount=Math.max(1, Math.min(6, Number(live.roomCount||arr(live.rooms).length||1)));
  const adults=Math.max(1, Number(live.adults||1));
  const children=Math.max(0, Number(live.children||0));
  live.rooms=Array.from({length:roomCount}, function(){ return {adults:adults, children:children, childAge:[]}; });
  live.roomCount=roomCount;
  live.adults=adults;
  live.children=children;
  live.service='hotel';
  live.type='hotel';
  live.nationality=live.nationality||'IN';
  live.currency=live.currency||'INR';
  S.search=live;
  save(KEY.payload, live);
  const wrap=read(KEY.search,{})||{};
  save(KEY.search, Object.assign({}, wrap, {service:'hotel', livePayload:live, createdAt:new Date().toISOString()}));
  try{ sessionStorage.removeItem(KEY.results); }catch(e){}
}
function hotelByRealId(id){
  const want=String(id||'');
  if(!want) return null;
  return S.all.find(function(h){ return String(h.hotelId||h.id||'')===want; }) || S.shown.find(function(h){ return String(h.hotelId||h.id||'')===want; }) || null;
}
function maybeShowHotelDetailsFromUrl(){
  const params=new URLSearchParams(location.search);
  if((params.get('step')||'')!=='hotel-details') return false;
  S.detailHotel=hotelByRealId(params.get('hotelId')||'');
  S.detailStatus=S.detailHotel?'loading':'idle';
  S.detailError='';
  renderHotelDetailsPlumbing();
  if(S.detailHotel) loadHotelPricing(S.detailHotel);
  return true;
}
function hotelDescription(h){
  const r=rawOf(h);
  return firstText(h.description,h.des,r.des,r.description,deepFind(r,['description','des','about','overview']));
}
function renderHotelDetailsPlumbing(){
  const h=S.detailHotel;
  if(!h){
    shell('<main class="tyh-empty"><h2>Hotel not found</h2><p>Please return to results and choose a hotel from this search.</p><button type="button" data-back-results>Back to results</button></main>',{title:'Hotel details'});
    const b=q('[data-back-results]',root); if(b) b.onclick=function(){ setPage('results'); renderResults(); };
    return;
  }
  const starN=Math.round(Number(h.star||0));
  const stars=starN>0?'<div class="tyh-stars" aria-label="'+esc(starN)+' star">'+"★".repeat(Math.max(0,Math.min(5,starN)))+'</div>':'';
  const location=[h.area||h.place,h.city,typeof h.address==='string'?h.address:''].filter(Boolean).join(', ');
  const meal=mealBasisOf(h);
  const cancel=hotelCancelText(h);
  const facilities=arr(h.amenities).map(function(a){ return '<span>'+esc(a)+'</span>'; }).join('');
  const desc=hotelDescription(h);
  const imgs=[imageOf(h)].filter(Boolean);
  const roomsHtml=roomRatesHtml(h);
  const content=modifySearchBar()+'<main class="tyh-details-plumb"><article class="tyh-detail">'+(imgs[0]?'<div class="tyh-detail-img"><img src="'+attr(imgs[0])+'" alt="'+attr(h.name)+'"></div>':'')+'<div class="tyh-detail-body"><div class="tyh-title-row"><h2>'+esc(h.name)+'</h2>'+stars+'</div>'+(location?'<p class="tyh-location">'+esc(location)+'</p>':'')+(desc?'<p class="tyh-desc">'+esc(desc)+'</p>':'')+(facilities?'<div class="tyh-facilities">'+facilities+'</div>':'')+(meal?'<p class="tyh-meal">'+esc(meal)+'</p>':'')+(cancel?'<p class="tyh-free">'+esc(cancel)+'</p>':'')+'<div class="tyh-price"><small>'+esc(stayNightsLabel())+'</small><b>'+esc(money(h.price))+'</b></div><h3>Room options</h3>'+roomsHtml+'</div></article></main>';
  shell(content,{title:h.name||'Hotel details', sub:'Hotel details'});
  bindResults();
  qa('[data-review-room]',root).forEach(function(b){ b.onclick=function(){ startReview(S.detailHotel||h,b.dataset.reviewRoom); }; });
  const retry=q('[data-retry-detail]',root);
  if(retry) retry.onclick=function(){ const hotel=S.detailHotel||h; if(hotel) loadHotelPricing(hotel); };
}
function openHotelDetails(h){
  const id=String((h&& (h.hotelId||h.id))||'');
  if(!id) return;
  S.detailHotel=h;
  S.detailStatus='loading';
  S.detailError='';
  setPage('hotel-details','hotelId='+encodeURIComponent(id));
  renderHotelDetailsPlumbing();
  loadHotelPricing(h);
}
function applyPricedHotel(listingHotel, merged){
  const id=realHotelId(listingHotel);
  if(!merged || realHotelId(merged)!==id) return;
  S.detailHotel=merged;
  S.roomHotel=null;
  S.detailStatus='ready';
  S.detailError='';
  renderHotelDetailsPlumbing();
}
async function loadHotelPricing(h){
  S.detailStatus='loading';
  S.detailError='';
  renderHotelDetailsPlumbing();
  const merged=await openRooms(h, true);
  if(S.detailStatus==='error') return;
  applyPricedHotel(h, merged);
}
function rerenderKeepUi(){
  const step=new URLSearchParams(location.search).get('step')||'results';
  if(step==='hotel-details') renderHotelDetailsPlumbing();
  else renderResults();
}
function bindResults(){
  const form=q('[data-modify-search]',root);
  if(form) form.onsubmit=function(e){
    e.preventDefault();
    const dates=searchDates();
    persistHotelSearch({checkIn:dates.checkIn, checkOut:dates.checkOut, roomCount:guestState().rooms, adults:guestState().adults, children:guestState().children});
    S.ui.calOpen=false; S.ui.cityOpen=false; S.ui.guestOpen=false;
    setPage('results');
    loadResults();
  };
  qa('[data-open-city]',root).forEach(function(b){ b.onclick=async function(){ S.ui.cityOpen=true; S.ui.calOpen=false; S.ui.guestOpen=false; S.ui.cityStatus='Searching locations...'; S.ui.cityRows=[]; rerenderKeepUi(); const rows=await fetchHotelCities(S.ui.cityQuery||''); S.ui.cityRows=rows; S.ui.cityStatus=rows.length?'':'Type a location and select an exact suggestion.'; rerenderKeepUi(); const inp=q('[data-city-input]',root); if(inp) inp.focus(); }; });
  qa('[data-city-close]',root).forEach(function(b){ b.onclick=function(){ S.ui.cityOpen=false; rerenderKeepUi(); }; });
  const cityInput=q('[data-city-input]',root);
  if(cityInput){
    cityInput.oninput=function(){
      S.ui.cityQuery=String(cityInput.value||'');
      clearTimeout(S.ui.cityTimer);
      S.ui.cityTimer=setTimeout(async function(){
        const v=S.ui.cityQuery;
        S.ui.cityStatus='Searching locations...';
        const rows=await fetchHotelCities(v);
        if(String(S.ui.cityQuery||'')!==v) return;
        S.ui.cityRows=rows;
        S.ui.cityStatus=rows.length?'':'Type a location and select an exact suggestion.';
        rerenderKeepUi();
        const n=q('[data-city-input]',root); if(n){ n.focus(); n.value=v; try{ n.setSelectionRange(v.length,v.length);}catch(e){} }
      },180);
    };
    cityInput.onkeydown=function(e){ if(e.key==='Enter') e.preventDefault(); };
  }
  qa('[data-pick-city]',root).forEach(function(b){
    b.onclick=function(){
      const id=String(b.getAttribute('data-pick-city')||'');
      if(!/^\d+$/.test(id)) return;
      persistHotelSearch({regionId:id, cityId:id, city:b.getAttribute('data-city-name')||'', cityName:b.getAttribute('data-city-name')||'', area:b.getAttribute('data-city-sub')||'', countryName:b.getAttribute('data-city-country')||'', country:b.getAttribute('data-city-country')||''});
      S.ui.cityOpen=false;
      rerenderKeepUi();
    };
  });
  qa('[data-open-cal]',root).forEach(function(b){ b.onclick=function(){ S.ui.calOpen=true; S.ui.cityOpen=false; S.ui.guestOpen=false; S.ui.calStep=b.getAttribute('data-open-cal')==='end'?'end':'start'; const dates=searchDates(); const ci=parseIsoDate(dates.checkIn); const min=todayBound(); S.ui.calOffset=Math.max(0, Math.min(11, (ci.getFullYear()-min.getFullYear())*12+(ci.getMonth()-min.getMonth()))); rerenderKeepUi(); }; });
  qa('[data-cal-close]',root).forEach(function(b){ b.onclick=function(){ S.ui.calOpen=false; rerenderKeepUi(); }; });
  qa('[data-cal-step]',root).forEach(function(b){ b.onclick=function(){ S.ui.calStep=b.getAttribute('data-cal-step')||'start'; rerenderKeepUi(); }; });
  const prev=q('[data-cal-prev]',root); if(prev) prev.onclick=function(){ S.ui.calOffset=Math.max(0,(S.ui.calOffset||0)-1); rerenderKeepUi(); };
  const next=q('[data-cal-next]',root); if(next) next.onclick=function(){ S.ui.calOffset=Math.min(11,(S.ui.calOffset||0)+1); rerenderKeepUi(); };
  qa('[data-cal-day]',root).forEach(function(b){
    b.onclick=function(){
      const iso=b.getAttribute('data-cal-day');
      const date=parseIsoDate(iso);
      if(!date) return;
      const dates=searchDates();
      let ci=parseIsoDate(dates.checkIn), co=parseIsoDate(dates.checkOut);
      if((S.ui.calStep||'start')==='start'){
        ci=date; if(co<=ci) co=addDays(ci,1); S.ui.calStep='end';
      } else {
        if(date<=ci) return; co=date; if(!isMobileHotelUi()) S.ui.calOpen=false;
      }
      persistHotelSearch({checkIn:isoFromDate(ci), checkOut:isoFromDate(co)});
      rerenderKeepUi();
    };
  });
  qa('[data-nights-delta]',root).forEach(function(b){
    b.onclick=function(){
      const dates=searchDates();
      const ci=parseIsoDate(dates.checkIn);
      let n=dates.nights+Number(b.getAttribute('data-nights-delta')||0);
      if(n<1) n=1;
      let co=addDays(ci,n);
      const max=maxBound();
      if(co>max) co=max;
      if(co<=ci) return;
      persistHotelSearch({checkIn:isoFromDate(ci), checkOut:isoFromDate(co)});
      rerenderKeepUi();
    };
  });
  qa('[data-open-guest]',root).forEach(function(b){ b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); S.ui.guestOpen=true; S.ui.cityOpen=false; S.ui.calOpen=false; rerenderKeepUi(); }; });
  qa('[data-guest-close]',root).forEach(function(b){ b.onclick=function(){ S.ui.guestOpen=false; rerenderKeepUi(); }; });
  qa('[data-guest-delta]',root).forEach(function(b){
    b.onclick=function(){
      const parts=String(b.getAttribute('data-guest-delta')||'').split(':');
      const key=parts[0]; const delta=Number(parts[1]||0);
      const g=guestState();
      if(key==='rooms') g.rooms=Math.max(1,Math.min(6,g.rooms+delta));
      if(key==='adults'){ if(delta>0 && g.adults+g.children>=12) return; g.adults=Math.max(1,Math.min(12,g.adults+delta)); }
      if(key==='children'){ if(delta>0 && g.adults+g.children>=12) return; g.children=Math.max(0,Math.min(12,g.children+delta)); }
      persistHotelSearch({roomCount:g.rooms, adults:g.adults, children:g.children});
      S.ui.guestOpen=true;
      rerenderKeepUi();
    };
  });
  qa('[data-open-filter],[data-mobile-filter]',root).forEach(function(b){ b.onclick=function(){ document.body.classList.add('tyh-filter-open'); }; });
  qa('[data-filter-close]',root).forEach(function(b){ b.onclick=closeFilter; });
  qa('[data-fkind]',root).forEach(function(i){ i.onchange=function(){ setFilterValue(i.dataset.fkind,i.dataset.fvalue,i.checked); const keep=document.body.classList.contains('tyh-filter-open')||isMobileHotelUi(); applyFilters(); if(keep&&isMobileHotelUi()) document.body.classList.add('tyh-filter-open'); }; });
  const apply=q('[data-apply]',root); if(apply) apply.onclick=function(){ closeFilter(); applyFilters(); };
  qa('[data-clear-top], [data-clear]',root).forEach(function(b){ b.onclick=function(){ clearFilters(); applyFilters(); if(isMobileHotelUi()) document.body.classList.add('tyh-filter-open'); }; });
  const name=q('[data-hotel-name]',root);
  if(name) name.oninput=function(){ S.filters.nameQuery=String(name.value||'').trim(); applyFilters(); const n=q('[data-hotel-name]',root); if(n){ n.focus(); n.value=name.value; try{ n.setSelectionRange(n.value.length,n.value.length); }catch(e){} } if(isMobileHotelUi()) document.body.classList.add('tyh-filter-open'); };
  const sortSelect=q('[data-sort-select]',root);
  if(sortSelect) sortSelect.onchange=function(){ S.sort=sortSelect.value||'api'; applyFilters(); };
  qa('[data-sort-pick]',root).forEach(function(b){ b.onclick=function(){ S.sort=b.dataset.sortPick; document.body.classList.remove('tyh-sort-open'); applyFilters(); }; });
  qa('[data-open-sort],[data-mobile-sort]',root).forEach(function(b){ b.onclick=function(){ document.body.classList.add('tyh-sort-open'); renderResults(); }; });
  qa('[data-sort-close]',root).forEach(function(b){ b.onclick=closeSort; });
  qa('a.tyh-card[data-hotel-id]',root).forEach(function(a){
    a.onclick=function(ev){
      if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey||ev.button) return;
      ev.preventDefault();
      const h=hotelByRealId(a.getAttribute('data-hotel-id'));
      if(h) openHotelDetails(h);
    };
  });
  qa('[data-room]',root).forEach(function(b){ b.onclick=function(){ const h=S.shown.find(function(x){ return x.key===b.dataset.room; })||S.detailHotel; if(h) openRooms(h); }; });
  qa('[data-close]',root).forEach(function(b){ b.onclick=function(){ S.roomHotel=null; paintHotelView(); }; });
  qa('[data-review-room]',root).forEach(function(b){ b.onclick=function(){ const hotel=S.detailHotel||S.roomHotel; if(hotel) startReview(hotel,b.dataset.reviewRoom); }; });
  qa('[data-retry-detail]',root).forEach(function(b){ b.onclick=function(){ const hotel=S.detailHotel||S.roomHotel; if(hotel) loadHotelPricing(hotel); }; });
}

function paintHotelView(){
  const step=new URLSearchParams(location.search).get('step')||'results';
  if(step==='hotel-details') renderHotelDetailsPlumbing();
  else renderResults();
}
async function openRooms(h, silent){
  if(!silent){ S.roomHotel=h; paintHotelView(); }
  try{
    if(!silent) showLoader('Loading room options…');
    const context=h.searchContext||S.search.searchContext||{};
    const hid=realHotelId(h);
    const res=await api('/api/hotels/detail',{hid:hid,hotelId:hid,searchContext:context});
    const d=unwrap(res)||{};
    const reviewHash=String(d.reviewHash||(d.hotel&&d.hotel.reviewHash)||'').trim();
    const priced=d.hotel||{};
    const detailHotel=normHotel(Object.assign({},priced,{hotelId:priced.hotelId||priced.tjHotelId||hid,tjHotelId:priced.tjHotelId||priced.hotelId||hid,reviewHash:reviewHash,searchContext:d.searchContext||context,raw:d.raw||priced.raw||d}),0);
    const merged=Object.assign({},h,{
      key:h.key,
      hotelId:hid,
      id:hid,
      tjHotelId:hid,
      options:detailHotel.options,
      price:detailHotel.price||h.price,
      reviewHash:reviewHash,
      searchContext:d.searchContext||context,
      raw:detailHotel.raw
    }, detailHotel, {hotelId:hid,id:hid,tjHotelId:hid,reviewHash:reviewHash,options:detailHotel.options,searchContext:d.searchContext||context});
    if(!reviewHash || !optionList(merged).some(function(o){ return !!realOptionId(o); })){
      const err=new Error('Live room rates are not ready yet. Please try again.');
      err.status=409;
      throw err;
    }
    if(!silent) S.roomHotel=merged;
    S.all=S.all.map(function(x){ return realHotelId(x)===hid?Object.assign({},x,{reviewHash:reviewHash}):x; });
    S.shown=S.shown.map(function(x){ return realHotelId(x)===hid?Object.assign({},x,{reviewHash:reviewHash}):x; });
    if(!silent) paintHotelView();
    return merged;
  }catch(e){
    S.detailStatus='error';
    S.detailError=friendlyError(e);
    if(!silent){
      const rb=q('.tyh-room-body',root);
      if(rb) rb.innerHTML='<p class="tyh-muted">'+esc(S.detailError)+'</p><button type="button" data-retry-detail>Try again</button>';
    }else{
      renderHotelDetailsPlumbing();
    }
    return null;
  }finally{ hideLoader(); }
}
function roomSheet(h){
  return '<div class="tyh-modal-bg" data-close></div><section class="tyh-room"><header><div><h2>'+esc(h.name)+'</h2><p>'+esc(h.address||h.area||'')+'</p></div><button type="button" data-close>×</button></header><div class="tyh-room-body">'+roomRatesHtml(h)+'</div></section>';
}
async function startReview(h, optionId){
  const hotel=S.detailHotel||h;
  const oid=realOptionId({optionId:optionId,id:optionId});
  if(!hasPricingReviewContext(hotel) || !oid || !optionList(hotel).some(function(o){ return realOptionId(o)===oid; })){
    alert('Please wait for live room rates, then choose the room again.');
    return;
  }
  const selectedBeforeReview=optionList(hotel).find(function(o){ return realOptionId(o)===oid; })||{};
  try{
    showLoader('Verifying hotel price and policy…');
    const context=Object.assign({}, S.search.searchContext||{}, hotel.searchContext||{});
    if(!context.correlationId || !(context.checkIn||context.checkinDate) || !(context.checkOut||context.checkoutDate)){
      const missing=new Error('Your hotel search session expired. Please search again, then continue.');
      missing.code='HOTEL_SEARCH_CONTEXT_REQUIRED';
      missing.status=409;
      throw missing;
    }
    const hid=realHotelId(hotel);
    const res=await api('/api/hotels/review',{hid:hid,hotelId:hid,optionId:oid,reviewHash:realReviewHash(hotel),searchContext:context,correlationId:context.correlationId});
    const raw=res.raw||res.review&&res.review.raw||res;
    const reviewData=res.review||{};
    const reviewedHotel=reviewData.hotel ? normHotel(Object.assign({},reviewData.hotel,{searchContext:res.searchContext||context,reviewHash:realReviewHash(hotel)}),0) : hotel;
    const reviewedOption=reviewData.option ? normOption(reviewData.option,reviewedHotel,0) : selectedBeforeReview;
    const oldAmount=priceOf(selectedBeforeReview,hotel);
    const reviewedAmount=priceOf(reviewedOption,reviewedHotel) || oldAmount;
    const priceChanged=Boolean(reviewData.isPriceChanged) || (oldAmount>0 && reviewedAmount>0 && Math.abs(reviewedAmount-oldAmount)>0.01);
    if(priceChanged){
      const accepted=window.confirm('The hotel price changed from '+money(oldAmount)+' to '+money(reviewedAmount)+'. Continue with the latest available price?');
      if(!accepted) return;
    }
    S.selectedHotel=Object.assign({},hotel,reviewedHotel,{searchContext:res.searchContext||context,reviewHash:realReviewHash(hotel),hotelId:hid,id:hid,tjHotelId:hid});
    S.selectedOption=reviewedOption;
    S.review=res;
    const reviewBookingId=reviewData.bookingId||raw.bookingId||res.bookingId||'';
    if(!reviewBookingId) throw new Error('Hotel review could not be completed. Please select the room again.');
    const draft={service:'hotel',hotel:S.selectedHotel,selected:S.selectedHotel,option:reviewedOption,optionId:oid,reviewHash:realReviewHash(hotel),searchContext:res.searchContext||context,tripjackReviewRaw:raw,tripjackReviewBookingId:reviewBookingId,cancellationPolicyRaw:reviewedOption.cancellationPolicy||{},finalPayableAmount:reviewedAmount,searchPayload:Object.assign({},S.search,{searchContext:res.searchContext||context}),contact:{countryCode:'+91'},guests:defaultGuests(),gst:{enabled:false},clientRequestId:newHotelClientRequestId(),createdAt:new Date().toISOString()};
    save(KEY.selected,{service:'hotel',hotel:S.selectedHotel,option:reviewedOption,optionId:oid,review:res,search:S.search});
    save(KEY.draft,draft);
    setPage('guest');
    renderGuestStep();
  }catch(e){
    alert(friendlyError(e)||'Hotel review could not be completed. Please select another room.');
  }finally{ hideLoader(); }
}

function draft(){ return read(KEY.draft,{service:'hotel',hotel:S.selectedHotel,option:S.selectedOption,guests:defaultGuests(),contact:{},gst:{enabled:false}})||{}; }
function setDraft(p){ const d=Object.assign({},draft(),p||{}); save(KEY.draft,d); return d; }
function hotel(){ const d=draft(); return d.hotel||d.selected||S.selectedHotel||{}; }
function option(){ const d=draft(); return d.option||S.selectedOption||{}; }
function reviewRaw(){ const d=draft(); return d.tripjackReviewRaw||{}; }
function defaultGuests(){ const s=S.search||searchPayload()||{}; const rooms=arr(s.rooms).length?s.rooms:[{adults:Number(s.adults||1),children:Number(s.children||0),childAge:s.childAge||[]}]; const gs=[]; rooms.forEach((r,ri)=>{ const a=Number(r.adults||1), c=Number(r.children||0); for(let i=0;i<a;i++) gs.push({room:ri+1,type:'Adult',title:'Mr',firstName:'',lastName:''}); for(let i=0;i<c;i++) gs.push({room:ri+1,type:'Child',title:'Master',firstName:'',lastName:'',age:arr(r.childAge)[i]||''}); }); return gs.length?gs:[{room:1,type:'Adult',title:'Mr',firstName:'',lastName:''}]; }
function saveGuest(i){ const form=q('[data-guest-form]',root); if(!form) return; const d=draft(); const guests=arr(d.guests).length?d.guests:defaultGuests(); const g=Object.assign({},guests[i]||{}); qa('[data-gfield]',form).forEach(inp=>{ g[inp.dataset.gfield]=inp.value; }); guests[i]=g; setDraft({guests}); }
function renderGuestStep(){ const d=draft(); const guests=arr(d.guests).length?d.guests:defaultGuests(); const i=Math.max(0,Math.min(S.guestIndex,guests.length-1)); const g=guests[i]||{}; const contact=d.contact||{}; const gst=d.gst||{}; const content='<main class="tyh-book"><section class="tyh-summary-card">'+hotelMiniCard(hotel(),option())+'</section><section class="tyh-panel"><h2>Guest details</h2><div class="tyh-tabs">'+guests.map((x,idx)=>'<button type="button" class="'+(idx===i?'active':'')+'" data-guest-tab="'+idx+'">'+esc(x.type||'Guest')+' '+(idx+1)+'</button>').join('')+'</div><div class="tyh-form-grid" data-guest-form="'+i+'"><label>Title<select data-gfield="title"><option '+(g.title==='Mr'?'selected':'')+'>Mr</option><option '+(g.title==='Ms'?'selected':'')+'>Ms</option><option '+(g.title==='Mrs'?'selected':'')+'>Mrs</option><option '+(g.title==='Master'?'selected':'')+'>Master</option></select></label><label>First and middle name<input data-gfield="firstName" value="'+attr(g.firstName||'')+'" placeholder="Enter first name"></label><label>Last name<input data-gfield="lastName" value="'+attr(g.lastName||'')+'" placeholder="Enter last name"></label>'+(g.type==='Child'?'<label>Age<input data-gfield="age" value="'+attr(g.age||'')+'" placeholder="Child age"></label>':'')+'</div></section><section class="tyh-panel"><h2>Contact details</h2><div class="tyh-form-grid"><label>Email address<input data-contact="email" type="email" value="'+attr(contact.email||'')+'" placeholder="Email address"></label><label>Country code<select data-contact="countryCode"><option value="+91" '+((contact.countryCode||'+91')==='+91'?'selected':'')+'>India +91</option><option value="+81" '+(contact.countryCode==='+81'?'selected':'')+'>Japan +81</option><option value="+1" '+(contact.countryCode==='+1'?'selected':'')+'>USA/Canada +1</option><option value="+44" '+(contact.countryCode==='+44'?'selected':'')+'>United Kingdom +44</option><option value="+971" '+(contact.countryCode==='+971'?'selected':'')+'>UAE +971</option></select></label><label>Phone number<input data-contact="phone" inputmode="numeric" value="'+attr(contact.phone||'')+'" placeholder="Mobile number"></label></div><label class="tyh-check"><input type="checkbox" data-agreement checked required> I agree to TravelYaraa <a href="/legal/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>, <a href="/legal/user-agreement.html" target="_blank" rel="noopener">User Agreement</a> and <a href="/legal/terms-and-conditions.html" target="_blank" rel="noopener">Terms &amp; Conditions</a>.</label></section><section class="tyh-panel"><h2>GST details <small>optional</small></h2><label class="tyh-check"><input type="checkbox" data-gst-enabled '+(gst.enabled?'checked':'')+'> Add GST details</label>'+(gst.enabled?'<div class="tyh-form-grid"><label>GST number<input data-gst="number" value="'+attr(gst.number||'')+'"></label><label>Company name<input data-gst="company" value="'+attr(gst.company||'')+'"></label></div>':'')+'</section><div class="tyh-bottom"><div><span>Total amount</span><b>'+money(totalAmount())+'</b></div><button type="button" data-continue>Continue</button></div></main>'; shell(content,{title:'Guest details',sub:(hotel().name||'Hotel booking')}); bindGuest(); }
function bindGuest(){ qa('[data-guest-tab]',root).forEach(b=>b.onclick=()=>{ saveGuest(S.guestIndex); S.guestIndex=Number(b.dataset.guestTab||0); renderGuestStep(); }); qa('[data-contact]',root).forEach(i=>i.oninput=()=>{ const d=draft(), c=Object.assign({},d.contact||{}); c[i.dataset.contact]=i.value; setDraft({contact:c}); }); const ge=q('[data-gst-enabled]',root); if(ge) ge.onchange=e=>{ const d=draft(), g=Object.assign({},d.gst||{}); g.enabled=e.target.checked; setDraft({gst:g}); renderGuestStep(); }; qa('[data-gst]',root).forEach(i=>i.oninput=()=>{ const d=draft(), g=Object.assign({},d.gst||{}); g[i.dataset.gst]=i.value; setDraft({gst:g}); }); const cont=q('[data-continue]',root); if(cont) cont.onclick=()=>{ if(validateGuest()){ saveGuest(S.guestIndex); setPage('review'); renderReviewStep(); } }; }
function validateGuest(){ saveGuest(S.guestIndex); const d=draft(); const missing=arr(d.guests).findIndex(g=>!String(g.firstName||'').trim() || !String(g.lastName||'').trim()); if(missing>=0){ alert('Please enter full name for Guest '+(missing+1)); return false; } if(!String(d.contact&&d.contact.email||'').includes('@')){ alert('Please enter a valid email address.'); return false; } if(String(d.contact&&d.contact.phone||'').replace(/\D/g,'').length<8){ alert('Please enter a valid phone number.'); return false; } const agreement=q('[data-agreement]',root); if(agreement&&!agreement.checked){ alert('Please accept the TravelYaraa policies to continue.'); return false; } return true; }
function totalAmount(){ const d=draft(); return Number(d.finalPayableAmount||option().totalPrice||hotel().price||0); }
function hotelMiniCard(h,o){ return '<article class="tyh-mini"><div class="tyh-mini-img">'+(imageOf(h)?'<img src="'+attr(imageOf(h))+'" alt="'+attr(h.name||'Hotel')+'">':'<span>H</span>')+'</div><div><h2>'+esc(h.name||'Hotel')+'</h2><p>'+esc([h.address,h.area].filter(Boolean).join(' • '))+'</p><div class="tyh-stars">'+('★'.repeat(Math.max(0,Math.min(5,Math.round(h.star||0)))))+'</div><p class="tyh-room-name">'+esc(o.roomSummary||o.roomType||'Selected room')+'</p></div></article>'; }
function renderReviewStep(){ const d=draft(); const s=d.searchPayload||S.search||{}; const ci=s.checkIn||s.checkinDate, co=s.checkOut||s.checkoutDate; const content='<main class="tyh-book tyh-review"><section class="tyh-summary-card">'+hotelMiniCard(hotel(),option())+'</section><section class="tyh-panel"><h2>Stay details</h2><div class="tyh-kv"><span>Check-in</span><b>'+esc(fmtDate(ci)||'Pending')+'</b></div><div class="tyh-kv"><span>Check-out</span><b>'+esc(fmtDate(co)||'Pending')+'</b></div><div class="tyh-kv"><span>Nights</span><b>'+esc(nights(ci,co))+'</b></div><div class="tyh-kv"><span>Room plan</span><b>'+esc(option().mealBasis||'As selected')+'</b></div></section><section class="tyh-panel"><h2>Guest details</h2>'+arr(d.guests).map((g,i)=>'<div class="tyh-guest-row"><span>'+esc((g.type||'Guest')+' '+(i+1))+'</span><b>'+esc([g.title,g.firstName,g.lastName].filter(Boolean).join(' '))+'</b></div>').join('')+'</section><section class="tyh-panel"><h2>Policies</h2><div class="tyh-policy-actions"><button type="button" data-policy="cancel">Cancellation policy</button><button type="button" data-policy="hotel">Hotel rules</button><button type="button" data-policy="payment">Payment details</button></div><div class="tyh-policy-box" id="tyHotelPolicyBox">Policy will be shown from Tripjack review response when available.</div></section><section class="tyh-panel"><h2>Payment details</h2><div class="tyh-kv"><span>Room amount</span><b>'+money(totalAmount())+'</b></div><div class="tyh-kv total"><span>Total amount</span><b>'+money(totalAmount())+'</b></div></section><div class="tyh-bottom"><div><span>Total amount</span><b>'+money(totalAmount())+'</b></div><button type="button" data-pay>Continue payment</button></div></main>'; shell(content,{title:'Review booking',sub:hotel().name||'Hotel'}); bindReview(); }
function bindReview(){ qa('[data-policy]',root).forEach(b=>b.onclick=()=>showPolicy(b.dataset.policy)); const pay=q('[data-pay]',root); if(pay) pay.onclick=()=>proceedToPayment(); }
function showPolicy(type){ const raw=reviewRaw(); const h=hotel(); let html=''; if(type==='cancel'){ const selected=option(); const c=selected.cancellation||cancellationOf(selected.raw||selected)||{}; const pd=arr(c.penalties); const intro=c.refundable===false?'This room is non-refundable.':(c.freeCancellation?'Free cancellation'+(c.freeCancellationUntil?' until '+fmtDate(c.freeCancellationUntil):'')+'.':'Cancellation charges may apply.'); html='<p><b>'+esc(intro)+'</b></p>'+(pd.length?pd.map(x=>'<p>'+esc([x.fromDate||x.fdt,x.toDate||x.tdt,x.amount!=null?money(x.amount):(x.am!=null?money(x.am):''),x.percent!=null?x.percent+'%':(x.pp!=null?x.pp+'%':'')].filter(Boolean).join(' • '))+'</p>').join(''):''); } else if(type==='hotel'){ const notes=[].concat(arr(option().bookingNotes),arr(raw.bookingNotes),arr(raw.instructions),arr(raw.hInfo&&raw.hInfo.inst),arr(h.raw&&h.raw.inst)); html=notes.map(x=>'<p>'+esc(x&&x.msg||x&&x.description||x&&x.text||x)+'</p>').join('') || 'Hotel rules will be shown from the Tripjack booking details when supplied.'; } else { html='Final amount will be charged through Razorpay only after server-side payment order creation. Hotel booking is submitted to Tripjack only after payment signature and gateway amount verification.'; } const box=q('#tyHotelPolicyBox',root); if(box) box.innerHTML=html; }
function loadRazorpay(){ if(window.Razorpay) return Promise.resolve(); return new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src='https://checkout.razorpay.com/v1/checkout.js'; s.onload=resolve; s.onerror=()=>reject(new Error('Payment gateway could not be loaded.')); document.head.appendChild(s); }); }

function tyhGuestAuthToken(){ try{return localStorage.getItem("ty_user_auth_token") || "";}catch(e){return "";} }
function tyhGuestAuthHeaders(){ const t=tyhGuestAuthToken(); return t ? {Authorization:"Bearer "+t} : {}; }
function tyhContactEmail(d){ return d?.contact?.email || d?.contactEmail || d?.email || ""; }
function tyhContactPhone(d){ const c=d?.contact||{}; const phone=String(c.phone||d?.contactPhone||d?.phone||"").replace(/\D/g,""); const code=String(c.countryCode||d?.countryCode||"+91").replace(/[^+\d]/g,""); return phone ? code+phone : ""; }
function tyhContactName(d){ const c=d?.contact||{}; const g=arr(d?.guests)[0]||{}; return c.name || [g.title,g.firstName,g.lastName].filter(Boolean).join(" "); }
function tyhGuestOtpModal(){ let el=document.getElementById("tyHotelGuestOtpModal"); if(el)return el; el=document.createElement("div"); el.id="tyHotelGuestOtpModal"; el.innerHTML='<div class="tygo-backdrop"></div><div class="tygo-card"><button class="tygo-x" type="button">×</button><h2>Verify booking contact</h2><p class="tygo-sub">Enter OTP sent to your email/mobile to continue payment.</p><div class="tygo-sent"></div><input class="tygo-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 digit OTP"><button class="tygo-primary" type="button">Verify & Continue</button><button class="tygo-link" type="button">Resend OTP</button><p class="tygo-msg"></p></div>'; if(!document.getElementById("tyGuestOtpStyle")){ const css=document.createElement("style"); css.id="tyGuestOtpStyle"; css.textContent='.tygo-backdrop{position:fixed;inset:0;background:rgba(7,29,73,.48);z-index:999998}.tygo-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:999999;width:min(430px,calc(100% - 28px));background:#fff;border-radius:24px;padding:24px;box-shadow:0 30px 90px rgba(7,29,73,.28);font-family:Inter,system-ui,sans-serif;color:#071d49}.tygo-x{position:absolute;right:14px;top:12px;width:34px;height:34px;border-radius:12px;border:1px solid #e5edf7;background:#fff;font-size:22px}.tygo-card h2{margin:0 34px 8px 0;font-size:23px}.tygo-sub{margin:0 0 12px;color:#667085;font-weight:750;line-height:1.45}.tygo-sent{font-size:12px;color:#0062e3;font-weight:900;margin-bottom:10px}.tygo-otp{width:100%;height:52px;border:1px solid #dbe7f5;border-radius:14px;padding:0 16px;font-size:22px;font-weight:900;letter-spacing:8px;text-align:center;outline:none}.tygo-primary{width:100%;height:50px;border:0;border-radius:999px;background:#0062e3;color:#fff;font-weight:950;font-size:15px;margin-top:13px}.tygo-link{width:100%;border:0;background:#fff;color:#0062e3;font-weight:900;margin-top:12px}.tygo-msg{min-height:18px;color:#b42318;font-weight:800;font-size:13px;margin:10px 0 0}'; document.head.appendChild(css); } document.body.appendChild(el); return el; }
function tyhCloseGuestOtpModal(){ const el=document.getElementById("tyHotelGuestOtpModal"); if(el)el.remove(); }
async function tyhGuestPost(path,body,token){ const headers=Object.assign({"Content-Type":"application/json","Accept":"application/json"}, token?{Authorization:"Bearer "+token}:{}); const res=await fetch(API+path,{method:"POST",headers,body:JSON.stringify(body),cache:"no-store"}); const data=await res.json().catch(()=>({})); if(!res.ok||data.success===false) throw new Error(data.message||data.error||("HTTP "+res.status)); return data; }
async function tyhStartGuestOtp(payload){ const d=payload.details||{}; const body=Object.assign({},payload,{service:"hotel",email:tyhContactEmail(d),phone:tyhContactPhone(d),name:tyhContactName(d),payload}); if(!body.email&&!body.phone) throw new Error("Please enter email or mobile number before payment."); const data=await tyhGuestPost("/api/bookings/guest-auth/start-otp",body); sessionStorage.setItem("ty_last_guest_otp",JSON.stringify({otpSessionId:data.otpSessionId,guestSessionId:data.guestSessionId,payload})); return data; }
async function tyhVerifyGuestOtp(otp){ const saved=JSON.parse(sessionStorage.getItem("ty_last_guest_otp")||"{}"); const data=await tyhGuestPost("/api/bookings/guest-auth/verify-otp",{otpSessionId:saved.otpSessionId,guestSessionId:saved.guestSessionId,otp}); if(data.authToken)localStorage.setItem("ty_user_auth_token",data.authToken); if(data.user)localStorage.setItem("ty_user_profile",JSON.stringify(data.user)); return data; }
async function tyhRequireGuestOtpBeforePayment(payload){ if(tyhGuestAuthToken()){ return {authToken:tyhGuestAuthToken(), user:JSON.parse(localStorage.getItem("ty_user_profile")||"{}"), reused:true}; } const sent=await tyhStartGuestOtp(payload); const el=tyhGuestOtpModal(); el.querySelector(".tygo-sent").textContent="Sent to: "+(sent.sent||[]).map(x=>x.to).join(", "); const input=el.querySelector(".tygo-otp"); const msg=el.querySelector(".tygo-msg"); input.value=""; setTimeout(()=>input.focus(),50); return await new Promise(function(resolve,reject){ let active=true; function finish(v){if(!active)return;active=false;tyhCloseGuestOtpModal();resolve(v)} function fail(e){if(!active)return;active=false;tyhCloseGuestOtpModal();reject(e)} el.querySelector(".tygo-x").onclick=function(){fail(new Error("OTP verification cancelled."))}; el.querySelector(".tygo-primary").onclick=async function(){try{msg.textContent="Verifying OTP...";finish(await tyhVerifyGuestOtp(input.value));}catch(e){msg.textContent=e.message||"Invalid OTP."}}; el.querySelector(".tygo-link").onclick=async function(){try{msg.textContent="Sending new OTP..."; const again=await tyhStartGuestOtp(payload); el.querySelector(".tygo-sent").textContent="Sent to: "+(again.sent||[]).map(x=>x.to).join(", "); msg.textContent="New OTP sent.";}catch(e){msg.textContent=e.message||"Could not resend OTP."}}; }); }


async function recordPaymentStatus(bookingId,status,failure){
  if(!bookingId||!tyhGuestAuthToken()) return;
  try{ await api('/api/bookings/'+encodeURIComponent(bookingId)+'/payment-status',{status,failure:failure||{}}); }catch(_e){}
}
async function proceedToPayment(){
  try{
    if(!validateGuest()) return;
    showLoader('Opening secure payment...');
    await loadRazorpay();
    const d=draft();
    const clientRequestId=d.clientRequestId||newHotelClientRequestId();
    if(!d.clientRequestId) setDraft({clientRequestId});
    const payload={ service:'hotel', clientRequestId, search:d.searchPayload||S.search, selectedResult:Object.assign({},hotel(),{service:'hotel',hotelId:hotel().hotelId||hotel().id,optionId:d.optionId||option().optionId||option().id,rawOption:option().raw||option()}), details:Object.assign({},d,{clientRequestId,searchPayload:d.searchPayload||S.search}), supplier:'tripjack', tripjackReviewRaw:reviewRaw() };
    await tyhRequireGuestOtpBeforePayment(payload);
    const order=await api('/api/bookings/create-payment-order',payload);
    hideLoader();
    const rz=new Razorpay({
      key:order.key,
      amount:order.amount,
      currency:order.currency||'INR',
      name:'TravelYaraa',
      description:'Hotel booking payment',
      order_id:order.razorpayOrderId||order.orderId,
      handler:async function(payment){
        setPage('booking-status','bookingId='+encodeURIComponent(order.bookingId));
        showLoader('',true);
        try{
          const done=await api('/api/bookings/verify-payment',{bookingId:order.bookingId,payment});
          save(KEY.status,done);
          renderStatus(done.booking||done.data||done,done);
        }catch(e){
          renderStatus({bookingId:order.bookingId,paymentStatus:'SUCCESS',bookingStatus:'PENDING',statusMessage:'Payment received. Booking status is being checked.'},{success:false,message:e.message});
        }finally{ hideLoader(); }
      },
      modal:{ondismiss:function(){ hideLoader(); recordPaymentStatus(order.bookingId,'PAYMENT_CANCELLED',{reason:'Customer closed Razorpay checkout.'}); }}
    });
    if(typeof rz.on==='function') rz.on('payment.failed',function(response){ recordPaymentStatus(order.bookingId,'PAYMENT_FAILED',response&&response.error||response||{}); });
    rz.open();
  }catch(e){ hideLoader(); alert(e.message||'Payment could not be started. Please try again.'); }
}
async function loadStatusById(id){ try{ showLoader('',true); const res=await apiGet('/api/bookings/'+encodeURIComponent(id)+'/status'); save(KEY.status,res); renderStatus(res.booking||res.data||res,res); }catch(e){ renderStatus({bookingId:id, bookingStatus:'PENDING', error:e.message},{success:false,message:e.message}); }finally{ hideLoader(); } }
function statusLabel(b){ const s=String(b.bookingStatus||b.status||b.orderStatus||'PENDING').toUpperCase(); if(s.includes('SUCCESS')||s.includes('CONFIRM')) return ['Booking confirmed','confirmed']; if(s.includes('FAIL')||s.includes('ABORT')) return ['Booking failed','failed']; if(s.includes('CANCEL')) return ['Booking cancelled','cancelled']; if(s.includes('HOLD')) return ['Booking on hold','pending']; return ['Booking pending','pending']; }

function firstVal(){
  for(const v of arguments){
    if(v!==undefined && v!==null && String(v).trim()!=='') return v;
  }
  return '';
}
function parseJsonMaybe(v){
  if(!v) return {};
  if(typeof v === 'object') return v;
  try{ return JSON.parse(String(v)); }catch(e){ return {}; }
}
function hotelBookingDetailsRaw(b){
  b=b||{};
  return b.supplierBooking?.details || b.tripjackBookingDetails || b.bookingDetails || b.detailsRaw || b.rawBookingDetails || {};
}
function hotelStatusHInfo(b){
  const raw=hotelBookingDetailsRaw(b);
  return raw?.itemInfos?.HOTEL?.hInfo || raw?.hInfo || b.reviewRaw?.hInfo || b.tripjackReviewRaw?.hInfo || b.selectedResult?.raw?.hInfo || b.selectedResult?.hInfo || hotel() || {};
}
function hotelStatusQuery(b){
  const raw=hotelBookingDetailsRaw(b);
  return raw?.itemInfos?.HOTEL?.query || raw?.query || b.reviewRaw?.query || b.tripjackReviewRaw?.query || b.details?.searchPayload || b.search || S.search || {};
}
function hotelOrderInfo(b){
  const raw=hotelBookingDetailsRaw(b);
  return raw?.order || b.order || {};
}
function addressFromHotel(h){
  const ad=h?.ad || h?.address || {};
  if(typeof ad === 'string') return ad;
  return [ad.adr, ad.ctn || ad.city?.name, ad.sn || ad.state?.name, ad.cn || ad.country?.name, ad.postalCode].filter(Boolean).join(', ');
}
function phoneFromHotel(h){
  const c=h?.cnt || h?.contact || {};
  return c.ph || c.phone || c.mobile || '';
}
function hotelNameFromStatus(b){
  const h=hotelStatusHInfo(b);
  return firstVal(h.name, b.selectedResult?.name, hotel().name, 'Hotel booking');
}
function tripjackBookingIdFromStatus(b){
  const order=hotelOrderInfo(b), raw=hotelBookingDetailsRaw(b);
  return firstVal(
    order.bookingId,
    raw.bookingId,
    b.supplierBookingId,
    b.tripjackBookingId,
    b.tripjackReviewBookingId,
    b.reviewRaw?.bookingId,
    b.tripjackReviewRaw?.bookingId,
    b.supplierBooking?.request?.bookingId,
    b.supplierBooking?.book?.bookingId,
    b.supplierBooking?.confirm?.bookingId
  );
}
function hotelCheckDates(b){
  const q=hotelStatusQuery(b), h=hotelStatusHInfo(b);
  const op=arr(h.ops)[0] || {};
  const ris=arr(op.ris)[0] || {};
  const ci=firstVal(q.checkinDate, q.checkIn, q.checkInDate, ris.checkInDate, b.details?.searchPayload?.checkIn, b.search?.checkIn);
  const co=firstVal(q.checkoutDate, q.checkOut, q.checkOutDate, ris.checkOutDate, b.details?.searchPayload?.checkOut, b.search?.checkOut);
  return {checkIn:ci, checkOut:co, nights:nights(ci,co)};
}
function hotelRoomInfos(b){
  const h=hotelStatusHInfo(b);
  const ops=arr(h.ops);
  const rooms=[];
  ops.forEach(op=>{
    arr(op.ris).forEach((ri,idx)=>{
      const cnp=ri.cnp || op.cnp || {};
      const room={
        id:ri.id || op.id || ('room_'+rooms.length),
        name:firstVal(ri.rc, ri.rt, ri.srn, 'Selected room'),
        roomType:firstVal(ri.rt, ri.rc, ri.srn, ''),
        meal:firstVal(ri.mb, op.mb, option().mealBasis, 'As selected'),
        adults:firstVal(ri.adt, ''),
        children:firstVal(ri.chd, ''),
        price:n(ri.tfcs?.TF) || n(ri.tp) || n(op.tp),
        currency:firstVal(op.sc, 'INR'),
        refundable: cnp.ifra===true ? 'Refundable' : (cnp.inra===true ? 'Non-refundable' : ''),
        deadline:firstVal(ri.ddt, op.ddt, ''),
        cancellation:cnp,
        guests:arr(ri.ti),
        benefits:ri.rexb || op.rexb || {},
        instructions:arr(ri.inst).concat(arr(op.inst))
      };
      rooms.push(room);
    });
  });
  return rooms;
}
function hotelRoomBenefitsHtml(room){
  const b=room.benefits||{};
  const vals=[]
    .concat(arr(b.BENEFIT).map(x=>x && (x.values || x.name || x.desc || x.type || x)))
    .concat(arr(b.SERVICE).map(x=>x && (x.values || x.name || x.desc || x.type || x)))
    .flat()
    .filter(Boolean)
    .map(x=>typeof x==='object' ? (x.name||x.value||x.desc||x.type||'') : String(x))
    .filter(Boolean)
    .slice(0,4);
  return vals.length ? '<div class="tyh-status-chips">'+vals.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>' : '';
}
function hotelRoomsHtml(b){
  const rooms=hotelRoomInfos(b);
  if(!rooms.length){
    const d=draft();
    return '<div class="tyh-status-room"><b>'+esc(option().roomSummary||option().roomType||'Selected room')+'</b><p>'+esc(option().mealBasis||'Room plan as selected')+'</p></div>';
  }
  return rooms.map((r,i)=>'<div class="tyh-status-room">'
    +'<div class="tyh-status-room-head"><b>Room '+(i+1)+': '+esc(r.name)+'</b>'+(r.refundable?'<span>'+esc(r.refundable)+'</span>':'')+'</div>'
    +'<div class="tyh-status-mini-grid">'
      +'<p><small>Meal basis</small><strong>'+esc(r.meal)+'</strong></p>'
      +'<p><small>Guests</small><strong>'+esc([r.adults?`${r.adults} Adult`:null,r.children?`${r.children} Child`:null].filter(Boolean).join(', ')||'As booked')+'</strong></p>'
      +'<p><small>Room amount</small><strong>'+money(r.price)+'</strong></p>'
      +'<p><small>Free cancellation till</small><strong>'+esc(r.deadline?fmtDate(r.deadline):'As per policy')+'</strong></p>'
    +'</div>'
    +hotelRoomBenefitsHtml(r)
    +'</div>').join('');
}
function hotelGuestsFromStatus(b){
  const rooms=hotelRoomInfos(b);
  const guestsFromRooms=rooms.flatMap((r,ri)=>arr(r.guests).map(g=>Object.assign({room:ri+1},g)));
  if(guestsFromRooms.length) return guestsFromRooms;
  const d=b.details||draft();
  return arr(d.guests).length ? arr(d.guests) : defaultGuests();
}
function guestName(g){
  return [g.ti||g.title, g.fN||g.firstName, g.lN||g.lastName].filter(Boolean).join(' ') || 'Pending';
}
function guestType(g){
  const t=String(g.pt||g.type||'Guest').toUpperCase();
  if(t==='ADT') return 'Adult';
  if(t==='CHD') return 'Child';
  if(t==='INF') return 'Infant';
  return t.charAt(0)+t.slice(1).toLowerCase();
}
function statusGuests(b){
  const guests=hotelGuestsFromStatus(b);
  return guests.map((g,i)=>'<div class="tyh-guest-row"><span>'+esc('Room '+(g.room||1)+' • '+guestType(g)+' '+(i+1))+'</span><b>'+esc(guestName(g)+(g.age!==undefined&&g.age!==''?' • Age '+g.age:''))+'</b></div>');
}
function hotelPolicyHtml(b){
  const rooms=hotelRoomInfos(b);
  const h=hotelStatusHInfo(b);
  const raw=hotelBookingDetailsRaw(b);
  const policies=[];
  rooms.forEach((r,i)=>{
    const pd=arr(r.cancellation&&r.cancellation.pd);
    if(pd.length){
      policies.push('<div class="tyh-policy-box"><b>Room '+(i+1)+' cancellation</b>'+pd.map(x=>'<p>'+esc([x.fdt?fmtDate(x.fdt):'', x.tdt?fmtDate(x.tdt):'', x.am!=null?money(x.am):'', x.pp!=null?x.pp+'%':'' ].filter(Boolean).join(' - ')||'As per hotel policy')+'</p>').join('')+'</div>');
    }
  });
  const inst=arr(h.inst).concat(rooms.flatMap(r=>arr(r.instructions))).map(x=>x && (x.msg||x.type||x)).filter(Boolean).slice(0,5);
  if(inst.length){
    policies.push('<div class="tyh-policy-box"><b>Hotel instructions</b>'+inst.map(x=>'<p>'+esc(x)+'</p>').join('')+'</div>');
  }
  return policies.join('') || '<div class="tyh-policy-box">Hotel rules and cancellation policy will be shown from Tripjack booking details when available.</div>';
}
function hotelContactHtml(b){
  const order=hotelOrderInfo(b);
  const di=order.deliveryInfo || b.deliveryInfo || {};
  const d=b.details||draft();
  const email=firstVal(arr(di.emails)[0], d.contact?.email, d.email, b.user?.email);
  const phone=firstVal(arr(di.contacts)[0], d.contact?.phone, d.phone, b.user?.phone);
  return '<div class="tyh-kv"><span>Email</span><b>'+esc(email||'Pending')+'</b></div>'
    +'<div class="tyh-kv"><span>Phone</span><b>'+esc(phone||'Pending')+'</b></div>';
}
function hotelPaymentHtml(b){
  const order=hotelOrderInfo(b), h=hotelStatusHInfo(b), rooms=hotelRoomInfos(b);
  const roomTotal=rooms.reduce((a,r)=>a+n(r.price),0);
  const paid=n(order.amount) || n(b.amount) || n(b.totalAmount) || n(b.price&&b.price.customerPayable) || totalAmount();
  const currency=firstVal(order.currency, arr(h.ops)[0]?.sc, 'INR');
  return '<div class="tyh-kv"><span>Room total</span><b>'+money(roomTotal||paid)+'</b></div>'
    +'<div class="tyh-kv"><span>Payment status</span><b>'+esc(b.paymentStatus||'Pending')+'</b></div>'
    +'<div class="tyh-kv"><span>Currency</span><b>'+esc(currency)+'</b></div>'
    +'<div class="tyh-kv total"><span>Total paid</span><b>'+money(paid)+'</b></div>';
}
function hotelStatusCardHtml(b){
  const h=hotelStatusHInfo(b), info=parseJsonMaybe(h.des);
  const dates=hotelCheckDates(b);
  const addr=addressFromHotel(h);
  const ph=phoneFromHotel(h);
  const stars='★'.repeat(Math.max(0,Math.min(5,Math.round(Number(h.rt||h.star||hotel().star||0)))));
  const img=imageOf(h)||imageOf(hotel());
  return '<section class="tyh-summary-card tyh-status-hotel-card">'
    +'<div class="tyh-status-hotel-img">'+(img?'<img src="'+attr(img)+'" alt="'+attr(hotelNameFromStatus(b))+'">':'<span>H</span>')+'</div>'
    +'<div class="tyh-status-hotel-body">'
      +'<h2>'+esc(hotelNameFromStatus(b))+'</h2>'
      +(stars?'<div class="tyh-stars">'+stars+'</div>':'')
      +'<p>'+esc(addr||info.location||'Hotel address will be shown from Tripjack booking details.')+'</p>'
      +(ph?'<p><b>Hotel phone:</b> '+esc(ph)+'</p>':'')
      +'<div class="tyh-status-mini-grid">'
        +'<p><small>Check-in</small><strong>'+esc(dates.checkIn?fmtDate(dates.checkIn):'Pending')+'</strong></p>'
        +'<p><small>Check-out</small><strong>'+esc(dates.checkOut?fmtDate(dates.checkOut):'Pending')+'</strong></p>'
        +'<p><small>Nights</small><strong>'+esc(dates.nights||'Pending')+'</strong></p>'
        +'<p><small>Rooms</small><strong>'+esc(hotelRoomInfos(b).length || arr(hotelStatusQuery(b).roomInfo).length || 1)+'</strong></p>'
      +'</div>'
    +'</div>'
  +'</section>';
}
function hotelReferenceFromStatus(b){
  return firstVal(
    b.hotelConfirmationNumber,b.hotelConfirmationNo,b.hotelReference,b.confirmationNumber,b.confirmationNo,b.voucherNumber,
    deepFind(b,['hotelConfirmationNumber','hotelConfirmationNo','hotelReference','confirmationNumber','confirmationNo','voucherNumber'])
  );
}
function renderStatus(b, raw){
  b=b||{};
  const lab=statusLabel(b);
  const id=b.bookingId||b.id||b.travelYaraaBookingId||'';
  const reference=hotelReferenceFromStatus(b);
  const isConfirmed=lab[1]==='confirmed' && !!reference;
  const statusNote=isConfirmed
    ? 'Your hotel booking is confirmed. Please carry valid ID proof at check-in.'
    : lab[1]==='failed'
      ? 'This hotel reservation could not be completed. Any eligible reversal or refund will follow the payment and hotel policy.'
      : lab[1]==='cancelled'
        ? 'This hotel booking is cancelled. Refund details will appear when they are received from the payment and hotel systems.'
        : 'The hotel booking is being confirmed. Open this page again for the latest status.';
  let content='<main class="tyh-status tyh-hotel-status-page">'
    +'<section class="tyh-confirm '+lab[1]+'"><div><h2>'+esc(lab[0])+'</h2><p>'+esc(statusNote)+'</p></div><span>'+esc(lab[0])+'</span></section>'
    +hotelStatusCardHtml(b);
  if(isConfirmed){
    content+='<section class="tyh-panel"><h2>Booking reference</h2>'
      +'<div class="tyh-kv"><span>Booking ID</span><b>'+esc(id)+'</b></div>'
      +'<div class="tyh-kv"><span>Hotel reference</span><b>'+esc(reference)+'</b></div>'
      +'</section>'
      +'<section class="tyh-panel"><h2>Room details</h2>'+hotelRoomsHtml(b)+'</section>'
      +'<section class="tyh-panel"><h2>Guest details</h2>'+statusGuests(b).join('')+'</section>'
      +'<section class="tyh-panel"><h2>Contact details</h2>'+hotelContactHtml(b)+'</section>'
      +'<section class="tyh-panel"><h2>Payment summary</h2>'+hotelPaymentHtml(b)+'</section>'
      +'<section class="tyh-panel"><h2>Hotel policy</h2>'+hotelPolicyHtml(b)+'</section>'
      +'<section class="tyh-actions tyh-status-actions">'
        +'<button data-download="/api/bookings/'+attr(id)+'/ticket">Download voucher</button>'
        +'<button data-download="/api/bookings/'+attr(id)+'/receipt">Download receipt</button>'
        +'<button data-action="email">Resend email</button>'
        +'<button data-action="refresh">Refresh status</button>'
        +'<button data-action="cancel">Cancel / refund</button>'
        +'<button data-action="change">Request stay change</button>'
        +'<button data-action="support">Contact support</button>'
        +'<button data-action="new">New booking</button>'
      +'</section>';
  }else{
    content+='<section class="tyh-actions tyh-status-actions"><button data-action="new">New booking</button></section>';
  }
  content+='</main>';
  shell(content,{title:'Booking status',sub:'Hotel booking',status:lab[0]});
  bindStatus(id,b);
}
async function action(id, type){
  try{
    if(type==='new'){ location.href='/index.html?service=hotel'; return; }
    if(type==='refresh') return loadStatusById(id);
    if(type==='email'){
      const r=await api('/api/bookings/'+encodeURIComponent(id)+'/resend-email',{});
      alert(r.message||'Email sent.');
      return;
    }
    if(type==='cancel'){
      if(!confirm('Check the hotel cancellation charges and continue with the cancellation request?')) return;
      const quote=await api('/api/bookings/'+encodeURIComponent(id)+'/cancel',{confirm:false,service:'hotel',reason:'Customer requested hotel cancellation/refund from Booking Status Page'});
      const summary=quote.message||'Cancellation charges were checked.';
      if(!confirm(summary+' Submit the cancellation request now?')) return;
      const r=await api('/api/bookings/'+encodeURIComponent(id)+'/cancel',{confirm:true,service:'hotel',reason:'Customer confirmed hotel cancellation/refund from Booking Status Page'});
      alert(r.message||'Cancellation request submitted.');
      if(r.booking) renderStatus(r.booking,r);
      return;
    }
    if(type==='change'){
      const remarks=prompt('Enter the stay change request details','');
      if(remarks===null||!String(remarks).trim()) return;
      const r=await api('/api/bookings/'+encodeURIComponent(id)+'/change-request',{service:'hotel',remarks:String(remarks).trim()});
      alert(r.message||'Change request recorded.');
      if(r.booking) renderStatus(r.booking,r);
      return;
    }
    if(type==='support'){ location.href='/customer-support.html?bookingId='+encodeURIComponent(id); }
  }catch(e){ alert(e.message||'Action failed. Please try again.'); }
}
async function downloadStatusFile(path){
  try{
    showLoader('',true);
    const response=await fetch(API+path,{headers:requestHeaders(path,false),cache:'no-store'});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||data.error||'Document is not available.');}
    const blob=await response.blob();
    const disposition=response.headers.get('content-disposition')||'';
    const match=disposition.match(/filename="?([^";]+)"?/i);
    const name=match&&match[1]?match[1]:'TravelYaraa-document.pdf';
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }catch(e){alert(e.message||'Document could not be downloaded.');}finally{hideLoader();}
}
function bindStatus(id,b){
  qa('[data-download]',root).forEach(x=>x.onclick=()=>{if(!x.disabled)downloadStatusFile(x.dataset.download);});
  qa('[data-action]',root).forEach(x=>x.onclick=()=>action(id,x.dataset.action));
}

function init(){ if(window.__tyhResultsInit) return; window.__tyhResultsInit=true; const params=new URLSearchParams(location.search); const step=params.get('step')||'results'; const bookingId=params.get('bookingId')||params.get('id'); if(step==='booking-status'&&bookingId){ loadStatusById(bookingId); return; } if(step==='guest'&&read(KEY.draft,null)){ S.search=searchPayload(); setPage('guest'); renderGuestStep(); return; } if(step==='review'&&read(KEY.draft,null)){ S.search=searchPayload(); setPage('review'); renderReviewStep(); return; } if(step!=='hotel-details') setPage('results'); loadResults(); }
window.addEventListener('popstate',()=>{ const params=new URLSearchParams(location.search); const step=params.get('step')||'results'; if(step==='guest')renderGuestStep(); else if(step==='review')renderReviewStep(); else if(step==='booking-status'){ const id=params.get('bookingId'); id?loadStatusById(id):renderStatus(read(KEY.status,{})); } else if(step==='hotel-details'){ S.detailHotel=hotelByRealId(params.get('hotelId')||''); renderHotelDetailsPlumbing(); } else renderResults(); });

function css(){ return `
:root{--ty-navy:#071d49;--ty-blue:#0062e3;--ty-orange:#ef6614;--ty-bg:#f4f7fb;--ty-line:#e4ecf7;--ty-text:#101828;--ty-muted:#667085;--ty-soft:#eef6ff;--ty-green:#067647;--ty-red:#b42318}*{box-sizing:border-box}body.ty-hotel-page,body.travel-page{margin:0;background:var(--ty-bg);font-family:Inter,Arial,sans-serif;color:var(--ty-text);text-transform:none}.tyh-page{min-height:100vh;background:var(--ty-bg);padding-bottom:110px}.tyh-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid var(--ty-line);box-shadow:0 4px 16px rgba(7,29,73,.04)}.tyh-back{width:42px;height:42px;border:0;border-radius:14px;background:#f1f6ff;color:var(--ty-navy);font-size:30px;font-weight:900;line-height:1}.tyh-top-title{min-width:0;flex:1}.tyh-top h1{margin:0;color:var(--ty-navy);font-size:20px;font-weight:900;letter-spacing:0}.tyh-top p{margin:3px 0 0;color:var(--ty-muted);font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tyh-status-pill{background:#e7f8ef;color:#067647;border:1px solid #c8f1da;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:900}.tyh-results{max-width:1180px;margin:14px auto;display:grid;grid-template-columns:260px minmax(0,1fr);gap:14px;padding:0 14px}.tyh-filter{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:16px;position:sticky;top:76px;align-self:start}.tyh-filter h2{margin:0 0 12px;color:var(--ty-navy);font-size:18px}.tyh-filter h3{font-size:14px;margin:14px 0 8px;color:var(--ty-navy)}.tyh-filter label{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px;font-weight:750;color:#344054;line-height:1.3}.tyh-filter input[type=number]{width:100%;height:38px;border:1px solid var(--ty-line);border-radius:10px;padding:0 10px;margin:5px 0;font-size:14px}.tyh-filter-actions{display:flex;gap:8px;border-top:1px solid var(--ty-line);padding-top:12px;margin-top:12px}.tyh-filter-actions button{flex:1;height:40px;border-radius:12px;border:1px solid var(--ty-line);background:#fff;color:var(--ty-navy);font-weight:900}.tyh-filter-actions button:first-child{border:0;background:var(--ty-orange);color:#fff}.tyh-search-line{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--ty-line);border-radius:16px;padding:14px;margin-bottom:12px}.tyh-search-line strong{display:block;color:var(--ty-navy);font-size:18px}.tyh-search-line span{display:block;color:var(--ty-muted);font-size:12px;margin-top:3px}.tyh-search-line button{display:none;border:1px solid var(--ty-line);background:#fff;border-radius:12px;height:38px;padding:0 12px;font-weight:900;color:var(--ty-navy)}.tyh-sort{display:flex;gap:10px;overflow:auto;margin-bottom:12px}.tyh-sort button{border:1px solid var(--ty-line);background:#fff;border-radius:999px;padding:10px 14px;font-weight:900;color:var(--ty-navy);white-space:nowrap}.tyh-sort button.active{border-color:var(--ty-blue);background:#eef6ff;color:var(--ty-blue)}.tyh-cards{display:grid;gap:14px}.tyh-card{background:#fff;border:1px solid var(--ty-line);border-radius:20px;box-shadow:0 10px 28px rgba(7,29,73,.07);display:grid;grid-template-columns:230px minmax(0,1fr) 190px;overflow:hidden}.tyh-img{min-height:178px;background:#eef6ff;display:grid;place-items:center;color:var(--ty-blue);font-size:42px;font-weight:900}.tyh-img img{width:100%;height:100%;object-fit:cover}.tyh-info{padding:16px;min-width:0}.tyh-info h2{margin:0 0 6px;color:#101828;font-size:20px;line-height:1.25;font-weight:900;letter-spacing:0}.tyh-info p{margin:0;color:var(--ty-muted);font-size:13px;font-weight:700;line-height:1.35}.tyh-stars{color:#f5b301;margin:9px 0;font-size:14px;letter-spacing:1px}.tyh-tags{display:flex;gap:6px;flex-wrap:wrap}.tyh-tags span,.tyh-rate span{background:#f2f4f7;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:800;color:#344054}.tyh-price{border-left:1px solid var(--ty-line);padding:16px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:7px;text-align:right}.tyh-price em{background:#067647;color:#fff;border-radius:9px;padding:5px 8px;font-size:12px;font-style:normal;font-weight:900}.tyh-price b{font-size:22px;color:#101828}.tyh-price small{color:var(--ty-muted);font-size:11px;font-weight:700}.tyh-price button,.tyh-rate button,.tyh-bottom button,.tyh-actions button,.tyh-empty button{height:42px;border:0;border-radius:13px;background:var(--ty-orange);color:#fff;padding:0 16px;font-weight:900;font-size:14px}.tyh-empty{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:28px;text-align:center;margin:12px}.tyh-empty h2{margin:0 0 8px;color:var(--ty-navy)}.tyh-empty p,.tyh-muted{color:var(--ty-muted);font-weight:700}.tyh-modal-bg{position:fixed;inset:0;background:rgba(7,29,73,.45);z-index:70}.tyh-room{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:80;width:min(780px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -12px 35px rgba(7,29,73,.18)}.tyh-room header{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--ty-line);padding:16px;display:flex;justify-content:space-between;gap:12px}.tyh-room h2{margin:0;color:var(--ty-navy);font-size:19px}.tyh-room header p{margin:4px 0 0;color:var(--ty-muted);font-size:12px}.tyh-room header button{width:38px;height:38px;border:0;border-radius:12px;background:#f2f4f7;font-size:24px}.tyh-room-body{padding:16px}.tyh-rate{border:1px solid var(--ty-line);border-radius:16px;padding:14px;margin-bottom:12px;display:grid;grid-template-columns:minmax(0,1fr) 148px;gap:12px;align-items:stretch}
.tyh-rate-main{min-width:0}
.tyh-rate-side{display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start;gap:6px;width:148px}
.tyh-rate-side strong{display:block;text-align:right;margin:0;font-size:18px;line-height:1.2}
.tyh-rate-side em{display:block;text-align:right;font-style:normal;color:var(--ty-muted);font-size:12px;font-weight:700;margin:0 0 auto}
.tyh-rate-side button{width:100%;margin-top:8px}.tyh-rate b{display:block;color:#101828;font-size:15px;line-height:1.3}.tyh-rate p{margin:6px 0;color:var(--ty-muted);font-size:12px}.tyh-book,.tyh-status{max-width:920px;margin:14px auto;padding:0 14px;display:grid;gap:14px}.tyh-summary-card,.tyh-panel,.tyh-actions,.tyh-confirm{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:16px;box-shadow:0 10px 24px rgba(7,29,73,.05)}.tyh-mini{display:grid;grid-template-columns:150px minmax(0,1fr);gap:14px;align-items:center}.tyh-mini-img{height:115px;border-radius:14px;background:#eef6ff;display:grid;place-items:center;overflow:hidden;color:var(--ty-blue);font-size:40px;font-weight:900}.tyh-mini-img img{width:100%;height:100%;object-fit:cover}.tyh-mini h2{margin:0 0 6px;color:var(--ty-navy);font-size:21px;line-height:1.25}.tyh-mini p{margin:0;color:var(--ty-muted);font-size:13px;line-height:1.35}.tyh-room-name{margin-top:8px!important;color:#344054!important;font-weight:800}.tyh-panel h2{margin:0 0 12px;color:var(--ty-navy);font-size:18px}.tyh-panel h2 small{font-size:12px;color:var(--ty-muted);font-weight:700}.tyh-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:14px}.tyh-tabs button{border:1px solid var(--ty-line);background:#fff;color:var(--ty-navy);border-radius:999px;padding:9px 12px;font-size:13px;font-weight:900;white-space:nowrap}.tyh-tabs button.active{border-color:var(--ty-blue);background:#eef6ff;color:var(--ty-blue)}.tyh-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tyh-form-grid label{font-size:12px;color:#344054;font-weight:850;display:grid;gap:6px}.tyh-form-grid input,.tyh-form-grid select{height:44px;border:1px solid var(--ty-line);border-radius:12px;padding:0 12px;font-size:14px;background:#fff;color:#101828}.tyh-check{display:flex!important;align-items:flex-start;gap:10px;color:#344054;font-size:13px;font-weight:750;line-height:1.4}.tyh-kv,.tyh-guest-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #eef2f7;padding:11px 0;align-items:center}.tyh-kv:first-of-type,.tyh-guest-row:first-of-type{border-top:0}.tyh-kv span,.tyh-guest-row span{color:var(--ty-muted);font-size:13px;font-weight:750}.tyh-kv b,.tyh-guest-row b{color:#101828;text-align:right;font-size:14px}.tyh-kv.total b{font-size:21px;color:var(--ty-blue)}.tyh-policy-actions{display:flex;gap:8px;flex-wrap:wrap}.tyh-policy-actions button{border:1px solid var(--ty-line);background:#fff;border-radius:999px;color:var(--ty-blue);font-weight:900;padding:9px 12px}.tyh-policy-box{margin-top:12px;background:#f8fbff;border:1px solid var(--ty-line);border-radius:14px;padding:12px;color:#344054;font-size:13px;line-height:1.45}.tyh-bottom{position:sticky;bottom:0;z-index:40;background:#101827;color:#fff;border-radius:22px 22px 0 0;margin:4px -14px -110px;padding:16px 18px calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:space-between;align-items:center;gap:12px}.tyh-bottom span{display:block;font-size:12px;font-weight:800;color:#cbd5e1}.tyh-bottom b{font-size:22px}.tyh-bottom button{min-width:190px;border-radius:999px}.tyh-confirm{background:#ecfdf3;border-color:#bbf7d0}.tyh-confirm.failed{background:#fff1f2;border-color:#fecdd3}.tyh-confirm.pending{background:#fff7ed;border-color:#fed7aa}.tyh-confirm h2{margin:0 0 8px;font-size:24px;color:var(--ty-navy)}.tyh-confirm p{margin:0 0 10px;color:#344054}.tyh-confirm span{display:inline-flex;background:#fff;border-radius:999px;padding:7px 11px;color:#344054;font-weight:900;font-size:12px}.tyh-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tyh-actions button{background:#fff;color:var(--ty-navy);border:1px solid var(--ty-line)}.tyh-actions button:nth-child(1),.tyh-actions button:nth-child(2){background:var(--ty-blue);color:#fff;border:0}.tyh-actions button:disabled{opacity:.45;cursor:not-allowed}
.tyh-hotel-status-page{max-width:980px}
.tyh-status-hotel-card{display:grid;grid-template-columns:210px minmax(0,1fr);gap:16px;align-items:stretch}
.tyh-status-hotel-img{border-radius:16px;overflow:hidden;min-height:150px;background:#eef6ff;display:grid;place-items:center;color:var(--ty-blue);font-size:46px;font-weight:900}
.tyh-status-hotel-img img{width:100%;height:100%;object-fit:cover}
.tyh-status-hotel-body h2{margin:0 0 6px;color:var(--ty-navy);font-size:22px;line-height:1.25}
.tyh-status-hotel-body p{margin:6px 0;color:#344054;font-size:13px;line-height:1.45;font-weight:650}
.tyh-status-mini-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}
.tyh-status-mini-grid p{margin:0;background:#f8fbff;border:1px solid var(--ty-line);border-radius:13px;padding:10px}
.tyh-status-mini-grid small{display:block;color:var(--ty-muted);font-size:11px;font-weight:800;margin-bottom:4px}
.tyh-status-mini-grid strong{display:block;color:var(--ty-navy);font-size:13px;line-height:1.25}
.tyh-status-room{border:1px solid var(--ty-line);border-radius:16px;padding:13px;margin:10px 0;background:#fff}
.tyh-status-room-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}
.tyh-status-room-head b{color:var(--ty-navy);font-size:15px;line-height:1.35}
.tyh-status-room-head span{background:#e7f8ef;color:#067647;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900;white-space:nowrap}
.tyh-status-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.tyh-status-chips span{background:#f2f4f7;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:800;color:#344054}
.tyh-status-actions button:nth-child(1){background:var(--ty-blue);color:#fff;border:0}
.tyh-status-actions button:nth-child(2){background:#fff;color:var(--ty-blue);border:1px solid var(--ty-blue)}
@media(max-width:860px){
.tyh-status-hotel-card{grid-template-columns:1fr}
.tyh-status-hotel-img{min-height:165px}
.tyh-status-mini-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.tyh-status-room-head{display:block}
.tyh-status-room-head span{display:inline-flex;margin-top:8px}
}

.tyh-page{padding-bottom:28px}
.tyh-shell{max-width:1180px;margin:0 auto}
.tyh-top{max-width:1180px;margin:0 auto;width:100%;padding:10px 14px}
.tyh-logo{display:flex;align-items:center;flex:0 0 auto}
.tyh-logo img{height:44px;width:auto;display:block;object-fit:contain}
.tyh-modify{max-width:1180px;margin:12px auto 0;padding:10px;display:grid;grid-template-columns:1.5fr .95fr .55fr .95fr 1.15fr auto;gap:8px;align-items:stretch;background:#fff;border:1px solid var(--ty-line);border-radius:16px;box-shadow:0 8px 20px rgba(7,29,73,.04)}
.tyh-mod-box,.tyh-mod-nights{display:flex;flex-direction:column;justify-content:center;gap:3px;text-align:left;border:1px solid var(--ty-line);border-radius:12px;background:#fff;padding:8px 10px;min-height:64px;color:#101828}
.tyh-mod-box small,.tyh-mod-nights small{font-size:11px;font-weight:800;color:#667085}
.tyh-mod-box b,.tyh-mod-nights b{font-size:14px;font-weight:900;color:#071d49;line-height:1.2}
.tyh-mod-box em{font-style:normal;font-size:11px;color:#667085;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tyh-mod-search{height:64px;border:0;border-radius:12px;background:var(--ty-blue);color:#fff;padding:0 22px;font-weight:900;font-size:15px}
.tyh-nights-step{display:flex;align-items:center;gap:8px}
.tyh-step{display:flex;align-items:center;gap:8px}
.tyh-step button{width:28px;height:28px;border-radius:50%;border:1px solid var(--ty-line);background:#fff;color:var(--ty-blue);font-weight:900}
.tyh-step button:disabled{opacity:.35}
.tyh-pop-bg{position:fixed;inset:0;background:rgba(7,29,73,.45);z-index:90}
.tyh-city-pop,.tyh-guest-pop,.tyh-cal{position:fixed;z-index:91;background:#fff;border-radius:18px;box-shadow:0 22px 60px rgba(7,29,73,.22)}
.tyh-city-pop,.tyh-guest-pop{left:50%;top:18%;transform:translateX(-50%);width:min(460px,calc(100% - 24px));max-height:70vh;overflow:auto}
.tyh-city-pop header,.tyh-guest-pop header,.tyh-cal header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid var(--ty-line)}
.tyh-city-pop h2,.tyh-guest-pop h2,.tyh-cal h2{margin:0;font-size:18px;color:var(--ty-navy)}
.tyh-city-pop header button,.tyh-guest-pop header button,.tyh-cal header button{border:0;background:#fff;font-size:24px;color:var(--ty-blue)}
.tyh-city-pop input[type=search]{width:calc(100% - 28px);margin:12px 14px;height:42px;border:1px solid var(--ty-line);border-radius:12px;padding:0 12px}
.tyh-city-row{width:100%;border:0;border-bottom:1px solid #f1f5f9;background:#fff;text-align:left;padding:12px 14px;display:grid;gap:4px}
.tyh-city-row b{color:#071d49;font-size:14px}
.tyh-city-row small{color:#667085;font-size:12px}
.tyh-guest-row-ctrl{display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid #f1f5f9}
.tyh-guest-row-ctrl small{display:block;color:#667085;font-size:12px;margin-top:3px}
.tyh-guest-done{width:calc(100% - 28px);margin:14px;height:46px;border:0;border-radius:12px;background:var(--ty-blue);color:#fff;font-weight:900}
.tyh-cal{left:50%;top:8%;transform:translateX(-50%);width:min(760px,calc(100% - 24px));max-height:84vh;overflow:auto}
.tyh-cal-selected{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px}
.tyh-cal-selected button{border:1px solid var(--ty-line);border-radius:12px;background:#fff;padding:10px;text-align:left}
.tyh-cal-selected button.active{border-color:var(--ty-blue);background:#eef6ff}
.tyh-cal-selected small{display:block;color:#667085;font-size:11px}
.tyh-cal-months{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:12px 16px 18px}
.tyh-cal-month-title{font-weight:900;color:var(--ty-navy);margin-bottom:8px}
.tyh-cal-week,.tyh-cal-days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.tyh-cal-week span{text-align:center;font-size:11px;color:#667085;font-weight:800;padding:6px 0}
.tyh-cal-day{height:38px;border:0;background:#fff;border-radius:10px;font-weight:800;color:#101828}
.tyh-cal-day.blank{visibility:hidden}
.tyh-cal-day.today{box-shadow:inset 0 0 0 1px var(--ty-blue)}
.tyh-cal-day.in-range{background:#eef6ff}
.tyh-cal-day.selected{background:var(--ty-blue);color:#fff}
.tyh-cal-day.disabled{color:#d0d5dd;pointer-events:none}
.tyh-filter-head [data-clear-top]{color:var(--ty-blue)!important;font-weight:900}
.tyh-ptype{font-size:12px!important;color:#344054!important;margin:0 0 4px!important}
.tyh-detail{background:#fff;border:1px solid var(--ty-line);border-radius:18px;overflow:hidden}
.tyh-detail-img{min-height:240px;background:#eaf2ff}
.tyh-detail-img img{width:100%;height:280px;object-fit:cover}
.tyh-detail-body{padding:16px 18px 22px}
.tyh-desc{margin:10px 0;color:#344054;line-height:1.45;font-size:14px}
.tyh-detail-rooms{margin-top:12px}
.tyh-results{max-width:1180px;margin:12px auto;padding:0 14px;display:grid!important;grid-template-columns:280px minmax(0,1fr)!important;gap:16px;align-items:start}
.tyh-list-wrap{min-width:0}
.tyh-list-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:12px}
.tyh-list-head strong{display:block;color:var(--ty-navy);font-size:18px}
.tyh-list-head span{display:block;color:var(--ty-muted);font-size:12px;margin-top:3px}
.tyh-desktop-sort{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:850;color:#344054}
.tyh-desktop-sort select{height:40px;border:1px solid var(--ty-line);border-radius:12px;padding:0 10px;background:#fff;font-weight:800}
.tyh-result-tools{display:none}
.tyh-filter{display:flex!important;flex-direction:column;position:sticky;top:76px;align-self:start;background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:0;overflow:hidden;max-height:calc(100vh - 96px)}
.tyh-filter-head{height:54px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--ty-line)}
.tyh-filter-head h2{flex:1;text-align:left;margin:0;font-size:16px}
.tyh-filter-head [data-filter-close]{display:none}
.tyh-filter-head button{border:0;background:#fff;color:#98a2b3;font-weight:900;font-size:13px}
.tyh-filter-stack{padding:8px 14px 14px;overflow:auto}
.tyh-filter-section{padding:10px 0;border-bottom:1px solid #f1f5f9}
.tyh-filter-section h3{margin:0 0 8px;font-size:13px}
.tyh-filter-section input[type=search]{width:100%;height:40px;border:1px solid var(--ty-line);border-radius:10px;padding:0 10px}
.tyh-fcheck{display:flex!important;align-items:center;gap:12px;margin:0!important;padding:10px 0;border-bottom:1px solid #f1f5f9;color:#344054}
.tyh-fcheck input{display:none}
.tyh-fcheck span{width:22px;height:22px;border-radius:7px;border:2px solid #98a2b3;display:inline-flex;align-items:center;justify-content:center;background:#fff;flex:0 0 auto}
.tyh-fcheck input:checked+span{background:var(--ty-blue);border-color:var(--ty-blue)}
.tyh-fcheck input:checked+span:after{content:'✓';color:#fff;font-size:14px;font-weight:900}
.tyh-fcheck b{font-size:13px;font-weight:750;flex:1}
.tyh-fcheck em{font-style:normal;color:#98a2b3;font-size:12px;font-weight:750}
.tyh-filter-actions{display:none}
.tyh-cards{display:grid;gap:10px}
.tyh-card{text-decoration:none;color:inherit;background:#fff;border:1px solid var(--ty-line);border-radius:14px;box-shadow:0 6px 16px rgba(7,29,73,.05);display:grid;grid-template-columns:168px minmax(0,1fr);overflow:hidden;cursor:pointer;min-height:132px}
.tyh-card:focus-visible{outline:3px solid #99c2ff;outline-offset:2px}
.tyh-img{min-height:132px;position:relative;background:#eaf2ff;display:grid;place-items:center;color:var(--ty-blue);font-size:36px;font-weight:900}
.tyh-img img{width:100%;height:100%;object-fit:cover}
.tyh-info{padding:10px 12px;min-width:0}
.tyh-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.tyh-title-row h2{margin:0;font-size:16px;line-height:1.25;color:#101828}
.tyh-stars{margin:0;color:#f5b301;white-space:nowrap;font-size:12px}
.tyh-location{font-size:12px!important;margin:4px 0 6px!important}
.tyh-facilities{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.tyh-facilities span{background:transparent;padding:0;color:#101828;font-size:12px;font-weight:800}
.tyh-meal,.tyh-free{margin-top:3px!important;color:#067647!important;font-size:12px!important}
.tyh-meal{color:#667085!important}
.tyh-card-foot{display:flex;justify-content:flex-end;align-items:flex-end;gap:12px;margin-top:6px}
.tyh-price{border:0!important;padding:0!important;display:block!important;text-align:right}
.tyh-price small{display:block;font-size:11px!important;color:#344054!important}
.tyh-price b{display:block;font-size:18px!important;color:#101828!important}
.tyh-price em{display:block;background:transparent!important;color:#667085!important;padding:0!important;font-size:11px!important;font-style:normal}
.tyh-details-plumb{max-width:1180px;margin:12px auto;padding:0 14px}
.tyh-sort-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:95}
.tyh-sort-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(560px,100%);background:#fff;z-index:96;border-radius:22px 22px 0 0;box-shadow:0 -14px 40px rgba(0,0,0,.2);padding-bottom:env(safe-area-inset-bottom)}
.tyh-sort-sheet header{height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid var(--ty-line)}
.tyh-sort-sheet h2{margin:0;color:#101828;font-size:22px}
.tyh-sort-sheet header button{border:0;background:#fff;color:var(--ty-blue);font-size:30px;font-weight:900}
.tyh-sort-sheet>button{width:100%;height:64px;border:0;background:#fff;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;padding:0 20px;color:#101828;text-align:left}
.tyh-sort-sheet>button b{font-size:17px;font-weight:900}
.tyh-sort-sheet>button span{font-size:13px;color:#667085;font-weight:700}
.tyh-sort-sheet>button i{width:26px;height:26px;border-radius:50%;border:2px solid #98a2b3}
.tyh-sort-sheet>button.active i{border:7px solid var(--ty-blue)}
.tyh-room{max-height:88vh;border-radius:20px 20px 0 0}
@media(max-width:860px){
.tyh-modify,.tyh-mod-nights,.tyh-desktop-sort{display:none!important}
.tyh-logo img{height:36px}
.tyh-cal{left:0;right:0;top:auto;bottom:0;transform:none;width:100%;max-height:82vh;border-radius:22px 22px 0 0}
.tyh-cal-months{grid-template-columns:1fr}
.tyh-city-pop,.tyh-guest-pop{left:0;right:0;top:auto;bottom:0;transform:none;width:100%;border-radius:22px 22px 0 0}
.tyh-results{display:block!important;grid-template-columns:none!important;margin:8px auto;padding:0 10px}
.tyh-result-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 12px}
.tyh-result-tools button{height:48px;border:1px solid var(--ty-line);background:#fff;border-radius:12px;color:#101828;font-size:14px;font-weight:900}
.tyh-filter{display:none!important;position:fixed;left:0;right:0;top:auto;bottom:0;z-index:97;max-height:78vh;border-radius:22px 22px 0 0;border:0;box-shadow:0 -15px 42px rgba(0,0,0,.18);padding:0}
.tyh-filter-head [data-filter-close]{display:block}
.tyh-filter-actions{display:grid;grid-template-columns:1fr 1.45fr;gap:12px;padding:14px;border-top:1px solid var(--ty-line);margin:0}
.tyh-filter-actions button{height:48px;border-radius:13px;font-size:15px}
.tyh-filter-actions button:first-child{background:#fff;color:var(--ty-orange);border:1px solid var(--ty-line)}
.tyh-filter-actions button:last-child{background:var(--ty-blue);color:#fff;border:0}
body.tyh-filter-open:before{content:'';position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:96}
body.tyh-filter-open .tyh-filter{display:flex!important;flex-direction:column;position:fixed;z-index:97}
.tyh-card{display:block;border-radius:16px}
.tyh-img{min-height:168px}
.tyh-info{padding:12px 14px 14px}
.tyh-title-row h2{font-size:16px}
.tyh-book,.tyh-status{padding:0 10px;margin:10px auto}
.tyh-mini{grid-template-columns:104px minmax(0,1fr);gap:12px}
.tyh-mini-img{height:92px}
.tyh-form-grid{grid-template-columns:1fr}
.tyh-bottom{left:0;right:0;margin:4px -10px -28px;border-radius:20px 20px 0 0}
.tyh-bottom button{min-width:0;flex:1}
.tyh-actions{grid-template-columns:1fr}
}
`; }

init();
})();

