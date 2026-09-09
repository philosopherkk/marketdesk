"use strict";
const STORAGE_KEY = "marketdesk:v1";
const BREADTH_CACHE_KEY = "marketdesk:breadth-cache:v1";
/** Bump on every publish. Shown in header/footer. Keep in sync with VERSION file. */
const APP_VERSION = "1.4.0";
const APP_UPDATED = "2026-09-09 HKT";
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
/** Native chart study toggles (drawn by Lightweight Charts — no TradingView). */
const INDICATORS = { Volume: true, RSI: true, MACD: true };
const INTERVALS = ["5", "15", "60", "240", "D", "W", "M"];
const MARKETS = ["All", "US", "HK", "ETF", "Futures", "Crypto", "Other"];
const FONT_SCALES = ["small", "medium", "large"];
const THEMES = ["dark", "light", "system"];
const CHART_PROVIDERS = ["native"];
const MA_PRESETS = ["existing", "momentum", "trend", "fast", "weekly"];
const YAHOO_EX_TO_TV = {
  NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ", NIQ: "NASDAQ",
  NYQ: "NYSE", NYE: "NYSE", NYS: "NYSE",
  ASE: "AMEX", AMX: "AMEX", NYC: "AMEX", PCX: "AMEX", ARCA: "AMEX", BTS: "AMEX"
};
const EXCHANGE_PREFIXED = /^[A-Z0-9_]+:[A-Z0-9_.!/-]+$/;
const BARE_US = /^[A-Z][A-Z0-9.-]{0,9}$/;

/** Astra DEFAULT_OVERLAYS — Existing MarketDesk default (upgrade-safe). */
const DEFAULT_OVERLAYS = () => ([
  { id: "ema10", enabled: true, type: "EMA", period: 10, colorDark: "#f59e0b", colorLight: "#d97706", width: 1, style: "solid" },
  { id: "ema20", enabled: true, type: "EMA", period: 20, colorDark: "#38bdf8", colorLight: "#0284c7", width: 1, style: "solid" },
  { id: "sma50", enabled: true, type: "SMA", period: 50, colorDark: "#a78bfa", colorLight: "#7c3aed", width: 1, style: "solid" },
  { id: "sma150", enabled: false, type: "SMA", period: 150, colorDark: "#34d399", colorLight: "#059669", width: 1, style: "dashed" },
  { id: "sma200", enabled: true, type: "SMA", period: 200, colorDark: "#f472b6", colorLight: "#db2777", width: 2, style: "solid" }
]);

const PRESET_OVERLAYS = {
  existing: DEFAULT_OVERLAYS,
  momentum: () => ([
    { id: "ema10", enabled: true, type: "EMA", period: 10, colorDark: "#f59e0b", colorLight: "#d97706", width: 1, style: "solid" },
    { id: "ema20", enabled: true, type: "EMA", period: 20, colorDark: "#38bdf8", colorLight: "#0284c7", width: 1, style: "solid" },
    { id: "sma50", enabled: true, type: "SMA", period: 50, colorDark: "#a78bfa", colorLight: "#7c3aed", width: 1, style: "solid" },
    { id: "sma150", enabled: false, type: "SMA", period: 150, colorDark: "#34d399", colorLight: "#059669", width: 1, style: "dashed" },
    { id: "sma200", enabled: false, type: "SMA", period: 200, colorDark: "#f472b6", colorLight: "#db2777", width: 2, style: "solid" }
  ]),
  trend: () => ([
    { id: "ema10", enabled: false, type: "EMA", period: 10, colorDark: "#f59e0b", colorLight: "#d97706", width: 1, style: "solid" },
    { id: "ema20", enabled: true, type: "EMA", period: 20, colorDark: "#38bdf8", colorLight: "#0284c7", width: 1, style: "solid" },
    { id: "sma50", enabled: true, type: "SMA", period: 50, colorDark: "#a78bfa", colorLight: "#7c3aed", width: 1, style: "solid" },
    { id: "sma150", enabled: true, type: "SMA", period: 150, colorDark: "#34d399", colorLight: "#059669", width: 1, style: "dashed" },
    { id: "sma200", enabled: true, type: "SMA", period: 200, colorDark: "#f472b6", colorLight: "#db2777", width: 2, style: "solid" }
  ]),
  fast: () => ([
    { id: "ema10", enabled: true, type: "EMA", period: 10, colorDark: "#f59e0b", colorLight: "#d97706", width: 2, style: "solid" },
    { id: "ema20", enabled: true, type: "EMA", period: 20, colorDark: "#38bdf8", colorLight: "#0284c7", width: 1, style: "solid" },
    { id: "sma50", enabled: false, type: "SMA", period: 50, colorDark: "#a78bfa", colorLight: "#7c3aed", width: 1, style: "solid" },
    { id: "sma150", enabled: false, type: "SMA", period: 150, colorDark: "#34d399", colorLight: "#059669", width: 1, style: "dashed" },
    { id: "sma200", enabled: false, type: "SMA", period: 200, colorDark: "#f472b6", colorLight: "#db2777", width: 2, style: "solid" }
  ]),
  weekly: () => ([
    { id: "ema10", enabled: false, type: "EMA", period: 10, colorDark: "#f59e0b", colorLight: "#d97706", width: 1, style: "solid" },
    { id: "ema20", enabled: true, type: "EMA", period: 21, colorDark: "#38bdf8", colorLight: "#0284c7", width: 1, style: "solid" },
    { id: "sma50", enabled: true, type: "SMA", period: 50, colorDark: "#a78bfa", colorLight: "#7c3aed", width: 1, style: "solid" },
    { id: "sma150", enabled: true, type: "SMA", period: 150, colorDark: "#34d399", colorLight: "#059669", width: 1, style: "dashed" },
    { id: "sma200", enabled: true, type: "SMA", period: 200, colorDark: "#f472b6", colorLight: "#db2777", width: 2, style: "solid" }
  ])
};

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function validOverlay(o) {
  return o && typeof o.id === "string" && typeof o.enabled === "boolean" &&
    ["EMA", "SMA"].includes(o.type) && Number.isInteger(o.period) && o.period >= 1 && o.period <= 500 &&
    typeof o.colorDark === "string" && typeof o.colorLight === "string" &&
    Number.isFinite(o.width) && o.width >= 1 && o.width <= 6 &&
    ["solid", "dashed"].includes(o.style);
}

function overlaysFromLegacyMaOverlays(legacy, hadEma, hadSma) {
  const base = DEFAULT_OVERLAYS();
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    if (typeof legacy.emas === "boolean") {
      base.forEach(o => { if (o.type === "EMA") o.enabled = legacy.emas; });
    }
    if (typeof legacy.sma150200 === "boolean") {
      base.forEach(o => {
        if (o.period === 150) o.enabled = false;
        if (o.period === 200) o.enabled = legacy.sma150200;
        if (o.period === 50 && o.type === "SMA") o.enabled = legacy.sma150200 || o.enabled;
      });
    }
  }
  if (hadEma) base.forEach(o => { if (o.type === "EMA") o.enabled = true; });
  if (hadSma) base.forEach(o => { if (o.period === 200) o.enabled = true; });
  return base;
}

const defaults = () => ({
  version: 1,
  selected: "NASDAQ:AAPL",
  interval: "D",
  indicators: ["Volume", "RSI", "MACD"],
  overlays: DEFAULT_OVERLAYS(),
  chartProvider: "native",
  maPreset: "existing",
  tradeFormCollapsed: false,
  watchlist: CATALOG.map(item => item.symbol),
  trades: [],
  fontScale: "medium",
  theme: "dark",
  tapeOverride: null
});

const validSymbol = value => typeof value === "string" && value.length <= 80 && EXCHANGE_PREFIXED.test(value);
function defaultStopLoss(side, entry) {
  const e = finiteOrNull(entry);
  if (e === null || e <= 0) return null;
  return side === "short" ? Number((e * 1.05).toFixed(8)) : Number((e * 0.95).toFixed(8));
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
  // TradingView removed in 1.4.0 — always native Lightweight Charts.
  next.chartProvider = "native";
  if (!MA_PRESETS.includes(next.maPreset)) next.maPreset = "existing";
  next.tradeFormCollapsed = !!next.tradeFormCollapsed;
  if (next.tapeOverride != null && typeof next.tapeOverride !== "object") next.tapeOverride = null;

  const rawIndicators = Array.isArray(data.indicators) ? data.indicators : null;
  if (rawIndicators) {
    // Preserve intentionally empty study selection; drop legacy TV-only keys (EMA/SMA/BB).
    next.indicators = rawIndicators.filter(key => Object.hasOwn(INDICATORS, key));
    // Pre-1.4 saves had RSI/MACD but not Volume — default Volume on when migrating.
    if (!rawIndicators.includes("Volume") && !next.indicators.includes("Volume")) {
      next.indicators = ["Volume", ...next.indicators];
    }
  } else {
    next.indicators = ["Volume", "RSI", "MACD"];
  }
  const hadEma = Array.isArray(data.indicators) && data.indicators.includes("EMA");
  const hadSma = Array.isArray(data.indicators) && data.indicators.includes("SMA");

  if (Array.isArray(data.overlays) && data.overlays.every(validOverlay)) {
    next.overlays = data.overlays.map(o => ({ ...o }));
  } else {
    next.overlays = overlaysFromLegacyMaOverlays(data.maOverlays, hadEma, hadSma);
  }
  delete next.maOverlays;

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
      !Array.isArray(next.overlays) || !next.overlays.every(validOverlay) ||
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
function applyTradeFormCollapsed() {
  const panel = document.querySelector(".trade-panel");
  if (!panel) return;
  panel.classList.toggle("collapsed", !!state.tradeFormCollapsed);
  const btn = $("toggle-trade-form");
  if (btn) btn.textContent = state.tradeFormCollapsed ? "Show trade form" : "Hide trade form";
}
