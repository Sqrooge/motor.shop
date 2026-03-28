// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES — alleen toegankelijk voor admin accounts
// Alles achter requireAdmin middleware
// ══════════════════════════════════════════════════════════════════════════════
import { Router }        from "express";
import { requireAdmin }  from "../utils/auth.js";
import { db, getDb }     from "../utils/database.js";
import { runScrapeAll }  from "../jobs/scrapeAll.js";
import { logger }        from "../utils/logger.js";

const router = Router();
router.use(requireAdmin); // alle routes hieronder zijn admin-only

let activeScrape = null;

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", (req, res) => {
  try {
    const _db    = getDb();
    const stats  = db.getStats();

    const userStats = {
      total:    _db.prepare("SELECT COUNT(*) as n FROM users").get().n,
      byProvider: _db.prepare("SELECT provider, COUNT(*) as n FROM users GROUP BY provider").all(),
      recent:   _db.prepare("SELECT COUNT(*) as n FROM users WHERE last_login > ?")
                   .get(new Date(Date.now() - 7*24*3600*1000).toISOString()).n,
    };

    const alertStats = {
      total:  _db.prepare("SELECT COUNT(*) as n FROM user_alerts WHERE active = 1").get().n,
    };

    const favStats = {
      total:  _db.prepare("SELECT COUNT(*) as n FROM user_favorites").get().n,
    };

    const geocacheStats = {
      total:  _db.prepare("SELECT COUNT(*) as n FROM geocode_cache").get().n,
    };

    res.json({ ok: true, listings: stats, users: userStats, alerts: alertStats,
               favorites: favStats, geocache: geocacheStats,
               scrapeActive: !!activeScrape });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/platforms ──────────────────────────────────────────────────
router.get("/platforms", (req, res) => {
  try {
    const platforms = getDb().prepare("SELECT * FROM platform_status ORDER BY platform").all();
    res.json({ ok: true, platforms });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/runs ───────────────────────────────────────────────────────
router.get("/runs", (req, res) => {
  try {
    const runs = getDb().prepare(
      "SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 20"
    ).all().map(r => ({
      ...r,
      platforms: JSON.parse(r.platforms || "[]"),
      errors:    JSON.parse(r.errors    || "[]"),
    }));
    res.json({ ok: true, runs, active: activeScrape });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/admin/scrape ────────────────────────────────────────────────────
router.post("/scrape", async (req, res) => {
  if (activeScrape) {
    return res.status(409).json({ ok: false, error: "Scrape al actief", runId: activeScrape });
  }
  const { query = "", platforms = null } = req.body || {};
  activeScrape = `admin-${Date.now()}`;
  res.json({ ok: true, runId: activeScrape, message: "Scrape gestart" });

  runScrapeAll(query, platforms)
    .then(r => logger.info("Admin scrape klaar", r))
    .catch(e => logger.error("Admin scrape fout", { error: e.message }))
    .finally(() => { activeScrape = null; });
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get("/users", (req, res) => {
  try {
    const users = getDb().prepare(
      "SELECT id, provider, email, name, created_at, last_login FROM users ORDER BY last_login DESC LIMIT 100"
    ).all();
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/listings ───────────────────────────────────────────────────
router.get("/listings", (req, res) => {
  try {
    const { source, brand, active = "1", limit = 50, offset = 0 } = req.query;
    const _db = getDb();
    const cnd = [], val = [];
    if (active !== "all") { cnd.push("active = ?"); val.push(parseInt(active)); }
    if (source)           { cnd.push("source = ?"); val.push(source); }
    if (brand)            { cnd.push("brand = ?");  val.push(brand); }
    const where = cnd.length ? `WHERE ${cnd.join(" AND ")}` : "";
    val.push(parseInt(limit), parseInt(offset));
    const listings = _db.prepare(
      `SELECT id, brand, model, year, price, km, source, location, nap_status,
              nap_score, active, first_seen, last_seen, kenteken
       FROM listings ${where} ORDER BY last_seen DESC LIMIT ? OFFSET ?`
    ).all(...val);
    const total = _db.prepare(`SELECT COUNT(*) as n FROM listings ${where.replace(/LIMIT.*/, "")}`).get(cnd.length ? val.slice(0, cnd.length) : []).n;
    res.json({ ok: true, listings, total });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/admin/listings/:id ───────────────────────────────────────────
router.delete("/listings/:id", (req, res) => {
  try {
    getDb().prepare("UPDATE listings SET active = 0 WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/alerts/all ─────────────────────────────────────────────────
router.get("/alerts", (req, res) => {
  try {
    const alerts = getDb().prepare(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM user_alerts a JOIN users u ON u.id = a.user_id
       WHERE a.active = 1 ORDER BY a.created_at DESC`
    ).all();
    res.json({ ok: true, alerts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/admin/geocache ───────────────────────────────────────────────────
router.get("/geocache", (req, res) => {
  try {
    const entries = getDb().prepare(
      "SELECT query, lat, lng, display, cached_at FROM geocode_cache ORDER BY cached_at DESC LIMIT 200"
    ).all();
    res.json({ ok: true, entries });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/admin/geocache ────────────────────────────────────────────────
router.delete("/geocache", (req, res) => {
  try {
    const info = getDb().prepare("DELETE FROM geocode_cache").run();
    res.json({ ok: true, deleted: info.changes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
