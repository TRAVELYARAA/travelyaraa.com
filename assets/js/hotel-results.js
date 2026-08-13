(function(){
'use strict';

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
  all:[], shown:[], search:{}, sort:'recommended',
  filters:{
    priceRanges:new Set(), gst:null, propertyTypes:new Set(), places:new Set(),
    stars:new Set(), meals:new Set(), amenities:new Set(), min:0, max:0
  },
  filterTab:'price', roomHotel:null, selectedHotel:null, selectedOption:null, review:null,
  guestIndex:0
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
  if (code === 'HOTEL_CITY_AMBIGUOUS') return 'Multiple matching locations were found. Please choose an exact hotel location from the suggestions.';
  if (code === 'HOTEL_CITY_NOT_FOUND' || code === 'HOTEL_CITY_REQUIRED') return 'Please select a valid hotel location from the suggestions and search again.';
  if (code === 'HOTEL_MAPPING_EMPTY') return 'Hotels are not available for this exact location yet. Please choose a nearby Tripjack location suggestion and try again.';
  if (code === 'HOTEL_NO_AVAILABILITY' || code === 'NO_AVAILABILITY') return 'No hotels are available for the selected dates and location right now.';
  if (m.includes('city id') || m.includes('hotel city')) return 'Hotel city id is missing. Please select the hotel location again and search.';
  if (m.includes('tripjack') || m.includes('token') || m.includes('key') || m.includes('supplier')) return 'Hotel supplier connection is not available right now. Please try again later.';
  return (err && err.message) || 'Something went wrong. Please try again.';
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
async function api(path, body, method){ const verb=method||'POST'; const res=await fetch(API+path,{method:verb,headers:requestHeaders(path,verb!=='GET'),body:(verb==='GET'?undefined:JSON.stringify(body||{})),cache:'no-store'}); const data=await res.json().catch(()=>({})); if(!res.ok || data.success===false){ const e=new Error(data.message||data.error||data.code||('Request failed '+res.status)); e.data=data; e.status=res.status; throw e; } return unwrap(data); }
async function apiGet(path){ const res=await fetch(API+path,{headers:requestHeaders(path,false),cache:'no-store'}); const data=await res.json().catch(()=>({})); if(!res.ok || data.success===false){ const e=new Error(data.message||data.error||data.code||('Request failed '+res.status)); e.data=data; e.status=res.status; throw e; } return unwrap(data); }
function ensureHotelLoaderCss(){
  if(document.getElementById('tyHotelOnlyLoaderCss')) return;
  const st=document.createElement('style');
  st.id='tyHotelOnlyLoaderCss';
  st.textContent=`
  .tyh-loading-lock{overflow:hidden!important}
  .tyh-hotel-loader{
    position:fixed;
    inset:0;
    z-index:2147483000;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:24px;
    background:rgba(7,29,73,.82);
    backdrop-filter:blur(2px);
    -webkit-backdrop-filter:blur(2px);
  }
  .tyh-hotel-loader-box{
    width:min(92vw,360px);
    min-height:260px;
    border-radius:28px;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:22px;
    text-align:center;
    background:rgba(255,255,255,.10);
    border:1px solid rgba(255,255,255,.18);
    box-shadow:0 22px 70px rgba(0,0,0,.22);
  }
  .tyh-hotel-spin{
    width:92px;
    height:92px;
    border-radius:50%;
    border:7px solid rgba(255,255,255,.22);
    border-top-color:#ffffff;
    border-right-color:#eb814b;
    animation:tyhHotelSpin .9s linear infinite;
  }
  .tyh-hotel-loader-text{
    margin:0;
    color:#fff;
    font-size:20px;
    line-height:1.35;
    font-weight:900;
    letter-spacing:.01em;
  }
  @keyframes tyhHotelSpin{to{transform:rotate(360deg)}}
  @media(max-width:640px){
    .tyh-hotel-loader{padding:18px}
    .tyh-hotel-loader-box{width:92vw;min-height:240px;border-radius:24px;gap:20px}
    .tyh-hotel-spin{width:86px;height:86px;border-width:6px}
    .tyh-hotel-loader-text{font-size:18px;max-width:260px}
  }`;
  document.head.appendChild(st);
}
function showLoader(msg, hideText){
  try{ if(window.TravelYaraaLoader && typeof window.TravelYaraaLoader.hide==='function') window.TravelYaraaLoader.hide(); }catch(e){}
  ensureHotelLoaderCss();
  let el=document.getElementById('tyHotelOnlyLoader');
  if(!el){
    el=document.createElement('div');
    el.id='tyHotelOnlyLoader';
    el.className='tyh-hotel-loader';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.innerHTML='<div class="tyh-hotel-loader-box"><div class="tyh-hotel-spin" aria-hidden="true"></div><p class="tyh-hotel-loader-text"></p></div>';
    document.body.appendChild(el);
  }
  const t=el.querySelector('.tyh-hotel-loader-text');
  if(t){ t.textContent=hideText ? '' : (msg || 'Finding the best hotels for you...'); t.hidden=!!hideText; }
  el.style.display='flex';
  document.body.classList.add('tyh-loading-lock');
}
function hideLoader(){
  const el=document.getElementById('tyHotelOnlyLoader');
  if(el) el.style.display='none';
  document.body.classList.remove('tyh-loading-lock');
  try{ if(window.TravelYaraaLoader && typeof window.TravelYaraaLoader.hide==='function') window.TravelYaraaLoader.hide(); }catch(e){}
}

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
function propertyTypeOf(h){ const r=rawOf(h); return firstText(h.propertyType,h.type,h.pt,h.category,r.propertyType,r.ht,r.pt,deepFind(r,['propertyType','property_type','hotelType','ht','ptype','accommodationType'])) || 'Hotel'; }
function placeOf(h){ const r=rawOf(h); return firstText(h.area,h.locality,h.location,h.address,h.city,r.area,r.locality,r.location,r.ad,r.city,deepFind(r,['area','locality','location','landmark','zone','city'])); }
function mealBasisOf(h){ const ops=optionList(h); const vals=ops.map(o=>o.mealBasis).filter(Boolean); return firstText(vals[0],h.mealBasis,deepFind(rawOf(h),['mealBasis','mb','boardBasis','roomPlan'])); }
function gstOf(h){ const r=rawOf(h); return !!(h.gstApplicable || h.gst || h.gstEligible || boolFind(r,['gst','isGST','gstApplicable','isGstApplicable','gstAllowed','gstEligible'])); }
function verifiedOf(h){ const r=rawOf(h); return !!(h.verified || h.tjVerified || h.tripjackVerified || boolFind(r,['verified','tjVerified','isVerified','tripjackVerified'])); }
function bestRateOf(h){ const r=rawOf(h); return !!(h.bestRate || h.bestRateAvailable || boolFind(r,['bestRate','isBestRate','bestRateAvailable','preferredRate'])); }
function ratingCountOf(h){ const r=rawOf(h); const v=firstText(h.ratingCount,h.reviews,h.reviewCount,r.ratingCount,r.reviewCount,deepFind(r,['ratingCount','reviewCount','ratings','reviews'])); const x=Number(String(v).replace(/[^0-9.]/g,'')); return Number.isFinite(x)&&x>0?x:0; }
function priceRangeKey(p){ p=Number(p||0); if(!p) return ''; if(p<=2200) return '0-2200'; if(p<=2500) return '2201-2500'; if(p<=3000) return '2501-3000'; if(p<=3900) return '3001-3900'; if(p<=5600) return '3901-5600'; return '5601+'; }
function priceRangeLabel(k){ return ({'0-2200':'Up to ₹ 2,200','2201-2500':'₹ 2,201 – ₹ 2,500','2501-3000':'₹ 2,501 – ₹ 3,000','3001-3900':'₹ 3,001 – ₹ 3,900','3901-5600':'₹ 3,901 – ₹ 5,600','5601+':'₹ 5,601 +'}[k]||k); }
function countFor(fn){ return S.all.filter(fn).length; }
function uniqueValues(fn, max){ return [...new Set(S.all.map(fn).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,max||12); }

function mediaUrl(v){ if(!v)return ''; if(typeof v==='string')return v; return v.url||v.imageUrl||v.src||''; }
function imageOf(h){ const raw=h.raw||h; const imgs=[h.image,h.imageUrl,h.heroImage,h.thumbnail,mediaUrl(h.images&&h.images[0]),mediaUrl(h.imgs&&h.imgs[0]),mediaUrl(raw.heroImage),mediaUrl(raw.images&&raw.images[0]),mediaUrl(raw.img&&raw.img[0])].filter(Boolean); return String(imgs[0]||''); }
function priceOf(o,h){ const p=o&&o.pricing||{}; const c=[p.totalPrice,p.finalPrice,p.total,o&&o.totalPrice,o&&o.price,o&&o.tp,o&&o.tfcs&&o.tfcs.TF,o&&o.tfcs&&o.tfcs.NF,h&&h.price,h&&h.totalPrice,h&&h.totalAmount,h&&h.tp,h&&h.pops&&h.pops[0]&&h.pops[0].tpc]; for(const v of c){ const n=Number(v); if(n>0) return n; } return 0; }
function cancellationOf(op){ const c=op&&op.cancellation||op&&op.cancellationPolicy||op&&op.cnp||{}; const penalties=arr(c.penalties).length?arr(c.penalties):arr(c.pd); const refundable=c.isRefundable!==undefined?!!c.isRefundable:(c.refundable!==undefined?!!c.refundable:!(c.isNonRefundable===true||c.nonRefundable===true||c.inra===true)); const freeUntil=c.freeCancellationUntil||c.freeCancellationTill||c.deadline||((penalties.find(x=>Number(x.amount!=null?x.amount:x.am)===0)||{}).toDate)||((penalties.find(x=>Number(x.amount!=null?x.amount:x.am)===0)||{}).tdt)||''; return {refundable,freeCancellation:!!(c.freeCancellation===true||c.ifra===true||freeUntil),freeCancellationUntil:freeUntil,penalties,raw:c}; }
function normOption(op, h, i){ op=op||{}; const rooms=arr(op.roomInfo).length?arr(op.roomInfo):(arr(op.rooms).length?arr(op.rooms):arr(op.ris)); const first=rooms[0]||{}; const id=op.optionId||op.id||op.code||op.op||first.id||first.roomId||first.rc||('room_'+i); const cancel=cancellationOf(op); const roomName=op.roomSummary||op.roomName||first.roomCategory||first.roomType||first.name||first.rc||first.rt||'Room option'; const meal=op.mealBasis||op.boardBasis||op.mb||first.mealBasis||first.boardBasis||first.mb||''; return { id:String(id), optionId:String(id), roomType:String(roomName), roomSummary:String(roomName), mealBasis:String(meal), totalPrice:priceOf(op,h), baseFare:Number(op.baseFare||op.pricing&&op.pricing.basePrice||0), taxes:Number(op.taxes||op.pricing&&op.pricing.taxes||0), currency:op.currency||op.pricing&&op.pricing.currency||h.currency||'INR', refundable:cancel.refundable, freeCancellation:cancel.freeCancellation, cancellation:cancel, cancellationPolicy:cancel.raw, bookingNotes:op.bookingNotes||op.notes||[], rooms:rooms, raw:op }; }
function optionList(h){ const raw=h.raw||h; let ops=[]; if(arr(h.options).length) ops=arr(h.options); else if(arr(raw.options).length) ops=raw.options; else if(raw.option) ops=[raw.option]; else if(arr(raw.ops).length) ops=raw.ops; else if(arr(raw.hInfo&&raw.hInfo.ops).length) ops=raw.hInfo.ops; else if(arr(raw.data&&raw.data.hInfo&&raw.data.hInfo.ops).length) ops=raw.data.hInfo.ops; return ops.map((op,i)=>normOption(op,h,i)); }
function amenityName(x){ return typeof x==='string'?x:(x&&x.name||x&&x.label||x&&x.description||x&&x.value||''); }
function amenitiesOf(h){ const raw=h.raw||h; const vals=[].concat(arr(h.amenities),arr(h.facilities),arr(raw.amenities),arr(raw.facilities),arr(raw.hotelFacilities),arr(raw.fl),arr(raw.inst).map(x=>x&&x.msg),arr(raw.ops&&raw.ops[0]&&raw.ops[0].ris&&raw.ops[0].ris[0]&&raw.ops[0].ris[0].fcs)); return vals.map(amenityName).filter(Boolean).map(String); }
function normHotel(h,i){
  h=h||{};
  const raw=h.raw||h;
  const hInfo=raw.hotel||raw.hotelInfo||raw.hInfo || (raw.data&&(raw.data.hotel||raw.data.hotelInfo||raw.data.hInfo)) || h.hInfo || null;
  if(hInfo) h=Object.assign({}, hInfo, h, {raw:raw});
  const name=h.name||h.hotelName||h.propertyName||(hInfo&&hInfo.name)||'';
  const options=optionList(Object.assign({},h,{raw:raw}));
  const price=options[0]&&options[0].totalPrice ? options[0].totalPrice : priceOf({},h);
  const context=h.searchContext||raw.searchContext||S.search.searchContext||{};
  const id=h.tjHotelId||h.hotelId||h.id||h.hid||'';
  const base={
    key:String(id||h.uid||('hotel_'+i)),
    id:id, hotelId:id, tjHotelId:id,
    name:name||'Hotel', area:h.area||h.locality||h.location||'', address:typeof h.address==='string'?h.address:(h.address&&h.address.addressLine1)||h.ad||'',
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
  base.verified=verifiedOf(Object.assign({},base,h,{raw:raw}));
  base.bestRate=bestRateOf(Object.assign({},base,h,{raw:raw}));
  return base;
}
function extractResults(data){ data=unwrap(data)||{}; const context=data.searchContext||{}; const list=data.results||data.hotels||data.items||data.data||data.hotelInfos||data.hInfoList||data.searchResult||[]; return arr(list).map((h,i)=>normHotel(Object.assign({},h,{searchContext:h.searchContext||context}),i)); }

function setPage(step, extra){ const url='/pages/results/hotels.html?service=hotel&step='+encodeURIComponent(step||'results')+(extra?'&'+extra:''); try{ history.pushState({service:'hotel',step},'',url); }catch(e){} }
function shell(content, opts){ opts=opts||{}; const s=S.search||{}; const title=opts.title || s.cityName || s.city || s.destination || s.location || 'Hotels'; const sub=[s.checkIn||s.checkinDate, s.checkOut||s.checkoutDate].filter(Boolean).map(fmtDate).join(' to '); root.innerHTML = '<style>'+css()+'</style><div class="tyh-page"><header class="tyh-top"><button type="button" class="tyh-back" data-back>‹</button><div class="tyh-top-title"><h1>'+esc(title)+'</h1><p>'+esc(opts.sub||sub||'Select your stay')+'</p></div>'+(opts.status?'<span class="tyh-status-pill">'+esc(opts.status)+'</span>':'')+'</header>'+content+'</div>'; bindBase(); }
function bindBase(){ const b=q('[data-back]',root); if(b) b.onclick=()=>{ if(new URLSearchParams(location.search).get('step')&&new URLSearchParams(location.search).get('step')!=='results') { setPage('results'); renderResults(); } else history.back(); }; }

function hotelSearchExpired(data){ const d=unwrap(data)||{}; const expires=d.expiresAt||d.searchContext&&d.searchContext.expiresAt; return !!(expires && Date.parse(expires)<=Date.now()); }
async function loadResults(){
  S.search=searchPayload();
  const stored=read(KEY.results,null);
  const storedList=stored&&!hotelSearchExpired(stored)?extractResults(stored):[];
  if(storedList.length){
    const d=unwrap(stored)||{};
    S.search=Object.assign({},S.search,{searchContext:d.searchContext||storedList[0].searchContext||{}});
    setResults(storedList);
    return;
  }
  try{
    showLoader('Finding the best hotels for you...');
    const res=await api('/api/hotels/search',S.search);
    save(KEY.results,res);
    const d=unwrap(res)||{};
    S.search=Object.assign({},S.search,{searchContext:d.searchContext||{}});
    const list=extractResults(res);
    if(!list.length){
      const reason=String(d.emptyReason||'').toUpperCase();
      const message = reason==='NO_AVAILABILITY'
        ? 'No hotels are available for the selected dates and location right now.'
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
  }finally{ hideLoader(); }
}
function setResults(list){ S.all=list; applyFilters(); }
function applyFilters(){
  let list=S.all.slice();
  if(S.filters.priceRanges.size) list=list.filter(h=>S.filters.priceRanges.has(priceRangeKey(h.price)));
  if(S.filters.gst!==null) list=list.filter(h=>gstOf(h)===S.filters.gst);
  if(S.filters.propertyTypes.size) list=list.filter(h=>S.filters.propertyTypes.has(lower(propertyTypeOf(h))));
  if(S.filters.places.size) list=list.filter(h=>S.filters.places.has(lower(placeOf(h))));
  if(S.filters.stars.size) list=list.filter(h=>S.filters.stars.has(String(Math.round(h.star)||0)));
  if(S.filters.meals.size) list=list.filter(h=>S.filters.meals.has(lower(mealBasisOf(h))));
  if(S.filters.amenities.size){ list=list.filter(h=>{ const hay=(h.amenities||[]).join(' ').toLowerCase(); return [...S.filters.amenities].every(a=>hay.includes(a)); }); }
  if(S.filters.min) list=list.filter(h=>Number(h.price||0)>=S.filters.min);
  if(S.filters.max) list=list.filter(h=>Number(h.price||0)<=S.filters.max);
  if(S.sort==='priceLow') list.sort((a,b)=>(a.price||9999999)-(b.price||9999999));
  else if(S.sort==='priceHigh') list.sort((a,b)=>(b.price||0)-(a.price||0));
  else if(S.sort==='starHigh') list.sort((a,b)=>(b.star||0)-(a.star||0)||((a.price||9999999)-(b.price||9999999)));
  else if(S.sort==='rating') list.sort((a,b)=>(b.rating||0)-(a.rating||0)||((a.price||9999999)-(b.price||9999999)));
  else list.sort((a,b)=>(b.verified?1:0)-(a.verified?1:0)||(b.bestRate?1:0)-(a.bestRate?1:0)||(b.rating||0)-(a.rating||0)||((a.price||9999999)-(b.price||9999999)));
  S.shown=list;
  renderResults();
}
function activeFilterCount(){ return S.filters.priceRanges.size + (S.filters.gst!==null?1:0) + S.filters.propertyTypes.size + S.filters.places.size + S.filters.stars.size + S.filters.meals.size + S.filters.amenities.size + (S.filters.min?1:0) + (S.filters.max?1:0); }
function filterOption(kind,value,label,count){ const key=String(value); const checked = kind==='gst' ? (S.filters.gst===value) : (S.filters[kind]&&S.filters[kind].has(key)); return '<label class="tyh-fcheck"><input type="checkbox" data-fkind="'+attr(kind)+'" data-fvalue="'+attr(key)+'" '+(checked?'checked':'')+'><span></span><b>'+esc(label)+'</b><em>('+(count||0)+')</em></label>'; }
function filterPanel(){
  const tab=S.filterTab||'price';
  const tabs=[['price','Price range'],['gst','GST applicable'],['propertyTypes','Property type'],['places','Popular places'],['stars','Star category'],['meals','Meal basis']];
  const propertyVals=uniqueValues(propertyTypeOf,10);
  const placeVals=uniqueValues(placeOf,10);
  const mealVals=uniqueValues(mealBasisOf,10);
  const priceKeys=['0-2200','2201-2500','2501-3000','3001-3900','3901-5600','5601+'];
  let body='';
  if(tab==='price') body=priceKeys.map(k=>filterOption('priceRanges',k,priceRangeLabel(k),countFor(h=>priceRangeKey(h.price)===k))).join('') || '<p class="tyh-muted">No price filter available</p>';
  else if(tab==='gst') body=filterOption('gst',true,'GST applicable',countFor(h=>gstOf(h)))+filterOption('gst',false,'GST not listed',countFor(h=>!gstOf(h)));
  else if(tab==='propertyTypes') body=(propertyVals.length?propertyVals.map(v=>filterOption('propertyTypes',lower(v),v,countFor(h=>lower(propertyTypeOf(h))===lower(v)))).join(''):'<p class="tyh-muted">No property type available</p>');
  else if(tab==='places') body=(placeVals.length?placeVals.map(v=>filterOption('places',lower(v),v,countFor(h=>lower(placeOf(h))===lower(v)))).join(''):'<p class="tyh-muted">No place filter available</p>');
  else if(tab==='stars') body=[5,4,3,2,1].map(v=>filterOption('stars',String(v),v+' star',countFor(h=>String(Math.round(h.star)||0)===String(v)))).join('');
  else if(tab==='meals') body=(mealVals.length?mealVals.map(v=>filterOption('meals',lower(v),v,countFor(h=>lower(mealBasisOf(h))===lower(v)))).join(''):'<p class="tyh-muted">No meal basis available</p>');
  return '<aside class="tyh-filter"><div class="tyh-filter-head"><button type="button" data-filter-close>‹</button><h2>Filters</h2><button type="button" data-clear-top>Reset filters</button></div><div class="tyh-filter-grid"><nav>'+tabs.map(x=>'<button type="button" class="'+(tab===x[0]?'active':'')+'" data-filter-tab="'+x[0]+'">'+esc(x[1])+'</button>').join('')+'</nav><section>'+body+'</section></div><div class="tyh-filter-actions"><button type="button" data-filter-close>Close</button><button type="button" data-apply>Apply filter</button></div></aside>';
}
function sortSheet(){ return '<div class="tyh-sort-bg" data-sort-close></div><section class="tyh-sort-sheet"><header><h2>Sort by</h2><button type="button" data-sort-close>×</button></header>'+[['recommended','Most popular'],['priceLow','Price <span>Lowest first</span>'],['priceHigh','Price <span>Highest first</span>'],['starHigh','Star rating <span>High to Low</span>']].map(x=>'<button type="button" class="'+(S.sort===x[0]?'active':'')+'" data-sort-pick="'+x[0]+'"><b>'+x[1]+'</b><i></i></button>').join('')+'</section>'; }
function renderResults(){
  const s=S.search||{};
  const city=s.cityName||s.city||s.destination||s.location||'Hotels';
  const count=activeFilterCount();
  const content='<main class="tyh-results"><section class="tyh-list-wrap"><div class="tyh-search-line"><div><strong>Showing '+esc(S.shown.length)+' hotels for '+esc(city)+'</strong><span>'+esc([fmtDate(s.checkIn||s.checkinDate),fmtDate(s.checkOut||s.checkoutDate)].filter(Boolean).join(' • '))+'</span></div></div><div class="tyh-mobile-tools"><button type="button" data-mobile-filter>⌖</button><button type="button" data-mobile-filter>Filters'+(count?' ('+count+')':'')+'</button><button type="button" data-mobile-sort>Sort by</button></div><div class="tyh-desktop-sort"><button class="'+(S.sort==='recommended'?'active':'')+'" data-sort-pick="recommended">Most popular</button><button class="'+(S.sort==='priceLow'?'active':'')+'" data-sort-pick="priceLow">Price low</button><button class="'+(S.sort==='priceHigh'?'active':'')+'" data-sort-pick="priceHigh">Price high</button><button class="'+(S.sort==='starHigh'?'active':'')+'" data-sort-pick="starHigh">Star rating</button></div><div class="tyh-cards">'+(S.shown.length?S.shown.map(hotelCard).join(''):'<div class="tyh-empty"><h2>No hotels found</h2><p>Try changing filters or search again.</p></div>')+'</div></section>'+filterPanel()+'</main>'+(document.body.classList.contains('tyh-sort-open')?sortSheet():'')+(S.roomHotel?roomSheet(S.roomHotel):'');
  shell(content,{title:city, sub:'Hotel results'});
  bindResults();
}
function hotelCard(h){
  const stars='★'.repeat(Math.max(0,Math.min(5,Math.round(h.star||0))));
  const topBadges=(h.verified?'<span class="ok">✓ TJ verified</span>':'')+(h.bestRate?'<span class="rate">◆ Best rate</span>':'');
  const facilities=arr(h.amenities).slice(0,3).map(a=>'<span>'+esc(a)+'</span>').join('');
  const meal=mealBasisOf(h);
  const rating=h.rating?('<strong>'+esc(h.rating)+'</strong><span>'+(h.rating>=4?'Good':'Rating')+(h.ratingCount?' <br>('+esc(h.ratingCount)+' Ratings)':'')+'</span>'):'';
  return '<article class="tyh-card"><div class="tyh-img">'+(h.image?'<img src="'+attr(h.image)+'" alt="'+attr(h.name)+'">':'<span>'+esc((h.name||'H').slice(0,1))+'</span>')+'<div class="tyh-card-badges">'+topBadges+'</div></div><div class="tyh-info"><div class="tyh-title-row"><h2>'+esc(h.name)+'</h2><div class="tyh-stars">'+stars+'</div></div><p class="tyh-location">'+esc([h.area||h.place,h.city].filter(Boolean).join(', ')||h.address||'Location available after selection')+'</p><div class="tyh-facilities">'+facilities+'</div>'+(meal?'<p class="tyh-meal">• '+esc(meal)+'</p>':'')+'<div class="tyh-card-foot"><div class="tyh-rating">'+rating+'</div><div class="tyh-price"><small>'+esc(money(h.price))+'/night</small><b>'+esc(money(h.price))+'</b><em>Total incl. taxes</em></div></div>'+(gstOf(h)?'<div class="tyh-gst">GST claim eligible rates available</div>':'')+'<button type="button" data-room="'+attr(h.key)+'">View rooms</button></div></article>';
}
function setFilterValue(kind,value,checked){
  if(kind==='gst'){ S.filters.gst = checked ? (value==='true') : null; return; }
  const set=S.filters[kind]; if(!set) return;
  checked ? set.add(value) : set.delete(value);
}
function clearFilters(){ S.filters.priceRanges.clear(); S.filters.gst=null; S.filters.propertyTypes.clear(); S.filters.places.clear(); S.filters.stars.clear(); S.filters.meals.clear(); S.filters.amenities.clear(); S.filters.min=0; S.filters.max=0; }
function closeFilter(){ document.body.classList.remove('tyh-filter-open'); }
function closeSort(){ document.body.classList.remove('tyh-sort-open'); renderResults(); }
function bindResults(){
  qa('[data-mobile-filter]',root).forEach(b=>b.onclick=()=>document.body.classList.add('tyh-filter-open'));
  qa('[data-filter-close]',root).forEach(b=>b.onclick=closeFilter);
  qa('[data-filter-tab]',root).forEach(b=>b.onclick=()=>{ S.filterTab=b.dataset.filterTab; renderResults(); document.body.classList.add('tyh-filter-open'); });
  qa('[data-fkind]',root).forEach(i=>i.onchange=()=>{ setFilterValue(i.dataset.fkind,i.dataset.fvalue,i.checked); renderResults(); document.body.classList.add('tyh-filter-open'); });
  const apply=q('[data-apply]',root); if(apply) apply.onclick=()=>{ closeFilter(); applyFilters(); };
  qa('[data-clear-top], [data-clear]',root).forEach(b=>b.onclick=()=>{ clearFilters(); applyFilters(); document.body.classList.add('tyh-filter-open'); });
  qa('[data-sort-pick]',root).forEach(b=>b.onclick=()=>{ S.sort=b.dataset.sortPick; document.body.classList.remove('tyh-sort-open'); applyFilters(); });
  qa('[data-mobile-sort]',root).forEach(b=>b.onclick=()=>{ document.body.classList.add('tyh-sort-open'); renderResults(); });
  qa('[data-sort-close]',root).forEach(b=>b.onclick=closeSort);
  qa('[data-room]',root).forEach(b=>b.onclick=()=>{ const h=S.shown.find(x=>x.key===b.dataset.room); if(h) openRooms(h); });
  qa('[data-close]',root).forEach(b=>b.onclick=()=>{ S.roomHotel=null; renderResults(); });
  qa('[data-review-room]',root).forEach(b=>b.onclick=()=>{ if(S.roomHotel) startReview(S.roomHotel,b.dataset.reviewRoom); });
}

async function openRooms(h){ S.roomHotel=h; renderResults(); if(optionList(h).length&&h.reviewHash) return; try{ showLoader('Loading room options…'); const context=h.searchContext||S.search.searchContext||{}; const res=await api('/api/hotels/detail',{hid:h.hotelId||h.id,hotelId:h.hotelId||h.id,searchContext:context}); const d=unwrap(res)||{}; const detailHotel=normHotel(Object.assign({},h,d.hotel||d,{reviewHash:d.reviewHash||'',searchContext:d.searchContext||context,raw:d.raw||d}),0); S.roomHotel=Object.assign({},h,detailHotel,{key:h.key,reviewHash:d.reviewHash||detailHotel.reviewHash||'',searchContext:d.searchContext||context}); S.all=S.all.map(x=>x.key===h.key?S.roomHotel:x); S.shown=S.shown.map(x=>x.key===h.key?S.roomHotel:x); renderResults(); }catch(e){ const rb=q('.tyh-room-body',root); if(rb) rb.innerHTML='<p class="tyh-muted">'+esc(friendlyError(e))+'</p>'; }finally{ hideLoader(); } }
function roomSheet(h){ const opts=optionList(h); return '<div class="tyh-modal-bg" data-close></div><section class="tyh-room"><header><div><h2>'+esc(h.name)+'</h2><p>'+esc(h.address||h.area||'Room options')+'</p></div><button type="button" data-close>×</button></header><div class="tyh-room-body">'+(opts.length?opts.map(o=>'<article class="tyh-rate"><div><b>'+esc(o.roomSummary||o.roomType)+'</b><p>'+esc(o.mealBasis||'Room plan')+'</p>'+(o.refundable?'<span>Free cancellation</span>':'')+'</div><div><strong>'+esc(money(o.totalPrice))+'</strong><button type="button" data-review-room="'+attr(o.optionId)+'">Continue</button></div></article>').join(''):'<p class="tyh-muted">Room options are unavailable for this hotel.</p>')+'</div></section>'; }
async function startReview(h, optionId){
  const selectedBeforeReview=optionList(h).find(o=>String(o.optionId)===String(optionId))||{};
  try{
    showLoader('Verifying hotel price and policy…');
    const context=h.searchContext||S.search.searchContext||{};
    const res=await api('/api/hotels/review',{hid:h.hotelId||h.id,hotelId:h.hotelId||h.id,optionId:optionId,reviewHash:h.reviewHash||'',searchContext:context});
    const raw=res.raw||res.review&&res.review.raw||res;
    const reviewData=res.review||{};
    const reviewedHotel=reviewData.hotel ? normHotel(Object.assign({},reviewData.hotel,{searchContext:res.searchContext||context}),0) : h;
    const reviewedOption=reviewData.option ? normOption(reviewData.option,reviewedHotel,0) : (optionList(reviewedHotel).find(o=>String(o.optionId)===String(optionId)) || selectedBeforeReview);
    const oldAmount=priceOf(selectedBeforeReview,h);
    const reviewedAmount=priceOf(reviewedOption,reviewedHotel) || oldAmount;
    const priceChanged=Boolean(reviewData.isPriceChanged) || (oldAmount>0 && reviewedAmount>0 && Math.abs(reviewedAmount-oldAmount)>0.01);
    if(priceChanged){
      const accepted=window.confirm('The hotel price changed from '+money(oldAmount)+' to '+money(reviewedAmount)+'. Continue with the latest Tripjack price?');
      if(!accepted) return;
    }
    S.selectedHotel=Object.assign({},h,reviewedHotel,{searchContext:res.searchContext||context});
    S.selectedOption=reviewedOption;
    S.review=res;
    const reviewBookingId=reviewData.bookingId||raw.bookingId||res.bookingId||'';
    if(!reviewBookingId) throw new Error('Tripjack did not return a hotel booking reference. Please select the room again.');
    const draft={service:'hotel',hotel:S.selectedHotel,selected:S.selectedHotel,option:reviewedOption,optionId,reviewHash:h.reviewHash||res.reviewHash||'',searchContext:res.searchContext||context,tripjackReviewRaw:raw,tripjackReviewBookingId:reviewBookingId,cancellationPolicyRaw:reviewedOption.cancellationPolicy||{},finalPayableAmount:reviewedAmount,searchPayload:Object.assign({},S.search,{searchContext:res.searchContext||context}),contact:{countryCode:'+91'},guests:defaultGuests(),gst:{enabled:false},clientRequestId:newHotelClientRequestId(),createdAt:new Date().toISOString()};
    save(KEY.selected,{service:'hotel',hotel:S.selectedHotel,option:reviewedOption,optionId,review:res,search:S.search});
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

function init(){ const params=new URLSearchParams(location.search); const step=params.get('step')||'results'; const bookingId=params.get('bookingId')||params.get('id'); if(step==='booking-status'&&bookingId){ loadStatusById(bookingId); return; } if(step==='guest'&&read(KEY.draft,null)){ S.search=searchPayload(); setPage('guest'); renderGuestStep(); return; } if(step==='review'&&read(KEY.draft,null)){ S.search=searchPayload(); setPage('review'); renderReviewStep(); return; } setPage('results'); loadResults(); }
window.addEventListener('popstate',()=>{ const step=new URLSearchParams(location.search).get('step')||'results'; if(step==='guest')renderGuestStep(); else if(step==='review')renderReviewStep(); else if(step==='booking-status'){ const id=new URLSearchParams(location.search).get('bookingId'); id?loadStatusById(id):renderStatus(read(KEY.status,{})); } else renderResults(); });

function css(){ return `
:root{--ty-navy:#071d49;--ty-blue:#0062e3;--ty-orange:#ef6614;--ty-bg:#f4f7fb;--ty-line:#e4ecf7;--ty-text:#101828;--ty-muted:#667085;--ty-soft:#eef6ff;--ty-green:#067647;--ty-red:#b42318}*{box-sizing:border-box}body.ty-hotel-page,body.travel-page{margin:0;background:var(--ty-bg);font-family:Inter,Arial,sans-serif;color:var(--ty-text);text-transform:none}.tyh-page{min-height:100vh;background:var(--ty-bg);padding-bottom:110px}.tyh-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid var(--ty-line);box-shadow:0 4px 16px rgba(7,29,73,.04)}.tyh-back{width:42px;height:42px;border:0;border-radius:14px;background:#f1f6ff;color:var(--ty-navy);font-size:30px;font-weight:900;line-height:1}.tyh-top-title{min-width:0;flex:1}.tyh-top h1{margin:0;color:var(--ty-navy);font-size:20px;font-weight:900;letter-spacing:0}.tyh-top p{margin:3px 0 0;color:var(--ty-muted);font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tyh-status-pill{background:#e7f8ef;color:#067647;border:1px solid #c8f1da;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:900}.tyh-results{max-width:1180px;margin:14px auto;display:grid;grid-template-columns:260px minmax(0,1fr);gap:14px;padding:0 14px}.tyh-filter{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:16px;position:sticky;top:76px;align-self:start}.tyh-filter h2{margin:0 0 12px;color:var(--ty-navy);font-size:18px}.tyh-filter h3{font-size:14px;margin:14px 0 8px;color:var(--ty-navy)}.tyh-filter label{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px;font-weight:750;color:#344054;line-height:1.3}.tyh-filter input[type=number]{width:100%;height:38px;border:1px solid var(--ty-line);border-radius:10px;padding:0 10px;margin:5px 0;font-size:14px}.tyh-filter-actions{display:flex;gap:8px;border-top:1px solid var(--ty-line);padding-top:12px;margin-top:12px}.tyh-filter-actions button{flex:1;height:40px;border-radius:12px;border:1px solid var(--ty-line);background:#fff;color:var(--ty-navy);font-weight:900}.tyh-filter-actions button:first-child{border:0;background:var(--ty-orange);color:#fff}.tyh-search-line{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--ty-line);border-radius:16px;padding:14px;margin-bottom:12px}.tyh-search-line strong{display:block;color:var(--ty-navy);font-size:18px}.tyh-search-line span{display:block;color:var(--ty-muted);font-size:12px;margin-top:3px}.tyh-search-line button{display:none;border:1px solid var(--ty-line);background:#fff;border-radius:12px;height:38px;padding:0 12px;font-weight:900;color:var(--ty-navy)}.tyh-sort{display:flex;gap:10px;overflow:auto;margin-bottom:12px}.tyh-sort button{border:1px solid var(--ty-line);background:#fff;border-radius:999px;padding:10px 14px;font-weight:900;color:var(--ty-navy);white-space:nowrap}.tyh-sort button.active{border-color:var(--ty-blue);background:#eef6ff;color:var(--ty-blue)}.tyh-cards{display:grid;gap:14px}.tyh-card{background:#fff;border:1px solid var(--ty-line);border-radius:20px;box-shadow:0 10px 28px rgba(7,29,73,.07);display:grid;grid-template-columns:230px minmax(0,1fr) 190px;overflow:hidden}.tyh-img{min-height:178px;background:#eef6ff;display:grid;place-items:center;color:var(--ty-blue);font-size:42px;font-weight:900}.tyh-img img{width:100%;height:100%;object-fit:cover}.tyh-info{padding:16px;min-width:0}.tyh-info h2{margin:0 0 6px;color:#101828;font-size:20px;line-height:1.25;font-weight:900;letter-spacing:0}.tyh-info p{margin:0;color:var(--ty-muted);font-size:13px;font-weight:700;line-height:1.35}.tyh-stars{color:#f5b301;margin:9px 0;font-size:14px;letter-spacing:1px}.tyh-tags{display:flex;gap:6px;flex-wrap:wrap}.tyh-tags span,.tyh-rate span{background:#f2f4f7;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:800;color:#344054}.tyh-price{border-left:1px solid var(--ty-line);padding:16px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:7px;text-align:right}.tyh-price em{background:#067647;color:#fff;border-radius:9px;padding:5px 8px;font-size:12px;font-style:normal;font-weight:900}.tyh-price b{font-size:22px;color:#101828}.tyh-price small{color:var(--ty-muted);font-size:11px;font-weight:700}.tyh-price button,.tyh-rate button,.tyh-bottom button,.tyh-actions button,.tyh-empty button{height:42px;border:0;border-radius:13px;background:var(--ty-orange);color:#fff;padding:0 16px;font-weight:900;font-size:14px}.tyh-empty{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:28px;text-align:center;margin:12px}.tyh-empty h2{margin:0 0 8px;color:var(--ty-navy)}.tyh-empty p,.tyh-muted{color:var(--ty-muted);font-weight:700}.tyh-modal-bg{position:fixed;inset:0;background:rgba(7,29,73,.45);z-index:70}.tyh-room{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:80;width:min(780px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -12px 35px rgba(7,29,73,.18)}.tyh-room header{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--ty-line);padding:16px;display:flex;justify-content:space-between;gap:12px}.tyh-room h2{margin:0;color:var(--ty-navy);font-size:19px}.tyh-room header p{margin:4px 0 0;color:var(--ty-muted);font-size:12px}.tyh-room header button{width:38px;height:38px;border:0;border-radius:12px;background:#f2f4f7;font-size:24px}.tyh-room-body{padding:16px}.tyh-rate{border:1px solid var(--ty-line);border-radius:16px;padding:14px;margin-bottom:12px;display:flex;justify-content:space-between;gap:12px}.tyh-rate b{display:block;color:#101828;font-size:15px;line-height:1.3}.tyh-rate p{margin:6px 0;color:var(--ty-muted);font-size:12px}.tyh-rate strong{display:block;text-align:right;margin-bottom:8px;font-size:18px}.tyh-book,.tyh-status{max-width:920px;margin:14px auto;padding:0 14px;display:grid;gap:14px}.tyh-summary-card,.tyh-panel,.tyh-actions,.tyh-confirm{background:#fff;border:1px solid var(--ty-line);border-radius:18px;padding:16px;box-shadow:0 10px 24px rgba(7,29,73,.05)}.tyh-mini{display:grid;grid-template-columns:150px minmax(0,1fr);gap:14px;align-items:center}.tyh-mini-img{height:115px;border-radius:14px;background:#eef6ff;display:grid;place-items:center;overflow:hidden;color:var(--ty-blue);font-size:40px;font-weight:900}.tyh-mini-img img{width:100%;height:100%;object-fit:cover}.tyh-mini h2{margin:0 0 6px;color:var(--ty-navy);font-size:21px;line-height:1.25}.tyh-mini p{margin:0;color:var(--ty-muted);font-size:13px;line-height:1.35}.tyh-room-name{margin-top:8px!important;color:#344054!important;font-weight:800}.tyh-panel h2{margin:0 0 12px;color:var(--ty-navy);font-size:18px}.tyh-panel h2 small{font-size:12px;color:var(--ty-muted);font-weight:700}.tyh-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:14px}.tyh-tabs button{border:1px solid var(--ty-line);background:#fff;color:var(--ty-navy);border-radius:999px;padding:9px 12px;font-size:13px;font-weight:900;white-space:nowrap}.tyh-tabs button.active{border-color:var(--ty-blue);background:#eef6ff;color:var(--ty-blue)}.tyh-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tyh-form-grid label{font-size:12px;color:#344054;font-weight:850;display:grid;gap:6px}.tyh-form-grid input,.tyh-form-grid select{height:44px;border:1px solid var(--ty-line);border-radius:12px;padding:0 12px;font-size:14px;background:#fff;color:#101828}.tyh-check{display:flex!important;align-items:flex-start;gap:10px;color:#344054;font-size:13px;font-weight:750;line-height:1.4}.tyh-kv,.tyh-guest-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #eef2f7;padding:11px 0;align-items:center}.tyh-kv:first-of-type,.tyh-guest-row:first-of-type{border-top:0}.tyh-kv span,.tyh-guest-row span{color:var(--ty-muted);font-size:13px;font-weight:750}.tyh-kv b,.tyh-guest-row b{color:#101828;text-align:right;font-size:14px}.tyh-kv.total b{font-size:21px;color:var(--ty-blue)}.tyh-policy-actions{display:flex;gap:8px;flex-wrap:wrap}.tyh-policy-actions button{border:1px solid var(--ty-line);background:#fff;border-radius:999px;color:var(--ty-blue);font-weight:900;padding:9px 12px}.tyh-policy-box{margin-top:12px;background:#f8fbff;border:1px solid var(--ty-line);border-radius:14px;padding:12px;color:#344054;font-size:13px;line-height:1.45}.tyh-bottom{position:sticky;bottom:0;z-index:40;background:#101827;color:#fff;border-radius:22px 22px 0 0;margin:4px -14px -110px;padding:16px 18px calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:space-between;align-items:center;gap:12px}.tyh-bottom span{display:block;font-size:12px;font-weight:800;color:#cbd5e1}.tyh-bottom b{font-size:22px}.tyh-bottom button{min-width:190px;border-radius:999px}.tyh-confirm{background:#ecfdf3;border-color:#bbf7d0}.tyh-confirm.failed{background:#fff1f2;border-color:#fecdd3}.tyh-confirm.pending{background:#fff7ed;border-color:#fed7aa}.tyh-confirm h2{margin:0 0 8px;font-size:24px;color:var(--ty-navy)}.tyh-confirm p{margin:0 0 10px;color:#344054}.tyh-confirm span{display:inline-flex;background:#fff;border-radius:999px;padding:7px 11px;color:#344054;font-weight:900;font-size:12px}.tyh-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tyh-actions button{background:#fff;color:var(--ty-navy);border:1px solid var(--ty-line)}.tyh-actions button:nth-child(1),.tyh-actions button:nth-child(2){background:var(--ty-blue);color:#fff;border:0}.tyh-actions button:disabled{opacity:.45;cursor:not-allowed}
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
.tyh-page{padding-bottom:125px}.tyh-top{padding:10px 12px}.tyh-back{width:40px;height:40px}.tyh-top h1{font-size:17px}.tyh-results{display:block;margin:10px auto;padding:0 10px}.tyh-filter{display:none;position:fixed;left:10px;right:10px;top:72px;bottom:16px;z-index:90;overflow:auto}.tyh-filter-open .tyh-filter{display:block}.tyh-search-line button{display:block}.tyh-card{display:block;border-radius:18px}.tyh-img{min-height:170px}.tyh-info{padding:14px}.tyh-info h2{font-size:18px}.tyh-price{align-items:flex-start;text-align:left;border-left:0;border-top:1px solid var(--ty-line);padding:14px}.tyh-price b{font-size:21px}.tyh-room{max-height:88vh;border-radius:20px 20px 0 0}.tyh-rate{display:block}.tyh-rate strong{text-align:left;margin-top:10px}.tyh-book,.tyh-status{padding:0 10px;margin:10px auto}.tyh-mini{grid-template-columns:104px minmax(0,1fr);gap:12px}.tyh-mini-img{height:92px}.tyh-mini h2{font-size:17px}.tyh-form-grid{grid-template-columns:1fr}.tyh-kv,.tyh-guest-row{align-items:flex-start}.tyh-bottom{left:0;right:0;margin:4px -10px -125px;border-radius:20px 20px 0 0}.tyh-bottom button{min-width:0;flex:1}.tyh-actions{grid-template-columns:1fr}.tyh-policy-actions{display:grid;grid-template-columns:1fr}
/* TravelYaraa hotel filter/sort/card redesign */
.tyh-results{grid-template-columns:minmax(0,1fr) 286px;align-items:start}.tyh-list-wrap{min-width:0;order:1}.tyh-filter{order:2}.tyh-mobile-tools{display:none}.tyh-desktop-sort{display:flex;gap:10px;margin:0 0 12px;overflow:auto}.tyh-desktop-sort button{height:40px;border:1px solid var(--ty-line);background:#fff;border-radius:14px;padding:0 14px;color:var(--ty-navy);font-size:13px;font-weight:900;white-space:nowrap}.tyh-desktop-sort button.active{border-color:var(--ty-blue);background:#eef6ff;color:var(--ty-blue)}.tyh-filter{padding:0;overflow:hidden}.tyh-filter-head{height:58px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--ty-line)}.tyh-filter-head h2{flex:1;text-align:center;margin:0;font-size:17px}.tyh-filter-head button{border:0;background:#fff;color:var(--ty-navy);font-weight:900}.tyh-filter-head button:first-child{font-size:28px;width:34px}.tyh-filter-head button:last-child{color:#98a2b3;font-size:13px}.tyh-filter-grid{display:grid;grid-template-columns:130px minmax(0,1fr);min-height:360px}.tyh-filter-grid nav{background:#f8fafc;border-right:1px solid var(--ty-line);padding:8px 0}.tyh-filter-grid nav button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:15px 14px;color:#344054;font-weight:850;font-size:13px;line-height:1.25}.tyh-filter-grid nav button.active{background:#fff;color:var(--ty-orange);border-left:4px solid var(--ty-orange)}.tyh-filter-grid section{padding:14px;max-height:470px;overflow:auto}.tyh-fcheck{display:flex!important;align-items:center;gap:12px;margin:0!important;padding:12px 0;border-bottom:1px solid #f1f5f9;color:#344054}.tyh-fcheck input{display:none}.tyh-fcheck span{width:24px;height:24px;border-radius:7px;border:2px solid #98a2b3;display:inline-flex;align-items:center;justify-content:center;background:#fff;flex:0 0 auto}.tyh-fcheck input:checked+span{background:var(--ty-blue);border-color:var(--ty-blue)}.tyh-fcheck input:checked+span:after{content:'✓';color:#fff;font-size:15px;font-weight:900}.tyh-fcheck b{font-size:14px;font-weight:750;flex:1}.tyh-fcheck em{font-style:normal;color:#98a2b3;font-size:12px;font-weight:750}.tyh-filter-actions{padding:14px;border-top:1px solid var(--ty-line);display:grid;grid-template-columns:1fr 1.45fr;gap:12px;margin:0}.tyh-filter-actions button{height:48px;border-radius:13px;font-size:15px;text-transform:none}.tyh-filter-actions button:first-child{background:#fff!important;color:var(--ty-orange)!important;border:1px solid var(--ty-line)!important}.tyh-filter-actions button:last-child{background:var(--ty-blue)!important;color:#fff!important;border:0!important}.tyh-search-line{box-shadow:0 8px 20px rgba(7,29,73,.04)}.tyh-card{grid-template-columns:320px minmax(0,1fr);border-radius:22px;position:relative}.tyh-img{min-height:230px;position:relative;background:#eaf2ff}.tyh-card-badges{position:absolute;left:12px;top:12px;display:flex;gap:8px;flex-wrap:wrap}.tyh-card-badges span{font-size:12px;font-weight:900;border-radius:8px;padding:7px 10px;background:#fff;color:#067647;box-shadow:0 5px 14px rgba(0,0,0,.08)}.tyh-card-badges .rate{color:#a36a00}.tyh-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.tyh-title-row h2{font-size:19px}.tyh-stars{margin:0;color:#f5b301;white-space:nowrap}.tyh-location{font-size:13px!important;margin-bottom:12px!important}.tyh-facilities{display:flex;flex-wrap:wrap;gap:16px;margin:16px 0 10px}.tyh-facilities span{background:transparent;padding:0;color:#101828;font-size:14px;font-weight:800}.tyh-meal{margin-top:8px!important;color:#667085!important;font-size:13px!important}.tyh-card-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-top:18px}.tyh-rating{display:flex;align-items:center;gap:10px;min-height:40px}.tyh-rating strong{display:grid;place-items:center;min-width:43px;height:40px;border:1px solid var(--ty-line);border-radius:9px;color:#ef7d22;font-size:18px}.tyh-rating span{font-size:12px;font-weight:750;color:#344054;line-height:1.25}.tyh-price{border:0!important;padding:0!important;display:block!important;text-align:right}.tyh-price small{display:block;font-size:12px!important;color:#344054!important}.tyh-price b{display:block;font-size:24px!important;color:#101828!important}.tyh-price em{display:block;background:transparent!important;color:#667085!important;padding:0!important;font-size:12px!important}.tyh-gst{margin-top:12px;background:linear-gradient(90deg,#fff1df,#fff7ed);border-radius:10px;padding:10px 12px;color:#8a4b12;font-size:12px;font-weight:850}.tyh-card .tyh-info>button{margin-top:14px;height:42px;border:0;border-radius:12px;background:var(--ty-blue);color:#fff;font-weight:900;padding:0 14px}.tyh-sort-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:95}.tyh-sort-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(560px,100%);background:#fff;z-index:96;border-radius:22px 22px 0 0;box-shadow:0 -14px 40px rgba(0,0,0,.2);padding-bottom:env(safe-area-inset-bottom)}.tyh-sort-sheet header{height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid var(--ty-line)}.tyh-sort-sheet h2{margin:0;color:#101828;font-size:22px}.tyh-sort-sheet header button{border:0;background:#fff;color:var(--ty-blue);font-size:30px;font-weight:900}.tyh-sort-sheet>button{width:100%;height:64px;border:0;background:#fff;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;padding:0 20px;color:#101828;text-align:left}.tyh-sort-sheet>button b{font-size:17px;font-weight:900}.tyh-sort-sheet>button span{font-size:13px;color:#667085;font-weight:700}.tyh-sort-sheet>button i{width:26px;height:26px;border-radius:50%;border:2px solid #98a2b3}.tyh-sort-sheet>button.active i{border:7px solid var(--ty-blue)}
@media(max-width:860px){.tyh-results{display:block;margin:8px auto;padding:0 10px}.tyh-desktop-sort{display:none}.tyh-mobile-tools{display:grid;grid-template-columns:56px 1fr 1fr 1fr;gap:8px;margin:10px 0 12px}.tyh-mobile-tools button{height:48px;border:1px solid var(--ty-line);background:#fff;border-radius:12px;color:#101828;font-size:14px;font-weight:900;box-shadow:0 4px 12px rgba(7,29,73,.03)}.tyh-mobile-tools button:nth-child(3){border-color:#ef7d22}.tyh-filter{display:none;position:fixed;left:0;right:0;top:auto;bottom:0;z-index:97;max-height:78vh;border-radius:22px 22px 0 0;border:0;box-shadow:0 -15px 42px rgba(0,0,0,.18)}body.tyh-filter-open:before{content:'';position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:96}.tyh-filter-open .tyh-filter{display:block}.tyh-filter-grid{grid-template-columns:150px minmax(0,1fr);min-height:430px}.tyh-filter-grid section{max-height:430px}.tyh-card{display:block;border-radius:18px;overflow:hidden}.tyh-img{min-height:196px}.tyh-info{padding:14px 16px 16px}.tyh-title-row h2{font-size:16px;line-height:1.25}.tyh-stars{font-size:13px}.tyh-facilities{gap:13px;margin:18px 0 10px}.tyh-facilities span{font-size:13px}.tyh-card-foot{margin-top:22px}.tyh-price{text-align:right!important;align-items:flex-end!important}.tyh-price b{font-size:22px!important}.tyh-card .tyh-info>button{width:100%;background:var(--ty-blue)}}
}`; }

init();
})();

