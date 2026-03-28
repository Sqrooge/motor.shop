// ══════════════════════════════════════════════════════════════════════════════
// NAP ANALYSE — gedeeld tussen backend (scrapeAll) en frontend (App.jsx)
// In productie: frontend importeert via /api/kenteken/:k endpoint
// ══════════════════════════════════════════════════════════════════════════════

const AVG_KM_PER_JAAR = 6000;
const MAX_KM_PER_MAAND = 1800; // ~21.600/jaar = absurd hoog

/**
 * Analyseer APK-keuringshistorie op km-stand logica.
 * @param {Array}  apk       - [{datum, km}] gesorteerd op datum
 * @param {number} huidigKm  - km-stand in de advertentie
 * @param {number} bouwjaar
 * @returns {{ status, score, flags, verdacht, verwachtKm }}
 */
export function analyseKmStand(apk, huidigKm, bouwjaar) {
  if (!apk?.length) {
    return { status: "ONBEKEND", score: 50, kleur: "#64748b", label: "Geen APK-data", flags: [], verdacht: false };
  }

  const sorted  = [...apk]
    .map(r => ({ ...r, km: parseInt(r.km) || 0 }))
    .filter(r => r.km > 0)
    .sort((a, b) => new Date(a.datum) - new Date(b.datum));

  if (!sorted.length) return { status: "ONBEKEND", score: 50, kleur: "#64748b", label: "Geen APK-data", flags: [], verdacht: false };

  const flags   = [];
  let score     = 100;
  let verdacht  = false;

  // ── Check 1: Km-terugloop tussen keuringen ────────────────────────────────
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], curr = sorted[i];
    const diff = curr.km - prev.km;

    if (diff < 0) {
      verdacht = true;
      score   -= 60;
      flags.push({
        type:    "TERUGLOOP",
        level:   "error",
        msg:     `Km-terugloop: ${prev.km.toLocaleString("nl-NL")} → ${curr.km.toLocaleString("nl-NL")} km (${curr.datum?.slice(0,10) || "?"})`
      });
      continue;
    }

    // ── Check 2: Abnormaal hoog gebruik per jaar ────────────────────────────
    const maanden = Math.max(1,
      (new Date(curr.datum) - new Date(prev.datum)) / (1000 * 60 * 60 * 24 * 30.5)
    );
    const kmPerMaand = diff / maanden;
    if (kmPerMaand > MAX_KM_PER_MAAND) {
      score -= 20;
      flags.push({
        type:  "HOOG_GEBRUIK",
        level: "warning",
        msg:   `Hoog gebruik: ~${Math.round(kmPerMaand * 12).toLocaleString("nl-NL")} km/jaar tussen ${prev.datum?.slice(0,10)} en ${curr.datum?.slice(0,10)}`
      });
    }
  }

  // ── Check 3: Huidig km vs laatste APK ────────────────────────────────────
  const laatste = sorted[sorted.length - 1];
  if (huidigKm < laatste.km) {
    verdacht = true;
    score   -= 50;
    flags.push({
      type:  "HUIDIGE_LAGER",
      level: "error",
      msg:   `Advertentie-km (${huidigKm.toLocaleString("nl-NL")}) ligt onder laatste APK-km (${laatste.km.toLocaleString("nl-NL")})`
    });
  } else {
    // Check 4: Grote sprong na laatste APK
    const maandenSinds = Math.max(1,
      (Date.now() - new Date(laatste.datum)) / (1000 * 60 * 60 * 24 * 30.5)
    );
    const verwacht     = maandenSinds * (AVG_KM_PER_JAAR / 12);
    const werkelijk    = huidigKm - laatste.km;
    if (werkelijk > verwacht * 3 && werkelijk > 5000) {
      score -= 15;
      flags.push({
        type:  "SPRONG_NA_APK",
        level: "warning",
        msg:   `Grote km-stijging na laatste APK: +${werkelijk.toLocaleString("nl-NL")} km (verwacht ~${Math.round(verwacht).toLocaleString("nl-NL")} km)`
      });
    }
  }

  // ── Eindscore en label ────────────────────────────────────────────────────
  score              = Math.max(0, Math.min(100, score));
  const leeftijd     = 2026 - parseInt(bouwjaar || 2020);
  const verwachtKm   = leeftijd * AVG_KM_PER_JAAR;

  const status = score >= 80 ? "LOGISCH" : score >= 50 ? "VERDACHT" : "ONBETROUWBAAR";
  const kleur  = score >= 80 ? "#69f0ae" : score >= 50 ? "#ffa726"  : "#f44336";
  const icons  = { LOGISCH: "✅", VERDACHT: "⚠️", ONBETROUWBAAR: "❌" };

  return { status, score, kleur, label: `${icons[status]} ${status}`, flags, verdacht, verwachtKm, laatste };
}
