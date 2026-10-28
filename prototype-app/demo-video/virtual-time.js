// Deterministic clock for frame-by-frame capture.
//
// render.mjs injects this into every frame (the stage and the app iframe)
// before any page script runs. It replaces performance.now, Date.now,
// requestAnimationFrame and the timer functions with versions driven by a
// single virtual clock owned by the top window, so framer-motion springs,
// toasts and the stage choreography all advance exactly 1/fps per frame no
// matter how long a screenshot takes.
(() => {
  const isTop = window === window.top;
  const vt = isTop
    ? (window.__vt = { now: 0, wins: [], realSetTimeout: window.setTimeout.bind(window) })
    : window.top.__vt;
  if (!vt) return;

  const own = { raf: [], timers: [], seq: 0 };
  vt.wins.push(own);

  Object.defineProperty(performance, 'now', { value: () => vt.now, configurable: true });
  const epoch = Date.now();
  Date.now = () => epoch + vt.now;

  window.requestAnimationFrame = (cb) => {
    const id = ++own.seq;
    own.raf.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    own.raf = own.raf.filter((r) => r.id !== id);
  };
  window.setTimeout = (fn, ms, ...args) => {
    const id = ++own.seq;
    own.timers.push({ id, at: vt.now + (+ms || 0), every: 0, fn, args });
    return id;
  };
  window.setInterval = (fn, ms, ...args) => {
    const id = ++own.seq;
    const every = Math.max(1, +ms || 0);
    own.timers.push({ id, at: vt.now + every, every, fn, args });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => {
    own.timers = own.timers.filter((t) => t.id !== id);
  };

  // framer-motion hands opacity/transform animations to WAAPI when it can,
  // and those run on the real compositor clock. Without Element#animate it
  // falls back to its requestAnimationFrame driver, which we control.
  delete Element.prototype.animate;

  if (!isTop) return;

  // Fire every timer due up to now + dt, in chronological order.
  vt.advance = (dt) => {
    const target = vt.now + dt;
    for (;;) {
      let next = null;
      let owner = null;
      for (const w of vt.wins) {
        for (const t of w.timers) {
          if (t.at <= target && (!next || t.at < next.at)) { next = t; owner = w; }
        }
      }
      if (!next) break;
      vt.now = Math.max(vt.now, next.at);
      if (next.every) next.at += next.every;
      else owner.timers = owner.timers.filter((t) => t !== next);
      try { if (typeof next.fn === 'function') next.fn(...next.args); } catch (e) { console.error(e); }
    }
    vt.now = target;
  };

  // Run one round of animation-frame callbacks in every window.
  vt.frame = () => {
    for (const w of vt.wins) {
      const queue = w.raf;
      w.raf = [];
      for (const r of queue) {
        try { r.cb(vt.now); } catch (e) { console.error(e); }
      }
    }
  };
})();
