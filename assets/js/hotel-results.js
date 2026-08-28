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
  selectedListing:'ty_selected_listing_hotel',
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
  resultsScrollY:0,
  ui:{ calOpen:false, calStep:'start', calOffset:0, cityOpen:false, guestOpen:false, cityQuery:'', cityRows:[], cityStatus:'',
    galleryOpen:false, galleryIndex:0, sheet:null, editSearchOpen:false, fareSheetOpen:false, aboutExpanded:false,
    roomQuery:'', roomFilter:'all', roomGallery:{open:false, optionId:'', index:0},
    hotelOffers:[], hotelOfferIneligible:false, savedGuests:[], savedGuestsLoaded:false, saveGuestToList:false,
    visibleGuestCount:1, savedGuestQuery:'', cancelPolicyOpen:false, termsExpanded:false }
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
  if (Number(err && err.status) === 429 || code === 'RATE_LIMIT' || code === 'TOO_MANY_REQUESTS' || /too many requests|rate.?limit/.test(m)) {
    return 'We’re refreshing hotel availability. Please wait a moment and try again.';
  }
  if (code === 'HOTEL_CITY_AMBIGUOUS') return 'Multiple matching locations were found. Please choose an exact location from the suggestions.';
  if (code === 'HOTEL_CITY_NOT_FOUND' || code === 'HOTEL_CITY_REQUIRED') return 'Please select a valid hotel location from the suggestions and search again.';
  if (code === 'HOTEL_MAPPING_EMPTY') return 'Hotels are not available for this exact location yet. Please choose another nearby location.';
  if (code === 'HOTEL_NO_AVAILABILITY' || code === 'NO_AVAILABILITY') return 'No hotels are available for this location and these dates. Try another nearby location or different dates.';
  if (code === 'HOTEL_REVIEW_CONTEXT_REQUIRED') return 'Please wait for live room rates, then choose the room again.';
  if (code === 'HOTEL_SEARCH_EXPIRED') return 'Your hotel search has expired. Hotel prices and availability may have changed. Please search again to see the latest available rooms and prices.';
  if (code === 'HOTEL_SEARCH_CONTEXT_REQUIRED') return 'Your hotel search has expired. Hotel prices and availability may have changed. Please search again to see the latest available rooms and prices.';
  if (code === 'HOTEL_OPTION_UNAVAILABLE' || code === 'OPTION_NOT_AVAILABLE' || code === 'HOTEL_SOLD_OUT' || code === 'ROOM_SOLD_OUT') return 'The selected room is no longer available. Please choose another room or search again.';
  if (code === 'HOTEL_CITY_CATALOG_EMPTY') return 'We couldn’t load hotels right now. Please try again.';
  if (code === 'TRIPJACK_TIMEOUT') return 'Hotel search timed out. Please try again.';
  if (code === 'TRIPJACK_NETWORK_ERROR') return 'Unable to reach hotel availability right now. Please try again.';
  if (Number(err && err.status) === 403 || code === 'TRIPJACK_API_ERROR' && /403|forbidden|not allowed|access/i.test(String((err && err.message) || ''))) {
    return 'Hotel price validation was declined. Please choose another room or search again.';
  }
  if (m.includes('city id') || m.includes('hotel city')) return 'Please select a valid hotel location from the suggestions and search again.';
  if (/failed to fetch|networkerror|load failed|network request failed/.test(m)) {
    return 'Network error while loading hotels. Please check your connection and try again.';
  }
  if (/too many requests|rate.?limit/.test(m)) return 'We’re refreshing hotel availability. Please wait a moment and try again.';
  if (/expired|stale|session/.test(m) && /search|rate|hotel|avail/.test(m)) {
    return 'Your hotel search has expired. Hotel prices and availability may have changed. Please search again to see the latest available rooms and prices.';
  }
  if (/tripjack|supplier|provider|\/api\/|endpoint|regionid|\btoken\b|\bapi key\b|razorpay|backend/.test(m)) return 'We couldn’t load hotels right now. Please try again.';
  if (Number(err && err.status) >= 500) return 'We couldn’t load hotels right now. Please try again.';
  return (err && err.message) || 'We couldn’t load hotels right now. Please try again.';
}
function isHotelRateLimitErr(err){
  if(!err) return false;
  const code=String((err.data&&err.data.code)||err.code||'').toUpperCase();
  const m=String(err.message||'').toLowerCase();
  return Number(err.status)===429 || code==='RATE_LIMIT' || code==='TOO_MANY_REQUESTS' || /too many requests|rate.?limit/.test(m);
}
function isHotelExpiredSearchErr(err){
  if(!err) return false;
  const code=String((err.data&&err.data.code)||err.code||'').toUpperCase();
  const m=String(err.message||'').toLowerCase();
  if(code==='HOTEL_SEARCH_EXPIRED' || code==='HOTEL_SEARCH_CONTEXT_REQUIRED') return true;
  return /expired|stale/.test(m) && /search|session|rate|avail|context/.test(m);
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
  const out = Object.assign({}, live, { service:'hotel', type:'hotel' });
  out.nationality=String(out.nationality||'IN').toUpperCase()||'IN';
  out.countryOfResidence=String(out.countryOfResidence||out.residenceCountry||'IN').toUpperCase()||'IN';
  out.residenceCountry=out.countryOfResidence;
  return out;
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
  if(typeof v==='string'){
    const s=String(v).trim();
    if(/^https?:\/\//i.test(s)) return s;
    if(/^\/\//.test(s)) return 'https:'+s;
    return '';
  }
  const links=v.links||{};
  const href=(links.Standard&&(links.Standard.href||links.Standard.url))||(links.XXL&&(links.XXL.href||links.XXL.url))||(links.original&&(links.original.href||links.original.url))||v.url||v.imageUrl||v.src||v.href||'';
  return mediaUrl(String(href||''));
}
function imageOf(h){ const raw=h.raw||h; const imgs=[h.image,h.imageUrl,h.heroImage,h.thumbnail,mediaUrl(h.images&&h.images[0]),mediaUrl(h.imgs&&h.imgs[0]),mediaUrl(raw.heroImage),mediaUrl(raw.images&&raw.images[0]),mediaUrl(raw.img&&raw.img[0])].filter(Boolean); return String(imgs[0]||''); }
function firstPositiveAmount(){
  for(let i=0;i<arguments.length;i++){
    const n=Number(arguments[i]);
    if(Number.isFinite(n)&&n>0) return n;
  }
  return 0;
}
function optionHasCustomerDisplayAmount(o){
  o=o||{};
  const pb=o.pricingBreakup||o.priceBreakup||o.priceBreakdown||{};
  const raw=o.raw||{};
  return firstPositiveAmount(
    o.resultDisplayAmount, o.displayPrice, o.finalPrice, o.finalPayableAmount,
    pb.resultDisplayAmount, pb.displayPrice, pb.sellAmount, pb.customerAmount, pb.customerPrice, pb.finalAmount, pb.finalPayableAmount,
    raw.resultDisplayAmount, raw.displayPrice, raw.finalPrice, raw.finalPayableAmount
  )>0;
}
function optionSupplierTotalAmount(o){
  o=o||{};
  const raw=o.raw||{};
  const display=firstPositiveAmount(
    o.resultDisplayAmount, o.displayPrice, o.finalPrice,
    raw.resultDisplayAmount, raw.displayPrice
  );
  const candidates=[
    o.supplierTotalPrice,
    // Bare totalPrice is supplier only when a higher display/sell amount also exists on the same payload.
    (display>0 ? firstPositiveAmount(raw.totalPrice, o.totalPrice, raw.tp, o.tp) : 0),
    (!display ? firstPositiveAmount(raw.totalPrice, o.totalPrice, raw.tp, o.tp) : 0)
  ];
  for(let i=0;i<candidates.length;i++){
    const n=Number(candidates[i]||0);
    if(!(n>0)) continue;
    // Ignore values that are clearly the customer sell (equal/near display).
    if(display>0 && Math.abs(n-display)<1) continue;
    if(display>0 && n>display+0.5) continue;
    return n;
  }
  return 0;
}
function customerStayPrice(o,h){
  // Prefer customer sell/display amounts (markup already included). Priority order — never max-of-all
  // (max-of-all mixed net/sell fields and caused false price-change + Guest/payment drift).
  // IMPORTANT: do NOT treat bare totalPrice as customer sell when display/sell fields exist on search/detail.
  // Review often returns only totalPrice (pre-markup). That must not be misread as a price drop.
  const pb=(o&&(o.pricingBreakup||o.priceBreakup||o.priceBreakdown))||{};
  const raw=(o&&o.raw)||{};
  const tfcs=(o&&o.tfcs)||raw.tfcs||{};
  const preferred=firstPositiveAmount(
    o&&o.resultDisplayAmount, o&&o.displayPrice,
    pb.resultDisplayAmount, pb.displayPrice, pb.sellAmount, pb.customerAmount, pb.customerPrice, pb.finalAmount, pb.finalPayableAmount,
    o&&o.finalPrice, o&&o.finalPayableAmount, o&&o.totalAmount,
    raw.resultDisplayAmount, raw.displayPrice, raw.finalPrice, raw.finalPayableAmount,
    // totalPrice / tp / TF only when they are the sole available customer amount on this object
    (!optionHasCustomerDisplayAmount(o)?(o&&o.totalPrice):0),
    o&&o.tp, raw.tp, tfcs.TF, tfcs.tf, o&&o.amount, o&&o.price, tfcs.NP
  );
  if(preferred>0) return preferred;
  if(o&&(o.optionId||o.id||o.pricing||o.cancellation||o.roomInfo||o.roomSummary)) return 0;
  return firstPositiveAmount(h&&h.resultDisplayAmount, h&&h.displayPrice, h&&h.price);
}
function priceOf(o,h){ return customerStayPrice(o,h); }
function resolveReviewedCustomerSell(reviewedOption, selectedBefore, hotelCtx, currentAuthAmount){
  // Map review payloads that omit resultDisplayAmount back onto the customer sell scale.
  // Search/Detail: resultDisplayAmount ≈ supplier totalPrice × markup (e.g. 2000 → 2160).
  // Review: often only totalPrice (2000). Comparing those directly caused fake ₹2161→₹2001 popups.
  const currentAuth=hotelMoneyRound(Math.max(0, Number(currentAuthAmount||0)||priceOf(selectedBefore, hotelCtx)));
  const reviewDisplay=firstPositiveAmount(
    reviewedOption&&reviewedOption.resultDisplayAmount, reviewedOption&&reviewedOption.displayPrice,
    reviewedOption&&reviewedOption.finalPrice, reviewedOption&&reviewedOption.finalPayableAmount,
    reviewedOption&&reviewedOption.pricingBreakup&&reviewedOption.pricingBreakup.sellAmount,
    reviewedOption&&reviewedOption.raw&&reviewedOption.raw.resultDisplayAmount,
    reviewedOption&&reviewedOption.raw&&reviewedOption.raw.displayPrice
  );
  if(reviewDisplay>0) return hotelMoneyRound(reviewDisplay);

  const reviewSupplier=optionSupplierTotalAmount(reviewedOption)||(!optionHasCustomerDisplayAmount(reviewedOption)?firstPositiveAmount(reviewedOption&&reviewedOption.totalPrice):0);
  const beforeSupplier=optionSupplierTotalAmount(selectedBefore);
  const beforeSell=hotelMoneyRound(firstPositiveAmount(priceOf(selectedBefore, hotelCtx), currentAuth));

  // Review omitted customer display fields.
  if(reviewSupplier>0){
    if(beforeSupplier>0 && beforeSell>0 && beforeSupplier < beforeSell-0.5){
      // Reliable markup ratio from detail selection.
      if(Math.abs(reviewSupplier-beforeSupplier)<1) return beforeSell;
      return hotelMoneyRound(reviewSupplier*(beforeSell/beforeSupplier));
    }
    // No reliable supplier/display split left on the selected option.
    // Never treat a lower bare totalPrice as a customer price drop vs accepted display sell.
    if(currentAuth>0 && reviewSupplier<=currentAuth+0.5) return currentAuth;
    // Bare review total higher than accepted sell → genuine increase on the only available field.
    if(currentAuth>0 && reviewSupplier>currentAuth+0.5) return hotelMoneyRound(reviewSupplier);
  }
  const fallback=hotelMoneyRound(priceOf(reviewedOption, hotelCtx)||currentAuth);
  return fallback>0?fallback:currentAuth;
}
function tyhAssertPriceChain(label, parts){
  try{
    if(!(typeof location!=='undefined' && /[?&]tyhDebug=1(?:&|$)/.test(location.search))) return;
    const d=draft()||{};
    const o=d.option||option();
    const h=d.hotel||hotel();
    const sell=Number((parts&&parts.sell)!=null?parts.sell:hotelSellAmount());
    const total=Number((parts&&parts.total)!=null?parts.total:0);
    const auth=Number(d.authoritativeSellAmount||d.resultsSellAmount||0);
    const mk=hotelMarkupInfo(o,h);
    // Console-only — never rendered in customer UI.
    console.info('[tyh-price]', label, {resultsSell:auth, guestSell:sell, guestTotal:total, supplierNet:mk.net, markup:mk.markup, markupPct:mk.markupPct, match:auth>0?Math.round(auth)===Math.round(total)||Math.round(auth)===Math.round(sell):null});
  }catch(e){}
}
function hotelSupplierNetAmount(o,h){
  o=o||{}; h=h||{};
  const pb=(o.pricingBreakup||o.priceBreakup||o.priceBreakdown)||{};
  const raw=(o.raw||{});
  const explicit=Number(pb.netAmount||pb.supplierAmount||pb.supplierNet||pb.netPrice||raw.netAmount||raw.supplierAmount||0);
  if(explicit>0) return explicit;
  const base=Number(o.baseFare||pb.baseFare||pb.basePrice||raw.baseFare||0);
  const taxes=Number(o.taxes||pb.taxes||pb.tax||raw.taxes||0);
  const mf=Number(o.managementFee||0)+Number(o.managementFeeTax||0);
  if(base>0) return base+taxes+mf;
  return 0;
}
function hotelMarkupInfo(o,h){
  const sell=customerStayPrice(o,h);
  const net=hotelSupplierNetAmount(o,h);
  const markup=sell>0&&net>0 ? hotelMoneyRound(Math.max(0, sell-net)) : 0;
  const markupPct=net>0&&markup>0 ? Math.round((markup/net)*10000)/100 : 0;
  return {sell:sell, net:net, markup:markup, markupPct:markupPct};
}
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
function cancelSummaryText(o){
  const c=o&&o.cancellation||cancellationOf(o||{});
  if(c.freeCancellation) return 'Free cancellation'+(c.freeCancellationUntil?' until '+fmtDate(c.freeCancellationUntil):'');
  if(c.refundable===false) return 'Non-refundable';
  if(c.refundable) return 'Refundable (charges may apply)';
  return '';
}
function hotelAddressParts(h){
  h=h||{};
  const raw=rawOf(h);
  const ad=(typeof h.address==='object'&&h.address)||raw.ad||raw.address||{};
  const street=firstText(
    typeof h.address==='string'?h.address:'',
    ad.adr, ad.addressLine1, ad.line1, ad.street, ad.address1,
    deepFind(raw,['adr','addressLine1','street'])
  );
  const locality=firstText(h.locality,h.area,h.place,ad.locality,ad.area,ad.ln);
  const city=firstText(h.city,h.cityName,ad.ctn,ad.city&&ad.city.name,ad.city,raw.ctn);
  const state=firstText(h.state,h.stateName,h.province,ad.sn,ad.state&&ad.state.name,ad.state);
  const country=firstText(h.country,h.countryName,ad.cn,ad.country&&ad.country.name,ad.country,raw.cnt);
  const postal=firstText(h.postalCode,h.postal,ad.postalCode,ad.postal,ad.zip);
  return {street:street,locality:locality,city:city,state:state,country:country,postal:postal};
}
function hotelAddressText(h){
  const p=hotelAddressParts(h);
  const bits=[];
  [p.street,p.locality,p.city,p.state,p.country,p.postal].forEach(function(x){
    const s=String(x||'').trim();
    if(!s) return;
    const lower=s.toLowerCase();
    if(bits.some(function(b){ return b.toLowerCase()===lower; })) return;
    const joined=bits.join(', ').toLowerCase();
    if(joined && (joined.indexOf(lower)>=0 || lower.split(/[\s,]+/).filter(Boolean).every(function(tok){ return tok.length<2 || joined.indexOf(tok)>=0; }))) return;
    bits.push(s);
  });
  return bits.join(', ');
}
function looksLikeClockTime(v){
  const s=String(v||'').trim();
  if(!s) return false;
  if(/^\d{1,2}:\d{2}(\s*[AaPp][Mm])?$/.test(s)) return true;
  if(/^\d{1,2}\s*[AaPp][Mm]$/.test(s)) return true;
  if(/\b(check[\s-]?in|check[\s-]?out)\b/i.test(s) && /\d/.test(s)) return true;
  return false;
}
function hotelCheckTimes(h){
  h=h||{};
  const raw=rawOf(h);
  const content=raw.content||raw.hotelContent||{};
  const hInfo=raw.hInfo||raw.hotel||{};
  const policies=h.policies||raw.policies||content.policies||{};
  const rawCio=(policies.raw&&policies.raw.checkInCheckOut)||(content.policies&&content.policies.raw&&content.policies.raw.checkInCheckOut)||(raw.content&&raw.content.raw&&raw.content.raw.policies&&raw.content.raw.policies.checkInCheckOut)||{};
  const pickTime=function(){
    for(let i=0;i<arguments.length;i++){
      const v=arguments[i];
      if(v===undefined||v===null) continue;
      const s=String(v).trim();
      if(!s) continue;
      if(/^anytime$/i.test(s)) continue;
      if(looksLikeClockTime(s) || /[AaPp][Mm]|\d{1,2}:\d{2}/.test(s)) return s;
    }
    return '';
  };
  // Prefer real API/content policy times (checkInFrom / checkOutFrom / checkin_from / checkout_from).
  const checkIn=pickTime(
    h.checkInTime, h.checkinTime, h.ciTime, h.checkInFrom,
    raw.checkInTime, raw.checkinTime, raw.ciTime, raw.cit, raw.checkInFrom,
    content.checkInTime, content.checkinTime, content.ciTime, content.cit, content.checkInFrom,
    hInfo.checkInTime, hInfo.checkinTime, hInfo.ciTime, hInfo.cit, hInfo.checkInFrom,
    policies.checkInTime, policies.checkinTime, policies.checkInFrom, policies.checkin_from,
    rawCio.checkin_from, rawCio.checkInFrom, rawCio.checkinFrom,
    deepFind({content:content,hInfo:hInfo,policies:policies,rawCio:rawCio},['checkInTime','checkinTime','ciTime','cit','check_in_time','checkInFrom','checkin_from'])
  );
  const checkOut=pickTime(
    h.checkOutTime, h.checkoutTime, h.coTime, h.checkOutTill, h.checkOutFrom,
    raw.checkOutTime, raw.checkoutTime, raw.coTime, raw.cot, raw.checkOutFrom, raw.checkOutTill,
    content.checkOutTime, content.checkoutTime, content.coTime, content.cot, content.checkOutFrom, content.checkOutTill,
    hInfo.checkOutTime, hInfo.checkoutTime, hInfo.coTime, hInfo.cot, hInfo.checkOutFrom,
    policies.checkOutTime, policies.checkoutTime, policies.checkOutFrom, policies.checkOutTill, policies.checkout_from,
    rawCio.checkout_from, rawCio.checkOutFrom, rawCio.checkoutFrom,
    deepFind({content:content,hInfo:hInfo,policies:policies,rawCio:rawCio},['checkOutTime','checkoutTime','coTime','cot','check_out_time','checkOutFrom','checkout_from','checkOutTill'])
  );
  return {checkIn:checkIn||'', checkOut:checkOut||''};
}
function countryCodeOptionsHtml(selected, query){
  const sel=String(selected||'+91').trim()||'+91';
  const q=lower(String(query||'').trim());
  const list=arr(window.TY_COUNTRY_CODES);
  const fallback=[['IN','India','+91'],['JP','Japan','+81'],['US','USA/Canada','+1'],['GB','United Kingdom','+44'],['AE','UAE','+971']];
  const rows=list.length?list:fallback;
  const filtered=rows.filter(function(row){
    if(!q) return true;
    const code=String(row[2]||'').trim();
    const name=String(row[1]||'').trim();
    const iso=String(row[0]||'').trim();
    return lower(name+' '+code+' '+iso).indexOf(q)>=0;
  });
  const use=filtered.length?filtered:rows.filter(function(row){ return String(row[2]||'').trim()===sel; });
  return (use.length?use:rows.slice(0,1)).map(function(row){
    const code=String(row[2]||'').trim();
    const name=String(row[1]||'').trim();
    if(!code) return '';
    const label=(name?name+' ':'')+code;
    return '<option value="'+attr(code)+'"'+(code===sel?' selected':'')+'>'+esc(label)+'</option>';
  }).filter(Boolean).join('');
}
function countryIsoRows(){
  return arr(window.TY_COUNTRY_CODES).filter(function(row){ return row && row[0] && row[1]; });
}
function countryIsoOptionsHtml(selected, query){
  const sel=String(selected||'IN').trim().toUpperCase()||'IN';
  const q=lower(query||'');
  let rows=countryIsoRows();
  if(q){
    rows=rows.filter(function(row){
      return lower(String(row[0]||'')+' '+String(row[1]||'')).indexOf(q)>=0;
    });
  }
  if(!rows.length) rows=countryIsoRows().filter(function(row){ return String(row[0]||'').toUpperCase()===sel; });
  if(!rows.length) rows=[['IN','India','+91']];
  return rows.map(function(row){
    const iso=String(row[0]||'').toUpperCase();
    const name=String(row[1]||'');
    return '<option value="'+attr(iso)+'"'+(iso===sel?' selected':'')+'>'+esc(name+' ('+iso+')')+'</option>';
  }).join('');
}
function countryNameFromIso(iso){
  const want=String(iso||'').toUpperCase();
  const hit=countryIsoRows().find(function(row){ return String(row[0]||'').toUpperCase()===want; });
  return hit?String(hit[1]||want):want;
}
function searchNationality(){
  const s=S.search||searchPayload()||{};
  return String(s.nationality||'IN').toUpperCase()||'IN';
}
function searchResidenceCountry(){
  const s=S.search||searchPayload()||{};
  return String(s.countryOfResidence||s.residenceCountry||'IN').toUpperCase()||'IN';
}
function nationalityResidenceFieldsHtml(compact){
  const nat=searchNationality();
  const res=searchResidenceCountry();
  const cls=compact?'tyh-nat-grid compact':'tyh-nat-grid';
  return '<div class="'+cls+'">'
    +'<label>Nationality<select data-search-nationality>'+countryIsoOptionsHtml(nat)+'</select></label>'
    +'<label>Country of Residence<select data-search-residence>'+countryIsoOptionsHtml(res)+'</select></label>'
  +'</div>';
}
function roomImagesOf(o, hotel){
  const out=[];
  const push=function(u){
    const s=mediaUrl(u)||String(u||'').trim();
    if(s&&/^https?:\/\//i.test(s)&&out.indexOf(s)<0) out.push(s);
  };
  const walk=function(node, depth){
    if(depth>5||node==null) return;
    if(typeof node==='string'){ push(node); return; }
    if(Array.isArray(node)){ node.forEach(function(x){ walk(x, depth+1); }); return; }
    if(typeof node!=='object') return;
    push(node.url||node.src||node.imageUrl||node.image||node.hi||node.tns||node.sz||node.lurl||node.burl);
    ['images','imgs','photos','gallery','media','tp','typedPhotos','roomImages','imageList'].forEach(function(k){ if(node[k]) walk(node[k], depth+1); });
  };
  const rooms=arr(o&&o.rooms).concat(arr(o&&o.roomInfo), arr(o&&o.ris));
  rooms.forEach(function(r){
    if(!r) return;
    walk(r.images||r.imgs||r.photos||r.media||r.tp,0);
    walk(r.raw&&(r.raw.images||r.raw.imgs||r.raw.photos||r.raw.tp),0);
    push(r.image||r.imageUrl||r.heroImage);
    push(r.raw&&(r.raw.image||r.raw.imageUrl));
  });
  walk(o&&o.raw&&(o.raw.images||o.raw.imgs||o.raw.photos||o.raw.tp),0);
  push(o&&o.raw&&(o.raw.image||o.raw.heroImage));
  if(out.length) return out;
  // Match property content rooms by name/category when option-level images are absent.
  const want=lower(o&&(o.roomSummary||o.roomType||''));
  if(want){
    const raw=rawOf(hotel||{});
    const contentRooms=arr(raw.contentRooms).concat(arr(raw.rooms), arr(raw.content&&raw.content.rooms), arr(hotel&&hotel.contentRooms), arr(raw.hInfo&&raw.hInfo.rooms));
    contentRooms.forEach(function(r){
      if(!r||typeof r!=='object') return;
      const nm=lower(r.name||r.roomName||r.roomType||r.roomCategory||r.rt||r.rc||r.title||'');
      if(!nm) return;
      const matched=nm===want||nm.indexOf(want)>=0||want.indexOf(nm)>=0||want.split(/\s+/).filter(function(w){return w.length>3;}).some(function(w){ return nm.indexOf(w)>=0; });
      if(!matched) return;
      walk(r.images||r.imgs||r.photos||r.media||r.tp,0);
      push(r.image||r.imageUrl||r.heroImage);
    });
  }
  if(out.length) return out;
  // Same-hotel content room interiors (bedroom/room entities only — never hotel hero/exterior).
  {
    const raw=rawOf(hotel||{});
    const contentRooms=arr(raw.contentRooms).concat(arr(raw.rooms), arr(raw.content&&raw.content.rooms), arr(hotel&&hotel.contentRooms), arr(raw.hInfo&&raw.hInfo.rooms));
    contentRooms.forEach(function(r){
      if(!r||typeof r!=='object') return;
      const nm=lower(r.name||r.roomName||r.roomType||r.roomCategory||r.rt||r.rc||r.title||'room');
      if(/exterior|facade|façade|front elevation|building front|reception|lobby|restaurant|pool exterior/i.test(nm)) return;
      walk(r.images||r.imgs||r.photos||r.media||r.tp,0);
      push(r.image||r.imageUrl||r.heroImage);
    });
  }
  if(out.length) return out;
  // No valid room/interior image from API — do NOT fall back to hotel exterior/hero.
  return out;
}
function roomImageIsHotelFallback(o, hotel){
  // Legacy helper: hotel-exterior fallback is no longer used for room media.
  return false;
}
function customerSafeNote(text){
  let s=String(text==null?'':text);
  if(!s) return '';
  s=s.replace(/\bTJ\s*Cash\b/gi,'wallet credits');
  s=s.replace(/\bTrip\s*Jack\b/gi,'the property');
  s=s.replace(/\bTripjack\b/gi,'the property');
  s=s.replace(/\bTripJack\b/g,'the property');
  s=s.replace(/\bTRIPJACK\b/g,'the property');
  return s;
}
function cancellationTableHtml(o){
  const c=cancellationOf(o||{});
  const pd=arr(c.penalties);
  if(!pd.length) return '';
  const rows=pd.map(function(x){
    const from=x.fromDate||x.fdt||x.from||'';
    const to=x.toDate||x.tdt||x.to||'';
    const amount=x.amount!=null?money(x.amount):(x.am!=null?money(x.am):'');
    const pct=x.percent!=null?String(x.percent)+'%':(x.pp!=null?String(x.pp)+'%':'');
    const charge=[amount,pct].filter(Boolean).join(' / ')||'As per policy';
    return '<tr><td>'+esc(from?fmtDate(from):'—')+'</td><td>'+esc(to?fmtDate(to):'—')+'</td><td>'+esc(charge)+'</td></tr>';
  }).join('');
  return '<div class="tyh-cancel-table-wrap"><table class="tyh-cancel-table"><thead><tr><th>Cancellation on or after</th><th>on or before</th><th>Charges</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function surchargeFeesHtml(rawOrReview){
  const rootObj=rawOrReview&&typeof rawOrReview==='object'?rawOrReview:{};
  const candidates=[].concat(
    arr(rootObj.mandatoryFees), arr(rootObj.excludedFees), arr(rootObj.surcharges),
    arr(rootObj.fees), arr(rootObj.hotelFees),
    arr(rootObj.hInfo&&rootObj.hInfo.mandatoryFees),
    arr(rootObj.hInfo&&rootObj.hInfo.excludedFees),
    arr(rootObj.hotel&&rootObj.hotel.mandatoryFees),
    arr(rootObj.review&&rootObj.review.mandatoryFees)
  );
  const lines=[];
  candidates.forEach(function(f){
    if(f==null) return;
    if(typeof f==='string'){
      const t=customerSafeNote(f).trim();
      if(t) lines.push(t);
      return;
    }
    if(typeof f!=='object') return;
    const label=customerSafeNote(firstText(f.name,f.label,f.description,f.type,f.msg,f.text));
    const amt=f.amount!=null?money(f.amount):(f.am!=null?money(f.am):(f.price!=null?money(f.price):''));
    const line=[label,amt].filter(Boolean).join(' — ');
    if(line) lines.push(line);
  });
  if(!lines.length) return '';
  return '<section class="tyh-panel tyh-surcharge"><h2>Mandatory / excluded fees</h2>'+
    lines.map(function(t){ return '<p class="tyh-desc">'+esc(t)+'</p>'; }).join('')+
  '</section>';
}
function hotelPricingBreakup(o,h){
  o=o||{}; h=h||{};
  const rawO=o.raw||{};
  const rawH=(h&&h.raw)||{};
  return o.pricingBreakup||o.priceBreakup||o.priceBreakdown
    || rawO.pricingBreakup||rawO.priceBreakup
    || (h&&(h.pricingBreakup||h.priceBreakup))
    || rawH.pricingBreakup||rawH.priceBreakup
    || {};
}
function hotelTicketSellAmount(o,h){
  // Markup-inclusive customer ticket / Base Fare basis (resultDisplayAmount). Never supplier-only totalPrice.
  return hotelMoneyRound(hotelRawTicketAmount(o,h));
}
function hotelSellAmount(o,h){ return hotelTicketSellAmount(o,h); }
function hotelRawTicketAmount(o,h){
  // Unrounded ticket for canonical payable = round(ticket + fee) once.
  const d=draft()||{};
  o=o||option(); h=h||hotel();
  const locked=Math.max(0, Number(d.authoritativeSellAmount||0));
  if(locked>0) return locked;
  const resultsFloor=Math.max(0, Number(d.resultsSellAmount||0));
  const pb=hotelPricingBreakup(o,h);
  const live=Math.max(0, Number(
    priceOf(o,h)
    || firstPositiveAmount(pb.ticketAmount, pb.resultDisplayAmount, pb.displayPrice, o.resultDisplayAmount, o.displayPrice, h&&h.resultDisplayAmount, h&&h.displayPrice, h&&h.price)
    || 0
  ));
  return Math.max(resultsFloor, live);
}
function hotelRawFeeAmount(o,h){
  // Unrounded API convenience fee (no invented %).
  o=o||option(); h=h||hotel();
  const pb=hotelPricingBreakup(o,h);
  const fromOpt=firstPositiveAmount(
    pb.convenienceFee, pb.convenienceFeeBeforeOffer,
    o.convenienceFee, o.serviceFee, o.travelYaraaServiceFee,
    h&&h.convenienceFee,
    o.raw&&o.raw.convenienceFee, h&&h.raw&&h.raw.convenienceFee
  );
  if(fromOpt>0) return Number(fromOpt);
  const d=draft()||{};
  return Number(firstPositiveAmount(d.travelYaraaServiceFee, d.serviceFee, d.convenienceFee)||0);
}
function hotelApiConvenienceFee(o,h){
  const raw=hotelRawFeeAmount(o,h);
  if(raw>0) return hotelMoneyRound(raw);
  return 0;
}
function hotelServiceFeeAmount(o,h){
  // Real backend convenience/service fee only — never invent a percentage.
  const apiFee=hotelApiConvenienceFee(o,h);
  if(apiFee>0) return apiFee;
  const d=draft()||{};
  const stored=hotelMoneyRound(Number(d.travelYaraaServiceFee||d.serviceFee||d.convenienceFee||0));
  return stored>0?stored:0;
}
function hotelCustomerPayableAmount(o,h){
  // Guest/Payment TOTAL only (Base + Taxes & Fees). Never use for Results/Room card display.
  // Prefer explicit API pricingBreakup.customerPayable; else locked draft payable; else round(ticket+fee) once.
  o=o||option(); h=h||hotel();
  const d=draft()||{};
  const lockedPay=hotelMoneyRound(Number(d.resultsPayableAmount||0));
  const pb=hotelPricingBreakup(o,h);
  const rawPb=(o&&o.raw&&(o.raw.pricingBreakup||o.raw.priceBreakup))||{};
  const hPb=(h&&(h.pricingBreakup||h.priceBreakup))||{};
  const apiPayable=firstPositiveAmount(pb.customerPayable, rawPb.customerPayable, hPb.customerPayable);
  if(apiPayable>0) return hotelMoneyRound(apiPayable);
  if(lockedPay>0) return lockedPay;
  return hotelMoneyRound(Number(hotelRawTicketAmount(o,h)||0) + Number(hotelRawFeeAmount(o,h)||0));
}
function hotelBaseFareAmount(o,h){
  // Results + Room Selection customer Base Fare (supplier/API + backend markup). Never includes convenience fee.
  return hotelTicketSellAmount(o,h);
}
function hotelMoneyRound(n){ return Math.round(Number(n||0)); }
function hotelFareParts(d){
  d=d||draft();
  const o=d.option||option();
  const h=d.hotel||hotel();
  // Base Fare = markup-inclusive customer ticket (resultDisplayAmount / ticketAmount). Never supplier-only totalPrice.
  const sell=hotelTicketSellAmount(o,h);
  let serviceFee=hotelServiceFeeAmount(o,h);
  const applied=d.appliedOffer||null;
  const feeWaived=!!(applied&&(applied.convenienceFeeWaived||applied.discountType==='convenience_fee_waiver'));
  if(feeWaived) serviceFee=0;
  const discount=hotelMoneyRound(applied?Math.max(0,Number(applied.discountAmount||d.discountAmount||0)):Math.max(0,Number(d.discountAmount||0)));
  // Taxes & Fees = real backend convenience/service fee only (already configured server-side).
  const roomBase=hotelMoneyRound(Math.max(0, sell));
  // Guest/Payment Total = API customerPayable (or round(ticket+fee) once). Results/Room do NOT show this total.
  const canonicalPayable=hotelCustomerPayableAmount(o,h);
  let total;
  if(applied && Number(applied.finalPayableAmount)>0) total=hotelMoneyRound(applied.finalPayableAmount);
  else if(discount>0) total=hotelMoneyRound(Math.max(0, (canonicalPayable>0?canonicalPayable:(roomBase+serviceFee)) - discount));
  else total=canonicalPayable>0?canonicalPayable:hotelMoneyRound(Math.max(0, Number(hotelRawTicketAmount(o,h)||0) + Number(hotelRawFeeAmount(o,h)||0)));
  // Exact identity on the receipt: Base + Fees − Discount = Total (reconcile ₹1 rounding drift into Fees).
  let taxesFees;
  if(feeWaived){
    taxesFees=0;
    if(!(applied && Number(applied.finalPayableAmount)>0)) total=hotelMoneyRound(Math.max(0, roomBase - discount));
  }else{
    taxesFees=hotelMoneyRound(Math.max(0, total - roomBase + discount));
    serviceFee=taxesFees;
  }
  const parts={
    roomBase:roomBase,
    taxesFees:taxesFees,
    supplierTaxesFees:0,
    serviceFee:serviceFee,
    feeWaived:feeWaived,
    sell:hotelMoneyRound(sell),
    discount:discount,
    total:total,
    occupancy:occupancySummaryText(d)
  };
  tyhAssertPriceChain('hotelFareParts', parts);
  return parts;
}
function syncHotelPayableDraft(extra){
  const parts=hotelFareParts();
  const patch=Object.assign({
    baseBookingAmount:parts.sell,
    travelYaraaServiceFee:parts.serviceFee,
    serviceFee:parts.serviceFee,
    finalPayableAmount:parts.total
  }, extra||{});
  return setDraft(patch);
}
function fareSummaryBlockHtml(opts){
  opts=opts||{};
  const base=Number(opts.base||0);
  const taxesFees=Number(opts.taxesFees!=null?opts.taxesFees:(Number(opts.taxes||0)+Number(opts.fees||0)+Number(opts.serviceFee||0)));
  const discount=Math.max(0, Number(opts.discount||0));
  const total=Number(opts.total||0);
  const stickyClass=opts.stickyClass?(' '+String(opts.stickyClass)):'';
  return '<aside class="tyh-fare-summary'+stickyClass+'">'+
    '<div class="tyh-fare-head"><h2>Fare summary</h2></div>'+
    '<div class="tyh-kv"><span>Base Fare</span><b>'+money(base)+'</b></div>'+
    '<div class="tyh-kv"><span>Taxes &amp; Fees</span><b>'+money(taxesFees)+'</b></div>'+
    (discount>0?'<div class="tyh-kv tyh-discount-row"><span>Offer discount</span><b>-'+money(discount)+'</b></div>':'')+
    '<div class="tyh-kv total"><span>Total Amount</span><b>'+money(total)+'</b></div>'+
  '</aside>';
}
function hotelSideRailHtml(opts){
  opts=opts||{};
  const fare=fareSummaryBlockHtml(opts);
  const offers=opts.offersHtml||'';
  const cta=opts.ctaAttr
    ? ('<button type="button" class="tyh-cta tyh-side-cta'+(opts.ctaDisabled?' tyh-cta-soft-disabled':'')+'" '+opts.ctaAttr+' aria-disabled="'+(opts.ctaDisabled?'true':'false')+'">'+esc(opts.ctaLabel||'Continue')+'</button>')
    : '';
  return '<div class="tyh-side-rail'+(opts.stickyClass?' '+String(opts.stickyClass).trim():'')+'">'+fare+offers+cta+'</div>';
}
function occupancySummaryText(d){
  d=d||draft();
  const s=d.searchPayload||S.search||{};
  const rooms=Math.max(1, Number(s.roomCount||arr(s.rooms).length||1));
  const guests=arr(d.guests).length||Number(s.adults||0)+Number(s.children||0)||1;
  return rooms+' room'+(rooms===1?'':'s')+' · '+guests+' guest'+(guests===1?'':'s');
}
function hotelBookingNotesHtml(h,o,raw){
  h=h||{}; o=o||{}; raw=raw||{};
  const notes=[];
  function push(t){
    t=customerSafeNote(firstText(t));
    if(!t) return;
    if(/tripjack|tj\s*cash|razorpay|supplier|backend|api\b|supplied/i.test(t)) return;
    if(notes.indexOf(t)>=0) return;
    notes.push(t);
  }
  arr(o.bookingNotes).concat(
    arr(raw.bookingNotes), arr(raw.instructions), arr(raw.hInfo&&raw.hInfo.inst), arr(h.raw&&h.raw.inst),
    tyhExtractKnowBeforeNotes(o.raw&&o.raw.inclusions),
    tyhExtractKnowBeforeNotes(raw.option&&raw.option.inclusions),
    tyhExtractKnowBeforeNotes(raw.hInfo)
  ).forEach(function(x){
    push(x&&x.msg||x&&x.description||x&&x.text||x);
  });
  const sur=surchargeFeesHtml(raw);
  // Only render when real notes/fees exist — never show empty "supplied" placeholder copy.
  if(!notes.length && !sur) return '';
  return '<div class="tyh-booking-notes">'
    +(notes.length?'<ul>'+notes.slice(0,8).map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('')+'</ul>':'')
    +(sur||'')
  +'</div>';
}
function generalTermsPreviewHtml(expanded){
  // TravelYaraa customer guidance only — not property-specific Hotel Rules.
  const lines=[
    'Carry valid government-issued identification required for check-in.',
    'Ensure guest names match the identification used at the property.',
    'Check-in/out requirements and deposits may vary by hotel.',
    'Extra beds, meals and special requests are subject to confirmation and may be charged by the property.',
    'Local taxes or property charges not included in the booking price may be payable directly where applicable.',
    'Contact TravelYaraa support if your confirmed booking information differs from what the property receives.'
  ];
  const show=expanded?lines:lines.slice(0,3);
  return '<div class="tyh-general-terms">'
    +'<ul>'+show.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('')+'</ul>'
    +'<button type="button" class="tyh-linkish" data-toggle-terms>'+(expanded?'Show less':'Show more')+'</button>'
  +'</div>';
}
function tyhExtractKnowBeforeNotes(node, out, depth){
  out=out||[]; depth=depth||0;
  if(depth>6||node==null) return out;
  if(typeof node==='string'){
    const s=node.trim();
    if(!s) return out;
    if(s.charAt(0)==='{'||s.charAt(0)==='['){
      try{ return tyhExtractKnowBeforeNotes(JSON.parse(s), out, depth+1); }catch(e){}
      return out;
    }
    // Skip short amenity chips; keep policy-like sentences only.
    if(s.length<28 && !/check.?in|check.?out|passport|document|identification|minimum age|smoking|pets?|tax|deposit|nationality|visa|guest must/i.test(s)) return out;
    if(/tripjack|tj\s*cash|razorpay|supplier|backend|\bapi\b|provider/i.test(s)) return out;
    if(out.indexOf(s)<0) out.push(s);
    return out;
  }
  if(Array.isArray(node)){
    node.forEach(function(x){ tyhExtractKnowBeforeNotes(x, out, depth+1); });
    return out;
  }
  if(typeof node!=='object') return out;
  const keys=['knowBeforeYouGo','know_before_you_go','knowBeforeYouGoText','importantInfo','instructions','specialInstructions','bookingNotes','policies','idProof','checkInInstructions','checkOutInstructions','msg','text','description'];
  keys.forEach(function(k){ if(node[k]!=null) tyhExtractKnowBeforeNotes(node[k], out, depth+1); });
  return out;
}
function hotelRulesHtml(h,o,raw){
  h=h||{}; o=o||{}; raw=raw||{};
  const pol=policiesOf(h)||{};
  const rawPol=(raw.hInfo&&raw.hInfo.policies)||raw.policies||{};
  const content=(rawOf(h).content||raw.content||{});
  const hInfo=raw.hInfo||(rawOf(h).hInfo)||{};
  const optRaw=o.raw||{};
  const rows=[];
  function push(label,val){
    const t=customerSafeNote(firstText(val));
    if(!t) return;
    if(/tripjack|tj\s*cash|razorpay|payment gateway|supplier|backend|\bapi\b|provider/i.test(t)) return;
    if(rows.some(function(r){ return r.text===t; })) return;
    rows.push({label:label,text:t});
  }
  push('Check-in', pol.checkInInstructions||pol.checkinInstructions||rawPol.checkInInstructions||content.checkInInstructions||hInfo.checkin||hInfo.ckin);
  push('Check-out', pol.checkOutInstructions||pol.checkoutInstructions||rawPol.checkOutInstructions||hInfo.checkout||hInfo.ckout);
  push('ID / documents', pol.idProof||pol.idRequirement||pol.documents||rawPol.idProof||rawPol.documentRequired||content.idProof);
  push('Children', pol.childPolicy||pol.childrenPolicy||rawPol.childPolicy||content.childPolicy);
  push('Pets', pol.petPolicy||rawPol.petPolicy||content.petPolicy);
  push('Smoking', pol.smokingPolicy||rawPol.smokingPolicy||content.smokingPolicy);
  push('Extra bed', pol.extraBed||pol.extraBedPolicy||rawPol.extraBed);
  push('Nationality / residency', pol.nationalityRestriction||pol.residency||rawPol.nationalityRestriction);
  push('Local charges', pol.localCharges||pol.mandatoryFees||rawPol.localCharges||content.mandatoryFees);
  push('Property notes', pol.importantInfo||pol.knowBeforeYouGoText||content.importantInfo);
  const notes=[].concat(
    arr(pol.instructions),arr(pol.specialInstructions),arr(pol.knowBeforeYouGo),
    arr(rawPol.instructions),arr(o.bookingNotes),arr(raw.bookingNotes),arr(raw.instructions),
    arr(hInfo.inst),arr(raw.hInfo&&raw.hInfo.inst),arr(h.raw&&h.raw.inst),
    arr(o.raw&&o.raw.bookingNotes),arr(content.policies),
    tyhExtractKnowBeforeNotes(optRaw.inclusions),
    tyhExtractKnowBeforeNotes(raw.option&&raw.option.inclusions),
    tyhExtractKnowBeforeNotes(raw.hInfo),
    tyhExtractKnowBeforeNotes(content)
  );
  notes.forEach(function(x){
    const t=customerSafeNote(x&&x.msg||x&&x.description||x&&x.text||x&&x.name||x);
    if(!t) return;
    if(/tripjack|tj\s*cash|razorpay|payment gateway|supplier|backend|\bapi\b|provider/i.test(t)) return;
    if(rows.some(function(r){ return r.text===t; })) return;
    rows.push({label:'',text:t});
  });
  const sur=surchargeFeesHtml(raw);
  if(rows.length || sur){
    return '<div class="tyh-rules-property"><p class="tyh-rules-source">Property rules</p>'+rows.map(function(r){
      return '<div class="tyh-rule-row">'+(r.label?'<b>'+esc(r.label)+'</b>':'')+'<p>'+esc(r.text)+'</p></div>';
    }).join('')+(sur||'')+'</div>';
  }
  // Neutral fallback — clearly labelled, not presented as property-specific data.
  const general=[
    'Carry valid government-issued photo identification/passport where required.',
    'Guests must satisfy the property\'s minimum check-in age.',
    'Entry/check-in may be refused if required ID cannot be produced.',
    'Extra beds and meals depend on property availability and may incur charges.',
    'Early check-in and late check-out depend on property availability.',
    'Smoking is allowed only where property policy permits.',
    'Pets are allowed only where property policy permits.',
    'Local taxes/deposits may be collected by the hotel where applicable.',
    'Special requests are subject to property confirmation.',
    'Guests must follow property safety/conduct requirements.',
    'Foreign nationals may need valid passport/visa documentation where legally required.',
    'Damage/security charges may apply according to the property\'s own policy.'
  ];
  return '<div class="tyh-rules-fallback"><p class="tyh-rules-source">General stay guidance</p><p class="tyh-muted">The guidance below is general TravelYaraa stay information.</p><ul>'+general.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('')+'</ul></div>';
}
function recommendedBookOption(h){
  const ops=optionList(h).filter(function(o){ return !!realOptionId(o); });
  if(!ops.length) return null;
  let best=ops[0];
  let bestPrice=Number(best.totalPrice||best.resultDisplayAmount||0);
  ops.forEach(function(o){
    const p=Number(o.totalPrice||o.resultDisplayAmount||0);
    if(p>0 && (bestPrice<=0 || p<bestPrice)){ best=o; bestPrice=p; }
  });
  return best;
}
function optionHasBreakfast(o){
  const meal=lower(o&&(o.mealBasis||o.boardBasis||''));
  if(/breakfast|bb\b|bed\s*&?\s*breakfast|cp\b|continental/.test(meal)) return true;
  const first=arr(o&&o.rooms)[0]||{};
  const bits=[].concat(arr(first.inclusions),arr(o&&o.bookingNotes)).map(function(x){ return lower(typeof x==='string'?x:(x&&(x.msg||x.text||x.name||''))); }).join(' ');
  return /breakfast/.test(bits);
}
function optionHasPan(o){
  return !!(o&&(o.panRequired||o.panOptional||o.ipa||(o.compliance&&(o.compliance.panRequired||o.compliance.panOptional))||(o.raw&&(o.raw.panRequired||o.raw.ipa||o.raw.panOptional))));
}
function roomOccupancyText(o){
  const first=arr(o&&o.rooms)[0]||{};
  const adults=first.adults!=null?Number(first.adults):Number(first.adt||0);
  const children=first.children!=null?Number(first.children):Number(first.chd||0);
  const bits=[];
  if(Number.isFinite(adults)&&adults>0) bits.push(adults+' adult'+(adults===1?'':'s'));
  if(Number.isFinite(children)&&children>0) bits.push(children+' child'+(children===1?'':'ren'));
  return bits.join(' · ');
}
function roomCapacityMax(o){
  const first=arr(o&&o.rooms)[0]||{};
  const raw=o&&o.raw||{};
  const vals=[first.maxAdults,first.maxGuests,first.maxOccupancy,first.occupancy,first.capacity,raw.maxAdults,raw.maxGuests,raw.maxOccupancy];
  for(let i=0;i<vals.length;i++){
    const n=Number(vals[i]);
    if(Number.isFinite(n)&&n>0) return n;
  }
  const adults=first.adults!=null?Number(first.adults):Number(first.adt||0);
  const children=first.children!=null?Number(first.children):Number(first.chd||0);
  const sum=(Number.isFinite(adults)?adults:0)+(Number.isFinite(children)?children:0);
  return sum>0?sum:0;
}
function roomAmenitiesList(o){
  const first=arr(o&&o.rooms)[0]||{};
  const vals=[].concat(arr(first.amenities),arr(first.facilities),arr(first.fcs),arr(first.inclusions),arr(o&&o.amenities));
  return vals.map(amenityName).filter(Boolean).map(String);
}
function optionRequiresPassport(){ return !!(option().passportRequired || (option().compliance&&option().compliance.passportRequired)); }
function optionRequiresPan(){
  const o=option()||{};
  return !!(o.panRequired||o.ipa||(o.compliance&&o.compliance.panRequired)||(o.raw&&(o.raw.panRequired||o.raw.ipa)));
}
function optionPanOptional(){
  if(optionRequiresPan()) return false;
  const o=option()||{};
  const raw=o.raw||{};
  return !!(o.panOptional || (o.compliance&&o.compliance.panOptional) || raw.panOptional || raw.panOptionalFlag);
}
function allHotelImages(h){
  const out=[];
  const push=function(u){ const s=mediaUrl(u)||String(u||'').trim(); if(s&&/^https?:\/\//i.test(s)&&out.indexOf(s)<0) out.push(s); };
  const walk=function(node, depth){
    if(depth>5||node==null) return;
    if(typeof node==='string'){ push(node); return; }
    if(Array.isArray(node)){ node.forEach(function(x){ walk(x, depth+1); }); return; }
    if(typeof node!=='object') return;
    push(node.url||node.src||node.imageUrl||node.image||node.hi||node.tns||node.sz);
    ['images','imgs','photos','gallery','media','hotelImages','contentImages'].forEach(function(k){ if(node[k]) walk(node[k], depth+1); });
  };
  arr(h&&h.images).forEach(function(item){ push(typeof item==='string'?item:mediaUrl(item)); });
  push(h&&h.image); push(imageOf(h));
  const raw=rawOf(h);
  walk(raw.images,0); walk(raw.imgs,0); walk(raw.photos,0);
  walk(raw.hotel&&raw.hotel.images,0); walk(raw.hInfo&&raw.hInfo.img,0); walk(raw.hInfo&&raw.hInfo.images,0);
  walk(raw.content&&raw.content.images,0); walk(raw.data&&raw.data.images,0);
  arr(raw.contentRooms||raw.rooms||[]).forEach(function(r){ walk(r&&(r.images||r.imgs||r.photos),0); });
  return out;
}
function cancellationPolicyBody(o){
  const c=cancellationOf(o||{});
  const pd=arr(c.penalties);
  const nonRef=c.refundable===false;
  const statusLabel=nonRef?'Non-refundable':(c.freeCancellation?'Free cancellation'+(c.freeCancellationUntil?' until '+fmtDate(c.freeCancellationUntil):''):'Cancellation charges may apply');
  const s=S.search||{};
  const ci=s.checkIn||s.checkinDate||'';
  const nowLabel=new Date().toLocaleString(undefined,{hour:'numeric',minute:'2-digit',hour12:true});
  const checkInLabel=ci?(fmtDate(ci)+(c.checkInTime||c.ciTime?(' '+String(c.checkInTime||c.ciTime)):'') ):'';
  const timeline='<div class="tyh-cancel-timeline" aria-hidden="false">'
    +'<div class="tyh-cancel-tl-row"><span class="tyh-cancel-dot tyh-cancel-dot-now"></span><div><b>Now</b><span> · '+esc(nowLabel)+'</span></div></div>'
    +'<div class="tyh-cancel-tl-mid"><span class="tyh-cancel-pill">'+esc(nonRef?'Non-Refundable':(c.freeCancellation?'Refundable':'Policy'))+'</span></div>'
    +(checkInLabel?'<div class="tyh-cancel-tl-row"><span class="tyh-cancel-dot tyh-cancel-dot-end"></span><div><b>Check In</b><span> · '+esc(checkInLabel)+'</span></div></div>':'')
  +'</div>';
  const head='<p class="tyh-cancel-status">✓ '+esc(statusLabel)+'</p>';
  let table='';
  if(pd.length){
    table='<div class="tyh-cancel-table-wrap"><table class="tyh-cancel-table"><thead><tr><th>On or After</th><th>On or Before</th><th>Charges/Comments</th></tr></thead><tbody>'
      +pd.map(function(x){
        const from=x.fromDate||x.fdt||x.from||'';
        const to=x.toDate||x.tdt||x.to||'';
        const amount=x.amount!=null?money(x.amount):(x.am!=null?money(x.am):'');
        const pct=x.percent!=null?String(x.percent)+'%':(x.pp!=null?String(x.pp)+'%':'');
        const charge=[amount,pct].filter(Boolean).join(' / ')||'As per policy';
        return '<tr><td>'+esc(from?fmtDate(from):'—')+'</td><td>'+esc(to?fmtDate(to):'—')+'</td><td>'+esc(charge)+'</td></tr>';
      }).join('')
      +'</tbody></table></div>';
  }
  const notes=[];
  const rawNotes=[c.noShow,c.noShowPolicy,c.earlyCheckout,c.earlyCheckOut,c.comments,c.note,c.additionalInfo];
  rawNotes.forEach(function(t){
    const s2=customerSafeNote(firstText(t));
    if(s2 && notes.indexOf(s2)<0) notes.push(s2);
  });
  // Do not invent no-show / early-checkout copy — only render API-supplied notes.
  const notesHtml=notes.length?'<div class="tyh-cancel-notes">'+notes.map(function(t){ return '<p>'+esc(t)+'</p>'; }).join('')+'</div>':'';
  return '<div class="tyh-cancel-sheet-body"><h3 class="tyh-cancel-sheet-h">Cancellation Policy</h3>'+head+timeline+(table||'<p class="tyh-muted">No detailed cancellation slabs were returned for this rate.</p>')+notesHtml+'</div>';
}
function stayNightsLabel(){
  const s=S.search||{};
  const ctx=s.searchContext||{};
  const n=nights(s.checkIn||s.checkinDate||ctx.checkIn, s.checkOut||s.checkoutDate||ctx.checkOut);
  return 'Total for '+n+' night'+(n===1?'':'s');
}
function normOption(op, h, i){
  op=op||{};
  const rooms=arr(op.roomInfo).length?arr(op.roomInfo):(arr(op.rooms).length?arr(op.rooms):arr(op.ris));
  const first=rooms[0]||{};
  const id=String(op.optionId||op.id||op.code||op.op||'').trim();
  const cancel=cancellationOf(op);
  const roomName=op.roomSummary||op.roomName||first.roomCategory||first.roomType||first.name||first.rc||first.rt||'';
  const meal=op.mealBasis||op.boardBasis||op.mb||first.mealBasis||first.boardBasis||first.mb||'';
  const panRequired=!!(op.panRequired||op.ipa||(op.compliance&&op.compliance.panRequired)||op.isPanRequired);
  const passportRequired=!!(op.passportRequired||(op.compliance&&op.compliance.passportRequired));
  const sell=priceOf(op,h);
  const listedTotal=firstPositiveAmount(op.totalPrice, op.tp, op.raw&&op.raw.totalPrice, op.raw&&op.raw.tp, op.supplierTotalPrice);
  // Keep supplier total only when it is clearly below customer sell (markup case).
  const supplierTotal=(listedTotal>0 && sell>0 && listedTotal < sell-0.5) ? listedTotal : (op.supplierTotalPrice||0);
  const pb=op.pricingBreakup||op.priceBreakup||(op.raw&&(op.raw.pricingBreakup||op.raw.priceBreakup))||{};
  const convenienceFee=Number(pb.convenienceFee||pb.convenienceFeeBeforeOffer||op.convenienceFee||0)||0;
  const customerPayable=Number(pb.customerPayable||op.customerPayable||0)||0;
  // Room Selection displays Base Fare only (markup-inclusive ticket). Fee is Guest-only.
  const displayBase=hotelMoneyRound(sell);
  const payableTotal=customerPayable>0?hotelMoneyRound(customerPayable):(sell>0?hotelMoneyRound(sell+Math.max(0,convenienceFee)):displayBase);
  return {
    id:id, optionId:id, roomType:String(roomName), roomSummary:String(roomName), mealBasis:String(meal),
    totalPrice:sell, resultDisplayAmount:sell, supplierTotalPrice:supplierTotal||0,
    convenienceFee:convenienceFee, customerPayable:payableTotal||0, displayTotal:displayBase,
    pricingBreakup:pb,
    baseFare:Number(op.baseFare||op.pricing&&op.pricing.basePrice||0),
    taxes:Number(op.taxes||op.pricing&&op.pricing.taxes||0),
    managementFee:Number(op.managementFee||op.mf||op.pricing&&op.pricing.mf||op.pricing&&op.pricing.markup||0),
    managementFeeTax:Number(op.managementFeeTax||op.mft||op.pricing&&op.pricing.mft||op.pricing&&op.pricing.markupTax||0),
    currency:op.currency||op.pricing&&op.pricing.currency||h.currency||'INR',
    refundable:cancel.refundable, freeCancellation:cancel.freeCancellation, cancellation:cancel, cancellationPolicy:cancel.raw,
    bookingNotes:op.bookingNotes||op.notes||[], rooms:rooms,
    panRequired:panRequired, passportRequired:passportRequired,
    panOptional:!!(op.panOptional||(op.compliance&&op.compliance.panOptional)),
    compliance:op.compliance||null,
    raw:op
  };
}
function optionList(h){ const raw=h.raw||h; let ops=[]; if(arr(h.options).length) ops=arr(h.options); else if(arr(raw.options).length) ops=raw.options; else if(raw.option) ops=[raw.option]; else if(arr(raw.ops).length) ops=raw.ops; else if(arr(raw.hInfo&&raw.hInfo.ops).length) ops=raw.hInfo.ops; else if(arr(raw.data&&raw.data.hInfo&&raw.data.hInfo.ops).length) ops=raw.data.hInfo.ops; return ops.map((op,i)=>normOption(op,h,i)); }
function realHotelId(h){ return String((h&&(h.hotelId||h.tjHotelId||h.id))||'').trim(); }
function realOptionId(o){ const id=String((o&&(o.optionId||o.id))||'').trim(); if(!id||/^room_\d+$/i.test(id)) return ''; return id; }
function realReviewHash(h){ return String((h&&h.reviewHash)||'').trim(); }
function hasPricingReviewContext(h){ return S.detailStatus==='ready' && !!realHotelId(h) && !!realReviewHash(h) && optionList(h).some(function(o){ return !!realOptionId(o); }); }
function roomRateArticle(o, allowContinue, hotel){
  const id=realOptionId(o);
  const action=allowContinue&&id?'<button type="button" class="tyh-cta tyh-book-rate" data-review-room="'+attr(id)+'">Book</button>':'';
  const c=o.cancellation||cancellationOf(o||{});
  const cancelLine=cancelSummaryText(o);
  const canViewCancelMore=arr(c.penalties).length>0 || !!(cancelLine&&String(cancelLine).trim()) || o.refundable===false || !!(o.freeCancellation||o.refundable);
  const refundLabel=o.refundable===false?'Non-refundable':(o.freeCancellation||o.refundable?'Refundable':'');
  const meal=o.mealBasis||'';
  const planBits=[meal, refundLabel].filter(Boolean);
  const panLine=optionHasPan(o)?'PAN required for this rate':'';
  const cap=roomCapacityMax(o);
  const viewMore=canViewCancelMore&&id
    ? '<button type="button" class="tyh-view-more-link" data-open-cancel-sheet="'+attr(id)+'">View more</button>'
    : '';
  const priceAmt=money(hotelBaseFareAmount(o, hotel)||o.displayTotal||o.resultDisplayAmount||o.totalPrice);
  const midCol='<div class="tyh-rate-main">'
    +(cap>0?'<p class="tyh-rate-cap">Fits max. '+esc(String(cap))+' guests</p>':'')
    +(o.roomSummary||o.roomType?'<b class="tyh-rate-title">'+esc(o.roomSummary||o.roomType)+'</b>':'')
    +(planBits.length?'<p class="tyh-rate-meal">'+esc(planBits.join(' | '))+'</p>':'')
    +(cancelLine?'<p class="tyh-rate-cancel">✓ '+esc(cancelLine)+'</p>':'')
    +(panLine?'<p class="tyh-rate-pan">'+esc(panLine)+'</p>':'')
    +viewMore
  +'</div>';
  const rightCol='<div class="tyh-rate-side">'
    +'<strong class="tyh-rate-price">'+esc(priceAmt)+'</strong>'
    +'<em class="tyh-rate-total-note">Total price for 1 room</em>'
    +action
  +'</div>';
  return '<article class="tyh-rate tyh-rate-text" data-option-id="'+attr(id)+'">'+midCol+rightCol+'</article>';
}
function roomTypeMediaHtml(o, hotel){
  hotel=hotel||{};
  const imgs=roomImagesOf(o, hotel);
  const src=imgs[0]||'';
  const more=Math.max(0, imgs.length-1);
  const first=arr(o.rooms)[0]||{};
  const bedType=first.bedType||first.bed||(first.bed_config&&first.bed_config.description)||first.bt||'';
  const cap=roomCapacityMax(o);
  const amens=roomAmenitiesList(o);
  const showAmens=amens.slice(0,6);
  const moreAmens=Math.max(0, amens.length-showAmens.length);
  const id=realOptionId(o);
  const badges=[
    bedType?('<span class="tyh-room-badge">'+esc(bedType)+'</span>'):'',
    cap>0?('<span class="tyh-room-badge">Fits max. '+esc(String(cap))+' guests</span>'):''
  ].filter(Boolean).join('');
  const photoBtn=(src && more>0 && id)
    ? '<button type="button" class="tyh-room-photo-count" data-open-room-gallery="'+attr(id)+'">+'+esc(String(more))+' Photo'+(more===1?'':'s')+' →</button>'
    : (src && id ? '<button type="button" class="tyh-room-photo-count" data-open-room-gallery="'+attr(id)+'">View photos</button>' : '');
  // No trustworthy room/interior image → omit image block entirely (no empty placeholder).
  const mediaImg=src
    ? ('<div class="tyh-room-media-img">'
        +'<img src="'+attr(src)+'" alt="'+attr(o.roomSummary||o.roomType||'Room')+'" loading="lazy">'
        +photoBtn
      +'</div>')
    : '';
  const meta=(badges?'<div class="tyh-room-badges">'+badges+'</div>':'')
    +(showAmens.length
      ? '<ul class="tyh-rate-amens">'+showAmens.map(function(a){ return '<li>✓ '+esc(a)+'</li>'; }).join('')+'</ul>'
        +(moreAmens?'<button type="button" class="tyh-view-more-link" data-open-room-amenities="'+attr(id)+'">View more amenities</button>':'')
      : '');
  if(!mediaImg && !meta) return '';
  return '<div class="tyh-room-media'+(mediaImg?'':' tyh-room-media-nomedia')+'">'+mediaImg+meta+'</div>';
}
function roomTypeGroupHtml(list, hotel, allowContinue){
  list=arr(list);
  if(!list.length) return '';
  const sample=list[0];
  const hasImg=!!(roomImagesOf(sample, hotel)[0]);
  const media=roomTypeMediaHtml(sample, hotel);
  // Flat layout when no genuine room photo — never reserve a large empty media column.
  const flat=!hasImg;
  return '<div class="tyh-room-type-card'+(flat?' tyh-room-type-nomedia':'')+'">'
    +(media||'')
    +'<div class="tyh-room-type-rates'+(flat?' tyh-rates-flat':'')+'">'+list.map(function(o){ return roomRateArticle(o, allowContinue, hotel); }).join('')+'</div>'
  +'</div>';
}
function roomRatesHtml(h){
  if(S.detailStatus==='loading'){
    const listing=optionList(h);
    return '<section class="tyh-rooms-block" id="tyhRoomTypes">'
      +'<div class="tyh-rooms-head"><h3>Room types</h3><p class="tyh-muted">Loading live room rates…</p></div>'
      +(listing.length?'<div class="tyh-detail-rooms">'+roomTypeGroupHtml(listing.slice(0,1),h,false)+'</div>':'')
    +'</section>';
  }
  if(S.detailStatus==='error'){
    return '<section class="tyh-rooms-block" id="tyhRoomTypes"><p class="tyh-muted">'+esc(S.detailError||'We couldn’t load hotels right now. Please try again.')+'</p><button type="button" data-retry-detail>Try again</button></section>';
  }
  if(!hasPricingReviewContext(h)){
    return '<section class="tyh-rooms-block" id="tyhRoomTypes"><p class="tyh-muted">Live room rates are not ready yet. Please wait or try again.</p><button type="button" data-retry-detail>Try again</button></section>';
  }
  const allOps=optionList(h).filter(function(o){ return !!realOptionId(o); });
  if(!allOps.length) return '<section class="tyh-rooms-block" id="tyhRoomTypes"><p class="tyh-muted">Room options are unavailable for this hotel.</p></section>';
  const qStr=lower(S.ui.roomQuery||'');
  const filter=String(S.ui.roomFilter||'all');
  const hasRefundable=allOps.some(function(o){ return !!(o.freeCancellation||o.refundable); });
  const hasBreakfast=allOps.some(optionHasBreakfast);
  const hasPan=allOps.some(optionHasPan);
  let ops=allOps.filter(function(o){
    if(qStr){
      const hay=lower([o.roomSummary,o.roomType,o.mealBasis,cancelSummaryText(o)].join(' '));
      if(hay.indexOf(qStr)<0) return false;
    }
    if(filter==='refundable' && !(o.freeCancellation||o.refundable)) return false;
    if(filter==='breakfast' && !optionHasBreakfast(o)) return false;
    if(filter==='pan' && !optionHasPan(o)) return false;
    return true;
  });
  const chip=function(key,label,show){
    if(!show) return '';
    return '<button type="button" class="tyh-room-chip'+(filter===key?' active':'')+'" data-room-filter="'+attr(key)+'">'+esc(label)+'</button>';
  };
  const filtersHtml='<div class="tyh-room-filters">'
    +chip('all','All',true)
    +chip('refundable','Refundable',hasRefundable)
    +chip('breakfast','Breakfast Included',hasBreakfast)
    +chip('pan','PAN required',hasPan)
  +'</div>';
  const anyRoomImg=ops.some(function(o){ return !!(roomImagesOf(o, h)[0]); });
  let roomsBody='';
  if(!ops.length){
    roomsBody='<p class="tyh-muted">No room options match your filters.</p>';
  }else if(!anyRoomImg){
    // Desktop: 2 rate cards per row; mobile: 1 per row. Real API rates only — no duplicates.
    roomsBody='<div class="tyh-detail-rooms tyh-rates-flat tyh-desk-rate-grid">'
      +ops.map(function(o){ return roomRateArticle(o, true, h); }).join('')
    +'</div>';
  }else{
    const groups=new Map();
    ops.forEach(function(o){
      const key=String((o.roomSummary||o.roomType||'room')).trim().toLowerCase();
      const arrg=groups.get(key)||[];
      arrg.push(o);
      groups.set(key,arrg);
    });
    roomsBody='<div class="tyh-detail-rooms">'+Array.from(groups.values()).map(function(list){
      return roomTypeGroupHtml(list, h, true);
    }).join('')+'</div>';
  }
  return '<section class="tyh-rooms-block" id="tyhRoomTypes">'
    +'<div class="tyh-rooms-head">'
      +'<div><h3>Room types</h3><p class="tyh-muted">Showing '+esc(String(ops.length))+' of '+esc(String(allOps.length))+' room options</p></div>'
      +'<label class="tyh-room-search"><span class="tyh-sr">Search rooms</span><input type="search" data-room-query placeholder="Search by Room Type / Room Category" value="'+attr(S.ui.roomQuery||'')+'"></label>'
    +'</div>'
    +filtersHtml
    +roomsBody
  +'</section>';
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
  const optionPrice=options.reduce(function(min,o){ const n=Number(o.displayTotal||o.resultDisplayAmount||o.totalPrice||0); return n>0&&(min===0||n<min)?n:min; },0);
  const hPb=h.pricingBreakup||h.priceBreakup||(raw.pricingBreakup)||{};
  const ticket=Number(h.resultDisplayAmount||h.displayPrice||hPb.ticketAmount||hPb.resultDisplayAmount||h.price||0);
  const fee=Number(hPb.convenienceFee||hPb.convenienceFeeBeforeOffer||0);
  const apiPay=Number(hPb.customerPayable||0);
  // Results card = markup-inclusive Base Fare only. Convenience fee is shown only on Guest Fare Summary.
  const price=hotelMoneyRound(Number(ticket||optionPrice||0));
  const payable=hotelMoneyRound(Number(apiPay||(ticket>0?(ticket+Math.max(0,fee)):0)||price||0));
  const context=h.searchContext||raw.searchContext||S.search.searchContext||{};
  const id=h.tjHotelId||h.hotelId||h.id||h.hid||'';
  const base={
    key:String(id||h.uid||('hotel_'+i)),
    id:id, hotelId:id, tjHotelId:id,
    name:name, area:h.area||h.locality||h.location||'', address:typeof h.address==='string'?h.address:(h.address&&h.address.addressLine1)||(typeof h.ad==='string'?h.ad:(h.ad&&h.ad.adr))||'',
    locality:h.locality||h.area||'', city:h.city||h.cityName||context.cityName||'', state:h.state||h.stateName||'', country:h.country||h.countryName||h.cnt||context.countryName||'',
    postalCode:h.postalCode||h.postal||'',
    latitude:h.latitude!=null?h.latitude:(h.lat!=null?h.lat:''), longitude:h.longitude!=null?h.longitude:(h.lng!=null?h.lng:''),
    star:Number(h.starRating||h.star||h.rt||0), rating:Number(h.userRating||h.rating||h.ur||0),
    ratingCount:ratingCountOf(Object.assign({},h,{raw:raw})),
    image:imageOf(Object.assign({},h,{raw:raw})), images:allHotelImages(Object.assign({},h,{raw:raw})), amenities:amenitiesOf(Object.assign({},h,{raw:raw})),
    options:options, price:price, resultDisplayAmount:ticket||price, convenienceFee:fee, customerPayable:payable, pricingBreakup:hPb,
    currency:h.currency||context.currency||'INR', reviewHash:h.reviewHash||raw.reviewHash||'', searchContext:context, correlationId:h.correlationId||context.correlationId||'', raw:raw
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
function currentStep(){ return new URLSearchParams(location.search).get('step')||'results'; }
function shell(content, opts){
  opts=opts||{};
  const s=S.search||{};
  const title=opts.title || s.cityName || s.city || s.destination || s.location || 'Hotels';
  const sub=[s.checkIn||s.checkinDate, s.checkOut||s.checkoutDate].filter(Boolean).map(fmtDate).join(' to ');
  const mobileResults = !!opts.mobileResults || (isMobileHotelUi() && currentStep()==='results' && !opts.forceDesktopHeader);
  const hideLogo = !!opts.hideLogo || mobileResults;
  const pageClass = 'tyh-page'+(mobileResults?' tyh-page-mobile-results':'');
  const subText=opts.sub===''?'':(opts.sub!=null?opts.sub:(sub||'Select your stay'));
  const header = mobileResults
    ? ''
    : '<header class="tyh-top"><button type="button" class="tyh-back" data-back>‹</button>'+(hideLogo?'':logoHtml())+'<div class="tyh-top-title"><h1>'+esc(title)+'</h1>'+(subText?'<p>'+esc(subText)+'</p>':'')+'</div>'+(opts.status?'<span class="tyh-status-pill">'+esc(opts.status)+'</span>':'')+'</header>';
  root.innerHTML = '<style>'+css()+'</style><div class="'+pageClass+'"><div class="tyh-shell">'+header+content+'</div></div>';
  bindBase();
}
function bindBase(){
  function goBackOneStep(){
    const step=currentStep();
    // Retired customer Review step — treat as Guest for one-step Back.
    if(step==='review'){
      setPage('guest');
      renderGuestStep();
      return;
    }
    if(step==='guest'){
      const hid=realHotelId(hotel()||S.detailHotel||S.selectedHotel||{});
      setPage('hotel-details', hid?('hotelId='+encodeURIComponent(hid)):'');
      if(S.detailHotel||hotel()){
        S.detailHotel=S.detailHotel||hotel();
        renderHotelDetailsPlumbing();
      } else if(hid){
        S.detailHotel=hotelByRealId(hid);
        renderHotelDetailsPlumbing();
        if(S.detailHotel) loadHotelPricing(S.detailHotel);
      } else {
        setPage('results');
        if(S.shown&&S.shown.length) renderResults(); else loadResults();
      }
      return;
    }
    if(step==='hotel-details'){
      setPage('results');
      if(S.shown&&S.shown.length) renderResults(); else loadResults();
      return;
    }
    history.back();
  }
  qa('[data-back]',root).forEach(function(b){ b.onclick=goBackOneStep; });
}

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
  // Never wipe an open Hotel Detail view with the Results pending shell.
  // Detail refresh/back-forward restore depends on search hydration via setResults → maybeShowHotelDetailsFromUrl.
  const keepHotelDetails=currentStep()==='hotel-details';
  const searchKey=JSON.stringify({regionId:String(S.search.regionId||S.search.cityId||''),checkIn:S.search.checkIn||S.search.checkinDate||'',checkOut:S.search.checkOut||S.search.checkoutDate||'',rooms:S.search.rooms||[],nationality:String(S.search.nationality||'IN').toUpperCase(),countryOfResidence:String(S.search.countryOfResidence||S.search.residenceCountry||'IN').toUpperCase()});
  const reuseInFlight=!!(hotelSearchLock && hotelSearchLock.key===searchKey);
  // Avoid painting an empty Results pending shell when Detail must stay mounted,
  // or when the same search is already in-flight / already has cards to show.
  if(!keepHotelDetails){
    if(!reuseInFlight){
      shell('<main class="tyh-results tyh-results-pending"><section class="tyh-list-wrap"><div class="tyh-list-head"><div><strong>Searching hotels in '+esc(pendingTitle)+'</strong><span>'+esc([fmtDate(S.search.checkIn||S.search.checkinDate),fmtDate(S.search.checkOut||S.search.checkoutDate)].filter(Boolean).join(' • '))+'</span></div></div><div class="tyh-cards"></div></section></main>',{title:pendingTitle});
    }
    showLoader('Finding the best hotels for you...');
  }
  if(!/^\d+$/.test(String(S.search.regionId||S.search.cityId||''))){
    hideLoader();
    if(keepHotelDetails){
      maybeShowHotelDetailsFromUrl();
      return;
    }
    shell('<main class="tyh-empty"><h2>Select a location</h2><p>'+esc('Please select a valid hotel location from the suggestions and search again.')+'</p><button type="button" data-try>Back to search</button></main>',{title:'Hotels'});
    const t=q('[data-try]',root); if(t)t.onclick=()=>location.href='/';
    return;
  }
  if(reuseInFlight) return hotelSearchLock.promise;
  const job={key:searchKey, promise:null};
  job.promise=(async function(){
    try{
      const res=await api('/api/hotels/search',S.search);
      save(KEY.results,res);
      const d=unwrap(res)||{};
      S.search=Object.assign({},S.search,{searchContext:d.searchContext||{}});
      const list=extractResults(res);
      if(!list.length){
        if(currentStep()==='hotel-details'){
          maybeShowHotelDetailsFromUrl();
          return;
        }
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
      if(currentStep()==='hotel-details'){
        maybeShowHotelDetailsFromUrl();
        return;
      }
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
  if(currentStep()==='hotel-details') return;
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
  return '<form class="tyh-modify tyh-modify-full" data-modify-search aria-label="Hotel search">'
    +'<button type="button" class="tyh-mod-box tyh-mod-city" data-open-city><small>City / Area / Property</small><b>'+esc(dest||'Select location')+'</b>'+(sub?'<em>'+esc(sub)+'</em>':'')+'</button>'
    +'<button type="button" class="tyh-mod-box" data-open-cal="start"><small>Check-in</small><b>'+esc(fmtDate(dates.checkIn))+'</b></button>'
    +'<button type="button" class="tyh-mod-box" data-open-cal="end"><small>Check-out</small><b>'+esc(fmtDate(dates.checkOut))+'</b></button>'
    +'<button type="button" class="tyh-mod-box" data-open-guest><small>Rooms &amp; Guests</small><b>'+esc(guestSummary())+'</b></button>'
    +'<div class="tyh-mod-nat">'+nationalityResidenceFieldsHtml(false)+'</div>'
    +'<button type="submit" class="tyh-mod-search">Search</button>'
  +'</form>'
    +cityPickerHtml()+guestPopupHtml()+calendarHtml();
}
function mobileSearchSummaryHtml(){
  const s=S.search||{};
  const dates=searchDates();
  const dest=s.cityName||s.city||s.destination||'Hotels';
  const count=S.shown.length;
  return '<section class="tyh-m-summary" aria-label="Current hotel search">'
    +'<div class="tyh-m-summary-top"><strong>'+esc(dest)+'</strong><span>'+esc(String(count))+' properties</span></div>'
    +'<button type="button" class="tyh-m-summary-card" data-open-edit-search>'
      +'<div class="tyh-m-summary-main">'
        +'<b>'+esc(fmtDate(dates.checkIn))+' – '+esc(fmtDate(dates.checkOut))+'</b>'
        +'<span>'+esc(guestSummary())+'</span>'
        +'<em>'+esc(countryNameFromIso(searchNationality()))+' · Res: '+esc(countryNameFromIso(searchResidenceCountry()))+'</em>'
      +'</div>'
      +'<span class="tyh-m-edit" aria-label="Edit search"><i aria-hidden="true">✎</i></span>'
    +'</button>'
  +'</section>';
}
function mobileEditSearchSheet(){
  if(!S.ui.editSearchOpen) return '';
  const s=S.search||{};
  const dates=searchDates();
  const dest=s.cityName||s.city||'';
  const sub=s.area||s.fullRegionName||'';
  return '<div class="tyh-pop-bg" data-edit-search-close></div>'
    +'<section class="tyh-edit-sheet" role="dialog" aria-label="Edit search">'
      +'<header><h2>Edit search</h2><button type="button" data-edit-search-close aria-label="Close">×</button></header>'
      +'<form class="tyh-edit-form" data-modify-search>'
        +'<button type="button" class="tyh-mod-box tyh-mod-city" data-open-city><small>City / Area / Property</small><b>'+esc(dest||'Select location')+'</b>'+(sub?'<em>'+esc(sub)+'</em>':'')+'</button>'
        +'<button type="button" class="tyh-mod-box" data-open-cal="start"><small>Check-in</small><b>'+esc(fmtDate(dates.checkIn))+'</b></button>'
        +'<button type="button" class="tyh-mod-box" data-open-cal="end"><small>Check-out</small><b>'+esc(fmtDate(dates.checkOut))+'</b></button>'
        +'<button type="button" class="tyh-mod-box" data-open-guest><small>Rooms &amp; Guests</small><b>'+esc(guestSummary())+'</b></button>'
        +'<div class="tyh-more-opts-block"><h3>More options</h3>'+nationalityResidenceFieldsHtml(true)+'</div>'
        +'<button type="submit" class="tyh-mod-search tyh-edit-search-btn">Search</button>'
      +'</form>'
    +'</section>'
    +cityPickerHtml()+guestPopupHtml()+calendarHtml();
}
function renderResults(){
  if(currentStep()==='hotel-details') return;
  const s=S.search||{};
  const city=s.cityName||s.city||s.destination||s.location||'Hotels';
  const count=activeFilterCount();
  const opts=sortOptions();
  const mobile=isMobileHotelUi();
  const head='<div class="tyh-list-head"><div><strong>'+esc(S.shown.length)+' hotels in '+esc(city)+'</strong><span>'+esc([fmtDate(s.checkIn||s.checkinDate),fmtDate(s.checkOut||s.checkoutDate)].filter(Boolean).join(' • '))+(guestSummary()?' · '+esc(guestSummary()):'')+'</span></div><label class="tyh-desktop-sort">Sort by <select data-sort-select>'+opts.map(function(o){ return '<option value="'+attr(o.value)+'"'+(S.sort===o.value?' selected':'')+'>'+esc(o.label)+(o.sub?(' — '+o.sub):'')+'</option>'; }).join('')+'</select></label></div>';
  const tools='<div class="tyh-result-tools"><button type="button" data-open-sort>Sort</button><button type="button" data-open-filter>Filters'+(count?' ('+count+')':'')+'</button></div>';
  const cards='<div class="tyh-cards">'+(S.shown.length?S.shown.map(hotelCard).join(''):'<div class="tyh-empty"><h2>No hotels found</h2><p>Try changing filters or search again.</p></div>')+'</div>';
  const content = mobile
    ? mobileSearchSummaryHtml()+tools+'<main class="tyh-results tyh-results-mobile">'+filterPanel()+'<section class="tyh-list-wrap">'+cards+'</section></main>'+mobileEditSearchSheet()+(document.body.classList.contains('tyh-sort-open')?sortSheet():'')+(S.roomHotel?roomSheet(S.roomHotel):'')
    : modifySearchBar()+'<main class="tyh-results">'+filterPanel()+'<section class="tyh-list-wrap">'+head+cards+'</section></main>'+(document.body.classList.contains('tyh-sort-open')?sortSheet():'')+(S.roomHotel?roomSheet(S.roomHotel):'');
  shell(content,{title:city, sub:'Hotel results', mobileResults:mobile, hideLogo:mobile});
  bindResults();
  if(mobile && S.resultsScrollY){
    try{ window.scrollTo(0, S.resultsScrollY); }catch(e){}
  }
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
  return '<article class="tyh-card" data-hotel-id="'+attr(hid)+'">'
    +'<a class="tyh-card-main" href="'+attr(href)+'" data-hotel-open="'+attr(hid)+'">'
      +'<div class="tyh-img">'+(imageOf(h)?'<img src="'+attr(imageOf(h))+'" alt="'+attr(h.name)+'" loading="lazy">':'<span>'+esc((h.name||'H').slice(0,1))+'</span>')+'</div>'
      +'<div class="tyh-info">'
        +'<div class="tyh-title-row"><h2>'+esc(h.name)+'</h2>'+stars+'</div>'
        +(location?'<p class="tyh-location">'+esc(location)+'</p>':'')
        +(ptype?'<p class="tyh-ptype">'+esc(ptype)+'</p>':'')
        +(facilities?'<div class="tyh-facilities">'+facilities+'</div>':'')
        +(meal?'<p class="tyh-meal">'+esc(meal)+'</p>':'')
        +(cancel?'<p class="tyh-free">'+esc(cancel)+'</p>':'')
      +'</div>'
      +'<div class="tyh-card-side">'
        +'<div class="tyh-price"><small>'+esc(stayNightsLabel())+'</small><b>'+esc(money(h.price))+'</b>'+(tax?'<em>'+esc(tax)+'</em>':'')+'</div>'
        +'<span class="tyh-view-btn">View Details</span>'
      +'</div>'
    +'</a>'
  +'</article>';
}
function setFilterValue(kind,value,checked){
  if(kind==='gst'){ S.filters.gst = checked ? (value===true||value==='true') : null; return; }
  if(kind==='freeCancel'){ S.filters.freeCancel = !!checked; return; }
  const set=S.filters[kind]; if(!set) return;
  checked ? set.add(value) : set.delete(value);
}
function clearFilters(){ S.filters.priceRanges.clear(); S.filters.gst=null; S.filters.propertyTypes.clear(); S.filters.places.clear(); S.filters.stars.clear(); S.filters.meals.clear(); S.filters.amenities.clear(); S.filters.min=0; S.filters.max=0; S.filters.freeCancel=false; S.filters.nameQuery=''; }
function closeFilter(){ document.body.classList.remove('tyh-filter-open'); }
function closeSort(){ document.body.classList.remove('tyh-sort-open'); if(currentStep()!=='hotel-details') renderResults(); }
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
  live.nationality=String(live.nationality||'IN').toUpperCase();
  live.countryOfResidence=String(live.countryOfResidence||live.residenceCountry||'IN').toUpperCase();
  live.residenceCountry=live.countryOfResidence;
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
  const fromLive = S.all.find(function(h){ return String(h.hotelId||h.id||'')===want; }) || S.shown.find(function(h){ return String(h.hotelId||h.id||'')===want; });
  if(fromLive) return fromLive;
  if(S.detailHotel && String(S.detailHotel.hotelId||S.detailHotel.id||'')===want) return S.detailHotel;
  const stored=read(KEY.selectedListing,null);
  if(stored && stored.hotel && String(stored.hotel.hotelId||stored.hotel.id||'')===want){
    if(stored.search && typeof stored.search==='object') S.search=Object.assign({}, S.search, stored.search);
    return stored.hotel;
  }
  try{
    const cached=read(KEY.results,null);
    const list=extractResults(cached||{});
    return list.find(function(h){ return String(h.hotelId||h.id||'')===want; }) || null;
  }catch(e){ return null; }
}
function maybeShowHotelDetailsFromUrl(){
  const params=new URLSearchParams(location.search);
  if((params.get('step')||'')!=='hotel-details') return false;
  const hid=params.get('hotelId')||'';
  const found=hotelByRealId(hid);
  S.detailHotel=found;
  S.detailStatus=found?'loading':'idle';
  S.detailError='';
  renderHotelDetailsPlumbing();
  if(found) loadHotelPricing(found);
  return true;
}
function policiesOf(h){
  const p=h&&h.policies;
  return p&&typeof p==='object'?p:{};
}
function hotelDescription(h){
  const r=rawOf(h);
  return firstText(h.description,h.des,r.des,r.description,deepFind(r,['description','des','about','overview']));
}
function hotelAboutSectionsHtml(h){
  h=h||{};
  const raw=rawOf(h);
  const content=raw.content||raw.hotelContent||h.content||{};
  const sections=[];
  function push(title, val){
    let text='';
    if(Array.isArray(val)){
      text=val.map(function(x){ return customerSafeNote(firstText(x&&x.msg,x&&x.description,x&&x.text,x&&x.name,x)); }).filter(Boolean).join('\n');
    } else {
      text=customerSafeNote(firstText(val));
    }
    if(!text) return;
    if(/tripjack|supplier|backend|\bapi\b/i.test(text)) return;
    if(sections.some(function(s){ return s.title===title && s.text===text; })) return;
    sections.push({title:title, text:text});
  }
  const desc=hotelDescription(h);
  if(desc) push('Overview', desc);
  push('Headline', content.headline||content.tagline||raw.headline);
  push('Location', content.location||content.locationDescription||content.locationDesc||raw.locationDescription);
  push('Amenities', content.amenitiesDescription||content.amenitiesText||content.amenitiesDesc);
  push('Rooms', content.roomsDescription||content.roomsText||content.roomDescription);
  push('Dining', content.dining||content.diningDescription||content.restaurants);
  push('Business amenities', content.businessAmenities||content.businessFacilities||content.business);
  push('Onsite payments', content.onsitePayments||content.paymentMethods||content.acceptedPayments);
  push('Spoken languages', content.spokenLanguages||content.languages||content.languagesSpoken);
  push('Attractions', content.attractions||content.nearbyAttractions||content.areaAttractions);
  // Generic content section objects if present
  arr(content.sections).concat(arr(content.descriptions), arr(raw.descriptions)).forEach(function(sec){
    if(!sec||typeof sec!=='object') return;
    push(firstText(sec.title,sec.name,sec.heading,sec.type)||'Details', sec.text||sec.description||sec.body||sec.content||sec.msg);
  });
  if(!sections.length) return '';
  return sections.map(function(s){
    return '<div class="tyh-about-sec"><h3>'+esc(s.title)+'</h3><p class="tyh-desc">'+esc(s.text)+'</p></div>';
  }).join('');
}
function hotelHeroHtml(h){
  const imgs=allHotelImages(h);
  if(!imgs.length) return '';
  const desktop=!isMobileHotelUi();
  const main=imgs[0];
  const count=imgs.length;
  if(desktop && count>1){
    const sideA=imgs[1]||main;
    const sideB=imgs[2]||imgs[1]||main;
    const more=Math.max(0, count-3);
    return '<div class="tyh-gallery-grid" aria-label="Hotel photos">'
      +'<button type="button" class="tyh-gallery-main" data-open-gallery data-gallery-index="0"><img src="'+attr(main)+'" alt="'+attr(h.name||'Hotel')+'" loading="eager"></button>'
      +'<div class="tyh-gallery-side">'
        +'<button type="button" data-open-gallery data-gallery-index="1"><img src="'+attr(sideA)+'" alt="" loading="lazy"></button>'
        +'<button type="button" class="tyh-gallery-more-wrap" data-open-gallery data-gallery-index="2">'
          +'<img src="'+attr(sideB)+'" alt="" loading="lazy">'
          +(more>0?'<span class="tyh-gallery-more">+'+esc(String(more))+' photos</span>':'')
        +'</button>'
      +'</div>'
    +'</div>';
  }
  const hasMore=count>1;
  const countText='+'+esc(String(count))+' Photos';
  const mainImg=(hasMore?'<div data-open-gallery data-gallery-index="0" style="cursor:pointer">':'')
    +'<img src="'+attr(main)+'" alt="'+attr(h.name)+'" loading="eager">'
    +(hasMore?'</div>':'')
    +'<div class="tyh-gallery-badge">'+countText+'</div>';
  if(!hasMore){
    return '<div style="position:relative"><div class="tyh-detail-img" style="height:auto;min-height:240px">'+mainImg+'</div></div>';
  }
  const thumbs=imgs.slice(1,3);
  const remaining=count-1-thumbs.length;
  const thumbsHtml=thumbs.map(function(u,ti){
    const idx=1+ti;
    const isLastThumb=ti===thumbs.length-1;
    const overlay=(remaining>0 && isLastThumb)
      ? '<div class="tyh-thumb-more">'+(remaining+1)+' Photos →</div>'
      : '';
    return '<div data-open-gallery data-gallery-index="'+idx+'" class="tyh-thumb">'+overlay+'<img src="'+attr(u)+'" alt="" loading="lazy"></div>';
  }).join('');
  const viewAll='<button type="button" data-open-gallery data-gallery-index="0" class="tyh-view-all-photos">View All Photos</button>';
  return '<div style="position:relative">'
    +'<div class="tyh-detail-img" style="height:auto;min-height:240px;position:relative">'+mainImg+'</div>'
    +'<div class="tyh-mobile-thumbs">'+thumbsHtml+viewAll+'</div>'
  +'</div>';
}
function galleryHtml(h){
  if(!S.ui.galleryOpen) return '';
  const imgs=allHotelImages(h);
  if(imgs.length<=1) return '';
  const idx=Math.max(0,Math.min(imgs.length-1,Number(S.ui.galleryIndex||0)));
  const prevDisabled=idx<=0;
  const nextDisabled=idx>=imgs.length-1;
  return '<div class="tyh-modal-bg" data-gallery-close></div>'+
    '<section class="tyh-gallery-modal" role="dialog" aria-label="Hotel photos">'+
      '<header><div>'+(idx+1)+' / '+imgs.length+'</div><button type="button" data-gallery-close aria-label="Close">×</button></header>'+
      '<div data-gallery-stage class="tyh-gallery-stage">'+
        '<button type="button" data-gallery-prev '+(prevDisabled?'disabled':'')+'>‹</button>'+
        '<img src="'+attr(imgs[idx])+'" alt="'+attr(h.name||'Hotel')+'">'+
        '<button type="button" data-gallery-next '+(nextDisabled?'disabled':'')+'>›</button>'+
      '</div>'+
    '</section>';
}
function roomGalleryHtml(h){
  const rg=S.ui.roomGallery||{};
  if(!rg.open||!rg.optionId) return '';
  const opt=optionList(h).find(function(o){ return realOptionId(o)===String(rg.optionId); });
  if(!opt) return '';
  const imgs=roomImagesOf(opt,h);
  if(!imgs.length) return '';
  const idx=Math.max(0,Math.min(imgs.length-1,Number(rg.index||0)));
  const prevDisabled=idx<=0;
  const nextDisabled=idx>=imgs.length-1;
  const cap=roomCapacityMax(opt);
  const amens=roomAmenitiesList(opt);
  const popular=amens.slice(0,4);
  const moreN=Math.max(0, amens.length-popular.length);
  return '<div class="tyh-modal-bg" data-room-gallery-close></div>'+
    '<section class="tyh-gallery-modal tyh-room-gallery" role="dialog" aria-label="Room photos">'+
      '<header>'+
        '<div><strong>'+esc(opt.roomSummary||opt.roomType||'Room')+'</strong>'+
          (cap>0?'<span class="tyh-muted"> · Fits max '+esc(String(cap))+'</span>':'')+
          '<div class="tyh-muted" style="font-size:12px;margin-top:2px">'+(idx+1)+' / '+imgs.length+'</div>'+
        '</div>'+
        '<button type="button" data-room-gallery-close aria-label="Close">×</button>'+
      '</header>'+
      '<div data-room-gallery-stage class="tyh-gallery-stage">'+
        '<button type="button" data-room-gallery-prev '+(prevDisabled?'disabled':'')+'>‹</button>'+
        '<img src="'+attr(imgs[idx])+'" alt="">'+
        '<button type="button" data-room-gallery-next '+(nextDisabled?'disabled':'')+'>›</button>'+
      '</div>'+
      (popular.length?'<div class="tyh-room-gallery-amens"><span class="tyh-muted">Popular with Guests</span><div class="tyh-facilities">'+popular.map(function(a){ return '<span>'+esc(a)+'</span>'; }).join('')+(moreN?'<span>+'+esc(String(moreN))+' More</span>':'')+'</div></div>':'')+
    '</section>';
}
function hotelDetailSheetHtml(){
  if(!S.ui.sheet) return '';
  const title=String(S.ui.sheet.title||'Details');
  const body=String(S.ui.sheet.body||'');
  return '<div class="tyh-modal-bg" data-sheet-close></div>'+
    '<section class="tyh-sheet-modal" role="dialog">'+
      '<header><div>'+esc(title)+'</div><button type="button" data-sheet-close aria-label="Close">×</button></header>'+
      '<div class="tyh-sheet-body">'+body+'</div>'+
    '</section>';
}
function openHotelGalleryAt(i){
  const h=S.detailHotel||{};
  const imgs=allHotelImages(h);
  if(imgs.length<=1) return;
  S.ui.galleryOpen=true;
  S.ui.galleryIndex=Math.max(0,Math.min(imgs.length-1,Number(i||0)));
  S.ui.sheet=null;
  S.ui.roomGallery={open:false,optionId:'',index:0};
  document.body.classList.add('tyh-modal-lock');
  renderHotelDetailsPlumbing();
}
function closeHotelGallery(){
  S.ui.galleryOpen=false;
  S.ui.galleryIndex=0;
  document.body.classList.remove('tyh-modal-lock');
  renderHotelDetailsPlumbing();
}
function openRoomGallery(optionId, index){
  const h=S.detailHotel||{};
  const oid=String(optionId||'').trim();
  if(!oid) return;
  const opt=optionList(h).find(function(o){ return realOptionId(o)===oid; });
  if(!opt) return;
  const imgs=roomImagesOf(opt,h);
  if(!imgs.length) return;
  S.ui.roomGallery={open:true,optionId:oid,index:Math.max(0,Math.min(imgs.length-1,Number(index||0)))};
  S.ui.galleryOpen=false;
  S.ui.sheet=null;
  document.body.classList.add('tyh-modal-lock');
  renderHotelDetailsPlumbing();
}
function closeRoomGallery(){
  S.ui.roomGallery={open:false,optionId:'',index:0};
  document.body.classList.remove('tyh-modal-lock');
  renderHotelDetailsPlumbing();
}
function refreshCurrentHotelStep(){
  const step=currentStep();
  if(step==='guest' || step==='review') renderGuestStep();
  else if(step==='hotel-details') renderHotelDetailsPlumbing();
  else if(S.shown&&S.shown.length) renderResults();
  else renderHotelDetailsPlumbing();
}
function openHotelSheet(title, bodyHtml){
  S.ui.sheet={title:title, body:bodyHtml||''};
  S.ui.galleryOpen=false;
  S.ui.roomGallery={open:false,optionId:'',index:0};
  mountHotelSheetPortal();
}
function closeHotelSheet(){
  S.ui.sheet=null;
  unmountHotelSheetPortal();
  document.body.classList.remove('tyh-modal-lock');
}
function unmountHotelSheetPortal(){
  const el=document.getElementById('tyhSheetPortal');
  if(el&&el.parentNode) el.parentNode.removeChild(el);
}
function mountHotelSheetPortal(){
  unmountHotelSheetPortal();
  if(!S.ui.sheet) return;
  const wrap=document.createElement('div');
  wrap.id='tyhSheetPortal';
  wrap.innerHTML=hotelDetailSheetHtml();
  document.body.appendChild(wrap);
  document.body.classList.add('tyh-modal-lock');
  qa('[data-sheet-close]',wrap).forEach(function(b){
    b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); closeHotelSheet(); };
  });
  wrap.addEventListener('keydown', function(e){
    if(e.key==='Escape'){ e.preventDefault(); closeHotelSheet(); }
  });
  try{ wrap.setAttribute('tabindex','-1'); wrap.focus({preventScroll:true}); }catch(e){}
}
function renderHotelDetailsPlumbing(){
  const h=S.detailHotel;
  if(!h){
    shell('<main class="tyh-empty"><h2>Hotel not found</h2><p>Please return to results and choose a hotel from this search.</p><button type="button" data-back-results>Back to results</button></main>',{title:'Hotel details'});
    const b=q('[data-back-results]',root); if(b) b.onclick=function(){ setPage('results'); renderResults(); };
    return;
  }
  const desktop=!isMobileHotelUi();
  const starN=Math.round(Number(h.star||0));
  const stars=starN>0?'<div class="tyh-stars" aria-label="'+esc(starN)+' star">'+"★".repeat(Math.max(0,Math.min(5,starN)))+'</div>':'';
  const location=hotelAddressText(h);
  const facilities=arr(h.amenities).filter(Boolean);
  const desc=hotelDescription(h);
  const roomsHtml=roomRatesHtml(h);
  const times=hotelCheckTimes(h);
  const rec=recommendedBookOption(h);
  const s=S.search||{};
  const ci=s.checkIn||s.checkinDate;
  const co=s.checkOut||s.checkoutDate;
  const ratingN=Number(h.rating||0);
  const ratingCount=Number(h.ratingCount||0);
  const ratingBlock=(Number.isFinite(ratingN)&&ratingN>0)
    ? '<div class="tyh-book-rating"><strong>'+esc(String(ratingN.toFixed?ratingN.toFixed(1):ratingN))+'</strong>'+(ratingCount>0?'<span>'+esc(String(ratingCount))+' ratings</span>':'')+'</div>'
    : '';

  let mapHref='';
  const lat=Number(h.latitude!=null?h.latitude:(h.lat!=null?h.lat:NaN));
  const lng=Number(h.longitude!=null?h.longitude:(h.lng!=null?h.lng:NaN));
  if(Number.isFinite(lat)&&Number.isFinite(lng)){
    mapHref='https://www.openstreetmap.org/?mlat='+encodeURIComponent(lat)+'&mlon='+encodeURIComponent(lng)+'#map=17/'+encodeURIComponent(lat)+'/'+encodeURIComponent(lng);
  }
  const mapAction=mapHref
    ? '<a class="tyh-map-link" href="'+attr(mapHref)+'" target="_blank" rel="noopener">Show on map</a>'
    : '';

  const aboutSections=hotelAboutSectionsHtml(h);
  const aboutFull=aboutSections || (desc?('<p class="tyh-desc">'+esc(desc)+'</p>'):'');
  const aboutBlock=aboutFull
    ? '<section class="tyh-panel tyh-about"><h2>About this property</h2><div class="tyh-about-body'+(S.ui.aboutExpanded?' is-open':'')+'" data-about-body>'+aboutFull+'</div>'
      +'<button type="button" class="tyh-linkish" data-toggle-about>'+(S.ui.aboutExpanded?'Show less':'Show more')+'</button>'
    +'</section>'
    : '';

  const amenLimit=8;
  const amenShort=facilities.slice(0,amenLimit);
  const amenMore=facilities.length>amenLimit;
  const amenBlock=facilities.length
    ? '<section class="tyh-panel"><h2>Amenities</h2><div class="tyh-facilities">'+amenShort.map(function(a){ return '<span>'+esc(a)+'</span>'; }).join('')+'</div>'
      +(amenMore?'<button type="button" class="tyh-linkish" data-open-hotel-sheet="amenities">View more</button>':'')
    +'</section>'
    : '';

  const hero=hotelHeroHtml(h);
  const titleBlock='<div class="tyh-title-block">'
    +'<div class="tyh-title-row"><h2>'+esc(h.name)+'</h2>'+stars+'</div>'
    +(location?'<p class="tyh-location">'+esc(location)+'</p>':'')
    +mapAction
  +'</div>';

  let bookBox='';
  if(rec&&hasPricingReviewContext(h)){
    const rid=realOptionId(rec);
    const occ=roomOccupancyText(rec);
    bookBox='<aside class="tyh-book-box">'
      +'<div class="tyh-book-box-room"><b>'+esc(rec.roomSummary||rec.roomType||'Recommended room')+'</b>'
        +(rid?'<button type="button" class="tyh-view-more-link" data-scroll-rooms>View details</button>':'')
        +(occ?'<p>'+esc(occ)+'</p>':'')
        +(rec.mealBasis?'<p class="tyh-muted">• '+esc(rec.mealBasis)+'</p>':'')
      +'</div>'
      +'<div class="tyh-book-box-price"><strong>'+esc(money(hotelBaseFareAmount(rec, h)||rec.displayTotal||rec.resultDisplayAmount||rec.totalPrice))+'</strong><em>Total price for 1 room</em></div>'
      +(rid?'<button type="button" class="tyh-cta" data-review-room="'+attr(rid)+'">Book Now</button>':'')
      +'<div class="tyh-book-more"><span>More options available</span><button type="button" class="tyh-view-rooms-btn" data-scroll-rooms>View all rooms ▾</button></div>'
      +ratingBlock
      +((times.checkIn||times.checkOut)
        ? '<div class="tyh-book-times">'
          +(times.checkIn?'<div class="tyh-kv"><span>Check-in from</span><b>'+esc(times.checkIn)+'</b></div>':'')
          +(times.checkOut?'<div class="tyh-kv"><span>Check-out until</span><b>'+esc(times.checkOut)+'</b></div>':'')
        +'</div>'
        : '')
    +'</aside>';
  } else if(desktop){
    bookBox='<aside class="tyh-book-box"><p class="tyh-muted">'+(S.detailStatus==='loading'?'Loading live rates…':'Live rates will appear here once ready.')+'</p>'
      +((ci||co)?'<div class="tyh-kv"><span>Stay</span><b>'+esc([fmtDate(ci),fmtDate(co)].filter(Boolean).join(' → '))+'</b></div>':'')
      +ratingBlock+'</aside>';
  }

  const galleryRow=desktop
    ? ('<div class="tyh-detail-hero-row">'+'<div class="tyh-detail-gallery-wrap">'+hero+'</div>'+bookBox+'</div>')
    : (hero+(bookBox?'<div class="tyh-book-box-mobile">'+bookBox+'</div>':''));

  const content=modifySearchBar()
    +'<main class="tyh-details-plumb'+(desktop?' tyh-detail-desk':' tyh-detail-mob')+'">'
      +'<article class="tyh-detail">'
        +'<div class="tyh-detail-body tyh-detail-body-top">'+titleBlock+'</div>'
        +galleryRow
        +'<div class="tyh-detail-body">'
          +aboutBlock
          +amenBlock
          +roomsHtml
        +'</div>'
      +'</article>'
    +'</main>'
    +galleryHtml(h)
    +roomGalleryHtml(h);

  shell(content,{title:h.name||'Hotel details', sub:'Hotel details'});
  bindResults();
  qa('[data-review-room]',root).forEach(function(b){ b.onclick=function(){ startReview(S.detailHotel||h,b.dataset.reviewRoom); }; });
  const retry=q('[data-retry-detail]');
  if(retry) retry.onclick=function(){ const hotel=S.detailHotel||h; if(hotel) loadHotelPricing(hotel); };
  bindHotelDetailExtras();
}
function bindHotelDetailExtras(){
  qa('[data-open-gallery]',root).forEach(function(b){
    b.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      openHotelGalleryAt(Number(b.dataset.galleryIndex||0));
    };
  });

  const prev=q('[data-gallery-prev]',root);
  if(prev) prev.onclick=function(){ if(prev.disabled) return; openHotelGalleryAt(Number(S.ui.galleryIndex||0)-1); };
  const next=q('[data-gallery-next]',root);
  if(next) next.onclick=function(){ if(next.disabled) return; openHotelGalleryAt(Number(S.ui.galleryIndex||0)+1); };
  qa('[data-gallery-close]',root).forEach(function(b){
    b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); closeHotelGallery(); };
  });

  const stage=q('[data-gallery-stage]',root);
  if(stage){
    let startX=0, startY=0, touched=false;
    stage.addEventListener('touchstart',function(e){
      const t=(e.changedTouches&&e.changedTouches[0])||null;
      if(!t) return;
      startX=t.clientX; startY=t.clientY; touched=true;
    },{passive:true});
    stage.addEventListener('touchend',function(e){
      if(!touched) return;
      touched=false;
      const t=(e.changedTouches&&e.changedTouches[0])||null;
      if(!t) return;
      const dx=t.clientX-startX;
      const dy=t.clientY-startY;
      if(Math.abs(dx)<40 || Math.abs(dx)<Math.abs(dy)) return;
      if(dx<0) openHotelGalleryAt(Number(S.ui.galleryIndex||0)+1);
      else openHotelGalleryAt(Number(S.ui.galleryIndex||0)-1);
    });
  }

  qa('[data-open-room-gallery]',root).forEach(function(b){
    b.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      openRoomGallery(b.getAttribute('data-open-room-gallery')||b.dataset.openRoomGallery||'');
    };
  });
  const rprev=q('[data-room-gallery-prev]',root);
  if(rprev) rprev.onclick=function(){
    if(rprev.disabled) return;
    const rg=S.ui.roomGallery||{};
    openRoomGallery(rg.optionId, Number(rg.index||0)-1);
  };
  const rnext=q('[data-room-gallery-next]',root);
  if(rnext) rnext.onclick=function(){
    if(rnext.disabled) return;
    const rg=S.ui.roomGallery||{};
    openRoomGallery(rg.optionId, Number(rg.index||0)+1);
  };
  qa('[data-room-gallery-close]',root).forEach(function(b){
    b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); closeRoomGallery(); };
  });
  const rstage=q('[data-room-gallery-stage]',root);
  if(rstage){
    let sx=0, sy=0, touched=false;
    rstage.addEventListener('touchstart',function(e){
      const t=(e.changedTouches&&e.changedTouches[0])||null;
      if(!t) return;
      sx=t.clientX; sy=t.clientY; touched=true;
    },{passive:true});
    rstage.addEventListener('touchend',function(e){
      if(!touched) return;
      touched=false;
      const t=(e.changedTouches&&e.changedTouches[0])||null;
      if(!t) return;
      const dx=t.clientX-sx, dy=t.clientY-sy;
      if(Math.abs(dx)<40 || Math.abs(dx)<Math.abs(dy)) return;
      const rg=S.ui.roomGallery||{};
      if(dx<0) openRoomGallery(rg.optionId, Number(rg.index||0)+1);
      else openRoomGallery(rg.optionId, Number(rg.index||0)-1);
    });
  }

  if(!window.__tyhGalleryKeysBound){
    window.__tyhGalleryKeysBound=true;
    document.addEventListener('keydown',function(e){
      if(currentStep()!=='hotel-details') return;
      if(S.ui.roomGallery&&S.ui.roomGallery.open){
        if(e.key==='Escape'){ closeRoomGallery(); return; }
        if(e.key==='ArrowLeft'){ openRoomGallery(S.ui.roomGallery.optionId, Number(S.ui.roomGallery.index||0)-1); return; }
        if(e.key==='ArrowRight'){ openRoomGallery(S.ui.roomGallery.optionId, Number(S.ui.roomGallery.index||0)+1); return; }
      }
      if(S.ui.galleryOpen){
        if(e.key==='Escape'){ closeHotelGallery(); return; }
        if(e.key==='ArrowLeft'){ openHotelGalleryAt(Number(S.ui.galleryIndex||0)-1); return; }
        if(e.key==='ArrowRight'){ openHotelGalleryAt(Number(S.ui.galleryIndex||0)+1); return; }
      }
    });
  }

  qa('[data-sheet-close]',root).forEach(function(b){
    b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); closeHotelSheet(); };
  });

  qa('[data-open-hotel-sheet]',root).forEach(function(b){
    b.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      const type=String(b.dataset.openHotelSheet||'');
      const hh=S.detailHotel||{};
      if(type==='description'){
        const full=hotelDescription(hh)||'';
        openHotelSheet('About this property', full?('<p style="margin:0;white-space:pre-wrap">'+esc(full)+'</p>'):'<p class="tyh-muted">No description available.</p>');
        return;
      }
      if(type==='amenities'){
        const list=arr(hh.amenities).filter(Boolean);
        openHotelSheet('Amenities & facilities', list.length?'<div class="tyh-facilities">'+list.map(function(a){ return '<span>'+esc(a)+'</span>'; }).join('')+'</div>':'<p class="tyh-muted">No amenities available.</p>');
        return;
      }
      if(type==='policies'){
        const pol=policiesOf(hh)||{};
        const polRaw=[].concat(arr(pol.instructions),arr(pol.specialInstructions),arr(pol.knowBeforeYouGo)).filter(Boolean);
        const texts=polRaw.map(function(x){ return customerSafeNote(String(x && (x.msg||x.text||x.description||x.type||x))); }).filter(Boolean);
        openHotelSheet('Hotel policies', texts.length?texts.map(function(t){ return '<p style="margin:0 0 10px">'+esc(t)+'</p>'; }).join(''):'<p class="tyh-muted">No policies available.</p>');
      }
    };
  });

  qa('[data-open-cancel-sheet]',root).forEach(function(b){
    b.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      const optId=String(b.dataset.openCancelSheet||'');
      const hh=S.detailHotel||{};
      const opt=optionList(hh).find(function(o){ return realOptionId(o)===optId; });
      const body=(opt?cancellationPolicyBody(opt):'<p class="tyh-muted">Cancellation details unavailable.</p>');
      openHotelSheet('Room with Cancellation Policy', body);
    };
  });
  qa('[data-open-room-amenities]',root).forEach(function(b){
    b.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      const optId=String(b.getAttribute('data-open-room-amenities')||'');
      const hh=S.detailHotel||{};
      const opt=optionList(hh).find(function(o){ return realOptionId(o)===optId; });
      const list=opt?roomAmenitiesList(opt):[];
      openHotelSheet('Room amenities', list.length?'<ul class="tyh-rate-amens">'+list.map(function(a){ return '<li>✓ '+esc(a)+'</li>'; }).join('')+'</ul>':'<p class="tyh-muted">No amenity details were returned for this room.</p>');
    };
  });

  qa('[data-toggle-more-options]',root).forEach(function(b){
    b.onclick=function(){
      const key=String(b.dataset.toggleMoreOptions||'');
      const target=q('[data-more-options-content="'+key+'"]',root);
      if(!target) return;
      target.hidden=!target.hidden;
    };
  });

  const aboutBtn=q('[data-toggle-about]',root);
  if(aboutBtn) aboutBtn.onclick=function(){
    S.ui.aboutExpanded=!S.ui.aboutExpanded;
    renderHotelDetailsPlumbing();
  };

  const roomQuery=q('[data-room-query]',root);
  if(roomQuery){
    roomQuery.oninput=function(){
      S.ui.roomQuery=String(roomQuery.value||'');
      clearTimeout(S.ui.roomQueryTimer);
      S.ui.roomQueryTimer=setTimeout(function(){
        const keep=S.ui.roomQuery;
        renderHotelDetailsPlumbing();
        const n=q('[data-room-query]',root);
        if(n){ n.focus(); n.value=keep; try{ n.setSelectionRange(keep.length,keep.length);}catch(e){} }
      },160);
    };
  }
  qa('[data-room-filter]',root).forEach(function(b){
    b.onclick=function(){
      S.ui.roomFilter=String(b.dataset.roomFilter||'all');
      renderHotelDetailsPlumbing();
    };
  });
  qa('[data-scroll-rooms]',root).forEach(function(b){
    b.onclick=function(){
      const el=q('#tyhRoomTypes',root)||q('.tyh-rooms-block',root);
      if(el) try{ el.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){ el.scrollIntoView(true); }
    };
  });
}
function openHotelDetails(h){
  const id=String((h&& (h.hotelId||h.id))||'');
  if(!id) return;
  S.detailHotel=h;
  S.detailStatus='loading';
  S.detailError='';
  S.ui.aboutExpanded=false;
  S.ui.roomQuery='';
  S.ui.roomFilter='all';
  S.ui.roomGallery={open:false,optionId:'',index:0};
  save(KEY.selectedListing,{
    hotel:h,
    search:Object.assign({}, S.search, {searchContext:(h&&h.searchContext)||(S.search&&S.search.searchContext)||{}}),
    at:Date.now()
  });
  setPage('hotel-details','hotelId='+encodeURIComponent(id));
  renderHotelDetailsPlumbing();
  loadHotelPricing(h);
}
function tyhStillOnHotelDetails(hotelId){
  if(currentStep()!=='hotel-details') return false;
  if(hotelId==null || hotelId==='') return true;
  return String(new URLSearchParams(location.search).get('hotelId')||'')===String(hotelId);
}
function applyPricedHotel(listingHotel, merged){
  const id=realHotelId(listingHotel);
  if(!merged || realHotelId(merged)!==id) return;
  if(!tyhStillOnHotelDetails(id)) return;
  merged=mergeHotelKeepMedia(listingHotel, merged);
  S.detailHotel=merged;
  S.roomHotel=null;
  S.detailStatus='ready';
  S.detailError='';
  renderHotelDetailsPlumbing();
}
function mergeHotelKeepMedia(prev, next){
  prev=prev||{}; next=next||{};
  const merged=Object.assign({}, prev, next);
  const prevImgs=allHotelImages(prev);
  const nextImgs=allHotelImages(next);
  const imgs=nextImgs.length?nextImgs:prevImgs;
  if(imgs.length){
    merged.images=imgs;
    merged.image=String(next.image||prev.image||imgs[0]||'').trim()||imgs[0];
  }
  const prevAddr=hotelAddressText(prev);
  const nextAddr=hotelAddressText(merged);
  if(prevAddr && prevAddr.length>String(nextAddr||'').length){
    merged.address=prev.address||prevAddr;
  }
  if(!(Number(merged.star)>0) && Number(prev.star)>0) merged.star=prev.star;
  // Preserve real check-in/out policy payloads from the richer source.
  if(prev.policies && (!merged.policies || typeof merged.policies!=='object')) merged.policies=prev.policies;
  else if(prev.policies && merged.policies) merged.policies=Object.assign({}, prev.policies, merged.policies);
  if(prev.checkInFrom && !merged.checkInFrom) merged.checkInFrom=prev.checkInFrom;
  if(prev.checkOutFrom && !merged.checkOutFrom) merged.checkOutFrom=prev.checkOutFrom;
  // Keep raw media payloads from the richer of the two sources
  if(prev.raw && (!merged.raw || !allHotelImages({raw:merged.raw}).length) && prevImgs.length){
    merged.raw=Object.assign({}, merged.raw||{}, {
      images:(merged.raw&&merged.raw.images)||(prev.raw&&prev.raw.images),
      imgs:(merged.raw&&merged.raw.imgs)||(prev.raw&&prev.raw.imgs),
      hInfo:Object.assign({}, (prev.raw&&prev.raw.hInfo)||{}, (merged.raw&&merged.raw.hInfo)||{}),
      content:Object.assign({}, (prev.raw&&prev.raw.content)||{}, (merged.raw&&merged.raw.content)||{}),
      policies:(merged.raw&&merged.raw.policies)||(prev.raw&&prev.raw.policies)
    });
  } else if(prev.raw && merged.raw){
    merged.raw=Object.assign({}, prev.raw, merged.raw, {
      content:Object.assign({}, (prev.raw&&prev.raw.content)||{}, (merged.raw&&merged.raw.content)||{}),
      policies:(merged.raw&&merged.raw.policies)||(prev.raw&&prev.raw.policies),
      hInfo:Object.assign({}, (prev.raw&&prev.raw.hInfo)||{}, (merged.raw&&merged.raw.hInfo)||{})
    });
  }
  return merged;
}
async function loadHotelPricing(h){
  const id=realHotelId(h);
  S.detailStatus='loading';
  S.detailError='';
  if(tyhStillOnHotelDetails(id)) renderHotelDetailsPlumbing();
  const merged=await openRooms(h, true);
  if(!tyhStillOnHotelDetails(id)) return;
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
    const keepY=isMobileHotelUi()?window.scrollY||0:0;
    const natEl=q('[data-search-nationality]',root);
    const resEl=q('[data-search-residence]',root);
    persistHotelSearch({
      checkIn:dates.checkIn, checkOut:dates.checkOut,
      roomCount:guestState().rooms, adults:guestState().adults, children:guestState().children,
      nationality:(natEl&&natEl.value)||searchNationality(),
      countryOfResidence:(resEl&&resEl.value)||searchResidenceCountry()
    });
    S.ui.calOpen=false; S.ui.cityOpen=false; S.ui.guestOpen=false; S.ui.editSearchOpen=false;
    S.resultsScrollY=keepY;
    setPage('results');
    loadResults().then(function(){
      if(keepY){ try{ window.scrollTo(0, keepY); }catch(err){} }
    });
  };
  qa('[data-open-edit-search]',root).forEach(function(b){
    b.onclick=function(){
      S.resultsScrollY=window.scrollY||0;
      S.ui.editSearchOpen=true;
      S.ui.calOpen=false; S.ui.cityOpen=false; S.ui.guestOpen=false;
      renderResults();
    };
  });
  qa('[data-edit-search-close]',root).forEach(function(b){
    b.onclick=function(){
      S.ui.editSearchOpen=false;
      S.ui.calOpen=false; S.ui.cityOpen=false; S.ui.guestOpen=false;
      renderResults();
      if(S.resultsScrollY){ try{ window.scrollTo(0, S.resultsScrollY); }catch(e){} }
    };
  });
  qa('[data-search-nationality]',root).forEach(function(sel){
    sel.onchange=function(){
      persistHotelSearch({nationality:sel.value||'IN'});
    };
  });
  qa('[data-search-residence]',root).forEach(function(sel){
    sel.onchange=function(){
      persistHotelSearch({countryOfResidence:sel.value||'IN', residenceCountry:sel.value||'IN'});
    };
  });
  qa('[data-open-city]',root).forEach(function(b){ b.onclick=function(){
    S.ui.cityOpen=true; S.ui.calOpen=false; S.ui.guestOpen=false;
    if(!arr(S.ui.cityRows).length) S.ui.cityStatus='Type a location and select an exact suggestion.';
    else S.ui.cityStatus='';
    rerenderKeepUi();
    const inp=q('[data-city-input]',root); if(inp) try{ inp.focus(); }catch(e){}
    // Prefetch suggestions only when the field already has text — never block opening.
    const qv=String(S.ui.cityQuery||S.search&&(S.search.cityName||S.search.city)||'').trim();
    if(qv){
      S.ui.cityQuery=qv;
      fetchHotelCities(qv).then(function(rows){
        if(!S.ui.cityOpen) return;
        if(String(S.ui.cityQuery||'')!==qv) return;
        S.ui.cityRows=rows;
        S.ui.cityStatus=rows.length?'':'Type a location and select an exact suggestion.';
        rerenderKeepUi();
        const n=q('[data-city-input]',root); if(n){ n.focus(); n.value=qv; }
      }).catch(function(){});
    }
  }; });
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
  qa('[data-open-sort],[data-mobile-sort]',root).forEach(function(b){ b.onclick=function(){ if(currentStep()==='hotel-details') return; document.body.classList.add('tyh-sort-open'); renderResults(); }; });
  qa('[data-sort-close]',root).forEach(function(b){ b.onclick=closeSort; });
  qa('a.tyh-card-main[data-hotel-open], article.tyh-card[data-hotel-id] a.tyh-card-main',root).forEach(function(a){
    a.onclick=function(ev){
      if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey||ev.button) return;
      ev.preventDefault();
      ev.stopPropagation();
      const card=a.closest('article.tyh-card[data-hotel-id]')||a;
      const hid=String(a.getAttribute('data-hotel-open')||card.getAttribute('data-hotel-id')||'').trim();
      if(!hid) return;
      const h=hotelByRealId(hid);
      if(h){ openHotelDetails(h); return; }
      // Fallback: persist URL hotelId even if live list lookup missed (string/type edge cases).
      openHotelDetails({hotelId:hid,id:hid,tjHotelId:hid,name:card.querySelector('h2')&&card.querySelector('h2').textContent||'Hotel',searchContext:(S.search&&S.search.searchContext)||{}});
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
let hotelDetailLock=null;
async function openRooms(h, silent){
  if(!silent){ S.roomHotel=h; paintHotelView(); }
  const id=realHotelId(h);
  const lockKey=String(id||'')+'|'+(String((h.searchContext&&h.searchContext.correlationId)||(S.search.searchContext&&S.search.searchContext.correlationId)||''));
  if(hotelDetailLock && hotelDetailLock.key===lockKey) return hotelDetailLock.promise;
  const job={key:lockKey, promise:null};
  job.promise=(async function(){
  try{
    if(!silent) showLoader('Loading room options…');
    const context=h.searchContext||S.search.searchContext||{};
    const hid=id;
    const res=await api('/api/hotels/detail',{hid:hid,hotelId:hid,searchContext:context});
    if(silent && !tyhStillOnHotelDetails(hid)) return null;
    const d=unwrap(res)||{};
    const reviewHash=String(d.reviewHash||(d.hotel&&d.hotel.reviewHash)||'').trim();
    const priced=d.hotel||{};
    const detailHotel=normHotel(Object.assign({},priced,{hotelId:priced.hotelId||priced.tjHotelId||hid,tjHotelId:priced.tjHotelId||priced.hotelId||hid,reviewHash:reviewHash,searchContext:d.searchContext||context,policies:priced.policies||d.policies||h.policies,raw:d.raw||priced.raw||d}),0);
    const merged=Object.assign({},h,{
      key:h.key,
      hotelId:hid,
      id:hid,
      tjHotelId:hid,
      options:detailHotel.options,
      price:detailHotel.price||h.price,
      reviewHash:reviewHash,
      searchContext:d.searchContext||context,
      raw:detailHotel.raw,
      policies:detailHotel.policies||priced.policies||d.policies||h.policies,
      images:(allHotelImages(detailHotel).length?allHotelImages(detailHotel):allHotelImages(h)),
      image:detailHotel.image||h.image||imageOf(h),
      amenities:(arr(detailHotel.amenities).length?detailHotel.amenities:h.amenities),
      address:hotelAddressText(detailHotel)||hotelAddressText(h)||h.address,
      star:detailHotel.star||h.star
    }, detailHotel, {hotelId:hid,id:hid,tjHotelId:hid,reviewHash:reviewHash,options:detailHotel.options,searchContext:d.searchContext||context,
      images:(allHotelImages(detailHotel).length?allHotelImages(detailHotel):allHotelImages(h)),
      policies:detailHotel.policies||priced.policies||d.policies||h.policies});
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
    if(silent && !tyhStillOnHotelDetails(id)) return null;
    hideLoader();
    S.detailStatus='error';
    S.detailError=friendlyError(e);
    if(isHotelRateLimitErr(e) || isHotelExpiredSearchErr(e)){
      await handleHotelApiFailureModal(e, 'detail');
      if(tyhStillOnHotelDetails(id)) renderHotelDetailsPlumbing();
      return null;
    }
    if(!silent){
      const rb=q('.tyh-room-body',root);
      if(rb) rb.innerHTML='<p class="tyh-muted">'+esc(S.detailError)+'</p><button type="button" data-retry-detail>Try again</button>';
    }else if(tyhStillOnHotelDetails(id)){
      renderHotelDetailsPlumbing();
    }
    return null;
  }finally{
    hideLoader();
    if(hotelDetailLock===job) hotelDetailLock=null;
  }
  })();
  hotelDetailLock=job;
  return job.promise;
}
function roomSheet(h){
  return '<div class="tyh-modal-bg" data-close></div><section class="tyh-room"><header><div><h2>'+esc(h.name)+'</h2><p>'+esc(h.address||h.area||'')+'</p></div><button type="button" data-close>×</button></header><div class="tyh-room-body">'+roomRatesHtml(h)+'</div></section>';
}
function isHotelReviewUnavailableErr(err){
  if(!err) return false;
  if(isHotelRateLimitErr(err) || isHotelExpiredSearchErr(err)) return false;
  const code=String((err.data&&err.data.code)||err.code||'').toUpperCase();
  if(/NO_AVAIL|SOLD_OUT|UNAVAILABLE|NOT_AVAILABLE|OPTION_EXPIRED|REVIEW_FAILED|HOTEL_NO_AVAIL|HOTEL_OPTION|ROOM_SOLD|OPTION_NOT/i.test(code)) return true;
  if(Number(err.status)===404) return true;
  if(Number(err.status)===409 && /CONTEXT|EXPIRED|SEARCH/i.test(code)) return false;
  if(Number(err.status)===409) return true;
  const m=String(err.message||'').toLowerCase();
  return /sold out|no longer available|not available|option expired|unavailable|could not be completed/i.test(m);
}
async function fetchHotelReview(hotelCtx, optionId){
  const context=Object.assign({}, S.search.searchContext||{}, hotelCtx.searchContext||{});
  if(!context.correlationId || !(context.checkIn||context.checkinDate) || !(context.checkOut||context.checkoutDate)){
    const missing=new Error('Your hotel search session expired. Please search again, then continue.');
    missing.code='HOTEL_SEARCH_CONTEXT_REQUIRED';
    missing.status=409;
    throw missing;
  }
  const hid=realHotelId(hotelCtx);
  const oid=realOptionId({optionId:optionId,id:optionId});
  const res=await api('/api/hotels/review',{hid:hid,hotelId:hid,optionId:oid,reviewHash:realReviewHash(hotelCtx),searchContext:context,correlationId:context.correlationId});
  return {
    res:res,
    raw:res.raw||res.review&&res.review.raw||res,
    reviewData:res.review||{},
    context:context,
    hid:hid,
    oid:oid
  };
}
function buildHotelReviewOutcome(reviewPack, selectedBefore, hotelCtx, currentAuthAmount){
  const res=reviewPack.res;
  const raw=reviewPack.raw;
  const reviewData=reviewPack.reviewData;
  const context=reviewPack.context;
  const hid=reviewPack.hid;
  const oid=reviewPack.oid;
  const reviewedHotel=reviewData.hotel ? normHotel(Object.assign({},reviewData.hotel,{searchContext:res.searchContext||context,reviewHash:realReviewHash(hotelCtx)}),0) : hotelCtx;
  const reviewedOption=reviewData.option ? normOption(reviewData.option, reviewedHotel, 0) : selectedBefore;
  const reviewBookingId=reviewData.bookingId||raw.bookingId||res.bookingId||'';
  // Compare customer PAYABLE (canonical), never supplier totalPrice vs markup sell.
  const beforeTicket=hotelMoneyRound(Math.max(0, Number(currentAuthAmount||0)||hotelTicketSellAmount(selectedBefore, hotelCtx)||priceOf(selectedBefore, hotelCtx)));
  const newTicket=resolveReviewedCustomerSell(reviewData.option||reviewedOption, selectedBefore, hotelCtx, beforeTicket);
  const feeBeforeRaw=hotelRawFeeAmount(selectedBefore, hotelCtx);
  const feeBefore=hotelMoneyRound(feeBeforeRaw);
  let feeAfterRaw=hotelRawFeeAmount(Object.assign({}, reviewedOption, reviewData.option||{}), reviewedHotel||hotelCtx);
  // Review payloads often omit pricingBreakup — keep the previously known real API fee.
  if(!(feeAfterRaw>0) && feeBeforeRaw>0) feeAfterRaw=feeBeforeRaw;
  const dFee=Number((draft()||{}).travelYaraaServiceFee||(draft()||{}).serviceFee||(draft()||{}).convenienceFee||0);
  if(!(feeAfterRaw>0) && dFee>0) feeAfterRaw=dFee;
  const feeAfter=hotelMoneyRound(feeAfterRaw);
  const lockedPay=hotelMoneyRound(Number((draft()||{}).resultsPayableAmount||0));
  const currentAuth=hotelCustomerPayableAmount(selectedBefore, hotelCtx)
    || hotelMoneyRound(Number(hotelRawTicketAmount(selectedBefore, hotelCtx)||beforeTicket) + Number(feeBeforeRaw||0));
  // Review often omits customerPayable — rebuild payable from mapped customer ticket + preserved fee.
  // Do not read synthesized reviewedOption.customerPayable (supplier totalPrice).
  const reviewPb=hotelPricingBreakup(reviewedOption, reviewedHotel||hotelCtx);
  const reviewApiPay=firstPositiveAmount(reviewPb.customerPayable, reviewedOption&&reviewedOption.raw&&reviewedOption.raw.pricingBreakup&&reviewedOption.raw.pricingBreakup.customerPayable);
  let newSell;
  if(reviewApiPay>0){
    newSell=hotelMoneyRound(reviewApiPay);
  }else{
    const rebuilt=hotelMoneyRound(Number(newTicket||0) + Number(feeAfterRaw||0));
    // Component rounding (round(ticket)+fee vs round(ticket+fee)/API payable) can drift by ₹1.
    // That is not a genuine customer-payable change — keep the locked Results/Room amount.
    if(lockedPay>0 && Math.abs(rebuilt-lockedPay)<=1) newSell=lockedPay;
    else if(currentAuth>0 && Math.abs(rebuilt-currentAuth)<=1) newSell=currentAuth;
    else newSell=rebuilt;
  }
  // Popup only when the canonical customer payable amount genuinely differs by ≥ ₹1.
  const priceChanged=currentAuth>0 && newSell>0 && Math.abs(newSell-currentAuth)>=1;
  const base={available:true, res:res, raw:raw, reviewData:reviewData, reviewedHotel:reviewedHotel, reviewedOption:reviewedOption, reviewBookingId:reviewBookingId, currentAuth:currentAuth, newSell:newSell, newTicket:newTicket, feeAfter:feeAfter, feeBefore:feeBefore, priceChanged:priceChanged, hotelName:hotelCtx.name||reviewedHotel.name||'', roomName:reviewedOption.roomSummary||selectedBefore.roomSummary||'', context:res.searchContext||context, hid:hid, oid:oid};
  if(!reviewBookingId || reviewData.available===false || reviewData.isAvailable===false || reviewData.soldOut===true){
    return Object.assign({}, base, {available:false});
  }
  return base;
}
function hotelNotifyModalHtml(opts){
  opts=opts||{};
  const mobile=isMobileHotelUi();
  const type=opts.type||'price-change';
  const oldP=Number(opts.oldPrice||0);
  const newP=Number(opts.newPrice||0);
  const diff=newP-oldP;
  const diffAbs=Math.abs(diff);
  const diffLabel=diff>0?('Increase of '+money(diffAbs)):diff<0?('Decrease of '+money(diffAbs)):'';
  const hotelLine=opts.hotelName?('<p class="tyh-notify-sub"><b>'+esc(opts.hotelName)+'</b>'+(opts.roomName?' · '+esc(opts.roomName):'')+'</p>'):'';
  let title='';
  let body='';
  let primary='';
  let secondary='';
  if(type==='unavailable'){
    title='Selected room is no longer available';
    body='<p class="tyh-notify-msg">This room rate is no longer available for your selected dates. Please choose another room or return to results.</p>'+hotelLine;
    primary='Choose another room';
    secondary=opts.checkPoint==='payment'?'Back to results':'Go back';
  } else if(type==='expired'){
    title='Your hotel search has expired';
    body='<p class="tyh-notify-msg">Hotel prices and availability may have changed. Please search again to see the latest available rooms and prices.</p>'+hotelLine;
    primary='Search again';
    secondary='Back to results';
  } else if(type==='rate-limit'){
    title='We’re refreshing hotel availability';
    body='<p class="tyh-notify-msg">Please wait a moment and try again.</p>'+hotelLine;
    primary='Try again';
    secondary='Back to results';
  } else if(type==='notice'){
    title=String(opts.title||'Something went wrong');
    body='<p class="tyh-notify-msg">'+esc(String(opts.message||'Please try again.'))+'</p>'+hotelLine;
    primary=String(opts.primary||'OK');
    secondary=String(opts.secondary||'Back to results');
  } else {
    title='Price updated';
    body='<p class="tyh-notify-msg">The price for your selected room has changed.</p>'+hotelLine
      +'<div class="tyh-notify-prices"><div><small>Previous price</small><b>'+money(oldP)+'</b></div><div><small>Updated price</small><b class="tyh-notify-new">'+money(newP)+'</b></div></div>'
      +(diffLabel?('<p class="tyh-notify-diff">'+esc(diffLabel)+'</p>'):'');
    primary='Confirm new price';
    secondary='Go back';
  }
  return '<div class="tyh-notify-root'+(mobile?' tyh-notify-mobile':' tyh-notify-desktop')+'" role="dialog" aria-modal="true">'
    +'<div class="tyh-notify-bg" data-notify-dismiss></div>'
    +'<section class="tyh-notify-card">'
      +'<h2 class="tyh-notify-title">'+esc(title)+'</h2>'
      +body
      +'<div class="tyh-notify-actions">'
        +'<button type="button" class="tyh-cta tyh-notify-primary" data-notify-primary>'+esc(primary)+'</button>'
        +'<button type="button" class="tyh-cta tyh-cta-soft tyh-notify-secondary" data-notify-secondary>'+esc(secondary)+'</button>'
      +'</div>'
    +'</section>'
  +'</div>';
}
function showHotelNotifyModal(opts){
  return new Promise(function(resolve){
    const wrap=document.createElement('div');
    wrap.innerHTML=hotelNotifyModalHtml(opts);
    const rootEl=wrap.firstElementChild;
    if(!rootEl){ resolve('back'); return; }
    document.body.appendChild(rootEl);
    document.body.classList.add('tyh-modal-lock');
    function finish(action){
      if(rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
      if(!document.querySelector('.tyh-notify-root')) document.body.classList.remove('tyh-modal-lock');
      resolve(action);
    }
    const primary=q('[data-notify-primary]', rootEl);
    const secondary=q('[data-notify-secondary]', rootEl);
    const bg=q('[data-notify-dismiss]', rootEl);
    if(primary) primary.onclick=function(){
      if(opts.type==='unavailable') finish('choose-room');
      else if(opts.type==='expired') finish('search-again');
      else if(opts.type==='rate-limit') finish('retry');
      else if(opts.type==='notice') finish('confirm');
      else finish('confirm');
    };
    if(secondary) secondary.onclick=function(){
      if(opts.type==='unavailable' && opts.checkPoint==='payment') finish('back-results');
      else if(opts.type==='expired' || opts.type==='rate-limit' || opts.type==='notice') finish('back-results');
      else finish('back');
    };
    if(bg) bg.onclick=function(){ finish(opts.type==='expired'||opts.type==='rate-limit'||opts.type==='notice'?'back-results':'back'); };
  });
}
async function handleHotelSessionModal(kind, checkPoint){
  hideLoader();
  const action=await showHotelNotifyModal({
    type:kind==='rate-limit'?'rate-limit':'expired',
    checkPoint:checkPoint||'',
    hotelName:(hotel()&&hotel().name)||(S.detailHotel&&S.detailHotel.name)||'',
    roomName:(option()&&(option().roomSummary||option().roomType))||''
  });
  if(action==='search-again'){
    setPage('results');
    loadResults();
    return action;
  }
  if(action==='retry'){
    return action;
  }
  if(action==='back-results'){
    setPage('results');
    if(S.shown&&S.shown.length) renderResults(); else loadResults();
    return action;
  }
  return action;
}
async function handleHotelApiFailureModal(err, checkPoint){
  hideLoader();
  if(isHotelRateLimitErr(err)) return handleHotelSessionModal('rate-limit', checkPoint);
  if(isHotelExpiredSearchErr(err)) return handleHotelSessionModal('expired', checkPoint);
  if(isHotelReviewUnavailableErr(err)){
    await handleHotelUnavailableModal(checkPoint);
    return 'unavailable';
  }
  await showHotelNotifyModal({
    type:'notice',
    checkPoint:checkPoint,
    title:'Unable to continue',
    message:friendlyError(err)||'We couldn’t complete this hotel request. Please try again.',
    primary:'OK',
    secondary:'Back to results',
    hotelName:(hotel()&&hotel().name)||''
  });
  return 'back';
}
function commitHotelReviewToDraft(outcome, opts){
  opts=opts||{};
  const prev=draft();
  const priceChanged=!!outcome.priceChanged;
  const confirmed=!!opts.confirmed;
  // Lock markup-inclusive TICKET (Base Fare). Payable = ticket + API convenience fee.
  const feeNow=hotelMoneyRound(Math.max(
    0,
    Number(outcome.feeAfter||0),
    hotelServiceFeeAmount(outcome.reviewedOption, outcome.reviewedHotel),
    Number(prev.travelYaraaServiceFee||prev.serviceFee||prev.convenienceFee||0),
    Number(outcome.feeBefore||0)
  ));
  const authTicketHint=Math.max(0, Number(outcome.newTicket||0)||(Number(outcome.currentAuth||0)-feeNow));
  const reviewedTicket=hotelMoneyRound(Number(outcome.newTicket||0)||resolveReviewedCustomerSell(outcome.reviewedOption, outcome.reviewedOption, outcome.reviewedHotel, authTicketHint));
  let authoritativeSellAmount;
  if(priceChanged && confirmed){
    const fromPayable=feeNow>0 ? hotelMoneyRound(Math.max(0, Number(outcome.newSell||0)-feeNow)) : hotelMoneyRound(outcome.newSell);
    authoritativeSellAmount=hotelMoneyRound(Math.max(fromPayable, reviewedTicket||0));
  } else {
    const prevTicket=Number(prev.authoritativeSellAmount||prev.resultsSellAmount||0);
    authoritativeSellAmount=hotelMoneyRound(Math.max(Number(reviewedTicket||0), hotelTicketSellAmount(outcome.reviewedOption, outcome.reviewedHotel), prevTicket));
  }
  const hotelCtx=S.detailHotel||hotel()||outcome.reviewedHotel;
  S.selectedHotel=mergeHotelKeepMedia(hotelCtx, Object.assign({}, outcome.reviewedHotel, {searchContext:outcome.context, reviewHash:realReviewHash(hotelCtx), hotelId:outcome.hid, id:outcome.hid, tjHotelId:outcome.hid}));
  // Stamp locked ticket + canonical customer payable (same rounded amount as Results / Room / Guest).
  const feeOnOption=feeNow;
  const prevPb=hotelPricingBreakup(outcome.reviewedOption, outcome.reviewedHotel||hotelCtx);
  const applied=prev.appliedOffer||null;
  const discount=applied ? Math.max(0, Number(applied.discountAmount||prev.discountAmount||0)) : Math.max(0, Number(prev.discountAmount||0));
  const feeWaived=!!(applied&&(applied.convenienceFeeWaived||applied.discountType==='convenience_fee_waiver'));
  let payableBeforeDiscount;
  if(priceChanged && confirmed){
    payableBeforeDiscount=hotelMoneyRound(outcome.newSell);
  }else{
    // Keep the Results/Room canonical payable whenever review did not confirm a real payable change.
    payableBeforeDiscount=hotelMoneyRound(firstPositiveAmount(
      prev.resultsPayableAmount,
      outcome.currentAuth,
      Number(authoritativeSellAmount)+Number(hotelRawFeeAmount(outcome.reviewedOption, outcome.reviewedHotel||hotelCtx)||feeOnOption),
      hotelCustomerPayableAmount(outcome.reviewedOption, outcome.reviewedHotel||hotelCtx)
    ));
  }
  let finalPayable=hotelMoneyRound(Math.max(0, payableBeforeDiscount - discount));
  if(applied && Number(applied.finalPayableAmount)>0) finalPayable=hotelMoneyRound(applied.finalPayableAmount);
  const svcFee=feeWaived?0:hotelMoneyRound(Math.max(0, finalPayable - authoritativeSellAmount + discount));
  const stampedPb=Object.assign({}, prevPb, {
    ticketAmount:authoritativeSellAmount,
    resultDisplayAmount:authoritativeSellAmount,
    convenienceFee:svcFee,
    convenienceFeeBeforeOffer:svcFee,
    customerPayable:payableBeforeDiscount
  });
  S.selectedOption=Object.assign({}, outcome.reviewedOption, {
    totalPrice:authoritativeSellAmount,
    resultDisplayAmount:authoritativeSellAmount,
    displayPrice:authoritativeSellAmount,
    finalPrice:authoritativeSellAmount,
    amount:authoritativeSellAmount,
    tp:authoritativeSellAmount,
    convenienceFee:svcFee,
    serviceFee:svcFee,
    customerPayable:payableBeforeDiscount,
    displayTotal:payableBeforeDiscount,
    pricingBreakup:stampedPb
  });
  S.review=outcome.res;
  const natIso=String((prev.nationality||S.search&&S.search.nationality)||'IN').toUpperCase();
  const resIso=String((prev.countryOfResidence||prev.residenceCountry||S.search&&(S.search.countryOfResidence||S.search.residenceCountry))||'IN').toUpperCase();
  const patch={
    service:'hotel',
    hotel:S.selectedHotel,
    selected:S.selectedHotel,
    option:S.selectedOption,
    optionId:outcome.oid,
    reviewHash:realReviewHash(hotelCtx),
    searchContext:outcome.context,
    tripjackReviewRaw:outcome.raw,
    tripjackReviewBookingId:outcome.reviewBookingId,
    cancellationPolicyRaw:outcome.reviewedOption.cancellationPolicy||{},
    authoritativeSellAmount:authoritativeSellAmount,
    resultsSellAmount:Number(prev.resultsSellAmount||authoritativeSellAmount),
    resultsPayableAmount:payableBeforeDiscount,
    baseBookingAmount:authoritativeSellAmount,
    travelYaraaServiceFee:svcFee,
    serviceFee:svcFee,
    convenienceFee:svcFee,
    finalPayableAmount:finalPayable,
    searchPayload:Object.assign({}, prev.searchPayload||S.search||{}, {searchContext:outcome.context, nationality:natIso, countryOfResidence:resIso, residenceCountry:resIso}),
    nationality:natIso,
    countryOfResidence:resIso,
    residenceCountry:resIso,
    clientRequestId:prev.clientRequestId||newHotelClientRequestId()
  };
  if(opts.preserveGuest){
    patch.guests=prev.guests;
    patch.contact=prev.contact||{countryCode:'+91'};
    patch.gst=prev.gst||{enabled:false};
    patch.specialRequest=prev.specialRequest||'';
    patch.roomConfirmed=prev.roomConfirmed;
    patch.appliedOffer=prev.appliedOffer||null;
    patch.discountAmount=prev.discountAmount||0;
    patch.offerCode=prev.offerCode||'';
  } else {
    patch.contact={countryCode:'+91'};
    patch.guests=defaultGuests();
    patch.gst={enabled:false};
    patch.roomConfirmed=false;
    S.ui.visibleGuestCount=1;
    S.ui.savedGuestQuery='';
  }
  if(!patch.createdAt) patch.createdAt=prev.createdAt||new Date().toISOString();
  save(KEY.selected,{service:'hotel',hotel:S.selectedHotel,option:S.selectedOption,optionId:outcome.oid,review:outcome.res,search:S.search});
  setDraft(patch);
  syncHotelPayableDraft();
  return patch;
}
async function handleHotelUnavailableModal(checkPoint){
  const action=await showHotelNotifyModal({type:'unavailable', checkPoint:checkPoint, hotelName:hotel().name||'', roomName:option().roomSummary||option().roomType||''});
  if(action==='back-results'){
    setPage('results');
    if(S.shown&&S.shown.length) renderResults(); else loadResults();
    return action;
  }
  if(checkPoint==='select'){
    const hid=realHotelId(S.detailHotel||hotel()||{});
    if(hid){
      setPage('hotel-details','hotelId='+encodeURIComponent(hid));
      if(S.detailHotel) renderHotelDetailsPlumbing();
    }
  }
  return action;
}
async function runHotelReviewCheckpoint(checkPoint, hotelCtx, optionId, currentAuthAmount, selectedBefore){
  const pack=await fetchHotelReview(hotelCtx, optionId);
  const outcome=buildHotelReviewOutcome(pack, selectedBefore, hotelCtx, currentAuthAmount);
  if(!outcome.available){
    hideLoader();
    await handleHotelUnavailableModal(checkPoint);
    return {ok:false, reason:'unavailable'};
  }
  if(outcome.priceChanged){
    hideLoader();
    const action=await showHotelNotifyModal({
      type:'price-change',
      checkPoint:checkPoint,
      oldPrice:outcome.currentAuth,
      newPrice:outcome.newSell,
      hotelName:outcome.hotelName,
      roomName:outcome.roomName
    });
    if(action!=='confirm'){
      return {ok:false, reason:'declined', outcome:outcome};
    }
    outcome.confirmed=true;
    if(checkPoint==='payment') showLoader('Verifying price and availability…');
    else showLoader('Updating your booking…');
  }
  commitHotelReviewToDraft(outcome, {preserveGuest:checkPoint==='payment', confirmed:outcome.confirmed||!outcome.priceChanged});
  return {ok:true, outcome:outcome};
}
async function startReview(h, optionId){
  const hotel=S.detailHotel||h;
  const oid=realOptionId({optionId:optionId,id:optionId});
  if(!hasPricingReviewContext(hotel) || !oid || !optionList(hotel).some(function(o){ return realOptionId(o)===oid; })){
    hideLoader();
    await showHotelNotifyModal({
      type:'notice',
      title:'Rates still loading',
      message:'Please wait for live room rates, then choose the room again.',
      primary:'OK',
      secondary:'Back to results',
      hotelName:hotel&&hotel.name||''
    });
    return;
  }
  const selectedBeforeReview=optionList(hotel).find(function(o){ return realOptionId(o)===oid; })||{};
  const currentAuth=hotelBaseFareAmount(selectedBeforeReview, hotel)||priceOf(selectedBeforeReview, hotel);
  const feeAtSelect=hotelServiceFeeAmount(selectedBeforeReview, hotel);
  const payableAtSelect=hotelCustomerPayableAmount(selectedBeforeReview, hotel);
  setDraft({resultsSellAmount:hotelMoneyRound(currentAuth), resultsPayableAmount:payableAtSelect, travelYaraaServiceFee:feeAtSelect, serviceFee:feeAtSelect, convenienceFee:feeAtSelect});
  try{
    showLoader('Verifying hotel price and availability…');
    const result=await runHotelReviewCheckpoint('select', hotel, oid, currentAuth, selectedBeforeReview);
    if(!result.ok) return;
    setPage('guest');
    renderGuestStep();
  }catch(e){
    await handleHotelApiFailureModal(e, 'select');
  }finally{ hideLoader(); }
}

function draft(){ return read(KEY.draft,{service:'hotel',hotel:S.selectedHotel,option:S.selectedOption,guests:defaultGuests(),contact:{},gst:{enabled:false}})||{}; }
function setDraft(p){ const d=Object.assign({},draft(),p||{}); save(KEY.draft,d); return d; }
function hotel(){ const d=draft(); return d.hotel||d.selected||S.selectedHotel||{}; }
function option(){ const d=draft(); return d.option||S.selectedOption||{}; }
function reviewRaw(){ const d=draft(); return d.tripjackReviewRaw||{}; }
function defaultGuests(){
  const draftSearch=(read(KEY.draft,null)||{}).searchPayload||{};
  const s=Object.assign({}, searchPayload()||{}, draftSearch, S.search||{});
  const rooms=arr(s.rooms).length?s.rooms:[{adults:Number(s.adults||1),children:Number(s.children||0),childAge:s.childAge||[]}];
  const gs=[];
  rooms.forEach(function(r,ri){
    const a=Number(r.adults||1), c=Number(r.children||0);
    for(let i=0;i<a;i++) gs.push({room:ri+1,type:'Adult',title:'Mr',firstName:'',lastName:''});
    for(let i=0;i<c;i++) gs.push({room:ri+1,type:'Child',title:'Master',firstName:'',lastName:'',age:arr(r.childAge)[i]||''});
  });
  return gs.length?gs:[{room:1,type:'Adult',title:'Mr',firstName:'',lastName:''}];
}
function saveGuest(i){
  const form=q('[data-guest-form]',root);
  const d=draft();
  const guests=ensureGuestSlots(d);
  const g=Object.assign({},guests[i]||{});
  if(form) qa('[data-gfield]',form).forEach(function(inp){ g[inp.dataset.gfield]=inp.value; });
  // PAN fields live in a separate panel; capture them for the active guest.
  qa('.tyh-pan-panel [data-gfield]',root).forEach(function(inp){
    if(inp.type==='radio' && !inp.checked) return;
    g[inp.dataset.gfield]=inp.value;
  });
  guests[i]=g;
  setDraft({guests:guests});
}
function ensureGuestSlots(d){
  d=d||draft();
  const expected=defaultGuests();
  const current=arr(d.guests);
  if(current.length===expected.length && current.length){
    // Preserve type/room from occupancy while keeping entered fields
    return current.map(function(g,i){
      const eg=expected[i]||{};
      return Object.assign({}, eg, g, {room:eg.room||g.room||1, type:eg.type||g.type||'Adult'});
    });
  }
  const merged=expected.map(function(eg,i){ return Object.assign({}, eg, current[i]||{}); });
  setDraft({guests:merged});
  return merged;
}
function guestDisplayName(g){
  g=g||{};
  return [g.title, g.firstName, g.lastName].filter(Boolean).join(' ').trim();
}
function guestSlotComplete(g, idx){
  return guestMissingFields(g||{}, idx).length===0 && !!(g&&g.firstName&&g.lastName);
}
function completedGuestsSummaryHtml(guests, visibleCount){
  guests=arr(guests);
  const n=Math.max(1, Math.min(Number(visibleCount||1), guests.length||1));
  const rows=[];
  for(let i=0;i<n;i++){
    const g=guests[i]||{};
    if(!guestSlotComplete(g, i)) continue;
    const nm=guestDisplayName(g);
    if(!nm) continue;
    rows.push('<li class="tyh-guest-done-item"><span class="tyh-guest-done-check" aria-hidden="true">✓</span><b>'+esc(nm)+'</b></li>');
  }
  if(!rows.length) return '';
  return '<div class="tyh-completed-guests" aria-label="Guests"><div class="tyh-completed-guests-head">Guests</div><ul>'+rows.join('')+'</ul></div>';
}
function renderGuestStep(){
  const d=draft();
  let guests=ensureGuestSlots(d);
  const maxGuests=guests.length;
  S.ui.visibleGuestCount=Math.max(1, Math.min(Number(S.ui.visibleGuestCount||1), maxGuests));
  if(S.guestIndex>=S.ui.visibleGuestCount) S.guestIndex=S.ui.visibleGuestCount-1;
  const i=Math.max(0,Math.min(S.guestIndex, S.ui.visibleGuestCount-1));
  S.guestIndex=i;
  const g=guests[i]||{};
  let contact=Object.assign({}, d.contact||{});
  try{
    const profile=JSON.parse(localStorage.getItem('ty_user_profile')||'null')||tyhRecognizedLoggedInUser()||{};
    if(!contact.email && profile.email) contact.email=profile.email;
    if(!contact.phone && (profile.phone||profile.phoneNumber)) contact.phone=String(profile.phone||profile.phoneNumber||'').replace(/\D/g,'');
    if(!contact.countryCode && profile.countryCode) contact.countryCode=profile.countryCode;
  }catch(e){}
  if(!contact.countryCode) contact.countryCode='+91';
  if((!d.contact||!d.contact.email||!d.contact.phone) && (contact.email||contact.phone)){
    setDraft({contact:Object.assign({}, d.contact||{}, {email:contact.email||(d.contact&&d.contact.email)||'', phone:contact.phone||(d.contact&&d.contact.phone)||'', countryCode:contact.countryCode})});
  }
  const needPass=optionRequiresPassport();
  const needPan=optionRequiresPan();
  const panOptional=optionPanOptional();
  const showPan=needPan||panOptional;
  const o=option();
  const h=hotel();
  const occLabel=guestRoomOccupancyLabel(guests);
  const visibleGuests=guests.slice(0, S.ui.visibleGuestCount);
  const guestsTabs=visibleGuests.map(function(x,idx){ return '<button type="button" class="'+(idx===i?'active':'')+'" data-guest-tab="'+idx+'">'+esc(x.type||'Guest')+' '+(idx+1)+'</button>'; }).join('');
  const desktop=!isMobileHotelUi();
  const complete=guestsAreComplete(Object.assign({},d,{guests:guests,contact:contact}));
  syncHotelPayableDraft();
  const parts=hotelFareParts(Object.assign({},draft(),{guests:guests}));
  const applied=draft().appliedOffer||null;
  const finalPay=parts.total;
  const offersHtml=hotelCouponHtml(applied);
  const fareBlock=hotelSideRailHtml({
    base:parts.roomBase, taxesFees:parts.taxesFees, serviceFee:parts.serviceFee, discount:parts.discount, total:finalPay,
    occupancy:occupancySummaryText(Object.assign({},d,{guests:guests})),
    offersHtml:offersHtml,
    ctaAttr:desktop?'data-pay':'',
    ctaLabel:'Continue to payment',
    ctaDisabled:!complete,
    stickyClass:desktop?'tyh-fare-sticky':''
  });

  const canPlusGuest=S.ui.visibleGuestCount<maxGuests;
  const panType=g.panType==='corporate'?'corporate':'personal';
  const panBlock=showPan?('<section class="tyh-panel tyh-pan-panel">'
    +'<div class="tyh-section-head"><h2>PAN information</h2></div>'
    +'<p class="tyh-muted">'+(needPan?'Required for the selected room rate':'Optional for the selected room rate')+'</p>'
    +'<div class="tyh-pan-type" role="radiogroup" aria-label="PAN type">'
      +'<label class="tyh-radio"><input type="radio" name="tyhPanType" data-gfield="panType" value="personal"'+(panType==='personal'?' checked':'')+'> Personal PAN</label>'
      +'<label class="tyh-radio"><input type="radio" name="tyhPanType" data-gfield="panType" value="corporate"'+(panType==='corporate'?' checked':'')+'> Corporate PAN</label>'
    +'</div>'
    +'<div class="tyh-form-grid"><label>Name (Room '+(g.room||1)+')'+(needPan?' <span class="tyh-req" aria-hidden="true">*</span>':'')+'<input data-gfield="panName" value="'+attr(g.panName||[g.firstName,g.lastName].filter(Boolean).join(' ')) +'" placeholder="Name"'+(needPan?' required':'')+'></label>'
    +'<label>PAN number'+(needPan?' <span class="tyh-req" aria-hidden="true">*</span>':'')+'<input data-gfield="pan" value="'+attr(g.pan||'')+'" placeholder="PAN Number" autocomplete="off"'+(needPan?' required':'')+'></label></div>'
    +'<button type="button" class="tyh-linkish tyh-pan-format-btn" data-validate-pan-format>Check PAN format</button>'
    +'<p class="tyh-muted tyh-pan-format-msg" data-pan-format-msg hidden></p>'
  +'</section>'):'';
  const savedHtml='<div class="tyh-saved-guests">'
    +(tyhGuestAuthToken()?(
      '<label class="tyh-saved-search">Search saved guests<input type="search" data-saved-guest-query value="'+attr(S.ui.savedGuestQuery||'')+'" placeholder="Type a name" autocomplete="off" enterkeyhint="search"></label>'
      +'<div data-saved-guest-results="1">'+savedGuestListInnerHtml()+'</div>'
    ):'<p class="tyh-muted">Sign in to search and use your saved guest list.</p>')
  +'</div>';

  const cancelTable=cancellationTableHtml(o);
  const cancel=cancelSummaryText(o);
  const roomConfirmChecked=!!d.roomConfirmed;
  const cancelOpen=!!S.ui.cancelPolicyOpen;
  const roomBanner='<div class="tyh-room-banner"><span>Room '+(g.room||1)+' : '+esc(o.roomSummary||o.roomType||'Selected room')+'</span>'+(o.mealBasis?'<em>'+esc(o.mealBasis)+'</em>':'')+'</div>';

  const leftMain='<div class="tyh-guest-main">'
    +'<section class="tyh-summary-card">'+hotelMiniCard(h,o)+'</section>'
    +selectedRoomSummaryHtml(o, guests)
    +'<section class="tyh-panel tyh-room-confirm-panel">'
      +'<label class="tyh-check tyh-room-confirm"><input type="checkbox" data-room-confirm '+(roomConfirmChecked?'checked':'')+'> I confirm that I have reviewed and agree to proceed with the above selected room(s) category for booking.</label>'
    +'</section>'
    +'<section class="tyh-panel tyh-cancel-panel">'
      +'<button type="button" class="tyh-cancel-toggle" data-toggle-cancel-policy aria-expanded="'+(cancelOpen?'true':'false')+'"><span>Cancellation Policy</span><i aria-hidden="true">'+(cancelOpen?'▴':'▾')+'</i></button>'
      +(cancelOpen
        ? '<div class="tyh-cancel-body"><p class="tyh-desc">'+esc(cancel||'Cancellation terms follow the selected room rate.')+'</p>'+(cancelTable||'')+'</div>'
        : '')
    +'</section>'
    +'<section class="tyh-panel tyh-guest-panel">'
      +'<div class="tyh-section-head"><h2>Guest details</h2></div>'
      +'<p class="tyh-guest-help">Please enter details for all guests</p>'
      +roomBanner
      +'<p class="tyh-guest-slot">'+esc(occLabel||('Room '+(g.room||1)))+'</p>'
      +'<div class="tyh-validate-msg" data-guest-validate hidden></div>'
      +completedGuestsSummaryHtml(guests, S.ui.visibleGuestCount)
      +savedHtml
      +'<div class="tyh-tabs">'+guestsTabs+'</div>'
      +'<div class="tyh-form-grid tyh-guest-names-grid" data-guest-form="'+i+'">'
        +'<label class="tyh-guest-title"><span class="tyh-lab">Title <span class="tyh-req" aria-hidden="true">*</span></span><select data-gfield="title" required><option '+(g.title==='Mr'?'selected':'')+'>Mr</option><option '+(g.title==='Ms'?'selected':'')+'>Ms</option><option '+(g.title==='Mrs'?'selected':'')+'>Mrs</option><option '+(g.title==='Master'?'selected':'')+'>Master</option></select></label>'
        +'<label><span class="tyh-lab">First Name <span class="tyh-req" aria-hidden="true">*</span></span><input data-gfield="firstName" value="'+attr(g.firstName||'')+'" placeholder="First Name" autocomplete="given-name" required></label>'
        +'<label><span class="tyh-lab">Last Name <span class="tyh-req" aria-hidden="true">*</span></span><input data-gfield="lastName" value="'+attr(g.lastName||'')+'" placeholder="Last Name" autocomplete="family-name" required></label>'
        +(g.type==='Child'?'<label><span class="tyh-lab">Age <span class="tyh-req" aria-hidden="true">*</span></span><input data-gfield="age" value="'+attr(g.age||'')+'" placeholder="Child age" inputmode="numeric" required></label>':'')
        +(needPass?'<label><span class="tyh-lab">Passport Number <span class="tyh-req" aria-hidden="true">*</span></span><input data-gfield="passport" value="'+attr(g.passport||'')+'" placeholder="Passport Number" autocomplete="off" required></label>':'')
      +'</div>'
      +'<label class="tyh-check tyh-save-guest-line"><input type="checkbox" data-save-guest-list '+(g.saveToList?'checked':'')+'> <span>Add this guest to my guest list · Faster booking in future</span></label>'
      +(canPlusGuest?'<button type="button" class="tyh-add-guest" data-plus-guest>+ Add Guest</button>':'')
      +'<p class="tyh-muted tyh-edit-guest-note" data-edit-guest-msg hidden></p>'
    +'</section>'
    +panBlock
    +'<section class="tyh-panel tyh-contact-panel">'
      +'<div class="tyh-section-head"><h2>Contact details</h2></div>'
      +'<div class="tyh-form-grid tyh-contact-grid">'
        +'<label class="tyh-contact-email"><span class="tyh-lab">Email <span class="tyh-req" aria-hidden="true">*</span></span><input data-contact="email" type="email" value="'+attr(contact.email||'')+'" placeholder="Email" autocomplete="email" required></label>'
        +'<div class="tyh-phone-row">'
          +'<label class="tyh-ccode"><span class="tyh-lab">Country Code <span class="tyh-req" aria-hidden="true">*</span></span><select data-contact="countryCode" required>'+countryCodeOptionsHtml(contact.countryCode||'+91')+'</select></label>'
          +'<label class="tyh-contact-phone"><span class="tyh-lab">Mobile Number <span class="tyh-req" aria-hidden="true">*</span></span><input data-contact="phone" inputmode="numeric" value="'+attr(contact.phone||'')+'" placeholder="Mobile number" autocomplete="tel" required></label>'
        +'</div>'
      +'</div>'
      +'<label class="tyh-check tyh-agree-line"><input type="checkbox" data-agreement checked required> <span>I agree to TravelYaraa <a href="/legal/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>, <a href="/legal/user-agreement.html" target="_blank" rel="noopener">User Agreement</a> and <a href="/legal/terms-and-conditions.html" target="_blank" rel="noopener">Terms &amp; Conditions</a>.</span></label>'
    +'</section>'
    +'<section class="tyh-panel tyh-info-panel">'
      +'<div class="tyh-section-head"><h2>Important information</h2></div>'
      +generalTermsPreviewHtml(!!S.ui.termsExpanded)
      +'<div class="tyh-policy-actions"><button type="button" class="tyh-hotel-rules-link" data-policy="hotel">Hotel rules</button></div>'
    +'</section>'
    +'<section class="tyh-panel tyh-special-panel">'
      +'<div class="tyh-section-head"><h2>Special request <small>optional</small></h2></div>'
      +'<label><textarea data-special-request rows="2" placeholder="Enter your special requests here">'+esc(d.specialRequest||'')+'</textarea></label>'
    +'</section>'
  +'</div>';

  const content='<main class="tyh-book tyh-book-flow'+(desktop?' tyh-guest-desk':'')+'">'
    +(desktop?('<div class="tyh-guest-grid">'+leftMain+fareBlock+'</div>'):leftMain)
    +(!desktop
      ? '<div class="tyh-bottom"><button type="button" class="tyh-fare-tap" data-open-fare-sheet><span>Fare Details</span><b>'+money(finalPay)+'</b></button><button type="button" class="'+(complete?'':'tyh-cta-soft-disabled')+'" data-pay'+(complete?' aria-disabled="false"':' aria-disabled="true"')+'>Continue to payment</button></div>'
      : '')
    +((!desktop && S.ui.fareSheetOpen)
      ? '<div class="tyh-modal-bg" data-fare-sheet-close></div><section class="tyh-fare-sheet" role="dialog" aria-label="Fare details"><header><h2>Fare details</h2><button type="button" data-fare-sheet-close aria-label="Close">×</button></header><div class="tyh-sheet-body">'+fareSummaryBlockHtml({base:parts.roomBase,taxesFees:parts.taxesFees,serviceFee:parts.serviceFee,discount:parts.discount,total:finalPay,occupancy:occupancySummaryText(Object.assign({},d,{guests:guests}))})+offersHtml+'</div></section>'
      : '')
  +'</main>';

  shell(content,{title:'Review Your Booking', hideLogo:true, sub:''});
  bindGuest();
  if(S.ui.pendingGuestValidation){
    const pending=S.ui.pendingGuestValidation;
    showGuestValidation(pending.msg||'');
    if(pending.scope&&pending.field) markGuestFieldError(pending.scope, pending.field);
  }
  refreshHotelOffers().catch(function(){});
  // Saved-guest search is driven by input events only — avoid auto-fetch that re-renders and steals focus.
}
function hotelCouponHtml(applied){
  const offers=eligibleHotelFirstOffers();
  if(!offers.length && !applied) return '';
  if(applied){
    const code=applied.offerCode||applied.code||'';
    return '<section class="tyh-offers-card">'
      +'<h2>TravelYaraa Offer</h2>'
      +'<article class="tyh-offer-item applied">'
        +'<div><b>'+esc(code)+'</b><span>Applied</span><p>You saved '+money(applied.discountAmount||0)+'</p></div>'
        +'<button type="button" class="tyh-linkish" data-remove-hotel-offer>Remove</button>'
      +'</article>'
    +'</section>';
  }
  const opts=offers.map(function(o){
    const code=o.code||o.offerCode||'';
    return '<option value="'+attr(code)+'">'+esc(code+(o.title?(' — '+o.title):''))+'</option>';
  }).join('');
  return '<section class="tyh-offers-card">'
    +'<h2>TravelYaraa Offer</h2>'
    +'<p class="tyh-offer-hint">Save ₹700 on your first hotel booking with TravelYaraa.</p>'
    +'<div class="tyh-offer-apply-row">'
      +'<select data-hotel-offer-select aria-label="Select offer">'+opts+'</select>'
      +'<button type="button" class="tyh-cta tyh-offer-apply" data-apply-hotel-offer-selected>Apply</button>'
    +'</div>'
  +'</section>';
}
function eligibleHotelFirstOffers(){
  return arr(S.ui.hotelOffers).filter(function(o){
    if(!o) return false;
    if(S.ui.hotelOfferIneligible) return false;
    // Only show offers the hotel offers API marks as first-booking / new-user (no hardcoded codes/discounts).
    const first=o.firstBookingOnly===true || o.firstBookingOnly===1 || String(o.firstBookingOnly||'').toLowerCase()==='true';
    const neu=o.newUserOnly===true || o.newUserOnly===1 || String(o.newUserOnly||'').toLowerCase()==='true';
    return first || neu;
  });
}
async function refreshHotelOffers(){
  try{
    const res=await fetch(API+'/api/offers?service=hotel',{cache:'no-store'});
    const data=await res.json().catch(function(){ return {}; });
    let offers=Array.isArray(data.offers)?data.offers:[];
    // Hide first-booking offers when the signed-in user already has a successful hotel booking.
    if(tyhGuestAuthToken()){
      try{
        const mine=await fetch(API+'/api/bookings/my?service=hotel&limit=20',{headers:requestHeaders('/api/bookings/my',false),cache:'no-store'});
        const mj=await mine.json().catch(function(){ return {}; });
        const rows=arr(mj.bookings||mj.data||mj.results||(unwrap(mj)&&unwrap(mj).bookings));
        const prior=rows.some(function(b){
          const st=String(b.bookingStatus||b.status||'').toUpperCase();
          return /CONFIRMED|TICKETED|COMPLETED|SUCCESS/.test(st);
        });
        if(prior){
          S.ui.hotelOfferIneligible=true;
          offers=[];
        } else {
          S.ui.hotelOfferIneligible=false;
        }
      }catch(e){ /* keep offers; apply will enforce */ }
    }
    const prev=arr(S.ui.hotelOffers).map(function(o){ return o.code||o.offerCode; }).join('|');
    const next=offers.map(function(o){ return o.code||o.offerCode; }).join('|');
    S.ui.hotelOffers=offers;
    if((currentStep()==='guest' || currentStep()==='review') && prev!==next){
      const validating=q('[data-guest-validate]',root);
      const busy=S.ui.pendingGuestValidation || (validating && !validating.hidden && String(validating.textContent||'').trim());
      if(!busy) renderGuestStep();
    }
  }catch(e){ S.ui.hotelOffers=[]; }
}
async function applyHotelOffer(code){
  const sell=hotelSellAmount();
  const serviceFee=hotelServiceFeeAmount(option(), hotel());
  // Validate against markup-inclusive ticket; fee sent separately from API convenienceFee.
  const amount=sell;
  const profile=tyhRecognizedLoggedInUser()||{};
  const contact=(draft().contact||{});
  const body={
    service:'hotel',
    offerCode:String(code||'').trim(),
    bookingAmount:amount,
    convenienceFee:serviceFee,
    travelYaraaServiceFee:serviceFee,
    userId:profile.userId||profile.uid||contact.email||'',
    email:contact.email||profile.email||'',
    phone:contact.phone||profile.phone||''
  };
  const res=await api('/api/offers/apply', body);
  const discount=hotelMoneyRound(Math.max(0, Number(res.discountAmount||0)));
  const feeAfter=res.convenienceFeeWaived?0:serviceFee;
  const finalPay=hotelMoneyRound(Number(res.finalPayableAmount!=null?res.finalPayableAmount:Math.max(0, amount+feeAfter-discount)));
  if(!res || discount<=0 && !res.finalPayableAmount) throw new Error(res&&res.message||'Offer could not be applied.');
  setDraft({
    appliedOffer:Object.assign({},res,{offerCode:res.offerCode||res.code||code,discountAmount:discount,finalPayableAmount:finalPay,convenienceFeeWaived:!!res.convenienceFeeWaived}),
    offerCode:res.offerCode||res.code||code,
    discountAmount:discount,
    finalPayableAmount:finalPay,
    baseBookingAmount:hotelMoneyRound(sell),
    travelYaraaServiceFee:feeAfter,
    serviceFee:feeAfter
  });
  syncHotelPayableDraft();
  if(currentStep()==='guest' || currentStep()==='review') renderGuestStep();
}
async function removeHotelOffer(){
  try{ await api('/api/offers/remove',{service:'hotel'}); }catch(e){}
  setDraft({appliedOffer:null,offerCode:null,discountAmount:0,finalPayableAmount:0});
  syncHotelPayableDraft();
  if(currentStep()==='guest' || currentStep()==='review') renderGuestStep();
}
function bindGuest(){
  function syncPayState(){
    qa('[data-pay]',root).forEach(function(cont){
      const ok=guestsAreComplete() && !!draft().roomConfirmed;
      cont.classList.toggle('tyh-cta-soft-disabled', !ok);
      cont.setAttribute('aria-disabled', ok?'false':'true');
      cont.disabled=false;
    });
  }
  qa('[data-guest-tab]',root).forEach(function(b){ b.onclick=function(){ saveGuest(S.guestIndex); S.ui.pendingGuestValidation=null; S.guestIndex=Number(b.dataset.guestTab||0); renderGuestStep(); }; });
  qa('[data-gfield]',root).forEach(function(inp){
    inp.oninput=inp.onchange=function(){
      saveGuest(S.guestIndex);
      S.ui.pendingGuestValidation=null;
      clearGuestFieldErrors();
      showGuestValidation('');
      syncPayState();
      const wrap=q('.tyh-guest-panel',root);
      if(wrap){
        const html=completedGuestsSummaryHtml(draft().guests, S.ui.visibleGuestCount);
        let box=q('.tyh-completed-guests',wrap);
        if(html){
          const tmp=document.createElement('div'); tmp.innerHTML=html;
          const next=tmp.firstElementChild;
          if(box) box.replaceWith(next); else {
            const anchor=q('[data-guest-validate]',wrap);
            if(anchor&&anchor.nextSibling) wrap.insertBefore(next, anchor.nextSibling);
            else wrap.insertAdjacentElement('afterbegin', next);
          }
        } else if(box) box.remove();
      }
    };
  });
  qa('[data-contact]',root).forEach(function(i){ i.oninput=i.onchange=function(){ const d=draft(), c=Object.assign({},d.contact||{}); c[i.dataset.contact]=i.value; setDraft({contact:c}); S.ui.pendingGuestValidation=null; clearGuestFieldErrors(); showGuestValidation(''); syncPayState(); }; });
  const ccodeFilter=q('[data-ccode-filter]',root);
  const ccodeSelect=q('select[data-contact="countryCode"]',root);
  if(ccodeFilter&&ccodeSelect){
    ccodeFilter.oninput=function(){
      const selected=ccodeSelect.value||((draft().contact||{}).countryCode)||'+91';
      ccodeSelect.innerHTML=countryCodeOptionsHtml(selected, ccodeFilter.value);
      if(ccodeSelect.value!==selected && ccodeSelect.options.length){
        const still=Array.prototype.some.call(ccodeSelect.options,function(o){ return o.value===selected; });
        if(still) ccodeSelect.value=selected;
      }
      const d=draft(), c=Object.assign({},d.contact||{});
      c.countryCode=ccodeSelect.value||selected;
      setDraft({contact:c});
    };
  }
  const plusGuest=q('[data-plus-guest]',root);
  if(plusGuest) plusGuest.onclick=function(){
    saveGuest(S.guestIndex);
    const max=arr(draft().guests).length;
    if(S.ui.visibleGuestCount>=max){
      const note=q('[data-edit-guest-msg]',root);
      if(note){ note.hidden=false; note.textContent='All guests for this occupancy are already available. To change rooms or guest count, edit Rooms & Guests and search again.'; }
      return;
    }
    S.ui.visibleGuestCount=Math.min(max, Number(S.ui.visibleGuestCount||1)+1);
    S.guestIndex=S.ui.visibleGuestCount-1;
    S.ui.pendingGuestValidation=null;
    renderGuestStep();
  };
  const saveGuestCb=q('[data-save-guest-list]',root);
  if(saveGuestCb) saveGuestCb.onchange=function(){
    const guests=arr(draft().guests).slice();
    const cur=Object.assign({}, guests[S.guestIndex]||{});
    cur.saveToList=!!saveGuestCb.checked;
    guests[S.guestIndex]=cur;
    setDraft({guests:guests});
  };
  const savedQuery=q('[data-saved-guest-query]',root);
  if(savedQuery){
    let tmr=null;
    savedQuery.oninput=function(){
      S.ui.savedGuestQuery=String(savedQuery.value||'');
      // Keep focus: do not full-render while typing; only refresh the result list node.
      clearTimeout(tmr);
      const keep=S.ui.savedGuestQuery;
      if(!String(keep||'').trim()){
        S.ui.savedGuests=[];
        S.ui.savedGuestsLoaded=true;
        paintSavedGuestList();
        return;
      }
      paintSavedGuestList({loading:true});
      tmr=setTimeout(function(){
        loadHotelSavedGuests(keep).finally(function(){
          if(currentStep()!=='guest') return;
          paintSavedGuestList();
          const again=q('[data-saved-guest-query]',root);
          if(again){
            again.value=keep;
            try{ again.focus({preventScroll:true}); again.setSelectionRange(again.value.length, again.value.length); }catch(e){}
          }
        });
      }, 220);
    };
    // Re-tapping the same input must keep keyboard open (iOS/Android).
    savedQuery.addEventListener('touchend', function(e){
      try{ savedQuery.focus({preventScroll:true}); }catch(_e){ try{ savedQuery.focus(); }catch(__e){} }
    }, {passive:true});
    savedQuery.addEventListener('click', function(){
      try{ savedQuery.focus({preventScroll:true}); }catch(_e){}
    });
  }
  qa('[data-pick-saved-guest]',root).forEach(function(b){
    b.onclick=function(){
      const id=b.getAttribute('data-pick-saved-guest');
      const t=arr(S.ui.savedGuests).find(function(x){ return String(x.travellerId||x.id||'')===String(id||''); });
      if(!t) return;
      const guests=arr(draft().guests).slice();
      const cur=Object.assign({}, guests[S.guestIndex]||{});
      cur.title=t.title||cur.title||'Mr';
      cur.firstName=t.firstName||t.fN||'';
      cur.lastName=t.lastName||t.lN||'';
      guests[S.guestIndex]=cur;
      setDraft({guests:guests});
      renderGuestStep();
    };
  });
  const roomConfirm=q('[data-room-confirm]',root);
  if(roomConfirm) roomConfirm.onchange=function(){ setDraft({roomConfirmed:!!roomConfirm.checked}); syncPayState(); };
  const cancelToggle=q('[data-toggle-cancel-policy]',root);
  if(cancelToggle) cancelToggle.onclick=function(){ S.ui.cancelPolicyOpen=!S.ui.cancelPolicyOpen; renderGuestStep(); };
  const panFmt=q('[data-validate-pan-format]',root);
  if(panFmt) panFmt.onclick=function(){
    saveGuest(S.guestIndex);
    const g=arr(draft().guests)[S.guestIndex]||{};
    const pan=String(g.pan||'').trim().toUpperCase();
    const msg=q('[data-pan-format-msg]',root);
    const ok=/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
    if(msg){
      msg.hidden=false;
      msg.textContent=ok?'PAN format looks valid. Identity verification is not performed here.':'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
      msg.classList.toggle('tyh-ok', ok);
    }
  };
  qa('[data-policy]',root).forEach(function(b){ b.onclick=function(){ showPolicy(b.dataset.policy); }; });
  qa('[data-sheet-close]',root).forEach(function(b){
    b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); closeHotelSheet(); };
  });
  const termsBtn=q('[data-toggle-terms]',root);
  if(termsBtn) termsBtn.onclick=function(){ S.ui.termsExpanded=!S.ui.termsExpanded; renderGuestStep(); };
  const specialGuest=q('[data-special-request]',root);
  if(specialGuest) specialGuest.oninput=function(){ setDraft({specialRequest:String(specialGuest.value||'')}); };
  qa('[data-apply-hotel-offer]',root).forEach(function(b){
    b.onclick=async function(){
      try{ showLoader('Validating offer...'); await applyHotelOffer(b.getAttribute('data-apply-hotel-offer')); }
      catch(e){
        if(String(e.code||'')==='FIRST_BOOKING_ONLY' || /first successful booking/i.test(String(e.message||''))){
          S.ui.hotelOfferIneligible=true;
          S.ui.hotelOffers=[];
          renderGuestStep();
        }
        showGuestValidation(e.message||'Offer could not be applied.');
      }
      finally{ hideLoader(); }
    };
  });
  const applySel=q('[data-apply-hotel-offer-selected]',root);
  if(applySel) applySel.onclick=async function(){
    const sel=q('[data-hotel-offer-select]',root);
    const code=sel&&sel.value;
    if(!code) return;
    try{ showLoader('Validating offer...'); await applyHotelOffer(code); }
    catch(e){
      if(String(e.code||'')==='FIRST_BOOKING_ONLY' || /first successful booking/i.test(String(e.message||''))){
        S.ui.hotelOfferIneligible=true;
        S.ui.hotelOffers=[];
        renderGuestStep();
      }
      showGuestValidation(e.message||'Offer could not be applied.');
    }
    finally{ hideLoader(); }
  };
  const rem=q('[data-remove-hotel-offer]',root);
  if(rem) rem.onclick=function(){ removeHotelOffer(); };
  qa('[data-open-fare-sheet]',root).forEach(function(b){ b.onclick=function(){ S.ui.fareSheetOpen=true; renderGuestStep(); }; });
  qa('[data-fare-sheet-close]',root).forEach(function(b){ b.onclick=function(){ S.ui.fareSheetOpen=false; renderGuestStep(); }; });
  qa('[data-pay]',root).forEach(function(cont){
    syncPayState();
    cont.onclick=async function(e){
      e.preventDefault();
      if(!validateGuest()) return;
      if(!draft().roomConfirmed){
        showGuestValidation('Please confirm the selected room category before payment.');
        const cb=q('[data-room-confirm]',root); if(cb) try{ cb.focus(); }catch(err){}
        return;
      }
      S.ui.pendingGuestValidation=null;
      saveGuest(S.guestIndex);
      try{ await saveAllHotelGuestsToListIfRequested(); }catch(_e){}
      syncHotelPayableDraft();
      proceedToPayment();
    };
  });
}
function savedGuestListInnerHtml(opts){
  opts=opts||{};
  if(!tyhGuestAuthToken()) return '<p class="tyh-muted">Sign in to search and use your saved guest list.</p>';
  const qSaved=String(S.ui.savedGuestQuery||'').trim().toLowerCase();
  if(!qSaved) return '';
  if(opts.loading || !S.ui.savedGuestsLoaded) return '<p class="tyh-muted">Loading saved guests…</p>';
  const filtered=arr(S.ui.savedGuests).filter(function(t){
    const nm=[t.title,t.firstName||t.fN,t.lastName||t.lN].filter(Boolean).join(' ').toLowerCase();
    return nm.indexOf(qSaved)>=0;
  });
  if(!filtered.length) return '<p class="tyh-muted">No matching saved guests.</p>';
  return '<div class="tyh-saved-guest-list">'+filtered.slice(0,8).map(function(t){
    const id=t.travellerId||t.id||'';
    const nm=[t.title,t.firstName||t.fN,t.lastName||t.lN].filter(Boolean).join(' ');
    return '<button type="button" class="tyh-saved-guest-row" data-pick-saved-guest="'+attr(id)+'"><b>'+esc(nm||'Guest')+'</b><span>'+esc(t.travellerType||t.type||'Adult')+'</span></button>';
  }).join('')+'</div>';
}
function paintSavedGuestList(opts){
  const wrap=q('.tyh-saved-guests',root);
  if(!wrap) return;
  let listHost=q('[data-saved-guest-results]',wrap);
  if(!listHost){
    listHost=document.createElement('div');
    listHost.setAttribute('data-saved-guest-results','1');
    wrap.appendChild(listHost);
  }
  listHost.innerHTML=savedGuestListInnerHtml(opts);
  qa('[data-pick-saved-guest]',listHost).forEach(function(b){
    b.onclick=function(){
      const id=b.getAttribute('data-pick-saved-guest');
      const t=arr(S.ui.savedGuests).find(function(x){ return String(x.travellerId||x.id||'')===String(id||''); });
      if(!t) return;
      const guests=arr(draft().guests).slice();
      const cur=Object.assign({}, guests[S.guestIndex]||{});
      cur.title=t.title||cur.title||'Mr';
      cur.firstName=t.firstName||t.fN||'';
      cur.lastName=t.lastName||t.lN||'';
      if(t.pan) cur.pan=String(t.pan||'').toUpperCase();
      guests[S.guestIndex]=cur;
      setDraft({guests:guests});
      renderGuestStep();
    };
  });
}
async function loadHotelSavedGuests(query){
  if(!tyhGuestAuthToken()){ S.ui.savedGuests=[]; S.ui.savedGuestsLoaded=true; return; }
  const qv=String(query!=null?query:(S.ui.savedGuestQuery||'')).trim();
  // Without a query, do not list all travellers — search field only.
  if(!qv){ S.ui.savedGuests=[]; S.ui.savedGuestsLoaded=true; return; }
  try{
    const url=API+'/api/travellers?query='+encodeURIComponent(qv)+'&q='+encodeURIComponent(qv)+'&search='+encodeURIComponent(qv);
    const res=await fetch(url,{headers:requestHeaders('/api/travellers',false),cache:'no-store'});
    const data=await res.json().catch(function(){ return {}; });
    if(!res.ok || data.success===false) throw new Error(data.message||'Could not load saved guests.');
    let list=Array.isArray(data.travellers)?data.travellers:(Array.isArray(data.data)?data.data:[]);
    // Client refine if API returns unfiltered list.
    const needle=qv.toLowerCase();
    list=list.filter(function(t){
      const nm=[t.title,t.firstName||t.fN,t.lastName||t.lN].filter(Boolean).join(' ').toLowerCase();
      return nm.indexOf(needle)>=0;
    });
    // Ignore stale responses if the user kept typing.
    if(String(S.ui.savedGuestQuery||'').trim()!==qv) return;
    S.ui.savedGuests=list;
    S.ui.savedGuestsLoaded=true;
  }catch(e){
    if(String(S.ui.savedGuestQuery||'').trim()!==qv) return;
    S.ui.savedGuests=[];
    S.ui.savedGuestsLoaded=true;
  }
}
function normalizeTravellerPan(v){
  return String(v||'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
}
function travellerIdentityKey(t){
  t=t||{};
  const pan=normalizeTravellerPan(t.pan||t.panNumber||t.PAN);
  if(pan) return 'pan:'+pan;
  const title=lower(t.title||'');
  const first=lower(t.firstName||t.fN||'');
  const last=lower(t.lastName||t.lN||'');
  const typ=lower(t.travellerType||t.type||'adult');
  if(!first || !last) return '';
  return 'name:'+title+'|'+first+'|'+last+'|'+typ;
}
async function fetchSavedTravellersForDupCheck(g){
  const queries=[];
  const pan=normalizeTravellerPan(g.pan);
  if(pan) queries.push(pan);
  const nm=[g.firstName,g.lastName].filter(Boolean).join(' ').trim();
  if(nm) queries.push(nm);
  const seen=new Set();
  const out=[];
  for(let i=0;i<queries.length;i++){
    const qv=queries[i];
    try{
      const url=API+'/api/travellers?query='+encodeURIComponent(qv)+'&q='+encodeURIComponent(qv)+'&search='+encodeURIComponent(qv);
      const res=await fetch(url,{headers:requestHeaders('/api/travellers',false),cache:'no-store'});
      const data=await res.json().catch(function(){ return {}; });
      if(!res.ok || data.success===false) continue;
      const list=Array.isArray(data.travellers)?data.travellers:(Array.isArray(data.data)?data.data:[]);
      list.forEach(function(t){
        const id=String(t.travellerId||t.id||travellerIdentityKey(t)||'');
        if(!id || seen.has(id)) return;
        seen.add(id);
        out.push(t);
      });
    }catch(_e){}
  }
  return out;
}
function findMatchingSavedTraveller(existing, guest){
  const wantPan=normalizeTravellerPan(guest.pan);
  const wantKey=travellerIdentityKey(guest);
  if(wantPan){
    const byPan=existing.find(function(t){ return normalizeTravellerPan(t.pan||t.panNumber||t.PAN)===wantPan; });
    if(byPan) return byPan;
  }
  if(!wantKey) return null;
  return existing.find(function(t){ return travellerIdentityKey(t)===wantKey; })||null;
}
async function saveHotelGuestToListIfRequested(){
  return saveAllHotelGuestsToListIfRequested();
}
async function saveAllHotelGuestsToListIfRequested(){
  if(!tyhGuestAuthToken()) return;
  const guests=arr(draft().guests);
  for(let i=0;i<guests.length;i++){
    const g=guests[i]||{};
    if(!g.saveToList) continue;
    if(!g.firstName || !g.lastName) continue;
    const traveller={
      title:g.title||'Mr',
      firstName:g.firstName,
      lastName:g.lastName,
      travellerType:g.type||'Adult',
      type:g.type||'Adult'
    };
    if(g.pan) traveller.pan=normalizeTravellerPan(g.pan);
    try{
      const existing=await fetchSavedTravellersForDupCheck(traveller);
      const match=findMatchingSavedTraveller(existing, traveller);
      if(match){
        // Exact traveller already exists — do not insert a duplicate. Customer-safe: Already saved.
        const id=match.travellerId||match.id;
        if(id && g.pan && !normalizeTravellerPan(match.pan||match.panNumber) && typeof fetch==='function'){
          // If backend supports update and PAN was newly provided, try PATCH/PUT once.
          try{
            await fetch(API+'/api/travellers/'+encodeURIComponent(id),{
              method:'PATCH',
              headers:Object.assign({'Content-Type':'application/json'}, requestHeaders('/api/travellers',true)),
              body:JSON.stringify({traveller:Object.assign({}, match, traveller)}),
              cache:'no-store'
            });
          }catch(_upd){}
        }
        S.ui.savedGuests=[match].concat(arr(S.ui.savedGuests).filter(function(t){ return String(t.travellerId||t.id||'')!==String(id||''); }));
        S.ui.savedGuestsLoaded=true;
        showGuestValidation('Already saved');
        continue;
      }
      const res=await fetch(API+'/api/travellers',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json'}, requestHeaders('/api/travellers',true)),
        body:JSON.stringify({traveller:traveller}),
        cache:'no-store'
      });
      const data=await res.json().catch(function(){ return {}; });
      if(res.status===409 || /already|duplicate/i.test(String(data.message||data.error||''))){
        showGuestValidation('Already saved');
        continue;
      }
      if(res.ok && data.success!==false && data.traveller){
        S.ui.savedGuests=[data.traveller].concat(arr(S.ui.savedGuests));
        S.ui.savedGuestsLoaded=true;
      }
    }catch(_e){}
  }
}
function validateGuest(){
  saveGuest(S.guestIndex);
  clearGuestFieldErrors();
  showGuestValidation('');
  S.ui.pendingGuestValidation=null;
  const d=draft();
  const guests=ensureGuestSlots(d);
  for(let i=0;i<guests.length;i++){
    const missing=guestMissingFields(guests[i], i);
    if(missing.length){
      const label=String(guests[i].type||'Guest')+' '+(i+1);
      const msg='Please complete '+label+' details to continue.';
      const needTabSwitch=S.guestIndex!==i;
      S.guestIndex=i;
      S.ui.pendingGuestValidation={msg:msg, scope:'guest', field:missing[0].field};
      if(needTabSwitch) renderGuestStep();
      else {
        showGuestValidation(msg);
        markGuestFieldError('guest', missing[0].field);
      }
      return false;
    }
  }
  const contactMiss=contactMissingFields(d.contact||{});
  if(contactMiss.length){
    const msg='Please complete your contact details to continue.';
    S.ui.pendingGuestValidation={msg:msg, scope:'contact', field:contactMiss[0].field};
    showGuestValidation(msg);
    markGuestFieldError('contact', contactMiss[0].field);
    return false;
  }
  const agreement=q('[data-agreement]',root);
  if(agreement&&!agreement.checked){
    showGuestValidation('Please accept the TravelYaraa policies to continue.');
    return false;
  }
  return true;
}
function totalAmount(){
  return hotelFareParts().total;
}
function basePayableAmount(){
  return hotelSellAmount();
}
function guestRoomOccupancyLabel(guests){
  guests=arr(guests);
  const byRoom={};
  guests.forEach(function(g){
    const r=String(g.room||1);
    if(!byRoom[r]) byRoom[r]={adults:0,children:0};
    if(String(g.type||'').toLowerCase()==='child') byRoom[r].children++;
    else byRoom[r].adults++;
  });
  return Object.keys(byRoom).map(function(r){
    const x=byRoom[r];
    const bits=[];
    if(x.adults) bits.push(x.adults+' Adult'+(x.adults===1?'':'s'));
    if(x.children) bits.push(x.children+' Child'+(x.children===1?'':'ren'));
    return 'Room '+r+' · '+bits.join(' · ');
  }).join(' · ');
}
function guestMissingFields(g, index){
  g=g||{};
  const missing=[];
  if(!String(g.title||'').trim()) missing.push({field:'title',label:'Title'});
  if(!String(g.firstName||'').trim()) missing.push({field:'firstName',label:'First Name'});
  if(!String(g.lastName||'').trim()) missing.push({field:'lastName',label:'Last Name'});
  if(String(g.type||'')==='Child' && (g.age===undefined||g.age===null||String(g.age).trim()==='')){
    missing.push({field:'age',label:'Age'});
  }
  if(optionRequiresPassport() && !String(g.passport||'').trim()) missing.push({field:'passport',label:'Passport Number'});
  if(optionRequiresPan() && !String(g.pan||'').trim()) missing.push({field:'pan',label:'PAN'});
  return missing;
}
function contactMissingFields(contact){
  contact=contact||{};
  const missing=[];
  if(!String(contact.email||'').includes('@')) missing.push({field:'email',label:'Email',scope:'contact'});
  if(String(contact.phone||'').replace(/\D/g,'').length<8) missing.push({field:'phone',label:'Mobile',scope:'contact'});
  if(!String(contact.countryCode||'').trim()) missing.push({field:'countryCode',label:'Country code',scope:'contact'});
  return missing;
}
function guestsAreComplete(d){
  d=d||draft();
  const guests=ensureGuestSlots(d);
  for(let i=0;i<guests.length;i++){
    if(guestMissingFields(guests[i], i).length) return false;
  }
  if(contactMissingFields(d.contact||{}).length) return false;
  return true;
}
function showGuestValidation(msg){
  let box=q('[data-guest-validate]',root);
  if(!box){
    const panel=q('.tyh-panel',root)||q('main.tyh-book',root);
    if(!panel) return;
    box=document.createElement('div');
    box.className='tyh-validate-msg';
    box.setAttribute('data-guest-validate','1');
    panel.insertAdjacentElement('afterbegin', box);
  }
  box.textContent=String(msg||'');
  box.hidden=!msg;
}
function clearGuestFieldErrors(){
  qa('.tyh-field-error',root).forEach(function(el){ el.classList.remove('tyh-field-error'); });
}
function markGuestFieldError(scope, field){
  let el=null;
  if(scope==='contact') el=q('[data-contact="'+field+'"]',root);
  else el=q('[data-gfield="'+field+'"]',root);
  if(!el) return;
  const label=el.closest('label')||el;
  label.classList.add('tyh-field-error');
  try{ el.focus({preventScroll:false}); }catch(e){ try{ el.focus(); }catch(_e){} }
}
function hotelMiniCard(h,o){
  h=h||{}; o=o||{};
  const d=draft();
  const s=d.searchPayload||S.search||{};
  const ci=s.checkIn||s.checkinDate;
  const co=s.checkOut||s.checkoutDate;
  const times=hotelCheckTimes(h);
  const imgs=allHotelImages(h);
  const img=imgs[0]||imageOf(h);
  const loc=hotelAddressText(h);
  const starN=Math.max(0,Math.min(5,Math.round(h.star||0)));
  const stars=starN?'<div class="tyh-stars" aria-label="'+esc(starN)+' star">'+"★".repeat(starN)+'</div>':'';
  const rooms=Math.max(1, Number(s.roomCount||arr(s.rooms).length||1));
  const guestsN=arr(d.guests).length||Number(s.adults||0)+Number(s.children||0)||1;
  const nightN=nights(ci,co);
  const hid=realHotelId(h);
  const desk=!isMobileHotelUi();
  const nightPill='<div class="tyh-stay-nights"><span>'+esc(String(nightN))+' Night'+(nightN===1?'':'s')+'</span></div>';
  const cell=function(label,value,timeVal){
    return '<div class="tyh-stay-cell"><small>'+esc(label)+'</small><b>'+esc(value)+'</b>'
      +(timeVal?'<em class="tyh-stay-time">'+esc(timeVal)+'</em>':'')
    +'</div>';
  };
  // Desktop: one horizontal row Check In | Nights | Check Out | Rooms | Guests (times under dates when API supplies them).
  // Mobile: Row1 dates+nights, Row2 rooms/guests — times under Check In/Out dates when supplied.
  const stayHtml=desk
    ? ('<div class="tyh-stay-strip tyh-stay-desk" aria-label="Stay summary">'
        +'<div class="tyh-stay-mainrow">'
          +cell('Check In', fmtDate(ci)||'Pending', times.checkIn)
          +nightPill
          +cell('Check Out', fmtDate(co)||'Pending', times.checkOut)
          +cell('Total Rooms', String(rooms)+' Room'+(rooms===1?'':'s'))
          +cell('Total Guests', String(guestsN)+' Guest'+(guestsN===1?'':'s'))
        +'</div>'
      +'</div>')
    : ('<div class="tyh-stay-strip tyh-stay-mob" aria-label="Stay summary">'
        +'<div class="tyh-stay-row tyh-stay-dates">'
          +cell('Check In', fmtDate(ci)||'Pending', times.checkIn)
          +nightPill
          +cell('Check Out', fmtDate(co)||'Pending', times.checkOut)
        +'</div>'
        +'<div class="tyh-stay-row tyh-stay-counts">'
          +cell('Total Rooms', String(rooms)+' Room'+(rooms===1?'':'s'))
          +cell('Total Guests', String(guestsN)+' Guest'+(guestsN===1?'':'s'))
        +'</div>'
      +'</div>');
  return '<article class="tyh-mini tyh-booking-summary">'
    +'<div class="tyh-mini-top">'
      +'<div class="tyh-mini-img">'+(img?'<img src="'+attr(img)+'" alt="'+attr(h.name||'Hotel')+'">':'<span class="tyh-img-fallback" aria-hidden="true"></span>')+'</div>'
      +'<div class="tyh-mini-body">'
        +'<div class="tyh-mini-head-row">'
          +'<h2>'+esc(h.name||'Hotel')+'</h2>'
          +(hid&&desk?'<button type="button" class="tyh-back-details" data-back>« Back to hotel details</button>':'')
        +'</div>'
        +(stars?stars:'')
        +(loc?'<p class="tyh-location">'+esc(loc)+'</p>':'')
      +'</div>'
    +'</div>'
    +stayHtml
  +'</article>';
}
function selectedRoomSummaryHtml(o, guests){
  o=o||{};
  const cancel=cancelSummaryText(o);
  const refundLabel=o.refundable===false?'Non-refundable':(o.freeCancellation||o.refundable?'Refundable':'');
  const meal=o.mealBasis||'';
  // Show refundability once — skip duplicate when cancel line already carries the same label.
  const cancelIsRefund=cancel && refundLabel && lower(cancel).indexOf(lower(refundLabel))>=0;
  const planBits=[cancelIsRefund?'':refundLabel, meal].filter(Boolean);
  const occ=occupancySummaryText(Object.assign({}, draft(), {guests:guests||draft().guests}));
  const adultsKids=guestRoomOccupancyLabel(guests||ensureGuestSlots(draft()));
  return '<section class="tyh-panel tyh-selected-room-panel">'
    +'<div class="tyh-selected-room-grid">'
      +'<div><b>'+esc(o.roomSummary||o.roomType||'Selected room')+'</b>'
        +'<span>'+esc(adultsKids||occ)+'</span></div>'
      +'<div class="tyh-selected-room-plan"><b>'+esc(planBits.join(' | ')||'As selected')+'</b>'
        +(cancel?'<span class="tyh-rate-cancel">✓ '+esc(cancel)+'</span>':'')+'</div>'
    +'</div>'
  +'</section>';
}
function renderReviewStep(){
  // Customer Review step retired — required content lives on Guest; payment starts from Guest.
  setPage('guest');
  renderGuestStep();
}
function showPolicy(type){
  const raw=reviewRaw();
  const h=hotel();
  let title='Cancellation policy';
  let html='';
  if(type==='hotel'){
    title='Hotel rules';
    html=hotelRulesHtml(h, option(), raw);
  } else {
    const selected=option();
    const c=selected.cancellation||cancellationOf(selected.raw||selected)||{};
    const pd=arr(c.penalties);
    const intro=c.refundable===false?'This room is non-refundable.':(c.freeCancellation?'Free cancellation'+(c.freeCancellationUntil?' until '+fmtDate(c.freeCancellationUntil):'')+'.':'Cancellation charges may apply.');
    html='<p><b>'+esc(intro)+'</b></p>'+(pd.length?pd.map(function(x){ return '<p>'+esc([x.fromDate||x.fdt,x.toDate||x.tdt,x.amount!=null?money(x.amount):(x.am!=null?money(x.am):''),x.percent!=null?x.percent+'%':(x.pp!=null?x.pp+'%':'')].filter(Boolean).join(' • '))+'</p>'; }).join(''):'')+cancellationTableHtml(selected);
  }
  openHotelSheet(title, html);
}
function loadRazorpay(){ if(window.Razorpay) return Promise.resolve(); return new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src='https://checkout.razorpay.com/v1/checkout.js'; s.onload=resolve; s.onerror=()=>reject(new Error('Payment gateway could not be loaded.')); document.head.appendChild(s); }); }

function tyhGuestAuthToken(){ try{return localStorage.getItem("ty_user_auth_token") || "";}catch(e){return "";} }
function tyhGuestAuthHeaders(){ const t=tyhGuestAuthToken(); return t ? {Authorization:"Bearer "+t} : {}; }
function tyhIsAuthRequiredError(error){
  if(!error) return false;
  if(Number(error.status)===401) return true;
  if(String(error.code||'')==='AUTH_REQUIRED') return true;
  return /please log in|auth[_ ]required/i.test(String(error.message||''));
}
async function tyhAwaitSharedFirebaseAuth(){
  if(!window.tyFirebaseAuthReady){
    throw new Error('Login module could not be loaded. Please refresh the page and try again.');
  }
  await window.tyFirebaseAuthReady;
  if(typeof window.tySyncFirebaseUserWithBackend!=='function'){
    throw new Error('Login module is outdated in your browser. Please reload the page to continue.');
  }
}
function tyhReadJsonStorage(key){
  try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch(e){ return null; }
}
function tyhRecognizedLoggedInUser(){
  const token=tyhGuestAuthToken();
  if(!token) return null;
  const profile=tyhReadJsonStorage('ty_user_profile')||tyhReadJsonStorage('travelYaraaUser')||{};
  if(profile && (profile.userId||profile.uid||profile.email||profile.phone)){
    return Object.assign({source:'ty_user_profile'}, profile, {
      userId:String(profile.userId||profile.uid||'').trim(),
      uid:String(profile.userId||profile.uid||'').trim(),
      phone:profile.phone||profile.phoneNumber||''
    });
  }
  const fbUser=(window.auth&&window.auth.currentUser)||window.tyCurrentFirebaseUser||null;
  if(fbUser){
    return {
      uid:fbUser.uid||'',
      userId:fbUser.uid||'',
      email:fbUser.email||'',
      phone:fbUser.phoneNumber||'',
      name:fbUser.displayName||'',
      source:'firebase-current-user'
    };
  }
  return null;
}
function tyhSyncLoggedInUserForBooking(payload, user){
  user=user||tyhRecognizedLoggedInUser();
  if(!user) return null;
  payload.details=Object.assign({}, payload.details||{});
  payload.user=Object.assign({}, payload.user||{}, user);
  payload.userId=payload.userId||user.userId||user.uid||'';
  payload.authenticated=true;
  payload.loginSource=user.source||'existing-login';
  const contact=payload.details.contact||{};
  if(!contact.email && user.email) contact.email=user.email;
  if(!contact.phone && (user.phone||user.phoneNumber)) contact.phone=String(user.phone||user.phoneNumber||'').replace(/\D/g,'');
  payload.details.contact=contact;
  try{ localStorage.setItem('ty_user_profile', JSON.stringify(Object.assign({}, user, payload.user))); }catch(e){}
  return user;
}
async function tyhEnsureBackendAuthBeforePayment(payload){
  await tyhAwaitSharedFirebaseAuth();
  const fbUser=(window.auth&&window.auth.currentUser)||window.tyCurrentFirebaseUser||null;
  if(fbUser){
    const data=await window.tySyncFirebaseUserWithBackend(fbUser, {service:'hotel'});
    if(!data||!data.authToken){
      throw new Error('TravelYaraa login could not be completed. Please try again.');
    }
    try{
      localStorage.setItem('ty_user_auth_token', data.authToken);
      if(data.user) localStorage.setItem('ty_user_profile', JSON.stringify(data.user));
    }catch(e){}
    tyhSyncLoggedInUserForBooking(payload, data.user||tyhRecognizedLoggedInUser());
    return {authToken:data.authToken, user:data.user||tyhRecognizedLoggedInUser(), reused:!!data.reused};
  }
  const token=tyhGuestAuthToken();
  const user=tyhRecognizedLoggedInUser();
  if(token&&user){
    tyhSyncLoggedInUserForBooking(payload, user);
    return {authToken:token, user, reused:true};
  }
  return null;
}
async function tyhFirebaseSocialLogin(providerName, payload){
  await tyhAwaitSharedFirebaseAuth();
  const provider=String(providerName||'google').toLowerCase();
  let data;
  if(provider==='google'){
    if(typeof window.tyGoogleLogin!=='function'){
      throw new Error('Login module is outdated in your browser. Please reload the page to continue.');
    }
    data=await window.tyGoogleLogin({provider:'google', service:'hotel'});
  }else{
    throw new Error('Unsupported login provider.');
  }
  if(!data||!data.authToken){
    throw new Error('TravelYaraa login could not be completed. Please try again.');
  }
  try{
    localStorage.setItem('ty_user_auth_token', data.authToken);
    if(data.user) localStorage.setItem('ty_user_profile', JSON.stringify(data.user));
  }catch(e){}
  tyhSyncLoggedInUserForBooking(payload, data.user||{});
  return {authToken:data.authToken, user:data.user||tyhRecognizedLoggedInUser(), reused:!!data.reused};
}
function tyhContactEmail(d){ return d?.contact?.email || d?.contactEmail || d?.email || ""; }
function tyhContactPhone(d){ const c=d?.contact||{}; const phone=String(c.phone||d?.contactPhone||d?.phone||"").replace(/\D/g,""); const code=String(c.countryCode||d?.countryCode||"+91").replace(/[^+\d]/g,""); return phone ? code+phone : ""; }
function tyhContactName(d){ const c=d?.contact||{}; const g=arr(d?.guests)[0]||{}; return c.name || [g.title,g.firstName,g.lastName].filter(Boolean).join(" "); }
function tyhGuestOtpModal(){
  let el=document.getElementById('tyHotelGuestOtpModal');
  if(el) return el;
  el=document.createElement('div');
  el.id='tyHotelGuestOtpModal';
  // Match Flight booking login/signup sheet (same layout + Google/OTP flow).
  el.innerHTML='<div class="tygo-backdrop"></div><div class="tygo-sheet" role="dialog" aria-modal="true" aria-label="Login or Create account"><button class="tygo-close" type="button" aria-label="Close">×</button><h2>Login or Create an account</h2><p class="tygo-sub">Continue with your email id or mobile number. If your account does not exist, TravelYaraa will create it automatically after OTP verification.</p><label class="tygo-label">Enter Email Id / Mobile Number</label><div class="tygo-input-wrap"><span class="tygo-input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/><path d="M7 20h10"/></svg></span><input class="tygo-login-input" type="text" autocomplete="email tel" inputmode="email" placeholder="Enter your Email Id / Mobile no."></div><button class="tygo-primary" type="button">LOGIN</button><div class="tygo-otp-area" hidden><label class="tygo-label">Enter OTP</label><input class="tygo-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 digit OTP"><button class="tygo-link" type="button">Resend OTP</button></div><div class="tygo-or"><span></span><b>Or Login Via</b><span></span></div><div class="tygo-social-row"><button class="tygo-social tygo-google" type="button" aria-label="Continue with Google"><span class="tygo-g">G</span><em>Google</em></button></div><p class="tygo-sent"></p><p class="tygo-msg"></p></div>';
  if(!document.getElementById('tyGuestOtpStyle')){
    const css=document.createElement('style');
    css.id='tyGuestOtpStyle';
    css.textContent='.tygo-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:999998}.tygo-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:999999;width:min(520px,100%);background:#fff;border-radius:24px 24px 0 0;padding:26px 24px calc(24px + env(safe-area-inset-bottom));box-shadow:0 -18px 70px rgba(7,29,73,.25);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#071d49;box-sizing:border-box}.tygo-sheet *{box-sizing:border-box}.tygo-close{position:absolute;right:16px;top:14px;width:38px;height:38px;border-radius:50%;border:0;background:#071d49;color:#fff;font-size:28px;line-height:36px;font-weight:400}.tygo-sheet h2{margin:0 46px 22px 0;font-size:25px;line-height:1.12;font-weight:950;color:#111}.tygo-sub{display:none}.tygo-label{display:block;margin:0 0 10px;color:#222;font-weight:750;font-size:16px}.tygo-input-wrap{height:58px;border:1px solid #d8dce4;border-radius:14px;background:#fff;display:flex;align-items:center;gap:12px;padding:0 16px}.tygo-input-icon{width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:#111;flex:0 0 28px}.tygo-input-icon svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.tygo-login-input{border:0;outline:0;width:100%;height:100%;font-size:17px;font-weight:650;color:#111;min-width:0}.tygo-login-input::placeholder{color:#a8a8a8}.tygo-primary{width:100%;height:60px;border:0;border-radius:999px;background:linear-gradient(90deg,#2678ff,#4fd2ef);color:#fff;font-weight:900;font-size:18px;letter-spacing:.05em;margin-top:20px;box-shadow:0 14px 28px rgba(38,120,255,.20)}.tygo-primary:disabled{opacity:.65}.tygo-otp-area{margin-top:18px}.tygo-otp{width:100%;height:52px;border:1px solid #d8dce4;border-radius:14px;padding:0 14px;font-size:22px;font-weight:900;letter-spacing:8px;text-align:center;outline:0}.tygo-link{display:block;width:100%;border:0;background:#fff;color:#0062e3;font-size:15px;font-weight:900;margin-top:12px}.tygo-or{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;margin:22px 0 12px;color:#777;font-weight:650}.tygo-or span{height:1px;background:#ddd}.tygo-or b{font-size:14px;font-weight:650;white-space:nowrap}.tygo-social-row{display:flex;justify-content:center;gap:18px}.tygo-social{border:0;background:#fff;min-width:78px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#333;font-weight:700}.tygo-social span{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;box-shadow:0 2px 12px rgba(7,29,73,.13);font-weight:950;font-size:28px}.tygo-g{color:#ea4335}.tygo-social em{font-style:normal;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:1px 10px;font-size:13px;color:#555}.tygo-sent{min-height:18px;margin:12px 0 0;color:#0062e3;font-size:13px;font-weight:850}.tygo-msg{min-height:18px;margin:8px 0 0;color:#b42318;font-size:13px;font-weight:850;line-height:1.3}@media(min-width:760px){.tygo-sheet{top:50%;bottom:auto;transform:translate(-50%,-50%);border-radius:24px;padding:28px}}';
    document.head.appendChild(css);
  }
  document.body.appendChild(el);
  return el;
}
function tyhCloseGuestOtpModal(){ const el=document.getElementById('tyHotelGuestOtpModal'); if(el) el.remove(); }
async function tyhGuestPost(path,body,token){
  const headers=Object.assign({'Content-Type':'application/json','Accept':'application/json'}, token?{Authorization:'Bearer '+token}:{});
  const cleanPath=String(path||'');
  const candidates=[cleanPath];
  if(cleanPath==='/api/bookings/guest-auth/start-otp'){
    candidates.push('/api/bookings/guest-auth/send-otp','/api/guest-auth/start-otp','/api/auth/guest/start-otp');
  }
  if(cleanPath==='/api/bookings/guest-auth/verify-otp'){
    candidates.push('/api/guest-auth/verify-otp','/api/auth/guest/verify-otp');
  }
  let lastMessage='';
  for(let i=0;i<candidates.length;i++){
    const route=candidates[i];
    const res=await fetch(API+route,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
    const data=await res.json().catch(function(){ return {}; });
    if(res.ok && data.success!==false) return data;
    lastMessage=data.message||data.error||('HTTP '+res.status);
    if(res.status!==404){
      const error=new Error(lastMessage);
      error.code=data.code||'';
      throw error;
    }
  }
  throw new Error(lastMessage||'API route not found');
}
async function tyhStartGuestOtp(payload, loginIdentity){
  // Authentication destination is the Login UI identifier only — never booking contact by default.
  const identity=loginIdentity||payload.loginIdentity||{};
  let email=String(identity.email||'').trim();
  let phone=String(identity.phone||'').trim();
  const name=tyhContactName(payload.details||{})||'Guest';
  if(email && !email.includes('@')) email='';
  if(phone){
    const digits=phone.replace(/\D/g,'');
    if(phone.indexOf('+')===0) phone='+'+digits;
    else {
      const code=String(identity.countryCode||'+91').replace(/[^\d+]/g,'')||'+91';
      const codeDigits=code.replace(/\D/g,'');
      const local=digits.indexOf(codeDigits)===0 ? digits.slice(codeDigits.length) : digits;
      phone='+'+codeDigits+local;
    }
  } else phone='';
  // Do NOT forward booking contact email/phone as OTP targets.
  const body={
    service:'hotel',
    name:name,
    otpChannel:email?'email':(phone?'mobile':''),
    clientRequestId:(payload.details&&payload.details.clientRequestId)||undefined
  };
  if(email) body.email=email;
  if(phone && !email) body.phone=phone;
  if(!body.email&&!body.phone) throw new Error('Please enter email or mobile number to continue.');
  const data=await tyhGuestPost('/api/bookings/guest-auth/start-otp',body);
  sessionStorage.setItem('ty_last_guest_otp',JSON.stringify({otpSessionId:data.otpSessionId,guestSessionId:data.guestSessionId,payload:payload,loginIdentity:identity}));
  return data;
}
async function tyhVerifyGuestOtp(otp){
  const saved=JSON.parse(sessionStorage.getItem('ty_last_guest_otp')||'{}');
  const data=await tyhGuestPost('/api/bookings/guest-auth/verify-otp',{otpSessionId:saved.otpSessionId,guestSessionId:saved.guestSessionId,otp});
  if(data.authToken){
    localStorage.setItem('ty_user_auth_token',data.authToken);
    localStorage.setItem('ty_guest_otp_verified_at',String(Date.now()));
  }
  if(data.user){
    localStorage.setItem('ty_user_profile',JSON.stringify(data.user));
    localStorage.setItem('travelYaraaUser',JSON.stringify(data.user));
    localStorage.setItem('tyUserLoggedIn','true');
  }
  return data;
}
async function tyhRequireGuestOtpBeforePayment(payload){
  // Always clear payment loader before any login UI so the sheet is not covered.
  hideLoader();
  const existing=await tyhEnsureBackendAuthBeforePayment(payload).catch(function(){ return null; });
  if(existing&&existing.authToken) return existing;
  if(tyhGuestAuthToken()){
    const user=tyhRecognizedLoggedInUser();
    if(user){
      tyhSyncLoggedInUserForBooking(payload, user);
      return {authToken:tyhGuestAuthToken(), user:user, reused:true};
    }
  }
  try{ sessionStorage.setItem('ty_hotel_pending_payment', JSON.stringify({at:Date.now(), step:currentStep(), draft:draft(), payload:payload||null})); }catch(e){}
  const el=tyhGuestOtpModal();
  const loginInput=el.querySelector('.tygo-login-input');
  const otpArea=el.querySelector('.tygo-otp-area');
  const otpInput=el.querySelector('.tygo-otp');
  const sentBox=el.querySelector('.tygo-sent');
  const message=el.querySelector('.tygo-msg');
  const primary=el.querySelector('.tygo-primary');
  const resend=el.querySelector('.tygo-link');
  const googleBtn=el.querySelector('.tygo-google');
  // Do NOT prefill Login from booking contact — auth destination must be what the user types here.
  loginInput.value='';
  return await new Promise(function(resolve,reject){
    let active=true;
    let otpSent=false;
    let loginIdentity={};
    function finish(v){ if(!active) return; active=false; tyhCloseGuestOtpModal(); resolve(v); }
    function fail(e){ if(!active) return; active=false; tyhCloseGuestOtpModal(); reject(e); }
    function readLoginIdentity(){
      const value=String(loginInput.value||'').trim();
      if(!value){ loginIdentity={}; return ''; }
      if(value.includes('@')){
        loginIdentity={email:value, phone:'', countryCode:''};
      } else {
        const raw=value.replace(/\s+/g,'');
        loginIdentity={
          email:'',
          phone:raw,
          // Dial prefix from the login mobile value only (+country in input, else default +91).
          // Never reuse booking contact countryCode for auth OTP routing.
          countryCode:raw.indexOf('+')===0?'':'+91'
        };
      }
      payload.loginIdentity=loginIdentity;
      return value;
    }
    async function socialNow(){
      try{
        message.textContent='Opening Google login...';
        googleBtn.disabled=true;
        const ok=await tyhFirebaseSocialLogin('google', payload);
        message.textContent='Login successful. Continuing payment...';
        finish(ok);
      }catch(e){
        message.textContent=e.message||'Google sign-in failed.';
      }finally{
        googleBtn.disabled=false;
      }
    }
    async function sendOtpNow(){
      const value=readLoginIdentity();
      if(!value){
        message.textContent='Enter email or mobile number, or use Google login.';
        return;
      }
      try{
        primary.disabled=true;
        message.textContent='Sending OTP...';
        const sent=await tyhStartGuestOtp(payload, loginIdentity);
        otpSent=true;
        otpArea.hidden=false;
        primary.textContent='VERIFY & CONTINUE';
        const dest=loginIdentity.email||loginIdentity.phone||'';
        sentBox.textContent='OTP sent'+(dest?' to '+dest:((sent.sent||[]).length?' to '+(sent.sent||[]).map(function(x){ return x.to; }).join(', '):'.'));
        message.textContent='';
        otpInput.value='';
        setTimeout(function(){ otpInput.focus(); }, 60);
      }catch(e){
        message.textContent=e.message||'OTP could not be sent.';
      }finally{
        primary.disabled=false;
      }
    }
    async function verifyOtpNow(){
      try{
        primary.disabled=true;
        message.textContent='Verifying OTP...';
        finish(await tyhVerifyGuestOtp(otpInput.value));
      }catch(e){
        message.textContent=e.message||'Invalid OTP.';
      }finally{
        primary.disabled=false;
      }
    }
    el.querySelector('.tygo-close').onclick=function(){ fail(new Error('Login verification cancelled.')); };
    primary.onclick=async function(){ otpSent ? await verifyOtpNow() : await sendOtpNow(); };
    if(resend) resend.onclick=async function(){ otpSent=false; await sendOtpNow(); };
    if(googleBtn) googleBtn.onclick=function(){ socialNow(); };
    // Changing login identifier resets OTP destination — do not keep sending/verifying against the old number/email.
    loginInput.addEventListener('input', function(){
      if(!otpSent) return;
      otpSent=false;
      if(otpArea) otpArea.hidden=true;
      if(otpInput) otpInput.value='';
      if(sentBox) sentBox.textContent='';
      primary.textContent='LOGIN';
      message.textContent='';
    });
    loginInput.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); primary.click(); } });
    otpInput.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); primary.click(); } });
  });
}


async function recordPaymentStatus(bookingId,status,failure){
  if(!bookingId||!tyhGuestAuthToken()) return;
  try{ await api('/api/bookings/'+encodeURIComponent(bookingId)+'/payment-status',{status,failure:failure||{}}); }catch(_e){}
}
async function proceedToPayment(){
  try{
    if(!validateGuest()) return;
    saveGuest(S.guestIndex);
    showLoader('Verifying price and availability…');
    const d0=draft();
    const h0=hotel();
    const selectedBefore=option();
    // Pass Base Fare ticket into review checkpoint (beforeTicket). Payable comparison is computed inside.
    const currentAuth=hotelBaseFareAmount(selectedBefore, h0)||hotelSellAmount(selectedBefore, h0);
    try{
      const result=await runHotelReviewCheckpoint('payment', h0, d0.optionId, currentAuth, selectedBefore);
      if(!result.ok){ hideLoader(); return; }
      if(currentStep()==='guest') renderGuestStep();
    }catch(e){
      await handleHotelApiFailureModal(e, 'payment');
      return;
    }
    showLoader('Opening secure payment...');
    await loadRazorpay();
    const d=draft();
    const clientRequestId=d.clientRequestId||newHotelClientRequestId();
    if(!d.clientRequestId) setDraft({clientRequestId});
    const parts=hotelFareParts(d);
    tyhAssertPriceChain('proceedToPayment', parts);
    const searchPay=Object.assign({}, d.searchPayload||S.search||{}, {
      nationality:d.nationality||(d.searchPayload&&d.searchPayload.nationality)||searchNationality(),
      countryOfResidence:d.countryOfResidence||(d.searchPayload&&d.searchPayload.countryOfResidence)||searchResidenceCountry()
    });
    const payload={ service:'hotel', clientRequestId, search:searchPay, selectedResult:Object.assign({},hotel(),{service:'hotel',hotelId:hotel().hotelId||hotel().id,optionId:d.optionId||option().optionId||option().id,rawOption:option().raw||option()}), details:Object.assign({},d,{clientRequestId,searchPayload:searchPay,nationality:searchPay.nationality,countryOfResidence:searchPay.countryOfResidence,offerCode:d.offerCode||(d.appliedOffer&&(d.appliedOffer.offerCode||d.appliedOffer.code))||null,appliedOffer:d.appliedOffer||null,discountAmount:d.discountAmount||0,baseBookingAmount:parts.sell,travelYaraaServiceFee:parts.serviceFee,serviceFee:parts.serviceFee,convenienceFee:parts.serviceFee,finalPayableAmount:parts.total}), supplier:'tripjack', tripjackReviewRaw:reviewRaw() };
    // Hide loader BEFORE login UI so auth sheet is never covered by payment loader.
    hideLoader();
    await tyhRequireGuestOtpBeforePayment(payload);
    if(!tyhGuestAuthToken()){
      throw new Error('Please log in to your TravelYaraa account.');
    }
    showLoader('Opening secure payment...');
    let order;
    try{
      order=await api('/api/bookings/create-payment-order',payload);
    }catch(e){
      if(tyhIsAuthRequiredError(e)){
        if(typeof window.tyClearBackendSession==='function') window.tyClearBackendSession();
        throw new Error('Please log in to your TravelYaraa account.');
      }
      if(isHotelRateLimitErr(e) || isHotelExpiredSearchErr(e) || isHotelReviewUnavailableErr(e)){
        await handleHotelApiFailureModal(e, 'payment');
        return;
      }
      throw e;
    }
    try{ sessionStorage.removeItem('ty_hotel_pending_payment'); }catch(e){}
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
      modal:{ondismiss:function(){
        hideLoader();
        recordPaymentStatus(order.bookingId,'PAYMENT_CANCELLED',{reason:'Customer closed checkout.'});
        // Gateway cancel returns to Guest (Review step retired).
        if(currentStep()!=='guest'){ setPage('guest'); renderGuestStep(); }
      }}
    });
    if(typeof rz.on==='function') rz.on('payment.failed',function(response){ recordPaymentStatus(order.bookingId,'PAYMENT_FAILED',response&&response.error||response||{}); });
    rz.open();
  }catch(e){
    hideLoader();
    if(tyhIsAuthRequiredError(e)&&typeof window.tyClearBackendSession==='function') window.tyClearBackendSession();
    if(isHotelRateLimitErr(e) || isHotelExpiredSearchErr(e) || isHotelReviewUnavailableErr(e)){
      await handleHotelApiFailureModal(e, 'payment');
      return;
    }
    await showHotelNotifyModal({
      type:'notice',
      title:'Unable to start payment',
      message:friendlyError(e)||'Payment could not be started. Please try again.',
      primary:'OK',
      secondary:'Back to results',
      hotelName:(hotel()&&hotel().name)||''
    });
  }
}
function tyhResumePendingPaymentContext(){
  try{
    const raw=sessionStorage.getItem('ty_hotel_pending_payment');
    if(!raw) return;
    const pending=JSON.parse(raw);
    if(!pending||Date.now()-Number(pending.at||0)>30*60*1000) return;
    if(pending.draft) save(KEY.draft, pending.draft);
    if(pending.payload&&pending.payload.search) S.search=Object.assign({}, S.search, pending.payload.search);
    if((currentStep()==='review'||currentStep()==='guest')&&tyhGuestAuthToken()){
      sessionStorage.removeItem('ty_hotel_pending_payment');
      if(currentStep()==='review'){ setPage('guest'); }
    }
  }catch(e){}
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
  return policies.join('') || '<div class="tyh-policy-box">Hotel rules and cancellation policy will be shown from booking details when available.</div>';
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
    +'<div class="tyh-status-hotel-img">'+(img?'<img src="'+attr(img)+'" alt="'+attr(hotelNameFromStatus(b))+'">':'<span class="tyh-img-fallback" aria-hidden="true"></span>')+'</div>'
    +'<div class="tyh-status-hotel-body">'
      +'<h2>'+esc(hotelNameFromStatus(b))+'</h2>'
      +(stars?'<div class="tyh-stars">'+stars+'</div>':'')
      +'<p>'+esc(addr||info.location||'Hotel address will be shown from booking details when available.')+'</p>'
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
      +'<section class="tyh-panel"><h2>Guest details</h2>'+statusGuests(b).join('')
        +'<div class="tyh-kv"><span>Nationality</span><b>'+esc(countryNameFromIso((b.details&&b.details.nationality)||(b.search&&b.search.nationality)||draft().nationality||searchNationality()))+'</b></div>'
        +'<div class="tyh-kv"><span>Country of Residence</span><b>'+esc(countryNameFromIso((b.details&&(b.details.countryOfResidence||b.details.residenceCountry))||(b.search&&(b.search.countryOfResidence||b.search.residenceCountry))||draft().countryOfResidence||searchResidenceCountry()))+'</b></div>'
      +'</section>'
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

function init(){
  if(window.__tyhResultsInit) return;
  window.__tyhResultsInit=true;
  tyhResumePendingPaymentContext();
  const params=new URLSearchParams(location.search);
  const step=params.get('step')||'results';
  const bookingId=params.get('bookingId')||params.get('id');
  if(step==='booking-status'&&bookingId){ loadStatusById(bookingId); return; }
  if(step==='guest'&&read(KEY.draft,null)){ S.search=searchPayload(); setPage('guest'); renderGuestStep(); return; }
  if(step==='review'&&read(KEY.draft,null)){ S.search=searchPayload(); setPage('guest'); renderGuestStep(); return; }
  S.search=searchPayload();
  if(step==='hotel-details'){
    // Paint Detail immediately from selected listing / cached results so refresh and
    // direct hotel-details URLs never leave the Results shell mounted.
    const hid=params.get('hotelId')||'';
    const found=hotelByRealId(hid);
    S.detailHotel=found;
    S.detailStatus=found?'loading':'idle';
    S.detailError='';
    renderHotelDetailsPlumbing();
    if(found) loadHotelPricing(found);
    loadResults();
    return;
  }
  setPage('results');
  loadResults();
}
window.addEventListener('popstate',()=>{
  const params=new URLSearchParams(location.search);
  const step=params.get('step')||'results';
  if(step==='guest') renderGuestStep();
  else if(step==='review'){ setPage('guest'); renderGuestStep(); }
  else if(step==='booking-status'){ const id=params.get('bookingId'); id?loadStatusById(id):renderStatus(read(KEY.status,{})); }
  else if(step==='hotel-details'){
    const hid=params.get('hotelId')||'';
    S.detailHotel=hotelByRealId(hid);
    S.detailStatus=S.detailHotel?'loading':'idle';
    renderHotelDetailsPlumbing();
    if(S.detailHotel) loadHotelPricing(S.detailHotel);
  } else {
    // Prefer live/cached listing so Back from Detail restores the same Results list immediately.
    if(!(S.shown&&S.shown.length)){
      try{
        const cached=read(KEY.results,null);
        if(cached){
          const list=extractResults(cached);
          if(list.length){ S.all=list; applyFilters(); }
        }
      }catch(e){}
    }
    if(S.shown&&S.shown.length) renderResults();
    else loadResults();
  }
});

function css(){ return `
:root{--ty-navy:#071d49;--ty-blue:#0062e3;--ty-orange:#eb814b;--ty-cta:#0062e3;--ty-bg:#f4f7fb;--ty-line:#e4ecf7;--ty-text:#101828;--ty-muted:#667085;--ty-soft:#eef6ff;--ty-green:#067647;--ty-red:#b42318}*{box-sizing:border-box}body.ty-hotel-page,body.travel-page{margin:0;background:var(--ty-bg);font-family:Inter,Arial,sans-serif;color:var(--ty-text);text-transform:none}.tyh-page{min-height:100vh;background:var(--ty-bg);padding-bottom:110px}.tyh-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid var(--ty-line);box-shadow:0 4px 16px rgba(7,29,73,.04)}.tyh-back{width:42px;height:42px;border:0;border-radius:14px;background:#f1f6ff;color:var(--ty-navy);font-size:30px;font-weight:900;line-height:1}.tyh-top-title{min-width:0;flex:1}.tyh-top h1{margin:0;color:var(--ty-navy);font-size:20px;font-weight:900;letter-spacing:0}.tyh-top p{margin:3px 0 0;color:var(--ty-muted);font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tyh-status-pill{background:#e7f8ef;color:#067647;border:1px solid #c8f1da;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:900}.tyh-results{max-width:1180px;margin:14px auto;display:grid;grid-template-columns:260px minmax(0,1fr);gap:14px;padding:0 14px}.tyh-filter{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:16px;position:sticky;top:76px;align-self:start}.tyh-filter h2{margin:0 0 12px;color:var(--ty-navy);font-size:18px}.tyh-filter h3{font-size:14px;margin:14px 0 8px;color:var(--ty-navy)}.tyh-filter label{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px;font-weight:750;color:#344054;line-height:1.3}.tyh-filter input[type=number]{width:100%;height:38px;border:1px solid var(--ty-line);border-radius:10px;padding:0 10px;margin:5px 0;font-size:14px}.tyh-filter-actions{display:flex;gap:8px;border-top:1px solid var(--ty-line);padding-top:12px;margin-top:12px}.tyh-filter-actions button{flex:1;height:40px;border-radius:12px;border:1px solid var(--ty-line);background:#fff;color:var(--ty-navy);font-weight:900}.tyh-filter-actions button:first-child{border:0;background:var(--ty-cta);color:#fff}.tyh-search-line{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--ty-line);border-radius:16px;padding:14px;margin-bottom:12px}.tyh-search-line strong{display:block;color:var(--ty-navy);font-size:18px}.tyh-search-line span{display:block;color:var(--ty-muted);font-size:12px;margin-top:3px}.tyh-search-line button{display:none;border:1px solid var(--ty-line);background:#fff;border-radius:12px;height:38px;padding:0 12px;font-weight:900;color:var(--ty-navy)}.tyh-sort{display:flex;gap:10px;overflow:auto;margin-bottom:12px}.tyh-sort button{border:1px solid var(--ty-line);background:#fff;border-radius:999px;padding:10px 14px;font-weight:900;color:var(--ty-navy);white-space:nowrap}.tyh-sort button.active{border-color:var(--ty-blue);background:#eef6ff;color:var(--ty-blue)}.tyh-cards{display:grid;gap:14px}.tyh-card{background:#fff;border:1px solid var(--ty-line);border-radius:20px;box-shadow:0 10px 28px rgba(7,29,73,.07);display:grid;grid-template-columns:230px minmax(0,1fr) 190px;overflow:hidden}.tyh-img{min-height:178px;background:#eef6ff;display:grid;place-items:center;color:var(--ty-blue);font-size:42px;font-weight:900}.tyh-img img{width:100%;height:100%;object-fit:cover}.tyh-info{padding:16px;min-width:0}.tyh-info h2{margin:0 0 6px;color:#101828;font-size:20px;line-height:1.25;font-weight:900;letter-spacing:0}.tyh-info p{margin:0;color:var(--ty-muted);font-size:13px;font-weight:700;line-height:1.35}.tyh-stars{color:#f5b301;margin:9px 0;font-size:14px;letter-spacing:1px}.tyh-tags{display:flex;gap:6px;flex-wrap:wrap}.tyh-tags span,.tyh-rate span{background:#f2f4f7;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:800;color:#344054}.tyh-price{border-left:1px solid var(--ty-line);padding:16px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:7px;text-align:right}.tyh-price em{background:#067647;color:#fff;border-radius:9px;padding:5px 8px;font-size:12px;font-style:normal;font-weight:900}.tyh-price b{font-size:22px;color:#101828}.tyh-price small{color:var(--ty-muted);font-size:11px;font-weight:700}.tyh-price button,.tyh-cta,.tyh-bottom button[data-continue],.tyh-bottom button[data-pay],.tyh-actions button,.tyh-empty button{height:42px;border:0;border-radius:13px;background:var(--ty-cta);color:#fff;padding:0 16px;font-weight:900;font-size:14px;cursor:pointer}.tyh-empty{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:28px;text-align:center;margin:12px}.tyh-empty h2{margin:0 0 8px;color:var(--ty-navy)}.tyh-empty p,.tyh-muted{color:var(--ty-muted);font-weight:700}.tyh-modal-bg{position:fixed;inset:0;background:rgba(7,29,73,.45);z-index:70}.tyh-room{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:80;width:min(780px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -12px 35px rgba(7,29,73,.18)}.tyh-room header{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--ty-line);padding:16px;display:flex;justify-content:space-between;gap:12px}.tyh-room h2{margin:0;color:var(--ty-navy);font-size:19px}.tyh-room header p{margin:4px 0 0;color:var(--ty-muted);font-size:12px}.tyh-room header button{width:38px;height:38px;border:0;border-radius:12px;background:#f2f4f7;font-size:24px}.tyh-room-body{padding:16px}.tyh-rate{border:1px solid var(--ty-line);border-radius:16px;padding:14px;margin-bottom:12px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start;background:#fff}
.tyh-rate-media{min-width:0}
.tyh-rate-img{border-radius:14px;overflow:hidden;height:140px;background:#eef6ff;cursor:pointer}
.tyh-rate-img img{width:100%;height:100%;object-fit:cover;display:block}
.tyh-rate-amens{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:4px}
.tyh-rate-amens li{font-size:12px;font-weight:800;color:#344054}
.tyh-rate-photos,.tyh-more-opts,.tyh-linkish{margin-top:8px;height:38px;border:1px solid var(--ty-line);border-radius:13px;background:#fff;color:var(--ty-blue);font-weight:900;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;width:100%}
.tyh-linkish{width:auto;height:auto;padding:6px 0;border:0;background:transparent;text-decoration:underline}
.tyh-rate-main{min-width:0}
.tyh-rate-title{display:block;color:#101828;font-size:16px;line-height:1.3}
.tyh-rate-meta,.tyh-rate-meal{margin:6px 0 0;color:#344054;font-size:12px;font-weight:850}
.tyh-rate-meal{color:var(--ty-muted);font-weight:800}
.tyh-rate-cancel{margin:10px 0 0;color:#067647;font-size:12px;font-weight:950}
.tyh-rate-pan{margin:6px 0 0;color:#b54708;font-size:12px;font-weight:850}
.tyh-rate-side{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:6px}
.tyh-rate-side strong{display:block;margin:0;font-size:20px;line-height:1.2}
.tyh-rate-side em{display:block;font-style:normal;color:var(--ty-muted);font-size:12px;font-weight:700}
.tyh-rate-side .tyh-cta{width:100%;margin-top:8px}
@media(min-width:861px){
.tyh-rate{grid-template-columns:minmax(0,1fr) 160px;align-items:stretch}
.tyh-rate-text{grid-template-columns:minmax(0,1fr) minmax(140px,180px);gap:14px;padding:16px;border:1px solid var(--ty-line);border-radius:16px;background:#fff;margin:0 0 12px}
.tyh-view-more-link{display:inline;border:0;background:none;padding:0;margin:6px 0 0;color:var(--ty-blue);font-size:13px;font-weight:800;cursor:pointer;text-decoration:underline;width:auto!important;height:auto!important;border-radius:0!important}
.tyh-room-hero{margin:0 0 14px;border-radius:16px;overflow:hidden;border:1px solid var(--ty-line);background:#eef4ff}
.tyh-room-hero-img{aspect-ratio:16/9;background:#d9e6fb}
.tyh-room-hero-img img{width:100%;height:100%;object-fit:cover;display:block}
.tyh-room-hero-attrs{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;background:#f7faff}
.tyh-room-hero-attrs span{display:inline-flex;padding:6px 10px;border-radius:10px;background:#fff;border:1px solid #d9e6fb;color:var(--ty-navy);font-size:12px;font-weight:800}
.tyh-room-type-card{display:grid;grid-template-columns:minmax(220px,.95fr) minmax(0,1.35fr);gap:18px;padding:16px 0;border-bottom:1px solid var(--ty-line);align-items:start}
.tyh-room-type-card:last-child{border-bottom:0}
.tyh-room-media{min-width:0}
.tyh-room-media-nomedia{margin:0}
.tyh-room-media-img{position:relative;border-radius:14px;overflow:hidden;aspect-ratio:4/3;background:#eaf2ff}
.tyh-room-media-img img{width:100%;height:100%;object-fit:cover;display:block}
.tyh-room-photo-count{position:absolute;right:10px;bottom:10px;border:0;border-radius:999px;background:rgba(16,24,40,.78);color:#fff;font-size:12px;font-weight:900;padding:7px 10px;cursor:pointer}
.tyh-room-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.tyh-room-badge{display:inline-flex;align-items:center;padding:6px 10px;border-radius:10px;background:#f2f4f7;color:#344054;font-size:12px;font-weight:800}
.tyh-room-type-rates{min-width:0;display:grid;gap:0}
.tyh-room-type-rates .tyh-rate{margin:0;border:0;border-bottom:1px solid #eef2f7;border-radius:0;padding:14px 0;background:transparent;grid-template-columns:minmax(0,1fr) minmax(130px,170px)}
.tyh-room-type-rates .tyh-rate:last-child{border-bottom:0}
.tyh-rate-total-tag{font-style:normal;font-size:12px;font-weight:800;color:var(--ty-blue);margin-left:4px}
.tyh-add-guest{display:inline-flex;align-items:center;gap:4px;margin-top:12px;height:auto;padding:0;border:0!important;border-radius:0;background:transparent!important;color:var(--ty-blue)!important;font-weight:800;font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;-webkit-appearance:none;appearance:none;box-shadow:none!important;outline:0}
.tyh-add-guest:hover{color:var(--ty-navy);background:transparent}

.tyh-form-grid label{display:flex;flex-direction:column;align-items:stretch;gap:6px}
.tyh-form-grid label .tyh-lab{display:inline;color:#344054;font-size:13px;font-weight:800;line-height:1.3}
.tyh-form-grid label .tyh-req,.tyh-lab .tyh-req,.tyh-req{display:inline!important;margin-left:2px;color:var(--ty-red)!important;font-weight:900!important;font-size:12px;line-height:1;-webkit-text-fill-color:var(--ty-red)}
.tyh-stay-time{display:block;margin-top:4px;color:var(--ty-muted);font-size:12px;font-weight:750;font-style:normal}
.tyh-offer-hint{margin:0 0 8px!important;color:#98a2b3!important;font-size:11px!important;font-weight:650!important;line-height:1.35!important}
.tyh-offer-terms{display:none!important}
.tyh-rate-price{display:block;margin:0;font-size:20px;line-height:1.2;font-weight:900;color:#101828}
.tyh-rate-total-note{display:block;margin:4px 0 0;font-style:normal;color:var(--ty-muted);font-size:12px;font-weight:700}
.tyh-rate-cap{margin:0 0 6px;color:var(--ty-muted);font-size:12px;font-weight:750}
.tyh-view-more-link{display:inline!important;border:0!important;background:none!important;padding:0!important;margin:8px 0 0!important;color:var(--ty-blue)!important;font-size:13px!important;font-weight:800!important;cursor:pointer;text-decoration:underline!important;text-underline-offset:3px;width:auto!important;height:auto!important;min-height:0!important;border-radius:0!important;box-shadow:none!important;-webkit-appearance:none;appearance:none;outline:0}
.tyh-rates-flat{display:grid;gap:12px}
.tyh-desk-rate-grid .tyh-rate-text{margin:0;border:1px solid var(--ty-line);border-radius:14px;padding:14px;background:#fff}
@media(min-width:861px){
.tyh-room-type-nomedia{grid-template-columns:1fr!important}
.tyh-room-type-nomedia .tyh-rates-flat{grid-template-columns:1fr 1fr;gap:14px}
.tyh-room-type-nomedia .tyh-rate-text{border:1px solid var(--ty-line);border-radius:14px;padding:14px;background:#fff;margin:0;grid-template-columns:minmax(0,1fr) minmax(120px,150px);align-items:end}
.tyh-detail-rooms{display:grid;gap:18px}
.tyh-desk-rate-grid{grid-template-columns:1fr 1fr!important;gap:14px!important;align-items:stretch}
.tyh-desk-rate-grid .tyh-rate-text{grid-template-columns:minmax(0,1fr) minmax(120px,150px);align-items:end}
}
@media(max-width:860px){
.tyh-rates-flat,.tyh-desk-rate-grid{grid-template-columns:1fr!important}
.tyh-rate-price{font-size:18px}
.tyh-rate-side{flex-direction:row;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px}
.tyh-rate-side .tyh-cta{width:auto;min-width:110px;margin-top:0}
}
.tyh-cancel-timeline{margin:12px 0 16px;padding:12px 14px;border:1px solid #e4e9f2;border-radius:14px;background:#f8fbff}
.tyh-cancel-tl-row{display:flex;align-items:flex-start;gap:10px;color:#344054;font-size:13px}
.tyh-cancel-tl-row b{color:var(--ty-navy)}
.tyh-cancel-dot{width:12px;height:12px;border-radius:50%;margin-top:4px;flex:0 0 12px}
.tyh-cancel-dot-now{background:#12b76a}
.tyh-cancel-dot-end{background:var(--ty-blue)}
.tyh-cancel-tl-mid{margin:8px 0 8px 5px;padding-left:16px;border-left:2px solid #b2ccf5}
.tyh-cancel-pill{display:inline-flex;padding:4px 10px;border-radius:999px;background:#eef4ff;border:1px solid #c9daf5;color:var(--ty-navy);font-size:12px;font-weight:900}
.tyh-cancel-status{margin:0 0 8px;color:var(--ty-green);font-weight:900}
.tyh-cancel-sheet-h{margin:0 0 8px;color:var(--ty-navy);font-size:15px}
.tyh-cancel-table-wrap{overflow:auto;margin:12px 0;border:1px solid #e4e9f2;border-radius:12px}
.tyh-cancel-table{width:100%;border-collapse:collapse;font-size:12px}
.tyh-cancel-table th,.tyh-cancel-table td{padding:10px 12px;border-bottom:1px solid #eef2f7;text-align:left;vertical-align:top}
.tyh-cancel-table th{background:#f5f7fa;color:#475467;font-weight:850}
.tyh-cancel-notes p{margin:8px 0 0;padding-top:8px;border-top:1px solid #eef2f7;color:#475467;font-size:12px;line-height:1.45}
.tyh-notify-primary{background:var(--ty-cta)!important}
.tyh-view-rooms-btn{border-color:var(--ty-blue);color:var(--ty-blue)}

.tyh-completed-guests{margin:0 0 12px;padding:10px 12px;border:1px solid var(--ty-line);border-radius:12px;background:#f8fbff}
.tyh-completed-guests-head{margin:0 0 6px;color:var(--ty-navy);font-size:13px;font-weight:900}
.tyh-completed-guests ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.tyh-guest-done-item{display:flex;align-items:center;gap:8px;margin:0;color:#101828;font-size:13px}
.tyh-guest-done-check{color:#067647;font-weight:900}
.tyh-phone-row{display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;grid-column:1 / -1}
.tyh-ccode{min-width:0}
.tyh-offer-hint{margin:4px 0 0;color:#98a2b3;font-size:11px;font-weight:650;line-height:1.35}
.tyh-room-media-nomedia{margin:0}
.tyh-special-panel textarea{min-height:48px;max-height:80px;height:56px;resize:vertical}
.tyh-agree-line{display:flex;align-items:flex-start;gap:10px;margin-top:12px;font-size:12px;line-height:1.45;color:#344054}
.tyh-agree-line span{min-width:0;flex:1;overflow-wrap:anywhere}
.tyh-agree-line a{color:var(--ty-blue);font-weight:800}
.tyh-save-guest-line{display:flex;align-items:flex-start;gap:8px;margin-top:12px;font-size:13px;font-weight:800;color:var(--ty-navy);line-height:1.35}
.tyh-stay-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;margin-top:14px;padding:14px;border-radius:14px;background:linear-gradient(180deg,#f4f8ff 0%,#eef4ff 100%);border:1px solid #d9e6fb}
.tyh-stay-col small{display:block;font-size:11px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#5b6b86;margin:0 0 4px}
.tyh-stay-col b{display:block;color:var(--ty-navy);font-size:14px;font-weight:900;line-height:1.3}
.tyh-stay-col em{display:block;margin-top:8px;font-style:normal;color:var(--ty-muted);font-size:12px;font-weight:700;line-height:1.35}
.tyh-stay-col-right{text-align:right}
.tyh-stay-mid{display:grid;place-items:center;padding-top:18px}
.tyh-stay-mid span{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;border-radius:999px;background:#fff;border:1px solid #c9daf5;color:var(--ty-navy);font-size:12px;font-weight:900}
.tyh-stay-meta{display:flex;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 14px;border-radius:12px;background:#fff;border:1px solid var(--ty-line);color:var(--ty-muted);font-size:13px;font-weight:800}
.tyh-stay-meta b{color:var(--ty-navy)}
.tyh-about-body{max-height:7.5em;overflow:hidden}
.tyh-about-body.is-open{max-height:none}
.tyh-about-sec{margin:0 0 12px}
.tyh-about-sec h3{margin:0 0 4px;color:var(--ty-navy);font-size:14px}
.tyh-about-sec .tyh-desc{margin:0;white-space:pre-wrap}
.tyh-rate-nights{display:block;margin:2px 0 8px;color:var(--ty-muted);font-size:11px;font-weight:700}
.tyh-rate-side{align-items:flex-end;width:160px}
.tyh-rate-side strong,.tyh-rate-side em{text-align:right}
.tyh-rate-img{height:160px}
}
@media(max-width:860px){
.tyh-room-type-card{grid-template-columns:1fr;gap:12px;padding:14px 0}
.tyh-room-type-rates .tyh-rate{grid-template-columns:1fr;gap:10px}
.tyh-rate-side{align-items:stretch;width:auto}
.tyh-rate-side strong,.tyh-rate-side em{text-align:left}
.tyh-rate-side .tyh-cta{width:100%}
}.tyh-book,.tyh-status{max-width:920px;margin:14px auto;padding:0 14px;display:grid;gap:14px}.tyh-summary-card,.tyh-panel,.tyh-actions,.tyh-confirm{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:16px;box-shadow:0 10px 24px rgba(7,29,73,.05)}.tyh-mini{display:grid;grid-template-columns:150px minmax(0,1fr);gap:14px;align-items:center}.tyh-mini-img{height:115px;border-radius:14px;background:#eef6ff;display:grid;place-items:center;overflow:hidden;color:var(--ty-blue);font-size:40px;font-weight:900}.tyh-mini-img img{width:100%;height:100%;object-fit:cover}.tyh-mini h2{margin:0 0 6px;color:var(--ty-navy);font-size:21px;line-height:1.25}.tyh-mini p{margin:0;color:var(--ty-muted);font-size:13px;line-height:1.35}.tyh-room-name{margin-top:8px!important;color:#344054!important;font-weight:800}.tyh-panel h2{margin:0 0 12px;color:var(--ty-navy);font-size:18px}.tyh-panel h2 small{font-size:12px;color:var(--ty-muted);font-weight:700}.tyh-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:14px}.tyh-tabs button{border:1px solid var(--ty-line);background:#fff;color:var(--ty-navy);border-radius:999px;padding:9px 12px;font-size:13px;font-weight:900;white-space:nowrap}.tyh-tabs button.active{border-color:var(--ty-blue);background:#eef6ff;color:var(--ty-blue)}.tyh-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tyh-form-grid label{font-size:12px;color:#344054;font-weight:850;display:flex;flex-direction:column;align-items:stretch;gap:6px}.tyh-form-grid input,.tyh-form-grid select{height:44px;border:1px solid var(--ty-line);border-radius:12px;padding:0 12px;font-size:14px;background:#fff;color:#101828}.tyh-check{display:flex!important;align-items:flex-start;gap:10px;color:#344054;font-size:13px;font-weight:750;line-height:1.4}.tyh-kv,.tyh-guest-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #eef2f7;padding:11px 0;align-items:center}.tyh-kv:first-of-type,.tyh-guest-row:first-of-type{border-top:0}.tyh-kv span,.tyh-guest-row span{color:var(--ty-muted);font-size:13px;font-weight:750}.tyh-kv b,.tyh-guest-row b{color:#101828;text-align:right;font-size:14px}.tyh-kv.total b{font-size:21px;color:var(--ty-blue)}.tyh-policy-actions{display:flex;gap:8px;flex-wrap:wrap}.tyh-policy-actions button{border:1px solid var(--ty-line);background:#fff;border-radius:999px;color:var(--ty-blue);font-weight:900;padding:9px 12px}.tyh-policy-box{margin-top:12px;background:#f8fbff;border:1px solid var(--ty-line);border-radius:14px;padding:12px;color:#344054;font-size:13px;line-height:1.45}.tyh-bottom{position:sticky;bottom:0;z-index:40;background:#101827;color:#fff;border-radius:22px 22px 0 0;margin:4px -14px -110px;padding:16px 18px calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:space-between;align-items:center;gap:12px}.tyh-bottom span{display:block;font-size:12px;font-weight:800;color:#cbd5e1}.tyh-bottom b{font-size:22px}.tyh-bottom button{min-width:190px;border-radius:999px}.tyh-confirm{background:#ecfdf3;border-color:#bbf7d0}.tyh-confirm.failed{background:#fff1f2;border-color:#fecdd3}.tyh-confirm.pending{background:#fff7ed;border-color:#fed7aa}.tyh-confirm h2{margin:0 0 8px;font-size:24px;color:var(--ty-navy)}.tyh-confirm p{margin:0 0 10px;color:#344054}.tyh-confirm span{display:inline-flex;background:#fff;border-radius:999px;padding:7px 11px;color:#344054;font-weight:900;font-size:12px}.tyh-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tyh-actions button{background:#fff;color:var(--ty-navy);border:1px solid var(--ty-line)}.tyh-actions button:nth-child(1),.tyh-actions button:nth-child(2){background:var(--ty-blue);color:#fff;border:0}.tyh-actions button:disabled{opacity:.45;cursor:not-allowed}
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
.tyh-modify{max-width:1180px;margin:12px auto 0;padding:10px;display:grid;grid-template-columns:1.6fr 1fr 1fr 1.2fr auto;gap:8px;align-items:stretch;background:#fff;border:1px solid var(--ty-line);border-radius:16px;box-shadow:0 8px 20px rgba(7,29,73,.04)}
.tyh-modify-full{grid-template-columns:minmax(140px,1.4fr) minmax(110px,.85fr) minmax(110px,.85fr) minmax(120px,1fr) minmax(200px,1.35fr) auto;padding:12px}
.tyh-modify-full .tyh-mod-nat{min-width:0;align-self:stretch;display:flex;align-items:center}
.tyh-modify-full .tyh-nat-grid{width:100%;grid-template-columns:1fr 1fr;gap:6px}
.tyh-modify-full .tyh-nat-grid label{font-size:11px;gap:4px}
.tyh-modify-full .tyh-nat-grid select{height:40px;font-size:12px;border-radius:10px}
.tyh-mod-box,.tyh-mod-nights{display:flex;flex-direction:column;justify-content:center;gap:3px;text-align:left;border:1px solid var(--ty-line);border-radius:12px;background:#fff;padding:8px 10px;min-height:64px;color:#101828}
.tyh-mod-box small,.tyh-mod-nights small{font-size:11px;font-weight:800;color:#667085}
.tyh-mod-box b,.tyh-mod-nights b{font-size:14px;font-weight:900;color:#071d49;line-height:1.2}
.tyh-mod-box em{font-style:normal;font-size:11px;color:#667085;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tyh-mod-search{height:64px;border:0;border-radius:12px;background:var(--ty-blue);color:#fff;padding:0 22px;font-weight:900;font-size:15px}
.tyh-nights-step{display:flex;align-items:center;gap:8px}
.tyh-step{display:flex;align-items:center;gap:8px}
.tyh-step button{width:28px;height:28px;border-radius:50%;border:1px solid var(--ty-line);background:#fff;color:var(--ty-blue);font-weight:900}
.tyh-step button:disabled{opacity:.35}
.tyh-pop-bg{position:fixed;inset:0;background:rgba(7,29,73,.45);z-index:215}
.tyh-pop-bg[data-city-close],.tyh-pop-bg[data-guest-close],.tyh-pop-bg[data-cal-close]{z-index:245}
.tyh-city-pop,.tyh-guest-pop,.tyh-cal{position:fixed;z-index:250;background:#fff;border-radius:18px;box-shadow:0 22px 60px rgba(7,29,73,.22)}
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
.tyh-card{display:block;grid-template-columns:none;text-decoration:none;color:inherit;background:#fff;border:1px solid var(--ty-line);border-radius:14px;box-shadow:0 6px 16px rgba(7,29,73,.05);overflow:hidden;cursor:pointer;min-height:132px}
.tyh-card-main{display:grid;grid-template-columns:168px minmax(0,1fr) 168px;text-decoration:none;color:inherit;min-height:132px}
.tyh-card:focus-within{outline:3px solid #99c2ff;outline-offset:2px}
.tyh-img{min-height:132px;position:relative;background:#eaf2ff;display:grid;place-items:center;color:var(--ty-blue);font-size:36px;font-weight:900}
.tyh-img img{width:100%;height:100%;object-fit:cover;display:block}
.tyh-info{padding:10px 12px;min-width:0}
.tyh-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.tyh-title-row h2{margin:0;font-size:16px;line-height:1.25;color:#101828}
.tyh-stars{margin:0;color:#f5b301;white-space:nowrap;font-size:12px}
.tyh-location{font-size:12px!important;margin:4px 0 6px!important}
.tyh-facilities{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.tyh-facilities span{background:transparent;padding:0;color:#101828;font-size:12px;font-weight:800}
.tyh-meal,.tyh-free{margin-top:3px!important;color:#067647!important;font-size:12px!important}
.tyh-meal{color:#667085!important}
.tyh-card-side{border-left:1px solid var(--ty-line);padding:12px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:10px;background:#fcfdff}
.tyh-card-foot{display:flex;justify-content:flex-end;align-items:flex-end;gap:12px;margin-top:6px}
.tyh-view-btn{display:inline-flex;align-items:center;justify-content:center;height:38px;padding:0 14px;border-radius:12px;background:var(--ty-blue);color:#fff;font-weight:900;font-size:13px}
.tyh-price{border:0!important;padding:0!important;display:block!important;text-align:right}
.tyh-price small{display:block;font-size:11px!important;color:#344054!important}
.tyh-price b{display:block;font-size:18px!important;color:#101828!important}
.tyh-price em{display:block;background:transparent!important;color:#667085!important;padding:0!important;font-size:11px!important;font-style:normal}
.tyh-m-summary{max-width:1180px;margin:10px auto 0;padding:0 10px}
.tyh-m-summary-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px}
.tyh-m-summary-top strong{color:var(--ty-navy);font-size:16px}
.tyh-m-summary-top span{color:var(--ty-muted);font-size:12px;font-weight:800}
.tyh-m-summary-card{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left;border:1px solid var(--ty-line);border-radius:16px;background:#fff;padding:12px 14px;box-shadow:0 6px 16px rgba(7,29,73,.05)}
.tyh-m-summary-main{display:grid;gap:4px;min-width:0}
.tyh-m-summary-main b{color:#071d49;font-size:14px}
.tyh-m-summary-main span{color:#667085;font-size:12px;font-weight:700}
.tyh-m-edit{display:inline-flex;align-items:center;gap:6px;color:var(--ty-blue);font-weight:900;font-size:13px;white-space:nowrap}
.tyh-edit-sheet{position:fixed;left:0;right:0;bottom:0;z-index:220;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -14px 40px rgba(0,0,0,.2);max-height:88vh;overflow:auto;padding-bottom:env(safe-area-inset-bottom)}
.tyh-edit-sheet header{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--ty-line);position:sticky;top:0;background:#fff}
.tyh-edit-sheet h2{margin:0;font-size:18px;color:var(--ty-navy)}
.tyh-edit-sheet header button{border:0;background:#fff;font-size:28px;color:var(--ty-blue)}
.tyh-edit-form{display:grid;gap:10px;padding:14px}
.tyh-edit-form .tyh-mod-box{min-height:58px}
.tyh-edit-search-btn{height:52px!important;width:100%;border-radius:14px!important}
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
.tyh-page-mobile-results .tyh-top{display:none!important}
.tyh-logo img{height:36px}
.tyh-cal{left:0;right:0;top:auto;bottom:0;transform:none;width:100%;max-height:82vh;border-radius:22px 22px 0 0}
.tyh-cal-months{grid-template-columns:1fr}
.tyh-city-pop,.tyh-guest-pop{left:0;right:0;top:auto;bottom:0;transform:none;width:100%;border-radius:22px 22px 0 0}
.tyh-results{display:block!important;grid-template-columns:none!important;margin:8px auto;padding:0 10px}
.tyh-result-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 10px 12px;max-width:1180px}
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
.tyh-card-main{display:block}
.tyh-card-side{border-left:0;border-top:1px solid #f1f5f9;padding:12px 14px 14px;align-items:stretch}
.tyh-view-btn{width:100%}
.tyh-img{min-height:168px}
.tyh-info{padding:12px 14px 8px}
.tyh-title-row h2{font-size:16px}
.tyh-book,.tyh-status{padding:0 10px;margin:10px auto}
.tyh-mini{grid-template-columns:104px minmax(0,1fr);gap:12px}
.tyh-mini-img{height:92px}
.tyh-form-grid{grid-template-columns:1fr}
.tyh-bottom{left:0;right:0;margin:4px -10px -28px;border-radius:20px 20px 0 0}
.tyh-bottom button{min-width:0;flex:1}
.tyh-actions{grid-template-columns:1fr}
}
.tyh-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.tyh-gallery-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:8px;border-radius:18px;overflow:hidden;min-height:320px;background:#eaf2ff}
.tyh-gallery-main,.tyh-gallery-side button{border:0;padding:0;background:#dbe7f5;cursor:pointer;display:block;width:100%;height:100%;overflow:hidden;position:relative}
.tyh-gallery-main{min-height:320px}
.tyh-gallery-main img,.tyh-gallery-side img{width:100%;height:100%;object-fit:cover;display:block}
.tyh-gallery-side{display:grid;grid-template-rows:1fr 1fr;gap:8px;min-height:320px}
.tyh-gallery-more{position:absolute;inset:0;display:grid;place-items:center;background:rgba(7,29,73,.45);color:#fff;font-weight:950;font-size:18px}
.tyh-gallery-more-wrap{position:relative}
.tyh-gallery-badge{position:absolute;right:12px;bottom:12px;background:rgba(16,24,40,.72);color:#fff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900}
.tyh-mobile-thumbs{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:8px}
.tyh-thumb{position:relative;border-radius:12px;overflow:hidden;height:72px;background:#eaf2ff;cursor:pointer}
.tyh-thumb img{width:100%;height:100%;object-fit:cover}
.tyh-thumb-more{position:absolute;inset:0;display:grid;place-items:center;background:rgba(7,29,73,.5);color:#fff;font-weight:900;font-size:12px}
.tyh-view-all-photos{border:1px solid var(--ty-line);border-radius:12px;background:#fff;color:var(--ty-blue);font-weight:900;padding:0 12px}
.tyh-gallery-modal,.tyh-sheet-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:220;width:min(980px,calc(100% - 24px));background:#fff;border-radius:24px;box-shadow:0 30px 90px rgba(7,29,73,.28);overflow:auto;max-height:min(90vh,920px)}
.tyh-modal-bg{position:fixed;inset:0;background:rgba(7,29,73,.45);z-index:215}
.tyh-gallery-modal header,.tyh-sheet-modal header,.tyh-fare-sheet header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--ty-line);background:#fff;position:sticky;top:0;z-index:3}
.tyh-gallery-modal header button,.tyh-sheet-modal header button,.tyh-fare-sheet header button{position:relative;z-index:4;width:38px;height:38px;border-radius:12px;border:1px solid var(--ty-line);background:#fff;font-size:22px;line-height:1;cursor:pointer}
.tyh-gallery-stage{position:relative;background:#000;display:grid;place-items:center;touch-action:pan-y;min-height:280px}
.tyh-gallery-stage img{max-width:100%;max-height:68vh;object-fit:contain;display:block}
.tyh-gallery-stage button{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:26px;font-weight:900;cursor:pointer}
.tyh-gallery-stage button:disabled{opacity:.4;cursor:default}
.tyh-gallery-stage [data-gallery-prev],.tyh-gallery-stage [data-room-gallery-prev]{left:12px}
.tyh-gallery-stage [data-gallery-next],.tyh-gallery-stage [data-room-gallery-next]{right:12px}
.tyh-sheet-body{padding:16px 18px 18px}
.tyh-room-gallery-amens{padding:12px 16px 16px;border-top:1px solid var(--ty-line)}
.tyh-detail-desk .tyh-detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:stretch}
.tyh-detail-main{min-width:0}
.tyh-detail-hero-row{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start;padding:0 18px 8px}
.tyh-detail-gallery-wrap{min-width:0}
.tyh-detail-body-top{padding-bottom:8px}
.tyh-title-block .tyh-title-row h2{font-size:26px;line-height:1.25}
.tyh-book-box{position:sticky;top:84px;align-self:start;height:fit-content;background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:16px;box-shadow:0 10px 24px rgba(7,29,73,.06);display:grid;gap:10px}
.tyh-book-box-room b{display:block;color:var(--ty-navy);font-size:15px}
.tyh-book-box-room p{margin:4px 0 0;font-size:12px;color:#344054;font-weight:800}
.tyh-book-box-price strong{display:block;font-size:22px}
.tyh-book-box-price em{display:block;font-style:normal;color:var(--ty-muted);font-size:12px;font-weight:700}
.tyh-book-box .tyh-cta{width:100%}
.tyh-book-rating{display:flex;align-items:baseline;gap:8px}
.tyh-book-rating strong{font-size:20px;color:var(--ty-navy)}
.tyh-book-times{border-top:1px solid var(--ty-line);padding-top:8px}
.tyh-map-link{display:inline-flex;align-items:center;height:36px;margin-top:8px;color:var(--ty-blue);font-weight:900;text-decoration:none}
.tyh-rooms-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:8px 0 12px}
.tyh-rooms-head h3{margin:0;color:var(--ty-navy);font-size:18px}
.tyh-room-search{display:block;min-width:220px}
.tyh-room-search input{width:100%;height:40px;border:1px solid var(--ty-line);border-radius:12px;padding:0 12px}
.tyh-room-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.tyh-room-chip{border:1px solid var(--ty-line);background:#fff;border-radius:999px;padding:8px 12px;font-weight:900;color:var(--ty-navy);cursor:pointer}
.tyh-room-chip.active{border-color:var(--ty-blue);background:#eef6ff;color:var(--ty-blue)}
.tyh-cancel-table-wrap{overflow:auto}
.tyh-cancel-table{width:100%;border-collapse:collapse;font-size:13px}
.tyh-cancel-table th,.tyh-cancel-table td{border:1px solid var(--ty-line);padding:8px 10px;text-align:left}
.tyh-cancel-table th{background:#f8fbff;color:var(--ty-navy);font-weight:900}
.tyh-review-desk{max-width:1100px}
.tyh-guest-desk{max-width:1100px}
.tyh-review-grid,.tyh-guest-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:stretch}
.tyh-guest-main,.tyh-review-main{min-width:0}
.tyh-fare-summary{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:0;box-shadow:0 10px 24px rgba(7,29,73,.05);overflow:hidden}
.tyh-fare-head{padding:12px 16px;background:linear-gradient(180deg,#eef4ff 0%,#f7faff 100%);border-bottom:1px solid var(--ty-line)}
.tyh-fare-head h2,.tyh-fare-summary h2{margin:0;color:var(--ty-navy);font-size:16px;font-weight:900;letter-spacing:.02em;text-transform:uppercase}
.tyh-fare-summary .tyh-kv{padding:10px 16px;margin:0;border-bottom:1px solid #f1f5f9}
.tyh-fare-summary .tyh-kv.total{background:#f8fbff;border-bottom:0}
.tyh-fare-summary .tyh-cta{width:calc(100% - 32px);margin:12px 16px 16px}
.tyh-fare-summary .tyh-cta:disabled,.tyh-fare-summary .tyh-cta.tyh-cta-soft-disabled,.tyh-bottom button.tyh-cta-soft-disabled,[data-continue].tyh-cta-soft-disabled{opacity:.55;cursor:not-allowed}
.tyh-fare-sticky{position:sticky;top:84px;align-self:start;height:fit-content}
.tyh-fare-sheet{position:fixed;left:0;right:0;bottom:0;z-index:225;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -14px 40px rgba(0,0,0,.2);max-height:78vh;overflow:auto}
.tyh-fare-tap{display:flex;flex-direction:column;align-items:flex-start;background:transparent;border:0;color:#fff;padding:0;text-align:left;cursor:pointer}
.tyh-fare-tap span{font-size:12px;font-weight:800;color:#cbd5e1}
.tyh-fare-tap b{font-size:22px}
.tyh-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
.tyh-panel-head h2{margin:0}
.tyh-guest-help{margin:0 0 6px;color:var(--ty-navy);font-size:13px;font-weight:800}
.tyh-guest-slot{margin:0 0 12px;color:var(--ty-muted);font-size:12px;font-weight:900;letter-spacing:.02em}
.tyh-validate-msg{display:block;margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#fff1f0;border:1px solid #fecaca;color:var(--ty-red);font-size:13px;font-weight:800}
.tyh-validate-msg[hidden]{display:none!important}
.tyh-field-error input,.tyh-field-error select{border-color:var(--ty-red)!important;box-shadow:0 0 0 3px rgba(180,35,24,.12)}
.tyh-guest-names-grid{grid-template-columns:96px minmax(0,1fr) minmax(0,1fr);gap:10px}
.tyh-guest-title{max-width:96px}
.tyh-ccode{max-width:140px}
.tyh-ccode-filter{height:34px!important;margin-bottom:6px;font-size:12px!important;font-weight:700!important}
.tyh-contact-grid{grid-template-columns:1fr}
.tyh-book-box-room{display:grid;gap:4px}
.tyh-book-box-room .tyh-view-more-link{margin:0;justify-self:start}
.tyh-book-more{display:grid;gap:8px;padding-top:4px;border-top:1px solid #eef2f7}
.tyh-book-more span{color:var(--ty-muted);font-size:12px;font-weight:750}
.tyh-view-rooms-btn{height:40px;border:1px solid var(--ty-blue);border-radius:12px;background:#fff;color:var(--ty-blue);font-weight:900;cursor:pointer}
.tyh-booking-summary{align-items:start}
.tyh-mini-body{min-width:0}
.tyh-mini-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.tyh-mini-head-row h2{margin:0;flex:1;min-width:0}
.tyh-back-details{border:0;background:transparent;color:var(--ty-blue);font-size:12px;font-weight:900;cursor:pointer;white-space:normal;padding:0;text-align:left;align-self:flex-start;max-width:100%;line-height:1.35}
.tyh-stay-strip{margin-top:14px;border-radius:14px;background:#f5f7fa;border:1px solid #e4e9f2;overflow:hidden}
.tyh-stay-desk .tyh-stay-mainrow{display:grid;grid-template-columns:minmax(0,1.2fr) auto minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr);align-items:stretch}
.tyh-stay-desk .tyh-stay-cell{padding:14px 16px;min-width:0;border-left:1px solid #e4e9f2}
.tyh-stay-desk .tyh-stay-mainrow > .tyh-stay-cell:first-child{border-left:0}
.tyh-stay-desk .tyh-stay-nights{display:flex;align-items:center;justify-content:center;padding:14px 10px;border-left:1px solid #e4e9f2}
.tyh-stay-desk .tyh-stay-times{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e4e9f2}
.tyh-stay-desk .tyh-stay-times .tyh-stay-cell{border-left:1px solid #e4e9f2}
.tyh-stay-desk .tyh-stay-times .tyh-stay-cell:first-child{border-left:0}
.tyh-stay-mob{display:grid}
.tyh-stay-mob .tyh-stay-row{display:grid;align-items:stretch}
.tyh-stay-mob .tyh-stay-dates{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}
.tyh-stay-mob .tyh-stay-counts,.tyh-stay-mob .tyh-stay-times{grid-template-columns:1fr 1fr;border-top:1px solid #e4e9f2}
.tyh-stay-mob .tyh-stay-cell{padding:12px 14px;min-width:0}
.tyh-stay-mob .tyh-stay-dates .tyh-stay-cell:last-child,.tyh-stay-mob .tyh-stay-counts .tyh-stay-cell:last-child,.tyh-stay-mob .tyh-stay-times .tyh-stay-cell:last-child{border-left:1px solid #e4e9f2}
.tyh-stay-mob .tyh-stay-nights{display:flex;align-items:center;justify-content:center;padding:12px 8px;border-left:1px solid #e4e9f2;border-right:1px solid #e4e9f2}
.tyh-stay-cell small{display:block;color:#5b6b86;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin:0 0 6px;line-height:1.2;white-space:nowrap}
.tyh-stay-cell b{display:block;color:var(--ty-navy);font-size:14px;font-weight:900;line-height:1.3;word-break:break-word}
.tyh-stay-nights span{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 12px;border-radius:999px;background:#eef4ff;border:1px solid #c9daf5;color:var(--ty-navy);font-size:12px;font-weight:900;white-space:nowrap}
.tyh-selected-room-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0}
.tyh-selected-room-grid b{display:block;color:var(--ty-navy);font-size:15px}
.tyh-selected-room-grid span{display:block;margin-top:4px;color:#667085;font-size:12px;font-weight:750;line-height:1.4}
.tyh-selected-room-plan{text-align:right}
.tyh-selected-room-panel,.tyh-room-confirm-panel{padding-top:14px;padding-bottom:14px}
.tyh-room-confirm{margin:0;line-height:1.45}
.tyh-cancel-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;background:#f5f7fa;border-radius:12px;padding:14px 16px;color:var(--ty-navy);font-size:15px;font-weight:900;cursor:pointer}
.tyh-cancel-panel{padding:0;overflow:hidden}
.tyh-cancel-body{padding:12px 16px 16px}
.tyh-room-banner{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 10px;padding:10px 12px;border-radius:10px;background:linear-gradient(180deg,#eef4ff 0%,#f7faff 100%);border:1px solid #d9e6fb;color:var(--ty-navy);font-size:13px;font-weight:900}
.tyh-room-banner em{font-style:normal;color:var(--ty-blue);font-weight:800}
.tyh-img-fallback{display:block;width:100%;height:100%;background:linear-gradient(135deg,#e8eef8,#f7f9fc)}
.tyh-contact-grid{grid-template-columns:1fr}
.tyh-contact-email{grid-column:1 / -1}
.tyh-m-edit{width:40px;height:40px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:#f4f8ff;color:var(--ty-blue);font-weight:900;font-size:16px}
.tyh-search-compact{max-width:1180px;margin:12px auto 0;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:#fff;border:1px solid var(--ty-line);border-radius:16px;box-shadow:0 8px 20px rgba(7,29,73,.05)}
.tyh-search-compact-main{min-width:0;display:grid;gap:3px}
.tyh-search-compact-main strong{color:var(--ty-navy);font-size:16px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tyh-search-compact-main span,.tyh-search-compact-main em,.tyh-m-summary-main em{display:block;font-style:normal;color:var(--ty-muted);font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tyh-search-compact-edit{flex:0 0 auto;height:40px;border:1px solid var(--ty-line);border-radius:12px;background:#fff;color:var(--ty-blue);font-weight:900;padding:0 14px;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.tyh-edit-sheet-desk{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100% - 28px));border-radius:20px;max-height:min(88vh,760px)}
.tyh-more-opts-block{border:1px solid var(--ty-line);border-radius:14px;padding:12px;background:#f8fbff}
.tyh-more-opts-block h3{margin:0 0 10px;color:var(--ty-navy);font-size:14px}
.tyh-nat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tyh-nat-grid.compact{grid-template-columns:1fr}
.tyh-nat-grid label{display:grid;gap:6px;font-size:12px;font-weight:850;color:#344054}
.tyh-nat-grid select{height:44px;border:1px solid var(--ty-line);border-radius:12px;padding:0 10px;background:#fff;font-size:14px;color:#101828;width:100%}
.tyh-side-rail{display:grid;gap:12px;align-content:start}
.tyh-side-rail .tyh-fare-summary{margin:0}
.tyh-side-cta{width:100%;height:48px;border-radius:14px}
.tyh-offers-card{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:14px;box-shadow:0 10px 24px rgba(7,29,73,.05);display:grid;gap:10px}
.tyh-offers-card h2{margin:0;color:var(--ty-navy);font-size:16px}
.tyh-offer-hint{margin:4px 0 8px;color:#98a2b3;font-size:11px;font-weight:650;line-height:1.35}
.tyh-offer-apply-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
.tyh-offer-apply-row select{height:42px;border:1px solid var(--ty-line);border-radius:12px;padding:0 10px;background:#fff;font-weight:800;color:var(--ty-navy);min-width:0}
.tyh-offer-item{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--ty-line);border-radius:14px;padding:10px 12px;background:#f8fbff}
.tyh-offer-item.applied{background:#ecfdf3;border-color:#bbf7d0}
.tyh-offer-item b{display:block;color:var(--ty-navy);font-size:13px}
.tyh-offer-item p,.tyh-offer-item span{margin:2px 0 0;color:#344054;font-size:12px;font-weight:750}
.tyh-offer-apply{height:42px!important;padding:0 14px!important;font-size:13px!important;border-radius:12px!important;white-space:nowrap}
.tyh-section-head{margin:0 0 10px;padding:10px 12px;border-radius:12px;background:linear-gradient(180deg,#eef4ff 0%,#f7faff 100%);border:1px solid #e4ecf7}
.tyh-section-head h2{margin:0!important;font-size:16px!important;color:var(--ty-navy)!important}
.tyh-guest-slot{margin:0 0 12px;color:var(--ty-muted);font-size:13px;font-weight:800;line-height:1.45}
.tyh-saved-guests{margin:0 0 14px;display:grid;gap:8px}
.tyh-saved-guest-list{display:grid;gap:6px;max-height:160px;overflow:auto}
.tyh-saved-guest-row{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid var(--ty-line);border-radius:12px;background:#f8fbff;padding:10px 12px;cursor:pointer}
.tyh-saved-guest-row b{color:var(--ty-navy);font-size:13px}
.tyh-saved-guest-row span{color:var(--ty-muted);font-size:12px;font-weight:750}
.tyh-plus-guest,.tyh-cta-soft{height:40px;margin-top:10px;background:#fff!important;color:var(--ty-blue)!important;border:1px solid var(--ty-line)!important}
.tyh-pan-type{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 12px}
.tyh-radio{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#344054}

.tyh-selected-room-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:0}
.tyh-selected-room-grid b{display:block;color:var(--ty-navy);font-size:15px}
.tyh-selected-room-grid span{display:block;margin-top:4px;color:#667085;font-size:12px;font-weight:750;line-height:1.4}
.tyh-room-confirm{margin-top:0;line-height:1.45}
.tyh-general-terms ul{margin:8px 0;padding-left:18px;color:#344054;font-size:13px;line-height:1.45}
.tyh-general-terms h3,.tyh-booking-notes h3{margin:0 0 6px;color:var(--ty-navy);font-size:14px}
.tyh-rules-source{margin:0 0 10px;font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:var(--ty-navy)}
.tyh-rules-fallback ul{margin:8px 0 0;padding-left:18px;color:#344054;font-size:13px;line-height:1.45}
.tyh-rules-fallback li{margin:0 0 6px}
.tyh-guest-panel,.tyh-fare-summary,.tyh-offers-card,.tyh-panel{background:#fff}
.tyh-page{overflow-x:visible}
.tyh-book,.tyh-status,.tyh-book-flow{overflow-x:clip}
@media(min-width:861px){
.tyh-bottom{display:none!important}
.tyh-page{padding-bottom:28px}
}
@media(max-width:860px){
.tyh-nat-grid{grid-template-columns:1fr}
.tyh-search-compact{margin:10px 10px 0;padding:12px}
.tyh-offers-card,.tyh-fare-summary{width:100%;max-width:100%}
.tyh-offer-item{flex-wrap:wrap}
.tyh-stay-cell b{font-size:13px}
.tyh-selected-room-grid,.tyh-selected-room-plan{grid-template-columns:1fr;text-align:left}
.tyh-mini-head-row{flex-direction:column;align-items:flex-start;gap:6px}
.tyh-mini-head-row .tyh-back-details{display:none!important}
.tyh-mini-body h2{font-size:17px;line-height:1.25}
.tyh-panel{padding:12px;border-radius:14px}
.tyh-section-head h2{font-size:15px}
.tyh-book-flow .tyh-cta,.tyh-book-flow .tyh-side-cta{width:100%;max-width:100%}
.tyh-room-type-card{display:grid;grid-template-columns:1fr;gap:12px;padding:12px}
.tyh-room-media-img img{width:100%;height:180px;object-fit:cover;border-radius:12px}
.tyh-rate-text{padding:10px 0}
.tyh-rate-side strong{font-size:18px}
.tyh-hotel-rules-link{font-size:12px}
.tyh-book,.tyh-status{overflow-x:clip}
}
.tyh-coupon-box{margin:10px 0;padding-top:10px;border-top:1px dashed var(--ty-line);display:grid;gap:8px}
.tyh-offer-chip{border:1px solid var(--ty-line);background:#fff;border-radius:12px;padding:8px 10px;text-align:left;font-weight:800;color:var(--ty-navy);cursor:pointer}
.tyh-offer-chip:hover{border-color:var(--ty-blue);background:#eef6ff}
.tyh-edit-guest-note{margin:8px 0 0;font-size:12px;font-weight:700}
.tyh-policy-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0}
.tyh-policy-actions button,.tyh-hotel-rules-btn{border:1px solid #c9daf5;background:#f4f8ff;border-radius:12px;padding:10px 14px;font-weight:900;color:var(--ty-blue);cursor:pointer;font-size:13px}
.tyh-policy-actions button:hover,.tyh-hotel-rules-btn:hover{background:#eaf2ff}
.tyh-hotel-rules-link{border:0!important;background:transparent!important;border-radius:0!important;padding:0!important;margin:0;font-weight:800;font-size:13px;color:var(--ty-blue);cursor:pointer;text-decoration:underline;text-underline-offset:3px;line-height:1.4}
.tyh-hotel-rules-link:hover{color:var(--ty-navy);background:transparent!important}
.tyh-policy-actions button.active{background:#0062e3}
.tyh-mini{display:grid;gap:12px;grid-template-columns:1fr}
.tyh-mini-top{display:grid;grid-template-columns:150px minmax(0,1fr);gap:14px;align-items:start}
.tyh-stay-cell{min-width:0}
.tyh-save-guest-line{display:flex;align-items:flex-start;gap:8px;margin-top:12px;font-weight:800;color:var(--ty-navy)}
.tyh-check-sub{display:block;font-weight:700;font-size:12px;color:var(--ty-muted);margin-top:2px}
.tyh-saved-search{display:grid;gap:6px;margin:0 0 10px;font-weight:800;color:var(--ty-navy);font-size:13px}
.tyh-saved-search input{height:40px;border:1px solid var(--ty-line);border-radius:12px;padding:0 12px}
.tyh-pan-format-msg{margin:8px 0 0;font-size:12px;font-weight:700;color:var(--ty-muted)}
.tyh-pan-format-msg.tyh-ok{color:#067647}
@media(max-width:860px){
.tyh-mini-top{grid-template-columns:104px minmax(0,1fr);gap:12px}
.tyh-stay-mob .tyh-stay-nights span{min-height:28px;padding:0 8px;font-size:11px}
.tyh-stay-mob .tyh-stay-cell b{font-size:13px}
.tyh-stay-grid{grid-template-columns:1fr 1fr;gap:12px}
.tyh-stay-mid{grid-column:1 / -1;padding-top:0;order:3}
.tyh-stay-col-right{text-align:left}
.tyh-phone-row{grid-template-columns:96px minmax(0,1fr)}
.tyh-rate-text{grid-template-columns:1fr;gap:10px}
.tyh-rate-side{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.tyh-contact-grid{grid-template-columns:1fr}
}
.tyh-rule-row{margin:0 0 10px}
.tyh-rule-row b{display:block;color:var(--ty-navy);font-size:13px;margin-bottom:4px}
.tyh-rule-row p{margin:0;color:#344054;font-size:13px;line-height:1.45}
.tyh-book-flow{position:relative;overflow-x:clip}
.tyh-book.tyh-book-flow:before{content:'TravelYaraa';pointer-events:none;position:absolute;left:0;right:0;top:18%;height:140px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:clamp(28px,6vw,56px);font-weight:900;letter-spacing:.1em;color:rgba(7,29,73,.03);transform:rotate(-18deg);white-space:nowrap;z-index:0;overflow:hidden;max-width:100%}
.tyh-book.tyh-book-flow > *{position:relative;z-index:1}
.tyh-review-hero{min-height:220px;border-radius:16px;overflow:hidden;margin-bottom:12px}
.tyh-review-hero img{width:100%;height:220px;object-fit:cover;display:block}
.tyh-panel textarea{width:100%;min-height:84px;border:1px solid var(--ty-line);border-radius:12px;padding:10px 12px;font:inherit;resize:vertical}
body.tyh-modal-lock{overflow:hidden}
#tyhSheetPortal{position:fixed;inset:0;z-index:230;pointer-events:none}
#tyhSheetPortal .tyh-modal-bg,#tyhSheetPortal .tyh-sheet-modal{pointer-events:auto}
@media(max-width:860px){
.tyh-gallery-grid{display:none}
.tyh-detail-desk .tyh-detail-grid,.tyh-review-grid,.tyh-guest-grid{display:block}
.tyh-detail-hero-row{display:block;padding:0 12px}
.tyh-title-block .tyh-title-row h2{font-size:20px}
.tyh-book-box,.tyh-fare-sticky{position:static;margin-top:12px}
.tyh-guest-names-grid{grid-template-columns:88px minmax(0,1fr) minmax(0,1fr)}
.tyh-guest-title{max-width:88px}
.tyh-contact-grid{grid-template-columns:1fr}
.tyh-stay-grid{grid-template-columns:1fr}
.tyh-bottom{display:flex;gap:10px;align-items:center}
.tyh-bottom button[data-pay],.tyh-bottom button[data-continue]{min-width:0;flex:0 0 auto;padding:0 16px;height:46px}
.tyh-sheet-modal,.tyh-fare-sheet{top:auto;bottom:0;left:0;right:0;transform:none;width:100%;border-radius:22px 22px 0 0;max-height:86vh}
}
@media(max-width:420px){
.tyh-guest-names-grid{grid-template-columns:72px minmax(0,1fr);gap:8px}
.tyh-guest-names-grid .tyh-guest-title{grid-column:1;max-width:72px}
.tyh-guest-names-grid label:nth-child(2),
.tyh-guest-names-grid label:nth-child(3){grid-column:2}
.tyh-guest-title{max-width:72px}
.tyh-contact-grid{grid-template-columns:1fr}
.tyh-ccode{max-width:none}
.tyh-phone-row{grid-template-columns:84px minmax(0,1fr);gap:8px}
.tyh-bottom{padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));gap:8px}
.tyh-bottom .tyh-fare-tap{flex:1;min-width:0;padding:8px 10px}
.tyh-bottom button[data-pay]{flex:0 0 auto;padding:0 12px;font-size:13px;height:44px;white-space:nowrap}
.tyh-stay-cell small{font-size:10px}
.tyh-stay-cell b{font-size:12px}
}
.tyh-notify-root{position:fixed;inset:0;z-index:230;display:flex;align-items:center;justify-content:center;padding:20px}
.tyh-notify-root.tyh-notify-mobile{align-items:flex-end;padding:0}
.tyh-notify-bg{position:absolute;inset:0;background:rgba(7,29,73,.52)}
.tyh-notify-card{position:relative;width:min(92vw,460px);background:#fff;border-radius:20px;padding:22px 22px 18px;box-shadow:0 24px 60px rgba(7,29,73,.2);max-height:90vh;overflow:auto}
.tyh-notify-mobile .tyh-notify-card{width:100%;max-width:100%;border-radius:22px 22px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom,0px))}
.tyh-notify-title{margin:0 0 12px;color:var(--ty-navy);font-size:20px;font-weight:900;line-height:1.3}
.tyh-notify-msg{margin:0 0 12px;color:#344054;font-size:14px;line-height:1.5}
.tyh-notify-sub{margin:0 0 14px;color:var(--ty-muted);font-size:13px;line-height:1.45}
.tyh-notify-sub b{color:var(--ty-navy)}
.tyh-notify-prices{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 10px;padding:12px;border-radius:14px;background:linear-gradient(180deg,#f4f8ff 0%,#eef4ff 100%);border:1px solid #d9e6fb}
.tyh-notify-prices small{display:block;color:#5b6b86;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px}
.tyh-notify-prices b{display:block;color:var(--ty-navy);font-size:18px;font-weight:900}
.tyh-notify-prices .tyh-notify-new{color:#5c1630}
.tyh-notify-diff{margin:0 0 14px;color:var(--ty-muted);font-size:13px;font-weight:800}
.tyh-notify-actions{display:grid;gap:10px;margin-top:6px}
.tyh-notify-primary{width:100%;height:48px;border-radius:14px;background:var(--ty-cta)!important;color:#fff!important;border:0!important;font-weight:900}
.tyh-notify-secondary{width:100%;height:46px;border-radius:14px}
@media(min-width:861px){
.tyh-notify-actions{grid-template-columns:1fr 1fr}
.tyh-notify-primary{order:2}
.tyh-notify-secondary{order:1}
}
`; }

init();
})();

