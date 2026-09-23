function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$("export").addEventListener("click", () => {
  // Workspace backup never includes Massive/IB secrets (separate localStorage bucket).
  const backup = MarketDeskSecrets.scrubBackupObject({ ...state, exportedAt: new Date().toISOString() });
  downloadBlob(`marketdesk-backup-${localDate()}.json`, new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  toast("Backup exported (API keys excluded).");
});
$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async event => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const data = migrateState(JSON.parse(await file.text()));
    const preview = `${data.watchlist.length} tickers, ${data.trades.length} trades, selected ${data.selected}`;
    if (!confirm(`Replace current workspace with this backup?\n${preview}`)) return;
    state = data;
    persist();
    $("symbol-input").value = state.selected;
    $("current-symbol").textContent = state.selected;
    $("interval").value = state.interval;
    applyFontScale(); applyTheme(); applyTradeFormCollapsed();
    renderMarkets(); renderIndicatorControls(); renderWatchlist();
    resetTradeForm(); renderJournal(); renderChart(); loadQuote();
    toast("Backup imported.");
  } catch (error) { toast(error.message || "Import failed."); }
});
$("export-csv").addEventListener("click", () => {
  const header = ["id","date","exitDate","symbol","side","quantity","multiplier","entry","target","stopLoss","exit","fees","currency","notes","pnl"];
  const rows = state.trades.map(t => {
    const pnl = calculatePnL(t);
    return [t.id, t.date, t.exitDate || "", t.symbol, t.side, t.quantity, t.multiplier, t.entry, t.target ?? "", t.stopLoss ?? "", t.exit ?? "", t.fees, t.currency, `"${(t.notes || "").replace(/"/g, '""')}"`, pnl === null ? "" : pnl].join(",");
  });
  downloadBlob(`marketdesk-journal-${localDate()}.csv`, new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" }));
});
let marketFilter = "All";
function metadata(symbol) {
  const known = CATALOG.find(item => item.symbol === symbol);
  if (known) return known;
  const exchange = symbol.split(":")[0];
  let market = "Other";
  if (exchange === "HKEX") market = "HK";
  else if (["NASDAQ", "NYSE", "AMEX"].includes(exchange)) market = "US";
  else if (["CME", "CME_MINI", "COMEX", "NYMEX", "CBOT", "CBOT_MINI", "HKFE"].includes(exchange)) market = "Futures";
  else if (["COINBASE", "BINANCE", "KRAKEN", "BITSTAMP", "CRYPTO"].includes(exchange)) market = "Crypto";
  return { symbol, name: "Custom symbol", market };
}
function makeButton(text, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button"; button.textContent = text; button.className = className;
  button.addEventListener("click", onClick); return button;
}
function renderMarkets() {
  $("market-tabs").replaceChildren();
  for (const market of MARKETS) {
    const button = makeButton(market, () => { marketFilter = market; renderMarkets(); renderWatchlist(); }, market === marketFilter ? "active" : "");
    button.setAttribute("aria-pressed", String(market === marketFilter));
    $("market-tabs").appendChild(button);
  }
}
function bareTicker(tvSymbol) {
  const raw = String(tvSymbol || "");
  return (raw.includes(":") ? raw.split(":")[1] : raw).toUpperCase();
}

/**
 * Keep watchlist in EXCHANGE:TICKER form (same as chart). Prepend new symbols so
 * they are visible immediately; drop any duplicate bare-ticker rows (e.g. stale prefix).
 * Returns "added" | "moved" | "present".
 */
function ensureOnWatchlist(symbol, { bumpToFront = false } = {}) {
  if (!validSymbol(symbol)) return "present";
  const bare = bareTicker(symbol);
  const exactIndex = state.watchlist.indexOf(symbol);
  const otherBareDupes = state.watchlist.filter(s => s !== symbol && bareTicker(s) === bare);

  if (exactIndex === -1) {
    const cleaned = state.watchlist.filter(s => bareTicker(s) !== bare);
    state.watchlist = [symbol, ...cleaned];
    return otherBareDupes.length ? "moved" : "added";
  }

  // Exact row present — strip other-prefix bare dupes; optionally bump on Save.
  let list = state.watchlist.filter(s => s === symbol || bareTicker(s) !== bare);
  const cleanedDupes = list.length !== state.watchlist.length;
  if (bumpToFront && list[0] !== symbol) {
    list = [symbol, ...list.filter(s => s !== symbol)];
    state.watchlist = list;
    return "moved";
  }
  if (cleanedDupes) {
    state.watchlist = list;
    return "moved";
  }
  return "present";
}

function renderWatchlist() {
  const list = $("watchlist");
  const query = $("watch-search").value.trim().toLowerCase();
  list.replaceChildren();
  $("watch-count").textContent = state.watchlist.length;
  const visible = state.watchlist.map(metadata).filter(item =>
    (marketFilter === "All" || item.market === marketFilter) &&
    `${item.symbol} ${item.name}`.toLowerCase().includes(query)
  );
  for (const item of visible) {
    const row = document.createElement("div"); row.className = "watch-row";
    const open = makeButton("", () => { selectSymbol(item.symbol); }, "watch-symbol" + (item.symbol === state.selected ? " active" : ""));
    const title = document.createElement("strong"); title.textContent = item.symbol.split(":")[1];
    const subtitle = document.createElement("small"); subtitle.textContent = `${item.name} · ${item.symbol.split(":")[0]}`;
    open.append(title, subtitle); open.title = item.symbol;
    const remove = makeButton("×", () => { state.watchlist = state.watchlist.filter(s => s !== item.symbol); persist(); renderWatchlist(); }, "remove danger");
    row.append(open, remove); list.appendChild(row);
  }
  if (!visible.length) {
    const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No saved tickers match.";
    list.appendChild(empty);
  }
  const active = list.querySelector(".watch-symbol.active");
  if (active && typeof active.scrollIntoView === "function") {
    try { active.scrollIntoView({ block: "nearest" }); } catch { /* */ }
  }
}
let editingId = null; let formDirty = false;
async function selectSymbol(symbolOrBare, { saveToWatchlist = true, bumpWatchlist = false } = {}) {
  const symbol = await normalizeSymbol(String(symbolOrBare));
  state.selected = symbol;
  $("symbol-input").value = symbol;
  $("current-symbol").textContent = symbol;
  if (saveToWatchlist) {
    const result = ensureOnWatchlist(symbol, { bumpToFront: bumpWatchlist });
    if (result === "added") {
      marketFilter = "All";
      if ($("watch-search")) $("watch-search").value = "";
      renderMarkets();
    }
  }
  if (!formDirty && !editingId) resetTradeForm();
  persist(); renderWatchlist(); renderJournal(); renderChart(); loadQuote();
}
$("symbol-form").addEventListener("submit", async event => {
  event.preventDefault();
  try { await selectSymbol($("symbol-input").value, { saveToWatchlist: true }); }
  catch (error) { toast(error.message); }
});
$("save-symbol").addEventListener("click", async () => {
  try {
    const symbol = await normalizeSymbol($("symbol-input").value);
    ensureOnWatchlist(symbol, { bumpToFront: true });
    marketFilter = "All"; $("watch-search").value = "";
    renderMarkets();
    await selectSymbol(symbol, { saveToWatchlist: true, bumpWatchlist: true });
    toast("Ticker saved to watchlist.");
  } catch (error) { toast(error.message); }
});
$("watch-search").addEventListener("input", renderWatchlist);
for (const item of CATALOG) {
  const option = document.createElement("option");
  option.value = item.symbol; option.label = `${item.name} · ${item.market}`;
  $("symbol-options").appendChild(option);
  if (["US", "ETF"].includes(item.market)) {
    const bare = document.createElement("option");
    bare.value = item.symbol.split(":")[1];
    bare.label = `${item.name} · US default`;
    $("symbol-options").appendChild(bare);
  }
}

document.querySelectorAll("[data-font-scale]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.fontScale = btn.getAttribute("data-font-scale");
    persist(); applyFontScale();
  });
});
$("theme-toggle").addEventListener("click", () => {
  const current = resolvedTheme();
  state.theme = current === "light" ? "dark" : "light";
  persist(); applyTheme();
  if (window.MarketDeskNative) MarketDeskNative.setThemePreserveRange();
  else renderChart();
});
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if (state.theme === "system") {
    applyTheme();
    if (window.MarketDeskNative) MarketDeskNative.setThemePreserveRange();
    else renderChart();
  }
});
$("toggle-trade-form").addEventListener("click", () => {
  state.tradeFormCollapsed = !state.tradeFormCollapsed;
  persist(); applyTradeFormCollapsed();
});
applyFontScale();
applyTheme();
applyTradeFormCollapsed();
document.querySelectorAll("[data-app-version]").forEach(el => { el.textContent = APP_VERSION; });
document.querySelectorAll("[data-app-updated]").forEach(el => { el.textContent = APP_UPDATED; });
if (!persistenceBlocked) $("storage-label").textContent = "Saved on this device/browser only · marketdesk:v1";
