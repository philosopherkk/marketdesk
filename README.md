# MarketDesk

Personal TradingView-style dashboard: charts (TradingView Advanced Chart widget), watchlist, manual trade journal, optional last-print quotes from public sources.

## Run

```bash
python3 -m http.server 8000
```

Open http://localhost:8000

Internet is required for the chart widget and quote panel.

## What is real vs what is not

- Charts and drawing tools come from TradingView's **free embed**. That is display-only. TradingView does not expose widget internals as a market-data API. A paid TradingView account does **not** unlock paid exchange data inside website widgets.
- The quote strip is a **separate** fetch. Stocks/ETFs/futures map to Yahoo-style tickers via `finance-query.com` (community wrapper over public Yahoo endpoints). Crypto uses CoinGecko's public simple-price API. Treat equity prints as delayed / last available, not exchange-entitled real-time.
- Journal P&L is **manual**. It does not read the widget. Target price is never used as an exit.
- Persistence is `localStorage` key `marketdesk:v1`. Export JSON regularly. Import is validated before overwrite.

## Symbol format

Use `EXCHANGE:TICKER` as TradingView expects: `NASDAQ:AAPL`, `HKEX:700`, `CME_MINI:ES1!`, `COINBASE:BTCUSD`.

Continuous futures ending in `!` are for **charts only**. Journal rows require a dated contract symbol.

## Limitations (do not ignore)

- Not every HK or futures symbol is available in the free widget.
- No brokerage, no orders, no scraped iframe prices, no invented prints.
- No mixed-currency journal totals.
- Browser storage can fail or fill; use Export.

## Cursor / next phase

See `CURSOR_HANDOFF.md`.
