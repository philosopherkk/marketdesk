# MarketDesk handoff

## Current (1.4.0)

- Native Lightweight Charts™ only — no TradingView embed / script / iframe.
- Configurable SMA/EMA overlays + Volume / RSI / MACD toggles that draw.
- Preferred US OHLC: Massive.com Stocks Developer API via local-only key (`marketdesk:secrets:v1`); finance-query labeled fallback.
- IB reserved for index closes only (no full IBKR client on Pages).
- Journal / `marketdesk:v1` trades, US bare tickers, Tape, Stockbee MM, theme, fonts preserved.

## Hard boundaries

- Do not commit API secrets or put Massive/IB tokens in public frontend JS.
- Do not scrape TradingView (TV is gone entirely).
- Do not invent prices or brokerage fills. Target ≠ exit.
- US bare tickers resolve to US listings; Stockbee MM labeled reconstructed / not official.

## Publish

Bump `VERSION` + `APP_VERSION` / `APP_UPDATED` (HKT) on every publish. Deploy via `.github/workflows/pages.yml`.
