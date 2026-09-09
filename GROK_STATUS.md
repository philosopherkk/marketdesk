# MarketDesk status — 1.4.0 (2026-09-09 HKT)

## Chart (native only)

| Item | Status |
|---|---|
| TradingView embed / script / iframe removed | Done |
| Lightweight Charts™ v5.0.8 native daily chart | Done |
| Configurable SMA/EMA overlays (enable/type/period/color/width/style) | Done |
| Volume / RSI14 / MACD(12,26,9) toggles that draw | Done |
| Preferred US OHLC: Massive.com Stocks Developer API | Done (localStorage key only) |
| finance-query labeled fallback when key missing / non-US | Done |
| UI labels: source · session · adjustment · as-of | Done |
| IB index closes (documented; no full IBKR client) | Reserved |
| Secrets excluded from workspace backups | Done |
| Persist overlays / indicators / trades in `marketdesk:v1` | Done (trades untouched) |

## Preserved

- Journal / P&L (`marketdesk:v1` trades)
- US bare tickers
- Tape desk + Stockbee MM table
- Daylight/Dark theme + A−/A/A+ fonts

## Secrets

- Massive key → `localStorage["marketdesk:secrets:v1"]` (never committed, never in Export backup by default)
- No serverless proxy in this static Pages repo
