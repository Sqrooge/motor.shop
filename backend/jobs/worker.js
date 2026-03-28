// ══════════════════════════════════════════════════════════════════════════════
// CRON WORKER — nachtelijke/periodieke scrape-runs
// Draai met: node jobs/worker.js
// ══════════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import cron        from "node-cron";
import { runScrapeAll } from "./scrapeAll.js";
import { logger }  from "../utils/logger.js";

const SCHEDULE = process.env.CRON_SCHEDULE || "0 3,7,11,15,19,23 * * *"; // 03:00 · 07:00 · 11:00 · 15:00 · 19:00 · 23:00

logger.info(`Cron worker gestart. Schema: ${SCHEDULE}`);
logger.info(`Volgende run: ${getNextRun(SCHEDULE)}`);

// Directe eerste run bij opstarten
runFirstRun();

// Periodieke runs
cron.schedule(SCHEDULE, async () => {
  logger.info("⏰ Geplande scrape-run gestart");
  try {
    const result = await runScrapeAll();
    logger.info("✅ Geplande scrape-run klaar", result);
  } catch (err) {
    logger.error("❌ Geplande scrape-run mislukt", { error: err.message });
  }
});

async function runFirstRun() {
  // Kleine vertraging zodat server klaar is
  await new Promise(r => setTimeout(r, 3000));
  logger.info("🚀 Eerste scrape-run bij opstarten...");
  try {
    const result = await runScrapeAll();
    logger.info("✅ Eerste run klaar", result);
  } catch (err) {
    logger.error("❌ Eerste run mislukt", { error: err.message });
  }
}

function getNextRun(schedule) {
  // Simpele berekening — in productie gebruik cronstrue
  const parts = schedule.split(" ");
  const interval = parts[1].replace("*/", "");
  const next = new Date();
  next.setHours(next.getHours() + parseInt(interval));
  return next.toLocaleString("nl-NL");
}

// Graceful shutdown
process.on("SIGTERM", () => { logger.info("Worker gestopt"); process.exit(0); });
process.on("SIGINT",  () => { logger.info("Worker gestopt"); process.exit(0); });
