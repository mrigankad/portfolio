import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './style.css';
import { initHero } from './hero.js';
import { initReactions } from './reactions.js';
import { initModelGallery } from './models.js';

gsap.registerPlugin(ScrollTrigger);

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
  if (meta?.bgLightHex) document.documentElement.style.setProperty('--bg-light', meta.bgLightHex);
  initModelGallery(); // plain DOM — works in static mode too
  if (!meta || reduced) {
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
  reveals();
  hero.ready.then(() => document.body.classList.add('is-ready'));
  // Never trap anyone on the loader — reveal regardless after 6s.
  setTimeout(() => document.body.classList.add('is-ready'), 6000);
}

boot();
