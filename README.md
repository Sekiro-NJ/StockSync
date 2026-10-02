# StockSync — Real-Time FMCG Stock Tracking System

> A mobile-first web application that eliminates daily inventory drift between SAP and physical warehouse reality in FMCG distribution operations.

![Status](https://img.shields.io/badge/status-prototype-blue)
![No Dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 The Problem

Colgate-type distribution operations face **daily stock drift** between SAP records and physical reality. SAP reduces stock at billing, but physical movement happens later — creating 4 compounding gaps:

| Gap | What Happens | Impact |
|-----|-------------|--------|
| **Next-morning returns** | Items return same day, SAP entry next morning | 1-day lag every day |
| **Damaged goods** | Tracked in notebooks, SAP entries delayed/missed | Unsellable stock piles up |
| **Short deliveries** | SAP bills 10, delivers 8 — SAP still shows 10 sold | Phantom stock in SAP |
| **Cancelled/refused** | Shop closed, SAP reversal takes 1-2 days | SAP understated |

**Week over week, the drift widens** — eroding trust in SAP, blocking replenishment planning, and complicating audits.

## 💡 The Solution

A **three-state stock model** tracked in real-time on mobile at the point of movement:

```
┌──────────┐     loadOntoTruck()     ┌─────────────┐    recordDelivery()
│  GODOWN  │ ──────────────────────► │  IN-TRANSIT  │ ──────────────────► SOLD
│(warehouse)│                        │  (on truck)  │
└──────────┘ ◄───── resolveHold() ── └──────┬──────┘
                    (restock)               │ moveToHold()
                                            ▼
                                     ┌─────────────┐
                                     │    HOLD      │ ── resolveHold('write-off')
                                     │ (exception)  │ ── resolveHold('credit-note')
                                     └─────────────┘
```

Every state transition happens **instantly** on the worker's phone. No next-morning lag. No notebooks.

## 🖥️ Screens

| Screen | Purpose |
|--------|---------|
| **Dashboard** | Live stock overview, SVG charts, active trips, transaction feed |
| **Analytics** | 5-tab intelligence engine — KPIs, exception analysis, product scorecards, driver performance, shop insights |
| **Morning Loading** | Create trip, load products from godown onto truck |
| **Delivery** | Record deliveries, shorts, payments at each shop stop |
| **Returns & Hold** | Instant exception handling — the key innovation |
| **Reconciliation** | End-of-day SAP comparison, variance table, CSV export |

## 🏗️ Architecture & Engineering Decisions

### Service Layer Pattern
All data access goes through `DataService` — screens never touch storage directly. **Swap localStorage to a REST API by changing one file.**

### Event Sourcing
Every stock movement creates an immutable transaction record. The analytics engine mines this log to surface insights — this is the Event Sourcing payoff.

### Atomic State Transitions
Each business method (`loadOntoTruck`, `recordDelivery`, `moveToHold`) checks preconditions, then updates ALL affected states in a single operation. No partial updates.

### Zero Dependencies
No React, no Chart.js, no npm. Pure HTML/CSS/JS with ES6 modules. SVG-based charts for resolution-independent rendering. **Shows when frameworks are overkill.**

### SAP-Adjacent, Not SAP-Replacement
We don't replace SAP (that's a $50M project). We augment it with the missing physical-tracking layer and feed clean, reconciled data back at end-of-day.

## 📁 Project Structure

```
StockSync/
├── index.html              # App shell — sidebar nav, 6 page sections
├── index.css               # Design system — CSS custom properties, responsive, dark mode
├── app.js                  # Entry point — module init, routing, theme toggle
└── js/
    ├── dataService.js      # Core engine — business logic, stock transitions, audit trail
    ├── analytics.js        # Analytics engine — KPIs, exceptions, product/driver/shop insights
    ├── dashboard.js        # Dashboard screen
    ├── loading.js          # Morning loading screen
    ├── delivery.js         # On-route delivery screen
    ├── returns.js          # Returns & hold management screen
    ├── reconciliation.js   # End-of-day reconciliation screen
    ├── charts.js           # Zero-dependency SVG charting (donut + bar)
    ├── router.js           # Hash-based SPA router
    ├── seedData.js         # Realistic Colgate product catalog + Indian retail shops
    ├── demoScenario.js     # Pre-seeded demo: 3 trucks, 8 shops, realistic exceptions
    └── utils.js            # Formatters, ID generation, toast notifications
```

## 🚀 Quick Start

No build step. No npm install. Just open it.

```bash
# Option 1: Any static file server
npx serve .

# Option 2: Python
python -m http.server 3000

# Option 3: Just open index.html via a local server
```

Then visit `http://localhost:3000`

> **Note**: Must be served via HTTP (not `file://`) because ES6 modules require it.

## 🎮 Demo Walkthrough

The app comes pre-seeded with a realistic day of operations (3 trucks, 8 shop deliveries, returns, damages, shorts). Here's the recommended demo flow:

1. **Dashboard** → See live stock overview, charts, transaction feed
2. **Analytics** → Browse KPIs, exception analysis, product scorecards, driver performance
3. **Morning Loading** → Create a new trip, load products, dispatch
4. **Delivery** → Select trip, record deliveries with shorts
5. **Returns** → Process a return/damage — watch stock move to Hold **instantly**
6. **Reconciliation** → View variance table, sync to SAP, export CSV

Use **🔄 Reset Demo** to restore the original demo data at any time.

## 🛠️ Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Language** | Vanilla JavaScript (ES6+) | 6 CRUD screens don't need React. No build step = instant deployment |
| **Styling** | CSS Custom Properties | Design tokens, dark mode, responsive — no Tailwind/Bootstrap needed |
| **Charts** | SVG (hand-rolled) | Vector = crisp at any zoom. Canvas pixelates. Chart.js is 200KB overhead |
| **Storage** | localStorage | Demo-ready. Service layer makes API swap a single-file change |
| **Routing** | Hash-based SPA | Zero config, works on GitHub Pages, no server-side routing needed |

## 📄 License

MIT
