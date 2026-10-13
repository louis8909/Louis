// Section B (2.88–4.68 s, the drop): "전북 / 천년 / 명가" — six extruded syllables slam down on 16ths
// in front of a paper wall that catches their shadows; camera orbits and kicks on every landing.
import { W, H, COL, b, clamp, lerp, prog, E, Ez, kText, text, wipeRect, smoothNoise } from './core.js';
import { THREE, G, camera, clay, lightRig, glyphMeshes, render, shadowCatcher } from './gl.js';

const S = {};
export const range = [b(8), b(13)];
const LAND = (i) => b(8) + i * b(0.25); // landing times: 16th notes from the downbeat

export function build() {
  const sc = new THREE.Scene();
  const tgt = new THREE.Object3D();
  lightRig(sc, { key: 2.4, hemi: 0.5, keyPos: [-5, 7, 9], shadow: true, shadowSize: 4.5, shadowRes: 2048, shadowRadius: 9, target: tgt });
  const ink = clay(COL.ink, { rough: 0.4, cc: 0.55 });
  const inkSide = clay(COL.ink2, { rough: 0.5, cc: 0.25 });
  const green = clay(COL.green, { rough: 0.4, cc: 0.5 });
  const greenSide = clay(COL.greenD, { rough: 0.5, cc: 0.25 });
  const size = 1.22, depth = 0.38;
  const rows = [['전북', [ink, inkSide]], ['천년', [green, greenSide]], ['명가', [ink, inkSide]]];
  const ys = [1.32, 0.0, -1.32];
  S.glyphs = [];
  rows.forEach(([str, mats], r) => {
    const run = glyphMeshes('pblack', str, size, depth, mats, { tol: 0.35, ls: -0.03 });
    run.meshes.forEach((m) => {
      m.userData.home.y += ys[r] - 0.38 * size * 0 ;
      m.position.copy(m.userData.home);
      sc.add(m);
      S.glyphs.push(m);
    });
  });
  // normalise row vertical centres (glyph boxes differ): align each row's mean y to its slot
  for (let r = 0; r < 3; r++) {
    const g = S.glyphs.slice(r * 2, r * 2 + 2);
    const my = (g[0].userData.home.y + g[1].userData.home.y) / 2;
    g.forEach((m) => { m.userData.home.y += ys[r] - my; m.position.copy(m.userData.home); });
  }
  const wall = shadowCatcher(30, 30, 0.22);
  wall.position.set(0, 0, -0.95);
  sc.add(wall);
  S.sc = sc; S.cam = camera(30);
}

function camAt(t) {
  const cam = S.cam;
  const p = prog(t, range[0], range[1]);
  const yaw = lerp(0.2, -0.16, Ez.ioQ(p)) + smoothNoise(t * 0.8, 2) * 0.01;
  const pitch = lerp(-0.12, 0.05, Ez.outQ(p));
  let dist = lerp(8.6, 10.4, Ez.outC(p));
  // landing kicks
  let kick = 0;
  for (let i = 0; i < 6; i++) {
    const dt = t - LAND(i);
    if (dt >= 0 && dt < 0.3) kick += Math.exp(-dt * 22) * (i % 2 ? -1 : 1);
  }
  // whip-out (4.50 -> 4.68): tilt up hard
  const wo = Ez.inExpo(prog(t, b(12.5), b(13)));
  cam.position.set(Math.sin(yaw) * dist, Math.sin(pitch) * dist + kick * 0.05, Math.cos(yaw) * dist);
  cam.lookAt(0, kick * 0.03 + wo * 9, 0);
  cam.rotation.z += kick * 0.012;
  cam.updateMatrixWorld(true);
}

export async function draw(x, t, env) {
  camAt(t);
  S.glyphs.forEach((m, i) => {
    const h = m.userData.home;
    const tl = LAND(i);
    const fall = prog(t, tl - 0.17, tl);
    const settle = prog(t, tl, tl + 0.3);
    if (t < tl - 0.17) { m.visible = false; return; }
    m.visible = true;
    const y = lerp(h.y + 4.6, h.y, Ez.inQ(fall));
    const sq = settle > 0 ? Math.sin(settle * Math.PI) * Math.exp(-settle * 3) * 0.16 : 0; // squash on impact
    m.position.set(h.x, y - sq * 0.25, h.z + (1 - fall) * 0.6);
    m.rotation.set(lerp(-1.1, 0, Ez.outQ(fall)) + Math.sin(t * 1.7 + i) * 0.02, Math.sin(t * 1.3 + i * 0.9) * 0.04, (1 - fall) * (i % 2 ? 0.2 : -0.2));
    m.scale.set(1 + sq * 0.4, 1 - sq, 1 + sq * 0.4);
  });
  env.paper(x);
  // colour slab behind the bottom row (wipes up on the first beat after the drop)
  wipeRect(x, 0, 1230, W, 690, prog(t, b(9), b(9.75)), prog(t, b(12.4), b(13)), COL.yellow, 'u');
  x.drawImage(render(S.sc, S.cam), 0, 0, W, H);
  // copy
  const out = prog(t, b(12.1), b(12.8));
  kText(x, '전북특별자치도가', W / 2, 255, { w: 800, s: 64, ls: -1.5, align: 'c', fill: COL.ink }, prog(t, b(9.5), b(9.5) + 0.42), 'rise', 0.07, out);
  kText(x, '공식 인증한', W / 2, 345, { w: 800, s: 64, ls: -1.5, align: 'c', fill: COL.ink }, prog(t, b(10), b(10) + 0.36), 'rise', 0.09, out);
  // bottom pill: 전통명가
  const pp = prog(t, b(10.5), b(10.5) + 0.3);
  wipeRect(x, W / 2 - 250, 1668, 500, 126, pp, out, COL.ink, 'l', 63);
  if (pp > 0.2) kText(x, '전통명가', W / 2, 1758, { w: 900, s: 84, ls: -2, align: 'c', fill: COL.paper }, prog(t, b(10.5) + 0.06, b(10.5) + 0.36), 'rise', 0.08, out);
  env.mono(x, 'OFFICIALLY CERTIFIED  ·  JEONBUK STATE', W / 2, 1850, { align: 'c', alpha: prog(t, b(11), b(11.5)) * (1 - out) });
}
