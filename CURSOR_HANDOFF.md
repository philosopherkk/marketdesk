# MarketDesk handoff

## Current (1.4.0)

- Native Lightweight Charts™ only — no TradingView embed / script / iframe.
- Configurable SMA/EMA overlays + Volume / RSI / MACD toggles that draw.
- Journal / `marketdesk:v1` trades, US bare tickers, Tape, Stockbee MM, theme, fonts preserved.
- Day snapshots via finance-query.com.

## Hard boundaries

- Do not scrape TradingView or read iframe internals (TV is gone entirely).
- Do not invent prices or brokerage fills.
- Target ≠ exit. No API secrets in the frontend.
- US bare tickers resolve to US listings; Stockbee MM labeled reconstructed / not official.

## Publish

Bump `VERSION` + `APP_VERSION` / `APP_UPDATED` (HKT) on every publish. Deploy via `.github/workflows/pages.yml`.
