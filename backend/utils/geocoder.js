// ══════════════════════════════════════════════════════════════════════════════
// GEOCODER — Nominatim (OpenStreetMap), geen API-key nodig
// Rate limit: 1 req/sec (respecteer ToS)
// Cache: in-memory + SQLite voor persistentie
// ══════════════════════════════════════════════════════════════════════════════
import { getDb }  from "./database.js";
import { logger } from "./logger.js";

const NOMINATIM   = "https://nominatim.openstreetmap.org/search";
const USER_AGENT  = "motor.shop/0.1 (motormarkt aggregator)";
const RATE_MS     = 1100; // 1 req/sec + marge

// In-memory cache (reset bij herstart — DB-cache overleeft restart)
const memCache = new Map();
let lastReqAt  = 0;

// Initialiseer geocode-cache tabel
export function initGeocodeCache(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS geocode_cache (
      query      TEXT PRIMARY KEY,
      lat        REAL,
      lng        REAL,
      display    TEXT,
      cached_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_geocode_query ON geocode_cache(query);
  `);
}

// Rate-limiter: wacht indien nodig
async function rateLimitWait() {
  const now  = Date.now();
  const wait = RATE_MS - (now - lastReqAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReqAt = Date.now();
}

/**
 * Geocodeer een locatiestring naar { lat, lng }.
 * Zoekstrategie: memory → DB-cache → Nominatim API
 *
 * @param {string} location  bijv. "Amsterdam" of "Utrecht, Nederland"
 * @returns {{ lat: number, lng: number } | null}
 */
export async function geocode(location) {
  if (!location) return null;

  // Normaliseer query: lowercase, trim, voeg NL toe als geen land vermeld
  const query = normalizeQuery(location);
  if (!query) return null;

  // 1. Memory cache
  if (memCache.has(query)) return memCache.get(query);

  // 2. DB cache
  const db     = getDb();
  const cached = db.prepare("SELECT lat, lng FROM geocode_cache WHERE query = ?").get(query);
  if (cached) {
    const result = { lat: cached.lat, lng: cached.lng };
    memCache.set(query, result);
    return result;
  }

  // 3. Nominatim API
  await rateLimitWait();

  try {
    const params = new URLSearchParams({
      q:              query,
      format:         "json",
      limit:          "1",
      countrycodes:   "nl,be",
      addressdetails: "0",
    });

    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal:  AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn(`Geocode HTTP ${res.status} voor "${query}"`);
      return null;
    }

    const data = await res.json();
    if (!data?.length) {
      logger.debug(`Geocode geen resultaat voor "${query}"`);
      // Cache null-resultaat om herhaalde lookups te voorkomen
      cacheResult(db, query, null, null, "");
      return null;
    }

    const { lat, lon, display_name } = data[0];
    const result = { lat: parseFloat(lat), lng: parseFloat(lon) };

    cacheResult(db, query, result.lat, result.lng, display_name || "");
    memCache.set(query, result);

    logger.debug(`Geocode "${query}" → ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
    return result;

  } catch (err) {
    logger.warn(`Geocode fout voor "${query}": ${err.message}`);
    return null;
  }
}

/**
 * Batch geocode — meerdere locaties met rate limiting
 */
export async function geocodeBatch(locations) {
  const results = {};
  const unique  = [...new Set(locations.filter(Boolean).map(normalizeQuery))];

  for (const loc of unique) {
    results[loc] = await geocode(loc);
  }
  return results;
}

// ── Haversine afstandsberekening ──────────────────────────────────────────────
/**
 * Afstand in km tussen twee coördinaten.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

/**
 * Formatteer afstand leesbaar: "3 km", "12 km", "250+ km"
 */
export function formatDistance(km) {
  if (km === null || km === undefined) return null;
  if (km < 1)   return "< 1 km";
  if (km < 10)  return `${Math.round(km)} km`;
  if (km < 100) return `${Math.round(km / 5)  * 5} km`;
  if (km < 250) return `${Math.round(km / 10) * 10} km`;
  return "250+ km";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeQuery(loc) {
  let q = String(loc).trim().toLowerCase();
  if (!q) return null;
  // Verwijder overbodige suffixen die Nominatim verwarren
  q = q.replace(/\s*(nederland|netherlands|nl|belgium|belgie|belgië|be)\s*$/i, "").trim();
  // Voeg nederland toe als default voor korte queries (steden)
  return q.length < 30 ? `${q}, nederland` : q;
}

function cacheResult(db, query, lat, lng, display) {
  try {
    db.prepare(`
      INSERT INTO geocode_cache (query, lat, lng, display, cached_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(query) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, cached_at=excluded.cached_at
    `).run(query, lat, lng, display, new Date().toISOString());
  } catch {}
}

/**
 * Geocodeer een batch listings op basis van hun location-string.
 * Slaat lat/lng op in de listing objecten.
 * Gebruikt de cache maximaal — unieke locaties worden maar 1x opgezocht.
 *
 * @param {Array} listings - listing-objecten met .location veld
 * @returns {Array} zelfde listings, nu met .lat en .lng ingevuld waar mogelijk
 */
export async function geocodeListings(listings) {
  // Verzamel unieke locaties
  const uniqueLocs = [...new Set(
    listings.map(l => l.location).filter(Boolean)
  )];

  if (!uniqueLocs.length) return listings;

  logger.info(`Geocoding ${uniqueLocs.length} unieke locaties...`);

  // Batch geocode met rate limiting
  const coordMap = {};
  for (const loc of uniqueLocs) {
    coordMap[loc] = await geocode(loc);
  }

  // Wijs coördinaten toe aan listings
  let geocoded = 0;
  for (const listing of listings) {
    const coords = listing.location ? coordMap[listing.location] : null;
    if (coords) {
      listing.lat = coords.lat;
      listing.lng = coords.lng;
      geocoded++;
    }
  }

  logger.info(`Geocoding klaar: ${geocoded}/${listings.length} listings met coördinaten`);
  return listings;
}
