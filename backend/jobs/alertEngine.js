// ══════════════════════════════════════════════════════════════════════════════
// ALERT ENGINE
// Draait na elke scrape-run. Matcht nieuwe listings tegen actieve user alerts.
// Stuurt max ALERT_MAX_PER_USER_PER_RUN emails per gebruiker per run.
// Respecteert cooldown om spam te voorkomen.
// ══════════════════════════════════════════════════════════════════════════════
import { getDb }              from "./database.js";
import { haversineKm }        from "./geocoder.js";
import { sendEmail, buildAlertEmail } from "./email.js";
import { logger }             from "./logger.js";

const MAX_PER_USER = parseInt(process.env.ALERT_MAX_PER_USER_PER_RUN || "5");
const COOLDOWN_H   = parseInt(process.env.ALERT_COOLDOWN_HOURS || "4");
const FRONTEND     = process.env.FRONTEND_URL || "http://localhost:3000";

// ── Listing matcht tegen een alert? ───────────────────────────────────────────
function matchesAlert(listing, alert, userCoords) {
  // Merk
  if (alert.brand && listing.brand?.toLowerCase() !== alert.brand.toLowerCase()) return false;

  // Type
  if (alert.type && listing.type?.toLowerCase() !== alert.type.toLowerCase()) return false;

  // Zoekterm (brand + model)
  if (alert.query) {
    const haystack = `${listing.brand} ${listing.model}`.toLowerCase();
    if (!haystack.includes(alert.query.toLowerCase())) return false;
  }

  // Max prijs
  if (alert.max_price && listing.price > alert.max_price) return false;

  // Max km
  if (alert.max_km && listing.km > alert.max_km) return false;

  // Max afstand (alleen als listing én gebruiker coördinaten hebben)
  if (alert.max_dist_km && listing.lat && listing.lng && userCoords?.lat) {
    const dist = haversineKm(userCoords.lat, userCoords.lng, listing.lat, listing.lng);
    if (dist > alert.max_dist_km) return false;
  }

  return true;
}

// ── Haal coördinaten van gebruiker op (opgeslagen bij alert) ──────────────────
function getUserCoords(alert) {
  if (alert.user_lat && alert.user_lng) {
    return { lat: alert.user_lat, lng: alert.user_lng };
  }
  return null;
}

// ── Hoofd alert engine ────────────────────────────────────────────────────────
export async function runAlertEngine(runId, newListingIds = []) {
  const db = getDb();
  logger.info(`Alert engine gestart (run: ${runId}, ${newListingIds.length} nieuwe listings)`);

  if (!newListingIds.length) {
    logger.info("Alert engine: geen nieuwe listings — overgeslagen");
    return { emailsSent: 0, matched: 0 };
  }

  // Haal nieuwe listings op (alleen de actieve, nieuw gevonden in deze run)
  const placeholders = newListingIds.map(() => "?").join(",");
  const newListings  = db.prepare(
    `SELECT * FROM listings WHERE id IN (${placeholders}) AND active = 1`
  ).all(...newListingIds);

  if (!newListings.length) {
    logger.info("Alert engine: nieuwe listings niet gevonden in DB");
    return { emailsSent: 0, matched: 0 };
  }

  // Haal alle actieve alerts op (incl. gebruikersdata)
  const alerts = db.prepare(`
    SELECT a.*, u.email as user_email, u.name as user_name,
           u.id as user_id_real
    FROM user_alerts a
    JOIN users u ON u.id = a.user_id
    WHERE a.active = 1 AND u.email IS NOT NULL
  `).all();

  logger.info(`Alert engine: ${alerts.length} actieve alerts, ${newListings.length} nieuwe listings`);

  // Groepeer per gebruiker om cooldown + max per user te bewaken
  const userGroups = new Map(); // userId → { user, alerts, matches }
  for (const alert of alerts) {
    if (!userGroups.has(alert.user_id)) {
      userGroups.set(alert.user_id, {
        user: { id: alert.user_id, email: alert.user_email, name: alert.user_name },
        alerts: [],
        matches: [],
      });
    }
    userGroups.get(alert.user_id).alerts.push(alert);
  }

  // Match listings tegen alerts
  let totalMatched = 0;
  for (const [userId, group] of userGroups) {
    for (const alert of group.alerts) {
      // Cooldown check — stuur niet vaker dan elke COOLDOWN_H uur per alert
      if (alert.last_hit) {
        const hoursSince = (Date.now() - new Date(alert.last_hit)) / 3600000;
        if (hoursSince < COOLDOWN_H) {
          logger.debug(`Alert ${alert.id} in cooldown (${hoursSince.toFixed(1)}h < ${COOLDOWN_H}h)`);
          continue;
        }
      }

      const userCoords = getUserCoords(alert);

      for (const listing of newListings) {
        if (matchesAlert(listing, alert, userCoords)) {
          // Voorkom dubbelen in matches per gebruiker
          if (!group.matches.find(m => m.id === listing.id)) {
            group.matches.push({
              ...listing,
              images:      JSON.parse(listing.images      || "[]"),
              rdw_data:    JSON.parse(listing.rdw_data    || "{}"),
              apk_history: JSON.parse(listing.apk_history || "[]"),
              _alertId:    alert.id,
            });
          }
        }
      }
    }
    totalMatched += group.matches.length;
  }

  logger.info(`Alert engine: ${totalMatched} matches gevonden`);

  // Verstuur emails
  let emailsSent = 0;
  const updateLastHit = db.prepare(
    "UPDATE user_alerts SET last_hit = ? WHERE id = ?"
  );

  for (const [userId, group] of userGroups) {
    if (!group.matches.length) continue;

    // Max N matches per email
    const toSend = group.matches.slice(0, MAX_PER_USER);

    const unsubscribeUrl = `${FRONTEND}/alerts/unsubscribe?userId=${userId}`;

    // Groepeer op alert voor last_hit updates
    const alertIds = [...new Set(toSend.map(m => m._alertId))];

    const { subject, html, text } = buildAlertEmail({
      user:           group.user,
      alert:          group.alerts.find(a => a.id === alertIds[0]) || group.alerts[0],
      matches:        toSend,
      unsubscribeUrl,
    });

    const result = await sendEmail({
      to:      group.user.email,
      subject,
      html,
      text,
    });

    if (result.ok) {
      emailsSent++;
      // Update last_hit voor alle getriggerde alerts van deze user
      const now = new Date().toISOString();
      for (const alertId of alertIds) {
        updateLastHit.run(now, alertId);
      }
      logger.info(`Alert email verstuurd → ${group.user.email} (${toSend.length} listings)`);
    } else {
      logger.error(`Alert email mislukt → ${group.user.email}: ${result.error}`);
    }

    // Kleine pauze tussen emails (rate limiting)
    await new Promise(r => setTimeout(r, 200));
  }

  logger.info(`Alert engine klaar: ${emailsSent} emails verstuurd`);
  return { emailsSent, matched: totalMatched };
}
