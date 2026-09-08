# GROK_STATUS — 2026-09-08 (font/theme/Tape/MM/Minervini PR)

## Storage

- Key remains `marketdesk:v1` with in-place **migrator** (`migrateState`): adds `fontScale`, `theme`, `tapeOverride`; backfills trade `stopLoss` default 5% from entry.
- Breadth cache / 10-day history use separate keys (`marketdesk:breadth-cache:v1`, `marketdesk:mm-history:v1`) so workspace backups stay focused.

## Features in this PR

1. **Font size** — A− / A / A+ → `fontScale` small/medium/large, persisted.
2. **Journal clarity** — “Saved on this device/browser only · marketdesk:v1”; entry column marked; empty state wording.
3. **Stop loss** — default long `entry×0.95` / short `entry×1.05`; editable; shown on row; target still never exit.
4. **Daily US update** — **Preferred: Tape desk** via `data/tape-daily.json` (as-of Tue 8 Sep 2026 ~20:23 HKT): bull **XOM, CVX, XLE**; bear **QQQ, XLK, TLT** + reason lines. finance-query gainers/losers = fallback only.
5. **Minervini ~20** — approximate trend template on public daily charts (price > rising 150/200 MA, 150>200, near 52w high, ≥25% above 52w low). Labeled not SEPA.
6. **MM-style breadth auto** — reconstructed from liquid US quote universe + chart sample; 4% up/down, rolling 10-day ratio (local history), 25%/50%/34-13/MMA-style sample counts. Labeled **not official Stockbee**; credit + link kept. On failure: error + last successful as-of.
7. **Daylight / Dark** — theme toggle persisted; TradingView embed `theme` + background follow without iframe scrape.
8. **US-default bare tickers** — `AAPL` → US listing via catalog/lookup; HK only if `HKEX:…`.

## Browser smoke (localhost)

Run after serve: bare `AAPL`, Tape six visible (XOM/CVX/XLE + QQQ/XLK/TLT), stop default, font/theme toggle, MM table fills or cache, Minervini list or honest empty.

## Reminder

localStorage is per-origin. `localhost` ≠ `github.io`.
