"use strict";

/**
 * Chart bar loaders for MarketDesk native chart.
 * Preferred US equity/ETF OHLC: Massive.com (formerly Polygon.io) Stocks Developer API.
 * Fallback: finance-query.com (Yahoo-style) — labeled, never silent.
 * Index closing levels: Interactive Brokers (IB) — documented / reserved; not a full IBKR client.
 * No API secrets in committed source — keys from MarketDeskSecrets localStorage only.
 */
const MarketDeskData = (() => {
  const MASSIVE_HOST = "https://api.massive.com";
  const MASSIVE_HOST_LEGACY = "https://api.polygon.io";

  function isoDate(d) {
    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, "0"),
      String(d.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function rangeDates(yearsBack = 2) {
    const to = new Date();
    const from = new Date(Date.UTC(to.getUTCFullYear() - yearsBack, to.getUTCMonth(), to.getUTCDate()));
    return { from: isoDate(from), to: isoDate(to) };
  }

  function isUsEquityOrEtf(tvSymbol) {
    const ex = String(tvSymbol || "").split(":")[0];
    return ["NASDAQ", "NYSE", "AMEX"].includes(ex);
  }

  function bareTicker(tvSymbol) {
    const raw = String(tvSymbol || "").split(":")[1] || String(tvSymbol || "");
    return raw.replace(/\./g, "-");
  }

  function metaLine(meta) {
    if (!meta) return "";
    const parts = [
      `source: ${meta.source}`,
      meta.session ? `session: ${meta.session}` : null,
      meta.adjustment ? `adjustment: ${meta.adjustment}` : null,
      meta.asOf ? `as of ${meta.asOf}` : null,
      meta.fallbackReason ? `note: ${meta.fallbackReason}` : null
    ].filter(Boolean);
    return parts.join(" · ");
  }

  async function fetchMassiveAggs(ticker, apiKey) {
    const { from, to } = rangeDates(2);
    const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000`;
    const headers = {
      Accept: "application/json",
      Authorization: "Bearer " + apiKey
    };
    let lastError = null;
    for (const host of [MASSIVE_HOST, MASSIVE_HOST_LEGACY]) {
      try {
        const res = await fetch(host + path, { headers });
        if (res.status === 401 || res.status === 403) {
          throw new Error("Massive API key rejected (" + res.status + "). Check the Stocks Developer key.");
        }
        if (!res.ok) {
          lastError = new Error("Massive HTTP " + res.status + " via " + host);
          continue;
        }
        const data = await res.json();
        if (data.status && data.status !== "OK" && data.status !== "DELAYED") {
          lastError = new Error("Massive status: " + data.status);
          continue;
        }
        return { data, host, from, to };
      } catch (error) {
        lastError = error;
        // CORS / network — try legacy host, then fall through
        if (String(error.message || "").includes("API key rejected")) throw error;
      }
    }
    throw lastError || new Error("Massive request failed");
  }

  function barsFromMassive(results) {
    const out = [];
    for (const r of results || []) {
      const ms = Number(r.t);
      const o = finiteOrNull(r.o), h = finiteOrNull(r.h), l = finiteOrNull(r.l), c = finiteOrNull(r.c);
      const v = finiteOrNull(r.v);
      if (!Number.isFinite(ms) || o == null || h == null || l == null || c == null) continue;
      out.push({
        time: Math.floor(ms / 1000),
        open: o, high: h, low: l, close: c,
        volume: v == null ? 0 : v
      });
    }
    out.sort((a, b) => a.time - b.time);
    return out;
  }

  async function loadMassiveBars(tvSymbol) {
    const key = MarketDeskSecrets.getMassiveKey();
    if (!key) {
      const err = new Error("Massive API key not configured");
      err.code = "NO_MASSIVE_KEY";
      throw err;
    }
    if (!isUsEquityOrEtf(tvSymbol)) {
      const err = new Error("Massive Stocks API applies to US equities/ETFs; other markets use fallback");
      err.code = "NOT_US_STOCK";
      throw err;
    }
    const ticker = bareTicker(tvSymbol);
    const { data, host, from, to } = await fetchMassiveAggs(ticker, key);
    const bars = barsFromMassive(data.results);
    if (!bars.length) throw new Error("Massive returned no daily bars for " + ticker);
    const last = bars[bars.length - 1];
    return {
      bars,
      meta: {
        symbol: ticker,
        source: "Massive.com Stocks Developer API (preferred)",
        host,
        session: "daily ET aggregate (regular + extended trades that form the day bar)",
        adjustment: data.adjusted === false ? "not split-adjusted" : "split-adjusted (Massive adjusted=true)",
        asOf: last ? new Date(last.time * 1000).toISOString() : null,
        range: `${from} → ${to}`,
        interval: "1d",
        count: bars.length,
        preferred: true
      }
    };
  }

  async function loadFinanceQueryBars(tvSymbol) {
    const yahoo = (typeof toYahooSymbol === "function") ? toYahooSymbol(tvSymbol) : bareTicker(tvSymbol);
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
    return {
      bars: out,
      meta: {
        symbol: yahoo,
        source: "finance-query.com (labeled fallback)",
        session: "Yahoo-style daily (provider session)",
        adjustment: "as reported by provider (adjClose not used for OHLC plot)",
        asOf: candles.length ? new Date(candles[candles.length - 1].timestamp * 1000).toISOString() : null,
        range: data.range || "2y",
        interval: "1d",
        count: out.length,
        preferred: false
      }
    };
  }

  /**
   * Preferred Massive for US stocks when key present; otherwise labeled finance-query fallback.
   * Never invents prices.
   */
  async function loadDailyBars(tvSymbol) {
    const hasKey = MarketDeskSecrets.hasMassiveKey();
    if (hasKey && isUsEquityOrEtf(tvSymbol)) {
      try {
        return await loadMassiveBars(tvSymbol);
      } catch (error) {
        if (error.code === "NO_MASSIVE_KEY") {
          /* fall through */
        } else {
          const fb = await loadFinanceQueryBars(tvSymbol);
          fb.meta.fallbackReason = "Massive failed: " + (error.message || error);
          return fb;
        }
      }
    }
    const fb = await loadFinanceQueryBars(tvSymbol);
    if (!hasKey) {
      fb.meta.fallbackReason = "Massive key not set — enter Stocks Developer API key (local device only)";
    } else if (!isUsEquityOrEtf(tvSymbol)) {
      fb.meta.fallbackReason = "Non-US / non-equity symbol — Massive Stocks path skipped";
    }
    return fb;
  }

  /** IB index closes — reserved. No full IBKR trading client in this static app. */
  function ibIndexCloseStatus() {
    return {
      configured: false,
      label: "Interactive Brokers (index closes only)",
      detail: "Preferred for index closing levels. Not wired on github.io (needs local IB Gateway / TWS). No IB tokens in frontend."
    };
  }

  return {
    loadDailyBars,
    loadMassiveBars,
    loadFinanceQueryBars,
    isUsEquityOrEtf,
    metaLine,
    ibIndexCloseStatus,
    MASSIVE_HOST
  };
})();

if (typeof window !== "undefined") window.MarketDeskData = MarketDeskData;
