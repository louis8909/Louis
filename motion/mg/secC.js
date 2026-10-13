// Section C (4.68–8.64 s): 전북특별자치도 14개 시·군 — a clay relief map rises region by region on 16ths,
// colour waves of the BI palette sweep across it on the beat, labels track the regions in 3D.
import { W, H, COL, b, clamp, lerp, prog, E, Ez, kText, text, wipeRect, smoothNoise } from './core.js';
import { THREE, G, camera, clay, lightRig, buildMap, render, project, shadowCatcher } from './gl.js';

const S = {};
export const range = [b(13), b(24)];
// order of rise: ripple outward from 전주
const PAL = [COL.green, COL.yellow, COL.red, COL.ink];
const WAVE = [b(17), b(18), b(19), b(20)];

export function build(mapData) {
  const sc = new THREE.Scene();
  const tgt = new THREE.Object3D();
  lightRig(sc, { key: 2.2, hemi: 0.62, keyPos: [-4, -5, 9], shadow: true, shadowSize: 3.2, shadowRes: 2048, shadowRadius: 8, target: tgt });
  const M = buildMap(mapData, 3.3, { base: COL.paperDeep });
  sc.add(M.group);
  const ground = shadowCatcher(20, 20, 0.2);
  ground.position.z = -0.001;
  sc.add(ground);
  const jj = M.regions.find((r) => r.name === '전주시');
  M.regions.forEach((r, i) => {
    r.d = Math.hypot(r.c[0] - jj.c[0], r.c[1] - jj.c[1]);
    r.h = r.name === '전주시' ? 0.2 : 0.085 + 0.045 * ((i * 37) % 7) / 6;
    // colour index: spread the four BI colours so neighbours differ
    r.ci = [1, 0, 2, 3, 0, 1, 2, 3, 0, 2, 1, 3, 0, 2][i % 14];
    r.mats = r.meshes.map((m) => m.material);
  });
  const order = [...M.regions].sort((p, q) => p.d - q.d);
  order.forEach((r, k) => (r.rise = b(13.5) + k * b(0.25) * 0.55));
  S.M = M; S.sc = sc; S.cam = camera(30); S.jj = jj;
  S.base = new THREE.Color(COL.paperDeep);
  S.cols = PAL.map((c) => new THREE.Color(c));
}

function camAt(t) {
  const cam = S.cam;
  const p = prog(t, range[0], range[1]);
  // entry whip: from looking far "up" (sky) down onto the map
  const wi = Ez.outExpo(prog(t, b(13), b(13.6)));
  const tilt = lerp(0.12, 0.78, Ez.ioQ(prog(t, b(13.4), b(17)))) + 0.04 * Math.sin(t * 0.7);
  const az = lerp(-0.25, 0.32, Ez.ioQ(p));
  let dist = lerp(7.4, 6.4, Ez.ioQ(p));
  // exit: dive into 전주
  const ex = Ez.inExpo(prog(t, b(23), b(24)));
  const tg = new THREE.Vector3(lerp(0, S.jj.c[0], ex), lerp(-0.25, S.jj.c[1], ex), 0);
  dist = lerp(dist, 0.9, ex);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  cam.position.set(tg.x + Math.sin(az) * st * dist, tg.y - Math.cos(az) * st * dist, tg.z + ct * dist);
  cam.up.set(Math.sin(az) * 0.0, 0, 1).add(new THREE.Vector3(-Math.sin(az), Math.cos(az), 0)).normalize();
  cam.lookAt(tg.x, tg.y - (1 - wi) * 3.2, tg.z);
  cam.updateMatrixWorld(true);
}

export async function draw(x, t, env) {
  camAt(t);
  const M = S.M;
  M.regions.forEach((r) => {
    const rp = Ez.outBack(prog(t, r.rise, r.rise + 0.34), 2.2);
    const h = Math.max(0.0005, r.h * rp);
    // colour: base -> BI colour on its wave beat
    const wave = WAVE[r.ci];
    const cp = Ez.outC(prog(t, wave + r.d * 0.12, wave + r.d * 0.12 + 0.2));
    r.meshes.forEach((m) => {
      m.scale.z = h;
      m.position.z = 0;
      m.material.color.copy(S.base).lerp(S.cols[r.ci], cp);
    });
  });
  env.paper(x);
  x.drawImage(render(S.sc, S.cam), 0, 0, W, H);
  // region labels
  const la = prog(t, b(15), b(16)) * (1 - prog(t, b(22.6), b(23.3)));
  if (la > 0) {
    M.regions.forEach((r) => {
      const v = new THREE.Vector3(r.c[0], r.c[1], r.h + 0.02);
      const [px, py, pz] = project(v, S.cam);
      if (pz > 1) return;
      const lp = prog(t, r.rise + 0.25, r.rise + 0.5);
      if (lp <= 0) return;
      const nm = r.name.replace(/(시|군)$/, '');
      x.save();
      x.globalAlpha = la * Ez.outC(lp);
      x.fillStyle = COL.ink;
      x.beginPath(); x.arc(px, py, 5, 0, Math.PI * 2); x.fill();
      text(x, nm, px, py - 16, { w: 700, s: r.name === '전주시' ? 34 : 27, align: 'c', fill: COL.ink, ls: -0.5 });
      x.restore();
    });
  }
  // headline
  const out = prog(t, b(22.7), b(23.5));
  env.mono(x, 'JEONBUK STATE  ·  14 CITIES & COUNTIES', W / 2, 205, { align: 'c', alpha: prog(t, b(13.5), b(14)) * (1 - out) });
  kText(x, '전북특별자치도', W / 2, 330, { w: 900, s: 104, ls: -4, align: 'c', fill: COL.ink }, prog(t, b(13.5), b(13.5) + 0.5), 'rise', 0.07, out);
  // "14개 시·군" with the numeral in Unbounded
  const p14 = prog(t, b(15), b(15) + 0.4);
  if (p14 > 0) {
    x.save();
    x.globalAlpha = (1 - Ez.inExpo(out));
    const w1 = env.measure('14', { fam: 'Unbounded', w: 800, s: 84 });
    const w2 = env.measure('개 시·군', { w: 800, s: 76, ls: -2 });
    const x0 = W / 2 - (w1 + 14 + w2) / 2;
    kText(x, '14', x0, 448, { fam: 'Unbounded', w: 800, s: 84, fill: COL.green }, p14, 'rise', 0.15);
    kText(x, '개 시·군', x0 + w1 + 14, 446, { w: 800, s: 76, ls: -2, fill: COL.ink }, prog(t, b(15) + 0.08, b(15) + 0.45), 'rise', 0.1);
    x.restore();
  }
  // bottom copy: 그 우수성과 / 성장가능성을 / 높게 평가해 공식 인증
  const by = 1520;
  kText(x, '그 우수성과', 90, by, { w: 800, s: 76, ls: -2.5, fill: COL.ink }, prog(t, b(17), b(17) + 0.4), 'rise', 0.08, out);
  kText(x, '성장가능성을', 90, by + 96, { w: 800, s: 76, ls: -2.5, fill: COL.ink }, prog(t, b(18), b(18) + 0.4), 'rise', 0.08, out);
  wipeRect(x, 84, by + 130, 610, 132, prog(t, b(19.5), b(19.5) + 0.25), out, COL.red, 'l', 12);
  kText(x, '높게 평가해', 112, by + 228, { w: 900, s: 92, ls: -3, fill: COL.paper }, prog(t, b(19.5) + 0.05, b(19.5) + 0.4), 'rise', 0.08, out);
  // stamp-free certification tick (modern check badge)
  const cb = Ez.outBack(prog(t, b(21), b(21) + 0.3), 2.4) * (1 - Ez.inExpo(out));
  if (cb > 0) {
    x.save();
    x.translate(870, by + 175);
    x.scale(cb, cb);
    x.fillStyle = COL.ink;
    x.beginPath(); x.arc(0, 0, 92, 0, Math.PI * 2); x.fill();
    x.strokeStyle = COL.yellow; x.lineWidth = 16; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-40, 2); x.lineTo(-10, 32); x.lineTo(44, -28); x.stroke();
    x.restore();
    text(x, '공식 인증', 870, by + 318, { w: 800, s: 44, ls: -1, align: 'c', fill: COL.ink, alpha: cb });
  }
}
