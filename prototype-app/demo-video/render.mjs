// Renders the demo stage frame by frame into an H.264 video.
//
//   node demo-video/render.mjs [--out demo.mp4] [--w 1080] [--h 1080] [--fps 60]
//                              [--from 0] [--to <end>] [--stills 1.5,4,9.2 --stills-dir dir]
//
// Starts the Vite dev server, opens demo-video/stage.html in headless
// Chromium with the virtual clock injected, then advances the clock exactly
// one frame at a time and pipes every screenshot into ffmpeg. With --stills
// it only writes PNGs at the given timestamps (handy while choreographing).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const W = +(args.w || 1080);
const H = +(args.h || 1080);
const FPS = +(args.fps || 60);
const OUT = resolve(args.out || join(here, 'egnach-plus-demo.mp4'));
const STILLS = args.stills ? String(args.stills).split(',').map(Number).sort((a, b) => a - b) : null;
const STILLS_DIR = resolve(args['stills-dir'] || join(here, 'stills'));

const server = await createServer({ root: join(here, '..'), logLevel: 'error', server: { port: 0, hmr: false } });
await server.listen();
const { port } = server.httpServer.address();

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await context.addInitScript({ path: join(here, 'virtual-time.js') });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[page error]', e.message));

await page.goto(`http://localhost:${port}/demo-video/stage.html?w=${W}&h=${H}`);
// Playwright's own waitForFunction polls with the page's (virtual) timers,
// so poll from Node instead.
for (let i = 0; !(await page.evaluate(() => window.__stageReady === true)); i++) {
  if (i > 600) throw new Error('stage did not become ready');
  await new Promise((r) => setTimeout(r, 100));
}
const duration = await page.evaluate(() => window.__stage.duration);
const from = +(args.from || 0);
const to = Math.min(+(args.to || duration), duration);
const total = Math.round(to * FPS);
const first = Math.round(from * FPS);
const cdp = await context.newCDPSession(page);

async function step() {
  await page.evaluate(async (dt) => {
    window.__stage.step(dt);
    // let React and framer-motion finish the work this frame queued
    const tick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
    await tick();
    await tick();
    await new Promise((r) => window.__vt.realSetTimeout(r, 0));
    await tick();
  }, 1000 / FPS);
}

async function shot(format) {
  const { data } = await cdp.send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality: 94 } : {}) });
  return Buffer.from(data, 'base64');
}

let ffmpeg = null;
if (!STILLS) {
  ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
} else {
  mkdirSync(STILLS_DIR, { recursive: true });
}

const started = Date.now();
let nextStill = 0;
for (let f = 1; f <= total; f++) {
  await step();
  const t = f / FPS;
  if (STILLS) {
    while (nextStill < STILLS.length && STILLS[nextStill] <= t + 1e-6) {
      const name = join(STILLS_DIR, `t${STILLS[nextStill].toFixed(2).padStart(6, '0')}.png`);
      writeFileSync(name, await shot('png'));
      console.log('still', name);
      nextStill++;
    }
    if (nextStill >= STILLS.length) break;
  } else if (f > first) {
    const buf = await shot('jpeg');
    if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  }
  if (f % (FPS * 2) === 0) {
    const el = (Date.now() - started) / 1000;
    console.log(`t=${t.toFixed(1)}s / ${to.toFixed(1)}s  (${el.toFixed(0)}s elapsed)`);
  }
}

if (ffmpeg) {
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on('close', r));
  console.log('wrote', OUT);
}
await browser.close();
await server.close();
