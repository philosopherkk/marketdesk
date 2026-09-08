"use strict";
const STORAGE_KEY = "marketdesk:v1";
const BREADTH_CACHE_KEY = "marketdesk:breadth-cache:v1";
/** Bump on every publish. Shown in header/footer. Keep in sync with VERSION file. */
const APP_VERSION = "1.2.0";
const APP_UPDATED = "2026-09-08 HKT";
const $ = id => document.getElementById(id);
const CATALOG = [
  { symbol: "NASDAQ:AAPL", name: "Apple", market: "US" },
  { symbol: "NASDAQ:MSFT", name: "Microsoft", market: "US" },
  { symbol: "NASDAQ:NVDA", name: "NVIDIA", market: "US" },
  { symbol: "NASDAQ:TSLA", name: "Tesla", market: "US" },
  { symbol: "NYSE:BRK.B", name: "Berkshire Hathaway", market: "US" },
  { symbol: "HKEX:700", name: "Tencent", market: "HK" },
  { symbol: "HKEX:9988", name: "Alibaba", market: "HK" },
  { symbol: "HKEX:3690", name: "Meituan", market: "HK" },
  { symbol: "AMEX:SPY", name: "S&P 500 ETF", market: "ETF" },
  { symbol: "NASDAQ:QQQ", name: "Nasdaq-100 ETF", market: "ETF" },
  { symbol: "AMEX:VOO", name: "Vanguard S&P 500 ETF", market: "ETF" },
  { symbol: "HKEX:2800", name: "Tracker Fund of Hong Kong", market: "ETF" },
  { symbol: "CME_MINI:ES1!", name: "E-mini S&P continuous", market: "Futures" },
  { symbol: "CME_MINI:NQ1!", name: "E-mini Nasdaq continuous", market: "Futures" },
  { symbol: "COMEX:GC1!", name: "Gold continuous", market: "Futures" },
  { symbol: "COINBASE:BTCUSD", name: "Bitcoin / USD", market: "Crypto" },
  { symbol: "COINBASE:ETHUSD", name: "Ethereum / USD", market: "Crypto" }
];
const INDICATORS = {
  RSI: "RSI@tv-basicstudies", MACD: "MACD@tv-basicstudies", BB: "BB@tv-basicstudies"
};
const INTERVALS = ["5", "15", "60", "240", "D", "W", "M"];
const MARKETS = ["All", "US", "HK", "ETF", "Futures", "Crypto", "Other"];
const FONT_SCALES = ["small", "medium", "large"];
const THEMES = ["dark", "light", "system"];
const defaultMaOverlays = () => ({ emas: true, sma150200: true });
const YAHOO_EX_TO_TV = {
  NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ", NIQ: "NASDAQ",
  NYQ: "NYSE", NYE: "NYSE", NYS: "NYSE",
  ASE: "AMEX", AMX: "AMEX", NYC: "AMEX", PCX: "AMEX", ARCA: "AMEX", BTS: "AMEX"
};
const US_PREFIXED = /^(NASDAQ|NYSE|AMEX):[A-Z0-9][A-Z0-9.-]{0,9}$/;
const EXCHANGE_PREFIXED = /^[A-Z0-9_]+:[A-Z0-9_.!/-]+$/;
const BARE_US = /^[A-Z][A-Z0-9.-]{0,9}$/;

const defaults = () => ({
  version: 1,
  selected: "NASDAQ:AAPL",
  interval: "D",
  indicators: ["RSI", "MACD"],
  maOverlays: defaultMaOverlays(),
  watchlist: CATALOG.map(item => item.symbol),
  trades: [],
  fontScale: "medium",
  theme: "dark",
  tapeOverride: null
});

const validSymbol = value => typeof value === "string" && value.length <= 80 && EXCHANGE_PREFIXED.test(value);
function defaultStopLoss(side, entry) {
  if (!Number.isFinite(entry) || entry <= 0) return null;
  return side === "short" ? Number((entry * 1.05).toFixed(8)) : Number((entry * 0.95).toFixed(8));
}
function validTrade(t) {
  return t && typeof t.id === "string" && validSymbol(t.symbol) && ["long", "short"].includes(t.side) &&
    typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    Number.isFinite(t.entry) && (t.exit === null || Number.isFinite(t.exit)) &&
    (t.target === null || t.target === undefined || Number.isFinite(t.target)) &&
    (t.stopLoss === null || t.stopLoss === undefined || Number.isFinite(t.stopLoss)) &&
    (t.exitDate === null || t.exitDate === undefined || t.exitDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(t.exitDate)) &&
    Number.isFinite(t.quantity) && t.quantity > 0 && Number.isFinite(t.multiplier) && t.multiplier > 0 &&
    Number.isFinite(t.fees) && t.fees >= 0 && typeof t.currency === "string" && /^[A-Z0-9]{2,10}$/.test(t.currency) &&
    typeof t.notes === "string" && t.notes.length <= 2000;
}
function migrateState(data) {
  const next = { ...defaults(), ...data, version: 1 };
  if (!FONT_SCALES.includes(next.fontScale)) next.fontScale = "medium";
  if (!THEMES.includes(next.theme)) next.theme = "dark";
  if (next.tapeOverride != null && typeof next.tapeOverride !== "object") next.tapeOverride = null;
  // Migrate legacy SMA/EMA indicator toggles → named MA overlay sets.
  const rawIndicators = Array.isArray(next.indicators) ? next.indicators : [];
  const hadEma = rawIndicators.includes("EMA");
  const hadSma = rawIndicators.includes("SMA");
  next.indicators = rawIndicators.filter(key => Object.hasOwn(INDICATORS, key));
  if (!next.indicators.length) next.indicators = ["RSI", "MACD"];
  const overlays = { ...defaultMaOverlays(), ...(next.maOverlays || {}) };
  if (typeof overlays.emas !== "boolean") overlays.emas = true;
  if (typeof overlays.sma150200 !== "boolean") overlays.sma150200 = true;
  if (hadEma) overlays.emas = true;
  if (hadSma) overlays.sma150200 = true;
  next.maOverlays = overlays;
  next.watchlist = [...new Set((next.watchlist || []).filter(validSymbol))];
  next.trades = (next.trades || []).map(t => {
    const trade = { target: null, exitDate: null, stopLoss: null, ...t };
    if (trade.stopLoss == null && Number.isFinite(trade.entry)) {
      trade.stopLoss = defaultStopLoss(trade.side, trade.entry);
    }
    return trade;
  });
  if (!validSymbol(next.selected) || !INTERVALS.includes(next.interval) ||
      !Array.isArray(next.indicators) || !next.indicators.every(key => Object.hasOwn(INDICATORS, key)) ||
      !next.maOverlays || typeof next.maOverlays.emas !== "boolean" || typeof next.maOverlays.sma150200 !== "boolean" ||
      !Array.isArray(next.watchlist) || !next.watchlist.every(validSymbol) ||
      !Array.isArray(next.trades) || !next.trades.every(validTrade)) {
    throw new Error("Invalid saved data");
  }
  return next;
}
function localDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
function warn(message) { $("status").textContent = message; $("status").hidden = false; }
let toastTimer;
function toast(message) {
  $("toast").textContent = message; $("toast").hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").hidden = true, 3500);
}
let persistenceBlocked = false;
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    return migrateState(JSON.parse(raw));
  } catch (error) {
    persistenceBlocked = true;
    $("storage-label").textContent = "Temporary session — export to keep";
    warn("Saved data could not be loaded. Existing storage will not be overwritten. Use Export backup.");
    return defaults();
  }
}
let state = loadState();
function persist() {
  if (persistenceBlocked) { toast("Session updated only. Export a backup to keep your changes."); return; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) {
    persistenceBlocked = true;
    $("storage-label").textContent = "Storage unavailable — export to keep";
    warn("Browser storage is unavailable or full. Export a backup before closing.");
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
function yahooExToTv(exchange) {
  return YAHOO_EX_TO_TV[exchange] || null;
}
function catalogTvForBare(bare) {
  const hit = CATALOG.find(item => item.symbol.endsWith(":" + bare) && ["US", "ETF"].includes(item.market));
  return hit ? hit.symbol : null;
}
async function resolveBareUsSymbol(bare) {
  const known = catalogTvForBare(bare);
  if (known) return known;
  const data = await fetchJson("https://finance-query.com/v2/lookup?q=" + encodeURIComponent(bare));
  const quotes = data.quotes || [];
  const us = quotes.filter(q => {
    const sym = String(q.symbol || "").toUpperCase();
    const type = String(q.quoteType || "").toLowerCase();
    return sym === bare && (type === "equity" || type === "etf") && yahooExToTv(q.exchange);
  });
  const preferred = us[0];
  if (!preferred) throw new Error("No US listing found for " + bare + ". Try NASDAQ:… / NYSE:… or HKEX:…");
  return `${yahooExToTv(preferred.exchange)}:${bare.replace(/-/g, ".")}`;
}
/** Sync or async: prefixed symbols sync; bare US tickers may need lookup. */
async function normalizeSymbol(value) {
  const raw = value.trim().toUpperCase();
  if (!raw) throw new Error("Enter a ticker, for example AAPL or HKEX:700.");
  if (EXCHANGE_PREFIXED.test(raw)) {
    if (!validSymbol(raw)) throw new Error("Use EXCHANGE:TICKER, for example NASDAQ:AAPL or HKEX:700.");
    return raw;
  }
  if (!BARE_US.test(raw)) throw new Error("Use AAPL (US default) or NASDAQ:AAPL / HKEX:700.");
  return resolveBareUsSymbol(raw);
}
function normalizeSymbolSync(value) {
  const raw = value.trim().toUpperCase();
  if (EXCHANGE_PREFIXED.test(raw)) {
    if (!validSymbol(raw)) throw new Error("Use EXCHANGE:TICKER, for example NASDAQ:AAPL or HKEX:700.");
    return raw;
  }
  if (!BARE_US.test(raw)) throw new Error("Use AAPL (US default) or NASDAQ:AAPL / HKEX:700.");
  const known = catalogTvForBare(raw);
  if (known) return known;
  // Optimistic US NASDAQ path for typed bare symbols already on watchlist forms when offline lookup not run yet
  throw new Error("Resolving US listing… use Open chart once, or type NASDAQ:" + raw);
}

function applyFontScale() {
  document.documentElement.dataset.fontScale = state.fontScale || "medium";
  document.querySelectorAll("[data-font-scale]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-font-scale") === state.fontScale);
  });
}
function resolvedTheme() {
  if (state.theme === "light") return "light";
  if (state.theme === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  const btn = $("theme-toggle");
  if (btn) btn.textContent = theme === "light" ? "Dark" : "Daylight";
}
