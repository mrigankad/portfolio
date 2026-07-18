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

    node --test
