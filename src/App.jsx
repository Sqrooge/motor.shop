import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// RDW API — opendata.rdw.nl (geen API-key nodig, CORS ondersteund)
// ══════════════════════════════════════════════════════════════════════════════
const RDW_BASE = "https://opendata.rdw.nl/resource";

// Kenteken normaliseren: "KZ-123-B" → "KZ123B"
const normKenteken = k => k.replace(/-/g, "").toUpperCase();

// Voertuig basisdata (merk, kleur, APK, gewicht, brandstof, datum eerste toelating)
async function rdwVoertuig(kenteken) {
  const k = normKenteken(kenteken);
  const url = `${RDW_BASE}/m9d7-ebf2.json?kenteken=${k}&$limit=1`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    return data[0] || null;
  } catch { return null; }
}

// APK keuringshistorie — bevat km-standen per keuring (NAP-validatie)
async function rdwApkHistorie(kenteken) {
  const k = normKenteken(kenteken);
  const url = `${RDW_BASE}/sgfe-77wx.json?kenteken=${k}&$limit=50&$order=soort_erkenning_omschrijving`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// Brandstof & technische data
async function rdwBrandstof(kenteken) {
  const k = normKenteken(kenteken);
  const url = `${RDW_BASE}/8ys7-d773.json?kenteken=${k}&$limit=1`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    return data[0] || null;
  } catch { return null; }
}

// ── Mock APK histories (fallback als kenteken niet in RDW staat) ──────────────
// Realistische patronen: logisch, verdacht, en gemanipuleerd
const MOCK_APK = {
  "KZ123B": [
    { datum:"2021-08-12", km:  1240, oordeel:"Goedgekeurd" },
    { datum:"2022-08-10", km:  7820, oordeel:"Goedgekeurd" },
    { datum:"2023-08-15", km: 14200, oordeel:"Goedgekeurd" },
  ],
  "BM997R": [
    { datum:"2022-06-20", km:   980, oordeel:"Goedgekeurd" },
    { datum:"2023-06-18", km:  5120, oordeel:"Goedgekeurd" },
    { datum:"2024-06-22", km:  9200, oordeel:"Goedgekeurd" },
  ],
  "DV290R": [
    { datum:"2021-04-10", km:   420, oordeel:"Goedgekeurd" },
    { datum:"2022-04-09", km:  1980, oordeel:"Goedgekeurd" },
    { datum:"2023-04-12", km:  2800, oordeel:"Goedgekeurd" },
  ],
  "SC611D": [
    { datum:"2020-09-01", km:  2100, oordeel:"Goedgekeurd" },
    { datum:"2021-09-03", km:  6400, oordeel:"Goedgekeurd" },
    { datum:"2022-09-07", km:  9800, oordeel:"Goedgekeurd" },
  ],
  "HL774C": [
    { datum:"2019-11-20", km:  1200, oordeel:"Goedgekeurd" },
    { datum:"2020-11-18", km:  4100, oordeel:"Goedgekeurd" },
    { datum:"2021-11-22", km:  6400, oordeel:"Goedgekeurd" },
    { datum:"2022-11-20", km:  5200, oordeel:"⚠️ Terugloop km", verdacht:true }, // TERUGGEDRAAID
  ],
  "TR509X": [
    { datum:"2021-05-14", km:  1900, oordeel:"Goedgekeurd" },
    { datum:"2022-05-16", km:  5100, oordeel:"Goedgekeurd" },
    { datum:"2023-05-12", km:  7800, oordeel:"Goedgekeurd" },
  ],
  "ZR334K": [
    { datum:"2022-03-20", km:  1200, oordeel:"Goedgekeurd" },
    { datum:"2023-03-22", km:  4800, oordeel:"Goedgekeurd" },
    { datum:"2024-03-20", km:  6400, oordeel:"Goedgekeurd" },
  ],
  "H2117N": [
    { datum:"2020-07-15", km:   680, oordeel:"Goedgekeurd" },
    { datum:"2021-07-14", km:  3200, oordeel:"Goedgekeurd" },
    { datum:"2022-07-15", km:  8100, oordeel:"Goedgekeurd" },  // hoog jaar
  ],
  "KS103D": [
    { datum:"2021-09-08", km:   880, oordeel:"Goedgekeurd" },
    { datum:"2022-09-06", km:  2400, oordeel:"Goedgekeurd" },
    { datum:"2023-09-10", km:  3200, oordeel:"Goedgekeurd" },
  ],
  "FB449H": [
    { datum:"2022-04-12", km:   950, oordeel:"Goedgekeurd" },
    { datum:"2023-04-10", km:  3800, oordeel:"Goedgekeurd" },
    { datum:"2024-04-08", km:  5100, oordeel:"Goedgekeurd" },
  ],
  "R1882Y": [
    { datum:"2021-06-22", km:  1400, oordeel:"Goedgekeurd" },
    { datum:"2022-06-24", km:  4900, oordeel:"Goedgekeurd" },
    { datum:"2023-06-20", km:  7200, oordeel:"Goedgekeurd" },
  ],
  "AP733F": [
    { datum:"2022-05-30", km:   720, oordeel:"Goedgekeurd" },
    { datum:"2023-05-29", km:  3400, oordeel:"Goedgekeurd" },
    { datum:"2024-05-27", km:  5800, oordeel:"Goedgekeurd" },
  ],
  "BU928S": [
    { datum:"2022-02-14", km:  1100, oordeel:"Goedgekeurd" },
    { datum:"2023-02-13", km:  4200, oordeel:"Goedgekeurd" },
    { datum:"2024-02-12", km:  6400, oordeel:"Goedgekeurd" },
  ],
  "HI024E": [
    { datum:"2024-03-10", km:   410, oordeel:"Goedgekeurd" },
    { datum:"2025-03-08", km:  1200, oordeel:"Goedgekeurd" },
  ],
  "N9024B": [
    { datum:"2024-06-01", km:   120, oordeel:"Goedgekeurd" },
  ],
};

const MOCK_VOERTUIG = {
  "KZ123B": { merk:"BMW",             handelsbenaming:"R 1250 GS ADVENTURE", kleur:"GRIJS",    cilinderinhoud:"1254", vermogen_massarijklaar:"249", datum_eerste_toelating:"20210601", vervaldatum_apk:"20260801", brandstof:"Benzine", catalogusprijs:"23900" },
  "BM997R": { merk:"BMW",             handelsbenaming:"S 1000 RR M",         kleur:"ZWART",    cilinderinhoud:"999",  vermogen_massarijklaar:"193", datum_eerste_toelating:"20220301", vervaldatum_apk:"20270601", brandstof:"Benzine", catalogusprijs:"31000" },
  "DV290R": { merk:"DUCATI",          handelsbenaming:"PANIGALE V4 R",       kleur:"ROOD",     cilinderinhoud:"998",  vermogen_massarijklaar:"172", datum_eerste_toelating:"20210401", vervaldatum_apk:"20260401", brandstof:"Benzine", catalogusprijs:"41000" },
  "SC611D": { merk:"DUCATI",          handelsbenaming:"SCRAMBLER ICON",      kleur:"GEEL",     cilinderinhoud:"803",  vermogen_massarijklaar:"190", datum_eerste_toelating:"20200901", vervaldatum_apk:"20250901", brandstof:"Benzine", catalogusprijs:"10200" },
  "HL774C": { merk:"HARLEY-DAVIDSON", handelsbenaming:"HERITAGE CLASSIC",    kleur:"ZWART",    cilinderinhoud:"1868", vermogen_massarijklaar:"366", datum_eerste_toelating:"20191101", vervaldatum_apk:"20251101", brandstof:"Benzine", catalogusprijs:"27500" },
  "TR509X": { merk:"TRIUMPH",         handelsbenaming:"THRUXTON RS",         kleur:"ZILVER",   cilinderinhoud:"1200", vermogen_massarijklaar:"199", datum_eerste_toelating:"20210501", vervaldatum_apk:"20260501", brandstof:"Benzine", catalogusprijs:"16900" },
  "ZR334K": { merk:"KAWASAKI",        handelsbenaming:"Z900 RS SE",          kleur:"ORANJE",   cilinderinhoud:"948",  vermogen_massarijklaar:"193", datum_eerste_toelating:"20220301", vervaldatum_apk:"20270301", brandstof:"Benzine", catalogusprijs:"15500" },
  "H2117N": { merk:"KAWASAKI",        handelsbenaming:"NINJA H2",            kleur:"GROEN",    cilinderinhoud:"998",  vermogen_massarijklaar:"238", datum_eerste_toelating:"20200701", vervaldatum_apk:"20250701", brandstof:"Benzine", catalogusprijs:"28000" },
  "KS103D": { merk:"KTM",             handelsbenaming:"1290 SUPER DUKE RR",  kleur:"ORANJE",   cilinderinhoud:"1301", vermogen_massarijklaar:"189", datum_eerste_toelating:"20210901", vervaldatum_apk:"20260901", brandstof:"Benzine", catalogusprijs:"26000" },
  "FB449H": { merk:"HONDA",           handelsbenaming:"CBR1000RR-R SP",      kleur:"ROOD",     cilinderinhoud:"999",  vermogen_massarijklaar:"201", datum_eerste_toelating:"20220401", vervaldatum_apk:"20270401", brandstof:"Benzine", catalogusprijs:"31000" },
  "R1882Y": { merk:"YAMAHA",          handelsbenaming:"YZF-R1M",             kleur:"BLAUW",    cilinderinhoud:"998",  vermogen_massarijklaar:"202", datum_eerste_toelating:"20210601", vervaldatum_apk:"20260601", brandstof:"Benzine", catalogusprijs:"26000" },
  "AP733F": { merk:"APRILIA",         handelsbenaming:"RSV4 FACTORY",        kleur:"ZWART",    cilinderinhoud:"1099", vermogen_massarijklaar:"184", datum_eerste_toelating:"20220501", vervaldatum_apk:"20270501", brandstof:"Benzine", catalogusprijs:"23500" },
  "BU928S": { merk:"SUZUKI",          handelsbenaming:"HAYABUSA",            kleur:"GRIJS",    cilinderinhoud:"1340", vermogen_massarijklaar:"264", datum_eerste_toelating:"20220201", vervaldatum_apk:"20270201", brandstof:"Benzine", catalogusprijs:"20500" },
  "HI024E": { merk:"ROYAL ENFIELD",   handelsbenaming:"HIMALAYAN 450",       kleur:"GROEN",    cilinderinhoud:"452",  vermogen_massarijklaar:"177", datum_eerste_toelating:"20240301", vervaldatum_apk:"20270301", brandstof:"Benzine", catalogusprijs:"7800"  },
  "N9024B": { merk:"BMW",             handelsbenaming:"R 12 NINET",          kleur:"ZILVER",   cilinderinhoud:"1170", vermogen_massarijklaar:"220", datum_eerste_toelating:"20240601", vervaldatum_apk:"20270601", brandstof:"Benzine", catalogusprijs:"17200" },
};

// ══════════════════════════════════════════════════════════════════════════════
// NAP-ANALYSE — km-stand logica op basis van APK-historie
// ══════════════════════════════════════════════════════════════════════════════
function analyseKmStand(apkHistorie, huidigKm, bouwjaar) {
  if (!apkHistorie || apkHistorie.length === 0) {
    return { status: "ONBEKEND", score: 50, kleur: "#64748b", label: "Geen APK-data", details: [], verdacht: false };
  }

  const sorted = [...apkHistorie].sort((a, b) => new Date(a.datum) - new Date(b.datum));
  const details = [];
  let verdacht = false;
  let flags = [];

  // 1. Controleer terugloop tussen APK-beurten
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], curr = sorted[i];
    const diff = curr.km - prev.km;
    const maanden = (new Date(curr.datum) - new Date(prev.datum)) / (1000 * 60 * 60 * 24 * 30.5);
    const kmPerMaand = diff / maanden;

    if (diff < 0) {
      verdacht = true;
      flags.push(`⚠️ Km-terugloop: ${prev.km.toLocaleString("nl-NL")} → ${curr.km.toLocaleString("nl-NL")} km`);
      details.push({ datum: curr.datum, km: curr.km, status: "TERUGLOOP", kleur: "#f44336", flag: true });
    } else if (kmPerMaand > 1800) {
      flags.push(`⚠️ Zeer hoog gebruik: ${Math.round(kmPerMaand * 12).toLocaleString("nl-NL")} km/jaar`);
      details.push({ datum: curr.datum, km: curr.km, status: "HOOG", kleur: "#ffa726", flag: true });
    } else {
      details.push({ datum: curr.datum, km: curr.km, status: "OK", kleur: "#69f0ae", flag: false });
    }
  }

  // Voeg eerste entry toe
  if (sorted.length > 0) {
    details.unshift({ datum: sorted[0].datum, km: sorted[0].km, status: "EERSTE", kleur: "#60a5fa", flag: false });
  }

  // 2. Controleer huidige km vs laatste APK
  const laatste = sorted[sorted.length - 1];
  if (laatste && huidigKm < laatste.km) {
    verdacht = true;
    flags.push(`❌ Huidige km (${huidigKm.toLocaleString("nl-NL")}) lager dan laatste APK (${laatste.km.toLocaleString("nl-NL")})`);
  } else if (laatste && huidigKm > laatste.km) {
    const verschil = huidigKm - laatste.km;
    const maandenSinds = (new Date() - new Date(laatste.datum)) / (1000 * 60 * 60 * 24 * 30.5);
    const verwacht = maandenSinds * 500; // 6000 km/jaar = 500/maand
    if (verschil > verwacht * 3) {
      flags.push(`⚠️ Grote stijging sinds laatste APK: +${verschil.toLocaleString("nl-NL")} km`);
    }
  }

  // 3. Verwacht km op basis van leeftijd
  const leeftijd = 2026 - parseInt(bouwjaar);
  const verwachtKm = leeftijd * 6000;
  const ratioVerwacht = huidigKm / verwachtKm;

  // 4. Score berekenen
  let score = 100;
  if (verdacht) score -= 60;
  if (flags.some(f => f.startsWith("⚠️"))) score -= 20;
  score = Math.max(0, Math.min(100, score));

  const status = score >= 80 ? "LOGISCH" : score >= 50 ? "VERDACHT" : "ONBETROUWBAAR";
  const kleur  = score >= 80 ? "#69f0ae" : score >= 50 ? "#ffa726" : "#f44336";
  const icons  = { LOGISCH: "✅", VERDACHT: "⚠️", ONBETROUWBAAR: "❌" };

  return { status, score, kleur, label: `${icons[status]} ${status}`, details: details.reverse(), flags, verdacht, ratioVerwacht, verwachtKm, laatste };
}

// ══════════════════════════════════════════════════════════════════════════════
// KPI ENGINE (zelfde als vorige versie, compact)
// ══════════════════════════════════════════════════════════════════════════════
const BASE_DEP = { 0:1.00,1:0.80,2:0.67,3:0.57,4:0.49,5:0.43,6:0.38,7:0.34,8:0.31,9:0.28,10:0.26,11:0.24,12:0.22,13:0.21,14:0.20,15:0.19 };
const baseDep  = age => BASE_DEP[Math.min(age, 15)] ?? 0.19;
const AVG_KM   = 6000;

const MODEL_DB = {
  "BMW R 1250 GS Adventure":         { bf:0.83, tf:0.88, vf:0.85, tier:"ADVENTURE" },
  "BMW S 1000 RR M":                 { bf:0.83, tf:1.06, vf:0.80, tier:"LIMITED"   },
  "Ducati Panigale V4 R":            { bf:0.86, tf:1.06, vf:0.78, tier:"LIMITED"   },
  "Ducati Scrambler Icon":           { bf:0.86, tf:0.86, vf:0.95, tier:"STD"       },
  "Harley-Davidson Heritage Classic Limited": { bf:0.78, tf:0.82, vf:0.79, tier:"LIMITED" },
  "Triumph Thruxton RS":             { bf:0.89, tf:0.86, vf:0.86, tier:"S / R"     },
  "Kawasaki Z900 RS SE":             { bf:0.96, tf:0.86, vf:0.86, tier:"SE"        },
  "Kawasaki Ninja H2":               { bf:0.96, tf:1.06, vf:0.76, tier:"LIMITED"   },
  "KTM 1290 Super Duke RR":          { bf:0.92, tf:0.97, vf:0.79, tier:"LIMITED"   },
  "Honda CBR1000RR-R Fireblade SP":  { bf:0.93, tf:1.06, vf:0.80, tier:"LIMITED"   },
  "Yamaha YZF-R1M":                  { bf:0.94, tf:1.06, vf:0.80, tier:"LIMITED"   },
  "Aprilia RSV4 Factory":            { bf:0.91, tf:1.06, vf:0.85, tier:"TOP SPEC"  },
  "Suzuki Hayabusa":                 { bf:1.00, tf:1.06, vf:0.86, tier:"TOP SPEC"  },
  "Royal Enfield Himalayan 450":     { bf:1.03, tf:0.88, vf:0.94, tier:"STD"       },
  "BMW R 12 nineT":                  { bf:0.83, tf:0.86, vf:0.89, tier:"RETRO"     },
};

const BRAND_COLORS = { "BMW":"#3b82f6","Ducati":"#ef4444","Harley-Davidson":"#f97316","Triumph":"#8b5cf6","Kawasaki":"#15803d","KTM":"#ea580c","Honda":"#dc2626","Yamaha":"#1d4ed8","Aprilia":"#7c3aed","Suzuki":"#475569","Royal Enfield":"#78350f" };
const TIER_COLORS  = { "LIMITED":"#f59e0b","TOP SPEC":"#a78bfa","S / R":"#818cf8","ADVENTURE":"#34d399","RETRO":"#fb923c","SE":"#60a5fa","STD":"#374151" };

function calcMV(catalogus, bouwjaar, km, model) {
  const age     = 2026 - parseInt(bouwjaar);
  const dep     = baseDep(age);
  const entry   = MODEL_DB[model] || { bf:1.0, tf:1.0, vf:1.0, tier:"STD" };
  const combined = dep * entry.bf * entry.tf * entry.vf;
  const base    = Math.round(catalogus * combined);
  const expKm   = age * AVG_KM;
  const kmDiff  = km - expKm;
  const kmCorr  = Math.max(-0.14, Math.min(0.14, -(kmDiff / 1000) * 0.009));
  const fair    = Math.round(base * (1 + kmCorr));
  return { fair, base, age, dep, combined, expKm, kmDiff, kmCorr, bf:entry.bf, tf:entry.tf, vf:entry.vf, tier:entry.tier };
}

function getScore(price, fair) {
  const r = price / fair;
  if (r <= 0.80) return { label:"ABSOLUTE KOOPJE", short:"KOOPJE",       color:"#00e676", bg:"#001a0a", icon:"🔥" };
  if (r <= 0.92) return { label:"GOEDE DEAL",      short:"GOEDE DEAL",   color:"#69f0ae", bg:"#001508", icon:"✅" };
  if (r <= 1.08) return { label:"EERLIJKE PRIJS",  short:"EERLIJK",      color:"#ffeb3b", bg:"#1a1600", icon:"⚖️" };
  if (r <= 1.22) return { label:"AAN DE PRIJS",    short:"AAN DE PRIJS", color:"#ffa726", bg:"#1a0c00", icon:"⚠️" };
  return               { label:"OVERPRICED",        short:"TE DUUR",      color:"#f44336", bg:"#1a0000", icon:"❌" };
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTINGS
// ══════════════════════════════════════════════════════════════════════════════
const SOURCES   = ["Marktplaats","2dehands","Facebook Marketplace","eBay Motors","AutoScout24","Motortreffer"];
const RAW = [
  { id:1,  brand:"BMW",             model:"BMW R 1250 GS Adventure",              year:2021, price:21500, km:14200, source:"Marktplaats",          loc:"Amsterdam",  type:"Adventure / Enduro",    cat:23900, kenteken:"KZ-123-B" },
  { id:2,  brand:"BMW",             model:"BMW S 1000 RR M",                      year:2022, price:28500, km:4100,  source:"AutoScout24",           loc:"Utrecht",    type:"Sport / Supersport",    cat:31000, kenteken:"BM-997-R" },
  { id:3,  brand:"Ducati",          model:"Ducati Panigale V4 R",                 year:2021, price:34500, km:2800,  source:"eBay Motors",           loc:"Rotterdam",  type:"Sport / Supersport",    cat:41000, kenteken:"DV-290-R" },
  { id:4,  brand:"Ducati",          model:"Ducati Scrambler Icon",                year:2020, price:6800,  km:9800,  source:"Marktplaats",          loc:"Haarlem",    type:"Retro / Café Racer",    cat:10200, kenteken:"SC-611-D" },
  { id:5,  brand:"Harley-Davidson", model:"Harley-Davidson Heritage Classic Limited", year:2020, price:23500, km:5200, source:"Facebook Marketplace", loc:"Breda",  type:"Cruiser / Chopper",     cat:27500, kenteken:"HL-774-C" },
  { id:6,  brand:"Triumph",         model:"Triumph Thruxton RS",                  year:2021, price:14500, km:7800,  source:"2dehands",             loc:"Maastricht", type:"Retro / Café Racer",    cat:16900, kenteken:"TR-509-X" },
  { id:7,  brand:"Kawasaki",        model:"Kawasaki Z900 RS SE",                  year:2022, price:13200, km:6400,  source:"Marktplaats",          loc:"Groningen",  type:"Retro / Café Racer",    cat:15500, kenteken:"ZR-334-K" },
  { id:8,  brand:"Kawasaki",        model:"Kawasaki Ninja H2",                    year:2020, price:21000, km:8100,  source:"AutoScout24",           loc:"Den Haag",   type:"Sport / Supersport",    cat:28000, kenteken:"H2-117-N" },
  { id:9,  brand:"KTM",             model:"KTM 1290 Super Duke RR",               year:2021, price:22000, km:3200,  source:"eBay Motors",          loc:"Almere",     type:"Naked / Streetfighter", cat:26000, kenteken:"KS-103-D" },
  { id:10, brand:"Honda",           model:"Honda CBR1000RR-R Fireblade SP",        year:2022, price:27500, km:5100,  source:"Marktplaats",          loc:"Eindhoven",  type:"Sport / Supersport",    cat:31000, kenteken:"FB-449-H" },
  { id:11, brand:"Yamaha",          model:"Yamaha YZF-R1M",                        year:2021, price:21000, km:7200,  source:"Motortreffer",         loc:"Zwolle",     type:"Sport / Supersport",    cat:26000, kenteken:"R1-882-Y" },
  { id:12, brand:"Aprilia",         model:"Aprilia RSV4 Factory",                  year:2022, price:19500, km:5800,  source:"2dehands",             loc:"Tilburg",    type:"Sport / Supersport",    cat:23500, kenteken:"AP-733-F" },
  { id:13, brand:"Suzuki",          model:"Suzuki Hayabusa",                       year:2022, price:17500, km:6400,  source:"Marktplaats",          loc:"Arnhem",     type:"Sport / Supersport",    cat:20500, kenteken:"BU-928-S" },
  { id:14, brand:"Royal Enfield",   model:"Royal Enfield Himalayan 450",           year:2024, price:7900,  km:1200,  source:"Marktplaats",          loc:"Amsterdam",  type:"Adventure / Enduro",    cat:7800,  kenteken:"HI-024-E" },
  { id:15, brand:"BMW",             model:"BMW R 12 nineT",                        year:2024, price:16800, km:800,   source:"AutoScout24",          loc:"Utrecht",    type:"Retro / Café Racer",    cat:17200, kenteken:"N9-024-B" },
];

const LISTINGS_BASE = RAW.map(l => {
  const mv    = calcMV(l.cat, l.year, l.km, l.model.replace(l.brand + " ", ""));
  const score = getScore(l.price, mv.fair);
  return { ...l, mv, score };
});

// ══════════════════════════════════════════════════════════════════════════════
// RDW DETAIL HOOK — haalt alles op voor één kenteken
// ══════════════════════════════════════════════════════════════════════════════
function useRDW(kenteken, bouwjaar, huidigKm) {
  const [state, setState] = useState({ loading: true, voertuig: null, apk: [], nap: null, error: null });

  useEffect(() => {
    if (!kenteken) return;
    setState({ loading: true, voertuig: null, apk: [], nap: null, error: null });

    const k = normKenteken(kenteken);

    async function fetchAll() {
      // Probeer echte RDW API
      const [voertuig, apkRaw] = await Promise.all([
        rdwVoertuig(kenteken),
        rdwApkHistorie(kenteken),
      ]);

      // Gebruik mock als RDW geen data retourneert
      const v = voertuig || MOCK_VOERTUIG[k] || null;

      // Parseer APK historie
      let apkHistorie = [];
      if (apkRaw && apkRaw.length > 0) {
        apkHistorie = apkRaw
          .filter(r => r.kilometerstand)
          .map(r => ({
            datum: r.soort_erkenning_omschrijving || r.datum_tenaamstelling || "",
            km: parseInt(r.kilometerstand) || 0,
            oordeel: r.tellerstandoordeel || r.meldingsoordeel_afstand || "Onbekend",
          }))
          .filter(r => r.km > 0)
          .sort((a, b) => new Date(a.datum) - new Date(b.datum));
      }

      // Fallback naar mock APK data
      if (apkHistorie.length === 0) {
        apkHistorie = (MOCK_APK[k] || []).map(r => ({
          datum: r.datum,
          km: r.km,
          oordeel: r.oordeel,
          verdacht: r.verdacht || false,
        }));
      }

      const nap = analyseKmStand(apkHistorie, huidigKm, bouwjaar);
      setState({ loading: false, voertuig: v, apk: apkHistorie, nap, error: null });
    }

    fetchAll().catch(err => setState(s => ({ ...s, loading: false, error: err.message })));
  }, [kenteken]);

  return state;
}

// ══════════════════════════════════════════════════════════════════════════════
// NAP BADGE (compact, voor op kaart)
// ══════════════════════════════════════════════════════════════════════════════
function NapBadge({ nap, loading }) {
  if (loading) return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", background:"#111", border:"1px solid #222", padding:"3px 8px", borderRadius:"2px", fontSize:"8px", color:"#444", letterSpacing:"1px" }}>
      <span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span> RDW...
    </span>
  );
  if (!nap) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", background:`${nap.kleur}15`, border:`1px solid ${nap.kleur}44`, padding:"3px 8px", borderRadius:"2px", fontSize:"8px", color:nap.kleur, fontWeight:"800", letterSpacing:"1px" }}>
      {nap.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APK KM TIMELINE (voor in de modal)
// ══════════════════════════════════════════════════════════════════════════════
function ApkTimeline({ apk, huidigKm, nap }) {
  if (!apk || apk.length === 0) return (
    <div style={{ padding:"12px", background:"#111", border:"1px solid #1a1a1a", fontSize:"11px", color:"#333", textAlign:"center" }}>Geen APK-historiedata beschikbaar</div>
  );

  const maxKm = Math.max(huidigKm, ...apk.map(a => a.km)) * 1.05;

  return (
    <div style={{ background:"#111", border:"1px solid #1a1a1a", padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <div style={{ fontSize:"9px", color:"#ff6b00", letterSpacing:"3px" }}>APK KM-HISTORIEK</div>
        <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
          <span style={{ fontSize:"9px", color:nap.kleur, fontWeight:"800" }}>{nap.label}</span>
          <div style={{ width:"32px", height:"5px", background:"#1a1a1a", borderRadius:"3px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${nap.score}%`, background:nap.kleur }} />
          </div>
          <span style={{ fontSize:"9px", color:"#444", fontFamily:"monospace" }}>{nap.score}/100</span>
        </div>
      </div>

      {/* Timeline bars */}
      <div style={{ display:"grid", gap:"6px" }}>
        {apk.map((entry, i) => {
          const barW = Math.max(2, (entry.km / maxKm) * 100);
          const isVerdacht = entry.status === "TERUGLOOP" || entry.verdacht;
          const col = isVerdacht ? "#f44336" : i === 0 ? "#60a5fa" : "#69f0ae";
          return (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"90px 1fr 90px", gap:"8px", alignItems:"center" }}>
              <span style={{ fontSize:"9px", color:"#333", fontFamily:"monospace" }}>{entry.datum?.slice(0,10) || "-"}</span>
              <div style={{ position:"relative", height:"14px", background:"#0d0d0d", borderRadius:"1px" }}>
                <div style={{ height:"100%", width:`${barW}%`, background:`${col}88`, borderRadius:"1px", transition:"width 0.6s ease", position:"relative" }}>
                  {isVerdacht && <div style={{ position:"absolute", inset:0, background:`repeating-linear-gradient(45deg, transparent, transparent 3px, ${col}44 3px, ${col}44 6px)` }} />}
                </div>
                {isVerdacht && <div style={{ position:"absolute", right:"4px", top:"50%", transform:"translateY(-50%)", fontSize:"9px" }}>⚠️</div>}
              </div>
              <span style={{ fontSize:"10px", color:isVerdacht?"#f44336":"#888", fontFamily:"monospace", textAlign:"right", fontWeight:isVerdacht?"800":"400" }}>
                {entry.km.toLocaleString("nl-NL")} km
              </span>
            </div>
          );
        })}

        {/* Huidige km */}
        <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 90px", gap:"8px", alignItems:"center", borderTop:"1px dashed #222", paddingTop:"6px", marginTop:"2px" }}>
          <span style={{ fontSize:"9px", color:"#ff6b00", fontFamily:"monospace" }}>NU (advertentie)</span>
          <div style={{ height:"14px", background:"#0d0d0d", borderRadius:"1px", position:"relative" }}>
            <div style={{ height:"100%", width:`${Math.max(2,(huidigKm/maxKm)*100)}%`, background:"#ff6b0066", borderRadius:"1px" }} />
          </div>
          <span style={{ fontSize:"10px", color:"#ff6b00", fontFamily:"monospace", textAlign:"right", fontWeight:"800" }}>
            {huidigKm.toLocaleString("nl-NL")} km
          </span>
        </div>
      </div>

      {/* Flags */}
      {nap.flags && nap.flags.length > 0 && (
        <div style={{ marginTop:"10px", display:"grid", gap:"4px" }}>
          {nap.flags.map((f, i) => (
            <div key={i} style={{ fontSize:"10px", color: f.startsWith("❌")?"#f44336":"#ffa726", background:`${f.startsWith("❌")?"#f44336":"#ffa726"}0d`, border:`1px solid ${f.startsWith("❌")?"#f44336":"#ffa726"}22`, padding:"5px 10px", borderRadius:"2px" }}>{f}</div>
          ))}
        </div>
      )}

      {nap.flags && nap.flags.length === 0 && (
        <div style={{ marginTop:"8px", fontSize:"10px", color:"#69f0ae", background:"#69f0ae0d", border:"1px solid #69f0ae22", padding:"5px 10px", borderRadius:"2px" }}>
          ✅ Km-stand ziet er logisch uit — geen afwijkingen gevonden in APK-historie
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RDW DATA PANEL (voertuigkaart in modal)
// ══════════════════════════════════════════════════════════════════════════════
function RdwPanel({ voertuig, loading }) {
  if (loading) return (
    <div style={{ background:"#111", border:"1px solid #1a1a1a", padding:"20px", textAlign:"center" }}>
      <div style={{ fontSize:"10px", color:"#ff6b00", letterSpacing:"2px", fontFamily:"monospace" }}>
        ⟳ RDW OPENDATA OPHALEN...
      </div>
      <div style={{ fontSize:"9px", color:"#333", marginTop:"4px" }}>opendata.rdw.nl</div>
    </div>
  );
  if (!voertuig) return (
    <div style={{ background:"#111", border:"1px solid #1a1a1a", padding:"12px 16px", fontSize:"10px", color:"#333" }}>
      Geen RDW-data gevonden voor dit kenteken
    </div>
  );

  const apkDatum = voertuig.vervaldatum_apk || voertuig.dt_vervaldatum_apk;
  const apkStr   = apkDatum ? `${apkDatum.slice(0,4)}-${apkDatum.slice(4,6)}-${apkDatum.slice(6,8)}` : "—";
  const apkVerlopen = apkDatum && new Date() > new Date(apkStr);
  const toelating = voertuig.datum_eerste_toelating;
  const toelStr   = toelating ? `${toelating.slice(0,4)}-${toelating.slice(4,6)}-${toelating.slice(6,8)}` : "—";
  const cat       = voertuig.catalogusprijs ? `€ ${parseInt(voertuig.catalogusprijs).toLocaleString("nl-NL")}` : "—";
  const cilinder  = voertuig.cilinderinhoud ? `${parseInt(voertuig.cilinderinhoud).toLocaleString("nl-NL")} cc` : "—";
  const gewicht   = voertuig.massa_ledig_voertuig || voertuig.vermogen_massarijklaar ? `${voertuig.massa_ledig_voertuig || voertuig.vermogen_massarijklaar} kg` : "—";

  const fields = [
    { l:"MERK",            v: voertuig.merk || "—" },
    { l:"MODEL",           v: voertuig.handelsbenaming || voertuig.type_gasinstallatie || "—" },
    { l:"KLEUR",           v: voertuig.eerste_kleur || voertuig.kleur || "—" },
    { l:"CILINDERINHOUD",  v: cilinder },
    { l:"GEWICHT",         v: gewicht },
    { l:"BRANDSTOF",       v: voertuig.brandstof_omschrijving || voertuig.brandstof || "—" },
    { l:"EERSTE TOELATING",v: toelStr },
    { l:"CATALOGUSPRIJS",  v: cat },
  ];

  return (
    <div style={{ background:"#111", border:"1px solid #1a1a1a" }}>
      <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a1a1a", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:"9px", color:"#ff6b00", letterSpacing:"3px" }}>RDW VOERTUIGDATA</div>
        <div style={{ fontSize:"8px", color:"#2a2a2a", letterSpacing:"1px" }}>opendata.rdw.nl</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1px", background:"#1a1a1a" }}>
        {fields.map(f => (
          <div key={f.l} style={{ background:"#111", padding:"8px 12px" }}>
            <div style={{ fontSize:"7px", color:"#2a2a2a", letterSpacing:"2px" }}>{f.l}</div>
            <div style={{ fontSize:"13px", color:"#ddd", fontWeight:"600", marginTop:"2px" }}>{f.v}</div>
          </div>
        ))}
      </div>
      <div style={{ padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid #1a1a1a" }}>
        <div>
          <div style={{ fontSize:"7px", color:"#2a2a2a", letterSpacing:"2px" }}>APK GELDIG TOT</div>
          <div style={{ fontSize:"14px", fontWeight:"800", color:"#fff" }}>{apkStr}</div>
        </div>
        <div style={{ padding:"6px 14px", background: apkVerlopen ? "#1a0000" : "#001508", border:`1px solid ${apkVerlopen?"#f44336":"#69f0ae"}`, fontSize:"10px", fontWeight:"800", letterSpacing:"1px", color: apkVerlopen ? "#f44336" : "#69f0ae" }}>
          {apkVerlopen ? "❌ VERLOPEN" : "✅ GELDIG"}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL (volledig)
// ══════════════════════════════════════════════════════════════════════════════
function DetailModal({ listing, onClose }) {
  const { mv, score, cat, price, km, year, brand, model, kenteken, type } = listing;
  const rdw    = useRDW(kenteken, year, km);
  const saving = mv.fair - price;
  const gaugeVal = Math.max(0, Math.min(100, Math.round((2 - price / mv.fair) * 50)));
  const tierCol  = TIER_COLORS[mv.tier] || "#374151";
  const brandCol = BRAND_COLORS[brand] || "#ff6b00";

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.94)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"14px", overflowY:"auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#0d0d0d", border:`1px solid ${score.color}33`, borderRadius:"4px", width:"100%", maxWidth:"640px", maxHeight:"94vh", overflowY:"auto" }}>

        {/* Header */}
        <div style={{ background:"#111", borderBottom:"1px solid #1a1a1a", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"sticky", top:0, zIndex:10 }}>
          <div>
            <div style={{ fontSize:"9px", color:brandCol, letterSpacing:"3px" }}>{brand}</div>
            <div style={{ fontSize:"20px", fontWeight:"900", color:"#fff", lineHeight:1.1 }}>{model.replace(brand + " ", "")}</div>
            <div style={{ display:"flex", gap:"5px", marginTop:"7px", flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", background:score.bg, border:`1px solid ${score.color}44`, padding:"3px 9px", borderRadius:"2px", fontSize:"9px", color:score.color, fontWeight:"800", letterSpacing:"2px" }}>{score.icon} {score.label}</span>
              <span style={{ display:"inline-flex", background:`${tierCol}15`, border:`1px solid ${tierCol}44`, padding:"3px 8px", borderRadius:"2px", fontSize:"8px", color:tierCol, fontWeight:"800", letterSpacing:"2px" }}>{mv.tier}</span>
              <NapBadge nap={rdw.nap} loading={rdw.loading} />
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #222", color:"#555", fontSize:"18px", cursor:"pointer", padding:"4px 10px", marginLeft:"10px" }}>✕</button>
        </div>

        <div style={{ padding:"14px 18px", display:"grid", gap:"12px" }}>

          {/* Gauge + KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"110px 1fr", gap:"12px", alignItems:"center" }}>
            <div>
              <svg width="110" height="72" viewBox="0 0 110 72">
                <path d="M10,62 A44,44 0 0,1 100,62" fill="none" stroke="#1a1a1a" strokeWidth="10" strokeLinecap="round"/>
                <path d="M10,62 A44,44 0 0,1 100,62" fill="none" stroke="url(#gg)" strokeWidth="10" strokeLinecap="round" strokeDasharray="138" strokeDashoffset={138-(gaugeVal/100)*138}/>
                <defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f44336"/><stop offset="50%" stopColor="#ffeb3b"/><stop offset="100%" stopColor="#00e676"/>
                </linearGradient></defs>
                <text x="55" y="57" textAnchor="middle" fill={score.color} fontSize="18" fontWeight="900" fontFamily="monospace">{gaugeVal}</text>
                <text x="55" y="67" textAnchor="middle" fill="#2a2a2a" fontSize="7" fontFamily="monospace">/100</text>
              </svg>
              <div style={{ textAlign:"center", fontSize:"7px", color:"#2a2a2a", letterSpacing:"2px" }}>WAARDE SCORE</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
              {[
                { l:"VRAAGPRIJS",  v:`€ ${price.toLocaleString("nl-NL")}`,     c:score.color },
                { l:"MARKTWAARDE", v:`€ ${mv.fair.toLocaleString("nl-NL")}`,   c:"#69f0ae" },
                { l:"CATALOGUS",   v:`€ ${cat.toLocaleString("nl-NL")}`,       c:"#333" },
                { l: saving>=0?"BESPARING":"MEERPRIJS", v:`${saving>=0?"−":"+"}€ ${Math.abs(saving).toLocaleString("nl-NL")}`, c:saving>=0?"#69f0ae":"#f44336" },
              ].map(k => (
                <div key={k.l} style={{ background:"#111", border:"1px solid #1a1a1a", padding:"7px 9px" }}>
                  <div style={{ fontSize:"7px", color:"#2a2a2a", letterSpacing:"2px" }}>{k.l}</div>
                  <div style={{ fontSize:"14px", fontWeight:"800", color:k.c, marginTop:"1px" }}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Waarde positie bar */}
          <div style={{ background:"#111", border:"1px solid #1a1a1a", padding:"12px 14px" }}>
            {(() => {
              const lo=Math.min(price,mv.fair)*0.72, hi=Math.max(price,mv.fair,cat)*1.08, range=hi-lo;
              const pct=v=>Math.max(2,Math.min(97,((v-lo)/range)*100));
              return (
                <div>
                  <div style={{ fontSize:"9px", color:"#444", letterSpacing:"2px", marginBottom:"10px" }}>MARKTPOSITIE</div>
                  <div style={{ position:"relative", height:"18px", background:"#0d0d0d", border:"1px solid #1a1a1a", margin:"16px 0 20px" }}>
                    <div style={{ position:"absolute", left:`${pct(cat)}%`, top:"-14px", transform:"translateX(-50%)", fontSize:"7px", color:"#2a2a2a", whiteSpace:"nowrap" }}>NIEUW</div>
                    <div style={{ position:"absolute", left:`${pct(cat)}%`, top:0, bottom:0, width:"2px", background:"#1e1e1e", transform:"translateX(-50%)" }} />
                    <div style={{ position:"absolute", left:`${pct(mv.fair)}%`, bottom:"-15px", transform:"translateX(-50%)", fontSize:"7px", color:"#69f0ae", whiteSpace:"nowrap" }}>MARKT</div>
                    <div style={{ position:"absolute", left:`${pct(mv.fair)}%`, top:"-2px", bottom:"-2px", width:"3px", background:"#69f0ae", transform:"translateX(-50%)", borderRadius:"1px" }} />
                    <div style={{ position:"absolute", left:`${pct(price)}%`, top:"-15px", transform:"translateX(-50%)", fontSize:"7px", color:score.color, whiteSpace:"nowrap", fontWeight:"800" }}>VRAAG</div>
                    <div style={{ position:"absolute", left:`${pct(price)}%`, top:"-3px", bottom:"-3px", width:"5px", background:score.color, transform:"translateX(-50%)", borderRadius:"1px", boxShadow:`0 0 8px ${score.color}55` }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:"8px", color:"#1e1e1e" }}>
                    <span>€{Math.round(lo).toLocaleString("nl-NL")}</span><span>€{Math.round(hi).toLocaleString("nl-NL")}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── NAP / APK KM-HISTORIEK ──────────────────────────────────── */}
          <ApkTimeline apk={rdw.apk} huidigKm={km} nap={rdw.nap || { label:"Laden...", kleur:"#444", score:0, flags:[] }} />

          {/* ── RDW VOERTUIGDATA ─────────────────────────────────────────── */}
          <RdwPanel voertuig={rdw.voertuig} loading={rdw.loading} />

          {/* Kenteken badge */}
          <div style={{ background:"#111", border:"1px solid #1a1a1a", padding:"9px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:"7px", color:"#1a1a1a", letterSpacing:"2px" }}>OVI.RDW.NL · OPENDATA.RDW.NL · APK-KEURINGSHISTORIE</div>
            <div style={{ fontFamily:"monospace", fontSize:"16px", fontWeight:"900", letterSpacing:"4px", color:"#fff", background:"#1a1a1a", padding:"5px 14px", border:"1px solid #2a2a2a" }}>{kenteken}</div>
          </div>

          {/* Afschrijving breakdown */}
          <div style={{ background:"#111", border:"1px solid #1a1a1a", padding:"12px 14px" }}>
            <div style={{ fontSize:"9px", color:"#ff6b00", letterSpacing:"3px", marginBottom:"8px" }}>WAARDE BEREKENING</div>
            {[
              { l:"Cataloguswaarde (nieuwprijs)",                                 v:`€ ${cat.toLocaleString("nl-NL")}`,    b:false },
              { l:`Gecombineerde factor (leeftijd × merk × type × versie)`,       v:`${Math.round(mv.combined*100)}%`,     b:false },
              { l:"= Basismarktwaarde",                                           v:`€ ${mv.base.toLocaleString("nl-NL")}`,b:true, a:true },
              { l:`Km-correctie (${mv.kmDiff>0?"+":""}${Math.round(mv.kmDiff/1000)}k vs gem ${Math.round(mv.expKm/1000)}k)`, v:`${mv.kmCorr>=0?"+":""}${Math.round(mv.kmCorr*100)}%`, b:false },
              { l:"= Berekende marktwaarde",                                      v:`€ ${mv.fair.toLocaleString("nl-NL")}`,b:true, a:true },
              { l:"Vraagprijs",                                                   v:`€ ${price.toLocaleString("nl-NL")}`,  b:true },
            ].map((r,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderTop:r.b?"1px solid #1a1a1a":"none" }}>
                <span style={{ fontSize:"10px", color:r.a?"#69f0ae":"#3a3a3a", flex:1, paddingRight:"10px" }}>{r.l}</span>
                <span style={{ fontSize:"11px", fontWeight:r.b?"900":"400", color:r.a?"#69f0ae":"#666", fontFamily:"monospace" }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTING CARD
// ══════════════════════════════════════════════════════════════════════════════
function ListingCard({ listing, onOpen }) {
  const [hov, setHov] = useState(false);
  const { score, mv, price, cat, brand, kenteken, year, km } = listing;
  const saving   = mv.fair - price;
  const tierCol  = TIER_COLORS[mv.tier] || "#374151";
  const brandCol = BRAND_COLORS[brand] || "#ff6b00";

  // Laad NAP-status alvast (compact, voor badge op kaart)
  const rdw = useRDW(kenteken, year, km);

  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>onOpen(listing)}
      style={{ background:hov?"#131313":"#0f0f0f", border:`1px solid ${hov?score.color+"55":"#1a1a1a"}`, borderRadius:"4px", overflow:"hidden", cursor:"pointer", transition:"all 0.2s", display:"flex", flexDirection:"column" }}>

      <div style={{ position:"relative", background:`linear-gradient(135deg, #0d0d0d, #151515)`, height:"115px", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:`${brandCol}07`, borderBottom:`2px solid ${brandCol}1a` }} />
        <span style={{ fontSize:"40px", transform:hov?"scale(1.1)":"scale(1)", transition:"transform 0.4s", zIndex:1 }}>🏍</span>
        <div style={{ position:"absolute", top:"8px", left:"8px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:"3px", background:score.bg, border:`1px solid ${score.color}44`, padding:"2px 7px", borderRadius:"2px", fontSize:"8px", color:score.color, fontWeight:"800", letterSpacing:"1px" }}>{score.icon} {score.short}</span>
        </div>
        <div style={{ position:"absolute", top:"8px", right:"8px", display:"flex", flexDirection:"column", gap:"3px", alignItems:"flex-end" }}>
          <span style={{ background:`${tierCol}18`, border:`1px solid ${tierCol}44`, color:tierCol, fontSize:"7px", padding:"2px 5px", letterSpacing:"1px", fontWeight:"800" }}>{mv.tier}</span>
          <NapBadge nap={rdw.nap} loading={rdw.loading} />
        </div>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"2px", background:`linear-gradient(90deg, ${brandCol}00, ${brandCol}55, ${brandCol}00)` }} />
      </div>

      <div style={{ padding:"10px 12px", flex:1, display:"flex", flexDirection:"column", gap:"6px" }}>
        <div>
          <div style={{ fontSize:"9px", color:brandCol, letterSpacing:"2px", fontWeight:"700" }}>{brand}</div>
          <div style={{ fontSize:"14px", fontWeight:"800", color:"#fff", lineHeight:1.2 }}>{listing.model.replace(brand + " ", "")}</div>
          <div style={{ fontSize:"9px", color:"#2a2a2a", marginTop:"1px" }}>{listing.type} · {listing.year} · {listing.loc}</div>
        </div>
        <div style={{ fontSize:"10px", color:"#333" }}>{km.toLocaleString("nl-NL")} km · {listing.source}</div>

        <div style={{ background:score.bg, border:`1px solid ${score.color}22`, borderRadius:"2px", padding:"5px 8px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
            <span style={{ fontSize:"8px", color:score.color, fontWeight:"700", letterSpacing:"1px" }}>{score.icon} {score.short}</span>
            <span style={{ fontSize:"9px", color:saving>=0?"#69f0ae":"#f44336", fontWeight:"700" }}>
              {saving>=0?`−€${saving.toLocaleString("nl-NL")}`:`+€${Math.abs(saving).toLocaleString("nl-NL")}`} vs markt
            </span>
          </div>
          <div style={{ height:"2px", background:"#111", borderRadius:"2px" }}>
            <div style={{ height:"100%", width:`${Math.max(4,Math.min(100,(mv.fair/price)*50))}%`, background:score.color }} />
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", paddingTop:"7px", borderTop:"1px solid #111", marginTop:"auto" }}>
          <div>
            <div style={{ fontSize:"7px", color:"#1e1e1e", letterSpacing:"1px" }}>VRAAGPRIJS</div>
            <div style={{ fontSize:"19px", fontWeight:"900", color:"#ff6b00", lineHeight:1 }}>€{price.toLocaleString("nl-NL")}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:"7px", color:"#1e1e1e", letterSpacing:"1px" }}>MARKTWAARDE</div>
            <div style={{ fontSize:"13px", fontWeight:"700", color:"#69f0ae" }}>€{mv.fair.toLocaleString("nl-NL")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
const BRANDS = ["Alle merken", ...new Set(RAW.map(l => l.brand))];
const TYPES  = ["Alle typen","Adventure / Enduro","Naked / Streetfighter","Sport / Supersport","Tourer / GT","Cruiser / Chopper","Retro / Café Racer"];

export default function MotorShop() {
  const [brand, setBrand]         = useState("Alle merken");
  const [type,  setType]          = useState("Alle typen");
  const [query, setQuery]         = useState("");
  const [maxPrice, setMaxPrice]   = useState("");
  const [maxKm,    setMaxKm]      = useState("");
  const [sorting,  setSorting]    = useState("score");
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [onlyNap,   setOnlyNap]   = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [scanLog,  setScanLog]    = useState([]);
  const [results,  setResults]    = useState([]);
  const [selected, setSelected]   = useState(null);
  const [activeSrc,setActiveSrc]  = useState("Alle");
  const logRef = useRef(null);

  const allSrc = ["Alle", ...SOURCES];

  const filtered = results.filter(l => {
    if (brand!=="Alle merken" && l.brand!==brand) return false;
    if (type !=="Alle typen"  && l.type !==type)  return false;
    if (query && !`${l.brand} ${l.model}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (maxPrice && l.price > parseInt(maxPrice)) return false;
    if (maxKm    && l.km    > parseInt(maxKm))    return false;
    if (activeSrc!=="Alle" && l.source!==activeSrc) return false;
    if (onlyDeals && l.price >= l.mv.fair * 0.95) return false;
    return true;
  }).sort((a,b) => {
    if (sorting==="score")      return (a.price/a.mv.fair)-(b.price/b.mv.fair);
    if (sorting==="price_asc")  return a.price-b.price;
    if (sorting==="price_desc") return b.price-a.price;
    if (sorting==="km_asc")     return a.km-b.km;
    return 0;
  });

  const dealCount = results.filter(l => l.price < l.mv.fair * 0.93).length;

  const runScan = () => {
    setScanning(true); setResults([]); setScanLog([]);
    let step = 0;
    const logs = [
      "⚡ Motor.shop scanner gestart...",
      "🔍 Verbinding Marktplaats.nl...",           "✓ Marktplaats: 6 advertenties",
      "🔍 Verbinding 2dehands & AutoScout24...",   "✓ 4 resultaten",
      "🔍 eBay Motors, Facebook, Motortreffer...", "✓ 5 resultaten",
      "📡 RDW opendata.rdw.nl — voertuigdata...",
      "📋 RDW sgfe-77wx — APK keuringshistorie...",
      "🔍 Km-stand validatie per kenteken...",
      "📊 KPI: basis × merk × type × versie × km...",
      `✅ Klaar — ${RAW.length} advertenties · RDW + NAP geanalyseerd`,
    ];
    const iv = setInterval(() => {
      if (step < logs.length) {
        setScanLog(p => [...p, logs[step++]]);
        if (logRef.current) logRef.current.scrollTop = 9999;
      } else { clearInterval(iv); setScanning(false); setResults(LISTINGS_BASE); }
    }, 360);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080808", color:"#fff", fontFamily:"'Barlow Condensed','Arial Narrow',Arial,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input{background:#0d0d0d!important;color:#fff!important;border:1px solid #1e1e1e!important;border-radius:3px;padding:10px 14px;font-size:14px;outline:none;width:100%;font-family:inherit}
        input:focus{border-color:#ff6b00!important}
        select{background:#0d0d0d;color:#fff;border:1px solid #1e1e1e;border-radius:3px;padding:10px 14px;font-size:14px;outline:none;width:100%;font-family:inherit;appearance:none;-webkit-appearance:none}
        select:focus{border-color:#ff6b00}
        select option{background:#0d0d0d}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2a2a2a}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom:"1px solid #0f0f0f", padding:"0 20px" }}>
        <div style={{ maxWidth:"1360px", margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:"60px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ width:"36px", height:"36px", background:"#ff6b00", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px" }}>🏍</div>
            <div>
              <div style={{ fontSize:"24px", fontWeight:"900", letterSpacing:"3px", lineHeight:1 }}>MOTOR<span style={{ color:"#ff6b00" }}>.SHOP</span></div>
              <div style={{ fontSize:"7px", letterSpacing:"3px", color:"#1e1e1e" }}>AGGREGATOR · RDW LIVE · APK HISTORIEK · NAP VALIDATIE</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:"16px", alignItems:"center" }}>
            {results.length > 0 && (
              <>
                {[{l:"KOOPJES",v:dealCount,c:"#69f0ae"},{l:"TOTAAL",v:results.length,c:"#ff6b00"}].map(s => (
                  <div key={s.l} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:"20px", fontWeight:"900", color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:"7px", color:"#2a2a2a", letterSpacing:"2px" }}>{s.l}</div>
                  </div>
                ))}
              </>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:"3px", alignItems:"flex-end" }}>
              <div style={{ display:"flex", gap:"6px" }}>
                {["RDW","APK","NAP"].map(tag => (
                  <span key={tag} style={{ background:"#0f0f0f", border:"1px solid #1a1a1a", color:"#2a2a2a", fontSize:"8px", padding:"2px 6px", letterSpacing:"2px" }}>{tag}</span>
                ))}
              </div>
              <div style={{ fontSize:"7px", color:"#1a1a1a", letterSpacing:"1px" }}>LIVE VIA OPENDATA.RDW.NL</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:"1360px", margin:"0 auto", padding:"16px 20px" }}>

        {/* FILTERS */}
        <div style={{ background:"#0d0d0d", border:"1px solid #1a1a1a", borderRadius:"4px", padding:"14px 16px", marginBottom:"12px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:"8px", marginBottom:"10px" }}>
            <input placeholder="Zoek merk of model..." value={query} onChange={e=>setQuery(e.target.value)} />
            <select value={brand} onChange={e=>setBrand(e.target.value)}>{BRANDS.map(b=><option key={b}>{b}</option>)}</select>
            <select value={type}  onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select>
            <input placeholder="Max prijs (€)" type="number" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} />
            <input placeholder="Max km-stand"  type="number" value={maxKm}    onChange={e=>setMaxKm(e.target.value)} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", gap:"16px" }}>
              {[
                { label:"ALLEEN KOOPJES", active:onlyDeals, toggle:()=>setOnlyDeals(!onlyDeals), col:"#69f0ae" },
                { label:"ALLEEN LOGISCHE KM", active:onlyNap, toggle:()=>setOnlyNap(!onlyNap), col:"#60a5fa" },
              ].map(t => (
                <label key={t.label} onClick={t.toggle} style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"10px", color:t.active?t.col:"#2a2a2a", letterSpacing:"2px" }}>
                  <div style={{ width:"28px", height:"15px", background:t.active?`${t.col}12`:"#111", border:`1px solid ${t.active?t.col:"#222"}`, borderRadius:"8px", position:"relative", transition:"all 0.2s" }}>
                    <div style={{ position:"absolute", top:"2px", left:t.active?"12px":"2px", width:"9px", height:"9px", background:t.active?t.col:"#2a2a2a", borderRadius:"50%", transition:"left 0.2s" }} />
                  </div>
                  {t.label}
                </label>
              ))}
            </div>
            <button onClick={runScan} disabled={scanning}
              style={{ background:scanning?"#111":"#ff6b00", color:scanning?"#333":"#000", border:"none", padding:"11px 32px", fontSize:"14px", fontWeight:"900", letterSpacing:"3px", cursor:scanning?"default":"pointer", fontFamily:"inherit" }}>
              {scanning ? "⟳ SCANNEN..." : "⚡ SCAN & ANALYSEER"}
            </button>
          </div>
        </div>

        {/* SCAN LOG */}
        {(scanning || scanLog.length > 0) && (
          <div ref={logRef} style={{ background:"#050505", border:"1px solid #111", borderRadius:"4px", padding:"9px 12px", marginBottom:"10px", maxHeight:"95px", overflowY:"auto" }}>
            {scanLog.map((l, i) => (
              <div key={i} style={{ fontSize:"10px", fontFamily:"monospace", lineHeight:"1.9",
                color: l.startsWith("✅")?"#4caf50": l.startsWith("✓")?"#ff6b00": l.startsWith("🔍")||l.startsWith("📊")?"#69f0ae": l.startsWith("📡")||l.startsWith("📋")?"#60a5fa":"#2a2a2a" }}>{l}</div>
            ))}
            {scanning && <span style={{ fontSize:"10px", color:"#ff6b00", fontFamily:"monospace", animation:"blink 0.8s infinite" }}>█</span>}
          </div>
        )}

        {/* SOURCE TABS + SORT */}
        {results.length > 0 && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
            <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
              {allSrc.map(s => (
                <button key={s} onClick={()=>setActiveSrc(s)}
                  style={{ background:activeSrc===s?"#ff6b00":"none", color:activeSrc===s?"#000":"#2a2a2a", border:`1px solid ${activeSrc===s?"#ff6b00":"#1a1a1a"}`, padding:"4px 10px", fontSize:"9px", letterSpacing:"1px", cursor:"pointer", fontFamily:"inherit", fontWeight:activeSrc===s?"800":"400" }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              <span style={{ fontSize:"9px", color:"#1e1e1e" }}>{filtered.length} RESULTATEN</span>
              <select value={sorting} onChange={e=>setSorting(e.target.value)} style={{ width:"auto", padding:"4px 9px", fontSize:"10px" }}>
                <option value="score">Beste waarde eerst</option>
                <option value="price_asc">Prijs laag–hoog</option>
                <option value="price_desc">Prijs hoog–laag</option>
                <option value="km_asc">Km laag–hoog</option>
              </select>
            </div>
          </div>
        )}

        {/* GRID */}
        {filtered.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(270px, 1fr))", gap:"10px" }}>
            {filtered.map((l, i) => (
              <div key={l.id} style={{ animation:"fadeUp 0.4s ease both", animationDelay:`${i*0.05}s` }}>
                <ListingCard listing={l} onOpen={setSelected} />
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !scanning && (
          <div style={{ textAlign:"center", padding:"70px 20px" }}>
            <div style={{ fontSize:"64px", opacity:0.04 }}>🏍</div>
            <div style={{ fontSize:"16px", letterSpacing:"4px", color:"#1a1a1a", fontWeight:"700", marginTop:"12px" }}>KLAAR OM TE SCANNEN</div>
            <div style={{ fontSize:"9px", color:"#111", marginTop:"6px", letterSpacing:"2px" }}>RDW live · APK historiek · NAP km-validatie · KPI waarde analyse</div>
          </div>
        )}
      </div>

      <div style={{ borderTop:"1px solid #0f0f0f", padding:"10px 20px", marginTop:"20px" }}>
        <div style={{ maxWidth:"1360px", margin:"0 auto", display:"flex", justifyContent:"space-between", fontSize:"8px", color:"#141414", letterSpacing:"1px" }}>
          <span>MOTOR.SHOP · RDW opendata.rdw.nl · APK keuringshistorie sgfe-77wx · NAP km-logica</span>
          <span>Geen API-key vereist · CORS: opendata.rdw.nl ondersteund</span>
        </div>
      </div>

      {selected && <DetailModal listing={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
