"use strict";

/**
 * Moving-average and oscillator helpers for MarketDesk native chart.
 * SMA-seeded EMA: first EMA value = SMA of first `period` closes.
 * RSI: Wilder (RMA) smoothing, period 14 by default.
 * MACD: EMA(12) − EMA(26), signal EMA(9) of MACD, histogram = MACD − signal.
 * No values before enough history; never coerce null/missing to 0.
 */

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractCloses(bars) {
  return bars.map((bar, index) => {
    const close = finiteNumber(bar && (bar.close ?? bar.c));
    if (close === null) throw new Error("Invalid close at bar " + index);
    return close;
  });
}

function closesFrom(barsOrCloses) {
  return Array.isArray(barsOrCloses) && barsOrCloses.length && typeof barsOrCloses[0] === "number"
    ? barsOrCloses.map((v, i) => {
        const n = finiteNumber(v);
        if (n === null) throw new Error("Invalid close at bar " + i);
        return n;
      })
    : extractCloses(barsOrCloses);
}

/** @returns {(number|null)[]} length === closes.length; null until period ready */
function smaSeries(closes, period) {
  if (!Number.isInteger(period) || period < 1) throw new Error("Invalid MA period");
  const out = new Array(closes.length).fill(null);
  if (closes.length < period) return out;
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** SMA-seeded EMA. First value at index period-1 equals SMA(period). */
function emaSeries(closes, period) {
  if (!Number.isInteger(period) || period < 1) throw new Error("Invalid MA period");
  const out = new Array(closes.length).fill(null);
  if (closes.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  let prev = sum / period;
  out[period - 1] = prev;
  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    prev = closes[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * @param {Array<{close:number}|number>} barsOrCloses
 * @param {number} period
 * @param {"SMA"|"EMA"} type
 * @returns {(number|null)[]}
 */
function movingAverage(barsOrCloses, period, type) {
  const closes = closesFrom(barsOrCloses);
  const kind = String(type || "SMA").toUpperCase();
  if (kind === "SMA") return smaSeries(closes, period);
  if (kind === "EMA") return emaSeries(closes, period);
  throw new Error("Unknown MA type: " + type);
}

/**
 * Wilder RSI. First average gain/loss = SMA of first `period` changes.
 * @returns {(number|null)[]}
 */
function rsiSeries(barsOrCloses, period = 14) {
  if (!Number.isInteger(period) || period < 1) throw new Error("Invalid RSI period");
  const closes = closesFrom(barsOrCloses);
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gainSum += ch;
    else lossSum -= ch;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/**
 * MACD (12, 26, 9) with SMA-seeded EMAs.
 * @returns {{ macd: (number|null)[], signal: (number|null)[], hist: (number|null)[] }}
 */
function macdSeries(barsOrCloses, fast = 12, slow = 26, signalPeriod = 9) {
  const closes = closesFrom(barsOrCloses);
  const fastEma = emaSeries(closes, fast);
  const slowEma = emaSeries(closes, slow);
  const macd = closes.map((_, i) => {
    if (fastEma[i] == null || slowEma[i] == null) return null;
    return fastEma[i] - slowEma[i];
  });
  // Signal: EMA of MACD values; seed with SMA of first signalPeriod defined MACD points
  const signal = new Array(closes.length).fill(null);
  const hist = new Array(closes.length).fill(null);
  const defined = [];
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] != null) defined.push({ i, v: macd[i] });
  }
  if (defined.length < signalPeriod) return { macd, signal, hist };
  let sum = 0;
  for (let j = 0; j < signalPeriod; j++) sum += defined[j].v;
  let prev = sum / signalPeriod;
  const firstIdx = defined[signalPeriod - 1].i;
  signal[firstIdx] = prev;
  hist[firstIdx] = macd[firstIdx] - prev;
  const k = 2 / (signalPeriod + 1);
  for (let j = signalPeriod; j < defined.length; j++) {
    prev = defined[j].v * k + prev * (1 - k);
    const idx = defined[j].i;
    signal[idx] = prev;
    hist[idx] = macd[idx] - prev;
  }
  return { macd, signal, hist };
}

function linePointsFromBars(bars, values) {
  const points = [];
  for (let i = 0; i < bars.length; i++) {
    if (values[i] == null) continue;
    const t = bars[i].time ?? bars[i].timestamp;
    if (t == null) continue;
    points.push({ time: t, value: values[i] });
  }
  return points;
}

function histPointsFromBars(bars, values, upColor, downColor) {
  const points = [];
  for (let i = 0; i < bars.length; i++) {
    if (values[i] == null) continue;
    const t = bars[i].time ?? bars[i].timestamp;
    if (t == null) continue;
    points.push({
      time: t,
      value: values[i],
      color: values[i] >= 0 ? upColor : downColor
    });
  }
  return points;
}

const api = {
  movingAverage, finiteNumber, smaSeries, emaSeries, rsiSeries, macdSeries,
  linePointsFromBars, histPointsFromBars
};
if (typeof window !== "undefined") window.MarketDeskMA = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
