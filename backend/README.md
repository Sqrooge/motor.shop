# Motor.shop — Backend Scraper

Node.js scraper backend met parallel platform-scanning, deduplicatie en RDW-integratie.

## Architectuur

```
backend/
├── server.js              ← Express API server
├── scrapers/
│   ├── base.js            ← BaseScraper (alle platforms erven hiervan)
│   ├── marktplaats.js     ← Marktplaats.nl scraper
│   ├── tweedehands.js     ← 2dehands.be scraper
│   ├── autoscout24.js     ← AutoScout24 scraper
│   └── others.js          ← eBay Motors · Facebook Marketplace · Motortreffer
├── jobs/
│   ├── scrapeAll.js       ← Parallel orchestrator (alle platforms tegelijk)
│   └── worker.js          ← Cron-job (elke 6 uur)
├── utils/
│   ├── database.js        ← SQLite schema + queries
│   ├── dedup.js           ← Deduplicatie engine
│   ├── browser.js         ← Playwright browser pool + stealth
│   └── logger.js          ← Winston logger
└── routes/
    └── api.js             ← REST API endpoints
```

## Installatie

```bash
cd backend
cp .env.example .env
npm install
npx playwright install chromium
npm run dev
```

## API Endpoints

| Method | Endpoint | Beschrijving |
|---|---|---|
| GET | `/api/listings` | Alle actieve listings (filters: brand, type, source, maxPrice, maxKm, query) |
| GET | `/api/listings/:id` | Één listing op ID |
| GET | `/api/stats` | Statistieken + per-platform status |
| POST | `/api/scrape` | Start handmatige scrape-run |
| GET | `/api/scrape/status` | Status actieve + recente runs |
| GET | `/api/platforms` | Status per platform |
| GET | `/api/kenteken/:kenteken` | Live RDW lookup + APK historiek |

## Deduplicatie — 3 lagen

### Laag 1: Kenteken exact match
Identiek kenteken op twee platforms → zeker hetzelfde voertuig. Bestaande listing krijgt cross-platform referentie.

### Laag 2: Hash match
`SHA256(brand + model + year + price + km)` → zelfde voertuig, zelfde prijs. Direct als duplicaat gemarkeerd.

### Laag 3: Fuzzy similarity
Gewogen Levenshtein-score over brand (15%) + model (40%) + year (15%) + price (20%) + km (10%).
Drempel instelbaar via `DEDUP_THRESHOLD` (standaard 0.82).

## Parallel scrapen

```
Platform 1 ──┐
Platform 2 ──┤
Platform 3 ──┼─→ Samenvoegen → Dedupliceren → RDW Enrichen → Database
Platform 4 ──┤
Platform 5 ──┤
Platform 6 ──┘
```

Max 3 gelijktijdige browsers (`SCRAPER_CONCURRENCY`). Elke scraper heeft eigen stealth-context, user-agent rotatie en random delays.

## Cron schedule

Standaard elke 6 uur: `0 */6 * * *`

```bash
# Handmatig starten
npm run scrape

# Worker starten (inclusief cron)
npm run worker
```

## Database

SQLite (`data/motorshop.db`) — geen externe DB nodig.
- `listings` — alle advertenties
- `scrape_runs` — historiek per run
- `platform_status` — status + timing per platform

## Anti-bot maatregelen

- Headless Chromium met stealth-flags
- User-agent rotatie (desktop Chrome NL)
- Random delays (800–2400ms)
- Viewport randomisatie
- Navigator.webdriver = undefined
- Nederlandse locale + Amsterdam geolocation
