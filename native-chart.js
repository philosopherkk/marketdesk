"use strict";

/**
 * Native daily chart via Lightweight Charts v5.0.8 (vendored).
 * Exact SMA/EMA periods; overlay toggles without full recreate when possible.
 */
const MarketDeskNative = (() => {
  let chart = null;
  let candleSeries = null;
  let volumeSeries = null;
  let lineSeries = new Map();
  let bars = [];
  let meta = null;
  let hostEl = null;
  let resizeObs = null;

  function lc() {
    return window.LightweightCharts;
  }

  function themeColors() {
    const light = resolvedTheme() === "light";
    return {
      light,
      bg: light ? "#ffffff" : "#0f172a",
      text: light ? "#0f172a" : "#e2e8f0",
      grid: light ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.08)",
      up: "#10b981",
      down: "#ef4444"
    };
  }

  function destroy() {
    if (resizeObs) { try { resizeObs.disconnect(); } catch { /* */ } resizeObs = null; }
    if (chart) { try { chart.remove(); } catch { /* */ } }
    chart = null; candleSeries = null; volumeSeries = null; lineSeries = new Map();
  }

  function overlayColor(o) {
    return resolvedTheme() === "light" ? o.colorLight : o.colorDark;
  }

  function syncLegend() {
    const legend = $("native-legend");
    if (!legend || !bars.length) return;
    const last = bars[bars.length - 1];
    const close = last.close;
    const parts = [`Close ${close.toLocaleString("en-US", { maximumFractionDigits: 4 })}`];
    for (const o of state.overlays || []) {
      if (!o.enabled) continue;
      const values = MarketDeskMA.movingAverage(bars, o.period, o.type);
      const v = values[values.length - 1];
      if (v == null) {
        parts.push(`${o.type}${o.period}: — (need ${o.period} bars)`);
        continue;
      }
      const dist = ((close - v) / v) * 100;
      parts.push(`${o.type}${o.period}: ${v.toLocaleString("en-US", { maximumFractionDigits: 4 })} (${dist >= 0 ? "+" : ""}${dist.toFixed(2)}%)`);
    }
    legend.textContent = parts.join(" · ");
  }

  function applyOverlayLines() {
    if (!chart || !candleSeries) return;
    for (const [id, series] of lineSeries) {
      try { chart.removeSeries(series); } catch { /* */ }
      lineSeries.delete(id);
    }
    for (const o of state.overlays || []) {
      if (!o.enabled) continue;
      if (bars.length < o.period) continue;
      const values = MarketDeskMA.movingAverage(bars, o.period, o.type);
      const points = MarketDeskMA.linePointsFromBars(bars, values);
      if (!points.length) continue;
      const series = chart.addSeries(lc().LineSeries, {
        color: overlayColor(o),
        lineWidth: o.width,
        lineStyle: o.style === "dashed" ? lc().LineStyle.Dashed : lc().LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
        title: `${o.type}${o.period}`
      });
      series.setData(points);
      lineSeries.set(o.id, series);
    }
    syncLegend();
  }

  function setThemePreserveRange() {
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    const c = themeColors();
    chart.applyOptions({
      layout: { background: { color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } }
    });
    applyOverlayLines();
    if (range) chart.timeScale().setVisibleLogicalRange(range);
  }

  async function loadBars(symbol) {
    const yahoo = (typeof toYahooSymbol === "function") ? toYahooSymbol(symbol) : symbol.split(":")[1];
    const data = await fetchJson("https://finance-query.com/v2/chart/" + encodeURIComponent(yahoo) + "?interval=1d&range=2y");
    const candles = data.candles || [];
    const out = [];
    for (const c of candles) {
      const t = Number(c.timestamp);
      const o = finiteOrNull(c.open), h = finiteOrNull(c.high), l = finiteOrNull(c.low), cl = finiteOrNull(c.close);
      const vol = finiteOrNull(c.volume);
      if (!Number.isFinite(t) || o == null || h == null || l == null || cl == null) continue;
      out.push({
        time: t,
        open: o, high: h, low: l, close: cl,
        volume: vol == null ? 0 : vol
      });
    }
    out.sort((a, b) => a.time - b.time);
    // Lightweight Charts expects UTCTimestamp in seconds
    meta = {
      symbol: yahoo,
      source: "finance-query.com / Yahoo-style daily",
      range: data.range || "2y",
      interval: "1d",
      asOf: candles.length ? new Date(candles[candles.length - 1].timestamp * 1000).toISOString() : null,
      count: out.length,
      adjustment: "as reported by provider (adjClose not used for OHLC plot)"
    };
    return out;
  }

  function mountEmpty(host) {
    host.innerHTML = `
      <div class="native-chart-shell">
        <div id="native-chart-host" style="height:560px;width:100%"></div>
        <div class="native-meta muted" id="native-meta"></div>
        <div class="native-legend" id="native-legend"></div>
        <p class="muted chart-studies-note">Native daily chart · Lightweight Charts™ v5.0.8 · exact SMA/EMA (SMA-seeded). TradingView embed still available via Chart mode.</p>
      </div>`;
  }

  async function render(host) {
    hostEl = host;
    destroy();
    mountEmpty(host);
    const mount = $("native-chart-host");
    const c = themeColors();
    if (!lc()) {
      mount.innerHTML = "<p class='notice-inline'>Lightweight Charts failed to load.</p>";
      return;
    }
    chart = lc().createChart(mount, {
      autoSize: true,
      layout: { background: { color: c.bg }, textColor: c.text },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false }
    });
    candleSeries = chart.addSeries(lc().CandlestickSeries, {
      upColor: c.up, downColor: c.down, borderVisible: false,
      wickUpColor: c.up, wickDownColor: c.down
    });
    volumeSeries = chart.addSeries(lc().HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol"
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    try {
      bars = await loadBars(state.selected);
      if (!bars.length) throw new Error("no daily bars");
      candleSeries.setData(bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })));
      volumeSeries.setData(bars.map(b => ({
        time: b.time,
        value: b.volume,
        color: b.close >= b.open ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"
      })));
      chart.timeScale().fitContent();
      applyOverlayLines();
      const metaEl = $("native-meta");
      if (metaEl && meta) {
        metaEl.textContent = `${meta.symbol} · ${meta.source} · ${meta.interval} · ${meta.range} · ${meta.count} bars · as of ${meta.asOf || "—"} · ${meta.adjustment}`;
      }
    } catch (error) {
      mount.innerHTML = `<p class="notice-inline">Native chart failed: ${error.message || error}</p>`;
    }

    resizeObs = new ResizeObserver(() => { if (chart) chart.applyOptions({ width: mount.clientWidth }); });
    resizeObs.observe(mount);
  }

  function applyOverlays() {
    if (!chart) { if (hostEl) render(hostEl); return; }
    applyOverlayLines();
  }

  function setIntervalLabel() {
    // Native path is daily history for MA accuracy regardless of TV interval selector.
    syncLegend();
  }

  return { render, applyOverlays, setThemePreserveRange, setIntervalLabel, destroy };
})();
