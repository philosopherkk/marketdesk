"use strict";
const assert = require("assert");
const { movingAverage, finiteNumber } = require("../ma.js");

function approx(a, b, eps = 1e-9) {
  assert.ok(a != null && b != null && Math.abs(a - b) < eps, `expected ${b}, got ${a}`);
}

// SMA(3) on [1,2,3,4,5] → [null,null,2,3,4] — Astra says values [2,3,4] meaning the defined tail
{
  const v = movingAverage([1, 2, 3, 4, 5], 3, "SMA");
  assert.strictEqual(v[0], null);
  assert.strictEqual(v[1], null);
  approx(v[2], 2);
  approx(v[3], 3);
  approx(v[4], 4);
}

// SMA-seeded EMA(3) on [1,2,3,4,5] → first at i=2 is SMA=2, then EMA
{
  const v = movingAverage([1, 2, 3, 4, 5], 3, "EMA");
  assert.strictEqual(v[0], null);
  assert.strictEqual(v[1], null);
  approx(v[2], 2);
  // k = 2/(3+1)=0.5 → ema3 = 4*0.5 + 2*0.5 = 3; ema4 = 5*0.5 + 3*0.5 = 4
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

console.log("ma.test.js OK");
