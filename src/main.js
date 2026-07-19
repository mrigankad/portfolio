import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initHero } from './hero.js';
import { initReactions } from './reactions.js';
import { initModelGallery } from './models.js';

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const loaderProgress = document.getElementById('loader-progress');
const loaderCount = document.getElementById('loader-count');
const loaderStatus = document.getElementById('loader-status');
let loaderPercent = 6;
let loaderFinished = false;

function updateLoader(percent, status) {
  loaderPercent = Math.max(loaderPercent, Math.min(percent, 100));
  if (loaderProgress) loaderProgress.style.transform = `scaleX(${loaderPercent / 100})`;
  if (loaderCount) loaderCount.textContent = `${String(Math.round(loaderPercent)).padStart(2, '0')}%`;
  if (status && loaderStatus) loaderStatus.textContent = status;
}

function finishLoader() {
  if (loaderFinished) return;
  loaderFinished = true;
  clearInterval(loaderTick);
  clearTimeout(loaderFailsafe);
  updateLoader(100, 'Welcome');
  document.body.classList.add('loader-complete');
  setTimeout(() => document.body.classList.add('is-ready'), reduced ? 0 : 240);
}

updateLoader(loaderPercent);
const loaderTick = setInterval(() => {
  const step = Math.max(1, Math.ceil((88 - loaderPercent) * 0.08));
  updateLoader(Math.min(88, loaderPercent + step));
}, 120);
const loaderFailsafe = setTimeout(finishLoader, 6000);

const siteNav = document.querySelector('.site-nav');
function syncNavSurface() {
  siteNav?.classList.toggle('is-scrolled', scrollY > 32);
}
syncNavSurface();
addEventListener('scroll', syncNavSurface, { passive: true });

function staticMode(meta) {
  document.body.classList.add('is-static');
  const poster = document.getElementById('hero-poster');
  if (meta?.posters?.c1) poster.src = meta.posters.c1;
  finishLoader();
}

function reveals() {
  // On refresh the browser restores the old scroll position (and fragment
  // links land mid-page), so anything already on screen must never be hidden.
  // only animate elements still below the fold.
  const below = [...document.querySelectorAll('[data-reveal]')].filter(
    (el) => el.getBoundingClientRect().top >= innerHeight * 0.92,
  );
  const lists = below.filter((el) => el.matches('ul'));
  const heads = below.filter((el) => el.matches('h2'));
  const blocks = below.filter((el) => !lists.includes(el) && !heads.includes(el));

  gsap.set(blocks, { opacity: 0, y: 26 });
  ScrollTrigger.batch(blocks, {
    start: 'top 85%', once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out', stagger: 0.08 }),
  });

  // Pill lists ripple in item by item instead of moving as one slab.
  lists.forEach((ul) => {
    const items = ul.children;
    gsap.set(items, { opacity: 0, y: 18 });
    ScrollTrigger.create({
      trigger: ul, start: 'top 85%', once: true,
      onEnter: () => gsap.to(items, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06 }),
    });
  });

  // Section headings slide up word by word from behind a clip line.
  heads.forEach((h) => {
    const words = splitWords(h);
    gsap.set(words, { yPercent: 112 });
    ScrollTrigger.create({
      trigger: h, start: 'top 85%', once: true,
      onEnter: () => gsap.to(words, { yPercent: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06 }),
    });
  });

  // Re-measure trigger positions once every asset has loaded and laid out.
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

// Wrap each word in an overflow-hidden span so it can slide up into view.
// The original text is kept on aria-label for screen readers.
function splitWords(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  return text.split(/\s+/).map((word, i) => {
    const outer = document.createElement('span');
    outer.className = 'split-word';
    outer.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.textContent = word;
    outer.appendChild(inner);
    if (i) el.append(' ');
    el.append(outer);
    return inner;
  });
}

// Gentle cursor-attract on [data-magnet] elements (contact CTA).
function initMagnet() {
  if (reduced || matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('[data-magnet]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
    let rect;
    el.addEventListener('mouseenter', () => { rect = el.getBoundingClientRect(); });
    el.addEventListener('mousemove', (e) => {
      if (!rect) return;
      xTo((e.clientX - rect.left - rect.width / 2) * 0.2);
      yTo((e.clientY - rect.top - rect.height / 2) * 0.3);
    });
    el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
  });
}

async function boot() {
  let meta = null;
  try {
    const res = await fetch('assets/frames/meta.json');
    if (res.ok) meta = await res.json();
  } catch { /* fall through to static mode */ }

  if (meta?.bgHex) document.documentElement.style.setProperty('--bg', meta.bgHex);
  if (meta?.bgLightHex) document.documentElement.style.setProperty('--bg-light', meta.bgLightHex);
  updateLoader(38, 'Preparing the canvas');
  initModelGallery(); // Plain DOM, so it works in static mode too.
  initMagnet();
  if (!meta || reduced || location.search.includes('nofx')) {
    staticMode(meta);
    return;
  }

  const lenis = new Lenis({ lerp: 0.12 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anchor navigation glides with Lenis instead of jumping. The skip link is
  // excluded so the browser's default jump also moves keyboard focus.
  document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80 });
    });
  });

  const hero = initHero(meta);
  initReactions(meta);
  updateLoader(68, 'Composing the scene');
  // One frame later so the browser's scroll restoration / fragment jump has
  // happened before we decide what is "already on screen".
  requestAnimationFrame(() => reveals());
  hero.ready.then(finishLoader);
  // Never trap anyone on the loader. Reveal regardless after 6s.
  setTimeout(finishLoader, 6000);
}

boot();
