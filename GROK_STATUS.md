# MarketDesk status — 1.4.0 (2026-09-09 HKT)

## Chart (native only)

| Item | Status |
|---|---|
| TradingView embed / script / iframe removed | Done |
| Lightweight Charts™ v5.0.8 native daily chart | Done |
| Configurable SMA/EMA overlays (enable/type/period/color/width/style) | Done |
| Apply overlays batches redraw without full refetch | Done |
| Volume / RSI14 / MACD(12,26,9) toggles that draw | Done |
| MA presets (existing / momentum / trend / fast / weekly) | Done |
| Persist overlays / indicators / trades in `marketdesk:v1` | Done (trades untouched) |
| chartProvider forced to `native` on migrate | Done |

## Preserved

- Journal / P&L (`marketdesk:v1` trades)
- US bare tickers
- Tape desk + Stockbee MM table
- Daylight/Dark theme + A−/A/A+ fonts
- Day OHLC snapshot via finance-query.com

## Notes

Native chart always uses daily history for exact MA/RSI/MACD periods. Interval selector is retained for preference only (`*` = not used by chart).
