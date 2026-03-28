// ══════════════════════════════════════════════════════════════════════════════
// MOTOR.SHOP ADVERTENTIES
// Formaten: native-listing, banner, gesponsord-slot
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { trackAd } from "./analytics.js";

// ── Advertentie definities ───────────────────────────────────────────────────
// In productie: ophalen via API. Nu: statische demo-ads.
export const ADS = [
  {
    id: "ad-001",
    type: "native",           // native listing — ziet eruit als een advertentie-kaart
    brand: "Hornig",
    headline: "BMW GS Accessoires",
    subline: "Originele toebehoren voor jouw GS Adventure",
    cta: "Bekijk assortiment",
    url: "https://www.hornig.nl",
    logo: "🔧",
    targeting: { brands: ["BMW"], types: ["Adventure / Enduro"] },
    budget: "CPM",
  },
  {
    id: "ad-002",
    type: "native",
    brand: "MotorVerzekering.nl",
    headline: "Verzeker je motor in 3 minuten",
    subline: "Vergelijk direct alle aanbieders — WA, Beperkt of Allrisk",
    cta: "Bereken premie",
    url: "https://www.motorverzekering.nl",
    logo: "🛡️",
    targeting: { brands: [], types: [] }, // breed
    budget: "CPC",
  },
  {
    id: "ad-003",
    type: "native",
    brand: "Polo Motorrad",
    headline: "Motorkleding van €49",
    subline: "Jassen · Helmen · Handschoenen · Laarzen",
    cta: "Shop nu",
    url: "https://www.polo-motorrad.nl",
    logo: "🪖",
    targeting: { brands: [], types: [] },
    budget: "CPC",
  },
  {
    id: "ad-004",
    type: "native",
    brand: "Ducati Amsterdam",
    headline: "Nieuwe Panigale V4 — nu leverbaar",
    subline: "Proefrit aanvragen bij officieel Ducati-dealer",
    cta: "Plan proefrit",
    url: "https://www.ducatiamsterdam.nl",
    logo: "🏁",
    targeting: { brands: ["Ducati"], types: ["Sport / Supersport"] },
    budget: "CPM",
  },
  {
    id: "ad-005",
    type: "native",
    brand: "ANWB Motor",
    headline: "Pechhulp voor motorrijders",
    subline: "Inclusief wegenwacht, rechtshulp en repatriëring",
    cta: "Word lid",
    url: "https://www.anwb.nl/motor",
    logo: "🔰",
    targeting: { brands: [], types: [] },
    budget: "CPM",
  },
  {
    id: "ad-006",
    type: "banner",           // banner — horizontale strook
    brand: "BOC Parts",
    headline: "Motoronderdelen — alle merken op voorraad",
    subline: "Volgende dag geleverd · 2 jaar garantie",
    cta: "Bestel nu",
    url: "https://www.bocparts.nl",
    logo: "⚙️",
    targeting: { brands: [], types: [] },
    budget: "CPM",
  },
  {
    id: "ad-007",
    type: "sponsored",        // gesponsorde listing — bovenin grid
    brand: "Kawasaki Nederland",
    headline: "Kawasaki Ninja ZX-4RR — nieuw 2024",
    subline: "400cc · 4-cilinder · 77 pk · Vanaf €11.299",
    cta: "Dealer zoeken",
    url: "https://www.kawasaki.nl",
    logo: "🟢",
    targeting: { brands: ["Kawasaki"], types: [] },
    budget: "CPM",
    price: "Nieuw v.a. € 11.299",
    model: "Ninja ZX-4RR",
  },
];

// Selecteer relevante ad op basis van actieve filters
export function selectAd(ads, brand, type, excludeIds = []) {
  const pool = ads.filter(ad => {
    if (excludeIds.includes(ad.id)) return false;
    const tb = ad.targeting.brands, tt = ad.targeting.types;
    const brandMatch = tb.length === 0 || tb.includes(brand);
    const typeMatch  = tt.length === 0 || tt.includes(type);
    return brandMatch && typeMatch;
  });
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── NATIVE AD COMPONENT ──────────────────────────────────────────────────────
export function NativeAd({ ad, analytics, onAnalytics }) {
  const [hov, setHov] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current && analytics) {
      onAnalytics(trackAd(analytics, ad.id, "impression"));
      tracked.current = true;
    }
  }, []);

  const handleClick = (e) => {
    e.stopPropagation();
    if (analytics) onAnalytics(trackAd(analytics, ad.id, "click"));
    window.open(ad.url, "_blank", "noopener");
  };

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "#0e0e0e" : "#0a0a0a", border: `1px solid ${hov ? "#333" : "#1a1a1a"}`, borderRadius: "4px", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", opacity: 0.92 }}>

      {/* Advertentie label */}
      <div style={{ position: "absolute", top: "8px", right: "8px", background: "#111", border: "1px solid #1e1e1e", fontSize: "7px", color: "#2a2a2a", padding: "2px 6px", letterSpacing: "2px", zIndex: 2 }}>
        ADVERTENTIE
      </div>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d0d0d, #111)", height: "115px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "6px" }}>{ad.logo}</div>
          <div style={{ fontSize: "9px", color: "#2a2a2a", letterSpacing: "2px" }}>{ad.brand.toUpperCase()}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "800", color: "#bbb", lineHeight: 1.2 }}>{ad.headline}</div>
          <div style={{ fontSize: "11px", color: "#444", marginTop: "4px", lineHeight: 1.4 }}>{ad.subline}</div>
        </div>
        <button onClick={handleClick}
          style={{ marginTop: "auto", background: "none", border: "1px solid #2a2a2a", color: "#555", padding: "8px 14px", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", borderRadius: "2px",
            ...(hov ? { borderColor: "#ff6b00", color: "#ff6b00" } : {}) }}>
          {ad.cta} →
        </button>
      </div>
    </div>
  );
}

// ── BANNER AD ────────────────────────────────────────────────────────────────
export function BannerAd({ ad, analytics, onAnalytics }) {
  const [hov, setHov] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current && analytics) {
      onAnalytics(trackAd(analytics, ad.id, "impression"));
      tracked.current = true;
    }
  }, []);

  const handleClick = () => {
    if (analytics) onAnalytics(trackAd(analytics, ad.id, "click"));
    window.open(ad.url, "_blank", "noopener");
  };

  return (
    <div onClick={handleClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: "#0a0a0a", border: `1px solid ${hov ? "#2a2a2a" : "#141414"}`, borderRadius: "4px", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all 0.2s", margin: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <span style={{ fontSize: "24px" }}>{ad.logo}</span>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "800", color: "#888" }}>{ad.headline}</div>
          <div style={{ fontSize: "10px", color: "#333", marginTop: "2px" }}>{ad.subline}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "8px", color: "#1e1e1e", letterSpacing: "2px" }}>ADVERTENTIE</span>
        <div style={{ background: "none", border: `1px solid ${hov ? "#ff6b00" : "#2a2a2a"}`, color: hov ? "#ff6b00" : "#444", padding: "6px 14px", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", borderRadius: "2px", transition: "all 0.2s" }}>
          {ad.cta} →
        </div>
      </div>
    </div>
  );
}

// ── GESPONSORDE LISTING ───────────────────────────────────────────────────────
export function SponsoredListing({ ad, analytics, onAnalytics }) {
  const [hov, setHov] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current && analytics) {
      onAnalytics(trackAd(analytics, ad.id, "impression"));
      tracked.current = true;
    }
  }, []);

  const handleClick = () => {
    if (analytics) onAnalytics(trackAd(analytics, ad.id, "click"));
    window.open(ad.url, "_blank", "noopener");
  };

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={handleClick}
      style={{ background: hov ? "#0e0e0e" : "#0a0a0a", border: `1px dashed ${hov ? "#ff6b0066" : "#222"}`, borderRadius: "4px", overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column", transition: "all 0.2s", position: "relative" }}>

      <div style={{ position: "absolute", top: "8px", left: "8px", display: "flex", gap: "4px", zIndex: 2 }}>
        <span style={{ background: "#111", border: "1px solid #222", color: "#444", fontSize: "7px", padding: "2px 6px", letterSpacing: "2px" }}>GESPONSORD</span>
      </div>

      <div style={{ background: "linear-gradient(135deg, #0d0d0d, #141414)", height: "115px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "40px" }}>{ad.logo}</span>
          <div style={{ fontSize: "9px", color: "#2a2a2a", letterSpacing: "2px", marginTop: "6px" }}>{ad.brand.toUpperCase()}</div>
        </div>
      </div>

      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div>
          <div style={{ fontSize: "9px", color: "#ff6b00", letterSpacing: "2px" }}>{ad.brand}</div>
          <div style={{ fontSize: "15px", fontWeight: "800", color: "#bbb", lineHeight: 1.2 }}>{ad.model || ad.headline}</div>
          <div style={{ fontSize: "10px", color: "#444", marginTop: "3px" }}>{ad.subline}</div>
        </div>
        {ad.price && (
          <div style={{ fontSize: "18px", fontWeight: "900", color: "#ff6b0099" }}>{ad.price}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "6px", borderTop: "1px solid #111", marginTop: "auto" }}>
          <span style={{ fontSize: "10px", color: hov ? "#ff6b00" : "#333", fontWeight: "700", letterSpacing: "1px", transition: "color 0.2s" }}>{ad.cta} →</span>
        </div>
      </div>
    </div>
  );
}

// ── ANALYTICS DASHBOARD PANEL ─────────────────────────────────────────────────
export function AnalyticsPanel({ analytics, onClose }) {
  const { modelClicks = {}, brandClicks = {}, adClicks = {}, sessions = [] } = analytics;

  const topModels = Object.entries(modelClicks)
    .map(([m, d]) => ({ model: m, ...d }))
    .sort((a, b) => b.unique - a.unique)
    .slice(0, 15);

  const topBrands = Object.entries(brandClicks)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  const recentSessions = [...sessions].reverse().slice(0, 20);

  const maxClicks = topModels[0]?.unique || 1;

  const BRAND_COLORS = { "BMW":"#3b82f6","Ducati":"#ef4444","Harley-Davidson":"#f97316","Triumph":"#8b5cf6","Kawasaki":"#15803d","KTM":"#ea580c","Honda":"#dc2626","Yamaha":"#1d4ed8","Aprilia":"#7c3aed","Suzuki":"#475569","Royal Enfield":"#78350f" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: "4px", width: "100%", maxWidth: "900px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ background: "#111", borderBottom: "1px solid #1a1a1a", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "9px", color: "#ff6b00", letterSpacing: "3px" }}>MOTOR.SHOP DASHBOARD</div>
            <div style={{ fontSize: "18px", fontWeight: "900", color: "#fff" }}>ANALYTICS & ADVERTENTIES</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #222", color: "#555", fontSize: "18px", cursor: "pointer", padding: "4px 10px" }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 18px", display: "grid", gap: "16px" }}>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
            {[
              { l: "TOTALE CLICKS",     v: sessions.length,                                              c: "#ff6b00" },
              { l: "UNIEKE MODELLEN",   v: Object.keys(modelClicks).length,                              c: "#69f0ae" },
              { l: "AD IMPRESSIES",     v: Object.values(adClicks).reduce((s,a) => s+a.impressions, 0),  c: "#60a5fa" },
              { l: "AD CLICKS",         v: Object.values(adClicks).reduce((s,a) => s+a.clicks, 0),       c: "#a78bfa" },
            ].map(k => (
              <div key={k.l} style={{ background: "#111", border: "1px solid #1a1a1a", padding: "12px 14px" }}>
                <div style={{ fontSize: "8px", color: "#2a2a2a", letterSpacing: "2px" }}>{k.l}</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: k.c, marginTop: "4px" }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

            {/* Top modellen */}
            <div style={{ background: "#111", border: "1px solid #1a1a1a" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a1a", fontSize: "9px", color: "#ff6b00", letterSpacing: "3px" }}>TOP MODELLEN — UNIEKE CLICKS</div>
              <div style={{ padding: "8px 0" }}>
                {topModels.length === 0 && (
                  <div style={{ padding: "16px 14px", fontSize: "11px", color: "#2a2a2a", textAlign: "center" }}>Nog geen clicks — gebruik de zoeker eerst</div>
                )}
                {topModels.map((m, i) => {
                  const bc = BRAND_COLORS[m.brand] || "#666";
                  const barW = Math.max(4, (m.unique / maxClicks) * 100);
                  return (
                    <div key={m.model} style={{ padding: "5px 14px", display: "grid", gridTemplateColumns: "16px 1fr 40px", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "9px", color: "#2a2a2a", fontFamily: "monospace" }}>{i + 1}</span>
                      <div>
                        <div style={{ fontSize: "11px", color: "#ccc", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.model.replace(m.brand + " ", "")}</div>
                        <div style={{ height: "3px", background: "#0d0d0d", borderRadius: "2px", marginTop: "3px" }}>
                          <div style={{ height: "100%", width: `${barW}%`, background: bc, borderRadius: "2px" }} />
                        </div>
                      </div>
                      <span style={{ fontSize: "11px", color: "#69f0ae", fontFamily: "monospace", textAlign: "right" }}>{m.unique}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gap: "12px", gridTemplateRows: "auto 1fr" }}>

              {/* Top merken */}
              <div style={{ background: "#111", border: "1px solid #1a1a1a" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a1a", fontSize: "9px", color: "#ff6b00", letterSpacing: "3px" }}>TOP MERKEN</div>
                <div style={{ padding: "8px 14px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {topBrands.length === 0 && <div style={{ fontSize: "11px", color: "#2a2a2a" }}>Geen data</div>}
                  {topBrands.map(([brand, d]) => (
                    <div key={brand} style={{ background: `${BRAND_COLORS[brand] || "#666"}15`, border: `1px solid ${BRAND_COLORS[brand] || "#666"}33`, padding: "4px 10px", borderRadius: "2px" }}>
                      <div style={{ fontSize: "9px", color: BRAND_COLORS[brand] || "#666", fontWeight: "800" }}>{brand}</div>
                      <div style={{ fontSize: "11px", color: "#888", fontFamily: "monospace" }}>{d.total}×</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advertentie performance */}
              <div style={{ background: "#111", border: "1px solid #1a1a1a" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a1a", fontSize: "9px", color: "#ff6b00", letterSpacing: "3px" }}>ADVERTENTIE PERFORMANCE</div>
                <div style={{ overflowY: "auto", maxHeight: "180px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                        {["AD", "IMPRESSIES", "CLICKS", "CTR"].map(h => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: "8px", color: "#2a2a2a", letterSpacing: "2px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(adClicks).length === 0 && (
                        <tr><td colSpan={4} style={{ padding: "12px 10px", color: "#2a2a2a", fontSize: "11px" }}>Geen ad-data</td></tr>
                      )}
                      {Object.entries(adClicks).map(([id, d]) => {
                        const ad = ADS.find(a => a.id === id);
                        const ctr = d.impressions ? ((d.clicks / d.impressions) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={id} style={{ borderBottom: "1px solid #0d0d0d" }}>
                            <td style={{ padding: "6px 10px", color: "#888" }}>{ad?.brand || id}</td>
                            <td style={{ padding: "6px 10px", color: "#555", fontFamily: "monospace" }}>{d.impressions}</td>
                            <td style={{ padding: "6px 10px", color: "#555", fontFamily: "monospace" }}>{d.clicks}</td>
                            <td style={{ padding: "6px 10px", color: parseFloat(ctr) > 2 ? "#69f0ae" : "#555", fontFamily: "monospace", fontWeight: "700" }}>{ctr}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Recente activiteit */}
          <div style={{ background: "#111", border: "1px solid #1a1a1a" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a1a1a", fontSize: "9px", color: "#ff6b00", letterSpacing: "3px" }}>RECENTE ACTIVITEIT</div>
            <div style={{ display: "flex", gap: "6px", padding: "10px 14px", flexWrap: "wrap" }}>
              {recentSessions.length === 0 && <div style={{ fontSize: "11px", color: "#2a2a2a" }}>Nog geen activiteit</div>}
              {recentSessions.map((s, i) => (
                <div key={i} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "4px 9px", borderRadius: "2px" }}>
                  <div style={{ fontSize: "9px", color: BRAND_COLORS[s.brand] || "#555", fontWeight: "700" }}>{s.brand}</div>
                  <div style={{ fontSize: "10px", color: "#888" }}>{s.model?.replace(s.brand + " ", "").slice(0, 20)}</div>
                  <div style={{ fontSize: "8px", color: "#2a2a2a" }}>{new Date(s.ts).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
