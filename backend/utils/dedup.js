// ══════════════════════════════════════════════════════════════════════════════
// DEDUPLICATIE ENGINE — verbeterd
// Fix: prijs-score formule, gecachte DB lookups, intra-batch kenteken check
// ══════════════════════════════════════════════════════════════════════════════
import levenshtein from "fast-levenshtein";
import crypto      from "crypto";
import { db }      from "./database.js";
import { logger }  from "./logger.js";

const DEDUP_THRESHOLD = parseFloat(process.env.DEDUP_THRESHOLD || "0.82");

export const normKen = k => k ? k.replace(/[-\s]/g, "").toUpperCase() : null;

export function makeHash(listing) {
  const parts = [
    (listing.brand || "").toLowerCase().trim(),
    (listing.model || "").toLowerCase().trim(),
    String(listing.year  || ""),
    String(listing.price || ""),
    String(listing.km    || ""),
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function similarity(a, b) {
  a = (a || "").toLowerCase().trim();
  b = (b || "").toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b)  return 1;
  return 1 - levenshtein.get(a, b) / Math.max(a.length, b.length);
}

// ── Verbeterde similarity: prijs-score was wiskundig onjuist ─────────────────
// Oud: `1 - Math.abs(diff/max) * 0.20` → altijd ≥0.80 ook bij 100% prijsverschil
// Nieuw: prijsverschil als gewogen factor (0 = zelfde, 1 = 2× verschil)
export function listingSimilarity(a, b) {
  const brandScore = similarity(a.brand, b.brand);
  const modelScore = similarity(a.model, b.model);
  const yearScore  = a.year === b.year ? 1 : (Math.abs((a.year||0) - (b.year||0)) <= 1 ? 0.5 : 0);

  // Prijs: 0% verschil = 1.0, 20% verschil = 0.0 (motor met 20% prijsverschil is ander geval)
  const priceDiff  = a.price && b.price
    ? Math.abs(a.price - b.price) / Math.max(a.price, b.price)
    : 0.5;
  const priceScore = Math.max(0, 1 - priceDiff * 5); // ±20% = score 0

  // Km: ruimer, want km kan snel stijgen tussen platforms
  const kmDiff     = a.km && b.km
    ? Math.abs(a.km - b.km) / Math.max(a.km, b.km)
    : 0.5;
  const kmScore    = Math.max(0, 1 - kmDiff * 2); // ±50% = score 0

  return (
    brandScore * 0.15 +
    modelScore * 0.40 +
    yearScore  * 0.20 +
    priceScore * 0.15 +
    kmScore    * 0.10
  );
}

export function deduplicateBatch(newListings) {
  const results = { unique: [], duplicates: [], crossPlatform: [] };

  // Laad recente listings eenmalig — 14 dagen window
  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const recent = db.getRecentForDedup(cutoff);

  // Intra-batch lookup maps — voorkomt O(n²) DB-calls
  const batchHashes    = new Map(); // hash → listing
  const batchKentekens = new Map(); // kenteken → listing

  for (const listing of newListings) {
    // ── Intra-batch dedup ───────────────────────────────────────────────────
    if (batchHashes.has(listing.hash)) {
      results.duplicates.push({ listing, reason: "intra_batch_hash" });
      continue;
    }
    if (listing.kenteken && batchKentekens.has(listing.kenteken)) {
      const first = batchKentekens.get(listing.kenteken);
      // Bewaar de goedkoopste cross-platform
      if (listing.source !== first.source) {
        results.crossPlatform.push({ listing, existingId: first.id, reason: "intra_batch_kenteken" });
      } else {
        results.duplicates.push({ listing, reason: "intra_batch_kenteken" });
      }
      continue;
    }

    batchHashes.set(listing.hash, listing);
    if (listing.kenteken) batchKentekens.set(listing.kenteken, listing);

    // ── DB: kenteken exact match ─────────────────────────────────────────────
    if (listing.kenteken) {
      const byKen = db.kentekenLookup(listing.kenteken);
      if (byKen) {
        const result = { listing, existingId: byKen.id, reason: "kenteken_exact", confidence: 1.0 };
        byKen.source !== listing.source
          ? results.crossPlatform.push(result)
          : results.duplicates.push(result);
        continue;
      }
    }

    // ── DB: hash match ───────────────────────────────────────────────────────
    const byHash = db.hashLookup(listing.hash);
    if (byHash) {
      const result = { listing, existingId: byHash.id, reason: "hash_match", confidence: 0.97 };
      byHash.source !== listing.source
        ? results.crossPlatform.push(result)
        : results.duplicates.push(result);
      continue;
    }

    // ── Fuzzy match over recente listings ────────────────────────────────────
    let best = null, bestScore = 0;
    for (const existing of recent) {
      // Sla over als merk totaal anders — snelle pre-filter
      if (existing.brand?.toLowerCase() !== listing.brand?.toLowerCase()) continue;
      const score = listingSimilarity(listing, existing);
      if (score > bestScore) { bestScore = score; best = existing; }
    }

    if (bestScore >= DEDUP_THRESHOLD && best) {
      const result = { listing, existingId: best.id, reason: "fuzzy_match", confidence: bestScore };
      best.source !== listing.source
        ? results.crossPlatform.push(result)
        : results.duplicates.push(result);
      continue;
    }

    results.unique.push(listing);
  }

  logger.info(
    `Dedup: ${newListings.length} in → ${results.unique.length} uniek · ` +
    `${results.duplicates.length} dup · ${results.crossPlatform.length} cross-platform`
  );
  return results;
}
