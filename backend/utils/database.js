// ══════════════════════════════════════════════════════════════════════════════
// DATABASE — SQLite via better-sqlite3
// Synchroon, snel, geen externe dependencies
// ══════════════════════════════════════════════════════════════════════════════
import Database from "better-sqlite3";
import path     from "path";
import fs       from "fs";
import { logger } from "./logger.js";

const DB_PATH = process.env.DB_PATH || "./data/motorshop.db";

// Zorg dat data-map bestaat
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db;
export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    init(_db);
    logger.info(`Database geopend: ${DB_PATH}`);
  }
  return _db;
}

function init(db) {
  db.exec(`
    -- ── Listings ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS listings (
      id              TEXT PRIMARY KEY,          -- UUID
      hash            TEXT UNIQUE NOT NULL,      -- dedup-sleutel
      kenteken        TEXT,                      -- genormaliseerd (geen streepjes)
      brand           TEXT NOT NULL,
      model           TEXT NOT NULL,
      model_key       TEXT,
      year            INTEGER,
      price           INTEGER,
      km              INTEGER,
      type            TEXT,
      location        TEXT,
      source          TEXT NOT NULL,             -- platform naam
      source_url      TEXT,                      -- directe link naar advertentie
      source_id       TEXT,                      -- platform-eigen ID
      description     TEXT,
      images          TEXT,                      -- JSON array van URLs
      seller_name     TEXT,
      seller_type     TEXT,                      -- particulier | dealer
      catalogus       INTEGER,
      fair_value      INTEGER,                   -- berekende marktwaarde
      score_label     TEXT,
      score_color     TEXT,
      nap_status      TEXT,                      -- LOGISCH | VERDACHT | ONBETROUWBAAR | ONBEKEND
      nap_score       INTEGER,
      rdw_data        TEXT,                      -- JSON RDW voertuigdata
      apk_history     TEXT,                      -- JSON APK historiek
      first_seen      TEXT NOT NULL,             -- ISO timestamp
      last_seen       TEXT NOT NULL,             -- ISO timestamp
      last_updated    TEXT NOT NULL,
      active          INTEGER DEFAULT 1          -- 0 = verwijderd van platform
    );

    -- ── Scrape runs ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS scrape_runs (
      id          TEXT PRIMARY KEY,
      started_at  TEXT NOT NULL,
      finished_at TEXT,
      status      TEXT DEFAULT 'running',        -- running | done | error
      platforms   TEXT,                          -- JSON array
      found       INTEGER DEFAULT 0,
      new_items   INTEGER DEFAULT 0,
      updated     INTEGER DEFAULT 0,
      duplicates  INTEGER DEFAULT 0,
      errors      TEXT                           -- JSON array van foutmeldingen
    );

    -- ── Platform status ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS platform_status (
      platform    TEXT PRIMARY KEY,
      last_scan   TEXT,
      last_count  INTEGER DEFAULT 0,
      success     INTEGER DEFAULT 1,
      error_msg   TEXT,
      avg_ms      INTEGER DEFAULT 0
    );

    -- ── Indices ──────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_listings_kenteken ON listings(kenteken);
    CREATE INDEX IF NOT EXISTS idx_listings_brand    ON listings(brand);
    CREATE INDEX IF NOT EXISTS idx_listings_source   ON listings(source);
    CREATE INDEX IF NOT EXISTS idx_listings_active   ON listings(active);
    CREATE INDEX IF NOT EXISTS idx_listings_price    ON listings(price);
    CREATE INDEX IF NOT EXISTS idx_listings_hash     ON listings(hash);
  `);
}

// ── QUERIES ──────────────────────────────────────────────────────────────────
export const db = {

  // Geef alle actieve listings (met filters)
  getListings({ brand, type, source, maxPrice, maxKm, query, limit = 100, offset = 0 } = {}) {
    const db  = getDb();
    const cnd = ["active = 1"];
    const val = [];
    if (brand)    { cnd.push("brand = ?");            val.push(brand); }
    if (type)     { cnd.push("type = ?");             val.push(type); }
    if (source)   { cnd.push("source = ?");           val.push(source); }
    if (maxPrice) { cnd.push("price <= ?");           val.push(maxPrice); }
    if (maxKm)    { cnd.push("km <= ?");              val.push(maxKm); }
    if (query)    { cnd.push("(brand LIKE ? OR model LIKE ?)"); val.push(`%${query}%`, `%${query}%`); }
    val.push(limit, offset);
    return db.prepare(
      `SELECT * FROM listings WHERE ${cnd.join(" AND ")} ORDER BY last_seen DESC LIMIT ? OFFSET ?`
    ).all(...val);
  },

  // Zoek op kenteken (exact)
  getByKenteken(kenteken) {
    return getDb().prepare("SELECT * FROM listings WHERE kenteken = ? AND active = 1").get(kenteken);
  },

  // Zoek op hash (dedup)
  getByHash(hash) {
    return getDb().prepare("SELECT id FROM listings WHERE hash = ?").get(hash);
  },

  // Insert nieuwe listing
  insert(listing) {
    const db = getDb();
    return db.prepare(`
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
    `).run(listing);
  },

  // Update prijs/km/last_seen van bestaande listing
  update(id, fields) {
    const db  = getDb();
    const set = Object.keys(fields).map(k => `${k} = @${k}`).join(", ");
    return db.prepare(`UPDATE listings SET ${set} WHERE id = @id`).run({ id, ...fields });
  },

  // Markeer als inactief (niet meer gezien)
  markInactive(source, seenIds) {
    const db = getDb();
    if (!seenIds.length) return;
    const ph = seenIds.map(() => "?").join(",");
    return db.prepare(
      `UPDATE listings SET active = 0 WHERE source = ? AND id NOT IN (${ph})`
    ).run(source, ...seenIds);
  },

  // Scrape run beheer
  startRun(id, platforms) {
    return getDb().prepare(
      "INSERT INTO scrape_runs (id, started_at, status, platforms) VALUES (?, ?, 'running', ?)"
    ).run(id, new Date().toISOString(), JSON.stringify(platforms));
  },

  finishRun(id, stats) {
    return getDb().prepare(
      `UPDATE scrape_runs SET finished_at = ?, status = 'done',
       found = ?, new_items = ?, updated = ?, duplicates = ?, errors = ?
       WHERE id = ?`
    ).run(new Date().toISOString(), stats.found, stats.new, stats.updated,
          stats.duplicates, JSON.stringify(stats.errors || []), id);
  },

  updatePlatformStatus(platform, data) {
    return getDb().prepare(`
      INSERT INTO platform_status (platform, last_scan, last_count, success, error_msg, avg_ms)
      VALUES (@platform, @last_scan, @last_count, @success, @error_msg, @avg_ms)
      ON CONFLICT(platform) DO UPDATE SET
        last_scan = @last_scan, last_count = @last_count,
        success = @success, error_msg = @error_msg, avg_ms = @avg_ms
    `).run(data);
  },

  getStats() {
    const db = getDb();
    return {
      total:      db.prepare("SELECT COUNT(*) as n FROM listings WHERE active = 1").get().n,
      bySource:   db.prepare("SELECT source, COUNT(*) as n FROM listings WHERE active = 1 GROUP BY source").all(),
      byBrand:    db.prepare("SELECT brand,  COUNT(*) as n FROM listings WHERE active = 1 GROUP BY brand  ORDER BY n DESC LIMIT 10").all(),
      lastRun:    db.prepare("SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 1").get(),
      platforms:  db.prepare("SELECT * FROM platform_status").all(),
    };
  },
};
