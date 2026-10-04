(function(){
"use strict";
const API=(window.TRAVELYARAA_API_BASE||window.TY_API_BASE||"https://api.travelyaraa.com").replace(/\/$/,"");
const OFFER_API=API+"/api/offers";

function q(s,r=document){return r.querySelector(s)}
async function listOffers(svc){const res=await fetch(OFFER_API+"?service="+encodeURIComponent(svc),{cache:"no-store"});const data=await res.json().catch(()=>({offers:[]}));return Array.isArray(data.offers)?data.offers:[]}
function initResultBadge(){if(!location.pathname.includes("/pages/results/"))return;const t=setInterval(()=>{const tools=q(".ty-result-tools");if(tools&&!q(".ty-result-offer-badge")){const span=document.createElement("span");span.className="ty-result-offer-badge";span.textContent="Offers Available";const first=tools.firstElementChild;if(first)first.appendChild(span);clearInterval(t)}},300);setTimeout(()=>clearInterval(t),5000)}
document.addEventListener("DOMContentLoaded",initResultBadge);
window.TravelYaraaOffers={listOffers};
})();
