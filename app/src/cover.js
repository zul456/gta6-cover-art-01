// Draws GTA-style multi-panel cover art: photos in a poster grid, a sunset or neon
// grade, a sun disc, grain and vignette, and bold outlined title lettering across
// the foot. Everything is drawn on the canvas at its own size, so the same code
// paints the live preview and the exported PNG.

export const COVER_SIZES = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  wide: { w: 1920, h: 1080 },
};

const GRADES = {
  sunset: {
    stops: ['rgba(255, 170, 60, 0.20)', 'rgba(255, 90, 120, 0.22)', 'rgba(120, 40, 160, 0.30)'],
    sun: '#ffd166', sunCore: '#fff3c4',
    titleFrom: '#fff3d6', titleTo: '#ff9e5e',
    band: 'rgba(20, 8, 30, 0.74)', sub: '#ffd166',
  },
  neon: {
    stops: ['rgba(255, 40, 160, 0.22)', 'rgba(60, 220, 255, 0.14)', 'rgba(20, 10, 90, 0.34)'],
    sun: '#ff5ad2', sunCore: '#ffd7f2',
    titleFrom: '#ffffff', titleTo: '#5ff2ff',
    band: 'rgba(8, 6, 28, 0.76)', sub: '#5ff2ff',
  },
  vice: {
    stops: ['rgba(180, 120, 255, 0.20)', 'rgba(255, 180, 80, 0.18)', 'rgba(40, 10, 70, 0.32)'],
    sun: '#ffe08a', sunCore: '#fffbe8',
    titleFrom: '#fff8e0', titleTo: '#ffb347',
    band: 'rgba(24, 10, 40, 0.74)', sub: '#ffe08a',
  },
};

const LAYOUTS = {
  split: (w, h) => [
    { x: 0, y: 0, w: w * 0.58, h },
    { x: w * 0.58, y: 0, w: w * 0.42, h: h * 0.5 },
    { x: w * 0.58, y: h * 0.5, w: w * 0.42, h: h * 0.5 },
  ],
  grid: (w, h) => [
    { x: 0, y: 0, w: w / 2, h: h / 2 },
    { x: w / 2, y: 0, w: w / 2, h: h / 2 },
    { x: 0, y: h / 2, w: w / 2, h: h / 2 },
    { x: w / 2, y: h / 2, w: w / 2, h: h / 2 },
  ],
  bands: (w, h) => [
    { x: 0, y: 0, w, h: h * 0.44 },
    { x: 0, y: h * 0.44, w, h: h * 0.30 },
    { x: 0, y: h * 0.74, w, h: h * 0.26 },
  ],
};

/** Panel rectangles inside the white frame, in cover coordinates. */
export function panelRects(w, h, layout) {
  const frame = Math.round(w * 0.012);
  const gut = Math.round(w * 0.008);
  const inner = { x: frame, y: frame, w: w - frame * 2, h: h - frame * 2 };
  return LAYOUTS[layout](inner.w, inner.h).map((r) => ({
    x: inner.x + r.x + gut / 2,
    y: inner.y + r.y + gut / 2,
    w: r.w - gut,
    h: r.h - gut,
  }));
}

/** A tiny seeded generator, so the grain is identical on every render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPhoto(ctx, rect, panel) {
  const img = panel.photo;
  if (!img) {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#3a2358');
    g.addColorStop(1, '#160d26');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `700 ${Math.max(14, rect.w * 0.03)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('LOAD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    return;
  }
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * panel.zoom;
  const pw = iw * scale;
  const ph = ih * scale;
  // The photo's focal point (centre, a little above middle so faces survive the
  // crop) lands on the panel centre, shifted by the user's pan.
  const fx = 0.5;
  const fy = 0.30;
  let dx = rect.x + rect.w / 2 + panel.ox * rect.w - fx * pw;
  let dy = rect.y + rect.h / 2 + panel.oy * rect.h - fy * ph;
  dx = Math.min(rect.x, Math.max(rect.x + rect.w - pw, dx));
  dy = Math.min(rect.y, Math.max(rect.y + rect.h - ph, dy));
  ctx.drawImage(img, dx, dy, pw, ph);
}

function drawSun(ctx, rect, grade) {
  const r = Math.min(rect.w, rect.h) * 0.13;
  const cx = rect.x + rect.w - r * 0.95;
  const cy = rect.y + r * 0.95;
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  g.addColorStop(0, grade.sunCore);
  g.addColorStop(0.55, grade.sun);
  g.addColorStop(1, 'rgba(255, 120, 60, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrade(ctx, rect, grade) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, grade.stops[0]);
  g.addColorStop(0.5, grade.stops[1]);
  g.addColorStop(1, grade.stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function drawTitleBand(ctx, w, h, state, grade) {
  const bandH = h * (state.size === 'wide' ? 0.24 : 0.17);
  const y = h - Math.round(w * 0.012) - bandH;
  ctx.fillStyle = grade.band;
  ctx.fillRect(Math.round(w * 0.012), y, w - Math.round(w * 0.024), bandH);
  const title = state.title.trim().toUpperCase();
  const sub = state.subtitle.trim().toUpperCase();
  const cx = w / 2;
  let size = bandH * 0.52;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (title) {
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    while (ctx.measureText(title).width > w * 0.88 && size > 18) {
      size -= 2;
      ctx.font = `900 ${size}px system-ui, sans-serif`;
    }
    const tg = ctx.createLinearGradient(0, y + bandH * 0.2, 0, y + bandH * 0.85);
    tg.addColorStop(0, grade.titleFrom);
    tg.addColorStop(1, grade.titleTo);
    ctx.lineWidth = Math.max(3, size * 0.09);
    ctx.strokeStyle = 'rgba(20, 6, 30, 0.9)';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.05;
    const ty = y + bandH * (sub ? 0.62 : 0.5);
    ctx.strokeText(title, cx, ty);
    ctx.fillStyle = tg;
    ctx.fillText(title, cx, ty);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (sub) {
    const ss = Math.max(16, bandH * 0.17);
    ctx.font = `700 ${ss}px system-ui, sans-serif`;
    ctx.fillStyle = grade.sub;
    const sy = y + bandH * 0.24;
    const spaced = sub.split('').join('\u2009');
    ctx.fillText(spaced, cx, sy);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillRect(cx - w * 0.06, sy + ss * 0.9, w * 0.12, 2);
  }
}

function drawGrain(ctx, rect, seed) {
  const rand = mulberry32(seed);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  const n = Math.floor((rect.w * rect.h) / 900);
  for (let i = 0; i < n; i += 1) {
    const x = rect.x + rand() * rect.w;
    const y = rect.y + rand() * rect.h;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
}

/** Draws the whole cover onto `canvas` from `state` (layout, grade, size, panels, title, subtitle). */
export function drawCover(canvas, state) {
  const size = COVER_SIZES[state.size] ?? COVER_SIZES.square;
  const w = size.w;
  const h = size.h;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const rects = panelRects(w, h, state.layout);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i];
    if (!panel) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    drawPhoto(ctx, rect, panel);
    if (i === 0) drawSun(ctx, rect, grade);
    drawGrade(ctx, rect, grade);
    ctx.restore();
  });
  drawTitleBand(ctx, w, h, state, grade);
  const frame = Math.round(w * 0.012);
  ctx.save();
  ctx.beginPath();
  ctx.rect(frame, frame, w - frame * 2, h - frame * 2);
  ctx.clip();
  drawGrain(ctx, { x: frame, y: frame, w: w - frame * 2, h: h - frame * 2 }, 1337);
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(10, 4, 20, 0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(frame, frame, w - frame * 2, h - frame * 2);
  ctx.restore();
}
