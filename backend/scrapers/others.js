// ══════════════════════════════════════════════════════════════════════════════
// EBAY MOTORS SCRAPER
// ══════════════════════════════════════════════════════════════════════════════
import { BaseScraper }           from "./base.js";
import { delay, scrollToBottom } from "../utils/browser.js";

export class EbayScraper extends BaseScraper {
  constructor() { super("eBay Motors"); }

  buildUrl(query, page) {
    const params = new URLSearchParams({
      _nkw:      query || "motor motorfiets",
      _sacat:    "6000", // eBay categorie: Motorcycles
      _pgn:      page,
      LH_ItemCondition: "3000", // Gebruikt
      _localstickydomain: "nl",
    });
    return `https://www.ebay.com/sch/i.html?${params}`;
  }

  async parseListings(page) {
    await page.waitForSelector('.s-item', { timeout: 12000 }).catch(() => {});

    return page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.s-item:not(.s-item--placeholder)').forEach(card => {
        try {
          const titleEl  = card.querySelector('.s-item__title');
          const priceEl  = card.querySelector('.s-item__price');
          const locEl    = card.querySelector('.s-item__location');
          const linkEl   = card.querySelector('a.s-item__link');
          const imgEl    = card.querySelector('img');

          if (!titleEl || titleEl.textContent.includes("Shop on eBay")) return;

          const title = titleEl.textContent.trim();
          const words = title.split(/\s+/);

          // eBay heeft geen aparte km/jaar in het overzicht → parse uit titel
          const yearMatch = title.match(/\b(19|20)\d{2}\b/);
          const kmMatch   = title.match(/(\d[\d.]+)\s*km/i);

          items.push({
            brand:    words[0] || "",
            model:    title,
            year:     yearMatch ? parseInt(yearMatch[0]) : null,
            price:    priceEl  ? priceEl.textContent.replace(/[^\d]/g, "").slice(0, 8) : null,
            km:       kmMatch  ? parseInt(kmMatch[1].replace(/\./g, "")) : null,
            location: locEl    ? locEl.textContent.replace("van ", "").trim() : null,
            url:      linkEl   ? linkEl.href   : null,
            source_id:card.getAttribute("id")  || null,
            images:   imgEl    ? [imgEl.src]   : [],
          });
        } catch {}
      });
      return items;
    });
  }

  async hasNextPage(page) {
    return page.evaluate(() => !!document.querySelector('.pagination__next:not([aria-disabled="true"])'));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FACEBOOK MARKETPLACE SCRAPER
// NB: Facebook vereist login voor volledige resultaten.
// Strategie: scrape de publieke preview + gebruik cookies indien beschikbaar.
// In productie: gebruik Apify/ScraperAPI als proxy.
// ══════════════════════════════════════════════════════════════════════════════
export class FacebookScraper extends BaseScraper {
  constructor() { super("Facebook Marketplace"); }

  buildUrl(query, page) {
    // Facebook Marketplace motor-categorie NL
    return `https://www.facebook.com/marketplace/amsterdam/motorcycles?query=${encodeURIComponent(query || "motor")}`;
  }

  async parseListings(page) {
    // Wacht op marketplace items
    await page.waitForSelector('[data-testid="marketplace_feed_item"], .x3ct3a4', { timeout: 15000 }).catch(() => {});
    await scrollToBottom(page, 5);

    return page.evaluate(() => {
      const items = [];
      // Facebook lazy-loaded grid — zoek naar listing-containers
      const cards = document.querySelectorAll('[data-testid="marketplace_feed_item"], [role="listitem"]');

      cards.forEach(card => {
        try {
          const titleEl = card.querySelector('span[style*="font-weight"], .x1lliihq');
          const priceEl = card.querySelector('span[class*="price"], .x193iq5w');
          const locEl   = card.querySelector('span[class*="location"], .x1i10hfl ~ span');
          const linkEl  = card.querySelector('a[href*="/marketplace/item/"]');
          const imgEl   = card.querySelector('img');

          if (!titleEl) return;

          const title  = titleEl.textContent.trim();
          const price  = priceEl ? priceEl.textContent.replace(/[^\d]/g, "") : null;
          const words  = title.split(/\s+/);
          const yearM  = title.match(/\b(19|20)\d{2}\b/);

          if (!title || title.length < 3) return;

          items.push({
            brand:    words[0] || "",
            model:    title,
            year:     yearM ? parseInt(yearM[0]) : null,
            price,
            km:       null, // niet zichtbaar in grid
            location: locEl   ? locEl.textContent.trim() : "Nederland",
            url:      linkEl  ? "https://www.facebook.com" + linkEl.getAttribute("href") : null,
            source_id:linkEl  ? linkEl.href.match(/\/item\/(\d+)/)?.[1] : null,
            images:   imgEl   ? [imgEl.src] : [],
          });
        } catch {}
      });

      return items;
    });
  }

  // Facebook heeft geen traditionele paginering in Marketplace
  async hasNextPage() { return false; }
}

// ══════════════════════════════════════════════════════════════════════════════
// MOTORTREFFER SCRAPER
// URL: https://www.motortreffer.nl/aanbod/
// ══════════════════════════════════════════════════════════════════════════════
export class MotortrefferScraper extends BaseScraper {
  constructor() { super("Motortreffer"); }

  buildUrl(query, page) {
    const params = new URLSearchParams({
      zoekterm: query || "",
      pagina:   page,
    });
    return `https://www.motortreffer.nl/aanbod/?${params}`;
  }

  async parseListings(page) {
    await page.waitForSelector('.motor-card, .aanbod-item, article', { timeout: 10000 }).catch(() => {});

    return page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('.motor-card, .aanbod-item, .listing-item, article');

      cards.forEach(card => {
        try {
          const titleEl = card.querySelector('h2, h3, .title, .motor-naam');
          const priceEl = card.querySelector('.price, .prijs, [class*="price"]');
          const kmEl    = card.querySelector('[class*="km"], [class*="kilometer"]');
          const yearEl  = card.querySelector('[class*="year"], [class*="jaar"], [class*="bouwjaar"]');
          const locEl   = card.querySelector('[class*="location"], [class*="stad"], [class*="plaats"]');
          const linkEl  = card.querySelector('a[href]');
          const imgEl   = card.querySelector('img');

          if (!titleEl) return;

          const title = titleEl.textContent.trim();
          const words = title.split(/\s+/);

          // Kenteken proberen te extraheren
          const kenMatch = card.textContent.match(/\b[A-Z]{2}-?\d{3}-?[A-Z]{1,2}\b|\b\d{1,3}-[A-Z]{2,3}-\d{1,3}\b/);

          items.push({
            brand:    words[0] || "",
            model:    title,
            year:     yearEl ? parseInt(yearEl.textContent) : null,
            price:    priceEl ? priceEl.textContent.replace(/[^\d]/g, "") : null,
            km:       kmEl    ? parseInt(kmEl.textContent.replace(/\D/g, "")) : null,
            location: locEl   ? locEl.textContent.trim() : null,
            url:      linkEl  ? linkEl.href : null,
            images:   imgEl   ? [imgEl.src] : [],
            kenteken: kenMatch ? kenMatch[0] : null,
          });
        } catch {}
      });

      return items;
    });
  }

  async hasNextPage(page) {
    return page.evaluate(() => !!document.querySelector('.next-page, [rel="next"], .pagination .next:not(.disabled)'));
  }
}
