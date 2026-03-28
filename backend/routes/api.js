// ══════════════════════════════════════════════════════════════════════════════
// API ROUTES — met input validatie + prijshistoriek endpoint
// ══════════════════════════════════════════════════════════════════════════════
import { Router }        from "express";
import { db }            from "../utils/database.js";
import { runScrapeAll }  from "../jobs/scrapeAll.js";
import { logger }        from "../utils/logger.js";

const router = Router();
let activeScrapeRun = null;

// ── Validatie helpers ─────────────────────────────────────────────────────────
const clamp = (val, min, max) => Math.min(max, Math.max(min, parseInt(val) || min));
const sanitize = (s, maxLen = 100) => String(s || "").trim().slice(0, maxLen).replace(/[<>"']/g, "");

// ── GET /api/listings ─────────────────────────────────────────────────────────
router.get("/listings", (req, res) => {
  try {
    const { brand, type, source, maxPrice, maxKm, query } = req.query;
    const limit  = clamp(req.query.limit,  1, 200);
    const offset = clamp(req.query.offset, 0, 10000);

    const listings = db.getListings({
      brand:    brand  ? sanitize(brand)  : undefined,
      type:     type   ? sanitize(type)   : undefined,
      source:   source ? sanitize(source) : undefined,
      maxPrice: maxPrice ? clamp(maxPrice, 0, 999999)  : undefined,
      maxKm:    maxKm   ? clamp(maxKm,    0, 9999999)  : undefined,
      query:    query   ? sanitize(query, 50)           : undefined,
      limit,
      offset,
    });

    const parsed = listings.map(l => ({
      ...l,
      images:      safeParseJson(l.images, []),
      rdw_data:    safeParseJson(l.rdw_data, {}),
      apk_history: safeParseJson(l.apk_history, []),
    }));

    res.json({ ok: true, count: parsed.length, listings: parsed });
  } catch (err) {
    logger.error("GET /listings", { error: err.message });
    res.status(500).json({ ok: false, error: "Serverfout" });
  }
});

// ── GET /api/listings/:id ─────────────────────────────────────────────────────
router.get("/listings/:id", (req, res) => {
  try {
    const listing = db.getById(sanitize(req.params.id, 36));
    if (!listing) return res.status(404).json({ ok: false, error: "Niet gevonden" });

    const history = db.getPriceHistory(listing.id);
    res.json({ ok: true, listing: {
      ...listing,
      images:        safeParseJson(listing.images, []),
      rdw_data:      safeParseJson(listing.rdw_data, {}),
      apk_history:   safeParseJson(listing.apk_history, []),
      price_history: history,
    }});
  } catch (err) {
    res.status(500).json({ ok: false, error: "Serverfout" });
  }
});

// ── GET /api/listings/:id/price-history ──────────────────────────────────────
router.get("/listings/:id/price-history", (req, res) => {
  try {
    const history = db.getPriceHistory(sanitize(req.params.id, 36));
    res.json({ ok: true, history });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Serverfout" });
  }
});

// ── GET /api/stats ────────────────────────────────────────────────────────────
router.get("/stats", (req, res) => {
  try { res.json({ ok: true, ...db.getStats() }); }
  catch (err) { res.status(500).json({ ok: false, error: "Serverfout" }); }
});

// ── POST /api/scrape ──────────────────────────────────────────────────────────
router.post("/scrape", async (req, res) => {
  if (activeScrapeRun) {
    return res.status(409).json({ ok: false, error: "Scrape al actief", runId: activeScrapeRun });
  }

  const query     = sanitize(req.body?.query || "", 100);
  const platforms = Array.isArray(req.body?.platforms) ? req.body.platforms.map(p => sanitize(p, 50)) : null;
  activeScrapeRun = `manual-${Date.now()}`;

  res.json({ ok: true, runId: activeScrapeRun, message: "Scrape gestart" });

  runScrapeAll(query, platforms)
    .then(r => logger.info("Handmatige scrape klaar", r))
    .catch(e => logger.error("Handmatige scrape fout", { error: e.message }))
    .finally(() => { activeScrapeRun = null; });
});

// ── GET /api/scrape/status ────────────────────────────────────────────────────
router.get("/scrape/status", (req, res) => {
  try {
    const runs = db.getDb().prepare(
      "SELECT id, started_at, finished_at, status, found, new_items, updated, duplicates FROM scrape_runs ORDER BY started_at DESC LIMIT 10"
    ).all();
    res.json({ ok: true, active: !!activeScrapeRun, activeRunId: activeScrapeRun, runs });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Serverfout" });
  }
});

// ── GET /api/platforms ────────────────────────────────────────────────────────
router.get("/platforms", (req, res) => {
  try {
    res.json({ ok: true, platforms: db.getDb().prepare("SELECT * FROM platform_status").all() });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Serverfout" });
  }
});

// ── GET /api/kenteken/:kenteken ───────────────────────────────────────────────
router.get("/kenteken/:kenteken", async (req, res) => {
  const k = sanitize(req.params.kenteken, 10).replace(/[-\s]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(k)) {
    return res.status(400).json({ ok: false, error: "Ongeldig kenteken formaat" });
  }

  try {
    const RDW_BASE = process.env.RDW_BASE || "https://opendata.rdw.nl/resource";
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);

    const [vRes, apkRes] = await Promise.all([
      fetch(`${RDW_BASE}/m9d7-ebf2.json?kenteken=${k}&$limit=1`, { signal: controller.signal }),
      fetch(`${RDW_BASE}/sgfe-77wx.json?kenteken=${k}&$limit=50`, { signal: controller.signal }),
    ]).finally(() => clearTimeout(timeout));

    const voertuig = vRes.ok  ? (await vRes.json())[0]  : null;
    const apkRaw   = apkRes.ok ? await apkRes.json()     : [];
    const local    = db.kentekenLookup(k);

    res.json({
      ok: true, kenteken: k, rdw: voertuig,
      apk: apkRaw
        .filter(r => r.kilometerstand)
        .map(r => ({ datum: r.datum_tenaamstelling, km: parseInt(r.kilometerstand) })),
      listing: local ? db.getById(local.id) : null,
    });
  } catch (err) {
    res.status(err.name === "AbortError" ? 504 : 500)
       .json({ ok: false, error: err.name === "AbortError" ? "RDW timeout" : "Serverfout" });
  }
});

function safeParseJson(val, fallback) {
  try { return val ? JSON.parse(val) : fallback; }
  catch { return fallback; }
}

export default router;
