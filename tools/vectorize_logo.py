#!/usr/bin/env python3
"""Vectorize the 전북천년명가 BI logo from a screenshot crop (numpy + Pillow only).

Each colour layer is turned into a soft membership field, upsampled, smoothed and
traced with marching squares (sub-pixel, linear interpolation). Contours are
simplified (RDP) and written as JSON polygons + a preview SVG.

usage: vectorize_logo.py CROP.png OUT_DIR [--scale 6]
"""
import json, math, sys, os
import numpy as np
from PIL import Image, ImageFilter

def rgb2hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    h = h * 60.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx

def gauss_blur(f, sigma):
    if sigma <= 0: return f
    r = int(math.ceil(sigma * 3))
    x = np.arange(-r, r + 1)
    k = np.exp(-x * x / (2 * sigma * sigma)); k /= k.sum()
    p = np.pad(f, ((r, r), (0, 0)), mode='edge')
    f = sum(k[i] * p[i:i + f.shape[0]] for i in range(2 * r + 1))
    p = np.pad(f, ((0, 0), (r, r)), mode='edge')
    f = sum(k[i] * p[:, i:i + f.shape[1]] for i in range(2 * r + 1))
    return f

def marching_squares(F, level=0.5):
    """Return closed contours (list of Nx2 float arrays, x,y) of F at level."""
    H, W = F.shape
    P = np.pad(F, 1, mode='constant', constant_values=0.0)  # close everything
    H += 2; W += 2
    B = P > level
    # edge points: key by (y, x, dir) dir 0 = horizontal edge between (y,x)-(y,x+1), 1 = vertical (y,x)-(y+1,x)
    def interp(y0, x0, y1, x1):
        a = P[y0, x0]; b = P[y1, x1]
        t = (level - a) / (b - a) if b != a else 0.5
        return (x0 + t * (x1 - x0) - 1, y0 + t * (y1 - y0) - 1)
    segs = {}
    # cell (y,x) with corners tl=(y,x) tr=(y,x+1) br=(y+1,x+1) bl=(y+1,x)
    c = (B[:-1, :-1].astype(np.uint8) * 8 + B[:-1, 1:].astype(np.uint8) * 4 +
         B[1:, 1:].astype(np.uint8) * 2 + B[1:, :-1].astype(np.uint8) * 1)
    ys, xs = np.nonzero((c > 0) & (c < 15))
    T = lambda y, x: ('h', y, x)        # top edge
    Bo = lambda y, x: ('h', y + 1, x)   # bottom edge
    L = lambda y, x: ('v', y, x)        # left edge
    R = lambda y, x: ('v', y, x + 1)    # right edge
    # orientation: keep inside on the left when walking (consistent winding)
    table = {
        1: [(L, Bo)], 2: [(Bo, R)], 3: [(L, R)], 4: [(R, T)], 5: None, 6: [(Bo, T)], 7: [(L, T)],
        8: [(T, L)], 9: [(T, Bo)], 10: None, 11: [(T, R)], 12: [(R, L)], 13: [(R, Bo)], 14: [(Bo, L)],
    }
    nxt = {}
    for y, x in zip(ys.tolist(), xs.tolist()):
        cc = int(c[y, x])
        if cc == 5 or cc == 10:
            centre = (P[y, x] + P[y, x + 1] + P[y + 1, x + 1] + P[y + 1, x]) / 4
            if cc == 5:
                pairs = [(L, T), (R, Bo)] if centre > level else [(L, Bo), (R, T)]
            else:
                pairs = [(T, R), (Bo, L)] if centre > level else [(T, L), (Bo, R)]
        else:
            pairs = table[cc]
        for a, b in pairs:
            ka = a(y, x); kb = b(y, x)
            nxt[ka] = kb
    def pt(k):
        t, y, x = k
        return interp(y, x, y, x + 1) if t == 'h' else interp(y, x, y + 1, x)
    seen = set(); out = []
    for k0 in list(nxt.keys()):
        if k0 in seen: continue
        poly = []; k = k0
        while k not in seen and k in nxt:
            seen.add(k); poly.append(pt(k)); k = nxt[k]
        if len(poly) >= 8: out.append(np.array(poly))
    return out

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    ab = b - a; n = np.hypot(*ab)
    v = pts - a
    if n < 1e-9: d = np.hypot(*v.T)
    else: d = np.abs(ab[0] * v[:, 1] - ab[1] * v[:, 0]) / n
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])

def simplify_closed(p, eps):
    # split at the two farthest points to apply RDP on a closed ring
    i = 0; j = int(np.argmax(np.hypot(*(p - p[0]).T)))
    a = rdp(p[i:j + 1], eps); b = rdp(np.vstack([p[j:], p[:1]]), eps)
    return np.vstack([a[:-1], b[:-1]])

def smooth_closed(p, step=1.5, sigma=1.6):
    """Resample a closed contour to ~uniform spacing and Gaussian-smooth it along its length."""
    q = np.vstack([p, p[:1]])
    seg = np.hypot(*np.diff(q, axis=0).T)
    L = float(seg.sum())
    n = max(16, int(L / step))
    s_ = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, L, n, endpoint=False)
    x = np.interp(t, s_, q[:, 0]); y = np.interp(t, s_, q[:, 1])
    r = int(math.ceil(sigma * 3)); k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * sigma * sigma)); k /= k.sum()
    def circ(v):
        vv = np.concatenate([v[-r:], v, v[:r]])
        return np.convolve(vv, k, mode='valid')
    return np.stack([circ(x), circ(y)], 1)

def inside(pt, poly):
    x, y = pt; xs, ys = poly[:, 0], poly[:, 1]
    xj, yj = np.roll(xs, 1), np.roll(ys, 1)
    c = ((ys > y) != (yj > y)) & (x < (xj - xs) * (y - ys) / (yj - ys + 1e-12) + xs)
    return bool(c.sum() % 2)

def area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

def main():
    src, out = sys.argv[1], sys.argv[2]
    scale = int(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else 6
    os.makedirs(out, exist_ok=True)
    im = Image.open(src).convert('RGB')
    big = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
    a = np.asarray(big).astype(np.float32) / 255.0
    h, s, v = rgb2hsv(a)
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    def soft(x, lo, hi):  # 0 below lo, 1 above hi
        return np.clip((x - lo) / (hi - lo), 0, 1)
    sat = soft(s, 0.25, 0.45) * soft(v, 0.25, 0.4)
    def hue_w(c, w):
        d = np.abs(((h - c + 180) % 360) - 180)
        return np.clip(1 - (d - w) / 12.0, 0, 1)
    fields = {
        'ink':    soft(0.62 - lum, 0.0, 0.18) * (1 - sat),
        'green':  sat * hue_w(80, 22),
        'yellow': sat * hue_w(44, 12),
        'red':    sat * np.maximum(hue_w(358, 14), hue_w(5, 10)),
    }
    res = {'scale': scale, 'src_size': [im.width, im.height], 'size': [big.width, big.height], 'layers': []}
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {big.width} {big.height}">',
           f'<rect width="100%" height="100%" fill="#ffffff"/>']
    srcarr = np.asarray(im).astype(np.float32)
    for name, F in fields.items():
        F = gauss_blur(F, scale * 0.55)
        polys = marching_squares(F, 0.5)
        polys = [simplify_closed(smooth_closed(p, 1.5, 1.6), 0.12 * scale) for p in polys]
        polys = [p for p in polys if abs(area(p)) > (scale * 3) ** 2]
        # colour = median of source pixels inside the layer core
        core = gauss_blur(fields[name], 0) > 0.9
        small = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).resize((im.width, im.height), Image.BOX)) > 250
        col = np.median(srcarr[small], axis=0) if small.sum() > 20 else np.array([0, 0, 0])
        hexc = '#%02x%02x%02x' % tuple(int(round(c)) for c in col)
        # shapes = outer contours with their holes (opposite winding, contained)
        A = [area(p) for p in polys]
        sgn = 1 if max(A, key=abs) > 0 else -1
        outers = [i for i, a_ in enumerate(A) if a_ * sgn > 0]
        holes = [i for i, a_ in enumerate(A) if a_ * sgn < 0]
        shapes = []
        for i in outers:
            shapes.append({'outer': i, 'holes': [], 'bbox': [float(polys[i][:, 0].min()), float(polys[i][:, 1].min()), float(polys[i][:, 0].max()), float(polys[i][:, 1].max())]})
        for j in holes:
            cands = [sh for sh in shapes if inside(polys[j][0], polys[sh['outer']])]
            if cands:
                best = min(cands, key=lambda sh: abs(A[sh['outer']]))
                best['holes'].append(j)
        R = lambda p: [[round(float(x), 2), round(float(y), 2)] for x, y in p]
        layer = {'name': name, 'color': hexc,
                 'shapes': [{'outer': R(polys[sh['outer']]), 'holes': [R(polys[j]) for j in sh['holes']], 'bbox': [round(v_, 1) for v_ in sh['bbox']]} for sh in shapes]}
        res['layers'].append(layer)
        d = ' '.join('M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in p) + ' Z' for p in polys)
        svg.append(f'<path fill="{hexc}" fill-rule="evenodd" d="{d}"/>')
        print(name, hexc, 'polys', len(polys), 'shapes', len(layer['shapes']), 'pts', sum(len(p) for p in polys))
    svg.append('</svg>')
    json.dump(res, open(os.path.join(out, 'logo_vec.json'), 'w'))
    open(os.path.join(out, 'logo_vec.svg'), 'w').write('\n'.join(svg))

if __name__ == '__main__':
    main()
