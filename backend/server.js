// ══════════════════════════════════════════════════════════════════════════════
// MOTOR.SHOP BACKEND SERVER — met graceful shutdown + request logging
// ══════════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import express        from "express";
import cors           from "cors";
import helmet         from "helmet";
import compression    from "compression";
import rateLimit      from "express-rate-limit";
import { logger }     from "./utils/logger.js";
import cookieParser  from "cookie-parser";
import session       from "express-session";
import { initAuthSchema } from "./utils/auth.js";
import authRoutes, { passport } from "./routes/auth.js";
import adminRoutes             from "./routes/admin.js";
import { getDb }      from "./utils/database.js";
import apiRoutes      from "./routes/api.js";
import fs             from "fs";

fs.mkdirSync("./logs", { recursive: true });

const app  = express();
const PORT = parseInt(process.env.PORT || "3001");

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(cookieParser());
app.use(session({
  secret:            process.env.SESSION_SECRET || "dev-session-secret",
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === "production",
    maxAge:   7 * 24 * 3600 * 1000,
    sameSite: "lax",
  },
}));
app.use(passport.initialize());
app.use(express.json({ limit: "512kb" }));

// Request logging (compact)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms    = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "debug";
    logger[level](`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Rate limits
app.use("/api/scrape", rateLimit({ windowMs: 60_000, max: 5,   message: { ok: false, error: "Te veel scrape-verzoeken" } }));
app.use("/api",        rateLimit({ windowMs: 60_000, max: 300,  message: { ok: false, error: "Rate limit bereikt" } }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",  authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api",       apiRoutes);

app.get("/health", (req, res) => res.json({
  ok: true, version: "0.1.0", uptime: Math.round(process.uptime()),
  memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
  time: new Date().toISOString(),
}));

app.use((req, res) => res.status(404).json({ ok: false, error: "Niet gevonden" }));
app.use((err, req, res, next) => {
  logger.error("Unhandled", { error: err.message, stack: err.stack?.slice(0, 300) });
  res.status(500).json({ ok: false, error: "Interne serverfout" });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} ontvangen — server afsluiten...`);
  server.close(() => {
    logger.info("HTTP server gesloten");
    try { getDb().close(); logger.info("Database gesloten"); } catch {}
    process.exit(0);
  });
  // Force exit na 10s als niet netjes afgesloten
  setTimeout(() => { logger.error("Forceer exit na timeout"); process.exit(1); }, 10_000);
}

// ── Start ─────────────────────────────────────────────────────────────────────
const _db = getDb();
initAuthSchema(_db);
const server = app.listen(PORT, () => {
  logger.info(`Motor.shop backend → http://localhost:${PORT}`);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  err => { logger.error("Uncaught",  { error: err.message }); });
process.on("unhandledRejection", err => { logger.error("Unhandled", { error: String(err)   }); });

export default app;
