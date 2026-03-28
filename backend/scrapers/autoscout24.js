// ══════════════════════════════════════════════════════════════════════════════
// AUTOSCOUT24 SCRAPER
// Gebruikt JSON-API response die AutoScout24 inlaadt via XHR
// ══════════════════════════════════════════════════════════════════════════════
import { BaseScraper }             from "./base.js";
import { delay, scrollToBottom }   from "../utils/browser.js";

export class AutoScout24Scraper extends BaseScraper {
  constructor() { super("AutoScout24"); }

  buildUrl(query, page) {
    // AutoScout24 heeft een aparte sectie voor motoren
    const params = new URLSearchParams({
      atype:   "B",   // B = motor
      damaged: "false",
      fregfrom: "2010",
      page,
    });
    if (query) params.set("search", query);
    return `https://www.autoscout24.nl/lst/motorfietsen?${params}`;
  }

  async parseListings(page) {
    await page.waitForSelector('[data-testid="listing-item"], .cldt-summary-full-item', { timeout: 12000 }).catch(() => {});
    await scrollToBottom(page, 4);

    return page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('[data-testid="listing-item"], article.cldt-summary-full-item');

      cards.forEach(card => {
        try {
          const titleEl  = card.querySelector('h2, .cldt-summary-makemodel, [data-testid="make-and-model"]');
          const priceEl  = card.querySelector('[data-testid="price"], .cldt-price');
          const locEl    = card.querySelector('[data-testid="dealer-address"], .cldt-seller-contact');
          const linkEl   = card.querySelector('a[href*="/motorfiets/"]');
          const imgEl    = card.querySelector('img');
          const kmEl     = card.querySelector('[data-testid="Mileage"], .cldt-summary-attributes li:first-child');
          const yearEl   = card.querySelector('[data-testid="FirstRegistration"], .cldt-summary-attributes li:nth-child(2)');

          if (!titleEl) return;

          const title = titleEl.textContent.trim();
          const words = title.split(/\s+/);

          items.push({
            brand:       words[0] || "",
            model:       title,
            year:        yearEl ? parseInt(yearEl.textContent) : null,
            price:       priceEl ? priceEl.textContent.replace(/[^\d]/g, "") : null,
            km:          kmEl    ? parseInt(kmEl.textContent.replace(/\D/g, "")) : null,
            location:    locEl   ? locEl.textContent.trim().slice(0, 100) : null,
            url:         linkEl  ? linkEl.href : null,
            source_id:   card.getAttribute("data-guid") || card.getAttribute("id") || null,
            images:      imgEl   ? [imgEl.src] : [],
            seller_type: card.querySelector('[data-testid="vendor-type"]')?.textContent.includes("Dealer") ? "dealer" : "particulier",
          });
        } catch {}
      });

      return items;
    });
  }
}
