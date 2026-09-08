"use strict";
const STORAGE_KEY = "marketdesk:v1";
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
  RSI: "RSI@tv-basicstudies", MACD: "MACD@tv-basicstudies",
  SMA: "MASimple@tv-basicstudies", EMA: "MAExp@tv-basicstudies", BB: "BB@tv-basicstudies"
};
const INTERVALS = ["5", "15", "60", "240", "D", "W", "M"];
const MARKETS = ["All", "US", "HK", "ETF", "Futures", "Crypto", "Other"];
const defaults = () => ({
  version: 1, selected: "NASDAQ:AAPL", interval: "D",
  indicators: ["RSI", "MACD"],
  watchlist: CATALOG.map(item => item.symbol),
  trades: []
});
const validSymbol = value => typeof value === "string" && value.length <= 80 && /^[A-Z0-9_]+:[A-Z0-9_.!/-]+$/.test(value);
function normalizeSymbol(value) {
  const symbol = value.trim().toUpperCase();
  if (!validSymbol(symbol)) throw new Error("Use EXCHANGE:TICKER, for example NASDAQ:AAPL or HKEX:700.");
  return symbol;
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
function validTrade(t) {
  return t && typeof t.id === "string" && validSymbol(t.symbol) && ["long", "short"].includes(t.side) &&
    typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    Number.isFinite(t.entry) && (t.exit === null || Number.isFinite(t.exit)) &&
    (t.target === null || t.target === undefined || Number.isFinite(t.target)) &&
    (t.exitDate === null || t.exitDate === undefined || t.exitDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(t.exitDate)) &&
    Number.isFinite(t.quantity) && t.quantity > 0 && Number.isFinite(t.multiplier) && t.multiplier > 0 &&
    Number.isFinite(t.fees) && t.fees >= 0 && typeof t.currency === "string" && /^[A-Z0-9]{2,10}$/.test(t.currency) &&
    typeof t.notes === "string" && t.notes.length <= 2000;
}
let persistenceBlocked = false;
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw);
    if (data.version !== 1 || !validSymbol(data.selected) || !INTERVALS.includes(data.interval) ||
        !Array.isArray(data.indicators) || !data.indicators.every(key => Object.hasOwn(INDICATORS, key)) ||
        !Array.isArray(data.watchlist) || !data.watchlist.every(validSymbol) ||
        !Array.isArray(data.trades) || !data.trades.every(validTrade)) {
      throw new Error("Invalid saved data");
    }
    data.watchlist = [...new Set(data.watchlist)];
    data.trades = data.trades.map(t => ({ target: null, exitDate: null, ...t }));
    return data;
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
