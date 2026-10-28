// Demo stage: renders the real prototype inside a phone on a Telegram-style
// animated gradient and choreographs camera moves, taps and "flying" UI
// clones on top of it. Everything is a pure function of the stage clock, so
// render.mjs can step it frame by frame (see virtual-time.js).
import iconSource from '../src/components/Icon.jsx?raw';
import { buildTimeline } from './timeline.js';

const params = new URLSearchParams(location.search);
const W = +params.get('w') || 1080;
const H = +params.get('h') || 1080;
const PREVIEW = params.has('preview');

const PHONE = { w: 402, h: 874, bezel: 12, status: 54, radius: 50 };
const APP_H = PHONE.h - PHONE.status;
const FULL_H = PHONE.h + 2 * PHONE.bezel;
const FULL_W = PHONE.w + 2 * PHONE.bezel;
const BASE_ZOOM = Math.min((H * 0.83) / FULL_H, (W * 0.83) / FULL_W);

/* ── Easing ─────────────────────────────────────────────────────────── */

const clamp01 = (p) => Math.max(0, Math.min(1, p));
const lerp = (a, b, p) => a + (b - a) * p;

const ease = {
  linear: (p) => p,
  in: (p) => p * p * p,
  out: (p) => 1 - Math.pow(1 - p, 3),
  outQuint: (p) => 1 - Math.pow(1 - p, 5),
  inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  inOutQuart: (p) => (p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  // Damped spring that settles at 1 with a single soft overshoot.
  spring: (p) => (p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(8.2 * p)),
  softSpring: (p) => (p >= 1 ? 1 : 1 - Math.exp(-7.5 * p) * Math.cos(6 * p)),
};

/* ── DOM ────────────────────────────────────────────────────────────── */

const viewport = document.getElementById('viewport');
viewport.style.width = W + 'px';
viewport.style.height = H + 'px';

function el(tag, attrs = {}, parent) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style') Object.assign(e.style, v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  if (parent) parent.appendChild(e);
  return e;
}

const GRAD_RES = 72;
const gradCanvas = el('canvas', { id: 'gradient', width: GRAD_RES, height: GRAD_RES }, viewport);
const pattern = el('div', { id: 'pattern' }, viewport);
el('div', { id: 'vignette' }, viewport);
const cam = el('div', { id: 'cam' }, viewport);

const B = PHONE.bezel;
const phone = el('div', { id: 'phone', style: {
  left: -B + 'px', top: -B + 'px', width: FULL_W + 'px', height: FULL_H + 'px',
} }, cam);
for (const [side, top, h] of [['l', 170, 34], ['l', 230, 62], ['l', 304, 62], ['r', 250, 98]]) {
  el('div', { class: 'phone-key', style: {
    top: top + 'px', height: h + 'px', [side === 'l' ? 'left' : 'right']: '-3px',
  } }, phone);
}
const screen = el('div', { id: 'screen', style: {
  left: B + 'px', top: B + 'px', width: PHONE.w + 'px', height: PHONE.h + 'px',
  borderRadius: PHONE.radius + 'px',
} }, phone);
el('div', { id: 'statusbar', style: { height: PHONE.status + 'px' }, html: `
  <span class="time">9:41</span>
  <span class="icons">
    <svg width="18" height="12" viewBox="0 0 19 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7"/><rect x="4.8" y="5" width="3.2" height="7" rx="0.7"/><rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7"/><rect x="14.4" y="0" width="3.2" height="12" rx="0.7"/></svg>
    <svg width="16" height="12" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z"/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z"/><circle cx="8.5" cy="10.5" r="1.5"/></svg>
    <svg width="26" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="#000" stroke-opacity="0.35" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2"/><path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill-opacity="0.4"/></svg>
  </span>` }, screen);
el('div', { id: 'island' }, screen);
const iframe = el('iframe', { id: 'app', style: {
  top: PHONE.status + 'px', width: PHONE.w + 'px', height: APP_H + 'px',
} }, screen);
const dim = el('div', { id: 'dim' }, screen);
el('div', { id: 'homebar' }, screen);
const fly = el('div', { id: 'fly', style: { width: PHONE.w + 'px', height: PHONE.h + 'px' } }, cam);
const touches = el('div', { id: 'touches', style: { width: PHONE.w + 'px', height: PHONE.h + 'px' } }, cam);

/* ── Background: Telegram-style four-point gradient + doodle pattern ── */

// The eight anchor positions Telegram's animated wallpapers cycle through;
// the four colours sit on every other anchor and step one anchor per shift.
const GRAD_POS = [[0.80, 0.10], [0.60, 0.20], [0.35, 0.25], [0.25, 0.60], [0.20, 0.90], [0.40, 0.80], [0.65, 0.75], [0.75, 0.40]];
const GRAD_COLORS = ['#d3ecc4', '#3fa877', '#b9e1f1', '#2f95cf'].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));

const gctx = gradCanvas.getContext('2d');
const gimg = gctx.createImageData(GRAD_RES, GRAD_RES);

function drawGradient(phase) {
  const pts = GRAD_COLORS.map((_, i) => {
    const k = ((i * 2 + phase) % 8 + 8) % 8;
    const a = Math.floor(k);
    const f = ease.inOutSine(k - a);
    const p0 = GRAD_POS[a % 8];
    const p1 = GRAD_POS[(a + 1) % 8];
    return [lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f)];
  });
  const d = gimg.data;
  for (let y = 0; y < GRAD_RES; y++) {
    for (let x = 0; x < GRAD_RES; x++) {
      let u = x / (GRAD_RES - 1);
      let v = y / (GRAD_RES - 1);
      // gentle swirl around the centre, like the original shader
      const cx = u - 0.5;
      const cy = v - 0.5;
      const cd = Math.hypot(cx, cy);
      const th = 0.35 * cd * 0.35 * cd * 6.4;
      u = 0.5 + cx * Math.cos(th) - cy * Math.sin(th);
      v = 0.5 + cx * Math.sin(th) + cy * Math.cos(th);
      let r = 0, g = 0, b = 0, ws = 0;
      for (let i = 0; i < 4; i++) {
        let w = Math.max(0, 0.9 - Math.hypot(u - pts[i][0], v - pts[i][1]));
        w = w * w * w * w;
        r += GRAD_COLORS[i][0] * w;
        g += GRAD_COLORS[i][1] * w;
        b += GRAD_COLORS[i][2] * w;
        ws += w;
      }
      const o = (y * GRAD_RES + x) * 4;
      d[o] = r / ws;
      d[o + 1] = g / ws;
      d[o + 2] = b / ws;
      d[o + 3] = 255;
    }
  }
  gctx.putImageData(gimg, 0, 0);
}

// Seeded doodle tile built from the app's own icon set.
function buildPattern() {
  const paths = {};
  for (const m of iconSource.matchAll(/^\s+(\w+):\s+'([^']+)'/gm)) paths[m[1]] = m[2];
  const names = ['home', 'store', 'calendar', 'chat', 'pin', 'heart', 'star', 'bell', 'map', 'briefcase',
    'car', 'paws', 'reload', 'camera', 'image', 'swiss', 'globe', 'shield', 'send', 'language', 'mic', 'user'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const TILE = 560;
  const N = 7;
  const cell = TILE / N;
  let body = '';
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const name = names[Math.floor(rnd() * names.length)];
      const s = 1.05 + rnd() * 0.55;
      const x = gx * cell + cell * (0.2 + rnd() * 0.6) + (gy % 2) * cell * 0.5;
      const y = gy * cell + cell * (0.2 + rnd() * 0.6);
      const rot = Math.round(rnd() * 70 - 35);
      for (const [ox, oy] of [[0, 0], [-TILE, 0]]) {
        body += `<path d="${paths[name]}" transform="translate(${(x + ox).toFixed(1)} ${(y + oy).toFixed(1)}) rotate(${rot}) scale(${s.toFixed(2)}) translate(-12 -12)"/>`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}"><g fill="none" stroke="#04281b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  pattern.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  pattern.style.backgroundSize = `${TILE}px ${TILE}px`;
}
buildPattern();

/* ── Camera ─────────────────────────────────────────────────────────── */

const CAM_FIELDS = ['fx', 'fy', 'zoom', 'rx', 'ry', 'rz', 'ox', 'oy'];
const camera = {
  initial: { fx: PHONE.w / 2, fy: PHONE.h / 2, zoom: 1, rx: 0, ry: 0, rz: 0, ox: 0, oy: 0 },
  segs: [],
  // Move the camera towards `target` (fields or a function returning
  // fields, resolved when the move starts) over `dur` seconds.
  to(t, dur, target, easing = 'inOut') {
    this.segs.push({ t, dur, target, easing });
    this.segs.sort((a, b) => a.t - b.t);
  },
  value(t) {
    const v = { ...this.initial };
    const latest = {};
    for (const s of this.segs) {
      if (t < s.t) break;
      if (!s.to) {
        s.from = { ...(this.current || this.initial) };
        const target = typeof s.target === 'function' ? s.target(s.from) : s.target;
        s.to = {};
        for (const f of CAM_FIELDS) if (target && target[f] !== undefined) s.to[f] = target[f];
      }
      for (const f of Object.keys(s.to)) latest[f] = s;
    }
    for (const [f, s] of Object.entries(latest)) {
      const p = s.dur > 0 ? clamp01((t - s.t) / s.dur) : 1;
      v[f] = lerp(s.from[f], s.to[f], ease[s.easing](p));
    }
    this.current = v;
    return v;
  },
};

/* ── Access to the app inside the phone ─────────────────────────────── */

const appDoc = () => iframe.contentDocument;
const appWin = () => iframe.contentWindow;

// Element rectangle in phone-screen coordinates.
function screenRect(node) {
  const r = node.getBoundingClientRect();
  const y = r.top + PHONE.status;
  return { x: r.left, y, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: y + r.height / 2 };
}

const q = {
  doc: appDoc,
  win: appWin,
  rect: screenRect,
  sel: (s) => appDoc().querySelector(s),
  all: (s) => [...appDoc().querySelectorAll(s)],
  // Innermost element whose own text equals `text` (optionally the nth match).
  text(text, nth = 0) {
    const hits = [...appDoc().querySelectorAll('body *')].filter((n) =>
      [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim() === text));
    return hits[nth] || null;
  },
  label: (l) => appDoc().querySelector(`[aria-label="${l}"]`),
  up(node, pred) {
    for (let n = node; n && n !== appDoc().body; n = n.parentElement) if (pred(n)) return n;
    return null;
  },
  // Closest ancestor that looks like a card: painted background + rounded corners.
  card(node, minW = 100) {
    return q.up(node, (n) => {
      const cs = appWin().getComputedStyle(n);
      return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.borderTopLeftRadius !== '0px' && n.offsetWidth >= minW;
    });
  },
  scroller(node, axis = 'y') {
    return q.up(node, (n) => {
      const cs = appWin().getComputedStyle(n);
      const o = axis === 'y' ? cs.overflowY : cs.overflowX;
      return (o === 'auto' || o === 'scroll') && (axis === 'y' ? n.scrollHeight > n.clientHeight : n.scrollWidth > n.clientWidth);
    });
  },
};

/* ── Timeline primitives ────────────────────────────────────────────── */

const events = [];  // { t, fn } fired once
const anims = [];   // { t0, t1, begin, update, end }
const bgShifts = [];
let dimLevel = 0;
let blurLevel = 0;

function at(t, fn) {
  events.push({ t, fn });
}

function addAnim(a) {
  anims.push(a);
  return a;
}

// Lift an element out of the screen, hold it in front of the phone and then
// either put it back (exit: 'back') or let it dissolve towards `fadeTo`
// while the app navigates underneath (exit: 'fade').
function pop(t, opts) {
  const o = {
    out: 0.5, hold: 1, back: 0.45, exit: 'back',
    x: 0, y: 0, z: 120, s: 1.3, r: 0, dim: 0.32, blur: 1.6, float: 1,
    ...opts,
  };
  const to = { x: o.x, y: o.y, z: o.z + 120, s: o.s * 1.2, ...o.fadeTo };
  const tBack = t + o.out + o.hold;
  return addAnim({
    t0: t, t1: tBack + o.back,
    begin() {
      const src = o.find();
      if (!src) { console.warn('pop: element not found', o.name || ''); this.dead = true; return; }
      this.src = src;
      this.item = cloneToFly(src);
      this.prevVis = src.style.visibility;
      src.style.visibility = 'hidden';
    },
    update(now) {
      if (this.dead) return;
      let L;      // eased lift for transforms
      let Ls;     // smooth lift for shadow / dim
      let k = 0;  // progress towards `to` during a fade exit
      let fade = 1;
      if (now < t + o.out) {
        const p = clamp01((now - t) / o.out);
        L = ease.spring(p);
        Ls = ease.out(p);
      } else if (now < tBack) {
        L = Ls = 1;
      } else if (o.exit === 'fade') {
        const p = clamp01((now - tBack) / o.back);
        k = ease.inOut(p);
        L = 1;
        Ls = 1 - k;
        fade = 1 - ease.in(p);
      } else {
        L = Ls = 1 - ease.inOut(clamp01((now - tBack) / o.back));
      }
      const ft = now - t;
      const bob = o.float * Ls;
      const x = lerp(o.x * L, to.x, k);
      const y = lerp(o.y * L, to.y, k) + Math.sin(ft * 2.4) * 3 * bob;
      const z = lerp(o.z * L, to.z, k);
      const s = lerp(1 + (o.s - 1) * L, to.s, k);
      const r = o.r * L + Math.sin(ft * 1.7 + 0.6) * 0.5 * bob;
      this.item.wrap.style.transform = `translate3d(${x}px, ${y}px, ${Math.max(0, z)}px) scale(${s}) rotate(${r}deg)`;
      this.item.wrap.style.opacity = fade;
      this.item.wrap.style.filter = Ls > 0.001
        ? `drop-shadow(0 ${(4 + 26 * Ls).toFixed(1)}px ${(8 + 30 * Ls).toFixed(1)}px rgba(4, 34, 24, ${(0.30 * Ls).toFixed(3)}))`
        : 'none';
      dimLevel = Math.max(dimLevel, o.dim * Ls * fade);
      blurLevel = Math.max(blurLevel, o.blur * Ls * fade);
    },
    end() {
      if (this.dead) return;
      this.item.wrap.remove();
      this.src.style.visibility = this.prevVis;
    },
  });
}

// Let clones of elements fly in from outside the phone and land on their
// real position; the originals stay hidden until their clone has landed.
function flyIn(t, opts) {
  const o = { dur: 0.75, stagger: 0.09, from: () => ({ x: 260, y: -40, z: 220, s: 1.3, r: 8 }), ...opts };
  let list = [];
  const a = {
    t0: t, t1: t + o.dur + 12 * o.stagger,
    begin() {
      list = o.find().map((src, i) => {
        const item = cloneToFly(src, settledRect(src));
        const prev = src.style.visibility;
        src.style.visibility = 'hidden';
        return { src, item, prev, i, from: o.from(i, item.rect), done: false };
      });
      this.t1 = t + o.dur + Math.max(0, list.length - 1) * o.stagger;
    },
    update(now) {
      for (const it of list) {
        if (it.done) continue;
        const p = clamp01((now - t - it.i * o.stagger) / o.dur);
        const L = 1 - ease.softSpring(p);
        const f = it.from;
        it.item.wrap.style.transform = `translate3d(${f.x * L}px, ${f.y * L}px, ${Math.max(0, f.z * L)}px) scale(${1 + (f.s - 1) * L}) rotate(${f.r * L}deg)`;
        it.item.wrap.style.opacity = clamp01(p * 4);
        const sh = Math.min(1, Math.abs(L) * 1.6);
        it.item.wrap.style.filter = `drop-shadow(0 ${(4 + 24 * sh).toFixed(1)}px ${(8 + 26 * sh).toFixed(1)}px rgba(4, 34, 24, ${(0.26 * sh).toFixed(3)}))`;
        if (p >= 1) {
          it.done = true;
          it.item.wrap.remove();
          it.src.style.visibility = it.prev;
        }
      }
    },
    end() {
      for (const it of list) if (!it.done) { it.item.wrap.remove(); it.src.style.visibility = it.prev; }
    },
  };
  return addAnim(a);
}

// Where an element will rest once the entrance transforms on it and its
// ancestors (framer-motion staggers) have played out.
function settledRect(src) {
  const r = screenRect(src);
  let dx = 0;
  let dy = 0;
  for (let n = src; n; n = n.parentElement) {
    const tf = n.ownerDocument.defaultView.getComputedStyle(n).transform;
    if (tf && tf !== 'none') {
      const m = new DOMMatrix(tf);
      dx += m.e;
      dy += m.f;
    }
  }
  return { ...r, x: r.x - dx, y: r.y - dy, cx: r.cx - dx, cy: r.cy - dy };
}

function cloneToFly(src, rect = screenRect(src)) {
  const win = src.ownerDocument.defaultView;
  // the app's design tokens live on its <html>; mirror them for the clones
  fly.style.cssText += ';' + src.ownerDocument.documentElement.style.cssText;
  const ps = win.getComputedStyle(src.parentElement || src);
  const wrap = el('div', { class: 'fly-item', style: {
    left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px',
    fontFamily: ps.fontFamily, color: ps.color, fontSize: ps.fontSize, lineHeight: ps.lineHeight,
    letterSpacing: ps.letterSpacing, textAlign: ps.textAlign,
  } }, fly);
  const clone = document.importNode(src, true);
  const cs = win.getComputedStyle(src);
  Object.assign(clone.style, {
    width: rect.w + 'px', height: rect.h + 'px', maxWidth: 'none', maxHeight: 'none',
    flex: 'none', transform: 'none', opacity: '1', visibility: 'visible', boxSizing: 'border-box',
  });
  if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky') {
    Object.assign(clone.style, { position: 'relative', left: 'auto', top: 'auto', right: 'auto', bottom: 'auto', inset: 'auto' });
  }
  // form values and scroll offsets are not part of the markup
  const srcFields = src.querySelectorAll('input, textarea');
  clone.querySelectorAll('input, textarea').forEach((f, i) => { f.value = srcFields[i].value; });
  wrap.appendChild(clone);
  const srcAll = [src, ...src.querySelectorAll('*')];
  const cloneAll = [clone, ...clone.querySelectorAll('*')];
  srcAll.forEach((s, i) => {
    if (s.scrollLeft || s.scrollTop) { cloneAll[i].scrollLeft = s.scrollLeft; cloneAll[i].scrollTop = s.scrollTop; }
  });
  return { wrap, clone, rect };
}

// Touch indicator: fades in, presses, fires `click` and releases with a ring.
function tap(t, opts) {
  const o = { appear: 0.24, hold: 0.12, z: 0, click: true, ...opts };
  const start = t - o.appear;
  let dot, ring, pos;
  at(t, () => {
    const target = o.find ? o.find() : null;
    if (typeof o.click === 'function') o.click(target);
    else if (o.click && target) target.click();
    else if (o.click && !target) console.warn('tap: target not found', o.name || '');
  });
  return addAnim({
    t0: start, t1: t + o.hold + 0.5,
    begin() {
      pos = o.pos ? o.pos() : (() => { const n = o.find(); return n ? screenRect(n) : { cx: 0, cy: 0 }; })();
      if (o.dx) pos = { ...pos, cx: pos.cx + o.dx };
      if (o.dy) pos = { ...pos, cy: pos.cy + o.dy };
      ring = el('div', { class: 'touch-ring' }, touches);
      dot = el('div', { class: 'touch' }, touches);
      ring.style.opacity = 0;
    },
    update(now) {
      const place = (n, s, op) => {
        n.style.transform = `translate3d(${pos.cx}px, ${pos.cy}px, ${o.z + 1}px) scale(${s})`;
        n.style.left = '0px';
        n.style.top = '0px';
        n.style.opacity = op;
      };
      let s;
      let op;
      if (now < t) {
        const p = clamp01((now - start) / o.appear);
        s = lerp(1.35, 1, ease.out(p));
        op = ease.out(p);
      } else if (now < t + o.hold) {
        const p = clamp01((now - t) / 0.08);
        s = lerp(1, 0.8, ease.out(p));
        op = 1;
      } else {
        const p = clamp01((now - t - o.hold) / 0.28);
        s = lerp(0.8, 1.05, ease.out(p));
        op = 1 - ease.inOut(p);
        const pr = clamp01((now - t - o.hold) / 0.5);
        place(ring, lerp(0.8, 2.2, ease.out(pr)), 0.85 * (1 - pr));
      }
      place(dot, s, op);
    },
    end() { dot.remove(); ring.remove(); },
  });
}

// Finger-driven scroll: the indicator drags the content by `delta` and lifts
// off while the scroll decelerates.
function swipe(t, opts) {
  const o = { dur: 0.9, axis: 'y', delta: 200, finger: true, easing: 'inOut', ...opts };
  let node, from, dot, start;
  return addAnim({
    t0: t, t1: t + o.dur,
    begin() {
      node = o.find();
      if (!node) { console.warn('swipe: scroller not found', o.name || ''); return; }
      from = o.axis === 'y' ? node.scrollTop : node.scrollLeft;
      if (o.finger) {
        const r = o.at ? o.at() : screenRect(node);
        start = { x: r.cx, y: r.cy };
        dot = el('div', { class: 'touch' }, touches);
      }
    },
    update(now) {
      if (!node) return;
      const p = clamp01((now - t) / o.dur);
      const delta = typeof o.delta === 'function' ? (o.delta = o.delta(node)) : o.delta;
      const pos = from + delta * ease[o.easing](p);
      if (o.axis === 'y') node.scrollTop = pos; else node.scrollLeft = pos;
      if (dot) {
        const pf = clamp01(p / 0.62);
        const travel = -delta * ease.inOut(pf) * 0.85;
        const x = start.x + (o.axis === 'x' ? travel : 0);
        const y = start.y + (o.axis === 'y' ? travel : 0);
        const appear = ease.out(clamp01(p / 0.12));
        const vanish = 1 - ease.inOut(clamp01((p - 0.6) / 0.25));
        dot.style.left = '0px';
        dot.style.top = '0px';
        dot.style.transform = `translate3d(${x}px, ${y}px, 1px) scale(${lerp(1.3, 0.85, appear)})`;
        dot.style.opacity = appear * vanish;
      }
    },
    end() { if (dot) dot.remove(); },
  });
}

// Finger drag along a straight line (e.g. the iOS edge-swipe back gesture);
// `onRelease` fires when the finger lifts.
function drag(t, opts) {
  const o = { dur: 0.6, ...opts };
  let dot;
  if (o.onRelease) at(t + o.dur * 0.8, o.onRelease);
  return addAnim({
    t0: t, t1: t + o.dur,
    begin() { dot = el('div', { class: 'touch' }, touches); },
    update(now) {
      const p = clamp01((now - t) / o.dur);
      const pm = ease.inOut(clamp01(p / 0.8));
      const x = lerp(o.from.x, o.to.x, pm);
      const y = lerp(o.from.y, o.to.y, pm);
      const op = ease.out(clamp01(p / 0.15)) * (1 - ease.inOut(clamp01((p - 0.75) / 0.25)));
      dot.style.left = '0px';
      dot.style.top = '0px';
      dot.style.transform = `translate3d(${x}px, ${y}px, 1px) scale(${lerp(1.3, 0.85, ease.out(clamp01(p / 0.15)))})`;
      dot.style.opacity = op;
    },
    end() { dot.remove(); },
  });
}

// Type text into a React-controlled input, one character at a time.
function type(t, opts) {
  const o = { cps: 26, ...opts };
  const chars = [...o.text];
  chars.forEach((_, i) => {
    at(t + i / o.cps, () => {
      const field = o.find();
      if (!field) { console.warn('type: field not found'); return; }
      const proto = field.tagName === 'TEXTAREA' ? appWin().HTMLTextAreaElement.prototype : appWin().HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(field, chars.slice(0, i + 1).join(''));
      field.dispatchEvent(new (appWin().Event)('input', { bubbles: true }));
    });
  });
  return t + chars.length / o.cps;
}

function go(t, hash) {
  at(t, () => { appWin().location.hash = hash; });
}

function bgShift(t, dur = 1.1, steps = 1) {
  bgShifts.push({ t, dur, steps });
}

/* ── Frame evaluation ───────────────────────────────────────────────── */

let duration = 0;

function render(t) {
  events.sort((a, b) => a.t - b.t);
  for (const e of events) {
    if (e.t > t) break;
    if (!e.done) { e.done = true; e.fn(); }
  }

  dimLevel = 0;
  blurLevel = 0;
  for (const a of anims) {
    if (a.state === 'done' || t < a.t0) continue;
    if (!a.state) { a.state = 'live'; a.begin(); }
    a.update(t);
    if (t >= a.t1) { a.state = 'done'; a.end(); }
  }
  dim.style.opacity = dimLevel.toFixed(3);
  iframe.style.filter = blurLevel > 0.05 ? `blur(${blurLevel.toFixed(2)}px)` : 'none';

  const c = camera.value(t);
  const z = BASE_ZOOM * c.zoom;
  cam.style.transform =
    `translate3d(${W / 2 + c.ox}px, ${H / 2 + c.oy}px, 0) scale3d(${z}, ${z}, ${z}) ` +
    `rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg) translate3d(${-c.fx}px, ${-c.fy}px, 0)`;

  let phase = t * 0.05;
  for (const s of bgShifts) phase += s.steps * ease.inOutQuart(clamp01((t - s.t) / s.dur));
  drawGradient(phase);

  // slight parallax so the backdrop reacts to the camera
  const bgScale = 1 + (c.zoom - 1) * 0.06;
  const px = -(c.fx - PHONE.w / 2) * 0.05 * BASE_ZOOM + c.ry * 1.2;
  const py = -(c.fy - PHONE.h / 2) * 0.05 * BASE_ZOOM - c.rx * 1.2 + c.oy * 0.08;
  const over = 0.16;
  const gw = W * (1 + over * 2);
  const gh = H * (1 + over * 2);
  Object.assign(gradCanvas.style, {
    width: gw + 'px', height: gh + 'px', left: -W * over + 'px', top: -H * over + 'px',
    transform: `translate(${px}px, ${py}px) scale(${bgScale})`,
  });
  Object.assign(pattern.style, {
    left: -W * over + 'px', top: -H * over + 'px', width: gw + 'px', height: gh + 'px',
    transform: `translate(${px * 1.4}px, ${py * 1.4}px) scale(${bgScale * 1.02})`,
  });
}

/* ── Boot ───────────────────────────────────────────────────────────── */

const DEMO_CSS = `
  * { transition: none !important; caret-color: transparent !important; }
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }
  /* wireframe hint labels on the placeholder photos */
  span[style*="ui-monospace"] { display: none !important; }
`;

async function boot() {
  for (const k of Object.keys(localStorage)) if (k.startsWith('egnach_')) localStorage.removeItem(k);

  const api = { PHONE, cam: camera, at, pop, flyIn, tap, swipe, drag, type, go, bgShift, q, ease };
  duration = buildTimeline(api);

  await new Promise((resolve) => {
    iframe.addEventListener('load', resolve, { once: true });
    iframe.src = '/index.html#/splash';
  });
  const style = appDoc().createElement('style');
  style.textContent = DEMO_CSS;
  appDoc().head.appendChild(style);

  // wait until the app rendered and every font is in
  for (let i = 0; i < 400 && !appDoc().querySelector('#root > *'); i++) await new Promise((r) => (window.__vt ? window.__vt.realSetTimeout : setTimeout)(r, 25));
  await document.fonts.ready;
  await appDoc().fonts.ready;
  for (const f of ['400 14px Inter', '600 14px Inter', '700 14px Inter', '700 20px Fraunces', '600 16px Fraunces']) {
    await document.fonts.load(f);
    await appDoc().fonts.load(f);
  }
  render(0);

  window.__stage = {
    duration,
    width: W,
    height: H,
    // Advance the virtual clock by dt milliseconds and lay out the frame.
    step(dt) {
      const vt = window.__vt;
      vt.advance(dt);
      render(vt.now / 1000);
      vt.frame();
    },
  };
  window.__stageReady = true;

  if (PREVIEW && !window.__vt) {
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      render(t);
      if (t < duration) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

boot();
