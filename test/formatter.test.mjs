// New-behavior unit tests for scripts/formatter.js - no goldens involved.
// These exercise timestampToDate, the intentional Y/YYY pass-through
// divergence from Day.js, and DTF caching.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getFormattedString, timestampToDate } = require('../scripts/formatter.js');

test('timestampToDate: seconds/ms/microseconds boundaries', () => {
  // Just under the ms boundary -> treated as seconds.
  assert.equal(timestampToDate(1e12 - 1).getTime(), (1e12 - 1) * 1000);
  // At the ms boundary -> treated as milliseconds.
  assert.equal(timestampToDate(1e12).getTime(), 1e12);
  // At the microsecond boundary -> treated as microseconds.
  assert.equal(timestampToDate(1e15).getTime(), 1e15 / 1000);

  // Same instant expressed as seconds, milliseconds, and microseconds.
  const sec = 1719855045;
  const ms = 1719855045000;
  const us = 1719855045000000;
  assert.equal(timestampToDate(sec).getTime(), timestampToDate(ms).getTime());
  assert.equal(timestampToDate(ms).getTime(), timestampToDate(us).getTime());
});

test('timestampToDate: non-finite input produces an Invalid Date', () => {
  assert.ok(Number.isNaN(timestampToDate(NaN).getTime()));
  assert.ok(Number.isNaN(timestampToDate(Infinity).getTime()));
  assert.ok(Number.isNaN(timestampToDate(-Infinity).getTime()));
});

test('bare Y/YYY tokens pass through verbatim (documented Day.js divergence)', () => {
  // Day.js renders bare Y/YYY as the UTC offset (a bug) - intentionally not
  // replicated. The new formatter has no Y/YYY entries in its token
  // alternation, so those letters are left untouched in the output.
  const out = getFormattedString(new Date(1700000000 * 1000), 'America/New_York', 'Y YYY', false);
  assert.equal(out, 'Y YYY');
});

test('DTF instances are cached per timezone', () => {
  const OriginalDTF = Intl.DateTimeFormat;
  let constructions = 0;
  class CountingDTF extends OriginalDTF {
    constructor(...args) {
      constructions += 1;
      super(...args);
    }
  }
  Intl.DateTimeFormat = CountingDTF;
  try {
    // Use a tz untouched by any other test in this process so the module's
    // cache can't already hold an entry constructed under the original ctor.
    const date = new Date(1700000000 * 1000);
    getFormattedString(date, 'Europe/London', 'YYYY', false);
    getFormattedString(date, 'Europe/London', 'YYYY', false);
    getFormattedString(date, 'Europe/London', 'MM-DD', false);
    assert.equal(constructions, 1, 'Intl.DateTimeFormat should only be constructed once per tz');
  } finally {
    Intl.DateTimeFormat = OriginalDTF;
  }
});
