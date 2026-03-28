// ══════════════════════════════════════════════════════════════════════════════
// MARKTPLAATS SCRAPER
// URL: https://www.marktplaats.nl/l/motoren/
// ══════════════════════════════════════════════════════════════════════════════
import { BaseScraper } from "./base.js";

export class MarktplaatsScraper extends BaseScraper {
  constructor() { super("Marktplaats"); }

  buildUrl(query, page) {
    const base   = "https://www.marktplaats.nl/l/motoren/";
    const params = new URLSearchParams({
      query:           query || "",
      categoryId:      "motorvoertuigen-en-brommers:motoren",
      currentPage:     page - 1,
      numberOfResultsPerPage: 30,
    });
    return `${base}?${params}`;
  }

  async parseListings(page) {
    await page.waitForSelector('[data-item-id], .mp-Listing, article', { timeout: 10000 }).catch(() => {});

    return page.evaluate(() => {
      const items = [];
      // Marktplaats gebruikt data-item-id of article-elementen
      const cards = document.querySelectorAll('[data-item-id], article.mp-Listing');

      cards.forEach(card => {
        try {
          const titleEl  = card.querySelector('h3, .mp-Listing-title, [data-testid="title"]');
          const priceEl  = card.querySelector('.mp-Listing-price, [data-testid="price-label"]');
          const locEl    = card.querySelector('.mp-Listing-location, [data-testid="location-label"]');
          const linkEl   = card.querySelector('a[href]');
          const imgEl    = card.querySelector('img');
          const descEl   = card.querySelector('.mp-Listing-description');
          const attrEls  = card.querySelectorAll('.mp-Listing-attribute, [data-testid="attribute"]');

          if (!titleEl) return;

          // Parseer attributen (bouwjaar, km-stand, etc.)
          let year = null, km = null;
          attrEls.forEach(el => {
            const txt = el.textContent.trim();
            if (/^\d{4}$/.test(txt))           year = parseInt(txt);
            if (/\d+\s*(km|KM)/.test(txt))     km   = parseInt(txt.replace(/\D/g, ""));
          });

          const price = priceEl ? priceEl.textContent.replace(/[^\d]/g, "") : null;
          const title = titleEl.textContent.trim();

          // Extraheer merk uit titel (eerste woord veelal)
          const words = title.split(/\s+/);
          const brand = words[0] || "";
          const model = words.slice(1).join(" ");

          items.push({
            brand,
            model:      title, // volledig als fallback
            year,
            price,
            km,
            location:   locEl  ? locEl.textContent.trim()        : null,
            url:        linkEl ? "https://www.marktplaats.nl" + linkEl.getAttribute("href") : null,
            source_id:  card.getAttribute("data-item-id") || null,
            images:     imgEl  ? [imgEl.src]                      : [],
            description:descEl ? descEl.textContent.trim().slice(0, 500) : null,
          });
        } catch {}
      });

      return items;
    });
  }

  async hasNextPage(page) {
    return page.evaluate(() => !!document.querySelector('.mp-Pagination-item--next:not(.mp-Pagination-item--disabled), [aria-label="Volgende pagina"]'));
  }
}
