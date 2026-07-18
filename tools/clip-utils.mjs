export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Crop window for placeholder hero frame i (0-based) of `count`:
// starts tight on the face at `startZoom`, ends as the full image.
export function placeholderCropSpec(i, count, imgW, imgH, faceX, faceY, startZoom = 3.2) {
  const t = count <= 1 ? 1 : i / (count - 1);
  const e = easeInOutCubic(t);
  const zoom = startZoom + (1 - startZoom) * e;
  const w = Math.round(imgW / zoom);
  const h = Math.round(imgH / zoom);
  const cx = faceX + (imgW / 2 - faceX) * e;
  const cy = faceY + (imgH / 2 - faceY) * e;
  const x = Math.min(Math.max(Math.round(cx - w / 2), 0), imgW - w);
  const y = Math.min(Math.max(Math.round(cy - h / 2), 0), imgH - h);
  return { w, h, x, y };
}

export function avgHex(buf) {
  let r = 0, g = 0, b = 0;
  const n = buf.length / 3;
  for (let i = 0; i < buf.length; i += 3) { r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; }
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function frameName(i) {
  return `hero-${String(i + 1).padStart(4, '0')}.webp`;
}
