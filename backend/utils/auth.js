// ══════════════════════════════════════════════════════════════════════════════
// AUTH UTILS — gebruikersbeheer + JWT
// ══════════════════════════════════════════════════════════════════════════════
import jwt    from "jsonwebtoken";
import { getDb } from "./database.js";
import { logger } from "./logger.js";

const JWT_SECRET  = process.env.JWT_SECRET  || "dev-secret-change-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

// ── DB schema voor gebruikers ──────────────────────────────────────────────────
export function initAuthSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,          -- UUID
      provider     TEXT NOT NULL,             -- google | microsoft | apple
      provider_id  TEXT NOT NULL,             -- provider-eigen user ID
      email        TEXT,
      name         TEXT,
      avatar_url   TEXT,
      created_at   TEXT NOT NULL,
      last_login   TEXT NOT NULL,
      UNIQUE(provider, provider_id)
    );

    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL,
      saved_at   TEXT NOT NULL,
      PRIMARY KEY (user_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS user_alerts (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      brand       TEXT,
      type        TEXT,
      max_price   INTEGER,
      max_km      INTEGER,
      max_dist_km INTEGER,
      query       TEXT,
      active      INTEGER DEFAULT 1,
      created_at  TEXT NOT NULL,
      last_hit    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_provider    ON users(provider, provider_id);
    CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
    CREATE INDEX IF NOT EXISTS idx_favorites_user    ON user_favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_user       ON user_alerts(user_id);
  `);
}

// ── Prepared statements voor auth ─────────────────────────────────────────────
let stmts;
function getStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    findByProvider: db.prepare(
      "SELECT * FROM users WHERE provider = ? AND provider_id = ? LIMIT 1"
    ),
    findById: db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1"),
    upsertUser: db.prepare(`
      INSERT INTO users (id, provider, provider_id, email, name, avatar_url, created_at, last_login)
      VALUES (@id, @provider, @provider_id, @email, @name, @avatar_url, @created_at, @last_login)
      ON CONFLICT(provider, provider_id) DO UPDATE SET
        email      = COALESCE(excluded.email, email),
        name       = COALESCE(excluded.name,  name),
        avatar_url = COALESCE(excluded.avatar_url, avatar_url),
        last_login = excluded.last_login
    `),
    getFavorites: db.prepare(
      `SELECT l.* FROM user_favorites f
       JOIN listings l ON l.id = f.listing_id
       WHERE f.user_id = ? AND l.active = 1
       ORDER BY f.saved_at DESC`
    ),
    addFavorite: db.prepare(
      "INSERT OR IGNORE INTO user_favorites (user_id, listing_id, saved_at) VALUES (?, ?, ?)"
    ),
    removeFavorite: db.prepare(
      "DELETE FROM user_favorites WHERE user_id = ? AND listing_id = ?"
    ),
    isFavorite: db.prepare(
      "SELECT 1 FROM user_favorites WHERE user_id = ? AND listing_id = ? LIMIT 1"
    ),
    getAlerts: db.prepare(
      "SELECT * FROM user_alerts WHERE user_id = ? AND active = 1 ORDER BY created_at DESC"
    ),
    addAlert: db.prepare(`
      INSERT INTO user_alerts (id, user_id, brand, type, max_price, max_km, max_dist_km, query, created_at)
      VALUES (@id, @user_id, @brand, @type, @max_price, @max_km, @max_dist_km, @query, @created_at)
    `),
    deleteAlert: db.prepare(
      "UPDATE user_alerts SET active = 0 WHERE id = ? AND user_id = ?"
    ),
  };
  return stmts;
}

// ── User CRUD ──────────────────────────────────────────────────────────────────
export const userDb = {
  findByProvider: (provider, id) => getStmts().findByProvider.get(provider, id),
  findById:       (id)           => getStmts().findById.get(id),

  upsertUser({ provider, provider_id, email, name, avatar_url }) {
    const { v4: uuid } = await import("uuid").catch(() => ({ v4: () => crypto.randomUUID() }));
    const now = new Date().toISOString();
    // Zoek bestaand of maak nieuw ID
    const existing = getStmts().findByProvider.get(provider, provider_id);
    const id       = existing?.id || crypto.randomUUID();
    getStmts().upsertUser.run({ id, provider, provider_id, email, name, avatar_url, created_at: now, last_login: now });
    return getStmts().findById.get(id);
  },

  getFavorites:  (userId)           => getStmts().getFavorites.all(userId),
  addFavorite:   (userId, listingId)=> getStmts().addFavorite.run(userId, listingId, new Date().toISOString()),
  removeFavorite:(userId, listingId)=> getStmts().removeFavorite.run(userId, listingId),
  isFavorite:    (userId, listingId)=> !!getStmts().isFavorite.get(userId, listingId),
  getAlerts:     (userId)           => getStmts().getAlerts.all(userId),

  addAlert(userId, filters) {
    const id = crypto.randomUUID();
    getStmts().addAlert.run({
      id, user_id: userId,
      brand: filters.brand || null, type: filters.type || null,
      max_price: filters.maxPrice || null, max_km: filters.maxKm || null,
      max_dist_km: filters.maxDist || null, query: filters.query || null,
      created_at: new Date().toISOString(),
    });
    return id;
  },

  deleteAlert: (alertId, userId) => getStmts().deleteAlert.run(alertId, userId),
};

// ── Admin check ──────────────────────────────────────────────────────────────
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "m_s_d_bron@hotmail.com")
  .split(",").map(e => e.trim().toLowerCase());

export const isAdmin = (user) =>
  !!(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

// ── JWT helpers ────────────────────────────────────────────────────────────────
export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar: user.avatar_url, admin: isAdmin(user) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

// ── Auth middleware — zet req.user als token geldig ────────────────────────────
export function requireAdmin(req, res, next) {
  const token = extractToken(req);
  const user  = token ? verifyToken(token) : null;
  if (!user)           return res.status(401).json({ ok: false, error: "Niet ingelogd" });
  if (!user.admin)     return res.status(403).json({ ok: false, error: "Geen toegang" });
  req.user = user;
  next();
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);
  const user  = token ? verifyToken(token) : null;
  if (!user) return res.status(401).json({ ok: false, error: "Niet ingelogd" });
  req.user = user;
  next();
}

export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  req.user = token ? verifyToken(token) : null;
  next();
}

function extractToken(req) {
  const auth   = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.cookies?.ms_token || null;
}
