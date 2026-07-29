# BGS CORNER

A scroll-driven site for BGS CORNER, a rare perfumery house. The hero is a
177-frame image sequence scrubbed by scroll position on a `<canvas>`, with
chapter captions that fade in and out against the cuts in the footage.

No build step, no dependencies — open `index.html` or serve the folder.

```bash
python3 -m http.server 4321
```

## How the hero works

`assets/js/main.js` holds the whole thing:

1. **Two image sets.** `assets/frames/desktop` (1600px) and
   `assets/frames/mobile` (900px). The set is chosen once at load from
   `(max-width: 820px)`.
2. **Two-pass loading.** Every 8th frame loads first — enough to scrub the
   full range immediately — and the preloader clears as soon as that pass is
   done (~23 images). The remaining frames stream in behind it at a
   concurrency of 6. Until a frame arrives, `nearestLoaded()` draws the closest
   one that has, so scrubbing never stalls or flashes.
3. **Scroll → progress.** The hero is a 600vh runway wrapping a
   `position: sticky` viewport. Progress is the sticky element's offset through
   that runway, clamped 0–1.
4. **Smoothing.** A `requestAnimationFrame` loop lerps the drawn progress
   toward the scroll progress at 0.13 per frame, so the sequence trails the
   wheel slightly instead of snapping frame to frame. The canvas only redraws
   when the frame index actually changes.
5. **Cover fit.** Frames are drawn scaled to cover the viewport at up to 2×
   DPR, recomputed on resize.

## Caption placement

The footage is not clean plate — some scenes carry burned-in material labels
at frame-left, and the flacon sits right of centre. Captions are therefore
pinned to a 12-column grid rather than centred:

| Chapter | Scene | Placement |
|---|---|---|
| 01 | macro, stopper lifting | centred |
| 02 | flacon + material labels | columns 5–8, the gap between labels and bottle |
| 03 | the boutique counter | low-left, over marble |
| 04 | flacon + material labels | columns 5–8 |
| 05 | macro, the invitation | centred |

Below 820px every chapter caption drops to a full-width bottom band, since the
cover crop leaves no clean side margin.

Each caption carries its own radial scrim (`.cap::before`) instead of washing
the whole frame, which would dim the labels the footage is trying to show.

## Structure

```
index.html
assets/
  css/style.css
  js/main.js
  frames/desktop/f_0001.jpg … f_0177.jpg   (1600px, ~12 MB)
  frames/mobile/f_0001.jpg  … f_0177.jpg   (900px,  ~5.7 MB)
```

Stills elsewhere on the page are pulled from the same sequence via
`data-frame="N"`, with an optional `data-pos="64%"` to nudge the crop off the
burned-in labels.

## Regenerating frames

The sequence was rendered from 354 source frames at 3840×2160, taking every
second frame:

```bash
for n in $(seq 1 2 353); do
  ffmpeg -i "src/frame_$(printf '%06d' $n).png" -vf scale=1600:-2 -q:v 7 "assets/frames/desktop/f_$(printf '%04d' $i).jpg"
  ffmpeg -i "src/frame_$(printf '%06d' $n).png" -vf scale=900:-2  -q:v 7 "assets/frames/mobile/f_$(printf '%04d' $i).jpg"
done
```

If the frame count changes, update `FRAME_COUNT` in `assets/js/main.js`.

## Accessibility

`prefers-reduced-motion: reduce` collapses the hero to a single viewport with
a static frame and disables the grain, marquee, and reveal transitions.
