/* TravelYaraa - AI Yaraa booking handoff client.
   Resolves opaque server-held handoffs (wh_...) into the existing website booking steps.
   Handoff ids are capabilities: never log them or put them in customer-visible text. */
(function(){
  'use strict';
  if(window.TYAiBookingHandoff) return;

  const PATH = '/api/bookings/web-handoff';
  const HANDOFF_ID = /^wh_[a-f0-9]{20,}$/i;

  const MESSAGES = {
    BOOKING_HANDOFF_INVALID: 'This booking link is not valid. Please search again in AI Yaraa.',
    BOOKING_HANDOFF_REQUIRED: 'This booking link is not valid. Please search again in AI Yaraa.',
    BOOKING_HANDOFF_EXPIRED: 'This booking link has expired. Please search again in AI Yaraa.',
    BOOKING_HANDOFF_CONSUMED: 'This booking link was already used. Please search again in AI Yaraa.',
    BOOKING_HANDOFF_FORBIDDEN: 'This booking link belongs to another TravelYaraa account. Please sign in with the account you use in AI Yaraa.',
    BOOKING_HANDOFF_USER_REQUIRED: 'Please sign in to your TravelYaraa account to continue this booking.',
    AUTH_REQUIRED: 'Your TravelYaraa sign-in has expired. Please sign in again to continue this booking.',
    BOOKING_HANDOFF_NOT_CONSUMABLE: 'This booking link does not match the selected option. Please search again in AI Yaraa.',
    BOOKING_HANDOFF_MISMATCH: 'This booking link does not match the selected option. Please search again in AI Yaraa.',
    BOOKING_HANDOFF_UNBOOKABLE: 'This option can no longer be booked from this link. Please search again in AI Yaraa.',
    BOOKING_HANDOFF_CONTEXT_MISMATCH: 'The route or travel date on this booking link does not match its flight options, so we have not shown them. Please search again.',
    BOOKING_HANDOFF_DATE_PASSED: 'The travel date on this booking link has already passed. Please search again for a new date.'
  };
  const FALLBACK_MESSAGE = 'We couldn’t open this booking right now. Please try again, or search again in AI Yaraa.';

  function apiBase(){
    return String(window.TRAVELYARAA_AI_BASE || window.TY_AI_BASE || 'https://ai.travelyaraa.com').replace(/\/$/, '');
  }

  function authToken(){
    try{ return localStorage.getItem('ty_user_auth_token') || ''; }catch(e){ return ''; }
  }

  function handoffError(code, status){
    const err = new Error(code);
    err.code = code;
    err.status = Number(status || 0);
    return err;
  }

  function checkedId(id){
    const value = String(id || '').trim();
    if(!HANDOFF_ID.test(value)) throw handoffError('BOOKING_HANDOFF_INVALID', 400);
    return value;
  }

  async function request(path, method, body){
    const headers = {Accept: 'application/json'};
    const token = authToken();
    /* Optional on validate/consume, but when present the gateway requires it to be
       the same account that created the handoff. */
    if(token) headers.Authorization = 'Bearer ' + token;
    if(body) headers['Content-Type'] = 'application/json';
    let res;
    try{
      res = await fetch(apiBase() + path, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
    }catch(e){
      throw handoffError('BOOKING_HANDOFF_NETWORK', 0);
    }
    const data = await res.json().catch(function(){ return {}; });
    if(!res.ok || !data || data.success === false){
      throw handoffError(String((data && data.code) || 'BOOKING_HANDOFF_UNAVAILABLE'), res.status);
    }
    if(!data.handoff || typeof data.handoff !== 'object') throw handoffError('BOOKING_HANDOFF_UNAVAILABLE', res.status);
    return data.handoff;
  }

  function rowId(row, service){
    if(!row || typeof row !== 'object') return '';
    return String((service === 'hotel' ? row.hotelId : row.priceId) || row.id || '').trim();
  }

  function expectView(view, service, mode){
    if(!view || view.service !== service || view.mode !== mode || !view.websiteSession){
      throw handoffError('BOOKING_HANDOFF_MISMATCH', 0);
    }
    return view;
  }

  /* results_embed: read-only, never consumed. */
  async function validate(handoffId, service){
    const view = await request(PATH + '/' + encodeURIComponent(checkedId(handoffId)), 'GET');
    return expectView(view, service, 'results_embed');
  }

  /* continue_selected: one-time. Replays return BOOKING_HANDOFF_CONSUMED until expiry. */
  async function consume(handoffId, service, expectedSelectedId){
    const view = expectView(
      await request(PATH + '/' + encodeURIComponent(checkedId(handoffId)) + '/consume', 'POST', {}),
      service,
      'continue_selected'
    );
    const selected = String((service === 'hotel' ? view.selectedHotelId : view.selectedPriceId) || '').trim();
    if(!selected || rowId(view.selectedOption, service) !== selected) throw handoffError('BOOKING_HANDOFF_MISMATCH', 0);
    if(expectedSelectedId && selected !== String(expectedSelectedId).trim()) throw handoffError('BOOKING_HANDOFF_MISMATCH', 0);
    return view;
  }

  function message(err){
    const code = String((err && err.code) || '').toUpperCase();
    return MESSAGES[code] || FALLBACK_MESSAGE;
  }

  window.TYAiBookingHandoff = {
    validate: validate,
    consume: consume,
    message: message,
    rowId: rowId,
    error: handoffError
  };
})();
