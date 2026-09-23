"use strict";

let quoteRequestId = 0;

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

function renderIndicatorControls() {
  renderOscillatorControls();
}

$("interval").value = state.interval;
$("interval").addEventListener("change", event => {
  state.interval = event.target.value; persist();
  // Native chart always uses daily bars; interval is retained for preference only.
  if (window.MarketDeskNative) MarketDeskNative.setIntervalLabel(state.interval);
});
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

/** In-memory cache: yahooSymbol|enText → Traditional Chinese paraphrase. */
const zhParaphraseCache = new Map();

/** Protect common corp abbreviations so "Inc." / "Ltd." do not end a sentence early. */
function protectAbbreviations(text) {
  return String(text || "")
    .replace(/\b(Inc|Ltd|Corp|Co|LLC|LLP|PLC|S\.A|N\.V|A\.G|B\.V)\./gi, "$1\u0001");
}
function restoreAbbreviations(text) {
  return String(text || "").replace(/\u0001/g, ".");
}

/** First 1–2 sentences, capped — readable beside the ticker title. */
function shortenBusinessSummary(raw, maxSentences = 2, maxChars = 320) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const protectedText = protectAbbreviations(text);
  const parts = protectedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [protectedText];
  let out = "";
  for (let i = 0; i < parts.length && i < maxSentences; i++) {
    const piece = parts[i].trim();
    if (!piece) continue;
    const next = out ? `${out} ${piece}` : piece;
    if (out && next.length > maxChars) break;
    out = next;
    if (out.length >= maxChars) break;
  }
  if (!out) out = protectedText.slice(0, maxChars);
  out = restoreAbbreviations(out);
  if (out.length > maxChars) {
    out = out.slice(0, maxChars).replace(/\s+\S*$/, "").trim() + "…";
  }
  return out;
}

function pickApiZhSummary(data) {
  const candidates = [
    data.longBusinessSummaryZhTw,
    data.longBusinessSummaryZh,
    data.longBusinessSummaryZH,
    data.businessSummaryZhTw,
    data.businessSummaryZh
  ];
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (s) return shortenBusinessSummary(s);
  }
  return "";
}

/** True when text has enough CJK ideographs to look like a real zh paraphrase. */
function looksLikeZhTw(text) {
  const s = String(text || "");
  const cjk = s.match(/[\u4e00-\u9fff]/g);
  return !!(cjk && cjk.length >= 8);
}

/**
 * Reject clearly broken MT (quota banners, empty, or unrelated stock/futures filler
 * that is not grounded in the English snapshot sentence).
 */
function isAcceptableZhParaphrase(translated, english) {
  const zh = String(translated || "").trim();
  const en = String(english || "");
  if (!zh || !looksLikeZhTw(zh)) return false;
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID|RATE LIMIT/i.test(zh)) return false;
  if (zh.toLowerCase() === en.toLowerCase()) return false;
  // Drop garbled inserts that invent market-data caveats not present in EN.
  if (/股票與期貨|股票与期货|不受股票/.test(zh) && !/stock|future|futures|index/i.test(en)) {
    return false;
  }
  return true;
}

async function translateViaGoogleGtx(english) {
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q="
    + encodeURIComponent(String(english).slice(0, 450));
  const payload = await fetchJson(url);
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
  return payload[0].map(part => (part && part[0]) || "").join("").trim();
}

async function translateViaMyMemory(english) {
  const url = "https://api.mymemory.translated.net/get?q="
    + encodeURIComponent(String(english).slice(0, 450))
    + "&langpair=en|zh-TW";
  const payload = await fetchJson(url);
  const translated = String(payload && payload.responseData && payload.responseData.translatedText || "").trim();
  const status = Number(payload && payload.responseStatus);
  if (!translated || (status && status !== 200)) return "";
  return translated;
}

/**
 * Faithful Traditional Chinese paraphrase of the English snapshot summary.
 * Prefer API zh fields when present; otherwise CORS-open en→zh-TW (Google gtx,
 * then MyMemory). Never invent products — only paraphrase the factual English text.
 */
async function paraphraseToZhTw(english, yahooSymbol) {
  const en = String(english || "").trim();
  if (!en) return "";
  const cacheKey = `${yahooSymbol || ""}|${en}`;
  if (zhParaphraseCache.has(cacheKey)) return zhParaphraseCache.get(cacheKey);

  const tryOne = async (fn) => {
    try {
      const zh = await fn(en);
      return isAcceptableZhParaphrase(zh, en) ? zh : "";
    } catch {
      return "";
    }
  };

  const zh = (await tryOne(translateViaGoogleGtx)) || (await tryOne(translateViaMyMemory));
  if (zh) zhParaphraseCache.set(cacheKey, zh);
  return zh;
}

function clearTickerBusiness(statusText) {
  const zhEl = $("ticker-business-zh");
  const enEl = $("ticker-business-en");
  const status = $("ticker-business-status");
  if (!zhEl || !enEl || !status) return;
  zhEl.hidden = true; zhEl.textContent = "";
  enEl.hidden = true; enEl.textContent = "";
  status.hidden = !statusText;
  status.textContent = statusText || "";
}

async function renderTickerBusiness(data, yahooSymbol, requestId, symbolAtStart) {
  const zhEl = $("ticker-business-zh");
  const enEl = $("ticker-business-en");
  const status = $("ticker-business-status");
  if (!zhEl || !enEl || !status) return;

  const enFull = String(data.longBusinessSummary || data.description || "").trim();
  const enShort = shortenBusinessSummary(enFull);
  if (!enShort) {
    clearTickerBusiness("No company description in this snapshot.");
    return;
  }

  enEl.textContent = enShort;
  enEl.hidden = false;
  status.hidden = true;
  status.textContent = "";

  let zh = pickApiZhSummary(data);
  if (!zh) zh = await paraphraseToZhTw(enShort, yahooSymbol);
  if (requestId !== quoteRequestId || state.selected !== symbolAtStart) return;

  if (zh) {
    zhEl.textContent = zh;
    zhEl.hidden = false;
  } else {
    zhEl.hidden = true;
    zhEl.textContent = "";
    status.hidden = false;
    status.textContent = "繁中摘要暫不可用（英文來自 snapshot）。";
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
  clearTickerBusiness("Loading business summary…");
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
    await renderTickerBusiness(data, y, requestId, symbolAtStart);
  } catch (error) {
    if (requestId !== quoteRequestId || state.selected !== symbolAtStart) return;
    clearQuoteFields("—");
    clearTickerBusiness("Business summary unavailable.");
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
