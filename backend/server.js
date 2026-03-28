// ══════════════════════════════════════════════════════════════════════════════
// MOTOR.SHOP BACKEND SERVER
// ══════════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import express        from "express";
import cors           from "cors";
import helmet         from "helmet";
import compression    from "compression";
import rateLimit      from "express-rate-limit";
import { logger }     from "./utils/logger.js";
import { getDb }      from "./utils/database.js";
import apiRoutes      from "./routes/api.js";
import fs             from "fs";

// Zorg voor logs-map
fs.mkdirSync("./logs", { recursive: true });

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

// Rate limiting
app.use("/api/scrape", rateLimit({ windowMs: 60 * 1000, max: 5,  message: "Te veel scrape-verzoeken" }));
app.use("/api",        rateLimit({ windowMs: 60 * 1000, max: 300, message: "Rate limit bereikt" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", apiRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, version: "0.1.0", time: new Date().toISOString() });
});

// 404
app.use((req, res) => res.status(404).json({ ok: false, error: "Niet gevonden" }));

// Error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message });
  res.status(500).json({ ok: false, error: "Interne serverfout" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  // Initialiseer DB
  getDb();
  logger.info(`Motor.shop backend draait op http://localhost:${PORT}`);
  logger.info(`API: http://localhost:${PORT}/api/listings`);
  logger.info(`Health: http://localhost:${PORT}/health`);
});

export default app;
