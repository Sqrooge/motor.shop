// ══════════════════════════════════════════════════════════════════════════════
// BASE SCRAPER — alle platform-scrapers erven hiervan
// ══════════════════════════════════════════════════════════════════════════════
import { v4 as uuid }       from "uuid";
import { newPage, delay, scrollToBottom } from "../utils/browser.js";
import { makeHash, normKen }              from "../utils/dedup.js";
import { logger }                         from "../utils/logger.js";

const DELAY_MIN = parseInt(process.env.SCRAPER_DELAY_MIN || "800");
const DELAY_MAX = parseInt(process.env.SCRAPER_DELAY_MAX || "2400");
const MAX_PAGES = parseInt(process.env.SCRAPER_MAX_PAGES || "5");

export class BaseScraper {
  constructor(name) {
    this.name     = name;
    this.maxPages = MAX_PAGES;
    this.results  = [];
    this.errors   = [];
  }

  // ── Overriden per platform ───────────────────────────────────────────────
  buildUrl(query, page) { throw new Error("buildUrl() niet geïmplementeerd"); }
  async parseListings(page) { throw new Error("parseListings() niet geïmplementeerd"); }

  // ── Hoofd scrape-methode ─────────────────────────────────────────────────
  async scrape(browser, searchQuery = "") {
    const start = Date.now();
    logger.info(`[${this.name}] Scrapen gestart`, { query: searchQuery });
    this.results = [];
    this.errors  = [];

    for (let pageNum = 1; pageNum <= this.maxPages; pageNum++) {
      let ctx;
      try {
        const { page, context } = await newPage(browser);
        ctx = context;

        const url = this.buildUrl(searchQuery, pageNum);
        logger.debug(`[${this.name}] Pagina ${pageNum}: ${url}`);

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await scrollToBottom(page, 3);
        await delay(DELAY_MIN, DELAY_MAX);

        const items = await this.parseListings(page);

        if (!items || items.length === 0) {
          logger.info(`[${this.name}] Pagina ${pageNum}: geen items, stoppen`);
          break;
        }

        // Normaliseer + enricheer elk item
        const normalized = items.map(item => this.normalize(item));
        this.results.push(...normalized);
        logger.info(`[${this.name}] Pagina ${pageNum}: ${items.length} items`);

        // Controleer of er meer pagina's zijn
        const hasNext = await this.hasNextPage(page);
        if (!hasNext) break;

        await delay(DELAY_MIN * 1.5, DELAY_MAX * 1.5);
      } catch (err) {
        logger.error(`[${this.name}] Fout pagina ${pageNum}: ${err.message}`);
        this.errors.push({ page: pageNum, error: err.message });
        break;
      } finally {
        if (ctx) await ctx.close().catch(() => {});
      }
    }

    const ms = Date.now() - start;
    logger.info(`[${this.name}] Klaar: ${this.results.length} resultaten in ${ms}ms`);
    return { results: this.results, errors: this.errors, ms };
  }

  // Override als platform geen standaard "volgende pagina" heeft
  async hasNextPage(page) { return true; }

  // ── Normaliseer ruwe scrape-data naar ons schema ─────────────────────────
  normalize(raw) {
    const now = new Date().toISOString();
    const ken = normKen(raw.kenteken || "");

    const listing = {
      id:           uuid(),
      brand:        this.cleanBrand(raw.brand  || ""),
      model:        this.cleanStr(raw.model    || ""),
      model_key:    raw.model_key || null,
      year:         parseInt(raw.year)  || null,
      price:        parseInt(String(raw.price || "").replace(/\D/g, "")) || null,
      km:           parseInt(String(raw.km    || "").replace(/\D/g, "")) || null,
      type:         raw.type        || null,
      location:     raw.location    || null,
      source:       this.name,
      source_url:   raw.url         || null,
      source_id:    raw.source_id   || null,
      description:  raw.description || null,
      images:       JSON.stringify(raw.images || []),
      seller_name:  raw.seller_name || null,
      seller_type:  raw.seller_type || "particulier",
      kenteken:     ken || null,
      catalogus:    null,
      fair_value:   null,
      score_label:  null,
      score_color:  null,
      nap_status:   "ONBEKEND",
      nap_score:    null,
      rdw_data:     null,
      apk_history:  null,
      first_seen:   now,
      last_seen:    now,
      last_updated: now,
      active:       1,
    };

    listing.hash = makeHash(listing);
    return listing;
  }

  cleanStr(s) { return String(s).trim().replace(/\s+/g, " "); }
  cleanBrand(s) {
    const map = { "bmw":"BMW","ducati":"Ducati","harley":"Harley-Davidson","kawasaki":"Kawasaki","yamaha":"Yamaha","honda":"Honda","ktm":"KTM","suzuki":"Suzuki","triumph":"Triumph","aprilia":"Aprilia" };
    const lower = s.toLowerCase().trim();
    return map[lower] || s.charAt(0).toUpperCase() + s.slice(1);
  }
}
