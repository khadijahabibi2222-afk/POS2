# SwiftPOS — Self-hosted Web POS

Full-featured Point-of-Sale system with:
- **POS / Sales** (retail + wholesale modes)
- **Items** with barcode + measurement units
- **Purchase Orders** with supplier management and stock receiving
- **Expenses** module with categories, recurring flag, budget tracking
- **Finance** ledger (auto-logs from all modules)
- **Customers** with loyalty points and credit balance
- **Dashboard** with live stats
- **Settings** — store info, tax/currency, users (PIN login), roles/permissions, partner dividends, backup/restore, reset
- **Trilingual** — English / فارسی / پښتو with full RTL switching

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (single file) |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| Icons | Tabler Icons (CDN) |
| Fonts | Vazirmatn (Google Fonts CDN, for RTL) |

---

## Default PINs (change after first login)

| Role | PIN |
|------|-----|
| Owner (Ahmad Karimi) | `1234` |
| Admin (Sara Nazari) | `1111` |
| Cashier (Karim Yusuf) | `0000` |
| Viewer (Layla Hassan) | `9999` |

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start
# → http://localhost:3000
```

The database file is created automatically at `data/swiftpos.db` on first run and seeded with demo data.

---

## Deploy to Render (free tier)

1. Push this folder to a **GitHub repo**

2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo

3. Render auto-detects `render.yaml` — click **Deploy**

4. In the Render dashboard, go to **Disks** → the `swiftpos-data` disk is mounted at `/opt/render/project/src/data` — this persists the SQLite file across deploys and restarts

> ⚠ Render free tier spins down after 15 min of inactivity. The first request after sleep takes ~10 s. Upgrade to a paid instance for always-on.

---

## Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

railway login
railway init
railway up
```

Railway auto-provisions a persistent volume for the `data/` directory.

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/db` | Load full database JSON |
| `PUT` | `/api/db` | Save full database JSON |
| `PATCH` | `/api/db` | Update a single key (body: `{path, value}`) |
| `DELETE` | `/api/db` | Reset database to defaults |
| `GET` | `/api/health` | Health check |

All endpoints return JSON. The frontend batches writes with a 400 ms debounce so rapid interactions don't flood the server.

---

## Data persistence

- All data lives in `data/swiftpos.db` (SQLite, single file)
- The entire application state is stored as one JSON blob — same shape as the original `localStorage` object
- **Backup**: Settings → Backup → Download JSON
- **Restore**: Settings → Backup → Upload JSON

---

## Architecture note

The frontend (`public/index.html`) is a pure static file served by Express. On boot it calls `GET /api/db`, loads the full state into memory, and runs exactly like the original localStorage version. On every change it calls `PUT /api/db` (debounced 400 ms). No page reloads. No frameworks.
