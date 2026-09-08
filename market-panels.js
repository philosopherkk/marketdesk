"use strict";

/** Liquid US common-stock / ETF universe for reconstructed MM-style breadth + Minervini screen. */
const US_UNIVERSE = [
  "AAPL","MSFT","NVDA","AMZN","META","GOOGL","GOOG","TSLA","BRK-B","JPM","V","UNH","XOM","JNJ","WMT","MA","PG","HD","CVX","MRK",
  "ABBV","COST","PEP","KO","AVGO","ADBE","CRM","CSCO","ACN","MCD","TMO","LIN","ABT","DHR","WFC","TXN","NEE","PM","BMY","UPS",
  "RTX","HON","QCOM","LOW","AMGN","IBM","CAT","BA","SBUX","GE","AMD","INTC","GS","BLK","SPGI","AXP","BKNG","ISRG","MDT","SYK",
  "ELV","GILD","ADI","LRCX","MU","AMAT","PANW","NOW","INTU","KLAC","SNPS","CDNS","ORCL","PLTR","SHOP","UBER","NFLX","DIS","CMCSA",
  "T","VZ","PFE","LLY","NKE","MDT","SCHW","C","MS","BLK","DE","LMT","NOC","GD","FCX","SLB","COP","EOG","MPC","PSX","VLO",
  "XLE","XLF","XLK","XLV","XLI","XLY","XLP","XLU","XLB","XLRE","QQQ","SPY","IWM","DIA","SMH","SOXX","ARKK","TLT","HYG","LQD",
  "BA","GM","F","RIVN","COIN","MSTR","CRWD","DDOG","NET","SNOW","ZS","OKTA","TEAM","MDB","TTD","ROKU","SQ","PYPL","AFRM","SOFI",
  "DAL","UAL","AAL","LUV","MAR","HLT","BKNG","ABNB","CMG","DPZ","YUM","MCD","SBUX","NKE","LULU","TGT","COST","WMT","DG","DLTR",
  "CVS","WBA","UNH","CI","HUM","ELV","MOH","CNC","MRNA","BNTX","REGN","VRTX","BIIB","ILMN","DXCM","IDXX","A","EW","BSX","ZBH"
];

function uniqueUniverse() {
  return [...new Set(US_UNIVERSE.map(s => s.toUpperCase()))];
}

function sma(values, period) {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

function pctChange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

function loadBreadthCache() {
  try {
    const raw = localStorage.getItem(BREADTH_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.asOf || !data.metrics) return null;
    return data;
  } catch { return null; }
}
function saveBreadthCache(payload) {
  try { localStorage.setItem(BREADTH_CACHE_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
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

async function fetchQuotesChunked(symbols, chunkSize = 40) {
  const out = [];
  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    try {
      const data = await fetchJson("https://finance-query.com/v2/quotes?symbols=" + encodeURIComponent(chunk.join(",")));
      out.push(...(data.quotes || []));
    } catch { /* skip chunk */ }
  }
  return out;
}

async function fetchChart(symbol) {
  return fetchJson("https://finance-query.com/v2/chart/" + encodeURIComponent(symbol) + "?interval=1d&range=1y");
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try { results[i] = await fn(items[i], i); }
      catch { results[i] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function closesFromChart(chart) {
  return (chart.candles || []).map(c => Number(c.close)).filter(Number.isFinite);
}

async function computeMmBreadth() {
  const host = $("mm-metrics");
  const meta = $("mm-meta");
  host.innerHTML = "<p class='muted'>Computing reconstructed MM-style breadth from public snapshots…</p>";
  meta.textContent = "Working…";
  const universe = uniqueUniverse();
  try {
    const quotes = await fetchQuotesChunked(universe);
    const equities = quotes.filter(q => {
      const t = String(q.quoteType || "").toLowerCase();
      return (t === "equity" || t === "etf") && Number.isFinite(Number(q.regularMarketChangePercent));
    });
    if (!equities.length) throw new Error("no quotes");
    const up4 = equities.filter(q => Number(q.regularMarketChangePercent) >= 4).length;
    const down4 = equities.filter(q => Number(q.regularMarketChangePercent) <= -4).length;

    // Sample charts for multi-day / multi-week style counts (honest subset — labeled).
    const sample = equities
      .map(q => String(q.symbol || "").toUpperCase())
      .filter(Boolean)
      .slice(0, 80);
    const charts = await mapPool(sample, 6, sym => fetchChart(sym));
    let up25q = 0, down25q = 0, up25m = 0, down25m = 0, up50m = 0, down50m = 0, bull3413 = 0, bear3413 = 0, mmaPlus = 0, mmaMinus = 0, scored = 0;
    for (const chart of charts) {
      if (!chart || !chart.candles || chart.candles.length < 60) continue;
      const closes = closesFromChart(chart);
      if (closes.length < 60) continue;
      scored++;
      const last = closes[closes.length - 1];
      const ago65 = closes[Math.max(0, closes.length - 65)];
      const ago21 = closes[Math.max(0, closes.length - 21)];
      const ago34 = closes[Math.max(0, closes.length - 34)];
      const q = pctChange(ago65, last);
      const m = pctChange(ago21, last);
      const d34 = pctChange(ago34, last);
      if (q != null && q >= 25) up25q++;
      if (q != null && q <= -25) down25q++;
      if (m != null && m >= 25) up25m++;
      if (m != null && m <= -25) down25m++;
      if (m != null && m >= 50) up50m++;
      if (m != null && m <= -50) down50m++;
      if (d34 != null && d34 >= 13) bull3413++;
      if (d34 != null && d34 <= -13) bear3413++;
      const ma50 = sma(closes, 50);
      const ma200 = sma(closes, Math.min(200, closes.length));
      if (ma50 != null && ma200 != null) {
        if (last > ma50 && ma50 > ma200) mmaPlus++;
        if (last < ma50 && ma50 < ma200) mmaMinus++;
      }
    }

    // Rolling 10-session history of 4% counts stored locally for ratio.
    const historyKey = "marketdesk:mm-history:v1";
    let history = [];
    try { history = JSON.parse(localStorage.getItem(historyKey) || "[]"); } catch { history = []; }
    if (!Array.isArray(history)) history = [];
    const day = localDate();
    history = history.filter(h => h && h.date !== day);
    history.push({ date: day, up4, down4 });
    history = history.slice(-10);
    try { localStorage.setItem(historyKey, JSON.stringify(history)); } catch { /* ignore */ }
    const sumUp = history.reduce((a, h) => a + (h.up4 || 0), 0);
    const sumDown = history.reduce((a, h) => a + (h.down4 || 0), 0);
    const ratio = sumDown > 0 ? sumUp / sumDown : (sumUp > 0 ? Infinity : null);

    const metrics = {
      universeSize: equities.length,
      chartSample: scored,
      up4, down4,
      ratio,
      historyDays: history.length,
      up25q, down25q, up25m, down25m, up50m, down50m,
      bull3413, bear3413,
      mmaPlusPct: scored ? (mmaPlus / scored) * 100 : null,
      mmaMinusPct: scored ? (mmaMinus / scored) * 100 : null
    };
    const payload = { asOf: new Date().toISOString(), metrics, day };
    saveBreadthCache(payload);
    renderMmMetrics(metrics, payload.asOf);
    meta.textContent = `Reconstructed MM-style breadth from public EOD/snapshot data — not official Stockbee membership numbers · universe ${metrics.universeSize} quotes · chart sample ${metrics.chartSample} · as of ${payload.asOf}`;
  } catch (error) {
    const cached = loadBreadthCache();
    if (cached) {
      renderMmMetrics(cached.metrics, cached.asOf, true);
      meta.textContent = `Fetch failed (${error.message || "error"}). Showing last successful as-of ${cached.asOf}. Still not official Stockbee MM.`;
    } else {
      host.innerHTML = `<p class="notice-inline">Breadth compute failed: ${error.message || "error"}. No cached reading.</p>`;
      meta.textContent = "No MM-style numbers available.";
    }
  }
}

function renderMmMetrics(m, asOf, fromCache = false) {
  const host = $("mm-metrics");
  const ratioTxt = m.ratio == null ? "—" : (m.ratio === Infinity ? "∞" : m.ratio.toFixed(2));
  const rows = [
    ["4% up (day)", m.up4],
    ["4% down (day)", m.down4],
    [`10-day cum. breadth ratio (${m.historyDays || 0} sess.)`, ratioTxt],
    ["25%+ quarter (sample)", m.up25q],
    ["25%− quarter (sample)", m.down25q],
    ["25%+ month (sample)", m.up25m],
    ["25%− month (sample)", m.down25m],
    ["50%+ month (sample)", m.up50m],
    ["50%− month (sample)", m.down50m],
    ["34/13 bull (sample)", m.bull3413],
    ["34/13 bear (sample)", m.bear3413],
    ["MMA+ % (sample)", m.mmaPlusPct == null ? "—" : m.mmaPlusPct.toFixed(1) + "%"],
    ["MMA− % (sample)", m.mmaMinusPct == null ? "—" : m.mmaMinusPct.toFixed(1) + "%"]
  ];
  host.replaceChildren();
  if (fromCache) {
    const note = document.createElement("p");
    note.className = "notice-inline";
    note.textContent = "Cached reading · as of " + asOf;
    host.appendChild(note);
  }
  const table = document.createElement("table");
  table.className = "mm-table";
  table.innerHTML = "<thead><tr><th>MM-style column</th><th>Reconstructed value</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const [label, value] of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td><strong>${value}</strong></td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);
}

async function loadMinerviniPanel() {
  const host = $("minervini-list");
  const meta = $("minervini-meta");
  host.innerHTML = "<p class='muted'>Screening public charts for trend-template approximations…</p>";
  meta.textContent = "Working…";
  try {
    // Candidates: most-actives + growth tech + liquid universe head
    const [actives, growth] = await Promise.all([
      fetchJson("https://finance-query.com/v2/screeners/most-actives?count=50"),
      fetchJson("https://finance-query.com/v2/screeners/growth-technology-stocks?count=50")
    ]);
    const candidates = [...new Set([
      ...(actives.quotes || []).map(q => String(q.symbol || "").toUpperCase()),
      ...(growth.quotes || []).map(q => String(q.symbol || "").toUpperCase()),
      ...uniqueUniverse().slice(0, 60)
    ].filter(s => s && !s.includes("=") && !s.includes("^")))].slice(0, 90);

    const charts = await mapPool(candidates, 6, sym => fetchChart(sym));
    const passed = [];
    for (let i = 0; i < candidates.length; i++) {
      const chart = charts[i];
      const sym = candidates[i];
      if (!chart || !chart.candles || chart.candles.length < 200) continue;
      const closes = closesFromChart(chart);
      if (closes.length < 200) continue;
      const last = closes[closes.length - 1];
      const ma150 = sma(closes, 150);
      const ma200 = sma(closes, 200);
      if (ma150 == null || ma200 == null) continue;
      // Rising 200MA: compare current 200MA vs ~20 sessions earlier
      const ma200Prev = sma(closes.slice(0, -20), 200);
      const rising200 = ma200Prev != null && ma200 > ma200Prev;
      const aboveMas = last > ma150 && last > ma200;
      const stacked = ma150 > ma200;
      const high52 = Math.max(...closes.slice(-252));
      const nearHigh = last >= high52 * 0.75; // within 25% of 52w high
      const low52 = Math.min(...closes.slice(-252));
      const aboveLow = last >= low52 * 1.25; // at least 25% above 52w low (template-ish)
      if (aboveMas && stacked && rising200 && nearHigh && aboveLow) {
        const rsProxy = pctChange(closes[closes.length - 65] || closes[0], last);
        const tvEx = chart.meta && yahooExToTv(undefined);
        passed.push({
          symbol: sym,
          tv: sym, // bare US default on click
          close: last,
          ma150, ma200,
          rsProxy,
          high52
        });
      }
    }
    passed.sort((a, b) => (b.rsProxy || -999) - (a.rsProxy || -999));
    const top = passed.slice(0, 20);
    host.replaceChildren();
    if (!top.length) {
      host.innerHTML = "<p class='empty'>No names passed the approximate template in this public sample.</p>";
    } else {
      const grid = document.createElement("div");
      grid.className = "minervini-grid";
      for (const row of top) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mover-row";
        btn.addEventListener("click", async () => {
          try { await selectSymbol(row.symbol); } catch (e) { toast(e.message); }
        });
        btn.innerHTML = `<div><strong>${row.symbol}</strong><small>≈ template · RS proxy ${row.rsProxy == null ? "—" : fmtPct(row.rsProxy)}</small></div>
          <div class="mover-stats"><strong>${fmtPx(row.close)}</strong><small>near 52w ${fmtPx(row.high52)}</small></div>`;
        grid.appendChild(btn);
      }
      host.appendChild(grid);
    }
    meta.textContent = `Approximate Minervini trend template on public daily charts (price > rising 150 & 200 MA, 150>200, ≥25% above 52w low, within 25% of 52w high). Not proprietary SEPA. Sampled ${candidates.length} symbols · passed ${passed.length} · showing ${Math.min(20, passed.length)}.`;
  } catch (error) {
    host.innerHTML = `<p class="notice-inline">Minervini screen failed: ${error.message || "error"}</p>`;
    meta.textContent = "Screen unavailable.";
  }
}

$("refresh-movers").addEventListener("click", () => { loadDailyMovers(); });
$("refresh-mm").addEventListener("click", () => { computeMmBreadth(); });
$("refresh-minervini").addEventListener("click", () => { loadMinerviniPanel(); });

loadDailyMovers();
computeMmBreadth();
loadMinerviniPanel();
