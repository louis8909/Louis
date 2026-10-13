// Section F (15.84–20.00 s): the BI logo, extruded in 3D on hanji paper. Ink strokes are revealed by a sweeping
// clip plane, the colour forms and the wordmark settle in on 16ths, the camera eases to frontal; tagline + credit.
import { W, H, COL, b, clamp, lerp, prog, E, Ez, kText, text, wipeRect, smoothNoise } from './core.js';
import { THREE, G, camera, clay, lightRig, buildLogo, render, shadowCatcher } from './gl.js';

const S = {};
export const range = [b(44), 20.0];

export function build(logoData) {
  const sc = new THREE.Scene();
  const tgt = new THREE.Object3D();
  lightRig(sc, { key: 2.2, hemi: 0.62, keyPos: [-4, 6, 9], shadow: true, shadowSize: 3, shadowRes: 2048, shadowRadius: 10, target: tgt });
  S.clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -10);
  const mats = {
    ink: clay(COL.ink, { rough: 0.42, cc: 0.45, clip: [S.clip] }),
    green: clay('#93B143', { rough: 0.45, cc: 0.4 }),
    yellow: clay('#E7B543', { rough: 0.45, cc: 0.4 }),
    red: clay('#B52D2A', { rough: 0.45, cc: 0.4 }),
  };
  // wordmark glyphs get their own ink material without the sweep clip
  const L = buildLogo(logoData, 2.08, 0.07, mats);
  const wordMat = clay(COL.ink, { rough: 0.42, cc: 0.45, transparent: true });
  L.parts.word.forEach((m) => (m.material = wordMat));
  L.parts.pebbles.forEach((m) => { if (m.userData.layer === 'ink') m.material = clay(COL.ink, { rough: 0.42, cc: 0.45 }); });
  sc.add(L.group);
  L.group.position.y = 0.1;
  const wall = shadowCatcher(20, 20, 0.16);
  wall.position.z = -0.12;
  sc.add(wall);
  S.sweep = new THREE.PointLight(0xffffff, 0, 6, 1.6);
  S.sweep.position.set(-3, -0.15, 2.4);
  sc.add(S.sweep);
  S.L = L; S.sc = sc; S.cam = camera(30); S.wordMat = wordMat;
}

function camAt(t) {
  const cam = S.cam;
  const p = prog(t, b(44), b(48.5));
  const e = Ez.outExpo(p);
  const yaw = lerp(0.42, 0.0, e) + 0.012 * Math.sin(t * 0.6);
  const pitch = lerp(-0.22, 0.02, e);
  const dist = lerp(6.2, 8.0, e) - 0.35 * Ez.ioQ(prog(t, b(48), 20));
  cam.position.set(Math.sin(yaw) * dist, 0.05 + Math.sin(pitch) * dist, Math.cos(yaw) * dist);
  cam.lookAt(0, 0.05, 0);
  cam.rotation.z += lerp(-0.05, 0, e);
  cam.updateMatrixWorld(true);
}

export async function draw(x, t, env) {
  camAt(t);
  const L = S.L;
  // ink roof strokes: clip-plane sweep left -> right
  const sw = Ez.ioC(prog(t, b(44), b(45.2)));
  S.clip.constant = lerp(-1.4, 1.6, sw);
  L.parts.roof.forEach((m, i) => {
    const h = m.userData.home;
    const rp = Ez.outExpo(prog(t, b(44) + i * 0.04, b(45.4)));
    m.position.set(h.x, h.y, h.z + (1 - rp) * 0.35);
  });
  // colour forms: drop into place on 16ths (no spin, no focus)
  L.parts.pebbles.forEach((m, i) => {
    const t0 = b(45) + i * b(0.25);
    const pp = prog(t, t0, t0 + 0.3);
    const h = m.userData.home;
    m.visible = pp > 0;
    const e = Ez.outBack(pp, 1.6);
    m.position.set(h.x, h.y - (1 - e) * 0.16, h.z + (1 - Ez.outC(pp)) * 0.25);
    m.scale.setScalar(Math.max(0.001, lerp(0.6, 1, Ez.outC(pp))));
  });
  // wordmark: syllables rise on 32nds
  L.parts.word.forEach((m, i) => {
    const t0 = b(46) + i * 0.03;
    const wp = prog(t, t0, t0 + 0.32);
    const h = m.userData.home;
    m.visible = wp > 0;
    m.position.set(h.x, h.y - (1 - Ez.outExpo(wp)) * 0.22, h.z);
  });
  S.wordMat.opacity = 1;
  const wv = Ez.outC(prog(t, b(46), b(47)));
  L.parts.word.forEach((m) => (m.material.opacity = wv));
  // light sweep across the glossy logo on the final hit (18.0 s)
  const sp = prog(t, b(50) - 0.05, b(50) + 0.75);
  S.sweep.position.x = lerp(-2.6, 2.8, Ez.ioQ(sp));
  S.sweep.intensity = sp > 0 && sp < 1 ? Math.sin(sp * Math.PI) * 4.5 : 0;
  env.paper(x);
  x.drawImage(render(S.sc, S.cam), 0, 0, W, H);
  // tagline
  kText(x, '시간이 증명한 이름', W / 2, 520, { fam: 'Hahmlet', w: 700, s: 66, ls: -1, align: 'c', fill: COL.ink }, prog(t, b(47), b(47) + 0.55), 'rise', 0.05);
  const rl = Ez.outExpo(prog(t, b(47.5), b(48.5)));
  x.save(); x.fillStyle = COL.ink; x.globalAlpha = 0.85; x.fillRect(W / 2 - 40 * rl, 568, 80 * rl, 4); x.restore();
  // credit on the final hit (18.0 s)
  const cr = prog(t, b(50), b(50) + 0.5);
  kText(x, '전북특별자치도 · 전북소상공인광역지원센터', W / 2, 1610, { w: 600, s: 38, ls: -0.5, align: 'c', fill: COL.ink }, cr, 'rise', 0.012);
  env.mono(x, 'jbsos.or.kr', W / 2, 1680, { align: 'c', alpha: Ez.outC(prog(t, b(50.5), b(51.5))), color: COL.inkSoft, size: 28 });
}
