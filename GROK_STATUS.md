# GROK_STATUS — 2026-09-08 HKT · v1.3.0 (Astra Phase 1+2)

## Version

MarketDesk **1.3.0** · updated **2026-09-08 HKT**

## Phase 1 checklist

| Item | Status |
|------|--------|
| TV MA period verification | Documented: public embed accepts object `{id, inputs:{length}}` best-effort; UI notes prefer **Native** for exact periods (no iframe scrape of rendered lengths) |
| Independent overlays (enable/type/period/color/width/style) | Done |
| Batch TV overlay changes behind **Apply** | Done |
| Preserve empty oscillator selection on migrate | Done |
| `finiteOrNull` / no `Number(null)→0`; quote request id stale guard | Done |
| SMA 200 requires full 200 bars; MM denominators = eligible only | Done |
| Snapshot below chart; collapsible trade form | Done |
| Journal/P&L unchanged | Done |

## Phase 2 checklist

| Item | Status |
|------|--------|
| Lightweight Charts **v5.0.8** vendored | `vendor/lightweight-charts-5.0.8.standalone.production.js` |
| TradingView mode kept | Done |
| `ma.js` SMA + SMA-seeded EMA; unit tests | `test/ma.test.js` PASS |
| Presets (existing default, momentum, trend, fast, weekly) | Done |
| Persist overlays/chartProvider/maPreset in `marketdesk:v1` migrator | Done (trades untouched) |
| Native meta + LC attribution | Done |
| Legend distance to MAs; theme preserve range | Done |

## TV verification note

Object-form studies are widely reported to work on Advanced Chart / widget constructors; the free `embed-widget-advanced-chart.js` path remains best-effort (default length 9 if inputs ignored). MarketDesk therefore defaults TV to configured overlays via Apply, and offers Native for acceptance-tested periods.

## MA unit tests (node)

```
SMA(3)[1,2,3,4,5] → [null,null,2,3,4]
EMA(3) SMA-seeded → [null,null,2,3,4]
flat stays flat; <N bars → nulls; missing close throws; finiteOrNull(null)=null
```

## Reminder

localStorage per-origin. `localhost` ≠ `github.io`.
