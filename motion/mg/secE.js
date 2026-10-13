// Section E (11.52–15.84 s): 지원내용 — a 3D cube whose four faces are the four support cards
// (경영 / 홍보 / 멘토링 / 금융); it rolls 90° on the beat, every card carries its own 3D clay icon.
import { W, H, COL, b, clamp, lerp, prog, E, Ez, kText, text, wipeRect, drawCover, mkCanvas, smoothNoise } from './core.js';
import { THREE, G, camera, clay, lightRig, render, roundBox, roundRectShape, makeRenderer, renderWith, shadowCatcher } from './gl.js';

const S = {};
export const range = [b(32), b(44)];
const TURN = [b(35), b(38), b(41)]; // a face lands on each of these beats
const CARDS = [
  { id: '01', title: '경영', bg: COL.green, fg: COL.paper, sub1: '업체당 경영 지원', sub2: '인건비 · 재료비 사용 제외', hl: COL.ink, icon: 'bars' },
  { id: '02', title: '홍보', bg: COL.yellow, fg: COL.ink, sub1: '방송사 연계 TV 홍보', sub2: '인증서 · 인증현판 제공', hl: COL.paper, icon: 'tv' },
  { id: '03', title: '멘토링', bg: COL.paper, fg: COL.ink, sub1: '전담 멘토 매칭', sub2: '맞춤형 멘토링', hl: COL.red, icon: 'bubbles' },
  { id: '04', title: '금융', bg: COL.ink, fg: COL.paper, sub1: '특례보증 지원', sub2: '보증료율 고정', hl: COL.yellow, icon: 'shield' },
];
const ICON = 760; // icon render size (logical px)

function iconScene(kind, env) {
  const sc = new THREE.Scene();
  lightRig(sc, { env, key: 2.4, hemi: 0.6, keyPos: [-4, 6, 7], shadow: false, rim: 1.0 });
  const g = new THREE.Group();
  sc.add(g);
  const M = (c, o) => clay(c, o);
  if (kind === 'bars') {
    const hs = [0.9, 1.5, 2.2];
    const cols = [COL.paper, COL.yellow, COL.ink];
    g.userData.bars = hs.map((h, i) => {
      const m = roundBox(0.62, h, 0.62, 0.12, M(cols[i], { rough: 0.42, cc: 0.5 }));
      m.position.set(-0.85 + i * 0.85, -1.1 + h / 2, 0);
      m.userData = { h, y0: -1.1 };
      g.add(m);
      return m;
    });
    // rising arrow
    const sh = new THREE.Shape();
    sh.moveTo(-0.11, -0.9); sh.lineTo(0.11, -0.9); sh.lineTo(0.11, 0.25); sh.lineTo(0.32, 0.25); sh.lineTo(0, 0.7); sh.lineTo(-0.32, 0.25); sh.lineTo(-0.11, 0.25); sh.closePath();
    const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 });
    ag.translate(0, 0, -0.11);
    const ar = new THREE.Mesh(ag, M(COL.red, { rough: 0.38, cc: 0.6 }));
    ar.position.set(0.15, 0.85, 0.5);
    ar.rotation.z = -0.62;
    g.add(ar);
    g.userData.arrow = ar;
  } else if (kind === 'tv') {
    const body = roundBox(2.5, 1.85, 0.9, 0.26, M(COL.ink, { rough: 0.45, cc: 0.5 }));
    g.add(body);
    const cv = mkCanvas(640, 460);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.ShapeGeometry(roundRectShape(2.08, 1.46, 0.16)), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    // ShapeGeometry UVs follow shape coordinates: remap to 0..1
    const uv = scr.geometry.attributes.uv, pos = scr.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 1.04) / 2.08, (pos.getY(i) + 0.73) / 1.46);
    scr.position.set(-0.0, 0.0, 0.47);
    g.add(scr);
    g.userData.screen = { cv, tex };
    for (const sx of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 12), M(COL.ink));
      a.position.set(sx * 0.32, 1.22, 0);
      a.rotation.z = sx * -0.5;
      g.add(a);
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), M(COL.red, { cc: 0.6 }));
      k.position.set(sx * 0.52, 1.56, 0);
      g.add(k);
    }
    const stand = roundBox(1.2, 0.14, 0.6, 0.06, M(COL.ink2));
    stand.position.set(0, -1.06, 0);
    g.add(stand);
  } else if (kind === 'bubbles') {
    const bubble = (w, h, col, flip) => {
      const s = roundRectShape(w, h, 0.36);
      const tail = new THREE.Shape();
      const tx = flip ? w * 0.22 : -w * 0.22;
      tail.moveTo(tx - 0.18, -h / 2 + 0.05); tail.lineTo(tx + (flip ? 0.42 : -0.42), -h / 2 - 0.45); tail.lineTo(tx + 0.18, -h / 2 + 0.05); tail.closePath();
      const geo = new THREE.ExtrudeGeometry([s, tail], { depth: 0.34, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 12 });
      geo.translate(0, 0, -0.17);
      return new THREE.Mesh(geo, M(col, { rough: 0.38, cc: 0.6 }));
    };
    const b1 = bubble(1.9, 1.2, COL.green, false);
    b1.position.set(-0.45, 0.62, 0);
    const b2 = bubble(1.75, 1.1, COL.red, true);
    b2.position.set(0.5, -0.78, 0.3);
    g.add(b1, b2);
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), M(COL.paper, { cc: 0.6 }));
      d.position.set(-0.5 + i * 0.5, 0, 0.26);
      b2.add(d);
    }
    g.userData.b = [b1, b2];
  } else if (kind === 'shield') {
    const s = new THREE.Shape();
    s.moveTo(0, 1.25);
    s.bezierCurveTo(0.45, 1.05, 0.85, 1.0, 1.05, 0.98);
    s.lineTo(1.05, 0.1);
    s.bezierCurveTo(1.05, -0.65, 0.45, -1.05, 0, -1.3);
    s.bezierCurveTo(-0.45, -1.05, -1.05, -0.65, -1.05, 0.1);
    s.lineTo(-1.05, 0.98);
    s.bezierCurveTo(-0.85, 1.0, -0.45, 1.05, 0, 1.25);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4, curveSegments: 16 });
    geo.translate(0, 0, -0.19);
    const sh = new THREE.Mesh(geo, M(COL.yellow, { rough: 0.35, cc: 0.65 }));
    g.add(sh);
    const ck = new THREE.Shape();
    ck.moveTo(-0.52, 0.02); ck.lineTo(-0.34, 0.2); ck.lineTo(-0.12, -0.02); ck.lineTo(0.42, 0.52); ck.lineTo(0.6, 0.34); ck.lineTo(-0.12, -0.38); ck.closePath();
    const cg = new THREE.ExtrudeGeometry(ck, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
    const c = new THREE.Mesh(cg, M(COL.ink, { cc: 0.6 }));
    c.position.set(0, 0.0, 0.26);
    sh.add(c);
    g.userData.coins = [];
    for (let i = 0; i < 4; i++) {
      const co = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.13, 40), M(i % 2 ? COL.paper : COL.paper2, { rough: 0.35, cc: 0.6 }));
      co.position.set(1.15, -1.15 + i * 0.15, 0.5);
      g.add(co);
      g.userData.coins.push(co);
    }
  }
  const cam = camera(28);
  cam.aspect = 1;
  cam.updateProjectionMatrix();
  cam.position.set(0, 0.3, 9.4);
  cam.lookAt(0, 0, 0);
  return { sc, g, cam, kind };
}

export function build() {
  S.r2 = makeRenderer(Math.round(ICON * G.PW / W), Math.round(ICON * G.PW / W));
  S.icons = CARDS.map((c) => iconScene(c.icon, S.r2.envTex));
  S.faces = CARDS.map(() => {
    const cv = mkCanvas(G.PW, G.PH);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { cv, tex, mat: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) };
  });
  const cap = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.ink2), toneMapped: false });
  // face order of BoxGeometry: +x, -x, +y, -y, +z, -z  ->  card1 +z, card2 +x, card3 -z, card4 -x
  const mats = [S.faces[1].mat, S.faces[3].mat, cap, cap, S.faces[0].mat, S.faces[2].mat];
  const Wc = 0.5359 * 10 * (W / H), Hc = 0.5359 * 10;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(Wc, Hc, Wc), mats);
  S.pivot = new THREE.Group();
  S.pivot.add(cube);
  cube.position.set(0, 0, 0);
  S.sc = new THREE.Scene();
  S.sc.add(S.pivot);
  S.cam = camera(30);
  S.Wc = Wc;
}

function faceAngle(t) {
  let a = 0;
  TURN.forEach((tk) => { a += Ez.ioExpo(prog(t, tk - 0.17, tk + 0.07)); });
  return a; // number of quarter turns completed
}

async function drawCard(k, t) {
  const c = CARDS[k], F = S.faces[k], x = F.cv.getContext('2d');
  const sx = G.PW / W;
  x.setTransform(sx, 0, 0, sx, 0, 0);
  x.fillStyle = c.bg;
  x.fillRect(0, 0, W, H);
  // local timeline: when this card becomes the front face
  const t0 = k === 0 ? b(32) + 0.05 : TURN[k - 1] - 0.02;
  const lt = t - t0;
  const p = (a, d) => clamp((lt - a) / d);
  // header
  const mono = (s, X, Y, al, align) => { x.save(); x.globalAlpha = al; x.font = '500 26px "Plex Mono"'; x.letterSpacing = '3px'; x.fillStyle = c.fg; x.textAlign = align || 'left'; x.fillText(s, X, Y); x.restore(); };
  mono('지원내용  ·  SUPPORT', 90, 170, Ez.outC(p(0.05, 0.25)) * 0.9);
  x.save();
  x.globalAlpha = Ez.outC(p(0.05, 0.25));
  x.font = '700 44px "Unbounded"'; x.letterSpacing = '0px'; x.fillStyle = c.fg; x.textAlign = 'right';
  x.fillText(`${c.id} / 04`, 990, 176);
  x.restore();
  x.save(); x.globalAlpha = 0.55; x.fillStyle = c.fg; x.fillRect(90, 205, 900 * Ez.outExpo(p(0.0, 0.4)), 3); x.restore();
  // icon
  const ic = S.icons[k];
  const ip = p(0.0, 0.5);
  const pop = Ez.outBack(ip, 1.8);
  ic.g.scale.setScalar(Math.max(0.001, pop));
  ic.g.rotation.y = (1 - Ez.outExpo(ip)) * -1.8 + Math.sin(t * 1.3 + k) * 0.22;
  ic.g.rotation.x = Math.sin(t * 0.9 + k) * 0.08;
  ic.g.position.y = Math.sin(t * 2.0 + k) * 0.06;
  if (ic.kind === 'bars') ic.g.userData.bars.forEach((m, i) => { const gp = Ez.outBack(clamp((lt - 0.12 - i * 0.07) / 0.35), 2); m.scale.y = Math.max(0.01, gp); m.position.y = m.userData.y0 + (m.userData.h * gp) / 2; });
  if (ic.kind === 'tv') {
    const im = await S.env.plate('P', 2.9 + Math.max(0, lt) * 0.9);
    const sx2 = ic.g.userData.screen.cv.getContext('2d');
    drawCover(sx2, im, 0, 0, 640, 460, 1.02, 0.5, 0.35);
    ic.g.userData.screen.tex.needsUpdate = true;
  }
  if (ic.kind === 'bubbles') ic.g.userData.b.forEach((m, i) => (m.position.y = (i ? -0.78 : 0.62) + Math.sin(t * 3 + i * 1.7) * 0.05));
  if (ic.kind === 'shield') ic.g.userData.coins.forEach((m, i) => { const cp = Ez.outBack(clamp((lt - 0.15 - i * 0.06) / 0.3), 2); m.position.y = -1.15 + i * 0.15 + (1 - cp) * 1.2; m.visible = cp > 0.01; });
  const ir = renderWith(S.r2, ic.sc, ic.cam);
  x.drawImage(ir, (W - ICON) / 2, 330, ICON, ICON);
  // title + sublines
  const out = 0;
  kText(x, c.title, 84, 1440, { w: 900, s: c.title.length > 2 ? 210 : 250, ls: -10, fill: c.fg }, p(0.08, 0.42), 'rise', 0.1, out);
  kText(x, c.sub1, 92, 1580, { w: 800, s: 64, ls: -2, fill: c.fg }, p(0.2, 0.4), 'rise', 0.04, out);
  // highlight underline + second line
  x.save(); x.globalAlpha = 1; x.fillStyle = c.hl; x.fillRect(92, 1612, 520 * Ez.outExpo(p(0.3, 0.3)), 8); x.restore();
  kText(x, c.sub2, 92, 1690, { w: 500, s: 44, ls: -1, fill: c.fg }, p(0.32, 0.4), 'rise', 0.03, out);
  mono('JEONBUK CHEONNYEON MYEONGGA', 90, 1840, 0.6 * Ez.outC(p(0.2, 0.3)));
  F.tex.needsUpdate = true;
}

export async function draw(x, t, env) {
  S.env = env;
  const q = faceAngle(t);
  // entry / exit of the whole cube
  const en = Ez.outExpo(prog(t, b(32), b(32) + 0.34));
  const ex = Ez.inExpo(prog(t, b(43.5), b(44)));
  S.pivot.rotation.set(lerp(0.35, 0, en) + ex * 0.6, -q * Math.PI / 2 + lerp(0.9, 0, en) - ex * 1.2, lerp(-0.2, 0, en));
  S.pivot.position.set(0, 0, -S.Wc / 2 - lerp(14, 0, en) - ex * 18);
  const mid = Math.sin(Math.PI * (q % 1));
  S.cam.position.set(0, 0, 10 + mid * 2.2);
  S.cam.lookAt(0, 0, -S.Wc / 2);
  S.cam.updateMatrixWorld(true);
  // which faces are visible: the current one and, during a turn, the next one
  const k0 = Math.min(3, Math.floor(q + 1e-6)), k1 = Math.min(3, k0 + 1);
  await drawCard(k0, t);
  if (q % 1 > 0.001 && k1 !== k0) await drawCard(k1, t);
  // background behind the cube
  x.save();
  x.fillStyle = COL.ink;
  x.fillRect(0, 0, W, H);
  x.restore();
  env.grid(x, 0.25, 'rgba(243,238,228,0.35)');
  // fake face shading during turns (darken faces rotating away)
  S.faces.forEach((F, k) => {
    const facing = Math.cos((q - k) * Math.PI / 2);
    F.mat.color.setScalar(0.5 + 0.5 * clamp(facing));
  });
  x.drawImage(render(S.sc, S.cam), 0, 0, W, H);
}
