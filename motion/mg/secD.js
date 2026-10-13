// Section D (8.64–11.52 s): growth — a clay tower of ten 10-year slabs; the camera cranes from 30년 to 100년
// while the counter rolls; then the father-and-son footage card flips in for 지속가능한 가업승계.
import { W, H, COL, b, clamp, lerp, prog, E, Ez, kText, text, wipeRect, drawCover, mkCanvas, smoothNoise } from './core.js';
import { THREE, G, camera, clay, lightRig, render, project, roundBox, shadowCatcher } from './gl.js';

const S = {};
export const range = [b(24), b(32)];
const HS = 0.34; // slab height = 10 years

export function build() {
  const sc = new THREE.Scene();
  const tgt = new THREE.Object3D();
  tgt.position.set(0, 2.2, 0);
  lightRig(sc, { key: 2.3, hemi: 0.55, keyPos: [-5, 9, 8], shadow: true, shadowSize: 5, shadowRes: 2048, shadowRadius: 8, target: tgt });
  const tower = new THREE.Group();
  S.slabs = [];
  for (let k = 0; k < 10; k++) {
    const col = k < 3 ? COL.ink : k === 9 ? COL.yellow : k % 2 ? COL.paper : COL.paper2;
    const m = roundBox(1.0, HS * 0.88, 1.0, 0.07, clay(col, { rough: k < 3 ? 0.42 : 0.5, cc: 0.35 }));
    m.rotation.x = 0;
    m.position.set(0, HS * k + HS * 0.45, 0);
    m.userData.y = m.position.y;
    tower.add(m);
    S.slabs.push(m);
  }
  tower.position.x = 0.62;
  sc.add(tower);
  const ground = shadowCatcher(30, 30, 0.22);
  ground.rotation.x = -Math.PI / 2;
  sc.add(ground);
  // footage card
  S.cardCanvas = mkCanvas(720, 1100);
  S.cardTex = new THREE.CanvasTexture(S.cardCanvas);
  S.cardTex.colorSpace = THREE.SRGBColorSpace;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 3.6), new THREE.MeshBasicMaterial({ map: S.cardTex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  card.position.set(0, 0, 0);
  S.cardScene = new THREE.Scene();
  S.cardScene.add(card);
  S.card = card;
  S.cardCam = camera(30);
  S.cardCam.position.set(0, 0, 9.6);
  S.cardCam.lookAt(0, 0, 0);
  S.sc = sc; S.tower = tower; S.cam = camera(30);
}

function camAt(t) {
  const cam = S.cam;
  const cr = Ez.ioC(prog(t, b(24), b(27)));
  const yTop = lerp(HS * 3, HS * 10, cr);
  const az = lerp(0.62, 0.35, prog(t, b(24), b(28))) + 0.05 * Math.sin(t * 0.8);
  const dist = lerp(7.6, 8.8, Ez.outQ(prog(t, b(24), b(28))));
  // entry: arrive from a dive (continuing section C's motion)
  const en = 1 - Ez.outExpo(prog(t, b(24), b(24.6)));
  cam.position.set(0.2 + Math.sin(az) * dist, yTop + 1.0 + en * 3.5, Math.cos(az) * dist);
  cam.lookAt(0.2, yTop - 0.9 - en * 1.5, 0);
  cam.rotation.z += en * 0.25;
  cam.updateMatrixWorld(true);
}

export async function draw(x, t, env) {
  // ---- background: green field
  x.save();
  x.fillStyle = COL.green;
  x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * 0.55, H * 0.45, 50, W * 0.5, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(255,255,240,0.20)');
  g.addColorStop(1, 'rgba(40,50,10,0.18)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.restore();
  env.grid(x, 0.18, 'rgba(33,24,21,0.5)');
  const cardIn = prog(t, b(28), b(28) + 0.42);
  // ---- tower (fades back as the card arrives)
  if (cardIn < 1) {
    camAt(t);
    S.slabs.forEach((m, k) => {
      const appear = k < 3 ? 1 : Ez.outBack(prog(t, b(24) + (k - 3) * 0.13, b(24) + (k - 3) * 0.13 + 0.3), 2.0);
      m.visible = appear > 0.001;
      m.scale.setScalar(Math.max(0.001, appear));
      m.position.y = m.userData.y + (1 - appear) * 0.6;
      m.rotation.y = (1 - appear) * 0.8 + (k % 2 ? 1 : -1) * 0.04 * Math.sin(t * 1.2 + k);
    });
    S.tower.position.z = -cardIn * 4;
    const im = render(S.sc, S.cam);
    x.save();
    x.globalAlpha = 1 - Ez.inQ(cardIn);
    x.drawImage(im, 0, 0, W, H);
    x.restore();
    // tick labels
    const la = prog(t, b(24.5), b(25.5)) * (1 - cardIn);
    if (la > 0) {
      S.slabs.forEach((m, k) => {
        if (m.scale.x < 0.6) return;
        const [px, py, pz] = project(new THREE.Vector3(0.62 + 0.55, m.position.y, 0.55), S.cam);
        if (pz > 1) return;
        env.mono(x, `${(k + 1) * 10}`, px + 26, py + 8, { alpha: la, color: k < 3 ? COL.paper : COL.ink, size: 26 });
      });
    }
  }
  // ---- counter 30 -> 100
  const cp = Ez.outExpo(prog(t, b(24.3), b(27)));
  const n = Math.round(lerp(30, 100, cp));
  const out = prog(t, b(27.6), b(28.2));
  if (out < 1) {
    x.save();
    x.globalAlpha = 1 - Ez.inExpo(out);
    const s = 250;
    const w1 = env.measure(String(n), { fam: 'Unbounded', w: 900, s });
    const kick = Math.exp(-Math.max(0, t - b(27)) * 14) * (t >= b(27) ? 1 : 0);
    x.translate(90, 470 - out * 120);
    x.scale(1 + kick * 0.06, 1 + kick * 0.06);
    text(x, String(n), 0, 0, { fam: 'Unbounded', w: 900, s, ls: -10, fill: COL.paper });
    text(x, '년', w1 + 4, 0, { w: 900, s: 200, ls: -4, fill: COL.ink });
    x.restore();
    kText(x, '이상 존속 · 성장', 96, 600, { w: 800, s: 70, ls: -2, fill: COL.ink }, prog(t, b(26), b(26) + 0.4), 'rise', 0.06, out);
    env.mono(x, 'SUSTAIN  ·  GROW  ·  100+ YEARS', 98, 660, { alpha: prog(t, b(26.5), b(27)) * (1 - out), color: COL.ink });
  }
  // ---- succession card
  if (cardIn > 0) {
    const im = await env.plate('P', 5.55 + (t - b(28)) * 0.9);
    const cx = S.cardCanvas.getContext('2d');
    cx.clearRect(0, 0, 720, 1100);
    cx.save();
    cx.beginPath(); cx.roundRect(0, 0, 720, 1100, 44); cx.clip();
    drawCover(cx, im, 0, 0, 720, 1100, 1.04 + (t - b(28)) * 0.02, 0.5, 0.42);
    cx.restore();
    S.cardTex.needsUpdate = true;
    const fl = Ez.outBack(cardIn, 1.6);
    const ex = Ez.inExpo(prog(t, b(31.5), b(32)));
    S.card.rotation.set(0.05 * Math.sin(t * 1.1), lerp(-1.75, 0, fl) + ex * 1.9 + 0.05 * Math.sin(t * 0.9), 0.02 * Math.sin(t * 0.7));
    S.card.position.set(0, -0.12 + (1 - fl) * -0.4, 0);
    const r3 = render(S.cardScene, S.cardCam);
    // soft drop shadow under the card
    x.save();
    x.globalAlpha = 0.28 * Ez.outC(cardIn) * (1 - ex);
    x.fillStyle = '#26300d';
    x.filter = 'blur(28px)';
    x.beginPath(); x.roundRect(W / 2 - 290 * Math.cos(S.card.rotation.y), 560, 580 * Math.max(0.05, Math.cos(S.card.rotation.y)), 900, 40); x.fill();
    x.restore();
    x.drawImage(r3, 0, 0, W, H);
    kText(x, '지속가능한', W / 2, 232, { w: 800, s: 80, ls: -2.5, align: 'c', fill: COL.ink }, prog(t, b(28.5), b(28.5) + 0.4), 'rise', 0.08, ex);
    wipeRect(x, W / 2 - 330, 1528, 660, 170, prog(t, b(29.5), b(29.5) + 0.26), ex, COL.ink, 'l', 16);
    kText(x, '가업승계', W / 2, 1655, { w: 900, s: 136, ls: -5, align: 'c', fill: COL.paper }, prog(t, b(29.5) + 0.05, b(29.5) + 0.42), 'rise', 0.08, ex);
    env.mono(x, 'FAMILY BUSINESS SUCCESSION', W / 2, 1760, { align: 'c', alpha: prog(t, b(30), b(30.5)) * (1 - ex), color: COL.ink });
  }
}
