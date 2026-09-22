"use strict";

/** Draft overlays edited in UI; committed overlays live in state.overlays until Apply. */
let draftOverlays = null;
let quoteRequestId = 0;

function cloneOverlays(list) {
  return (list || []).map(o => ({ ...o }));
}
function ensureDraftOverlays() {
  if (!draftOverlays) draftOverlays = cloneOverlays(state.overlays);
  return draftOverlays;
}

function renderChart() {
  const host = $("chart");
  host.replaceChildren();
  if (window.MarketDeskNative && typeof MarketDeskNative.render === "function") {
    MarketDeskNative.render(host);
  } else {
    host.innerHTML = "<p class='notice-inline'>Native chart module failed to load.</p>";
  }
}

function renderOscillatorControls() {
  $("indicator-controls").replaceChildren();
  for (const key of Object.keys(INDICATORS)) {
    const label = document.createElement("label"); label.className = "check";
    const checkbox = document.createElement("input"); checkbox.type = "checkbox";
    checkbox.checked = state.indicators.includes(key);
    checkbox.addEventListener("change", () => {
      state.indicators = checkbox.checked
        ? [...new Set([...state.indicators, key])]
        : state.indicators.filter(item => item !== key);
      persist();
      if (window.MarketDeskNative && typeof MarketDeskNative.applyIndicators === "function") {
        MarketDeskNative.applyIndicators();
      } else {
        renderChart();
      }
    });
    label.append(checkbox, document.createTextNode(key));
    $("indicator-controls").appendChild(label);
  }
}

function renderOverlayEditor() {
  const host = $("ma-overlay-controls");
  if (!host) return;
  host.replaceChildren();
  const drafts = ensureDraftOverlays();
  const table = document.createElement("div");
  table.className = "overlay-editor stack";
  for (const o of drafts) {
    const row = document.createElement("div");
    row.className = "overlay-row";
    const en = document.createElement("input"); en.type = "checkbox"; en.checked = o.enabled;
    en.addEventListener("change", () => { o.enabled = en.checked; });
    const type = document.createElement("select");
    ["EMA", "SMA"].forEach(t => {
      const opt = document.createElement("option"); opt.value = t; opt.textContent = t; if (o.type === t) opt.selected = true;
      type.appendChild(opt);
    });
    type.addEventListener("change", () => { o.type = type.value; });
    const period = document.createElement("input"); period.type = "number"; period.min = 1; period.max = 500; period.value = o.period;
    period.style.width = "64px";
    period.addEventListener("change", () => {
      const n = Math.round(Number(period.value));
      o.period = Number.isFinite(n) && n >= 1 ? n : o.period;
      period.value = o.period;
    });
    const color = document.createElement("input"); color.type = "color";
    color.value = resolvedTheme() === "light" ? o.colorLight : o.colorDark;
    color.addEventListener("input", () => {
      if (resolvedTheme() === "light") o.colorLight = color.value; else o.colorDark = color.value;
    });
    const width = document.createElement("input"); width.type = "number"; width.min = 1; width.max = 6; width.value = o.width;
    width.style.width = "52px";
    width.addEventListener("change", () => {
      const n = Math.round(Number(width.value));
      o.width = Number.isFinite(n) && n >= 1 ? Math.min(6, n) : o.width;
      width.value = o.width;
    });
    const style = document.createElement("select");
    ["solid", "dashed"].forEach(s => {
      const opt = document.createElement("option"); opt.value = s; opt.textContent = s; if (o.style === s) opt.selected = true;
      style.appendChild(opt);
    });
    style.addEventListener("change", () => { o.style = style.value; });
    const name = document.createElement("span"); name.className = "muted"; name.textContent = o.id;
    row.append(en, type, period, color, width, style, name);
    table.appendChild(row);
  }
  const actions = document.createElement("div"); actions.className = "row";
  const apply = document.createElement("button"); apply.type = "button"; apply.className = "primary"; apply.textContent = "Apply overlays";
  apply.addEventListener("click", () => {
    state.overlays = cloneOverlays(draftOverlays);
    state.maPreset = "existing";
    persist();
    if (window.MarketDeskNative) MarketDeskNative.applyOverlays(state.overlays);
    else renderChart();
    toast("Overlays applied.");
  });
  const reset = document.createElement("button"); reset.type = "button"; reset.textContent = "Reset draft";
  reset.addEventListener("click", () => { draftOverlays = cloneOverlays(state.overlays); renderOverlayEditor(); });
  actions.append(apply, reset);
  host.append(table, actions);
}

function renderChartProviderControls() {
  const preset = $("ma-preset");
  if (preset) preset.value = state.maPreset;
}

function renderIndicatorControls() {
  renderOscillatorControls();
  renderOverlayEditor();
  renderChartProviderControls();
}

$("interval").value = state.interval;
$("interval").addEventListener("change", event => {
  state.interval = event.target.value; persist();
  // Native chart always uses daily bars; interval is retained for preference only.
  if (window.MarketDeskNative) MarketDeskNative.setIntervalLabel(state.interval);
});
$("reload-chart").addEventListener("click", renderChart);

const presetEl = $("ma-preset");
if (presetEl) {
  presetEl.addEventListener("change", () => {
    const key = presetEl.value;
    if (!PRESET_OVERLAYS[key]) return;
    state.maPreset = key;
    state.overlays = PRESET_OVERLAYS[key]();
    draftOverlays = cloneOverlays(state.overlays);
    persist(); renderOverlayEditor();
    if (window.MarketDeskNative) MarketDeskNative.applyOverlays(state.overlays);
    else renderChart();
  });
}

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
const fmtPx = v => {
  const n = finiteOrNull(v);
  return n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 8 });
};
const fmtVol = v => {
  const n = finiteOrNull(v);
  if (n === null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
};

/** Compact USD (or other) market-cap label for the profile block. */
function fmtMarketCapEn(mcap, currency) {
  const n = finiteOrNull(mcap);
  if (n === null || n <= 0) return null;
  const cur = String(currency || "USD").toUpperCase();
  const prefix = cur === "USD" ? "$" : (cur + " ");
  if (n >= 1e12) return `~${prefix}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `~${prefix}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `~${prefix}${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `~${prefix}${(n / 1e3).toFixed(1)}K`;
  return `~${prefix}${Math.round(n).toLocaleString("en-US")}`;
}

/** Traditional Chinese 兆/億/萬 line when currency is USD (matches desk mock style). */
function fmtMarketCapZhUsd(mcap) {
  const n = finiteOrNull(mcap);
  if (n === null || n <= 0) return null;
  // 兆 ≈ 1 trillion (TW/HK financial usage); 億 = 100M
  if (n >= 1e12) return `約 ${(n / 1e12).toFixed(2)} 兆美元`;
  const yi = n / 1e8;
  if (yi >= 0.1) {
    const digits = yi >= 100 ? 0 : 1;
    return `約 ${yi.toFixed(digits)} 億美元`;
  }
  const wan = n / 1e4;
  if (wan >= 1) return `約 ${wan.toFixed(0)} 萬美元`;
  return `約 ${Math.round(n).toLocaleString("zh-HK")} 美元`;
}

function bareFromSelected(tvSymbol, yahooFallback) {
  const raw = String(tvSymbol || "");
  const fromTv = raw.includes(":") ? raw.split(":")[1] : raw;
  const bare = (fromTv || yahooFallback || "").toUpperCase().replace(/-/g, ".");
  return bare || "—";
}

function clearCompanyProfile(statusText) {
  const title = $("company-profile-title");
  const mcap = $("company-profile-mcap");
  const desc = $("company-profile-desc");
  const status = $("company-profile-status");
  if (!title) return;
  title.textContent = bareFromSelected(state.selected);
  if (mcap) { mcap.hidden = true; mcap.textContent = ""; }
  if (desc) { desc.hidden = true; desc.textContent = ""; }
  if (status) {
    status.hidden = !statusText;
    status.textContent = statusText || "";
  }
}

function renderCompanyProfile(data, yahooSymbol) {
  const title = $("company-profile-title");
  const mcapEl = $("company-profile-mcap");
  const descEl = $("company-profile-desc");
  const status = $("company-profile-status");
  if (!title) return;

  const bare = bareFromSelected(state.selected, data.symbol || yahooSymbol);
  const name = String(data.longName || data.shortName || data.displayName || "").trim();
  title.textContent = name ? `${bare} ${name}` : bare;

  const cur = data.currency || data.financialCurrency || "USD";
  const en = fmtMarketCapEn(data.marketCap, cur);
  if (mcapEl) {
    if (en) {
      const zh = String(cur).toUpperCase() === "USD" ? fmtMarketCapZhUsd(data.marketCap) : null;
      mcapEl.textContent = zh
        ? `Market cap: ${en} · 市值：${zh}`
        : `Market cap: ${en}`;
      mcapEl.hidden = false;
    } else {
      mcapEl.hidden = true;
      mcapEl.textContent = "";
    }
  }

  const summary = String(data.longBusinessSummary || "").trim();
  if (descEl) {
    if (summary) {
      descEl.textContent = summary;
      descEl.hidden = false;
    } else {
      descEl.hidden = true;
      descEl.textContent = "";
    }
  }

  if (status) {
    if (!en && !summary) {
      status.hidden = false;
      status.textContent = "No market cap or company description in this snapshot.";
    } else if (!summary) {
      status.hidden = false;
      status.textContent = "Description unavailable for this symbol.";
    } else {
      status.hidden = true;
      status.textContent = "";
    }
  }
}

function clearQuoteFields(placeholder) {
  $("quote-open").textContent = placeholder;
  $("quote-high").textContent = placeholder;
  $("quote-low").textContent = placeholder;
  $("quote-price").textContent = placeholder;
  $("quote-change").textContent = placeholder;
  $("quote-change").className = "";
  $("quote-prev").textContent = placeholder;
  $("quote-vol").textContent = placeholder;
  $("quote-52w").textContent = placeholder;
}
async function loadQuote() {
  const requestId = ++quoteRequestId;
  const symbolAtStart = state.selected;
  const chEl = $("quote-change"), meta = $("quote-meta");
  clearQuoteFields("…");
  clearCompanyProfile("Loading company profile…");
  meta.textContent = "Fetching day snapshot…";
  try {
    const y = toYahooSymbol(symbolAtStart);
    const data = await fetchJson("https://finance-query.com/v2/quote/" + encodeURIComponent(y));
    if (requestId !== quoteRequestId || state.selected !== symbolAtStart) return;
    const close = finiteOrNull(data.regularMarketPrice ?? data.currentPrice ?? data.regularMarketPreviousClose);
    if (close === null) throw new Error("no close");
    const prev = finiteOrNull(data.regularMarketPreviousClose ?? data.previousClose);
    const open = finiteOrNull(data.regularMarketOpen ?? data.open);
    const hi = finiteOrNull(data.regularMarketDayHigh ?? data.dayHigh);
    const lo = finiteOrNull(data.regularMarketDayLow ?? data.dayLow);
    const chPctRaw = finiteOrNull(data.regularMarketChangePercent);
    const chPct = chPctRaw !== null ? chPctRaw
      : (prev !== null && prev !== 0 ? (close - prev) / prev * 100 : null);
    const chAbs = finiteOrNull(data.regularMarketChange);
    $("quote-open").textContent = fmtPx(open);
    $("quote-high").textContent = fmtPx(hi);
    $("quote-low").textContent = fmtPx(lo);
    $("quote-price").textContent = fmtPx(close);
    if (chPct !== null) {
      const abs = chAbs !== null ? `${chAbs >= 0 ? "+" : ""}${fmtPx(chAbs)} ` : "";
      chEl.textContent = `${abs}${chPct >= 0 ? "+" : ""}${chPct.toFixed(2)}%`;
      chEl.className = chPct >= 0 ? "positive" : "negative";
    } else chEl.textContent = "—";
    $("quote-prev").textContent = fmtPx(prev);
    $("quote-vol").textContent = fmtVol(data.regularMarketVolume ?? data.volume);
    const wlo = finiteOrNull(data.fiftyTwoWeekLow), whi = finiteOrNull(data.fiftyTwoWeekHigh);
    $("quote-52w").textContent = (wlo !== null && whi !== null) ? `${fmtPx(wlo)} – ${fmtPx(whi)}` : "—";
    const asof = data.regularMarketTime ? new Date(Number(data.regularMarketTime) * 1000).toISOString() : "";
    meta.textContent = `${data.shortName || y} · ${y} · ${data.currency || ""} · ${data.marketState || ""} · as of ${asof || "—"} · homework snapshot`;
    renderCompanyProfile(data, y);
  } catch (error) {
    if (requestId !== quoteRequestId || state.selected !== symbolAtStart) return;
    clearQuoteFields("—");
    clearCompanyProfile("Company profile unavailable. " + (error.message || ""));
    chEl.textContent = "unavailable";
    meta.textContent = "Snapshot failed. " + (error.message || "");
  }
}
$("refresh-quote").addEventListener("click", loadQuote);
setInterval(() => { if (document.visibilityState === "visible") loadQuote(); }, 300000);

function renderDataSourcePanel(meta) {
  const badge = $("data-source-badge");
  const detail = $("data-source-detail");
  const ibNote = $("ib-index-note");
  const keyInput = $("massive-api-key");
  if (!badge) return;
  const hasKey = MarketDeskSecrets.hasMassiveKey();
  if (keyInput && document.activeElement !== keyInput) {
    keyInput.value = hasKey ? "••••••••••••" : "";
    keyInput.dataset.hasKey = hasKey ? "1" : "0";
  }
  if (meta && meta.preferred) {
    badge.textContent = "Massive.com";
    badge.className = "badge";
  } else {
    badge.textContent = hasKey ? "Fallback" : "Fallback · key needed";
    badge.className = "badge";
  }
  if (detail) {
    const line = meta && MarketDeskData.metaLine(meta);
    detail.textContent = line || (hasKey
      ? "Massive key saved on this device. US equities/ETFs prefer Massive; other symbols use labeled finance-query fallback."
      : "Preferred US OHLC: Massive.com Stocks Developer API. Enter key (local only). Until then: labeled finance-query fallback.");
  }
  if (ibNote) {
    const ib = MarketDeskData.ibIndexCloseStatus();
    ibNote.textContent = `${ib.label}: ${ib.detail}`;
  }
}

function wireDataSourceControls() {
  const save = $("save-massive-key");
  const clear = $("clear-massive-key");
  const keyInput = $("massive-api-key");
  if (keyInput) {
    keyInput.addEventListener("focus", () => {
      if (keyInput.dataset.hasKey === "1") keyInput.value = "";
    });
  }
  if (save) {
    save.addEventListener("click", () => {
      const raw = (keyInput && keyInput.value) || "";
      if (!raw || raw.startsWith("••")) {
        toast("Paste a Massive Stocks Developer API key first.");
        return;
      }
      if (!MarketDeskSecrets.setMassiveKey(raw)) {
        toast("Could not save key to local storage.");
        return;
      }
      toast("Massive key saved on this device only (not in backups).");
      renderDataSourcePanel(null);
      renderChart();
    });
  }
  if (clear) {
    clear.addEventListener("click", () => {
      MarketDeskSecrets.clearMassiveKey();
      if (keyInput) { keyInput.value = ""; keyInput.dataset.hasKey = "0"; }
      toast("Massive key cleared from this device.");
      renderDataSourcePanel(null);
      renderChart();
    });
  }
  renderDataSourcePanel(null);
}
wireDataSourceControls();

