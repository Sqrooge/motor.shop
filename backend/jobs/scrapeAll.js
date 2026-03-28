// ══════════════════════════════════════════════════════════════════════════════
// PARALLEL SCRAPE ORCHESTRATOR — verbeterd
// Fixes: import paths, parallelle RDW enrichment, upsert ipv try/catch
// ══════════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { v4 as uuid }                       from "uuid";
import pLimit                               from "p-limit";
import { getBrowser, closeBrowser }         from "../utils/browser.js";
import { deduplicateBatch }                 from "../utils/dedup.js";
import { analyseKmStand }                   from "../utils/nap.js";      // gedeelde module
import { db }                               from "../utils/database.js";
import { logger }                           from "../utils/logger.js";
import { MarktplaatsScraper }               from "../scrapers/marktplaats.js";  // FIX: was ./
import { TweedehandsScraper }               from "../scrapers/tweedehands.js";
import { AutoScout24Scraper }               from "../scrapers/autoscout24.js";
import { EbayScraper, FacebookScraper,
         MotortrefferScraper }              from "../scrapers/others.js";

const SCRAPERS = [
  new MarktplaatsScraper(),
  new TweedehandsScraper(),
  new AutoScout24Scraper(),
  new EbayScraper(),
  new FacebookScraper(),
  new MotortrefferScraper(),
];

const scraperLimit = pLimit(parseInt(process.env.SCRAPER_CONCURRENCY || "3"));
const rdwLimit     = pLimit(10); // max 10 parallelle RDW requests
const RDW_BASE     = process.env.RDW_BASE || "https://opendata.rdw.nl/resource";

// ── RDW enrichment — parallel ipv sequentieel ────────────────────────────────
async function enrichWithRDW(listings) {
  const withKenteken = listings.filter(l => l.kenteken);
  const without      = listings.filter(l => !l.kenteken);

  logger.info(`RDW enrichment: ${withKenteken.length} kentekens ophalen...`);

  const enriched = await Promise.all(
    withKenteken.map(listing =>
      rdwLimit(async () => {
        try {
          const [vRes, apkRes] = await Promise.all([
            fetch(`${RDW_BASE}/m9d7-ebf2.json?kenteken=${listing.kenteken}&$limit=1`, { signal: AbortSignal.timeout(8000) }),
            fetch(`${RDW_BASE}/sgfe-77wx.json?kenteken=${listing.kenteken}&$limit=50`, { signal: AbortSignal.timeout(8000) }),
          ]);

          const voertuig = vRes.ok  ? (await vRes.json())[0]  : null;
          const apkRaw   = apkRes.ok ? await apkRes.json()     : [];

          if (voertuig?.catalogusprijs) {
            listing.catalogus = parseInt(voertuig.catalogusprijs);
          }

          const apkHistory = apkRaw
            .filter(r => r.kilometerstand)
            .map(r => ({ datum: r.datum_tenaamstelling || "", km: parseInt(r.kilometerstand) || 0 }))
            .filter(r => r.km > 0)
            .sort((a, b) => new Date(a.datum) - new Date(b.datum));

          listing.rdw_data    = JSON.stringify(voertuig || {});
          listing.apk_history = JSON.stringify(apkHistory);

          const nap           = analyseKmStand(apkHistory, listing.km, listing.year);
          listing.nap_status  = nap.status;
          listing.nap_score   = nap.score;

        } catch (err) {
          logger.debug(`RDW fout ${listing.kenteken}: ${err.message}`);
        }
        return listing;
      })
    )
  );

  return [...enriched, ...without];
}

// ── Hoofd orchestrator ────────────────────────────────────────────────────────
export async function runScrapeAll(searchQuery = "", platforms = null) {
  const runId      = uuid();
  const runStart   = new Date().toISOString();
  const selected   = platforms
    ? SCRAPERS.filter(s => platforms.includes(s.name))
    : SCRAPERS;

  logger.info(`Run ${runId} gestart`, { platforms: selected.map(s => s.name) });
  db.startRun(runId, selected.map(s => s.name));

  const stats = { found: 0, new: 0, updated: 0, duplicates: 0, errors: [] };
  let browser;

  try {
    browser = await getBrowser();

    // ── Stap 1: Parallel scrapen ─────────────────────────────────────────────
    const settled = await Promise.allSettled(
      selected.map(scraper =>
        scraperLimit(async () => {
          const t = Date.now();
          try {
            const result = await scraper.scrape(browser, searchQuery);
            db.updatePlatformStatus(scraper.name, {
              last_count: result.results.length, success: true,
              avg_ms: result.ms, fail_streak: 0,
            });
            return { platform: scraper.name, results: result.results, errors: result.errors };
          } catch (err) {
            const streak = (scraper.failStreaks?.get(scraper.name) || 0) + 1;
            db.updatePlatformStatus(scraper.name, {
              last_count: 0, success: false,
              error_msg: err.message, avg_ms: Date.now() - t, fail_streak: streak,
            });
            stats.errors.push({ platform: scraper.name, error: err.message });
            return { platform: scraper.name, results: [], errors: [err.message] };
          }
        })
      )
    );

    // ── Stap 2: Samenvoegen ──────────────────────────────────────────────────
    const allRaw = settled
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value.results);
    stats.found = allRaw.length;
    logger.info(`Gescraped: ${allRaw.length} listings van ${selected.length} platforms`);

    // ── Stap 3: RDW enrichment (parallel) ────────────────────────────────────
    const enriched = await enrichWithRDW(allRaw);

    // ── Stap 4: Deduplicatie ─────────────────────────────────────────────────
    const { unique, duplicates, crossPlatform } = deduplicateBatch(enriched);
    stats.duplicates = duplicates.length + crossPlatform.length;

    // ── Stap 5: Upsert in database (geen try/catch per row meer) ──────────────
    const now = new Date().toISOString();
    for (const listing of unique) {
      listing.last_seen    = now;
      listing.last_updated = now;
      const { isNew } = db.upsert(listing);
      isNew ? stats.new++ : stats.updated++;
    }

    // Cross-platform: update last_seen op bestaande listing
    for (const { existingId } of crossPlatform) {
      db.update(existingId, { last_seen: now, last_updated: now });
    }

    // Markeer listings die deze run niet meer gezien zijn als inactief
    for (const scraper of selected) {
      db.markStaleInactive(scraper.name, runStart);
    }

  } catch (err) {
    logger.error(`Run ${runId} fatale fout: ${err.message}`);
    stats.errors.push({ platform: "orchestrator", error: err.message });
    db.finishRun(runId, stats, "error");
    throw err;
  } finally {
    await closeBrowser().catch(() => {});
  }

  db.finishRun(runId, stats, "done");
  logger.info(`Run ${runId} klaar`, stats);
  return { runId, ...stats };
}

// CLI
if (process.argv[1]?.includes("scrapeAll")) {
  runScrapeAll(process.argv[2] || "")
    .then(r => { logger.info("Klaar", r); process.exit(0); })
    .catch(e => { logger.error(e.message); process.exit(1); });
}
