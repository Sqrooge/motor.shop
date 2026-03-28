// ══════════════════════════════════════════════════════════════════════════════
// 2DEHANDS SCRAPER (BE/NL)
// URL: https://www.2dehands.be/motoren/
// ══════════════════════════════════════════════════════════════════════════════
import { BaseScraper } from "./base.js";

export class TweedehandsScraper extends BaseScraper {
  constructor() { super("2dehands"); }

  buildUrl(query, page) {
    const params = new URLSearchParams({
      q:       query || "motor",
      page:    page,
    });
    return `https://www.2dehands.be/q/${encodeURIComponent(query || "motor")}/#Language:all-languages|Categories:motorvoertuigen-en-brommers,motoren|currentPage:${page - 1}`;
  }

  async parseListings(page) {
    await page.waitForSelector('.listing-search-product-tile, article', { timeout: 10000 }).catch(() => {});

    return page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('.listing-search-product-tile, article.treffer');

      cards.forEach(card => {
        try {
          const titleEl = card.querySelector('h3, .title, .product-title');
          const priceEl = card.querySelector('.price, .listing-price');
          const locEl   = card.querySelector('.location, .city');
          const linkEl  = card.querySelector('a[href]');
          const imgEl   = card.querySelector('img');

          if (!titleEl) return;

          const title  = titleEl.textContent.trim();
          const words  = title.split(/\s+/);

          // Attributen uit de kaart parsen
          let year = null, km = null;
          card.querySelectorAll('.attribute, .spec, li').forEach(el => {
            const txt = el.textContent.trim();
            if (/^\d{4}$/.test(txt))        year = parseInt(txt);
            if (/\d+\s*(km|KM)/.test(txt))  km   = parseInt(txt.replace(/\D/g, ""));
          });

          items.push({
            brand:     words[0] || "",
            model:     title,
            year,
            price:     priceEl ? priceEl.textContent.replace(/[^\d]/g, "") : null,
            km,
            location:  locEl  ? locEl.textContent.trim() : null,
            url:       linkEl ? linkEl.href              : null,
            source_id: card.getAttribute("data-id")      || card.getAttribute("id") || null,
            images:    imgEl  ? [imgEl.src]               : [],
          });
        } catch {}
      });

      return items;
    });
  }
}
