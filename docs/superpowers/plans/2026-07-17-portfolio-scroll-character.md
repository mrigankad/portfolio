# Scroll-Driven 3D Character Portfolio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static one-page portfolio where an AI-generated 3D character performs a scroll-scrubbed hero pull-back, then sits pinned beside the content playing a reaction clip per section — fully working with placeholder assets before any Google Flow generation.

**Architecture:** Static site (no framework, no bundler). `js/main.js` boots Lenis + GSAP ScrollTrigger and branches to a static fallback; `js/hero.js` draws a WebP frame sequence to a fixed full-viewport canvas scrubbed by scroll, then hands off geometrically into the character stage; `js/reactions.js` manages the pinned/inline `<video>` stack. `tools/process-clips.mjs` (Node + ffmpeg) generates placeholder frames now and processes the real Flow clips later, writing `assets/frames/meta.json` which is the single contract between assets and site.

**Tech Stack:** HTML/CSS/vanilla JS (ES modules), GSAP 3.13.0 + ScrollTrigger, Lenis 1.3.4 (vendored), Node ≥ 18 (`node:test`, no npm deps), ffmpeg CLI.

## Global Constraints

- Node ≥ 18; no `package.json`, no npm dependencies anywhere.
- ffmpeg + ffprobe required for `tools/process-clips.mjs`; if missing, the script must print: `ffmpeg not found. Install with: winget install --id Gyan.FFmpeg -e` and exit code 1.
- Vendored libs pinned: `gsap@3.13.0`, ScrollTrigger `3.13.0`, `lenis@1.3.4` (jsdelivr `.min.js` builds committed under `js/vendor/`).
- Clip keys are exactly `c1 c2 c3 c4 c5`; user-downloaded Flow clips live at `assets/clips/c1.mp4` … `c5.mp4`; generated output lives only under `assets/frames/`.
- `assets/frames/meta.json` contract (verbatim, produced by the tool, consumed by the site):
  ```json
  {
    "bgHex": "#f6f1e9",
    "hero": { "count": 80, "dir": "assets/frames/hero", "width": 1600, "height": 900 },
    "hasClips": false,
    "posters": { "c1": "assets/frames/poster-c1.png", "c2": "…", "c3": "…", "c4": "…", "c5": "…" },
    "clips": { "c2": { "src": "assets/frames/c2.web.mp4", "duration": 4.0 }, "c3": "…", "c4": "…", "c5": "…" }
  }
  ```
  `clips` is `null` and `hasClips` is `false` in placeholder mode. Hero frame filenames: `hero-0001.webp` (1-based, 4 digits).
- Copy rules: name **Mriganka**, title **UI/UX Designer**, email **mriganka.uiux@gmail.com**. All other copy is clearly-editable placeholder text in `index.html`.
- Character column on the left, content on the right (≥ 820 px); inline per-section videos below 820 px.
- `prefers-reduced-motion`, missing meta.json, or missing GSAP → static page (visible content, no scrub, no autoplay).
- Initial payload budget ≤ ~5 MB (hero frames ~3–4 MB; reaction videos lazy via `preload="none"` + posters).
- Dev server: `node tools/serve.mjs` on port 5173.
- Commit after every task; messages in the form given in each task's final step.

---

### Task 1: Scaffold, design tokens, dev server, vendored libs

**Files:**
- Create: `.gitignore`, `index.html`, `css/styles.css`, `tools/serve.mjs`
- Create: `js/vendor/gsap.min.js`, `js/vendor/ScrollTrigger.min.js`, `js/vendor/lenis.min.js` (downloaded)
- Create: `js/main.js`, `js/hero.js`, `js/reactions.js`, `js/scrub-math.js` (stubs so script tags resolve)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the full page DOM skeleton and CSS custom properties every later task relies on. Load-bearing ids/classes: `#hero`, `#canvas-wrap`, `#hero-canvas`, `#hero-poster`, `.hero-title`, `.scroll-cue`, `.page`, `.char-col`, `#stage`, `.content-col`, `#about`, `#projects`, `#skills`, `#contact`, `.inline-stage[data-clip]`, `[data-reveal]`, body classes `is-ready` / `is-static`. CSS vars: `--bg`, `--ink`, `--muted`, `--teal`, `--card`, `--line`, `--stage-w`, `--stage-top`.

- [ ] **Step 1: Write `.gitignore`**

```gitignore
node_modules/
*.log
Thumbs.db
```

- [ ] **Step 2: Write `tools/serve.mjs`** (zero-dep static server)

```js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const types = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(5173, () => console.log('serving on http://localhost:5173'));
```

- [ ] **Step 3: Download vendored libs**

```bash
mkdir -p js/vendor
curl -fsSL -o js/vendor/gsap.min.js https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js
curl -fsSL -o js/vendor/ScrollTrigger.min.js https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js
curl -fsSL -o js/vendor/lenis.min.js https://cdn.jsdelivr.net/npm/lenis@1.3.4/dist/lenis.min.js
```

Expected: three files exist, each > 5 KB (`ls -la js/vendor`). If a pinned URL 404s, retry with `gsap@3` / `lenis@1` (jsdelivr latest-in-major) and note the resolved version in the commit message.

- [ ] **Step 4: Write `index.html`** (complete skeleton; copy is placeholder by design)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mriganka — UI/UX Designer</title>
  <meta name="description" content="Portfolio of Mriganka, UI/UX designer.">
  <link rel="icon" href="assets/character.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header class="site-nav">
    <a class="logo" href="#hero">MK<span class="logo-dot">.</span></a>
    <nav>
      <a href="#about">About</a>
      <a href="#projects">Work</a>
      <a href="#skills">Skills</a>
      <a class="nav-cta" href="#contact">Say hi</a>
    </nav>
  </header>

  <section id="hero" aria-label="Intro">
    <div id="canvas-wrap" aria-hidden="true">
      <canvas id="hero-canvas"></canvas>
    </div>
    <img id="hero-poster" src="assets/character.png" alt="3D cartoon character of Mriganka">
    <div class="hero-sticky">
      <div class="hero-title">
        <p class="hero-kicker">Hey, I'm</p>
        <h1>Mriganka</h1>
        <p class="hero-sub">UI/UX Designer — I design friendly, useful products.</p>
      </div>
      <div class="scroll-cue"><span></span>scroll</div>
    </div>
  </section>

  <main class="page">
    <div class="char-col"><div id="stage" aria-hidden="true"></div></div>

    <div class="content-col">
      <section id="about" data-section="c2">
        <div class="inline-stage" data-clip="c2" aria-hidden="true"></div>
        <h2 data-reveal>About me</h2>
        <p class="lead" data-reveal>I'm a UI/UX designer who loves turning fuzzy problems
        into clear, playful interfaces. Placeholder bio — swap in your own story here.</p>
        <ul class="facts" data-reveal>
          <li><strong>3+ yrs</strong> designing products</li>
          <li><strong>10+</strong> shipped projects</li>
          <li><strong>∞</strong> Figma frames</li>
        </ul>
      </section>

      <section id="projects" data-section="c3">
        <div class="inline-stage" data-clip="c3" aria-hidden="true"></div>
        <h2 data-reveal>Selected work</h2>
        <div class="cards">
          <a class="card" href="#" data-reveal>
            <div class="thumb thumb-a">01</div>
            <h3>Project One</h3>
            <p>Placeholder case study — mobile app redesign.</p>
          </a>
          <a class="card" href="#" data-reveal>
            <div class="thumb thumb-b">02</div>
            <h3>Project Two</h3>
            <p>Placeholder case study — SaaS dashboard.</p>
          </a>
          <a class="card" href="#" data-reveal>
            <div class="thumb thumb-c">03</div>
            <h3>Project Three</h3>
            <p>Placeholder case study — design system.</p>
          </a>
        </div>
      </section>

      <section id="skills" data-section="c4">
        <div class="inline-stage" data-clip="c4" aria-hidden="true"></div>
        <h2 data-reveal>Skills &amp; tools</h2>
        <ul class="chips" data-reveal>
          <li>UX research</li><li>Wireframing</li><li>Prototyping</li>
          <li>Design systems</li><li>Figma</li><li>Illustration</li>
          <li>Motion</li><li>HTML/CSS</li>
        </ul>
      </section>

      <section id="contact" data-section="c5">
        <div class="inline-stage" data-clip="c5" aria-hidden="true"></div>
        <h2 data-reveal>Let's make something</h2>
        <p class="lead" data-reveal>Have a project in mind, or just want to say hi?</p>
        <a class="cta" data-reveal href="mailto:mriganka.uiux@gmail.com">mriganka.uiux@gmail.com</a>
        <div class="socials" data-reveal>
          <a href="#">Dribbble</a><a href="#">Behance</a><a href="#">LinkedIn</a>
        </div>
      </section>
    </div>
  </main>

  <footer><p>© 2026 Mriganka · built with an AI-generated stunt double</p></footer>

  <script src="js/vendor/gsap.min.js"></script>
  <script src="js/vendor/ScrollTrigger.min.js"></script>
  <script src="js/vendor/lenis.min.js"></script>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Write `css/styles.css`** (tokens, layout, all components — complete)

```css
/* ---------- tokens ---------- */
:root {
  --bg: #f6f1e9;            /* overwritten at runtime from meta.json bgHex */
  --ink: #221d15;
  --muted: #6f6557;
  --teal: #2a7d8c;
  --teal-deep: #1d5a66;
  --card: #fffdf8;
  --line: rgba(34, 29, 21, 0.1);
  --stage-w: min(38vw, 520px);
  --stage-top: calc(50vh - (var(--stage-w) * 4 / 3) / 2);
  --font-display: "Sora", system-ui, sans-serif;
  --font-body: system-ui, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; margin: 0; }
html { scroll-behavior: auto; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  line-height: 1.6;
  overflow-x: clip;
}
h1, h2, h3, .logo, .nav-cta, .cta { font-family: var(--font-display); }
a { color: inherit; text-decoration: none; }
img, video, canvas { max-width: 100%; display: block; }

/* ---------- nav ---------- */
.site-nav {
  position: fixed; inset: 0 0 auto 0; z-index: 50;
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.1rem clamp(1.2rem, 4vw, 3rem);
}
.logo { font-size: 1.35rem; font-weight: 800; }
.logo-dot { color: var(--teal); }
.site-nav nav { display: flex; gap: 1.4rem; align-items: center; font-weight: 600; font-size: 0.95rem; }
.site-nav nav a:hover { color: var(--teal-deep); }
.nav-cta {
  background: var(--ink); color: var(--bg);
  padding: 0.5rem 1.05rem; border-radius: 999px;
  transition: transform 0.25s ease, background 0.25s ease;
}
.nav-cta:hover { background: var(--teal-deep); color: #fff; transform: translateY(-2px); }

/* ---------- hero ---------- */
#hero { height: 300vh; position: relative; }
#canvas-wrap {
  position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
  z-index: 1; pointer-events: none; will-change: transform, width, height;
}
#hero-canvas { width: 100%; height: 100%; }
#hero-poster {
  display: none; position: absolute; top: 12vh; left: 50%;
  transform: translateX(-50%); height: 76vh; width: auto; object-fit: contain;
}
.hero-sticky {
  position: sticky; top: 0; height: 100vh; z-index: 2;
  display: grid; place-items: end center; pointer-events: none;
}
.hero-title { text-align: center; padding-bottom: 14vh; opacity: 0; }
.hero-kicker { color: var(--teal-deep); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.85rem; }
.hero-title h1 { font-size: clamp(3rem, 9vw, 6.5rem); font-weight: 800; line-height: 1.05; }
.hero-sub { color: var(--muted); font-size: clamp(1rem, 2.2vw, 1.25rem); margin-top: 0.4rem; }
.scroll-cue {
  position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%);
  font-size: 0.8rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted);
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
}
.scroll-cue span {
  width: 1px; height: 2.6rem; background: var(--ink); opacity: 0.4;
  animation: cue 1.6s ease-in-out infinite;
}
@keyframes cue { 50% { transform: scaleY(0.35); transform-origin: top; } }

/* ---------- page grid + stage ---------- */
.page {
  position: relative; z-index: 3;
  display: grid; grid-template-columns: var(--stage-w) 1fr;
  gap: clamp(1.5rem, 4vw, 4rem);
  padding: 0 clamp(1.2rem, 4vw, 3rem);
  max-width: 1440px; margin: 0 auto;
}
.char-col { position: relative; }
#stage {
  position: sticky; top: var(--stage-top);
  width: 100%; aspect-ratio: 3 / 4;
  border-radius: 24px; overflow: hidden;
}
#stage img, #stage video {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; opacity: 0; transition: opacity 0.18s linear;
}
#stage .active { opacity: 1; }
.inline-stage { display: none; }

/* ---------- sections ---------- */
.content-col section { min-height: 92vh; display: flex; flex-direction: column; justify-content: center; padding: 14vh 0; }
h2 { font-size: clamp(2rem, 4.6vw, 3.2rem); font-weight: 800; margin-bottom: 1.2rem; }
.lead { font-size: 1.12rem; color: var(--muted); max-width: 52ch; }
.facts { list-style: none; padding: 0; display: flex; gap: 2.2rem; margin-top: 2rem; flex-wrap: wrap; }
.facts strong { display: block; font-size: 1.6rem; font-family: var(--font-display); color: var(--teal-deep); }

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.4rem; margin-top: 1rem; }
.card {
  background: var(--card); border: 1px solid var(--line); border-radius: 20px;
  padding: 1.1rem; transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.card:hover { transform: translateY(-6px); box-shadow: 0 18px 40px -18px rgba(34, 29, 21, 0.25); }
.thumb {
  aspect-ratio: 4 / 3; border-radius: 14px; margin-bottom: 0.9rem;
  display: grid; place-items: center; color: rgba(255, 255, 255, 0.85);
  font-family: var(--font-display); font-weight: 800; font-size: 1.6rem;
}
.thumb-a { background: linear-gradient(135deg, #2a7d8c, #7fc4c9); }
.thumb-b { background: linear-gradient(135deg, #f4a259, #f7cf8f); }
.thumb-c { background: linear-gradient(135deg, #5a5f9e, #a3a8de); }
.card h3 { font-size: 1.1rem; margin-bottom: 0.2rem; }
.card p { color: var(--muted); font-size: 0.95rem; }

.chips { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.7rem; max-width: 46ch; }
.chips li {
  background: var(--card); border: 1px solid var(--line);
  padding: 0.5rem 1.05rem; border-radius: 999px; font-weight: 600; font-size: 0.95rem;
}

.cta {
  display: inline-block; background: var(--teal); color: #fff;
  font-size: clamp(1.1rem, 2.4vw, 1.5rem); font-weight: 700;
  padding: 0.9rem 1.6rem; border-radius: 999px; margin-top: 1rem;
  transition: transform 0.25s ease, background 0.25s ease;
}
.cta:hover { background: var(--teal-deep); transform: translateY(-3px); }
.socials { display: flex; gap: 1.4rem; margin-top: 1.6rem; font-weight: 600; color: var(--teal-deep); }
.socials a:hover { text-decoration: underline; }

footer { text-align: center; color: var(--muted); font-size: 0.9rem; padding: 3rem 1rem; }

/* ---------- static + not-ready modes ---------- */
body.is-static #canvas-wrap, body.is-static .scroll-cue { display: none; }
body.is-static #hero { height: 100vh; }
body.is-static #hero-poster { display: block; }
body.is-static .hero-title { opacity: 1; }
body:not(.is-ready) #canvas-wrap { opacity: 0; }
#canvas-wrap { transition: opacity 0.4s ease; }

/* ---------- mobile ---------- */
@media (max-width: 819px) {
  .page { grid-template-columns: 1fr; }
  .char-col { display: none; }
  .inline-stage {
    display: block; width: min(72vw, 300px); aspect-ratio: 3 / 4;
    border-radius: 20px; overflow: hidden; margin-bottom: 1.6rem; position: relative;
  }
  .inline-stage img, .inline-stage video {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  }
  .site-nav nav a:not(.nav-cta) { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-cue span { animation: none; }
}
```

- [ ] **Step 6: Write JS stubs** so the page loads without errors before Tasks 4–7.

`js/scrub-math.js`:
```js
// filled in by the scrub-math task
export function frameIndexForProgress(progress, count) { return 0; }
export function coverRect(srcW, srcH, dstW, dstH) { return { sx: 0, sy: 0, sw: srcW, sh: srcH }; }
```

`js/hero.js`:
```js
// filled in by the hero task
export function initHero(meta) { return { ready: Promise.resolve() }; }
```

`js/reactions.js`:
```js
// filled in by the reactions task
export function initReactions(meta) {}
```

`js/main.js`:
```js
import { initHero } from './hero.js';
import { initReactions } from './reactions.js';

// Boot is fleshed out by the hero task; for now: static mode so the skeleton is reviewable.
document.body.classList.add('is-static', 'is-ready');
```

- [ ] **Step 7: Verify the skeleton serves**

```bash
node tools/serve.mjs &
sleep 1
curl -s http://localhost:5173/ | grep -c "Mriganka"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/css/styles.css
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/js/vendor/gsap.min.js
```

Expected: a count ≥ 2, then `200`, then `200`. Also open http://localhost:5173 — full static page renders: nav, hero title over the 2D character poster, four sections, no console errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold static portfolio skeleton with tokens, dev server, vendored gsap/lenis"
```

---

### Task 2: Pure clip utilities with tests (TDD)

**Files:**
- Create: `tools/clip-utils.mjs`
- Test: `tests/clip-utils.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 3's CLI):
  - `easeInOutCubic(t: number): number`
  - `placeholderCropSpec(i, count, imgW, imgH, faceX, faceY, startZoom = 3.2): { w, h, x, y }` — integer crop window for placeholder frame `i` of `count`, zooming out from a face-centered window to the full image, always clamped inside the image.
  - `avgHex(buf: Buffer): string` — average color of raw RGB24 bytes as `#rrggbb`.
  - `frameName(i: number): string` — 0-based index → `hero-0001.webp`-style name.

- [ ] **Step 1: Write the failing tests** — `tests/clip-utils.test.mjs`

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module … tools/clip-utils.mjs`.

- [ ] **Step 3: Implement `tools/clip-utils.mjs`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/clip-utils.mjs tests/clip-utils.test.mjs
git commit -m "feat: pure clip utilities (placeholder crop math, color sampling) with tests"
```

---

### Task 3: `process-clips.mjs` CLI — placeholders, lastframe, build

**Files:**
- Create: `tools/process-clips.mjs`
- Test: `tests/process-clips.test.mjs` (smoke test using a synthetic ffmpeg-generated clip)
- Output (generated, committed): `assets/frames/…`, `assets/frames/meta.json`

**Interfaces:**
- Consumes: everything exported by `tools/clip-utils.mjs` (exact signatures in Task 2).
- Produces:
  - CLI: `node tools/process-clips.mjs placeholders | lastframe <path-to-mp4> | build`
  - `placeholders` → `assets/frames/hero/hero-0001.webp…hero-0080.webp`, `assets/frames/poster-c1.png` … `poster-c5.png`, `assets/frames/meta.json` with `hasClips: false, clips: null`.
  - `lastframe assets/clips/c1.mp4` → writes `assets/clips/c1.last.png` and prints the path (this PNG is what the user uploads to Flow as the next clip's first frame).
  - `build` → hero frames from `assets/clips/c1.mp4`, posters = last frame of each clip, `c2.web.mp4`…`c5.web.mp4` (muted H.264, faststart), `meta.json` with `hasClips: true` and real durations.
  - meta.json exactly per the Global Constraints contract.

- [ ] **Step 1: Write the smoke test** — `tests/process-clips.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const tmp = join('tests', '.tmp');
const haveFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

test('lastframe extracts a PNG from a clip', { skip: !haveFfmpeg && 'ffmpeg not installed' }, () => {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const clip = join(tmp, 'sample.mp4');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x36:d=1',
    '-pix_fmt', 'yuv420p', clip], { stdio: 'ignore' });
  execFileSync('node', ['tools/process-clips.mjs', 'lastframe', clip]);
  assert.ok(existsSync(join(tmp, 'sample.last.png')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/process-clips.test.mjs`
Expected: FAIL (`process-clips.mjs` missing) — or SKIP if ffmpeg isn't installed, in which case install it first: `winget install --id Gyan.FFmpeg -e` (then restart the shell so PATH updates).

- [ ] **Step 3: Implement `tools/process-clips.mjs`**

```js
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { placeholderCropSpec, avgHex, frameName } from './clip-utils.mjs';

const FRAMES = 'assets/frames';
const HERO_DIR = join(FRAMES, 'hero');
const CLIPS = 'assets/clips';
const HERO_COUNT = 80;
const OUT_W = 1600, OUT_H = 900;
const REACTIONS = ['c2', 'c3', 'c4', 'c5'];

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

// Average color of an 8x8 patch near the top-left corner, via raw RGB24 on stdout.
function cornerHex(image) {
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', image,
    '-vf', 'crop=8:8:4:4', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return avgHex(raw);
}

function lastframe(clip, outPath) {
  const out = outPath ?? join(dirname(clip), basename(clip, extname(clip)) + '.last.png');
  ff(['-sseof', '-0.15', '-i', clip, '-update', '1', '-frames:v', '1', out]);
  console.log(out);
  return out;
}

function writeMeta(extra) {
  const posters = {};
  for (const k of ['c1', ...REACTIONS]) posters[k] = `${FRAMES}/poster-${k}.png`;
  const count = readdirSync(HERO_DIR).filter((f) => f.endsWith('.webp')).length;
  const meta = {
    bgHex: extra.bgHex,
    hero: { count, dir: `${FRAMES}/hero`, width: OUT_W, height: OUT_H },
    hasClips: extra.hasClips,
    posters,
    clips: extra.clips,
  };
  writeFileSync(join(FRAMES, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`meta.json written (${count} hero frames, bg ${extra.bgHex}, hasClips ${extra.hasClips})`);
}

function placeholders() {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(HERO_DIR, { recursive: true });
  const srcPng = 'assets/character.png';
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
      '-quality', '72', join(HERO_DIR, frameName(i))]);
  }
  for (const k of ['c1', ...REACTIONS]) {
    ff(['-i', padded, '-vf', `scale=960:-2`, join(FRAMES, `poster-${k}.png`)]);
  }
  rmSync(padded);
  writeMeta({ bgHex, hasClips: false, clips: null });
}

function build() {
  for (const k of ['c1', ...REACTIONS]) {
    if (!existsSync(join(CLIPS, `${k}.mp4`))) {
      console.error(`Missing ${join(CLIPS, `${k}.mp4`)} — download it from Flow first.`);
      process.exit(1);
    }
  }
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(HERO_DIR, { recursive: true });

  // Hero frame sequence from c1 (10 fps, 1600px wide WebP).
  ff(['-i', join(CLIPS, 'c1.mp4'), '-vf', `fps=10,scale=${OUT_W}:${OUT_H}:flags=lanczos`,
    '-quality', '72', join(HERO_DIR, 'hero-%04d.webp')]);

  // Posters: the LAST frame of each clip (= that section's resting pose).
  for (const k of ['c1', ...REACTIONS]) {
    lastframe(join(CLIPS, `${k}.mp4`), join(FRAMES, `poster-${k}.png`));
  }

  // Web-optimized muted reaction clips.
  const clips = {};
  for (const k of REACTIONS) {
    const out = join(FRAMES, `${k}.web.mp4`);
    ff(['-i', join(CLIPS, `${k}.mp4`), '-an', '-c:v', 'libx264', '-crf', '22',
      '-preset', 'slow', '-vf', 'scale=1280:-2', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', out]);
    clips[k] = { src: out.replaceAll('\\', '/'), duration: Math.round(probeDuration(out) * 100) / 100 };
  }

  const bgHex = cornerHex(join(HERO_DIR, 'hero-0001.webp'));
  writeMeta({ bgHex, hasClips: true, clips });
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
```

- [ ] **Step 4: Run the smoke test**

Run: `node --test tests/process-clips.test.mjs`
Expected: PASS (1 test) — `tests/.tmp/sample.last.png` created via the CLI.

- [ ] **Step 5: Generate the placeholder assets**

```bash
node tools/process-clips.mjs placeholders
ls assets/frames/hero | wc -l
cat assets/frames/meta.json
```

Expected: `80` frames; meta.json matches the contract with `hasClips: false`, a plausible near-white `bgHex`, and 5 poster paths. Spot-check visually: `assets/frames/hero/hero-0001.webp` is a face close-up crop, `hero-0080.webp` is the full padded character.

- [ ] **Step 6: Add tests/.tmp to .gitignore and commit**

Append to `.gitignore`:
```gitignore
tests/.tmp/
```

```bash
git add -A
git commit -m "feat: process-clips CLI (placeholders/lastframe/build) + generated placeholder frames"
```

---

### Task 4: Scrub math with tests (TDD)

**Files:**
- Modify: `js/scrub-math.js` (replace stub)
- Test: `tests/scrub-math.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 5):
  - `frameIndexForProgress(progress: number, count: number): number` — clamps progress to [0,1], returns `round(p * (count - 1))`.
  - `coverRect(srcW, srcH, dstW, dstH): { sx, sy, sw, sh }` — centered source crop for `drawImage` cover-fit.

- [ ] **Step 1: Write the failing tests** — `tests/scrub-math.test.mjs`

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/scrub-math.test.mjs`
Expected: FAIL — stub returns frame 0 / full rect.

- [ ] **Step 3: Implement `js/scrub-math.js`** (replace entire file)

```js
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
```

- [ ] **Step 4: Run all tests**

Run: `node --test tests/`
Expected: every test in the suite PASSES.

- [ ] **Step 5: Commit**

```bash
git add js/scrub-math.js tests/scrub-math.test.mjs
git commit -m "feat: scrub math (frame mapping, cover-fit crop) with tests"
```

---

### Task 5: Hero canvas scrub + boot wiring

**Files:**
- Modify: `js/hero.js` (replace stub), `js/main.js` (replace stub)

**Interfaces:**
- Consumes: `frameIndexForProgress`, `coverRect` from `js/scrub-math.js`; `meta.hero.{count,dir}` from meta.json; DOM ids `#canvas-wrap`, `#hero-canvas`, `#hero`, `.hero-title`, `.scroll-cue`, `#stage`; globals `gsap`, `ScrollTrigger`, `Lenis` from vendored scripts.
- Produces:
  - `initHero(meta): { ready: Promise<void> }` — starts frame preload, creates the scrub + title ScrollTriggers, and (desktop ≥ 820 px) the handoff ScrollTrigger that morphs `#canvas-wrap` into `#stage`'s live rect and swaps at completion. `ready` resolves when the first 10 frames are drawn.
  - `js/main.js` boot order (Task 7's `initReactions(meta)` is already imported and called here): fetch meta → set `--bg` → static-mode branch → Lenis/GSAP wiring → `initHero` → `initReactions` → reveals → `is-ready`.

- [ ] **Step 1: Implement `js/hero.js`** (replace entire file)

```js
import { frameIndexForProgress, coverRect } from './scrub-math.js';

export function initHero(meta) {
  const wrap = document.getElementById('canvas-wrap');
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const desktop = matchMedia('(min-width: 820px)').matches;
  const { count, dir } = meta.hero;
  const dpr = Math.min(devicePixelRatio || 1, 2);

  const imgs = new Array(count);
  const flags = new Uint8Array(count);
  let loadedMax = -1;
  let current = 0;
  let rect = { x: 0, y: 0, w: innerWidth, h: innerHeight };
  let resolveReady;
  const ready = new Promise((res) => { resolveReady = res; });

  const src = (i) => `${dir}/hero-${String(i + 1).padStart(4, '0')}.webp`;

  function draw() {
    const img = imgs[Math.min(current, Math.max(loadedMax, 0))];
    if (!img) return;
    const w = Math.max(1, Math.round(rect.w)), h = Math.max(1, Math.round(rect.h));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = coverRect(img.naturalWidth, img.naturalHeight, w, h);
    ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, 0, 0, w, h);
  }

  function setRect(r) {
    rect = r;
    wrap.style.transform = `translate(${r.x}px, ${r.y}px)`;
    wrap.style.width = r.w + 'px';
    wrap.style.height = r.h + 'px';
    draw();
  }

  function advance() {
    while (loadedMax + 1 < count && flags[loadedMax + 1]) loadedMax++;
    if (loadedMax >= Math.min(9, count - 1) && resolveReady) {
      resolveReady();
      resolveReady = null;
      draw();
    }
  }

  function pump(concurrency = 6) {
    let next = 0, active = 0;
    const kick = () => {
      while (active < concurrency && next < count) {
        const i = next++;
        active++;
        const img = new Image();
        img.onload = img.onerror = () => {
          if (img.naturalWidth) imgs[i] = img;
          flags[i] = 1;
          active--;
          advance();
          if (i === Math.min(current, count - 1)) draw();
          kick();
        };
        img.src = src(i);
      }
    };
    kick();
  }

  // --- scroll wiring ---
  ScrollTrigger.create({
    trigger: '#hero', start: 'top top', end: '80% top', scrub: true,
    onUpdate: (self) => {
      const idx = frameIndexForProgress(self.progress, count);
      if (idx !== current) { current = idx; draw(); }
    },
  });

  gsap.fromTo('.hero-title', { opacity: 0, y: 28 }, {
    opacity: 1, y: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: '55% top', end: '78% top', scrub: true },
  });

  gsap.to('.scroll-cue', {
    opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: '15% top', scrub: true },
  });

  if (desktop) {
    // Morph the fixed canvas into the live rect of #stage; when they coincide, swap.
    const fullRect = () => ({ x: 0, y: 0, w: innerWidth, h: innerHeight });
    const stickyTop = () => parseFloat(getComputedStyle(stage).top) || 96;
    ScrollTrigger.create({
      trigger: '.page', start: 'top bottom', end: () => `top ${stickyTop()}px`, scrub: true,
      onUpdate: (self) => {
        const t = stage.getBoundingClientRect();
        const f = fullRect();
        const p = self.progress;
        setRect({
          x: f.x + (t.x - f.x) * p,
          y: f.y + (t.y - f.y) * p,
          w: f.w + (t.width - f.w) * p,
          h: f.h + (t.height - f.h) * p,
        });
        wrap.style.borderRadius = `${24 * p}px`;
        wrap.style.overflow = 'hidden';
        // .page is z-index 3; lift the canvas above it while it morphs into the column.
        wrap.style.zIndex = p > 0 ? '4' : '';
      },
      onLeave: () => { wrap.style.display = 'none'; },
      onEnterBack: () => { wrap.style.display = ''; },
    });
  } else {
    // Mobile: no column to morph into — fade the canvas out at the end of the runway.
    gsap.to(wrap, {
      opacity: 0, ease: 'none',
      scrollTrigger: {
        trigger: '#hero', start: '82% top', end: '98% top', scrub: true,
        onLeave: () => { wrap.style.display = 'none'; },
        onEnterBack: () => { wrap.style.display = ''; },
      },
    });
  }

  addEventListener('resize', () => {
    if (wrap.style.display !== 'none' && !wrap.style.width) setRect({ x: 0, y: 0, w: innerWidth, h: innerHeight });
    else draw();
  });

  pump();
  return { ready };
}
```

- [ ] **Step 2: Implement `js/main.js`** (replace entire file)

```js
import { initHero } from './hero.js';
import { initReactions } from './reactions.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function staticMode(meta) {
  document.body.classList.add('is-static', 'is-ready');
  const poster = document.getElementById('hero-poster');
  if (meta?.posters?.c1) poster.src = meta.posters.c1;
}

function reveals() {
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      opacity: 0, y: 26, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });
}

async function boot() {
  let meta = null;
  try {
    const res = await fetch('assets/frames/meta.json');
    if (res.ok) meta = await res.json();
  } catch { /* fall through to static mode */ }

  if (meta?.bgHex) document.documentElement.style.setProperty('--bg', meta.bgHex);
  if (!meta || reduced || !window.gsap || !window.ScrollTrigger || !window.Lenis) {
    staticMode(meta);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.12 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const hero = initHero(meta);
  initReactions(meta);
  reveals();
  hero.ready.then(() => document.body.classList.add('is-ready'));
}

boot();
```

- [ ] **Step 3: Verify in the browser**

```bash
node tools/serve.mjs &
```

Open http://localhost:5173 and check, in order:
1. Hero starts on a close-up crop of the character (placeholder), page background matches the poster's background (no visible rectangle edge).
2. Scrolling scrubs the zoom-out smoothly, both directions; fast flicks never blank the canvas.
3. Name + subtitle fade in near the end of the pull-back; scroll cue fades out immediately on scroll.
4. Past the hero, the canvas shrinks and glides into the left column slot, growing a 24px border radius, then disappears exactly when it docks (stage is still empty — that's Task 7).
5. Scrolling back up reverses everything without jumps; no console errors.
6. Run `node --test tests/` — still all green.

- [ ] **Step 4: Commit**

```bash
git add js/hero.js js/main.js
git commit -m "feat: hero canvas frame-scrub with Lenis/ScrollTrigger boot and column handoff morph"
```

---

### Task 6: Reactions — pinned video stack + inline mobile stages

**Files:**
- Modify: `js/reactions.js` (replace stub)

**Interfaces:**
- Consumes: `meta.hasClips`, `meta.posters`, `meta.clips` (contract in Global Constraints); DOM: `#stage`, `.inline-stage[data-clip]`, sections `#about #projects #skills #contact` with `data-section` = `c2…c5`; global `ScrollTrigger`.
- Produces: `initReactions(meta): void` — fills `#stage` (desktop) and each `.inline-stage` (mobile) with either poster `<img>`s (`hasClips: false`) or `<video>`s; plays the right clip once per section entry, rests on final frames, tolerates missing clips.

- [ ] **Step 1: Implement `js/reactions.js`** (replace entire file)

```js
const ORDER = ['c2', 'c3', 'c4', 'c5'];
const PREV = { c2: 'c1', c3: 'c2', c4: 'c3', c5: 'c4' };

export function initReactions(meta) {
  const stages = [];

  // Desktop column stage: all four clips stacked, one visible at a time.
  const stageEl = document.getElementById('stage');
  stages.push(buildStage(stageEl, meta, ORDER));

  // Mobile inline stages: one clip each.
  document.querySelectorAll('.inline-stage').forEach((el) => {
    stages.push(buildStage(el, meta, [el.dataset.clip]));
  });

  ORDER.forEach((key) => {
    ScrollTrigger.create({
      trigger: `[data-section="${key}"]`, start: 'top 60%',
      onEnter: () => stages.forEach((s) => s.show(key, 'play')),
      onEnterBack: () => stages.forEach((s) => s.show(key, 'rest')),
    });
  });
}

function buildStage(container, meta, keys) {
  const els = {};

  for (const key of keys) {
    if (meta.hasClips && meta.clips?.[key]) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'none';
      v.poster = meta.posters[PREV[key]];
      v.src = meta.clips[key].src;
      els[key] = v;
      container.appendChild(v);
    } else {
      // Placeholder / missing-clip mode: static poster.
      const img = document.createElement('img');
      img.src = meta.posters[key] ?? 'assets/character.png';
      img.alt = '';
      els[key] = img;
      container.appendChild(img);
    }
  }

  // Rest state before any section triggers: first available element visible.
  const first = els[keys[0]];
  if (first) first.classList.add('active');

  function show(key, mode) {
    const el = els[key];
    if (!el) return;
    for (const other of Object.values(els)) other.classList.toggle('active', other === el);
    // Warm up the next section's clip one section ahead (spec §3.3).
    const next = els[ORDER[ORDER.indexOf(key) + 1]];
    if (next?.tagName === 'VIDEO' && next.preload === 'none') next.preload = 'auto';
    if (el.tagName !== 'VIDEO') return;
    for (const other of Object.values(els)) if (other !== el && other.tagName === 'VIDEO') other.pause();
    if (!container.offsetParent) return;             // stage hidden by current breakpoint
    if (mode === 'play') {
      el.currentTime = 0;
      el.play().catch(() => { /* autoplay refused: poster stays, no crash */ });
    } else {
      seekToEnd(el);
    }
  }

  return { show };
}

function seekToEnd(video) {
  const seek = () => { video.pause(); video.currentTime = Math.max(0, video.duration - 0.05); };
  if (video.readyState >= 1) seek();
  else video.addEventListener('loadedmetadata', seek, { once: true });
}
```

- [ ] **Step 2: Verify in the browser (placeholder mode)**

With `node tools/serve.mjs` running, open http://localhost:5173:
1. Desktop: after the handoff, the left stage shows the character poster, sticky beside the content all the way down; the canvas-to-stage swap is seamless (same image, same 24px radius).
2. Each section entry keeps a visible character (posters swap but all show the same placeholder image — expected until real clips exist); no flicker, no console errors.
3. Narrow the window below 820 px and reload: the column disappears, each section shows its inline character card; hero scrub + fade-out still work.
4. `node --test tests/` still green.

- [ ] **Step 3: Commit**

```bash
git add js/reactions.js
git commit -m "feat: reaction stage — pinned video stack with poster fallback and inline mobile stages"
```

---

### Task 7: Static fallbacks, a11y/polish pass, weight check

**Files:**
- Modify: `index.html`, `css/styles.css` (small additions only — exact edits below)

**Interfaces:**
- Consumes: everything built so far.
- Produces: the finished v1 page. No new exports.

- [ ] **Step 1: Verify reduced-motion static mode**

In Chrome DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", reload:
1. No canvas, no scrub: hero is one viewport tall with the poster image and visible title.
2. Page scrolls natively; all content readable; stage shows a static poster (videos are never injected in static mode because `boot()` returns before `initHero`/`initReactions`).
3. Also verify hard-failure mode: temporarily rename `assets/frames/meta.json` → reload → same static page (with the original 2D character as poster); rename it back.

- [ ] **Step 2: Add `noscript` + OG tags to `index.html`**

In `<head>`, after the description meta, add:

```html
  <meta property="og:title" content="Mriganka — UI/UX Designer">
  <meta property="og:description" content="Portfolio of Mriganka, UI/UX designer.">
  <meta property="og:image" content="assets/frames/poster-c1.png">
  <noscript><style>
    #canvas-wrap, .scroll-cue { display: none; }
    #hero { height: 100vh; }
    #hero-poster { display: block; }
    .hero-title { opacity: 1; }
  </style></noscript>
```

- [ ] **Step 3: Keyboard/contrast pass**

Add to the end of `css/styles.css`:

```css
a:focus-visible, .card:focus-visible {
  outline: 3px solid var(--teal);
  outline-offset: 3px;
  border-radius: 6px;
}
```

Tab through the page: logo → nav → cards → email CTA → socials all show a visible focus ring; heading/body text contrast against `--bg` is ≥ 4.5:1 (spot-check `--muted` #6f6557 on #f6f1e9 ≈ 4.6:1 — if the sampled runtime bg is darker, revisit `--muted`).

- [ ] **Step 4: Weight check**

```bash
du -sh assets/frames
du -sk assets/frames/hero | awk '{print $1 " KB hero frames"}'
```

Expected: hero frames ≤ ~4500 KB total. If over budget, re-run placeholders with `-quality 65` in the two `-quality` args of `tools/process-clips.mjs` and regenerate.

- [ ] **Step 5: Full manual sweep + tests**

1. Desktop Chrome + one other engine if available (Edge counts as Chrome; try Firefox if installed): full scroll down and up, no jumps, no errors.
2. DevTools device emulation (iPhone-class width): hero scrub, canvas fade-out, inline stages.
3. `node --test tests/` — all green.

- [ ] **Step 6: Commit**

```bash
git add index.html css/styles.css
git commit -m "feat: static/noscript fallbacks, focus states, og tags, weight check"
```

---

### Task 8: README runbook for the Flow workflow

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the spec's §2 prompts (`docs/superpowers/specs/2026-07-17-portfolio-scroll-character-design.md`) and the Task 3 CLI.
- Produces: the user-facing runbook. The prompts live in the spec only (linked, not duplicated) — DRY.

- [ ] **Step 1: Write `README.md`**

```markdown
# Mriganka — Portfolio

One-page portfolio with a scroll-driven 3D character. Static site: no build step.

## Run locally

    node tools/serve.mjs
    # → http://localhost:5173

Currently running on **placeholder assets** generated from `assets/character.png`.

## Swap in the real AI-generated character

All prompts live in the spec:
`docs/superpowers/specs/2026-07-17-portfolio-scroll-character-design.md` (§2).

1. **Stills** — in Gemini (Nano Banana), upload `assets/character.png` and run the
   master prompt, then the 5 pose-edit prompts (spec §2.1). Download all six.
2. **Clips** — in Google Flow, "Frames to Video" (spec §2.2), in this order:
   - `c1`: first frame = Still 0 (close-up), last frame = Still 1 (master). 8 s.
   - Download it to `assets/clips/c1.mp4`, then get the chaining frame:

         node tools/process-clips.mjs lastframe assets/clips/c1.mp4

   - `c2`: first frame = `c1.last.png`, last frame = Still 2 (wave). 4 s.
   - Repeat the `lastframe` step after each download; `c3` (point), `c4` (ta-da),
     `c5` (thumbs-up) each start from the previous clip's `.last.png`.
3. **Build the site assets** (requires ffmpeg — `winget install --id Gyan.FFmpeg -e`):

         node tools/process-clips.mjs build

4. Reload the site. Background color, hero frames, posters, and reaction clips
   all come from `assets/frames/meta.json` — no code changes needed.

To go back to placeholders: `node tools/process-clips.mjs placeholders`.

## Tests

    node --test tests/
```

- [ ] **Step 2: Verify the commands in the README are real**

```bash
node tools/process-clips.mjs
```
Expected: usage line listing exactly `placeholders | lastframe <clip.mp4> | build` (matches README).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: runbook for generating and wiring the Flow character clips"
```
