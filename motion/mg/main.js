// 전북천년명가 motion graphics — frame compositor: sections, motion blur, HUD, grain.
import { W, H, FPS, COL, b, clamp, lerp, prog, Ez, mkCanvas, makePaper, makeGrainTiles, setFont, text, hash } from './core.js';
import { initGL, loadFont, G } from './gl.js';
import * as A from './secA.js';
import * as B from './secB.js';
import * as C from './secC.js';
import * as D from './secD.js';
import * as Es from './secE.js';
import * as F from './secF.js';

let U = null, RS = 1;
const env = {};
let PAPER = null, GRAIN = null, ACC = null, TMP = null, SCR = null;
const CLIPS = { P: { dir: 'plates/P', n: 193, fps: 24 } };

function ctxOf(c) {
  const x = c.getContext('2d');
  x.setTransform(RS, 0, 0, RS, 0, 0);
  return x;
}

export async function init(R, E, util) {
  U = util;
  RS = R.rs || 1;
  await initGL(R.PW, R.PH);
  await loadFont('pblack', '/comp/fonts/Pretendard-Black.otf');
  const logo = await (await fetch('/assets/logo/logo_vec.json')).json();
  const map = await (await fetch('/assets/map/jb_map_hd.json')).json();
  PAPER = makePaper(Math.round(W * RS), Math.round(H * RS));
  GRAIN = makeGrainTiles(4, 512);
  ACC = mkCanvas(R.PW, R.PH);
  TMP = mkCanvas(R.PW, R.PH);
  SCR = mkCanvas(8, 8).getContext('2d');
  A.build(); B.build(); C.build(map); D.build(); Es.build(); F.build(logo);
}

// ------------------------------------------------------------------ env helpers shared by sections
env.paper = (x) => x.drawImage(PAPER, 0, 0, W, H);
env.grid = (x, alpha = 0.5, color = 'rgba(33,24,21,0.55)') => {
  x.save();
  x.globalAlpha = alpha * 0.22;
  x.strokeStyle = color;
  x.lineWidth = 1.2;
  x.beginPath();
  for (let k = 0; k < 6; k++) { const X = 90 + k * 180; x.moveTo(X, 0); x.lineTo(X, H); }
  x.stroke();
  x.globalAlpha = alpha * 0.5;
  x.fillStyle = color;
  for (let k = 0; k < 6; k++) for (let j = 1; j < 8; j++) {
    const X = 90 + k * 180, Y = j * 240;
    x.fillRect(X - 7, Y - 0.8, 14, 1.6);
  }
  x.restore();
};
env.mono = (x, str, X, Y, o = {}) => {
  if ((o.alpha ?? 1) <= 0) return;
  x.save();
  x.globalAlpha *= o.alpha ?? 1;
  x.font = `${o.w || 500} ${o.size || 22}px "Plex Mono"`;
  x.letterSpacing = (o.ls ?? 3) + 'px';
  x.fillStyle = o.color || COL.ink;
  x.textBaseline = 'alphabetic';
  const w = x.measureText(str).width;
  x.fillText(str, o.align === 'c' ? X - w / 2 : o.align === 'r' ? X - w : X, Y);
  x.restore();
};
env.measure = (str, o) => { setFont(SCR, o); return SCR.measureText(str).width; };
env.plate = async (clip, sec) => {
  const C0 = CLIPS[clip];
  const i = clamp(Math.floor(sec * C0.fps), 0, C0.n - 1);
  const p = (k) => `${C0.dir}/${String(k).padStart(5, '0')}.jpg`;
  if (i + 1 < C0.n) U.img(p(i + 1));
  return await U.img(p(i));
};

// ------------------------------------------------------------------ section routing
const SECTIONS = [[0, b(8), A], [b(8), b(13), B], [b(13), b(24), C], [b(24), b(32), D], [b(32), b(44), Es], [b(44), 20.01, F]];
async function compose(x, t) {
  for (const [a, c, s] of SECTIONS) if (t >= a && t < c) return s.draw(x, t, env);
  return F.draw(x, Math.min(t, 19.99), env);
}

// motion-blur sample count per time window (whips, drops, cube turns)
const MB = [
  [b(6.8), b(8), 4], [b(8), b(9.6), 3], [b(12.4), b(13.7), 6], [b(23), b(24.8), 5], [b(24), b(25.5), 3],
  [b(28), b(29.3), 3], [b(31.4), b(32.5), 5], [b(34.4), b(35.3), 5], [b(37.4), b(38.3), 5], [b(40.4), b(41.3), 5],
  [b(43.4), b(44.3), 5], [b(44), b(45.5), 3],
];
function mbSamples(t) {
  let n = 1;
  for (const [a, c, k] of MB) if (t >= a && t < c) n = Math.max(n, k);
  return n;
}

// ------------------------------------------------------------------ HUD (sharp, outside the motion blur)
const SEC_ID = (t) => (t < b(8) ? 1 : t < b(13) ? 2 : t < b(24) ? 3 : t < b(32) ? 4 : t < b(44) ? 5 : 6);
function hud(x, t) {
  const fade = 1 - prog(t, b(44), b(44.6));
  if (fade <= 0) return;
  const s = SEC_ID(t);
  let col = COL.ink;
  if (s === 5) {
    const q = Math.floor((t - b(32)) / (b(3)) + 0.2);
    col = [COL.paper, COL.ink, COL.ink, COL.paper][clamp(q, 0, 3)] || COL.paper;
  }
  const a = fade * prog(t, 0.05, 0.4);
  x.save();
  x.globalAlpha = a;
  text(x, '전북천년명가', 90, 104, { w: 800, s: 28, ls: -0.5, fill: col });
  env.mono(x, `0${s} — 06`, 990, 102, { align: 'r', color: col, size: 22 });
  // progress rule
  x.globalAlpha = a * 0.75;
  x.fillStyle = col;
  x.fillRect(90, 1878, 900 * clamp(t / 20), 2);
  x.globalAlpha = a * 0.25;
  x.fillRect(90, 1878, 900, 2);
  x.restore();
}

function grain(x, t) {
  const f = Math.floor(t * FPS);
  const tile = GRAIN[f % GRAIN.length];
  const ox = Math.floor(hash(f, 3) * 512), oy = Math.floor(hash(f, 5) * 512);
  x.save();
  x.globalAlpha = 0.045;
  x.globalCompositeOperation = 'overlay';
  for (let yy = -oy; yy < H; yy += 512) for (let xx = -ox; xx < W; xx += 512) x.drawImage(tile, xx, yy, 512, 512);
  x.restore();
}

export async function frame(S, x) {
  const t = S.t;
  x.setTransform(RS, 0, 0, RS, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  const n = mbSamples(t);
  if (n <= 1) {
    await compose(x, t);
  } else {
    const shutter = 0.5 / FPS;
    const ax = ctxOf(ACC), tx = ctxOf(TMP);
    for (let k = 0; k < n; k++) {
      const tk = t + (k / (n - 1) - 0.5) * shutter;
      tx.setTransform(RS, 0, 0, RS, 0, 0);
      tx.globalAlpha = 1;
      tx.clearRect(0, 0, W, H);
      await compose(tx, Math.max(0, tk));
      ax.setTransform(1, 0, 0, 1, 0, 0);
      ax.globalAlpha = k === 0 ? 1 : 1 / (k + 1);
      ax.drawImage(TMP, 0, 0);
    }
    x.save();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.drawImage(ACC, 0, 0);
    x.restore();
  }
  x.setTransform(RS, 0, 0, RS, 0, 0);
  hud(x, t);
  grain(x, t);
}
