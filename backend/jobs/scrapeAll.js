// ══════════════════════════════════════════════════════════════════════════════
// PARALLEL SCRAPE ORCHESTRATOR
// Draait alle platforms gelijktijdig, verzamelt resultaten,
// dedupliceert en slaat op in de database
// ══════════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { v4 as uuid }            from "uuid";
import pLimit                    from "p-limit";
import { getBrowser, closeBrowser } from "../utils/browser.js";
import { deduplicateBatch }      from "../utils/dedup.js";
import { db }                    from "../utils/database.js";
import { logger }                from "../utils/logger.js";
import { MarktplaatsScraper }    from "./marktplaats.js";
import { TweedehandsScraper }    from "./tweedehands.js";
import { AutoScout24Scraper }    from "./autoscout24.js";
import { EbayScraper, FacebookScraper, MotortrefferScraper } from "./others.js";

// Alle platforms
const SCRAPERS = [
  new MarktplaatsScraper(),
  new TweedehandsScraper(),
  new AutoScout24Scraper(),
  new EbayScraper(),
  new FacebookScraper(),
  new MotortrefferScraper(),
];

// Max 3 browsers tegelijk (resource-management)
const limit = pLimit(parseInt(process.env.SCRAPER_CONCURRENCY || "3"));

// ── RDW enrichment ────────────────────────────────────────────────────────────
async function enrichWithRDW(listings) {
  const RDW_BASE = process.env.RDW_BASE || "https://opendata.rdw.nl/resource";
  const enriched = [];

  for (const listing of listings) {
    if (!listing.kenteken) { enriched.push(listing); continue; }

    try {
      const [vRes, apkRes] = await Promise.all([
        fetch(`${RDW_BASE}/m9d7-ebf2.json?kenteken=${listing.kenteken}&$limit=1`),
        fetch(`${RDW_BASE}/sgfe-77wx.json?kenteken=${listing.kenteken}&$limit=50`),
      ]);

      const voertuig = vRes.ok ? (await vRes.json())[0] : null;
      const apkRaw   = apkRes.ok ? await apkRes.json() : [];

      // Catalogusprijs van RDW
      if (voertuig?.catalogusprijs) {
        listing.catalogus = parseInt(voertuig.catalogusprijs);
      }

      // APK historiek
      const apkHistory = apkRaw
        .filter(r => r.kilometerstand)
        .map(r => ({ datum: r.datum_tenaamstelling || "", km: parseInt(r.kilometerstand) || 0 }))
        .filter(r => r.km > 0)
        .sort((a, b) => new Date(a.datum) - new Date(b.datum));

      listing.rdw_data    = JSON.stringify(voertuig || {});
      listing.apk_history = JSON.stringify(apkHistory);

      // NAP analyse
      const nap = analyseKmStand(apkHistory, listing.km, listing.year);
      listing.nap_status = nap.status;
      listing.nap_score  = nap.score;

    } catch (err) {
      logger.debug(`RDW enrichment fout voor ${listing.kenteken}: ${err.message}`);
    }

    enriched.push(listing);
  }

  return enriched;
}

// ── NAP analyse (zelfde logica als frontend) ──────────────────────────────────
function analyseKmStand(apk, huidigKm, bouwjaar) {
  if (!apk?.length) return { status: "ONBEKEND", score: 50 };

  const sorted = [...apk].sort((a, b) => new Date(a.datum) - new Date(b.datum));
  let verdacht = false, score = 100;

  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].km - sorted[i-1].km;
    if (diff < 0) { verdacht = true; score -= 60; }
  }

  const laatste = sorted[sorted.length - 1];
  if (laatste && huidigKm < laatste.km) { verdacht = true; score -= 40; }

  score = Math.max(0, Math.min(100, score));
  const status = score >= 80 ? "LOGISCH" : score >= 50 ? "VERDACHT" : "ONBETROUWBAAR";
  return { status, score };
}

// ── Hoofd-orchestrator ────────────────────────────────────────────────────────
export async function runScrapeAll(searchQuery = "", platforms = null) {
  const runId    = uuid();
  const selected = platforms
    ? SCRAPERS.filter(s => platforms.includes(s.name))
    : SCRAPERS;

  logger.info(`Scrape run ${runId} gestart`, { platforms: selected.map(s => s.name), query: searchQuery });
  db.startRun(runId, selected.map(s => s.name));

  let browser;
  const stats = { found: 0, new: 0, updated: 0, duplicates: 0, errors: [] };

  try {
    browser = await getBrowser();

    // ── STAP 1: Parallel scrapen ─────────────────────────────────────────────
    const platformResults = await Promise.allSettled(
      selected.map(scraper =>
        limit(async () => {
          const start = Date.now();
          try {
            const result = await scraper.scrape(browser, searchQuery);
            db.updatePlatformStatus(scraper.name, {
              platform:   scraper.name,
              last_scan:  new Date().toISOString(),
              last_count: result.results.length,
              success:    1,
              error_msg:  null,
              avg_ms:     result.ms,
            });
            return { platform: scraper.name, ...result };
          } catch (err) {
            logger.error(`Platform ${scraper.name} mislukt: ${err.message}`);
            db.updatePlatformStatus(scraper.name, {
              platform:   scraper.name,
              last_scan:  new Date().toISOString(),
              last_count: 0,
              success:    0,
              error_msg:  err.message,
              avg_ms:     Date.now() - start,
            });
            stats.errors.push({ platform: scraper.name, error: err.message });
            return { platform: scraper.name, results: [], errors: [err.message] };
          }
        })
      )
    );

    // ── STAP 2: Samenvoegen ──────────────────────────────────────────────────
    const allRaw = [];
    for (const r of platformResults) {
      if (r.status === "fulfilled") allRaw.push(...r.value.results);
    }
    stats.found = allRaw.length;
    logger.info(`Totaal gescraped: ${allRaw.length} listings`);

    // ── STAP 3: RDW enrichment (voor listings met kenteken) ───────────────────
    logger.info("RDW enrichment starten...");
    const enriched = await enrichWithRDW(allRaw);

    // ── STAP 4: Deduplicatie ─────────────────────────────────────────────────
    logger.info("Deduplicatie starten...");
    const { unique, duplicates, crossPlatform } = deduplicateBatch(enriched);
    stats.duplicates = duplicates.length;
    logger.info(`Dedup: ${unique.length} uniek, ${duplicates.length} dup, ${crossPlatform.length} cross-platform`);

    // ── STAP 5: Opslaan in database ───────────────────────────────────────────
    const now = new Date().toISOString();
    for (const listing of unique) {
      try {
        db.insert(listing);
        stats.new++;
      } catch (err) {
        // Bestaat al (UNIQUE constraint) → update last_seen + prijs
        if (err.message.includes("UNIQUE")) {
          try {
            const existing = db.getByHash(listing.hash);
            if (existing) {
              db.update(existing.id, {
                price:       listing.price,
                km:          listing.km,
                last_seen:   now,
                last_updated:now,
                active:      1,
              });
              stats.updated++;
            }
          } catch {}
        }
      }
    }

    // Cross-platform: update prijs als goedkoper gevonden
    for (const { listing, existingId } of crossPlatform) {
      try {
        db.update(existingId, {
          last_seen:    now,
          last_updated: now,
          // Voeg source toe aan een multi-source veld (optioneel)
        });
        stats.duplicates++;
      } catch {}
    }

  } finally {
    await closeBrowser().catch(() => {});
  }

  db.finishRun(runId, stats);
  logger.info(`Scrape run ${runId} klaar`, stats);
  return { runId, ...stats };
}

// ── CLI: node jobs/scrapeAll.js ───────────────────────────────────────────────
if (process.argv[1].includes("scrapeAll")) {
  runScrapeAll(process.argv[2] || "")
    .then(r => { logger.info("Klaar", r); process.exit(0); })
    .catch(e => { logger.error(e); process.exit(1); });
}
