# Demo video

A showcase video of the prototype in the style of Telegram's feature
announcements: the real app runs inside a phone on an animated four-colour
gradient with a doodle pattern, the camera pushes towards whatever matters,
and UI elements lift out of the screen while the rest dims.

## Render

```bash
npm install
node demo-video/render.mjs --out demo-video/egnach-plus-demo.mp4
```

Options:

| Flag | Default | |
| --- | --- | --- |
| `--w`, `--h` | `1080`, `1080` | Output size; the phone scales to fit, so `--w 1080 --h 1920` gives a vertical cut |
| `--fps` | `60` | |
| `--from`, `--to` | whole timeline | Render only part of the timeline (seconds) |
| `--stills 1.5,4,9.2` | | Write PNG stills at these timestamps instead of a video (`--stills-dir` sets the folder) |

Requirements: Playwright with Chromium (`require('playwright')` must
resolve) and `ffmpeg` with `libx264` on the `PATH`.

## How it works

- `stage.html` / `stage.js` build the stage: background, phone frame and
  the app in an iframe (`/index.html`, served by Vite). They also provide
  the primitives the choreography uses: camera moves, `pop` (lift an
  element out of the screen), `flyIn`, `tap`, `swipe`, `drag` and `type`.
  Flying elements are live DOM clones of the app's own elements.
- `timeline.js` is the choreography. Each scene is written relative to its
  own start time, so scenes can be retimed independently.
- `virtual-time.js` is injected into the stage and the app before any
  script runs and replaces `performance.now`, `requestAnimationFrame` and
  the timers with one virtual clock. `render.mjs` advances that clock by
  exactly one frame, waits for React to settle, takes a screenshot and pipes
  it to ffmpeg, so every framer-motion animation is captured frame-perfect
  regardless of how fast the machine is.

For a rough real-time preview, run `npm run dev` and open
`/demo-video/stage.html?preview`.
