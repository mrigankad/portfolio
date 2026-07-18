import test from 'node:test';
import assert from 'node:assert/strict';
import { frameIndexForProgress, coverRect } from '../js/scrub-math.js';

test('frameIndexForProgress maps and clamps', () => {
  assert.equal(frameIndexForProgress(0, 80), 0);
  assert.equal(frameIndexForProgress(1, 80), 79);
  assert.equal(frameIndexForProgress(0.5, 80), 40);   // round(39.5)
  assert.equal(frameIndexForProgress(-0.2, 80), 0);
  assert.equal(frameIndexForProgress(1.7, 80), 79);
});

test('coverRect crops source sides for a taller destination', () => {
  // 1600x900 source into a 300x400 (3:4) destination: full height, sides cropped.
  const r = coverRect(1600, 900, 300, 400);
  assert.equal(r.sh, 900);
  assert.equal(r.sw, 675);            // 900 * 3/4
  assert.equal(r.sx, 462.5);          // (1600 - 675) / 2
  assert.equal(r.sy, 0);
});

test('coverRect crops top/bottom for a wider destination', () => {
  const r = coverRect(1000, 1000, 200, 100);
  assert.equal(r.sw, 1000);
  assert.equal(r.sh, 500);
  assert.deepEqual([r.sx, r.sy], [0, 250]);
});

test('coverRect is identity when aspects match', () => {
  assert.deepEqual(coverRect(1600, 900, 320, 180), { sx: 0, sy: 0, sw: 1600, sh: 900 });
});
