// Choreography of the Egnach Plus demo. Times are in seconds; every scene
// is written relative to its own start `T` so scenes can be retimed freely.
//
// Each beat follows the same rhythm: the camera settles on the screen,
// pushes towards the one element that matters, the element lifts out of the
// phone while the rest of the screen dims and blurs, then the finger moves on.

export function buildTimeline({ PHONE, cam, pop, flyIn, tap, swipe, drag, type, bgShift, q }) {
  const CENTER = { fx: PHONE.w / 2, fy: PHONE.h / 2 };

  // camera target centred on an element (resolved when the move starts)
  const focus = (find, { dx = 0, dy = 0, ...rest } = {}) => () => {
    const n = find();
    if (!n) return rest;
    const r = q.rect(n);
    return { fx: r.cx + dx, fy: r.cy + dy, ...rest };
  };
  const button = (text) => () => q.text(text)?.closest('button');
  const cardOf = (text, minW) => () => q.card(q.text(text), minW);
  const field = (label, tag = 'input') => () => q.up(q.text(label), (n) => n.querySelector(tag))?.querySelector(tag);
  // the n siblings of the element containing `text`, e.g. the rows of a list
  const siblingsOf = (text, n, test) => () => {
    const item = q.up(q.text(text), (e) => e.parentElement && e.parentElement.children.length === n
      && test(q.win().getComputedStyle(e.parentElement)));
    return [...item.parentElement.children];
  };

  /* ── Intro: phone flies in, the coat of arms lifts off ─────────────── */

  let T = 0;
  cam.initial = { ...cam.initial, zoom: 0.62, rx: 34, ry: -30, rz: 10, oy: 980 };
  cam.to(T, 1.45, { zoom: 1, rx: 5, ry: -9, rz: -1, oy: 0 }, 'outQuint');

  cam.to(T + 1.0, 0.75, { fx: 196, fy: 300, zoom: 1.22, rx: 3, ry: -3 });
  pop(T + 1.1, {
    name: 'wappen',
    find: () => q.sel('img[alt="Wappen Egnach"]').parentElement,
    x: 112, y: 70, z: 170, s: 2.4, r: -7, out: 0.6, hold: 0.65, back: 0.45, blur: 2.4,
  });
  cam.to(T + 2.45, 0.7, { ...CENTER, zoom: 1, rx: 4, ry: 7, rz: 0 });

  // "Loslegen" opens the Start tab (the onboarding steps are skipped here)
  tap(T + 2.95, { find: button('Loslegen'), click: () => { q.win().location.hash = '#/home'; } });
  bgShift(T + 2.9);

  /* ── Start: hero card, event carousel ──────────────────────────────── */

  T = 3.0;
  const hero = cardOf('Hafenfest am Bodensee');
  cam.to(T + 0.65, 0.6, focus(hero, { dy: 70, zoom: 1.2, ry: 3, rx: 2 }));
  pop(T + 0.75, { name: 'hero', find: hero, y: -16, z: 150, s: 1.3, r: -2, hold: 0.85 });

  cam.to(T + 2.3, 0.6, focus(() => q.text('Anlässe diese Woche'), { dx: 100, dy: 110, zoom: 1.32, ry: -4, rx: 3 }));
  swipe(T + 2.6, {
    name: 'events row', axis: 'x', delta: 214, dur: 1.0,
    find: () => q.scroller(q.text('Sommerlauf Egnach'), 'x'),
    at: () => q.rect(q.card(q.text('Sommerlauf Egnach'))),
  });

  /* ── Help: "?" button and help sheet ───────────────────────────────── */

  T = 6.45;
  const help = () => q.label('Hilfe');
  cam.to(T - 0.15, 0.85, focus(help, { dx: -34, dy: 80, zoom: 1.95, ry: -7, rx: 6 }));
  pop(T + 0.6, {
    name: 'help button', find: help,
    x: -6, y: 10, z: 70, s: 2, out: 0.4, hold: 0.35, back: 0.3, dim: 0.22, blur: 1.2,
  });
  tap(T + 1.15, {
    find: help, z: 70,
    pos: () => { const r = q.rect(help()); return { cx: r.cx - 6, cy: r.cy + 10 }; },
  });
  cam.to(T + 1.2, 0.95, { fx: 201, fy: 525, zoom: 1.1, ry: 6, rx: 3 });
  pop(T + 1.75, {
    name: 'help sheet', find: () => q.card(q.text('Verstanden'), 390),
    y: -26, z: 110, s: 1.07, out: 0.5, hold: 1.1, back: 0.45, dim: 0.12, blur: 1.4,
  });
  tap(T + 4.0, { find: button('Verstanden') });

  /* ── Anlässe: list view → event detail ─────────────────────────────── */

  T = 10.4;
  cam.to(T, 0.55, focus(() => q.label('Anlässe'), { dy: -60, zoom: 1.5, ry: 0, rx: 5 }));
  tap(T + 0.55, { find: () => q.label('Anlässe') });
  bgShift(T + 0.5);
  cam.to(T + 0.75, 0.7, { ...CENTER, zoom: 1, ry: -8, rx: 4 });

  const eventCard = cardOf('Hafenfest am Bodensee 2026');
  cam.to(T + 1.4, 0.6, focus(eventCard, { dy: 50, zoom: 1.18, ry: -4 }));
  pop(T + 1.5, {
    name: 'event card', find: eventCard,
    y: -12, z: 140, s: 1.2, r: 1.5, out: 0.5, hold: 0.45, back: 0.45,
    exit: 'fade', fadeTo: { x: 0, y: -260, z: 260, s: 1.45 },
  });
  tap(T + 2.4, {
    find: eventCard, z: 140,
    pos: () => { const r = q.rect(eventCard()); return { cx: r.cx + 40, cy: r.cy - 12 }; },
  });
  cam.to(T + 2.55, 0.7, { ...CENTER, zoom: 1, ry: 7, rx: 3 });

  const eventRows = siblingsOf('Eintritt frei', 4, (cs) => cs.flexDirection === 'column');
  cam.to(T + 3.25, 0.6, focus(() => eventRows()[1], { dy: 40, zoom: 1.32, ry: 3, rx: 2 }));
  for (let i = 0; i < 4; i++) {
    pop(T + 3.55 + i * 0.1, {
      name: 'event row ' + i, find: () => eventRows()[i],
      x: 18, z: 80, s: 1.12, out: 0.45, hold: 0.7 - i * 0.05, back: 0.4, dim: 0.28, float: 0.5,
    });
  }

  cam.to(T + 4.95, 0.55, focus(button('Teilnehmen'), { dy: -120, zoom: 1.35, ry: -5, rx: 4 }));
  tap(T + 5.45, { find: button('Teilnehmen') });
  pop(T + 5.85, {
    name: 'rsvp toast', find: () => q.card(q.text('Du bist dabei!'), 300),
    y: -40, z: 120, s: 1.18, out: 0.45, hold: 0.6, back: 0.4, dim: 0.22,
  });

  /* ── Marktplatz: list view with flying cards → listing detail ─────── */

  T = 17.5;
  cam.to(T, 0.55, { ...CENTER, zoom: 1, ry: 6, rx: 4 });
  tap(T + 0.35, { find: () => q.label('Zurück') });
  tap(T + 1.0, { find: () => q.label('Markt') });
  bgShift(T + 0.95);

  cam.to(T + 1.3, 0.5, focus(button('Leihen'), { dx: 30, dy: 60, zoom: 1.55, ry: 4, rx: 4 }));
  tap(T + 1.85, { find: button('Leihen') });
  cam.to(T + 1.85, 0.75, { fx: 250, fy: 480, zoom: 1.0, ry: -8, rx: 3 });
  const listCards = () => {
    const first = q.card(q.text('Bohrhammer Bosch GBH 2-26'));
    return [...first.parentElement.parentElement.children]
      .map((m) => m.firstElementChild)
      .filter((c) => c && q.rect(c).y < PHONE.h);
  };
  flyIn(T + 1.92, {
    find: listCards, dur: 0.9, stagger: 0.11,
    from: (i) => ({ x: 330 + i * 40, y: -110 + i * 26, z: 230, s: 1.28, r: 9 - i * 2 }),
  });

  const drill = cardOf('Bohrhammer Bosch GBH 2-26');
  cam.to(T + 3.1, 0.5, focus(drill, { dy: 60, zoom: 1.28, ry: -3 }));
  tap(T + 3.65, { find: drill });
  cam.to(T + 3.85, 0.65, { ...CENTER, zoom: 1, ry: 7, rx: 3 });

  const owner = () => q.card(q.text('Thomas Hofer'), 300);
  cam.to(T + 4.45, 0.55, focus(owner, { dy: 30, zoom: 1.26, ry: 3 }));
  pop(T + 4.7, { name: 'owner card', find: owner, x: -6, y: -8, z: 130, s: 1.2, r: -2, hold: 0.7 });

  cam.to(T + 6.1, 0.6, { ...CENTER, fy: 520, zoom: 1.05, ry: -4, rx: 3 });
  swipe(T + 6.2, {
    name: 'detail scroll', delta: (n) => n.scrollHeight - n.clientHeight - 60, dur: 0.9,
    find: () => q.scroller(q.text('Beschreibung')),
    at: () => ({ cx: 230, cy: 640 }),
  });
  const tiles = siblingsOf('KAUTION', 4, (cs) => cs.display === 'grid');
  cam.to(T + 7.0, 0.55, focus(() => tiles()[0].parentElement, { dy: 10, zoom: 1.42, ry: 2, rx: 2 }));
  const spread = [[-26, -18, -3], [26, -18, 3], [-26, 18, 3], [26, 18, -3]];
  for (let i = 0; i < 4; i++) {
    pop(T + 7.3 + i * 0.07, {
      name: 'tile ' + i, find: () => tiles()[i],
      x: spread[i][0], y: spread[i][1], r: spread[i][2], z: 90, s: 1.14,
      hold: 0.75 - i * 0.07, back: 0.4, dim: 0.26, float: 0.6,
    });
  }

  // iOS edge swipe back to the list
  cam.to(T + 8.65, 0.55, { ...CENTER, zoom: 1, ry: 6, rx: 4 });
  drag(T + 8.9, { from: { x: 8, y: 470 }, to: { x: 250, y: 486 }, dur: 0.55, onRelease: () => q.win().history.back() });

  /* ── Inserat erstellen ─────────────────────────────────────────────── */

  T = 27.15;
  const fab = () => q.label('Inserat erstellen');
  cam.to(T, 0.55, focus(fab, { dx: -60, dy: -70, zoom: 1.9, ry: -6, rx: 5 }));
  pop(T + 0.5, {
    name: 'fab', find: fab, z: 70, s: 1.55, r: -6, out: 0.4, hold: 0.3, back: 0.35,
    dim: 0.18, blur: 1, exit: 'fade', fadeTo: { x: -140, y: -360, z: 160, s: 3 },
  });
  tap(T + 1.15, { find: fab, z: 70 });
  bgShift(T + 1.1);

  cam.to(T + 1.45, 0.65, focus(button('Dienste'), { dx: -100, dy: 10, zoom: 1.4, ry: 5, rx: 3 }));
  tap(T + 2.0, { find: button('Dienste') });

  cam.to(T + 2.3, 0.5, focus(field('Titel'), { dy: 20, zoom: 1.75, ry: 0, rx: 2 }));
  let t = type(T + 2.65, { find: field('Titel'), text: 'Gartenhilfe & Rasenmähen', cps: 34 });
  cam.to(t + 0.05, 0.45, focus(field('Beschreibung', 'textarea'), { dy: 10, zoom: 1.6 }));
  t = type(t + 0.3, {
    find: field('Beschreibung', 'textarea'), cps: 70,
    text: 'Ich mähe deinen Rasen und schneide die Hecke – mit eigenem Gerät.',
  });
  swipe(t + 0.12, {
    name: 'form scroll', delta: 150, dur: 0.55, finger: false,
    find: () => q.scroller(q.text('Was bietest du an?')),
  });
  cam.to(t + 0.12, 0.55, focus(field('Preis'), { dx: 90, dy: -60, zoom: 1.6, ry: -3 }));
  t = type(t + 0.7, { find: field('Preis'), text: '25', cps: 9 });

  const dateTap = t + 0.4;
  tap(dateTap, { find: () => q.label('Kalender öffnen') });
  cam.to(dateTap + 0.05, 0.65, { fx: 201, fy: 640, zoom: 1.12, ry: 4, rx: 3 });
  const day31 = () => q.all('button').find((b) => b.textContent === '31' && b.style.height === '40px');
  tap(dateTap + 0.85, { find: day31 });

  const next = dateTap + 1.7;
  cam.to(next - 0.55, 0.55, { ...CENTER, fy: 500, zoom: 1.02, ry: -5, rx: 3 });
  tap(next, { find: button('Weiter') });
  const preview = () => q.card(q.text('VORSCHAU'), 300);
  cam.to(next + 0.35, 0.55, focus(preview, { dy: 40, zoom: 1.22, ry: 4 }));
  pop(next + 0.6, { name: 'preview', find: preview, y: -12, z: 150, s: 1.24, r: -1.5, hold: 0.85, back: 0.45 });

  const publish = next + 2.55;
  cam.to(publish - 0.5, 0.5, focus(button('Publizieren'), { dx: -80, dy: -140, zoom: 1.4, ry: -4 }));
  tap(publish, { find: button('Publizieren') });
  bgShift(publish + 0.1, 1.4, 2);
  cam.to(publish + 0.1, 0.75, { fx: 201, fy: 290, zoom: 1.5, ry: 4, rx: 3 });

  const toList = publish + 1.5;
  cam.to(toList - 0.45, 0.45, { ...CENTER, zoom: 1.05, ry: 0, rx: 3 });
  tap(toList, { find: button('Zum Marktplatz') });
  cam.to(toList + 0.25, 0.55, { ...CENTER, zoom: 1, ry: 7, rx: 4 });
  swipe(toList + 0.7, {
    name: 'list to bottom', delta: (n) => n.scrollHeight - n.clientHeight, dur: 0.95,
    find: () => q.scroller(q.text('Bohrhammer Bosch GBH 2-26')),
    at: () => ({ cx: 240, cy: 600 }),
  });
  const newCard = cardOf('Gartenhilfe & Rasenmähen');
  cam.to(toList + 1.6, 0.55, focus(newCard, { dy: -40, zoom: 1.25, ry: 3 }));
  pop(toList + 1.85, { name: 'new listing', find: newCard, y: -30, z: 160, s: 1.28, r: -2, out: 0.55, hold: 1.0, back: 0.5 });

  /* ── Outro: back to the opening pose ───────────────────────────────── */

  const outro = toList + 3.85;
  cam.to(outro, 1.3, { ...CENTER, zoom: 0.97, rx: 5, ry: -9, rz: -1 });
  bgShift(outro, 1.4);
  return outro + 1.5;
}
