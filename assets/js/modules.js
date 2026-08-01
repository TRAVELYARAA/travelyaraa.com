/* TravelYaraa Cab results. Real supplier responses only; no fabricated vehicles or fares. */
(function () {
  "use strict";

  const API_BASE = String(window.TRAVELYARAA_API_BASE || window.TY_API_BASE || "https://api.travelyaraa.com").replace(/\/$/, "");
  const ROOT = document.getElementById("tyResultsRoot");
  if (!ROOT) return;

  const state = {
    search: readJson(sessionStorage.getItem("ty_last_search_payload"), {}),
    response: readJson(sessionStorage.getItem("ty_live_results_cab"), {}),
    results: [],
    sort: "recommended",
    detailsId: ""
  };

  function readJson(value, fallback) {
    try { return JSON.parse(value || "") || fallback; } catch (_error) { return fallback; }
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }
  function number(value, fallback = 0) {
    const parsed = Number(String(value == null ? "" : value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function money(value, currency = "INR") {
    const amount = number(value, 0);
    if (!(amount > 0)) return "Price unavailable";
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(amount);
    } catch (_error) {
      return `₹${amount.toLocaleString("en-IN")}`;
    }
  }
  function first(object, paths, fallback = "") {
    for (const path of paths) {
      const value = String(path).split(".").reduce((current, key) => current && current[key], object);
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return fallback;
  }
  function extractResults(response) {
    if (Array.isArray(response)) return response;
    const candidates = [
      response && response.results,
      response && response.cabs,
      response && response.items,
      response && response.data && response.data.results,
      response && response.data && response.data.cabs,
      response && response.response && response.response.results
    ];
    return candidates.find(Array.isArray) || [];
  }
  function normalizeCab(item, index) {
    const price = number(first(item, ["totalAmount", "amount", "price", "fare.total", "pricing.total"], 0));
    const id = String(first(item, ["id", "cabId", "vehicleId", "quoteId"], `CAB-${index + 1}`));
    return {
      id,
      raw: item,
      name: String(first(item, ["name", "vehicleName", "cabName", "vehicle.name"], "Cab")),
      category: String(first(item, ["category", "vehicleType", "vehicle.category"], "Vehicle")),
      provider: String(first(item, ["provider", "operator", "supplierName"], "")),
      price,
      currency: String(first(item, ["currency", "pricing.currency"], "INR")),
      seats: number(first(item, ["seats", "capacity", "vehicle.seats"], 0)),
      bags: number(first(item, ["bags", "luggage", "vehicle.bags"], 0)),
      ac: first(item, ["ac", "isAc", "vehicle.ac"], true) !== false,
      transmission: String(first(item, ["transmission", "vehicle.transmission"], "")),
      fuel: String(first(item, ["fuel", "fuelType", "vehicle.fuel"], "")),
      rating: number(first(item, ["rating", "operatorRating"], 0)),
      fareType: String(first(item, ["fareType", "rateType"], ""))
    };
  }
  function routeText() {
    const from = state.search.source || state.search.pickup || state.search.pickupLocation || state.search.from || "Pickup";
    const to = state.search.destination || state.search.drop || state.search.dropoffLocation || state.search.to || "Drop";
    return `${from} to ${to}`;
  }
  function tripText() {
    return [
      state.search.scheduledDate || state.search.pickupDate || state.search.date,
      state.search.scheduledTime || state.search.pickupTime,
      state.search.cabType || state.search.vehicleCategory
    ].filter(Boolean).join(" • ");
  }
  function sortedResults() {
    const rows = state.results.slice();
    if (state.sort === "price") rows.sort((a, b) => (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER));
    if (state.sort === "rating") rows.sort((a, b) => b.rating - a.rating);
    return rows;
  }
  function cabCard(cab) {
    const detailsOpen = state.detailsId === cab.id;
    const tags = [
      cab.seats ? `${cab.seats} Seats` : "",
      cab.bags ? `${cab.bags} Bags` : "",
      cab.ac ? "AC" : "Non AC",
      cab.transmission,
      cab.fuel,
      cab.fareType
    ].filter(Boolean);
    return `<article class="ty-result-card ty-service-card" data-card="${escapeHtml(cab.id)}">
      <div class="ty-service-icon" aria-hidden="true">${escapeHtml((cab.category || "C").slice(0, 1).toUpperCase())}</div>
      <div class="ty-service-info">
        <h2>${escapeHtml(cab.name)}</h2>
        <p>${escapeHtml([cab.provider, cab.category].filter(Boolean).join(" • "))}</p>
        <div class="ty-tag-row">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      </div>
      <div class="ty-price-box">
        <strong>${escapeHtml(money(cab.price, cab.currency))}</strong>
        <small>supplier fare</small>
        <button type="button" data-support="${escapeHtml(cab.id)}">Contact support</button>
        <button type="button" class="ty-link-btn" data-details="${escapeHtml(cab.id)}">${detailsOpen ? "Hide details" : "Details"}</button>
      </div>
      <div class="ty-card-extra ${detailsOpen ? "show" : ""}">
        <div><b>Vehicle</b><p>${escapeHtml(cab.category || "Vehicle information from supplier")}</p></div>
        <div><b>Operator rating</b><p>${cab.rating > 0 ? `${escapeHtml(cab.rating.toFixed(1))}/5` : "Not provided"}</p></div>
      </div>
    </article>`;
  }
  function emptyState() {
    const message = String(state.response.message || state.response.error || "Cab supplier API is not connected yet. No dummy cab or fare has been shown.");
    return `<section class="ty-empty">
      <h2>Cab booking is not available yet</h2>
      <p>${escapeHtml(message)}</p>
      <button type="button" data-contact-support>Contact TravelYaraa support</button>
    </section>`;
  }
  function render() {
    document.body.classList.add("ty-v78-page");
    const rows = sortedResults();
    ROOT.innerHTML = `<header class="ty-page-head">
      <button type="button" class="ty-back" data-back aria-label="Back">‹</button>
      <div><h1>${escapeHtml(routeText())}</h1><p>${escapeHtml(tripText() || "Cab search")}</p></div>
      <button type="button" class="ty-modify" data-back>Modify</button>
    </header>
    <main class="ty-layout" style="grid-template-columns:minmax(0,1fr)">
      <section class="ty-results-area">
        ${rows.length ? `<div class="ty-result-tools"><div class="ty-sort-tabs"><button type="button" class="${state.sort === "recommended" ? "active" : ""}" data-sort="recommended">Recommended</button><button type="button" class="${state.sort === "price" ? "active" : ""}" data-sort="price">Lowest price</button><button type="button" class="${state.sort === "rating" ? "active" : ""}" data-sort="rating">Top rated</button></div><span class="ty-count">${rows.length} found</span></div>` : ""}
        <div class="ty-list">${rows.length ? rows.map(cabCard).join("") : emptyState()}</div>
      </section>
    </main>`;
    ROOT.querySelectorAll("[data-back]").forEach(button => button.addEventListener("click", () => history.back()));
    ROOT.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => { state.sort = button.dataset.sort; render(); }));
    ROOT.querySelectorAll("[data-details]").forEach(button => button.addEventListener("click", () => { state.detailsId = state.detailsId === button.dataset.details ? "" : button.dataset.details; render(); }));
    ROOT.querySelectorAll("[data-support],[data-contact-support]").forEach(button => button.addEventListener("click", () => {
      const params = new URLSearchParams({ service: "cab", route: routeText() });
      location.href = `/customer-support.html?${params.toString()}`;
    }));
  }

  async function refresh() {
    try {
      const response = await fetch(`${API_BASE}/api/cabs/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(state.search || {})
      });
      const data = await response.json().catch(() => ({}));
      state.response = data;
      state.results = response.ok && data.success !== false ? extractResults(data).map(normalizeCab) : [];
      sessionStorage.setItem("ty_live_results_cab", JSON.stringify(data));
    } catch (error) {
      state.response = { success: false, message: error.message || "Cab search could not connect to the server." };
      state.results = [];
    }
    render();
  }

  state.results = extractResults(state.response).map(normalizeCab);
  render();
  window.TravelYaraaCabResults = { refresh, state };
}());
