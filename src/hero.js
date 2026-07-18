import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { frameIndexForProgress, coverRect } from './scrub-math.js';

function wireHeroChrome() {
  gsap.fromTo('.hero-title', { opacity: 0, y: 28 }, {
    opacity: 1, y: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: '55% top', end: '78% top', scrub: true },
  });

  gsap.to('.scroll-cue', {
    opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: '15% top', scrub: true },
  });
}

function initMobileHero(wrap, video) {
  let settled = false;
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const settle = () => {
    if (settled) return;
    settled = true;
    resolveReady();
    video.play().catch(() => { /* The first frame remains visible as a fallback. */ });
  };

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  if (video.readyState >= 2) queueMicrotask(settle);
  else {
    video.addEventListener('loadeddata', settle, { once: true });
    video.addEventListener('error', settle, { once: true });
    video.load();
  }
  video.play().catch(() => { /* loadeddata retries playback. */ });

  gsap.fromTo(wrap, { opacity: 1 }, {
    opacity: 0, ease: 'none',
    scrollTrigger: {
      trigger: '#hero', start: '82% top', end: '98% top', scrub: true,
      onLeave: () => { wrap.style.display = 'none'; },
      onEnterBack: () => { wrap.style.display = ''; },
    },
  });

  return { ready };
}

export function initHero(meta) {
  const wrap = document.getElementById('canvas-wrap');
  const canvas = document.getElementById('hero-canvas');
  const stage = document.getElementById('stage');
  const desktop = matchMedia('(min-width: 820px)').matches;
  const mobileVideo = document.getElementById('hero-mobile-video');
  wireHeroChrome();
  if (!desktop && mobileVideo) return initMobileHero(wrap, mobileVideo);

  const ctx = canvas.getContext('2d');
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
    // Resizing the backing store resets context state, so restore quality filtering.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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
        wrap.style.overflow = 'hidden';
        // .page is z-index 3; lift the canvas above it while it morphs into the column.
        wrap.style.zIndex = p > 0 ? '4' : '';
      },
      onLeave: () => { wrap.style.display = 'none'; },
      onEnterBack: () => { wrap.style.display = ''; },
    });
  }

  addEventListener('resize', () => {
    if (wrap.style.display !== 'none' && !wrap.style.width) setRect({ x: 0, y: 0, w: innerWidth, h: innerHeight });
    else draw();
  });

  pump();
  return { ready };
}
