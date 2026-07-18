import { ScrollTrigger } from 'gsap/ScrollTrigger';

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
  const isMobileStage = container.classList.contains('inline-stage');

  for (const key of keys) {
    if (meta.hasClips && meta.clips?.[key]) {
      const v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      // The first inline clip appears immediately after the long mobile hero.
      // Fetch it early so it is ready before its ScrollTrigger enters view.
      v.preload = isMobileStage && key === ORDER[0] ? 'auto' : 'none';
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
    warmVideo(next);
    if (el.tagName !== 'VIDEO') return;
    warmVideo(el);
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

function warmVideo(video) {
  if (video?.tagName !== 'VIDEO' || video.preload !== 'none') return;
  video.preload = 'auto';
  video.load();
}

function seekToEnd(video) {
  const seek = () => { video.pause(); video.currentTime = Math.max(0, video.duration - 0.05); };
  if (video.readyState >= 1) seek();
  else video.addEventListener('loadedmetadata', seek, { once: true });
}
