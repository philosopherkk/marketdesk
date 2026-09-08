"use strict";

/**
 * Moving-average helpers for MarketDesk native chart.
 * SMA-seeded EMA: first EMA value = SMA of first `period` closes.
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
  const closes = Array.isArray(barsOrCloses) && barsOrCloses.length && typeof barsOrCloses[0] === "number"
    ? barsOrCloses.map((v, i) => {
        const n = finiteNumber(v);
        if (n === null) throw new Error("Invalid close at bar " + i);
        return n;
      })
    : extractCloses(barsOrCloses);
  const kind = String(type || "SMA").toUpperCase();
  if (kind === "SMA") return smaSeries(closes, period);
  if (kind === "EMA") return emaSeries(closes, period);
  throw new Error("Unknown MA type: " + type);
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

if (typeof window !== "undefined") {
  window.MarketDeskMA = { movingAverage, finiteNumber, smaSeries, emaSeries, linePointsFromBars };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { movingAverage, finiteNumber, smaSeries, emaSeries, linePointsFromBars };
}
