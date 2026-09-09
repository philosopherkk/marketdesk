# MarketDesk

Repo: https://github.com/philosopherkk/marketdesk

**Version:** see `VERSION` (also shown in the app header/footer). Bump version + HKT update date on every publish.

Files: `index.html`, `styles.css`, `core.js`, `ui.js`, `chart-quotes.js`, `native-chart.js`, `ma.js`, `journal.js`, `market-panels.js`, `data/tape-daily.json`, `vendor/lightweight-charts-5.0.8.standalone.production.js`, `VERSION`.



## Run locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000

## Publish (GitHub Pages)

Expected URL: https://philosopherkk.github.io/marketdesk/

Deploy workflow: `.github/workflows/pages.yml` (GitHub Actions).

If Pages is not live yet, KK must click once:

1. https://github.com/philosopherkk/marketdesk/settings/pages
2. **Build and deployment → Source** → **GitHub Actions** (not “Deploy from a branch”)
3. Re-run **Deploy Pages** under Actions, or push to `main`

After that, `enablement: true` on `configure-pages` should keep Pages provisioned.

localStorage is per-origin. `localhost` and `github.io` are different workspaces — export a backup before switching hosts.

## Data

Yahoo-style day snapshot via finance-query.com (OHLC + daily US gainers/losers). Native Lightweight Charts™ for daily candles with SMA/EMA, RSI, MACD, Volume (no TradingView embed). Manual journal. Stockbee MM referenced with credit (numbers not invented).

See CURSOR_HANDOFF.md.
