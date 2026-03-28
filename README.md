# 🏍 Motor.shop

**Nederlandse motormarkt aggregator** — scant meerdere verkoopplatformen tegelijk en analyseert elke advertentie op marktwaarde.

---

## Features

### 🔍 Marketplace Aggregator
Scant parallel: Marktplaats · 2dehands · AutoScout24 · eBay Motors · Facebook Marketplace · Motortreffer

### 📊 Waarde KPI Engine
Berekent marktwaarde op basis van 4 gestapelde factoren:

```
Marktwaarde = Catalogus × Basisafschrijving × Merkfactor × Typefactor × Versiefactor ± Km-correctie
```

| Factor | Bereik | Voorbeeld |
|---|---|---|
| Basisafschrijving | leeftijdscurve | jaar 1 = 80%, jaar 5 = 43% |
| Merkfactor | 0.78 – 1.12 | Harley ×0.78, Benelli ×1.12 |
| Typefactor | 0.82 – 1.12 | Cruiser ×0.82, Scooter ×1.12 |
| Versiefactor | 0.75 – 1.00 | LIMITED ×0.75, STD ×1.00 |
| Km-correctie | ±14% | hoog km = lager, laag km = hoger |

### 🚦 Waarde Score (0–100)
| Score | Label |
|---|---|
| 🔥 < 80% marktwaarde | ABSOLUTE KOOPJE |
| ✅ 80–92% | GOEDE DEAL |
| ⚖️ 92–108% | EERLIJKE PRIJS |
| ⚠️ 108–122% | AAN DE PRIJS |
| ❌ > 122% | OVERPRICED |

### 📡 RDW Live Integratie
Twee live endpoints van [opendata.rdw.nl](https://opendata.rdw.nl) (geen API-key):

| Endpoint | Data |
|---|---|
| `m9d7-ebf2` | Merk, model, kleur, cilinderinhoud, APK-datum, catalogusprijs |
| `sgfe-77wx` | APK keuringshistorie met km-stand per keuring |

### 🛡️ NAP Km-validatie
Analyseert APK-keuringshistorie op 4 punten:
- **Km-terugloop** tussen keuringen → ❌ direct onbetrouwbaar
- **Abnormaal hoog gebruik** (>21.600 km/jaar) → ⚠️ verdacht
- **Huidige km < laatste APK km** → ❌ mogelijke fraude
- **Grote sprong** na laatste APK → ⚠️ waarschuwing

### 🤖 AI Model Database Auto-Update
Via Anthropic Claude API — detecteert automatisch nieuwe motormodellen en voegt afschrijvingsfactoren toe aan de database.

---

## Tech Stack

- **Frontend**: React 18 + Vite
- **Data**: RDW opendata.rdw.nl (CORS ondersteund, geen auth)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Storage**: Browser persistent storage (cross-session database)

---

## Installatie

```bash
git clone https://github.com/jouw-username/motor.shop.git
cd motor.shop
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Roadmap

- [ ] Echte Marktplaats scraper (backend)
- [ ] Nachtelijke sync van advertenties (cron)
- [ ] Gebruikersaccounts + opgeslagen zoekopdrachten
- [ ] Email alerts bij nieuwe koopjes
- [ ] Prijsgeschiedenis per advertentie
- [ ] NAP.nl betaalde API integratie
- [ ] iOS / Android app

---

## RDW API Documentatie

- Voertuigdata: `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken={KENTEKEN}`
- APK historiek: `https://opendata.rdw.nl/resource/sgfe-77wx.json?kenteken={KENTEKEN}`
- Brandstof: `https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken={KENTEKEN}`

Kenteken format: zonder streepjes, hoofdletters. `KZ-123-B` → `KZ123B`

---

*Motor.shop is een prototype. Geen commerciële samenwerking met RDW, Marktplaats of andere genoemde platforms.*
