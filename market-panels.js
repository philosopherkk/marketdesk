"use strict";

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
    btn.addEventListener("click", async () => {
      try { await selectSymbol(row.tv); }
      catch (error) { toast(error.message); }
    });
    const left = document.createElement("div");
    const ticker = document.createElement("strong");
    ticker.textContent = row.yahoo || row.tv.split(":")[1];
    const name = document.createElement("small");
    name.textContent = row.reason || row.name || row.tv;
    left.append(ticker, name);
    const right = document.createElement("div");
    right.className = "mover-stats";
    const pct = document.createElement("strong");
    if (Number.isFinite(row.pct)) {
      pct.className = row.pct >= 0 ? "positive" : "negative";
      pct.textContent = fmtPct(row.pct);
    } else {
      pct.textContent = row.stance || "Tape";
      pct.className = row.side === "bear" ? "negative" : "positive";
    }
    const px = document.createElement("small");
    px.textContent = Number.isFinite(row.close) ? `Close ${fmtPx(row.close)}` : (row.source || "desk");
    right.append(pct, px);
    btn.append(left, right);
    host.appendChild(btn);
  }
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

function isLiquidUsEquity(q) {
  if (!q) return false;
  const type = String(q.quoteType || "").toLowerCase();
  if (type !== "equity" && type !== "etf") return false;
  if (!yahooExToTv(q.exchange)) return false;
  if (q.currency && q.currency !== "USD") return false;
  const vol = Number(q.regularMarketVolume ?? q.averageVolume ?? 0);
  const avg = Number(q.averageDailyVolume3Month ?? q.averageDailyVolume10Day ?? q.averageVolume ?? 0);
  const mcap = Number(q.marketCap ?? 0);
  if (type === "etf") return true;
  if (avg >= 200000 || vol >= 200000) return true;
  if (mcap >= 1e9 && vol >= 50000) return true;
  return false;
}

function normalizeMover(q) {
  const tvEx = yahooExToTv(q.exchange);
  const bare = String(q.symbol || "").toUpperCase().replace(/-/g, ".");
  const pct = Number(q.regularMarketChangePercent);
  const close = Number(q.regularMarketPrice ?? q.currentPrice);
  if (!tvEx || !bare || !Number.isFinite(pct) || !Number.isFinite(close)) return null;
  return {
    tv: `${tvEx}:${bare}`,
    yahoo: bare,
    name: q.shortName || q.displayName || q.longName || bare,
    pct,
    close,
    volume: Number(q.regularMarketVolume)
  };
}

function fmtPct(pct) {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

async function enrichTapeRows(items, side) {
  const symbols = items.map(i => i.symbol.replace(/\./g, "-")).join(",");
  let quotes = [];
  try {
    const data = await fetchJson("https://finance-query.com/v2/quotes?symbols=" + encodeURIComponent(symbols));
    quotes = data.quotes || [];
  } catch { /* quotes optional for Tape desk stance */ }
  return items.map(item => {
    const q = quotes.find(row => String(row.symbol || "").toUpperCase().replace(/-/g, ".") === item.symbol.toUpperCase());
    const pct = q ? Number(q.regularMarketChangePercent) : NaN;
    const close = q ? Number(q.regularMarketPrice ?? q.currentPrice) : NaN;
    const ex = q && yahooExToTv(q.exchange);
    const bare = item.symbol.toUpperCase();
    let tv = catalogTvForBare(bare);
    if (!tv && ex) tv = `${ex}:${bare}`;
    if (!tv) tv = `NYSE:${bare}`; // fallback prefix; selectSymbol/lookup corrects via bare if needed
    // Prefer resolved US via bare path on click
    return {
      tv: bare,
      yahoo: bare,
      name: q ? (q.shortName || q.longName || bare) : bare,
      reason: item.reason,
      pct: Number.isFinite(pct) ? pct : NaN,
      close: Number.isFinite(close) ? close : NaN,
      side,
      stance: side === "bull" ? "Bull desk" : "Bear desk",
      source: "Tape desk"
    };
  });
}

async function loadTapeFeed() {
  // Prefer in-memory / local override for same calendar day, else repo JSON.
  const override = state.tapeOverride;
  if (override && override.asOf && Array.isArray(override.bullish) && Array.isArray(override.bearish) &&
      override.bullish.length >= 3 && override.bearish.length >= 3) {
    return override;
  }
  try {
    return await fetchJson("data/tape-daily.json");
  } catch {
    return null;
  }
}

async function loadDailyMovers() {
  const meta = $("movers-meta");
  meta.textContent = "Loading daily update…";
  renderMoverList("movers-bull", [], "Loading…");
  renderMoverList("movers-bear", [], "Loading…");
  const tape = await loadTapeFeed();
  if (tape && tape.bullish && tape.bearish) {
    const bull = await enrichTapeRows(tape.bullish.slice(0, 3), "bull");
    const bear = await enrichTapeRows(tape.bearish.slice(0, 3), "bear");
    renderMoverList("movers-bull", bull, "No Tape bullish names.");
    renderMoverList("movers-bear", bear, "No Tape bearish names.");
    meta.textContent = `Preferred source: Tape desk · as of ${tape.asOfLabel || tape.asOf || "—"} · ${tape.notes || ""} · quotes enriched via finance-query when available`;
    $("movers-source-badge").textContent = "Source: Tape desk";
    return;
  }
  $("movers-source-badge").textContent = "Source: finance-query screener fallback";
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
    meta.textContent = `Fallback · finance-query day-gainers/losers · as of ${asof} · Preferred source: Tape daily desk (no Tape feed today)`;
    if (!bull.length && !bear.length) throw new Error("empty after liquidity filter");
  } catch (error) {
    meta.textContent = "Daily movers failed. " + (error.message || "");
    renderMoverList("movers-bull", [], "Unavailable");
    renderMoverList("movers-bear", [], "Unavailable");
  }
}

$("refresh-movers").addEventListener("click", () => { loadDailyMovers(); });

loadDailyMovers();
