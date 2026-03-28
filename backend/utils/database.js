// ══════════════════════════════════════════════════════════════════════════════
// DATABASE — SQLite via better-sqlite3
// Verbeteringen: gecachte prepared statements, upsert, prijshistoriek
// ══════════════════════════════════════════════════════════════════════════════
import Database from "better-sqlite3";
import path     from "path";
import fs       from "fs";
import { logger } from "./logger.js";

const DB_PATH = process.env.DB_PATH || "./data/motorshop.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db;
export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    _db.pragma("cache_size = -8000");   // 8MB page cache
    _db.pragma("synchronous = NORMAL"); // veilig + snel (WAL mode)
    init(_db);
    cacheStatements(_db);
    logger.info(`Database geopend: ${DB_PATH}`);
  }
  return _db;
}

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id              TEXT PRIMARY KEY,
      hash            TEXT UNIQUE NOT NULL,
      kenteken        TEXT,
      brand           TEXT NOT NULL,
      model           TEXT NOT NULL,
      model_key       TEXT,
      year            INTEGER,
      price           INTEGER,
      km              INTEGER,
      type            TEXT,
      location        TEXT,
      source          TEXT NOT NULL,
      source_url      TEXT,
      source_id       TEXT,
      description     TEXT,
      images          TEXT,
      seller_name     TEXT,
      seller_type     TEXT,
      catalogus       INTEGER,
      fair_value      INTEGER,
      score_label     TEXT,
      score_color     TEXT,
      nap_status      TEXT DEFAULT 'ONBEKEND',
      nap_score       INTEGER,
      rdw_data        TEXT,
      apk_history     TEXT,
      first_seen      TEXT NOT NULL,
      last_seen       TEXT NOT NULL,
      last_updated    TEXT NOT NULL,
      active          INTEGER DEFAULT 1
    );

    -- Prijshistoriek: elke prijswijziging wordt opgeslagen
    CREATE TABLE IF NOT EXISTS price_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id  TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      price       INTEGER NOT NULL,
      km          INTEGER,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scrape_runs (
      id          TEXT PRIMARY KEY,
      started_at  TEXT NOT NULL,
      finished_at TEXT,
      status      TEXT DEFAULT 'running',
      platforms   TEXT,
      found       INTEGER DEFAULT 0,
      new_items   INTEGER DEFAULT 0,
      updated     INTEGER DEFAULT 0,
      duplicates  INTEGER DEFAULT 0,
      errors      TEXT
    );

    CREATE TABLE IF NOT EXISTS platform_status (
      platform       TEXT PRIMARY KEY,
      last_scan      TEXT,
      last_count     INTEGER DEFAULT 0,
      success        INTEGER DEFAULT 1,
      fail_streak    INTEGER DEFAULT 0,
      error_msg      TEXT,
      avg_ms         INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_listings_kenteken  ON listings(kenteken);
    CREATE INDEX IF NOT EXISTS idx_listings_brand     ON listings(brand);
    CREATE INDEX IF NOT EXISTS idx_listings_source    ON listings(source);
    CREATE INDEX IF NOT EXISTS idx_listings_active    ON listings(active);
    CREATE INDEX IF NOT EXISTS idx_listings_price     ON listings(price);
    CREATE INDEX IF NOT EXISTS idx_listings_hash      ON listings(hash);
    CREATE INDEX IF NOT EXISTS idx_listings_last_seen ON listings(last_seen);
    CREATE INDEX IF NOT EXISTS idx_price_history_lid  ON price_history(listing_id);
  `);
}

// ── Gecachte prepared statements ─────────────────────────────────────────────
// Eenmalig voorbereid — sneller dan elke keer opnieuw prepare()
const stmts = {};
function cacheStatements(db) {
  stmts.getListings = (cnd, paramCount) =>
    db.prepare(`SELECT * FROM listings WHERE ${cnd} ORDER BY last_seen DESC LIMIT ? OFFSET ?`);

  stmts.getByKenteken = db.prepare(
    "SELECT * FROM listings WHERE kenteken = ? AND active = 1 LIMIT 1"
  );
  stmts.getByHash = db.prepare(
    "SELECT id, source, price FROM listings WHERE hash = ? LIMIT 1"
  );
  stmts.getById = db.prepare(
    "SELECT * FROM listings WHERE id = ? LIMIT 1"
  );
  stmts.insert = db.prepare(`
    INSERT INTO listings (
      id, hash, kenteken, brand, model, model_key, year, price, km,
      type, location, source, source_url, source_id, description,
      images, seller_name, seller_type, catalogus, fair_value,
      score_label, score_color, nap_status, nap_score,
      rdw_data, apk_history, first_seen, last_seen, last_updated, active
    ) VALUES (
      @id, @hash, @kenteken, @brand, @model, @model_key, @year, @price, @km,
      @type, @location, @source, @source_url, @source_id, @description,
      @images, @seller_name, @seller_type, @catalogus, @fair_value,
      @score_label, @score_color, @nap_status, @nap_score,
      @rdw_data, @apk_history, @first_seen, @last_seen, @last_updated, @active
    )
  `);
  stmts.upsert = db.prepare(`
    INSERT INTO listings (
      id, hash, kenteken, brand, model, model_key, year, price, km,
      type, location, source, source_url, source_id, description,
      images, seller_name, seller_type, catalogus, fair_value,
      score_label, score_color, nap_status, nap_score,
      rdw_data, apk_history, first_seen, last_seen, last_updated, active
    ) VALUES (
      @id, @hash, @kenteken, @brand, @model, @model_key, @year, @price, @km,
      @type, @location, @source, @source_url, @source_id, @description,
      @images, @seller_name, @seller_type, @catalogus, @fair_value,
      @score_label, @score_color, @nap_status, @nap_score,
      @rdw_data, @apk_history, @first_seen, @last_seen, @last_updated, @active
    )
    ON CONFLICT(hash) DO UPDATE SET
      price        = excluded.price,
      km           = excluded.km,
      nap_status   = excluded.nap_status,
      nap_score    = excluded.nap_score,
      rdw_data     = COALESCE(excluded.rdw_data,    rdw_data),
      apk_history  = COALESCE(excluded.apk_history, apk_history),
      catalogus    = COALESCE(excluded.catalogus,   catalogus),
      last_seen    = excluded.last_seen,
      last_updated = excluded.last_updated,
      active       = 1
  `);
  stmts.updateFields = (keys) =>
    db.prepare(`UPDATE listings SET ${keys.map(k => `${k} = @${k}`).join(", ")} WHERE id = @id`);
  stmts.markInactive = db.prepare(
    "UPDATE listings SET active = 0 WHERE source = ? AND last_seen < ? AND active = 1"
  );
  stmts.insertPriceHistory = db.prepare(
    "INSERT INTO price_history (listing_id, price, km, recorded_at) VALUES (?, ?, ?, ?)"
  );
  stmts.startRun = db.prepare(
    "INSERT INTO scrape_runs (id, started_at, status, platforms) VALUES (?, ?, 'running', ?)"
  );
  stmts.finishRun = db.prepare(
    `UPDATE scrape_runs SET finished_at=?, status=?, found=?, new_items=?, updated=?, duplicates=?, errors=? WHERE id=?`
  );
  stmts.platformUpsert = db.prepare(`
    INSERT INTO platform_status (platform, last_scan, last_count, success, fail_streak, error_msg, avg_ms)
    VALUES (@platform, @last_scan, @last_count, @success, @fail_streak, @error_msg, @avg_ms)
    ON CONFLICT(platform) DO UPDATE SET
      last_scan   = @last_scan,
      last_count  = @last_count,
      success     = @success,
      fail_streak = @fail_streak,
      error_msg   = @error_msg,
      avg_ms      = @avg_ms
  `);
  stmts.getStats = {
    total:     db.prepare("SELECT COUNT(*) as n FROM listings WHERE active = 1"),
    bySource:  db.prepare("SELECT source, COUNT(*) as n FROM listings WHERE active = 1 GROUP BY source"),
    byBrand:   db.prepare("SELECT brand, COUNT(*) as n FROM listings WHERE active = 1 GROUP BY brand ORDER BY n DESC LIMIT 10"),
    lastRun:   db.prepare("SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 1"),
    platforms: db.prepare("SELECT * FROM platform_status ORDER BY platform"),
  };
  stmts.recentForDedup = db.prepare(
    "SELECT id, hash, kenteken, brand, model, year, price, km, source FROM listings WHERE active = 1 AND last_seen > ?"
  );
  stmts.kentekenLookup = db.prepare(
    "SELECT id, source FROM listings WHERE kenteken = ? AND active = 1 LIMIT 1"
  );
  stmts.hashLookup = db.prepare(
    "SELECT id, source, price FROM listings WHERE hash = ? LIMIT 1"
  );
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
export const db = {

  getListings({ brand, type, source, maxPrice, maxKm, query, limit = 100, offset = 0 } = {}) {
    const _db = getDb();
    const cnd = ["active = 1"], val = [];
    if (brand)    { cnd.push("brand = ?");                          val.push(brand); }
    if (type)     { cnd.push("type = ?");                           val.push(type); }
    if (source)   { cnd.push("source = ?");                         val.push(source); }
    if (maxPrice) { cnd.push("price <= ?");                         val.push(parseInt(maxPrice)); }
    if (maxKm)    { cnd.push("km <= ?");                            val.push(parseInt(maxKm)); }
    if (query)    { cnd.push("(brand LIKE ? OR model LIKE ?)");     val.push(`%${query}%`, `%${query}%`); }
    val.push(parseInt(limit), parseInt(offset));
    // Dynamische query — wel elke keer prepare maar SQLite cachet intern
    return _db.prepare(
      `SELECT * FROM listings WHERE ${cnd.join(" AND ")} ORDER BY last_seen DESC LIMIT ? OFFSET ?`
    ).all(...val);
  },

  getByKenteken: (k) => stmts.getByKenteken?.get(k) ?? getDb() && stmts.getByKenteken.get(k),
  getByHash:     (h) => stmts.getByHash.get(h),
  getById:       (id) => stmts.getById.get(id),

  // UPSERT — vervangt insert + catch UNIQUE patroon volledig
  upsert(listing) {
    const db   = getDb();
    const prev = stmts.hashLookup.get(listing.hash);
    const info = stmts.upsert.run(listing);

    // Prijshistoriek bijhouden bij wijziging
    if (prev && prev.price !== listing.price) {
      stmts.insertPriceHistory.run(prev.id, listing.price, listing.km, listing.last_updated);
    } else if (!prev) {
      // Nieuwe listing — sla ook eerste prijs op
      stmts.insertPriceHistory.run(listing.id, listing.price, listing.km, listing.first_seen);
    }
    return { isNew: !prev, info };
  },

  update(id, fields) {
    const keys = Object.keys(fields);
    return getDb().prepare(
      `UPDATE listings SET ${keys.map(k => `${k} = @${k}`).join(", ")} WHERE id = @id`
    ).run({ id, ...fields });
  },

  // Markeer als inactief — alle listings van dit platform die ouder zijn dan runStart
  markStaleInactive(source, runStartIso) {
    return stmts.markInactive.run(source, runStartIso);
  },

  getPriceHistory(listingId) {
    return getDb().prepare(
      "SELECT * FROM price_history WHERE listing_id = ? ORDER BY recorded_at ASC"
    ).all(listingId);
  },

  startRun: (id, platforms) =>
    stmts.startRun.run(id, new Date().toISOString(), JSON.stringify(platforms)),

  finishRun(id, stats, status = "done") {
    return stmts.finishRun.run(
      new Date().toISOString(), status,
      stats.found, stats.new, stats.updated, stats.duplicates,
      JSON.stringify(stats.errors || []), id
    );
  },

  updatePlatformStatus(platform, { last_count, success, error_msg, avg_ms, fail_streak }) {
    return stmts.platformUpsert.run({
      platform, last_scan: new Date().toISOString(),
      last_count, success: success ? 1 : 0,
      fail_streak: fail_streak || 0,
      error_msg: error_msg || null, avg_ms: avg_ms || 0,
    });
  },

  getStats() {
    getDb();
    return {
      total:     stmts.getStats.total.get().n,
      bySource:  stmts.getStats.bySource.all(),
      byBrand:   stmts.getStats.byBrand.all(),
      lastRun:   stmts.getStats.lastRun.get(),
      platforms: stmts.getStats.platforms.all(),
    };
  },

  getRecentForDedup(cutoffIso) {
    return stmts.recentForDedup.all(cutoffIso);
  },

  kentekenLookup: (k)  => stmts.kentekenLookup.get(k),
  hashLookup:     (h)  => stmts.hashLookup.get(h),
};
