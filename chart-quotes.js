function renderChart() {
  const host = $("chart"); host.replaceChildren();
  const container = document.createElement("div");
  container.className = "tradingview-widget-container";
  container.style.height = "100%"; container.style.width = "100%";
  const chart = document.createElement("div");
  chart.className = "tradingview-widget-container__widget";
  chart.style.height = "calc(100% - 32px)"; chart.style.width = "100%";
  const credit = document.createElement("div"); credit.className = "tradingview-widget-copyright";
  const link = document.createElement("a");
  link.href = "https://www.tradingview.com/chart/?symbol=" + encodeURIComponent(state.selected);
  link.target = "_blank"; link.rel = "noopener nofollow"; link.textContent = `${state.selected} chart`;
  const attribution = document.createElement("span"); attribution.textContent = "by TradingView";
  credit.append(link, attribution);
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.type = "text/javascript"; script.async = true;
  script.textContent = JSON.stringify({
    autosize: true, symbol: state.selected, interval: state.interval, timezone: "exchange",
    theme: "dark", style: "1", locale: "en", backgroundColor: "#0f172a",
    gridColor: "rgba(148, 163, 184, 0.08)", hide_top_toolbar: false, hide_side_toolbar: false,
    hide_legend: false, hide_volume: false, withdateranges: true, save_image: true,
    allow_symbol_change: false, calendar: false, details: false, hotlist: false,
    studies: state.indicators.map(key => INDICATORS[key]), support_host: "https://www.tradingview.com"
  });
  script.onerror = () => { if (container.isConnected) toast("Chart script could not load."); };
  container.append(chart, credit); host.appendChild(container); container.appendChild(script);
}
function renderIndicatorControls() {
  $("indicator-controls").replaceChildren();
  for (const key of Object.keys(INDICATORS)) {
    const label = document.createElement("label"); label.className = "check";
    const checkbox = document.createElement("input"); checkbox.type = "checkbox";
    checkbox.checked = state.indicators.includes(key);
    checkbox.addEventListener("change", () => {
      state.indicators = checkbox.checked ? [...new Set([...state.indicators, key])] : state.indicators.filter(item => item !== key);
      persist(); renderChart();
    });
    label.append(checkbox, document.createTextNode(key));
    $("indicator-controls").appendChild(label);
  }
}
$("interval").value = state.interval;
$("interval").addEventListener("change", event => { state.interval = event.target.value; persist(); renderChart(); });
$("reload-chart").addEventListener("click", renderChart);
function toYahooSymbol(tv) {
  const [ex, raw] = tv.split(":");
  const ticker = raw.replace(/\./g, "-");
  if (ex === "HKEX") return ticker.replace(/[^0-9]/g, "").padStart(4, "0") + ".HK";
  if (["COINBASE", "BINANCE", "KRAKEN", "BITSTAMP", "CRYPTO"].includes(ex)) {
    if (ticker.endsWith("USD")) return ticker.slice(0, -3) + "-USD";
    if (ticker.endsWith("USDT")) return ticker.slice(0, -4) + "-USD";
    return ticker;
  }
  if (ticker.endsWith("1!")) {
    const root = ticker.replace(/1!$/, "");
    const map = { ES: "ES=F", NQ: "NQ=F", GC: "GC=F", CL: "CL=F", YM: "YM=F" };
    return map[root] || (root + "=F");
  }
  return ticker;
}
async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
const fmtPx = v => Number.isFinite(Number(v)) ? Number(v).toLocaleString("en-US", { maximumFractionDigits: 8 }) : "—";
const fmtVol = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
};
async function loadQuote() {
  const priceEl = $("quote-price"), chEl = $("quote-change"), meta = $("quote-meta");
  priceEl.textContent = "…"; chEl.textContent = "…"; chEl.className = "";
  $("quote-prev").textContent = $("quote-open").textContent = $("quote-range").textContent = $("quote-vol").textContent = $("quote-52w").textContent = "…";
  meta.textContent = "Fetching Yahoo-style snapshot…";
  try {
    const y = toYahooSymbol(state.selected);
    const data = await fetchJson("https://finance-query.com/v2/quote/" + encodeURIComponent(y));
    const last = data.regularMarketPrice ?? data.currentPrice;
    if (!Number.isFinite(Number(last))) throw new Error("no last");
    const prev = data.regularMarketPreviousClose ?? data.previousClose;
    const chPct = Number.isFinite(Number(data.regularMarketChangePercent))
      ? Number(data.regularMarketChangePercent)
      : (Number.isFinite(Number(prev)) && Number(prev) !== 0 ? (Number(last) - Number(prev)) / Number(prev) * 100 : NaN);
    const chAbs = data.regularMarketChange;
    priceEl.textContent = fmtPx(last);
    if (Number.isFinite(chPct)) {
      const abs = Number.isFinite(Number(chAbs)) ? `${Number(chAbs) >= 0 ? "+" : ""}${fmtPx(chAbs)} ` : "";
      chEl.textContent = `${abs}${chPct >= 0 ? "+" : ""}${chPct.toFixed(2)}%`;
      chEl.className = chPct >= 0 ? "positive" : "negative";
    } else chEl.textContent = "—";
    $("quote-prev").textContent = fmtPx(prev);
    $("quote-open").textContent = fmtPx(data.regularMarketOpen ?? data.open);
    const lo = data.regularMarketDayLow ?? data.dayLow;
    const hi = data.regularMarketDayHigh ?? data.dayHigh;
    $("quote-range").textContent = (lo != null && hi != null) ? `${fmtPx(lo)} – ${fmtPx(hi)}` : "—";
    $("quote-vol").textContent = fmtVol(data.regularMarketVolume ?? data.volume);
    const wlo = data.fiftyTwoWeekLow, whi = data.fiftyTwoWeekHigh;
    $("quote-52w").textContent = (wlo != null && whi != null) ? `${fmtPx(wlo)} – ${fmtPx(whi)}` : "—";
    const asof = data.regularMarketTime ? new Date(Number(data.regularMarketTime) * 1000).toISOString() : "";
    meta.textContent = `${data.shortName || y} · ${y} · ${data.currency || ""} · ${data.marketState || ""} · ${asof} · homework print`;
  } catch (error) {
    priceEl.textContent = "—"; chEl.textContent = "unavailable"; chEl.className = "";
    $("quote-prev").textContent = $("quote-open").textContent = $("quote-range").textContent = $("quote-vol").textContent = $("quote-52w").textContent = "—";
    meta.textContent = "Snapshot failed. " + (error.message || "");
  }
}
$("refresh-quote").addEventListener("click", loadQuote);
setInterval(() => { if (document.visibilityState === "visible") loadQuote(); }, 300000);
