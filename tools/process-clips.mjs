import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { placeholderCropSpec, avgHex, frameName } from './clip-utils.mjs';

const FRAMES = 'public/assets/frames';
const HERO_DIR = join(FRAMES, 'hero');
const CLIPS = 'public/assets/clips';
const HERO_COUNT = 80;
const OUT_W = 1920, OUT_H = 1080;   // Full source resolution; anything less looks soft on desktop.
const WEBP_QUALITY = '80';
const REACTIONS = ['c2', 'c3', 'c4', 'c5'];

// Paths under public/ are served from the web root. Strip the prefix for URLs in meta.json.
const webPath = (p) => String(p).replaceAll('\\', '/').replace(/^public\//, '');

function requireFfmpeg() {
  for (const bin of ['ffmpeg', 'ffprobe']) {
    if (spawnSync(bin, ['-version']).status !== 0) {
      console.error(`${bin} not found. Install with: winget install --id Gyan.FFmpeg -e`);
      process.exit(1);
    }
  }
}

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);

function probeSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', file]).toString().trim();
  const [w, h] = out.split('x').map(Number);
  return { w, h };
}

function probeDuration(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', file]).toString().trim());
}

// Average color of an 8x8 patch at (x, y). Crop accepts ffmpeg expressions.
function sampleHex(image, x, y) {
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', image,
    '-vf', `crop=8:8:${x}:${y}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return avgHex(raw);
}
// Edge of the backdrop vignette (page base color) and its lit top-center
// (page gradient center). Both are needed for the page to blend with the clips.
const cornerHex = (image) => sampleHex(image, 4, 4);
const centerTopHex = (image) => sampleHex(image, 'iw/2-4', 40);

function lastframe(clip, outPath) {
  const out = outPath ?? join(dirname(clip), basename(clip, extname(clip)) + '.last.png');
  ff(['-sseof', '-0.15', '-i', clip, '-update', '1', '-frames:v', '1', out]);
  console.log(out);
  return out;
}

function writeMeta(extra) {
  const posters = {};
  for (const k of ['c1', ...REACTIONS]) posters[k] = webPath(`${FRAMES}/poster-${k}.png`);
  const count = readdirSync(HERO_DIR).filter((f) => f.endsWith('.webp')).length;
  const meta = {
    bgHex: extra.bgHex,
    bgLightHex: extra.bgLightHex,
    hero: { count, dir: webPath(`${FRAMES}/hero`), width: OUT_W, height: OUT_H },
    hasClips: extra.hasClips,
    posters,
    clips: extra.clips,
  };
  writeFileSync(join(FRAMES, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`meta.json written (${count} hero frames, bg ${extra.bgHex}/${extra.bgLightHex}, hasClips ${extra.hasClips})`);
}

function placeholders() {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(HERO_DIR, { recursive: true });
  const srcPng = 'public/assets/character.png';
  const { w: srcW, h: srcH } = probeSize(srcPng);
  const bgHex = cornerHex(srcPng);

  // Pad the portrait character onto a 16:9 canvas of the sampled background color.
  const padW = Math.ceil((srcH * 16 / 9) / 2) * 2;
  const padded = join(FRAMES, 'padded.png');
  ff(['-i', srcPng, '-vf', `pad=${padW}:${srcH}:(ow-iw)/2:0:color=${bgHex}`, padded]);

  // Face location constants for THIS placeholder image (fractions of the padded canvas).
  const faceX = Math.round(padW / 2);
  const faceY = Math.round(srcH * 0.18);

  for (let i = 0; i < HERO_COUNT; i++) {
    const { w, h, x, y } = placeholderCropSpec(i, HERO_COUNT, padW, srcH, faceX, faceY);
    ff(['-i', padded, '-vf', `crop=${w}:${h}:${x}:${y},scale=${OUT_W}:${OUT_H}:flags=lanczos`,
      '-quality', WEBP_QUALITY, join(HERO_DIR, frameName(i))]);
  }
  for (const k of ['c1', ...REACTIONS]) {
    ff(['-i', padded, '-vf', `scale=960:-2`, join(FRAMES, `poster-${k}.png`)]);
  }
  rmSync(padded);
  writeMeta({ bgHex, bgLightHex: bgHex, hasClips: false, clips: null });
}

function build() {
  for (const k of ['c1', ...REACTIONS]) {
    if (!existsSync(join(CLIPS, `${k}.mp4`))) {
      console.error(`Missing ${join(CLIPS, `${k}.mp4`)}. Download it from Flow first.`);
      process.exit(1);
    }
  }
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(HERO_DIR, { recursive: true });

  // Hero frame sequence from c1 (10 fps, 1600px wide WebP).
  // -f image2 + -c:v libwebp: without these, ffmpeg 8 picks the animated-webp
  // encoder and packs every frame into a single file.
  ff(['-i', join(CLIPS, 'c1.mp4'), '-vf', `fps=10,scale=${OUT_W}:${OUT_H}:flags=lanczos`,
    '-f', 'image2', '-c:v', 'libwebp', '-quality', WEBP_QUALITY, join(HERO_DIR, 'hero-%04d.webp')]);

  // Posters: the LAST frame of each clip (= that section's resting pose).
  for (const k of ['c1', ...REACTIONS]) {
    lastframe(join(CLIPS, `${k}.mp4`), join(FRAMES, `poster-${k}.png`));
  }

  // Web-optimized muted reaction clips.
  const clips = {};
  for (const k of REACTIONS) {
    const out = join(FRAMES, `${k}.web.mp4`);
    // Keep the full 1920px resolution. The stage crops to a 3:4 window, so any
    // downscale here shows as blur once object-fit: cover zooms back in.
    ff(['-i', join(CLIPS, `${k}.mp4`), '-an', '-c:v', 'libx264', '-crf', '20',
      '-preset', 'slow', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', out]);
    clips[k] = { src: webPath(out), duration: Math.round(probeDuration(out) * 100) / 100 };
  }

  // Sample from the PNG poster, which has the same background as every frame. ffmpeg's
  // webp decoder can't be trusted with libwebp output.
  const poster = join(FRAMES, 'poster-c1.png');
  writeMeta({ bgHex: cornerHex(poster), bgLightHex: centerTopHex(poster), hasClips: true, clips });
}

requireFfmpeg();
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'placeholders') placeholders();
else if (cmd === 'lastframe' && arg) lastframe(arg);
else if (cmd === 'build') build();
else {
  console.log('Usage: node tools/process-clips.mjs <placeholders | lastframe <clip.mp4> | build>');
  process.exit(1);
}
