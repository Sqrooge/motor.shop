// ══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES — Google · Microsoft · Apple OAuth via Passport.js
// ══════════════════════════════════════════════════════════════════════════════
import { Router }                          from "express";
import passport                            from "passport";
import { Strategy as GoogleStrategy }      from "passport-google-oauth20";
import { OIDCStrategy as MicrosoftStrategy } from "passport-microsoft";
import AppleStrategy                       from "passport-apple";
import { signToken, verifyToken, requireAuth, userDb } from "../utils/auth.js";
import { logger }                          from "../utils/logger.js";
import { v4 as uuid }                     from "uuid";

const router      = Router();
const FRONTEND    = process.env.FRONTEND_URL        || "http://localhost:3000";
const CB_BASE     = process.env.AUTH_CALLBACK_BASE  || "http://localhost:3001";

// ── Passport strategieën ──────────────────────────────────────────────────────

// GOOGLE
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${CB_BASE}/api/auth/google/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const user = userDb.upsertUser({
          provider:    "google",
          provider_id: profile.id,
          email:       profile.emails?.[0]?.value,
          name:        profile.displayName,
          avatar_url:  profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (e) { done(e); }
    }
  ));
}

// MICROSOFT
if (process.env.MICROSOFT_CLIENT_ID) {
  passport.use(new MicrosoftStrategy(
    {
      clientID:     process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL:  `${CB_BASE}/api/auth/microsoft/callback`,
      scope:        ["user.read"],
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const user = userDb.upsertUser({
          provider:    "microsoft",
          provider_id: profile.id,
          email:       profile.emails?.[0]?.value || profile._json?.mail,
          name:        profile.displayName,
          avatar_url:  null,
        });
        done(null, user);
      } catch (e) { done(e); }
    }
  ));
}

// APPLE
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_PRIVATE_KEY) {
  passport.use(new AppleStrategy(
    {
      clientID:    process.env.APPLE_CLIENT_ID,
      teamID:      process.env.APPLE_TEAM_ID,
      keyID:       process.env.APPLE_KEY_ID,
      privateKey:  process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      callbackURL: `${CB_BASE}/api/auth/apple/callback`,
      scope:       ["name", "email"],
    },
    (accessToken, refreshToken, idToken, profile, done) => {
      try {
        const user = userDb.upsertUser({
          provider:    "apple",
          provider_id: profile.id || idToken?.sub,
          email:       profile.email || idToken?.email,
          name:        profile.name
            ? `${profile.name.firstName || ""} ${profile.name.lastName || ""}`.trim()
            : null,
          avatar_url:  null,
        });
        done(null, user);
      } catch (e) { done(e); }
    }
  ));
}

passport.serializeUser((user, done) => done(null, user?.id));
passport.deserializeUser((id, done) => done(null, userDb.findById(id)));

// ── OAuth routes — elke provider ──────────────────────────────────────────────

// GOOGLE
router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);
router.get("/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${FRONTEND}?auth=error` }),
  oauthSuccess
);

// MICROSOFT
router.get("/microsoft",
  passport.authenticate("microsoft", { session: false })
);
router.get("/microsoft/callback",
  passport.authenticate("microsoft", { session: false, failureRedirect: `${FRONTEND}?auth=error` }),
  oauthSuccess
);

// APPLE (POST callback vereist door Apple)
router.post("/apple/callback",
  passport.authenticate("apple", { session: false, failureRedirect: `${FRONTEND}?auth=error` }),
  oauthSuccess
);
router.get("/apple",
  passport.authenticate("apple", { session: false })
);

function oauthSuccess(req, res) {
  const token = signToken(req.user);
  // Stuur token via cookie + redirect naar frontend met success flag
  res.cookie("ms_token", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   7 * 24 * 3600 * 1000, // 7 dagen
  });
  logger.info(`Login: ${req.user.name} via ${req.user.provider}`);
  res.redirect(`${FRONTEND}?auth=success&name=${encodeURIComponent(req.user.name || "")}`);
}

// ── /api/auth/me — huidige gebruiker ─────────────────────────────────────────
router.get("/me", (req, res) => {
  const token = req.cookies?.ms_token || req.headers.authorization?.slice(7);
  const user  = token ? verifyToken(token) : null;
  if (!user) return res.json({ ok: true, user: null });
  res.json({ ok: true, user });
});

// ── /api/auth/logout ──────────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie("ms_token");
  res.json({ ok: true });
});

// ── Welke providers zijn geconfigureerd? (voor frontend knoppen) ─────────────
router.get("/providers", (req, res) => {
  res.json({
    ok: true,
    providers: {
      google:    !!process.env.GOOGLE_CLIENT_ID,
      microsoft: !!process.env.MICROSOFT_CLIENT_ID,
      apple:     !!process.env.APPLE_CLIENT_ID,
    },
  });
});

// ── Favorieten ────────────────────────────────────────────────────────────────
router.get("/favorites", requireAuth, (req, res) => {
  try {
    const favs = userDb.getFavorites(req.user.id);
    res.json({ ok: true, favorites: favs });
  } catch (e) { res.status(500).json({ ok: false, error: "Serverfout" }); }
});

router.post("/favorites/:listingId", requireAuth, (req, res) => {
  try {
    userDb.addFavorite(req.user.id, req.params.listingId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: "Serverfout" }); }
});

router.delete("/favorites/:listingId", requireAuth, (req, res) => {
  try {
    userDb.removeFavorite(req.user.id, req.params.listingId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: "Serverfout" }); }
});

// ── Alerts ────────────────────────────────────────────────────────────────────
router.get("/alerts", requireAuth, (req, res) => {
  try {
    res.json({ ok: true, alerts: userDb.getAlerts(req.user.id) });
  } catch (e) { res.status(500).json({ ok: false, error: "Serverfout" }); }
});

router.post("/alerts", requireAuth, (req, res) => {
  try {
    const id = userDb.addAlert(req.user.id, req.body);
    res.json({ ok: true, alertId: id });
  } catch (e) { res.status(500).json({ ok: false, error: "Serverfout" }); }
});

router.delete("/alerts/:alertId", requireAuth, (req, res) => {
  try {
    userDb.deleteAlert(req.params.alertId, req.user.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: "Serverfout" }); }
});

export { passport };
export default router;
