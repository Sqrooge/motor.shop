// ══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════════════════════
import { Router }        from "express";
import { db }            from "../utils/database.js";
import { runScrapeAll }  from "../jobs/scrapeAll.js";
import { logger }        from "../utils/logger.js";

const router = Router();
let activeScrapeRun = null; // voorkom dubbele runs

// ── GET /api/listings ─────────────────────────────────────────────────────────
router.get("/listings", (req, res) => {
  try {
    const { brand, type, source, maxPrice, maxKm, query, limit = 100, offset = 0 } = req.query;
    const listings = db.getListings({ brand, type, source, maxPrice, maxKm, query,
      limit: parseInt(limit), offset: parseInt(offset) });

    // Parse JSON velden
    const parsed = listings.map(l => ({
      ...l,
      images:      JSON.parse(l.images      || "[]"),
      rdw_data:    JSON.parse(l.rdw_data    || "{}"),
      apk_history: JSON.parse(l.apk_history || "[]"),
    }));

    res.json({ ok: true, count: parsed.length, listings: parsed });
  } catch (err) {
    logger.error("GET /listings fout", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/listings/:id ─────────────────────────────────────────────────────
router.get("/listings/:id", (req, res) => {
  try {
    const listing = db.getDb().prepare("SELECT * FROM listings WHERE id = ?").get(req.params.id);
    if (!listing) return res.status(404).json({ ok: false, error: "Niet gevonden" });
    res.json({ ok: true, listing: {
      ...listing,
      images:      JSON.parse(listing.images      || "[]"),
      rdw_data:    JSON.parse(listing.rdw_data    || "{}"),
      apk_history: JSON.parse(listing.apk_history || "[]"),
    }});
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/stats ────────────────────────────────────────────────────────────
router.get("/stats", (req, res) => {
  try {
    res.json({ ok: true, ...db.getStats() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/scrape ──────────────────────────────────────────────────────────
// Start een nieuwe scrape-run (handmatig of via frontend)
router.post("/scrape", async (req, res) => {
  if (activeScrapeRun) {
    return res.status(409).json({ ok: false, error: "Scrape al actief", runId: activeScrapeRun });
  }

  const { query = "", platforms = null } = req.body || {};
  const runId = `run-${Date.now()}`;
  activeScrapeRun = runId;

  // Antwoord direct — scrape loopt op de achtergrond
  res.json({ ok: true, runId, message: "Scrape gestart" });

  try {
    const result = await runScrapeAll(query, platforms);
    logger.info("Handmatige scrape klaar", result);
  } catch (err) {
    logger.error("Handmatige scrape mislukt", { error: err.message });
  } finally {
    activeScrapeRun = null;
  }
});

// ── GET /api/scrape/status ────────────────────────────────────────────────────
router.get("/scrape/status", (req, res) => {
  try {
    const lastRun = db.getDb().prepare("SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 5").all();
    res.json({ ok: true, active: !!activeScrapeRun, activeRunId: activeScrapeRun, runs: lastRun });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/platforms ────────────────────────────────────────────────────────
router.get("/platforms", (req, res) => {
  try {
    const statuses = db.getDb().prepare("SELECT * FROM platform_status ORDER BY platform").all();
    res.json({ ok: true, platforms: statuses });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/kenteken/:kenteken ───────────────────────────────────────────────
router.get("/kenteken/:kenteken", async (req, res) => {
  try {
    const k       = req.params.kenteken.replace(/-/g, "").toUpperCase();
    const RDW_BASE = process.env.RDW_BASE || "https://opendata.rdw.nl/resource";

    const [vRes, apkRes] = await Promise.all([
      fetch(`${RDW_BASE}/m9d7-ebf2.json?kenteken=${k}&$limit=1`),
      fetch(`${RDW_BASE}/sgfe-77wx.json?kenteken=${k}&$limit=50`),
    ]);

    const voertuig = vRes.ok ? (await vRes.json())[0] : null;
    const apkRaw   = apkRes.ok ? await apkRes.json() : [];
    const local    = db.getByKenteken(k);

    res.json({
      ok:       true,
      kenteken: k,
      rdw:      voertuig,
      apk:      apkRaw.filter(r => r.kilometerstand).map(r => ({
        datum: r.datum_tenaamstelling,
        km:    parseInt(r.kilometerstand),
      })),
      listing: local || null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
