// 전북천년명가 motion graphics — Three.js (WebGL) layer: renderer, extruded type, logo, map, lights.
import * as THREE from '/comp/lib/three.module.min.js';
import { RoomEnvironment } from '/comp/lib/RoomEnvironment.js';
import opentype from '/comp/lib/opentype.module.js';
import { W, H, COL } from './core.js';

export { THREE };
export const G = { renderer: null, canvas: null, env: null, fonts: {}, PW: W, PH: H };

export async function initGL(PW, PH) {
  G.PW = PW; G.PH = PH;
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(PW, PH, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.localClippingEnabled = true;
  const pm = new THREE.PMREMGenerator(r);
  G.env = pm.fromScene(new RoomEnvironment(), 0.035).texture;
  G.renderer = r; G.canvas = c;
  return G;
}

// an extra renderer with its own canvas (square icon renders etc.)
export function makeRenderer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.localClippingEnabled = true;
  r.envTex = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.035).texture;
  return r;
}
export function renderWith(r, scene, cam) {
  r.setClearColor(0x000000, 0);
  r.clear(true, true, true);
  r.render(scene, cam);
  return r.domElement;
}

export async function loadFont(key, url) {
  const buf = await (await fetch(url)).arrayBuffer();
  G.fonts[key] = opentype.parse(buf);
  return G.fonts[key];
}

// render a scene into the GL canvas (transparent background) and return the canvas
export function render(scene, cam, size) {
  const r = G.renderer;
  if (size && (size[0] !== r.domElement.width || size[1] !== r.domElement.height)) r.setSize(size[0], size[1], false);
  else if (!size && (r.domElement.width !== G.PW || r.domElement.height !== G.PH)) r.setSize(G.PW, G.PH, false);
  r.setClearColor(0x000000, 0);
  r.clear(true, true, true);
  r.render(scene, cam);
  return r.domElement;
}

export function camera(fov = 32) {
  const c = new THREE.PerspectiveCamera(fov, W / H, 0.05, 400);
  return c;
}

// project a world point to logical screen px
const _v = new THREE.Vector3();
export function project(p, cam) {
  _v.copy(p).project(cam);
  return [(_v.x + 1) * 0.5 * W, (1 - _v.y) * 0.5 * H, _v.z];
}

// ------------------------------------------------------------------ materials & lights
export function clay(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: o.rough ?? 0.46,
    metalness: 0,
    clearcoat: o.cc ?? 0.35,
    clearcoatRoughness: o.ccr ?? 0.32,
    envMapIntensity: o.env ?? 0.85,
    side: o.side ?? THREE.FrontSide,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    clippingPlanes: o.clip || null,
    clipShadows: !!o.clip,
  });
}
export function matte(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: o.rough ?? 0.8, metalness: 0, envMapIntensity: o.env ?? 0.6, clippingPlanes: o.clip || null });
}

export function lightRig(scene, o = {}) {
  scene.environment = o.env || G.env;
  const hemi = new THREE.HemisphereLight(0xfffaf0, 0xcdbfa8, o.hemi ?? 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff6ea, o.key ?? 2.1);
  key.position.set(...(o.keyPos || [-4, 7, 8]));
  key.castShadow = !!o.shadow;
  if (o.shadow) {
    key.shadow.mapSize.set(o.shadowRes || 1536, o.shadowRes || 1536);
    const s = o.shadowSize || 6;
    Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 60 });
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = o.shadowRadius ?? 7;
  }
  scene.add(key);
  if (o.target) { key.target = o.target; scene.add(o.target); }
  const fill = new THREE.DirectionalLight(0xfff0dc, o.fill ?? 0.55);
  fill.position.set(6, 2, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, o.rim ?? 0.8);
  rim.position.set(2, 4, -6);
  scene.add(rim);
  return { hemi, key, fill, rim };
}

export function shadowCatcher(w, h, opacity = 0.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShadowMaterial({ opacity }));
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ outlines -> shapes
function area2(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % n];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi + 1e-12) + xi) c = !c;
  }
  return c;
}
// rings: arrays of [x,y] (y up). Returns THREE.Shape[] with holes assigned by containment.
export function ringsToShapes(rings) {
  const R = rings.filter((r) => r.length >= 3).map((r) => ({ r, a: area2(r) }));
  if (!R.length) return [];
  const big = R.reduce((m, q) => (Math.abs(q.a) > Math.abs(m.a) ? q : m), R[0]);
  const sgn = Math.sign(big.a) || 1;
  const outers = R.filter((q) => q.a * sgn > 0), holes = R.filter((q) => q.a * sgn < 0);
  const shapes = outers.map((q) => {
    const pts = sgn > 0 ? q.r : [...q.r].reverse();
    return { s: new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), ring: q.r, abs: Math.abs(q.a) };
  });
  holes.forEach((h) => {
    const cands = shapes.filter((s) => inside(h.r[0], s.ring));
    if (!cands.length) return;
    const best = cands.reduce((m, s) => (s.abs < m.abs ? s : m), cands[0]);
    const pts = sgn > 0 ? h.r : [...h.r].reverse();
    best.s.holes.push(new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x, y))));
  });
  return shapes.map((s) => s.s);
}

// opentype path commands (y down) -> rings (y up), adaptive curve sampling
function cmdsToRings(cmds, tol = 1.2) {
  const rings = [];
  let cur = null, px = 0, py = 0;
  const push = (x, y) => cur.push([x, -y]);
  for (const c of cmds) {
    if (c.type === 'M') { if (cur && cur.length > 2) rings.push(cur); cur = []; push(c.x, c.y); px = c.x; py = c.y; }
    else if (c.type === 'L') { push(c.x, c.y); px = c.x; py = c.y; }
    else if (c.type === 'Q') {
      const len = Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x - c.x1, c.y - c.y1);
      const n = Math.max(3, Math.min(24, Math.ceil(len / (tol * 6))));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        push(u * u * px + 2 * u * t * c.x1 + t * t * c.x, u * u * py + 2 * u * t * c.y1 + t * t * c.y);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'C') {
      const len = Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2);
      const n = Math.max(3, Math.min(28, Math.ceil(len / (tol * 6))));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        push(u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
             u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'Z') { if (cur && cur.length > 2) rings.push(cur); cur = null; }
  }
  if (cur && cur.length > 2) rings.push(cur);
  // drop duplicate closing points
  return rings.map((r) => {
    const a = r[0], z = r[r.length - 1];
    return Math.hypot(a[0] - z[0], a[1] - z[1]) < 1e-6 ? r.slice(0, -1) : r;
  });
}

// Layout a string with an opentype font at `size` world units; returns per-glyph shapes centred on x.
export function glyphRun(fontKey, str, size, o = {}) {
  const f = G.fonts[fontKey];
  const glyphs = f.stringToGlyphs(str);
  const sc = size / f.unitsPerEm;
  let x = 0;
  const out = [];
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const path = g.getPath(0, 0, size * 100); // sample at 100x scale for curve tolerance, then rescale
    const rings = cmdsToRings(path.commands, o.tol ?? 1.5).map((r) => r.map(([px, py]) => [px / 100, py / 100]));
    const adv = g.advanceWidth * sc;
    out.push({ ch: [...str][i], rings, x, adv });
    x += adv + (o.ls || 0);
    if (i + 1 < glyphs.length && f.getKerningValue) x += f.getKerningValue(g, glyphs[i + 1]) * sc;
  }
  const width = x - (o.ls || 0);
  out.forEach((g) => (g.x -= width * (o.anchor ?? 0.5)));
  return { glyphs: out, width };
}

// extrude rings into geometry; returns geometry centred on its own glyph box when `centre` is set
export function extrude(rings, depth, o = {}) {
  const shapes = ringsToShapes(rings);
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: o.bevel !== false,
    bevelThickness: o.bt ?? depth * 0.12,
    bevelSize: o.bs ?? depth * 0.08,
    bevelSegments: o.bseg ?? 3,
    curveSegments: 4,
    steps: 1,
  });
  geo.computeVertexNormals();
  return geo;
}

// one Mesh per glyph (front/back caps = mat[0], sides = mat[1]); each mesh pivot at its glyph centre
export function glyphMeshes(fontKey, str, size, depth, mats, o = {}) {
  const run = glyphRun(fontKey, str, size, o);
  const meshes = run.glyphs.map((g) => {
    if (!g.rings.length) return null;
    const geo = extrude(g.rings, depth, o);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
    geo.translate(-cx, -cy, -depth / 2);
    const m = new THREE.Mesh(geo, mats);
    m.castShadow = true;
    m.receiveShadow = !!o.receive;
    m.userData = { ch: g.ch, home: new THREE.Vector3(g.x + cx, cy, 0), rings: g.rings, cx, cy };
    m.position.copy(m.userData.home);
    return m;
  }).filter(Boolean);
  return { meshes, width: run.width };
}

// ------------------------------------------------------------------ BI logo (from logo_vec.json)
// returns { group, parts: {roof:[], pebbles:[{mesh,color}], word:[]}, w, h }
export function buildLogo(data, width, depth, mats) {
  const [Wp, Hp] = data.size;
  const s = width / Wp;
  const toRing = (pts) => pts.map(([x, y]) => [(x - Wp / 2) * s, -(y - Hp / 2) * s]);
  const group = new THREE.Group();
  const parts = { roof: [], pebbles: [], word: [] };
  for (const L of data.layers) {
    for (const sh of L.shapes) {
      const rings = [toRing(sh.outer), ...sh.holes.map(toRing)];
      const geo = extrude(rings, depth, { bt: depth * 0.18, bs: depth * 0.12, bseg: 2 });
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
      geo.translate(-cx, -cy, -depth / 2);
      const mat = mats[L.name];
      const m = new THREE.Mesh(geo, mat);
      m.position.set(cx, cy, 0);
      m.castShadow = true;
      m.userData = { home: m.position.clone(), layer: L.name, bbox: sh.bbox };
      group.add(m);
      const by = sh.bbox[1] / Hp; // 0 top .. 1 bottom in logo px
      if (L.name !== 'ink') parts.pebbles.push(m);
      else if (by > 0.7) parts.word.push(m);
      else if (sh.bbox[0] / Wp > 0.76 && by > 0.4) parts.pebbles.push(m);
      else parts.roof.push(m);
    }
  }
  parts.word.sort((a, b2) => a.position.x - b2.position.x);
  parts.pebbles.sort((a, b2) => a.position.x - b2.position.x);
  parts.roof.sort((a, b2) => a.position.x - b2.position.x);
  return { group, parts, w: width, h: Hp * s };
}

// ------------------------------------------------------------------ Jeonbuk map
export function buildMap(data, width, o = {}) {
  const [ax, ay] = data.aspect;
  const s = width / ax;
  const group = new THREE.Group();
  const regions = [];
  for (const R of data.regions) {
    const rings = [];
    let shapes = R.shapes.filter((sh) => {
      let a = 0; const p = sh.outer;
      for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
      return Math.abs(a / 2) > (o.minArea ?? 0.0006);
    });
    const meshes = [];
    for (const sh of shapes) {
      const rr = [sh.outer.map(([x, y]) => [(x - ax / 2) * s, (y - ay / 2) * s]), ...sh.holes.map((h) => h.map(([x, y]) => [(x - ax / 2) * s, (y - ay / 2) * s]))];
      const geo = extrude(rr, 1, { bevel: false });
      // geometry spans z 0..1 (+bevel); we scale z for height animation
      geo.translate(0, 0, 0);
      const mat = [clay(o.base || COL.paperDeep, { rough: 0.55, cc: 0.2 }), clay(o.base || COL.paperDeep, { rough: 0.6, cc: 0.1 })];
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      meshes.push(m);
      group.add(m);
      rings.push(rr[0]);
    }
    regions.push({ name: R.name, meshes, c: [(R.c[0] - ax / 2) * s, (R.c[1] - ay / 2) * s], area: R.area });
  }
  return { group, regions, w: width, h: ay * s };
}

// rounded-rect shape helper (for cards, bars, bubbles)
export function roundRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function roundBox(w, h, d, r, mat) {
  const geo = new THREE.ExtrudeGeometry(roundRectShape(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: Math.min(r, d) * 0.35, bevelSize: Math.min(r, d) * 0.3, bevelSegments: 4, curveSegments: 10 });
  geo.translate(0, 0, -d / 2);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
