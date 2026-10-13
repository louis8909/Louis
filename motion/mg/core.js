// 전북천년명가 motion graphics — shared constants, easing, timing and Canvas2D type helpers.
export const W = 1080, H = 1920, FPS = 30, DUR = 20.0;
export const BEAT = 0.36, BAR = 1.44;           // Mixkit "Lust" @ 166.67 BPM, drop at 2.88 s
export const b = (n) => n * BEAT;               // beat index -> seconds on the output timeline

export const COL = {
  paper: '#F3EEE4', paper2: '#EBE4D7', paperDeep: '#E1D8C8', stone: '#CDBFAA',
  ink: '#211815', ink2: '#3B312B', inkSoft: '#5A4E46',
  green: '#93B143', greenD: '#6F8B2B', greenL: '#B5CC77',
  yellow: '#E7B543', yellowD: '#C3922A', yellowL: '#F1CF7E',
  red: '#B52D2A', redD: '#8A1F1D', redL: '#D76A5E',
  white: '#FFFFFF',
};

export const clamp = (x, a = 0, c = 1) => Math.min(c, Math.max(a, x));
export const lerp = (a, c, t) => a + (c - a) * t;
export const prog = (t, a, c) => clamp((t - a) / (c - a));
export const win = (t, a, c) => t >= a && t < c;

export const Ez = {
  lin: (t) => t,
  inQ: (t) => t * t,
  outQ: (t) => 1 - (1 - t) * (1 - t),
  ioQ: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inC: (t) => t * t * t,
  outC: (t) => 1 - Math.pow(1 - t, 3),
  ioC: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  ioQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  ioExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
// eased progress helper: E(t, a, c, 'outExpo')
export const E = (t, a, c, ez = 'outExpo') => Ez[ez](prog(t, a, c));

// deterministic hash noise (no Math.random: every shard renders identical frames)
export function hash(a, b2 = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b2 | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function smoothNoise(t, seed = 0) {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
}

// ------------------------------------------------------------------ Canvas2D helpers
export function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
export function fontStr(o) {
  return `${o.style || 'normal'} ${o.w || 700} ${o.s || 64}px "${o.fam || 'Pretendard'}"`;
}
export function setFont(x, o) {
  x.font = fontStr(o);
  x.letterSpacing = (o.ls || 0) + 'px';
  x.textBaseline = o.base || 'alphabetic';
}
export function measure(x, str, o) {
  setFont(x, o);
  const m = x.measureText(str);
  return { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
}
// plain line of text; align l|c|r; returns width
export function text(x, str, X, Y, o = {}) {
  setFont(x, o);
  const w = x.measureText(str).width;
  const ox = o.align === 'c' ? -w / 2 : o.align === 'r' ? -w : 0;
  x.save();
  x.globalAlpha *= o.alpha ?? 1;
  if (o.shadow) {
    x.shadowColor = o.shadow.color || 'rgba(0,0,0,.25)';
    x.shadowBlur = o.shadow.blur ?? 18;
    x.shadowOffsetY = o.shadow.dy ?? 6;
  }
  if (o.stroke) {
    x.lineJoin = 'round';
    x.strokeStyle = o.stroke;
    x.lineWidth = o.lw || 4;
    x.strokeText(str, X + ox, Y);
  }
  if (o.fill !== null) {
    x.fillStyle = o.fill || COL.ink;
    x.fillText(str, X + ox, Y);
  }
  x.restore();
  return w;
}

// per-syllable kinetic text. mode: 'rise' (masked slide-up), 'drop', 'pop', 'type', 'fade'
// p = 0..1 overall progress of the build; stagger = fraction of the build per glyph
export function kText(x, str, X, Y, o, p, mode = 'rise', stagger = 0.12, out = 0) {
  if (p <= 0) return 0;
  setFont(x, o);
  const chars = [...str];
  const ws = chars.map((ch) => x.measureText(ch).width);
  const total = x.measureText(str).width;
  let cx = X + (o.align === 'c' ? -total / 2 : o.align === 'r' ? -total : 0);
  const asc = o.s * 0.92, desc = o.s * 0.28;
  const n = chars.length, span = 1 - stagger * (n - 1) > 0.2 ? 1 - stagger * (n - 1) : 0.2;
  for (let i = 0; i < n; i++) {
    const ch = chars[i];
    const lp = clamp((p - i * stagger) / span);
    const lo = out > 0 ? clamp((out - i * stagger * 0.5) / Math.max(0.2, 1 - stagger * 0.5 * (n - 1))) : 0;
    const adv = ws[i] + (o.ls || 0);
    if (lp > 0 && lo < 1 && ch !== ' ') {
      x.save();
      let dy = 0, sc = 1, al = 1;
      if (mode === 'rise') {
        const e = Ez.outExpo(lp);
        dy = (1 - e) * o.s * 1.05;
        x.beginPath();
        x.rect(cx - 4, Y - asc - 6, ws[i] + 12, asc + desc + 12);
        x.clip();
      } else if (mode === 'drop') {
        const e = Ez.outBack(lp, 2.2);
        dy = -(1 - e) * o.s * 0.8;
        al = clamp(lp * 3);
      } else if (mode === 'pop') {
        sc = Ez.outBack(lp, 2.6);
        al = clamp(lp * 4);
      } else if (mode === 'type') {
        al = lp > 0 ? 1 : 0;
      } else if (mode === 'fade') {
        al = Ez.outC(lp);
        dy = (1 - Ez.outC(lp)) * o.s * 0.25;
      }
      if (lo > 0) {
        const e = Ez.inExpo(lo);
        dy -= e * o.s * 1.05;
        if (mode !== 'rise') al *= 1 - e;
        else {
          x.beginPath();
          x.rect(cx - 4, Y - asc - 6, ws[i] + 12, asc + desc + 12);
          x.clip();
        }
      }
      x.globalAlpha *= al * (o.alpha ?? 1);
      x.translate(cx + ws[i] / 2, Y + dy - o.s * 0.35);
      x.scale(sc, sc);
      x.fillStyle = o.fill || COL.ink;
      x.textBaseline = 'alphabetic';
      if (o.stroke) {
        x.lineJoin = 'round';
        x.strokeStyle = o.stroke;
        x.lineWidth = o.lw || 4;
        x.strokeText(ch, -ws[i] / 2, o.s * 0.35);
      }
      x.fillText(ch, -ws[i] / 2, o.s * 0.35);
      x.restore();
    }
    cx += adv;
  }
  return total;
}

// rectangle wipe reveal (dir: 'l' | 'r' | 'u' | 'd'), p 0..1 in, q 0..1 out
export function wipeRect(x, X, Y, w, h, p, q, color, dir = 'l', radius = 0) {
  if (p <= 0 || q >= 1) return;
  let x0 = X, x1 = X + w, y0 = Y, y1 = Y + h;
  const ep = Ez.outExpo(p), eq = Ez.inExpo(q);
  if (dir === 'l') { x1 = X + w * ep; x0 = X + w * eq; }
  else if (dir === 'r') { x0 = X + w * (1 - ep); x1 = X + w * (1 - eq); }
  else if (dir === 'u') { y0 = Y + h * (1 - ep); y1 = Y + h * (1 - eq); }
  else { y1 = Y + h * ep; y0 = Y + h * eq; }
  if (x1 <= x0 || y1 <= y0) return;
  x.save();
  x.fillStyle = color;
  if (radius > 0) {
    x.beginPath();
    x.roundRect(x0, y0, x1 - x0, y1 - y0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
    x.fill();
  } else x.fillRect(x0, y0, x1 - x0, y1 - y0);
  x.restore();
}

// cover-fit an image into a box
export function drawCover(x, im, X, Y, w, h, zoom = 1, ax = 0.5, ay = 0.5) {
  if (!im) return;
  const iw = im.width, ih = im.height;
  const s = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * s, dh = ih * s;
  x.drawImage(im, X + (w - dw) * ax, Y + (h - dh) * ay, dw, dh);
}

// paper texture (generated once, deterministic)
export function makePaper(w, h, base = COL.paper) {
  const c = mkCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, w, h);
  // soft large-scale tone variation
  const g = x.createRadialGradient(w * 0.5, h * 0.42, h * 0.05, w * 0.5, h * 0.5, h * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0.38)');
  g.addColorStop(1, 'rgba(160,140,110,0.10)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  // fine fibre noise
  const id = x.getImageData(0, 0, w, h), d = id.data;
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w; i++) {
      const k = (y * w + i) * 4;
      const n = (hash(i, y, 7) - 0.5) * 7 + (hash(i >> 2, y >> 3, 3) - 0.5) * 5;
      d[k] = clamp(d[k] + n, 0, 255);
      d[k + 1] = clamp(d[k + 1] + n, 0, 255);
      d[k + 2] = clamp(d[k + 2] + n * 0.9, 0, 255);
    }
  }
  x.putImageData(id, 0, 0);
  return c;
}

// film grain tiles
export function makeGrainTiles(n = 4, size = 512) {
  const out = [];
  for (let t = 0; t < n; t++) {
    const c = mkCanvas(size, size), x = c.getContext('2d');
    const id = x.createImageData(size, size), d = id.data;
    for (let i = 0; i < size * size; i++) {
      const v = Math.round(hash(i, t, 11) * 255);
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    out.push(c);
  }
  return out;
}
