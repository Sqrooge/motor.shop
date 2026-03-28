// ══════════════════════════════════════════════════════════════════════════════
// BROWSER POOL — gedeelde Playwright instanties met stealth + UA-rotatie
// ══════════════════════════════════════════════════════════════════════════════
import { chromium } from "playwright";
import { logger }   from "./logger.js";

const UA_LIST = (process.env.UA_LIST || "").split(",").filter(Boolean).length
  ? (process.env.UA_LIST || "").split(",")
  : [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ];

let _browser = null;

export async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    logger.info("Browser starten...");
    _browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ],
    });
    logger.info("Browser gestart");
  }
  return _browser;
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
    logger.info("Browser gesloten");
  }
}

// Maak een nieuwe pagina met stealth-instellingen
export async function newPage(browser) {
  const ua      = UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
  const context = await browser.newContext({
    userAgent:         ua,
    viewport:          { width: 1366 + Math.floor(Math.random() * 200), height: 768 + Math.floor(Math.random() * 100) },
    locale:            "nl-NL",
    timezoneId:        "Europe/Amsterdam",
    geolocation:       { latitude: 52.37, longitude: 4.89 }, // Amsterdam
    permissions:       ["geolocation"],
    extraHTTPHeaders:  { "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8" },
    javaScriptEnabled: true,
  });

  const page = await context.newPage();

  // Verberg automatisering
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins",   { get: () => [1, 2, 3] });
    window.chrome = { runtime: {} };
  });

  return { page, context };
}

// Random delay om bot-detectie te ontwijken
export const delay = (min, max) => {
  const ms = min + Math.random() * (max - min);
  return new Promise(r => setTimeout(r, ms));
};

// Scroll naar beneden om lazy-loaded content te laden
export async function scrollToBottom(page, steps = 5) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
    await delay(300, 600);
  }
}
