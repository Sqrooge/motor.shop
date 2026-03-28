// ══════════════════════════════════════════════════════════════════════════════
// DEDUPLICATIE ENGINE
// Strategie (in volgorde van zekerheid):
//   1. Kenteken exact match          → zeker duplicaat
//   2. Hash (brand+model+year+price) → waarschijnlijk duplicaat
//   3. Fuzzy score (Levenshtein)     → mogelijk duplicaat (drempel instelbaar)
// ══════════════════════════════════════════════════════════════════════════════
import levenshtein from "fast-levenshtein";
import crypto      from "crypto";
import { getDb }   from "./database.js";
import { logger }  from "./logger.js";

const DEDUP_THRESHOLD = parseFloat(process.env.DEDUP_THRESHOLD || "0.82");

// ── Kenteken normaliseren ────────────────────────────────────────────────────
export const normKen = k => k ? k.replace(/[-\s]/g, "").toUpperCase() : null;

// ── Hash op basis van kern-attributen ────────────────────────────────────────
// Twee listings met dezelfde hash = zeker hetzelfde voertuig
export function makeHash(listing) {
  const parts = [
    (listing.brand  || "").toLowerCase().trim(),
    (listing.model  || "").toLowerCase().trim(),
    String(listing.year  || ""),
    String(listing.price || ""),
    String(listing.km    || ""),
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

// ── Fuzzy gelijkenis tussen twee strings ─────────────────────────────────────
function similarity(a, b) {
  a = (a || "").toLowerCase().trim();
  b = (b || "").toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b)  return 1;
  const maxLen = Math.max(a.length, b.length);
  const dist   = levenshtein.get(a, b);
  return 1 - dist / maxLen;
}

// ── Bereken overall similarity score tussen twee listings ─────────────────────
export function listingSimilarity(a, b) {
  // Gewogen score: model telt het zwaarst
  const scores = {
    brand: similarity(a.brand, b.brand)              * 0.15,
    model: similarity(a.model, b.model)              * 0.40,
    year:  (a.year === b.year ? 1 : 0)               * 0.15,
    price: 1 - Math.min(1, Math.abs((a.price - b.price) / Math.max(a.price || 1, 1))) * 0.20,
    km:    1 - Math.min(1, Math.abs((a.km    - b.km)    / Math.max(a.km    || 1, 1))) * 0.10,
  };
  return Object.values(scores).reduce((s, v) => s + v, 0);
}

// ── Hoofdfunctie: is deze listing een duplicaat? ──────────────────────────────
// Geeft { isDuplicate, existingId, reason, confidence } terug
export function checkDuplicate(candidate, existingListings) {
  const db = getDb();

  // 1. Kenteken exact match (sterkste signaal)
  if (candidate.kenteken) {
    const byKen = db.prepare(
      "SELECT id, source FROM listings WHERE kenteken = ? AND active = 1"
    ).get(candidate.kenteken);
    if (byKen) {
      return {
        isDuplicate: true,
        existingId:  byKen.id,
        reason:      "kenteken_exact",
        confidence:  1.0,
        sameSource:  byKen.source === candidate.source,
      };
    }
  }

  // 2. Hash match
  const byHash = db.prepare("SELECT id, source FROM listings WHERE hash = ?").get(candidate.hash);
  if (byHash) {
    return {
      isDuplicate: true,
      existingId:  byHash.id,
      reason:      "hash_match",
      confidence:  0.97,
      sameSource:  byHash.source === candidate.source,
    };
  }

  // 3. Fuzzy match — zoek recent vergelijkbare listings
  if (existingListings && existingListings.length > 0) {
    let best = null, bestScore = 0;
    for (const existing of existingListings) {
      const score = listingSimilarity(candidate, existing);
      if (score > bestScore) { bestScore = score; best = existing; }
    }
    if (bestScore >= DEDUP_THRESHOLD && best) {
      return {
        isDuplicate: true,
        existingId:  best.id,
        reason:      "fuzzy_match",
        confidence:  bestScore,
        sameSource:  best.source === candidate.source,
      };
    }
  }

  return { isDuplicate: false };
}

// ── Batch deduplicatie voor een volledige scrape-batch ────────────────────────
export function deduplicateBatch(newListings) {
  const db       = getDb();
  const seen     = new Map(); // hash → index in newListings
  const results  = { unique: [], duplicates: [], crossPlatform: [] };

  // Laad recente actieve listings voor fuzzy vergelijking (laatste 7 dagen)
  const recentCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const recent = db.prepare(
    "SELECT * FROM listings WHERE active = 1 AND last_seen > ?"
  ).all(recentCutoff);

  for (const listing of newListings) {
    // Intra-batch dedup (zelfde hash al gezien in deze batch)
    if (seen.has(listing.hash)) {
      results.duplicates.push({ listing, reason: "intra_batch" });
      continue;
    }
    seen.set(listing.hash, true);

    const dupCheck = checkDuplicate(listing, recent);

    if (dupCheck.isDuplicate) {
      if (!dupCheck.sameSource) {
        // Cross-platform duplicaat — bewaar als referentie maar update prijs
        results.crossPlatform.push({ listing, existingId: dupCheck.existingId, reason: dupCheck.reason });
      } else {
        results.duplicates.push({ listing, reason: dupCheck.reason, confidence: dupCheck.confidence });
      }
    } else {
      results.unique.push(listing);
    }
  }

  logger.info(`Dedup batch: ${newListings.length} in → ${results.unique.length} uniek, ${results.duplicates.length} dup, ${results.crossPlatform.length} cross-platform`);
  return results;
}
