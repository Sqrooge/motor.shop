// ══════════════════════════════════════════════════════════════════════════════
// BASE SCRAPER — retry logica + circuit breaker + betere normalisatie
// ══════════════════════════════════════════════════════════════════════════════
import { v4 as uuid }                    from "uuid";
import { newPage, delay, scrollToBottom } from "../utils/browser.js";
import { makeHash, normKen }              from "../utils/dedup.js";
import { logger }                         from "../utils/logger.js";

const DELAY_MIN = parseInt(process.env.SCRAPER_DELAY_MIN || "800");
const DELAY_MAX = parseInt(process.env.SCRAPER_DELAY_MAX || "2400");
const MAX_PAGES = parseInt(process.env.SCRAPER_MAX_PAGES || "5");
const MAX_RETRIES = 2;

// Circuit breaker: platform wordt overgeslagen na 3 opeenvolgende mislukkingen
const failStreaks = new Map();
const CIRCUIT_OPEN_AFTER = 3;

export class BaseScraper {
  constructor(name) {
    this.name     = name;
    this.maxPages = MAX_PAGES;
  }

  buildUrl(query, page)   { throw new Error(`${this.name}: buildUrl() niet geïmplementeerd`); }
  async parseListings(pg) { throw new Error(`${this.name}: parseListings() niet geïmplementeerd`); }
  async hasNextPage(pg)   { return false; }

  // ── Circuit breaker ────────────────────────────────────────────────────────
  isCircuitOpen() {
    return (failStreaks.get(this.name) || 0) >= CIRCUIT_OPEN_AFTER;
  }
  recordSuccess() { failStreaks.set(this.name, 0); }
  recordFailure() { failStreaks.set(this.name, (failStreaks.get(this.name) || 0) + 1); }

  // ── Hoofd scrape methode met retry ────────────────────────────────────────
  async scrape(browser, searchQuery = "") {
    if (this.isCircuitOpen()) {
      logger.warn(`[${this.name}] Circuit open (${failStreaks.get(this.name)} fouten op rij) — overgeslagen`);
      return { results: [], errors: [`Circuit open na ${CIRCUIT_OPEN_AFTER} fouten`], ms: 0 };
    }

    const start   = Date.now();
    const results = [];
    const errors  = [];

    for (let pageNum = 1; pageNum <= this.maxPages; pageNum++) {
      let items = null;

      // Retry loop per pagina
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let ctx;
        try {
          const { page, context } = await newPage(browser);
          ctx = context;
          const url = this.buildUrl(searchQuery, pageNum);

          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await scrollToBottom(page, 3);
          await delay(DELAY_MIN, DELAY_MAX);

          items = await this.parseListings(page);
          const hasNext = items?.length ? await this.hasNextPage(page) : false;

          await ctx.close().catch(() => {});
          ctx = null;

          if (!items?.length) {
            logger.debug(`[${this.name}] p${pageNum}: geen items`);
            pageNum = this.maxPages + 1; // stop paginering
            break;
          }

          results.push(...items.map(i => this.normalize(i)));
          logger.debug(`[${this.name}] p${pageNum} poging ${attempt}: ${items.length} items`);

          if (!hasNext) pageNum = this.maxPages + 1;
          break; // succes — geen retry nodig

        } catch (err) {
          await ctx?.close().catch(() => {});
          if (attempt === MAX_RETRIES) {
            logger.warn(`[${this.name}] p${pageNum} mislukt na ${MAX_RETRIES} pogingen: ${err.message}`);
            errors.push({ page: pageNum, error: err.message });
            pageNum = this.maxPages + 1; // stop bij aanhoudende fout
          } else {
            logger.debug(`[${this.name}] p${pageNum} poging ${attempt} fout, retry...`);
            await delay(DELAY_MAX, DELAY_MAX * 2);
          }
        }
      }

      await delay(DELAY_MIN / 2, DELAY_MAX / 2); // tussenpauze pagina's
    }

    const ms = Date.now() - start;
    if (errors.length && !results.length) {
      this.recordFailure();
    } else {
      this.recordSuccess();
    }

    logger.info(`[${this.name}] ${results.length} listings in ${ms}ms (${errors.length} fouten)`);
    return { results, errors, ms };
  }

  normalize(raw) {
    const now     = new Date().toISOString();
    const rawKen  = raw.kenteken || this.extractKenteken(raw.description || "");
    const ken     = normKen(rawKen);
    const price   = this.parseNumber(raw.price);
    const km      = this.parseNumber(raw.km);
    const year    = parseInt(raw.year) || null;

    const listing = {
      id:           uuid(),
      brand:        this.normalizeBrand(raw.brand || ""),
      model:        this.cleanStr(raw.model || raw.title || ""),
      model_key:    raw.model_key || null,
      year,
      price,
      km,
      type:         raw.type || null,
      location:     raw.location ? this.cleanStr(raw.location).slice(0, 100) : null,
      source:       this.name,
      source_url:   raw.url || null,
      source_id:    raw.source_id ? String(raw.source_id) : null,
      description:  raw.description ? raw.description.slice(0, 800) : null,
      images:       JSON.stringify(Array.isArray(raw.images) ? raw.images.slice(0, 5) : []),
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

  // ── Hulpfuncties ──────────────────────────────────────────────────────────
  cleanStr(s) {
    return String(s || "").trim().replace(/\s+/g, " ");
  }

  parseNumber(val) {
    if (!val) return null;
    const n = parseInt(String(val).replace(/[^\d]/g, ""));
    return isNaN(n) || n <= 0 ? null : n;
  }

  // Kenteken pattern in tekst (NL/BE formaten)
  extractKenteken(text) {
    const match = text.match(
      /\b([A-Z]{2}-?\d{3}-?[A-Z]{1,2}|[A-Z]{1,2}-?\d{3}-?[A-Z]{2}|\d{2}-?[A-Z]{3}-?\d{1}|\d{3}-?[A-Z]{2}-?\d{1})\b/
    );
    return match ? match[0] : null;
  }

  normalizeBrand(s) {
    const map = {
      "bmw":"BMW","ducati":"Ducati","harley":"Harley-Davidson",
      "harley-davidson":"Harley-Davidson","kawasaki":"Kawasaki",
      "yamaha":"Yamaha","honda":"Honda","ktm":"KTM","suzuki":"Suzuki",
      "triumph":"Triumph","aprilia":"Aprilia","royal enfield":"Royal Enfield",
      "moto guzzi":"Moto Guzzi","mv agusta":"MV Agusta","benelli":"Benelli",
    };
    const lower = s.toLowerCase().trim();
    return map[lower] || (s.charAt(0).toUpperCase() + s.slice(1));
  }
}
