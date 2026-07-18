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
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top < innerHeight * 0.92) return;
    gsap.from(el, {
      opacity: 0, y: 26, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
  // Re-measure trigger positions once every asset has loaded and laid out.
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
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
  if (!meta || reduced || location.search.includes('nofx')) {
    staticMode(meta);
    return;
  }

  const lenis = new Lenis({ lerp: 0.12 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anchor navigation glides with Lenis instead of jumping.
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
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
