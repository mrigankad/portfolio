# Portfolio with Scroll-Driven 3D Character — Design

**Date:** 2026-07-17
**Status:** Approved design, pending implementation plan

## 1. Overview

A single-page portfolio for Mriganka (UI/UX designer) built around an AI-generated 3D version of an existing 2D cartoon character (`assets/character.png`). The character performs a continuous scroll-driven show: a cinematic camera pull-back in the hero, then pinned beside the content reacting to each section.

Video clips are generated in Google Flow using **Frames to Video** (first frame + last frame → Veo interpolates), chained so each clip's first frame is the previous clip's actual last frame. Stills are generated in Gemini (Nano Banana) from the original character image.

**Vibe:** light & playful — warm cream page, near-black ink text, teal accent pulled from the character's shirt.

**Success criteria**

- Hero scrub feels frame-accurate and smooth in both scroll directions (Chrome, Firefox, Safari, mobile Safari/Chrome).
- Canvas → video handoff after the hero is visually undetectable.
- Video rectangles are indistinguishable from the page background (sampled hex match).
- Initial page weight ≤ ~5 MB; reaction clips lazy-loaded.
- `prefers-reduced-motion` and load-failure fallbacks show a static, fully readable page.
- Site works with placeholder assets before any Flow generation happens.

## 2. Character asset pipeline (user-executed, guided by this spec)

### 2.1 Stills — Gemini (Nano Banana), uploading `assets/character.png`

**Still 1 — master full body (anchor for everything):**

> Transform this 2D cartoon character into a stylized 3D render in the style of a modern Pixar animated film, keeping his exact design: voluminous messy dark-brown hair, thick eyebrows, large round cartoon eyes, chinstrap beard with light stubble, teal short-sleeve t-shirt layered over a grey long-sleeve shirt, dark slim jeans, cream sneakers, round white wristwatch on his left wrist. Full body, standing relaxed and centered, arms at his sides, gentle friendly expression, facing the camera. Soft even studio lighting, soft contact shadow under his feet, plain seamless warm cream studio background, no other objects, no text. 16:9 landscape composition with headroom above his hair.

**Pose edits** — each starts a new prompt with the master image uploaded, prefixed with: *"Same character, same 3D style, same seamless warm cream background, same framing and lighting."*

- **Still 0 (hero start):** "Extreme close-up of his face filling the frame, looking straight into the camera, calm slightly-curious expression, shallow depth of field. 16:9."
- **Still 2 (wave):** "He raises his right hand in a warm friendly wave at the camera, smiling. Full body, same camera framing as the reference."
- **Still 3 (point):** "He points confidently toward the right side of the frame with his right hand, looking at the camera with a proud smile. Full body, same camera framing as the reference."
- **Still 4 (ta-da):** "Both hands spread palms-up in a cheerful 'ta-da' presenting gesture, big proud smile. Full body, same camera framing as the reference."
- **Still 5 (thumbs-up):** "Enthusiastic thumbs-up with his right hand, winking at the camera, big smile. Full body, same camera framing as the reference."

### 2.2 Clips — Google Flow, "Frames to Video" (Veo 3.1, 16:9, 1080p downloads, Google AI Pro budget)

| Clip | Duration | First frame | Last frame | Used for |
|---|---|---|---|---|
| C1 hero | ~8 s | Still 0 | Still 1 | canvas scrub in hero |
| C2 wave | ~4 s | extracted last frame of C1 | Still 2 | About |
| C3 point | ~4 s | extracted last frame of C2 | Still 3 | Projects |
| C4 ta-da | ~4 s | extracted last frame of C3 | Still 4 | Skills |
| C5 thumbs-up | ~4 s | extracted last frame of C4 | Still 5 | Contact |

**C1 motion prompt:**

> Smooth continuous camera dolly pulling back from an extreme close-up of the character's face to a full-body wide shot of him standing centered on a seamless warm cream studio background. He stays relaxed, blinks naturally, and a small warm smile appears as the camera settles. Stylized 3D character animation, Pixar-film quality, soft even studio lighting, locked exposure, no camera cuts, no scene change, no background change, no text.

**C2–C5 template:**

> Locked-off camera, absolutely no camera movement. [MOTION]. Stylized 3D character animation, Pixar-film quality, soft even studio lighting, seamless warm cream background, no cuts, no zoom, no background change, no text.

- **C2:** "He lifts his right hand and gives a warm friendly wave to the camera, smiling, then holds the wave"
- **C3:** "He lowers his hand, then points confidently toward the right side of the frame, looking at the camera with a proud smile, and holds the point"
- **C4:** "He turns both palms up and spreads his hands in a cheerful 'ta-da' presenting gesture, big proud smile, and holds it"
- **C5:** "He relaxes his arms, then gives an enthusiastic thumbs-up and a friendly wink straight to camera, and holds the pose"

### 2.3 Consistency rules

- One Flow project for all clips; ~2 takes per clip, reject takes where clothing colors, beard, background shade, or framing drift.
- Character points screen-right because he is pinned on the page's left with content on the right.
- Every reaction prompt ends with "holds the pose" so each clip freezes into a stable resting state.
- Chaining uses the *actual extracted last frame* of the previous clip (via the processing script), never the target still, so there are zero visible jumps between clips.
- Downloads land in `assets/clips/` as `c1.mp4` … `c5.mp4`.

## 3. Site architecture

### 3.1 Stack

Static site, no framework, no build step for the page itself:

- `index.html`, `css/styles.css`, `js/main.js`
- **Lenis** for smooth scrolling; **GSAP + ScrollTrigger** for all scroll-linked animation (vendored or CDN, decided at implementation).
- Deployable to any static host; deployment setup itself is out of scope.

```
Portfolio/
├─ index.html
├─ css/styles.css
├─ js/main.js
├─ assets/
│  ├─ character.png       (original 2D, used for favicon + placeholder generation)
│  ├─ clips/              (user drops c1…c5 MP4s from Flow)
│  └─ frames/             (generated: hero WebP sequence, poster PNGs, meta.json)
└─ tools/process-clips.mjs
```

### 3.2 Hero (canvas scrub)

- Hero section ≈ 300vh scroll runway; sticky full-viewport `<canvas>` draws the C1 frame sequence with cover-fit math.
- ScrollTrigger scrub maps scroll progress → frame index (~80 frames, 10 fps extraction of the 8 s clip, 1600 px wide WebP, quality ~70, ~3–4 MB total).
- First ~10 frames preloaded eagerly for instant first paint; remainder streamed in background; if the user outruns loading, the latest loaded frame holds.
- Name + "UI/UX Designer" overlay fades in as the camera settles; scroll cue at the start. All copy is placeholder and user-editable in `index.html`.

### 3.3 Handoff and pinned reactions

- After the scrub, a short (~60vh) scroll segment shrinks/translates the canvas into the left column slot, then swaps it for the C2 `<video>` element. C2's first frame is pixel-identical to C1's last frame, making the swap invisible.
- Character stays pinned in the left column (ScrollTrigger pin) through About → Projects → Skills → Contact.
- Entering a section plays its clip once (muted, playsinline) then holds the final frame. Clip boundaries match by construction, so forward scrolling is seamless.
- Scrolling back up shows the earlier section's clip paused on its *last* frame (its resting pose). A small pose pop on upward re-entry is accepted for v1; no reverse playback.
- Reaction clips: H.264 MP4, muted, `+faststart`, ~720–1080 p, lazy-loaded one section ahead via ScrollTrigger/IntersectionObserver, with poster PNGs so nothing flashes.

### 3.4 Sections (right column)

1. **About** — heading, short bio, fact chips. Character waves.
2. **Projects** — 3 project cards (placeholder image/title/link, hover lift). Character points at them.
3. **Skills** — chip grid (Figma, prototyping, design systems, user research, …). Character ta-da.
4. **Contact** — large email CTA (mriganka.uiux@gmail.com), social links, resume button (placeholder href). Character thumbs-up.

Content reveals are gentle fade/slide-ups; no scroll-jacking outside the hero pin. Palette: cream background (exact hex sampled from rendered frames), warm near-black ink, teal accent (from the shirt); friendly rounded display type chosen at implementation.

### 3.5 Mobile (< ~820 px)

- Hero scrub unchanged (cover-fit keeps the centered character framed).
- No side column: each section shows its reaction clip as a smaller inline video at the section top, playing on enter. No pinning.

### 3.6 Fallbacks

- `prefers-reduced-motion`: no scrub, no autoplaying reactions — static master still, plain scrolling page.
- Frame/clip load failure: hero falls back to the poster still; sections render without video columns.
- Placeholder mode (pre-Flow): placeholder hero frames are programmatic zoom-crops of `assets/character.png`; reaction slots show the static character. The full scroll system is buildable and testable in this mode.

## 4. Processing tooling (`tools/process-clips.mjs`)

One script, run with Node; requires ffmpeg (script checks and prints install instructions if missing). Commands:

- `lastframe <clip>` — extracts a clip's final frame as PNG (uploaded to Flow as the next clip's first frame during generation).
- `build` — extracts hero WebP sequence, poster PNGs for every clip, re-encodes reactions (muted, faststart), samples the background hex from a frame corner, writes `assets/frames/meta.json` (frame count, bg hex) consumed by CSS/JS.
- `placeholders` — generates the placeholder hero sequence from `character.png`.

## 5. Build order

1. Scaffold site + tooling; generate placeholders; full scroll system working with placeholder assets.
2. User generates stills (Gemini) and clips (Flow) per §2, using `lastframe` between clips, drops MP4s into `assets/clips/`.
3. Run `build`; verify seams (bg blend, handoff swap, clip boundaries); polish timings.

## 6. Out of scope (v1)

- Case-study subpages, blog, CMS, analytics, contact form backend, deployment configuration, reverse playback of reactions, alternate takes per section.
