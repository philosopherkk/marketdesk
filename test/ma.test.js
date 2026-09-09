"use strict";
const assert = require("assert");
const { movingAverage, finiteNumber, rsiSeries, macdSeries } = require("../ma.js");

function approx(a, b, eps = 1e-9) {
  assert.ok(a != null && b != null && Math.abs(a - b) < eps, `expected ${b}, got ${a}`);
}

// SMA(3) on [1,2,3,4,5] → [null,null,2,3,4]
{
  const v = movingAverage([1, 2, 3, 4, 5], 3, "SMA");
  assert.strictEqual(v[0], null);
  assert.strictEqual(v[1], null);
  approx(v[2], 2);
  approx(v[3], 3);
  approx(v[4], 4);
}

// SMA-seeded EMA(3) on [1,2,3,4,5]
{
  const v = movingAverage([1, 2, 3, 4, 5], 3, "EMA");
  assert.strictEqual(v[0], null);
  assert.strictEqual(v[1], null);
  approx(v[2], 2);
  approx(v[3], 3);
  approx(v[4], 4);
}

// Flat series stays flat
{
  const v = movingAverage([7, 7, 7, 7, 7], 3, "EMA");
  approx(v[2], 7);
  approx(v[3], 7);
  approx(v[4], 7);
}

// <N bars → no N-MA
{
  const v = movingAverage([1, 2], 3, "SMA");
  assert.deepStrictEqual(v, [null, null]);
}

// Missing never becomes 0
{
  assert.strictEqual(finiteNumber(null), null);
  assert.strictEqual(finiteNumber(undefined), null);
  assert.strictEqual(finiteNumber(""), null);
  assert.strictEqual(finiteNumber("x"), null);
  assert.throws(() => movingAverage([{ close: null }, { close: 1 }, { close: 2 }], 2, "SMA"));
}

// RSI(2) on rising then flat — first value at index 2
{
  const closes = [10, 11, 12, 11, 11];
  const rsi = rsiSeries(closes, 2);
  assert.strictEqual(rsi[0], null);
  assert.strictEqual(rsi[1], null);
  assert.ok(rsi[2] != null && rsi[2] > 50);
  assert.ok(rsi[3] != null && rsi[3] < rsi[2]);
}

// Flat closes → RSI 100 after seed (zero loss)
{
  const rsi = rsiSeries([5, 5, 5, 5, 5], 2);
  approx(rsi[2], 100);
  approx(rsi[3], 100);
}

// MACD defined after slow EMA ready; signal after 9 MACD points
{
  const closes = [];
  for (let i = 0; i < 40; i++) closes.push(100 + i * 0.5);
  const { macd, signal, hist } = macdSeries(closes, 12, 26, 9);
  assert.strictEqual(macd[24], null); // slow EMA starts at index 25
  assert.ok(macd[25] != null);
  let firstSignal = -1;
  for (let i = 0; i < signal.length; i++) if (signal[i] != null) { firstSignal = i; break; }
  assert.ok(firstSignal >= 25);
  assert.ok(hist[firstSignal] != null);
  approx(hist[firstSignal], macd[firstSignal] - signal[firstSignal]);
}

console.log("ma.test.js OK");
