// ══════════════════════════════════════════════════════════════════════════════
// MOTOR.SHOP ANALYTICS — Populariteit & Click Tracking
// Persistent storage: window.storage (cross-session)
// ══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "motorshop-analytics-v1";

// Laad analytics state
export async function loadAnalytics() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    if (r?.value) return JSON.parse(r.value);
  } catch {}
  return {
    modelClicks: {},   // { "BMW R 1250 GS Adventure": { total, unique, sessions: [ts] } }
    brandClicks: {},   // { "BMW": { total, unique } }
    typeClicks:  {},   // { "Adventure / Enduro": { total } }
    adClicks:    {},   // { adId: { impressions, clicks } }
    sessions:    [],   // [{ ts, model, brand, source }]  — laatste 500
    lastUpdated: null,
  };
}

// Sla analytics state op
export async function saveAnalytics(state) {
  try {
    // Houd sessions beperkt tot 500
    if (state.sessions.length > 500) state.sessions = state.sessions.slice(-500);
    await window.storage.set(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// Registreer een model-click (unique per sessie op basis van timestamp-bucket van 30min)
export function trackClick(state, listing) {
  const now     = Date.now();
  const bucket  = Math.floor(now / (1000 * 60 * 30)); // 30-min sessie bucket
  const model   = listing.model;
  const brand   = listing.brand;
  const type    = listing.type;

  const updated = { ...state };

  // Model clicks
  if (!updated.modelClicks[model]) {
    updated.modelClicks[model] = { total: 0, unique: 0, buckets: [], brand, type };
  }
  const m = updated.modelClicks[model];
  m.total += 1;
  if (!m.buckets.includes(bucket)) {
    m.buckets = [...(m.buckets || []).slice(-48), bucket]; // max 48 buckets (24h)
    m.unique  += 1;
  }

  // Brand clicks
  if (!updated.brandClicks[brand]) updated.brandClicks[brand] = { total: 0, unique: 0 };
  updated.brandClicks[brand].total += 1;
  if (!updated.modelClicks[model].buckets.includes(bucket - 0)) {
    updated.brandClicks[brand].unique += 1;
  }

  // Type clicks
  if (!updated.typeClicks[type]) updated.typeClicks[type] = { total: 0 };
  updated.typeClicks[type].total += 1;

  // Session log
  updated.sessions = [...(updated.sessions || []), {
    ts: now, model, brand, source: listing.source, type,
  }];

  updated.lastUpdated = now;
  return updated;
}

// Track ad impressie of click
export function trackAd(state, adId, event = "impression") {
  const updated = { ...state };
  if (!updated.adClicks[adId]) updated.adClicks[adId] = { impressions: 0, clicks: 0 };
  if (event === "impression") updated.adClicks[adId].impressions += 1;
  if (event === "click")      updated.adClicks[adId].clicks      += 1;
  return updated;
}

// Geef top N modellen op basis van unieke clicks
export function getTopModels(state, n = 10) {
  return Object.entries(state.modelClicks || {})
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.unique - a.unique)
    .slice(0, n);
}

// Geef trending score (clicks laatste 24u gewogen zwaarder)
export function getTrendingScore(state, model) {
  const data   = state.modelClicks?.[model];
  if (!data) return 0;
  const recent = (data.buckets || []).filter(b => b > Date.now() / (1000 * 60 * 30) - 48).length;
  return Math.round((data.unique * 0.4) + (recent * 3));
}

// Populariteitslabel op basis van unieke clicks
export function getPopularityLabel(uniqueClicks) {
  if (uniqueClicks >= 50) return { label: "VIRAL",     color: "#f59e0b", icon: "🔥🔥" };
  if (uniqueClicks >= 20) return { label: "TRENDING",  color: "#f97316", icon: "🔥"   };
  if (uniqueClicks >= 8)  return { label: "POPULAIR",  color: "#69f0ae", icon: "📈"   };
  if (uniqueClicks >= 3)  return { label: "BEKEKEN",   color: "#60a5fa", icon: "👁️"   };
  return null;
}

// CTR berekening voor advertentie
export function getCTR(adData) {
  if (!adData || !adData.impressions) return "0.0%";
  return ((adData.clicks / adData.impressions) * 100).toFixed(1) + "%";
}
