"use strict";

/** Map Yahoo screener exchange codes → TradingView prefixes for US equities. */
const YAHOO_EX_TO_TV = {
  NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ", NIQ: "NASDAQ",
  NYQ: "NYSE", NYE: "NYSE", NYS: "NYSE",
  ASE: "AMEX", AMX: "AMEX", NYC: "AMEX", PCX: "AMEX"
};

function yahooQuoteToTvSymbol(q) {
  const ticker = String(q.symbol || "").toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) return null;
  const ex = YAHOO_EX_TO_TV[q.exchange];
  if (!ex) return null;
  return `${ex}:${ticker.replace(/-/g, ".")}`;
}

function isLiquidUsEquity(q) {
  if (!q || q.quoteType !== "EQUITY") return false;
  if (!YAHOO_EX_TO_TV[q.exchange]) return false;
  if (q.currency && q.currency !== "USD") return false;
  const vol = Number(q.regularMarketVolume ?? q.averageDailyVolume3Month ?? 0);
  const avg = Number(q.averageDailyVolume3Month ?? q.averageDailyVolume10Day ?? 0);
  const mcap = Number(q.marketCap ?? 0);
  // Prefer liquid names; skip tiny / illiquid prints without inventing fills.
  if (avg >= 200000 || vol >= 200000) return true;
  if (mcap >= 1e9 && vol >= 50000) return true;
  return false;
}

function normalizeMover(q) {
  const tv = yahooQuoteToTvSymbol(q);
  const pct = Number(q.regularMarketChangePercent);
  const close = Number(q.regularMarketPrice ?? q.currentPrice);
  if (!tv || !Number.isFinite(pct) || !Number.isFinite(close)) return null;
  return {
    tv,
    yahoo: q.symbol,
    name: q.shortName || q.displayName || q.longName || q.symbol,
    pct,
    close,
    volume: Number(q.regularMarketVolume)
  };
}

function pickTopMovers(quotes, direction, limit = 3) {
  const rows = (quotes || [])
    .filter(isLiquidUsEquity)
    .map(normalizeMover)
    .filter(Boolean)
    .filter(row => direction === "bull" ? row.pct > 0 : row.pct < 0)
    .sort((a, b) => direction === "bull" ? b.pct - a.pct : a.pct - b.pct);
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (seen.has(row.tv)) continue;
    seen.add(row.tv);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function fmtPct(pct) {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function renderMoverList(hostId, rows, emptyText) {
  const host = $(hostId);
  host.replaceChildren();
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "empty movers-empty";
    p.textContent = emptyText;
    host.appendChild(p);
    return;
  }
  for (const row of rows) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mover-row";
    btn.title = `Open ${row.tv} on chart`;
    btn.addEventListener("click", () => {
      try { selectSymbol(normalizeSymbol(row.tv)); }
      catch (error) { toast(error.message); }
    });
    const left = document.createElement("div");
    const ticker = document.createElement("strong");
    ticker.textContent = row.yahoo;
    const name = document.createElement("small");
    name.textContent = row.name;
    left.append(ticker, name);
    const right = document.createElement("div");
    right.className = "mover-stats";
    const pct = document.createElement("strong");
    pct.className = row.pct >= 0 ? "positive" : "negative";
    pct.textContent = fmtPct(row.pct);
    const px = document.createElement("small");
    px.textContent = `Close ${fmtPx(row.close)}`;
    right.append(pct, px);
    btn.append(left, right);
    host.appendChild(btn);
  }
}

async function loadDailyMovers() {
  const meta = $("movers-meta");
  meta.textContent = "Fetching day gainers / losers snapshot…";
  renderMoverList("movers-bull", [], "Loading…");
  renderMoverList("movers-bear", [], "Loading…");
  try {
    const [gainers, losers] = await Promise.all([
      fetchJson("https://finance-query.com/v2/screeners/day-gainers?count=25"),
      fetchJson("https://finance-query.com/v2/screeners/day-losers?count=25")
    ]);
    const bull = pickTopMovers(gainers.quotes, "bull", 3);
    const bear = pickTopMovers(losers.quotes, "bear", 3);
    renderMoverList("movers-bull", bull, "No liquid US gainers in this snapshot.");
    renderMoverList("movers-bear", bear, "No liquid US losers in this snapshot.");
    const updated = gainers.lastUpdated || losers.lastUpdated;
    const asof = updated ? new Date(Number(updated)).toISOString() : new Date().toISOString();
    meta.textContent = `US equity day movers · finance-query screeners (Yahoo-style) · top 3 liquid after filter · as of ${asof} · daily update / not live ticks`;
    if (!bull.length && !bear.length) throw new Error("empty after liquidity filter");
  } catch (error) {
    meta.textContent = "Daily movers snapshot failed. " + (error.message || "");
    renderMoverList("movers-bull", [], "Unavailable — try Refresh daily update.");
    renderMoverList("movers-bear", [], "Unavailable — try Refresh daily update.");
  }
}

async function loadBreadthProxy() {
  const host = $("breadth-proxy");
  host.textContent = "Loading optional context proxies…";
  try {
    const [vix, spy, qqq] = await Promise.all([
      fetchJson("https://finance-query.com/v2/quote/%5EVIX"),
      fetchJson("https://finance-query.com/v2/quote/SPY"),
      fetchJson("https://finance-query.com/v2/quote/QQQ")
    ]);
    const line = (label, data, symbol) => {
      const px = data.regularMarketPrice ?? data.currentPrice;
      const pct = data.regularMarketChangePercent;
      const asof = data.regularMarketTime ? new Date(Number(data.regularMarketTime) * 1000).toISOString() : "—";
      if (!Number.isFinite(Number(px))) return null;
      const pctTxt = Number.isFinite(Number(pct)) ? ` · day ${fmtPct(Number(pct))}` : "";
      return `${label} (${symbol}): ${fmtPx(px)}${pctTxt} · as of ${asof}`;
    };
    const parts = [
      line("VIX", vix, "^VIX"),
      line("SPY", spy, "SPY"),
      line("QQQ", qqq, "QQQ")
    ].filter(Boolean);
    host.replaceChildren();
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Proxy context only — not official Stockbee MM readings. Day snapshot via finance-query.";
    host.appendChild(note);
    const ul = document.createElement("ul");
    ul.className = "proxy-list";
    for (const text of parts) {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    }
    host.appendChild(ul);
  } catch (error) {
    host.textContent = "Proxy snapshots unavailable. " + (error.message || "");
  }
}

$("refresh-movers").addEventListener("click", () => { loadDailyMovers(); loadBreadthProxy(); });
loadDailyMovers();
loadBreadthProxy();
