// Section A (0.00–2.88 s, riser): extruded "30년"; the camera never stops and dives into the "0",
// whose counter is a window onto the heritage-business footage (Seedance plate P).
import { W, H, COL, b, clamp, lerp, prog, E, Ez, kText, text, wipeRect, drawCover, smoothNoise } from './core.js';
import { THREE, G, camera, clay, lightRig, glyphMeshes, render, project } from './gl.js';

const S = {};
const T0 = 0, T1 = b(8);

export function build() {
  const sc = new THREE.Scene();
  lightRig(sc, { key: 2.3, hemi: 0.6, keyPos: [-5, 6, 9], shadow: false });
  const yellow = clay(COL.yellow, { rough: 0.38, cc: 0.5 });
  const yellowSide = clay(COL.yellowD, { rough: 0.5, cc: 0.2 });
  const ink = clay(COL.ink, { rough: 0.42, cc: 0.45 });
  const inkSide = clay(COL.ink2, { rough: 0.55, cc: 0.2 });
  const size = 1.15, depth = 0.34;
  const num = glyphMeshes('pblack', '30', size, depth, [yellow, yellowSide], { tol: 0.35, ls: -0.02, anchor: 0.5 });
  const nyeon = glyphMeshes('pblack', '년', size * 0.86, depth, [ink, inkSide], { tol: 0.35 });
  const grp = new THREE.Group();
  num.meshes.forEach((m) => grp.add(m));
  // place 년 after the digits, baseline-aligned
  const nm = nyeon.meshes[0];
  const gap = 0.06;
  const numHalf = num.width / 2;
  nm.userData.home.set(numHalf + gap + nyeon.width / 2 - 0.02, nm.userData.home.y - size * 0.02, 0);
  nm.position.copy(nm.userData.home);
  grp.add(nm);
  // centre the whole word
  const total = num.width + gap + nyeon.width;
  grp.children.forEach((m) => { m.userData.home.x -= (total - num.width) / 2; m.position.copy(m.userData.home); });
  sc.add(grp);
  const zero = num.meshes[1];
  // hole ring of the "0": the ring with the smaller |area|
  const ar = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const q = r[(i + 1) % r.length]; a += r[i][0] * q[1] - q[0] * r[i][1]; } return Math.abs(a / 2); };
  const rings = [...zero.userData.rings].sort((p, q) => ar(p) - ar(q));
  S.hole = rings[0].map(([x, y]) => new THREE.Vector3(x - zero.userData.cx, y - zero.userData.cy, depth / 2 + depth * 0.12));
  S.sc = sc; S.grp = grp; S.zero = zero; S.cam = camera(30); S.depth = depth;
  S.zeroCentre = new THREE.Vector3();
}

// footage schedule inside the counter (source seconds in plate P, 24 fps)
const CUTS = [
  [b(2), b(4), 0.35], [b(4), b(5), 2.95], [b(5), b(6), 5.7], [b(6), b(6.5), 1.25],
  [b(6.5), b(7), 3.35], [b(7), b(7.5), 6.55], [b(7.5), b(8) + 0.01, 3.75],
];
export function footageAt(t) {
  for (const [a, c, src] of CUTS) if (t >= a && t < c) return { src: src + (t - a), a, c };
  return null;
}

export function camAt(t) {
  const cam = S.cam;
  S.grp.updateMatrixWorld(true);
  S.zero.getWorldPosition(S.zeroCentre);
  const word = new THREE.Vector3(0, 0, 0);
  // phase 1: drift/orbit around the word; phase 2: accelerate into the zero
  const p2 = prog(t, b(2), b(7.6));
  const dive = Ez.inExpo(p2) * 0.82 + Ez.inQ(p2) * 0.18;
  const yaw = lerp(-0.26, -0.1, prog(t, 0, b(2))) * (1 - Ez.outC(p2)) + smoothNoise(t * 0.9, 3) * 0.015;
  const pitch = lerp(0.1, 0.05, prog(t, 0, b(2))) * (1 - Ez.outC(p2));
  const dist0 = lerp(10.6, 9.4, Ez.outQ(prog(t, 0, b(2))));
  const target = word.clone().lerp(S.zeroCentre, Ez.ioC(clamp(p2 * 1.6)));
  const dist = lerp(dist0, -0.9, dive);
  cam.position.set(target.x + Math.sin(yaw) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  const look = target.clone();
  look.z -= 2;
  cam.lookAt(target.x, target.y, target.z - (dist < 0.4 ? 5 : 0));
  cam.rotation.z += Ez.inC(p2) * 0.16 + smoothNoise(t * 1.3, 9) * 0.004;
  cam.fov = lerp(30, 38, Ez.inQ(p2));
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return { dist, p2 };
}

export async function draw(x, t, env) {
  const { dist, p2 } = camAt(t);
  // subtle idle motion of the glyphs
  S.grp.children.forEach((m, i) => {
    const h = m.userData.home;
    m.position.set(h.x, h.y + Math.sin(t * 2.2 + i) * 0.012, h.z);
    m.rotation.y = Math.sin(t * 1.4 + i * 0.7) * 0.03;
  });
  // ---- background paper
  env.paper(x);
  // design grid (fades as we dive)
  const ga = 0.55 * (1 - prog(t, b(3), b(6)));
  if (ga > 0) env.grid(x, ga);
  // ---- footage through the counter of the 0
  const f = footageAt(t);
  if (f) {
    const im = await env.plate('P', f.src);
    S.zero.updateMatrixWorld(true);
    const pts = S.hole.map((v) => project(v.clone().applyMatrix4(S.zero.matrixWorld), S.cam));
    const behind = pts.some((p) => p[2] > 1 || p[2] < -1) || dist < 0.35;
    x.save();
    if (!behind) {
      x.beginPath();
      pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
      x.closePath();
      x.clip();
    }
    const zoom = 1.06 + 0.05 * prog(t, f.a, f.c);
    drawCover(x, im, 0, 0, W, H, zoom);
    x.restore();
  }
  // ---- 3D word
  if (dist > -0.6) x.drawImage(render(S.sc, S.cam), 0, 0, W, H);
  // ---- typography
  const out1 = prog(t, b(3.6), b(4.4));
  kText(x, '전북에서', W / 2, 560, { w: 800, s: 84, ls: -2, align: 'c', fill: COL.ink }, prog(t, 0.0, 0.42), 'rise', 0.14, out1);
  kText(x, '한 길을 지켜온', W / 2, 1238, { w: 700, s: 70, ls: -2, align: 'c', fill: COL.ink }, prog(t, b(1), b(1) + 0.4), 'rise', 0.08, out1);
  // label bars: 소상공인 / 가업승계자
  const lo = prog(t, b(6.6), b(7.4));
  const y1 = 1452, y2 = 1612;
  wipeRect(x, 96, y1 - 112, 560, 148, prog(t, b(4), b(4) + 0.22), lo, COL.ink, 'l', 14);
  if (t >= b(4) + 0.05) kText(x, '소상공인', 136, y1, { w: 900, s: 110, ls: -4, fill: COL.paper }, prog(t, b(4) + 0.05, b(4) + 0.32), 'rise', 0.1, lo);
  wipeRect(x, 200, y2 - 112, 690, 148, prog(t, b(5), b(5) + 0.22), lo, COL.green, 'l', 14);
  if (t >= b(5) + 0.05) kText(x, '가업승계자', 240, y2, { w: 900, s: 110, ls: -4, fill: COL.ink }, prog(t, b(5) + 0.05, b(5) + 0.32), 'rise', 0.08, lo);
  // final 16ths: flash build into the drop
  const fl = prog(t, b(7.75), b(8));
  if (fl > 0) {
    x.save();
    x.globalAlpha = Ez.inC(fl) * 0.95;
    x.fillStyle = COL.paper;
    x.fillRect(0, 0, W, H);
    x.restore();
  }
}

export const range = [T0, T1];
