#!/usr/bin/env python3
"""Extract the 14 시·군 of 전북특별자치도 from a KOSTAT municipalities GeoJSON, merge 전주 districts,
project to a planar frame, simplify, and write a compact JSON for the 3D map.

usage: build_map.py IN.geojson OUT.json [--tol 0.0009]
"""
import json, math, sys
import numpy as np

NAMES = ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군']

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    ab = b - a; n = math.hypot(*ab)
    v = pts - a
    d = np.hypot(*v.T) if n < 1e-12 else np.abs(ab[0] * v[:, 1] - ab[1] * v[:, 0]) / n
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])

def simplify_ring(r, eps):
    r = np.asarray(r, float)
    if np.allclose(r[0], r[-1]): r = r[:-1]
    j = int(np.argmax(np.hypot(*(r - r[0]).T)))
    a = rdp(r[:j + 1], eps); b = rdp(np.vstack([r[j:], r[:1]]), eps)
    return np.vstack([a[:-1], b[:-1]])

def area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

def main():
    src, out = sys.argv[1], sys.argv[2]
    tol = float(sys.argv[sys.argv.index('--tol') + 1]) if '--tol' in sys.argv else 0.0009
    d = json.load(open(src))
    regions = {}
    for f in d['features']:
        pr = f['properties']
        name = pr.get('name') or pr.get('SIG_KOR_NM') or ''
        code = str(pr.get('code') or pr.get('SIG_CD') or '')
        if not (code.startswith('35') or code.startswith('45') or code.startswith('52')): continue
        base = '전주시' if name.startswith('전주시') else name
        if base not in NAMES: continue
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        regions.setdefault(base, []).extend(polys)
    missing = [n for n in NAMES if n not in regions]
    if missing: print('MISSING', missing)
    allpts = np.array([pt for polys in regions.values() for poly in polys for ring in poly for pt in ring], float)
    lat0 = allpts[:, 1].mean(); k = math.cos(math.radians(lat0))
    x0, x1 = (allpts[:, 0] * k).min(), (allpts[:, 0] * k).max()
    y0, y1 = allpts[:, 1].min(), allpts[:, 1].max()
    s = 1.0 / max(x1 - x0, y1 - y0)
    def P(pt):  # planar, x right, y up, unit box ~[0,1]
        return [(pt[0] * k - x0) * s, (pt[1] - y0) * s]
    outd = {'aspect': [(x1 - x0) * s, (y1 - y0) * s], 'lat0': lat0, 'regions': []}
    for name in NAMES:
        polys = regions.get(name, [])
        shapes = []
        tot = 0; cx = cy = 0
        for poly in polys:
            rings = []
            for ri, ring in enumerate(poly):
                pp = np.array([P(p) for p in ring])
                pp = simplify_ring(pp, tol * s / s if False else tol * k * s)
                if len(pp) < 4: continue
                rings.append(pp)
            if not rings: continue
            A = area(rings[0])
            if abs(A) < 2e-5: continue
            outer = rings[0] if A > 0 else rings[0][::-1]
            holes = [(r if area(r) < 0 else r[::-1]) for r in rings[1:]]
            a_ = abs(A); tot += a_; cx += outer[:, 0].mean() * a_; cy += outer[:, 1].mean() * a_
            shapes.append({'outer': np.round(outer, 5).tolist(), 'holes': [np.round(h, 5).tolist() for h in holes]})
        # label point: centroid of the largest shape's vertices, nudged toward the area-weighted centre
        outd['regions'].append({'name': name, 'c': [round(cx / tot, 5), round(cy / tot, 5)] if tot else [0, 0], 'area': round(tot, 6), 'shapes': shapes})
        print(name, len(shapes), sum(len(sh['outer']) for sh in shapes))
    json.dump(outd, open(out, 'w'), ensure_ascii=False)
    print('aspect', outd['aspect'])

if __name__ == '__main__':
    main()
