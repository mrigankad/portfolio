import test from 'node:test';
import assert from 'node:assert/strict';
import { easeInOutCubic, placeholderCropSpec, avgHex, frameName } from '../tools/clip-utils.mjs';

test('easeInOutCubic hits endpoints and midpoint', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});

test('first placeholder frame is a zoomed window centered on the face', () => {
  const s = placeholderCropSpec(0, 80, 3200, 1800, 1600, 400);
  assert.equal(s.w, 1000);              // 3200 / 3.2
  assert.equal(s.h, 563);               // round(1800 / 3.2)
  assert.equal(s.x, 1100);              // 1600 - 1000/2
  assert.equal(s.y, 119);               // round(400 - 562.5/2)
});

test('last placeholder frame is the full image', () => {
  const s = placeholderCropSpec(79, 80, 3200, 1800, 1600, 400);
  assert.deepEqual(s, { w: 3200, h: 1800, x: 0, y: 0 });
});

test('crop window grows monotonically and stays in bounds', () => {
  let prev = 0;
  for (let i = 0; i < 80; i++) {
    const s = placeholderCropSpec(i, 80, 3200, 1800, 1600, 200);
    assert.ok(s.w >= prev, `w shrank at frame ${i}`);
    assert.ok(s.x >= 0 && s.y >= 0);
    assert.ok(s.x + s.w <= 3200 && s.y + s.h <= 1800, `out of bounds at frame ${i}`);
    prev = s.w;
  }
});

test('avgHex averages raw RGB24 bytes', () => {
  assert.equal(avgHex(Buffer.from([255, 0, 0, 255, 0, 0])), '#ff0000');
  assert.equal(avgHex(Buffer.from([0, 0, 0, 255, 255, 255])), '#808080');
  assert.equal(avgHex(Buffer.from([246, 241, 233])), '#f6f1e9');
});

test('frameName pads to 4 digits, 1-based', () => {
  assert.equal(frameName(0), 'hero-0001.webp');
  assert.equal(frameName(79), 'hero-0080.webp');
});
