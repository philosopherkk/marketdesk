# Cursor handoff — MarketDesk

You are continuing MarketDesk. Read `index.html` and `README.md` first. This is a working single-file app, not a mockup. Preserve behavior.

## Done in this Grok pass (2026-09-08)

- Working dark dashboard with TradingView Advanced Chart embed.
- Watchlist, market filters, indicator toggles, interval control.
- Manual trade journal: long/short, qty, multiplier, fees, currency.
- Target price field is display-only and never used in P&L.
- Exit date field separate from entry date.
- Validated JSON backup export **and import** (preview + confirm).
- Journal CSV export.
- Quote strip from `finance-query.com`: Yahoo-style **day snapshot** (Open, High, Low, Close/Last) plus prev close, volume, 52w, market state. Not a live tick feed. Failures surface as unavailable, never as a fake number.
- TradingView attribution kept. Chart rebuild still isolated in `renderChart()`.

## Verify first

1. Serve `index.html` over http. Confirm AAPL chart loads.
2. Open `HKEX:700` and a futures continuous symbol. Record whether the widget has data.
3. Confirm quote strip shows a number **or** a clear error — never a silent zero.
4. Add a long and a short with exit; check P&L sign.
5. Import a malformed JSON; app must refuse and not wipe storage.
6. Change chart symbol while a dirty trade form is open; symbol on the form must not change silently.

## Next priorities (do incrementally)

1. Split into modules (`app.js`, `storage.js`, `chart.js`, `quotes.js`, `journal.js`) without behavior change.
2. Named watchlists + editable categories.
3. Tests for persistence, malformed backups, duplicate symbols, empty exits, zero/negative prices, long/short P&L, futures multiplier, currency.
4. Chart-provider interface design only — document licensed data costs before implementing a custom datafeed.

## Hard boundaries

- Do not scrape TradingView or read iframe internals.
- Do not invent live prices or claim every HK/futures symbol works.
- Do not add execution.
- Do not store API secrets in frontend code.
- Do not treat target price as realized exit.

## Inform Grok after a Cursor pass

Commit a short `GROK_STATUS.md` with: files changed, what was actually browser-tested, what still fails (especially HKEX and dated futures), and the next smallest patch. Do not claim features that were not run.
