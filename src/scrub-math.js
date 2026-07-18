export function frameIndexForProgress(progress, count) {
  const p = Math.min(1, Math.max(0, progress));
  return Math.round(p * (count - 1));
}

// Centered source crop so that drawing (sx,sy,sw,sh) -> (0,0,dstW,dstH) cover-fits.
export function coverRect(srcW, srcH, dstW, dstH) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}
