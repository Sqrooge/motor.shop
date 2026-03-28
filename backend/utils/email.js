// ══════════════════════════════════════════════════════════════════════════════
// EMAIL SERVICE — Resend · SendGrid · SMTP (nodemailer)
// Provider wordt bepaald door EMAIL_PROVIDER env var
// ══════════════════════════════════════════════════════════════════════════════
import { logger } from "./logger.js";

const PROVIDER  = process.env.EMAIL_PROVIDER || "smtp";
const FROM      = process.env.EMAIL_FROM     || "Motor.shop <alerts@motor.shop>";

// ── Provider initialisatie ─────────────────────────────────────────────────────
let _client = null;

async function getClient() {
  if (_client) return _client;

  if (PROVIDER === "resend") {
    const { Resend } = await import("resend");
    _client = new Resend(process.env.RESEND_API_KEY);
    _client._type = "resend";

  } else if (PROVIDER === "sendgrid") {
    const sg = await import("@sendgrid/mail");
    sg.default.setApiKey(process.env.SENDGRID_API_KEY);
    _client = sg.default;
    _client._type = "sendgrid";

  } else {
    // SMTP via nodemailer (default)
    const nodemailer = await import("nodemailer");
    _client = nodemailer.default.createTransport({
      host:   process.env.SMTP_HOST || "smtp.gmail.com",
      port:   parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    _client._type = "smtp";
  }

  logger.info(`Email provider: ${PROVIDER}`);
  return _client;
}

// ── Hoofd send functie ────────────────────────────────────────────────────────
export async function sendEmail({ to, subject, html, text }) {
  try {
    const client = await getClient();

    if (client._type === "resend") {
      const r = await client.emails.send({ from: FROM, to, subject, html, text });
      logger.debug(`Email verstuurd via Resend → ${to}`, { id: r.data?.id });
      return { ok: true, id: r.data?.id };

    } else if (client._type === "sendgrid") {
      await client.send({ from: FROM, to, subject, html, text });
      logger.debug(`Email verstuurd via SendGrid → ${to}`);
      return { ok: true };

    } else {
      const info = await client.sendMail({ from: FROM, to, subject, html, text });
      logger.debug(`Email verstuurd via SMTP → ${to}`, { msgId: info.messageId });
      return { ok: true, id: info.messageId };
    }
  } catch (err) {
    logger.error(`Email fout → ${to}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// ── Email templates ───────────────────────────────────────────────────────────
export function buildAlertEmail({ user, alert, matches, unsubscribeUrl }) {
  const firstName = (user.name || "").split(" ")[0] || "motorrijder";
  const count     = matches.length;
  const isSingle  = count === 1;

  const subject = isSingle
    ? `🔥 ${matches[0].brand} ${matches[0].model.replace(matches[0].brand + " ", "")} — ${formatPrice(matches[0].price)} | Motor.shop alert`
    : `🔔 ${count} nieuwe koopjes gevonden voor jouw alert | Motor.shop`;

  const listingCards = matches.map(l => {
    const saving    = l.fair_value ? l.fair_value - l.price : null;
    const savingStr = saving > 0 ? `<span style="color:#00c853;font-weight:700">−€${saving.toLocaleString("nl-NL")} onder marktwaarde</span>` : "";
    const napColor  = l.nap_status === "LOGISCH" ? "#00c853" : l.nap_status === "VERDACHT" ? "#ff9800" : "#f44336";
    const napLabel  = l.nap_status === "LOGISCH" ? "✅ Km logisch" : l.nap_status === "VERDACHT" ? "⚠️ Km verdacht" : l.nap_status === "ONBETROUWBAAR" ? "❌ Km onbetrouwbaar" : "";

    return `
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:4px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:#ff6b00;letter-spacing:2px;font-weight:700">${l.brand.toUpperCase()}</div>
          <div style="font-size:18px;font-weight:900;color:#fff;line-height:1.2">${l.model.replace(l.brand + " ", "")}</div>
          <div style="font-size:11px;color:#555;margin-top:2px">${l.year || "—"} · ${l.km ? l.km.toLocaleString("nl-NL") + " km" : "—"} · ${l.location || "—"}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:900;color:#ff6b00">€${l.price.toLocaleString("nl-NL")}</div>
          ${l.fair_value ? `<div style="font-size:11px;color:#555">markt €${l.fair_value.toLocaleString("nl-NL")}</div>` : ""}
        </div>
      </div>
      ${savingStr ? `<div style="margin-bottom:8px;font-size:12px">${savingStr}</div>` : ""}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="background:#0d0d0d;border:1px solid #333;padding:3px 8px;border-radius:2px;font-size:10px;color:#888">${l.source}</span>
        ${napLabel ? `<span style="font-size:10px;color:${napColor}">${napLabel}</span>` : ""}
        ${l.score_label ? `<span style="font-size:10px;color:#ff6b00;font-weight:700">${l.score_label}</span>` : ""}
      </div>
      ${l.source_url ? `<a href="${l.source_url}" style="display:inline-block;margin-top:10px;background:#ff6b00;color:#000;padding:8px 18px;border-radius:3px;text-decoration:none;font-weight:900;font-size:12px;letter-spacing:1px">BEKIJK ADVERTENTIE →</a>` : ""}
    </div>`;
  }).join("");

  const alertDesc = buildAlertDescription(alert);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:'Arial Narrow',Arial,sans-serif;color:#fff">
  <div style="max-width:600px;margin:0 auto;padding:20px">

    <!-- Header -->
    <div style="background:#0d0d0d;border:1px solid #1a1a1a;border-radius:4px;padding:20px;margin-bottom:16px;text-align:center">
      <div style="display:inline-flex;align-items:center;gap:8px">
        <div style="width:36px;height:36px;background:#ff6b00;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:20px">🏍</div>
        <div style="font-size:22px;font-weight:900;letter-spacing:2px">MOTOR<span style="color:#ff6b00">.SHOP</span></div>
      </div>
      <div style="font-size:10px;color:#444;letter-spacing:3px;margin-top:4px">KOOPJES ALERT</div>
    </div>

    <!-- Intro -->
    <div style="background:#0d0d0d;border:1px solid #1a1a1a;border-radius:4px;padding:16px;margin-bottom:12px">
      <div style="font-size:16px;color:#fff;margin-bottom:4px">
        Hoi ${firstName}, we vonden ${isSingle ? "een nieuw koopje" : `${count} nieuwe koopjes`} voor jouw alert!
      </div>
      <div style="font-size:11px;color:#555">
        Alert: ${alertDesc}
      </div>
    </div>

    <!-- Listings -->
    ${listingCards}

    <!-- CTA -->
    <div style="text-align:center;padding:16px">
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" style="background:#ff6b00;color:#000;padding:12px 28px;border-radius:3px;text-decoration:none;font-weight:900;font-size:13px;letter-spacing:2px;display:inline-block">
        BEKIJK ALLE LISTINGS →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #111;padding:16px;text-align:center">
      <div style="font-size:10px;color:#2a2a2a;line-height:1.8">
        Je ontvangt deze email omdat je een alert hebt ingesteld op Motor.shop.<br>
        <a href="${unsubscribeUrl}" style="color:#444;text-decoration:underline">Alert uitschakelen</a>
        &nbsp;·&nbsp;
        <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" style="color:#444;text-decoration:underline">Motor.shop</a>
      </div>
    </div>

  </div>
</body>
</html>`;

  const text = `Motor.shop Alert — ${count} nieuwe ${count === 1 ? "koopje" : "koopjes"}\n\n` +
    `Hoi ${firstName},\n\nJouw alert (${alertDesc}) heeft ${count} resultaat${count > 1 ? "en" : ""} gevonden:\n\n` +
    matches.map(l =>
      `${l.brand} ${l.model.replace(l.brand + " ", "")} (${l.year}) — €${l.price.toLocaleString("nl-NL")}\n` +
      `${l.km ? l.km.toLocaleString("nl-NL") + " km" : ""} · ${l.location || ""} · ${l.source}\n` +
      (l.source_url ? l.source_url : "")
    ).join("\n\n") +
    `\n\nBekijk alle listings: ${process.env.FRONTEND_URL || "http://localhost:3000"}\n` +
    `Alert uitschakelen: ${unsubscribeUrl}`;

  return { subject, html, text };
}

function buildAlertDescription(alert) {
  const parts = [];
  if (alert.brand)       parts.push(alert.brand);
  if (alert.type)        parts.push(alert.type);
  if (alert.query)       parts.push(`"${alert.query}"`);
  if (alert.max_price)   parts.push(`max €${alert.max_price.toLocaleString("nl-NL")}`);
  if (alert.max_km)      parts.push(`max ${alert.max_km.toLocaleString("nl-NL")} km`);
  if (alert.max_dist_km) parts.push(`binnen ${alert.max_dist_km} km`);
  return parts.length ? parts.join(" · ") : "Alle motoren";
}

function formatPrice(price) {
  return price ? `€${price.toLocaleString("nl-NL")}` : "—";
}

// ── Test email (voor admin panel) ─────────────────────────────────────────────
export async function sendTestEmail(to) {
  return sendEmail({
    to,
    subject: "✅ Motor.shop email test",
    html: `<div style="background:#080808;color:#fff;padding:20px;font-family:Arial">
      <div style="font-size:20px;font-weight:900">MOTOR<span style="color:#ff6b00">.SHOP</span></div>
      <p style="color:#aaa">Email configuratie werkt correct ✅</p>
      <p style="color:#555;font-size:12px">Verstuurd via: ${PROVIDER}</p>
    </div>`,
    text: "Motor.shop email test — configuratie werkt correct.",
  });
}
