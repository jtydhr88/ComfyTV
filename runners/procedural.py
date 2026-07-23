import numpy as np

_GRAD3 = np.array([
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
], dtype=np.float32)


_MASK64 = (1 << 64) - 1


def perm_table(seed: int) -> np.ndarray:
    state = (int(seed) & 0x7fffffff) or 1
    p = list(range(256))
    for i in range(255, 0, -1):
        state = (state + 0x9E3779B97F4A7C15) & _MASK64
        z = state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & _MASK64
        z = z ^ (z >> 31)
        j = z % (i + 1)
        p[i], p[j] = p[j], p[i]
    arr = np.array(p, dtype=np.int64)
    return np.concatenate([arr, arr])


def _fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def perlin3(x, y, z, perm):
    xf0 = np.floor(x)
    yf0 = np.floor(y)
    zf0 = np.floor(z)
    xi = xf0.astype(np.int64) & 255
    yi = yf0.astype(np.int64) & 255
    zi = zf0.astype(np.int64) & 255
    xf = (x - xf0).astype(np.float32)
    yf = (y - yf0).astype(np.float32)
    zf = (z - zf0).astype(np.float32)
    u = _fade(xf)
    v = _fade(yf)
    w = _fade(zf)

    def corner(ox, oy, oz):
        hsh = perm[perm[perm[(xi + ox) & 255] + ((yi + oy) & 255)]
                   + ((zi + oz) & 255)] % 12
        g = _GRAD3[hsh]
        return (g[..., 0] * (xf - ox) + g[..., 1] * (yf - oy)
                + g[..., 2] * (zf - oz))

    def lerp(a, b, t):
        return a + t * (b - a)

    x00 = lerp(corner(0, 0, 0), corner(1, 0, 0), u)
    x10 = lerp(corner(0, 1, 0), corner(1, 1, 0), u)
    x01 = lerp(corner(0, 0, 1), corner(1, 0, 1), u)
    x11 = lerp(corner(0, 1, 1), corner(1, 1, 1), u)
    y0 = lerp(x00, x10, v)
    y1 = lerp(x01, x11, v)
    return lerp(y0, y1, w)


def fbm3(x, y, z, perm, octaves=4, lacunarity=2.0, gain=0.5,
         turbulence=False):
    out = np.zeros(np.broadcast(x, y).shape, dtype=np.float32)
    amp = 1.0
    total = 0.0
    px = np.asarray(x, dtype=np.float64)
    py = np.asarray(y, dtype=np.float64)
    pz = np.asarray(z, dtype=np.float64)
    for _ in range(max(1, int(octaves))):
        val = perlin3(px, py, pz, perm)
        out += (np.abs(val) if turbulence else val) * amp
        total += amp
        amp *= gain
        px = px * lacunarity + 1234.0
        py = py * lacunarity + 1234.0
        pz = pz * lacunarity + 1234.0
    return out / max(1e-6, total)


def _cell_hash(cx, cy, seed, k):
    h = (cx.astype(np.uint64) * np.uint64(73856093)
         ^ cy.astype(np.uint64) * np.uint64(19349663)
         ^ np.uint64((int(seed) + 1) * 83492791)
         ^ np.uint64((k + 1) * 2971215073))
    h = (h ^ (h >> np.uint64(13))) * np.uint64(0x5bd1e995)
    h = h ^ (h >> np.uint64(15))
    return (h & np.uint64(0xffffff)).astype(np.float64) / float(0xffffff)


def cellular2(x, y, phase, seed):
    xi = np.floor(x).astype(np.int64)
    yi = np.floor(y).astype(np.int64)
    best = np.full(np.broadcast(x, y).shape, np.inf, dtype=np.float64)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cx = xi + ox
            cy = yi + oy
            hx = _cell_hash(cx, cy, seed, 0)
            hy = _cell_hash(cx, cy, seed, 1)
            ang = 2 * np.pi * (hx + phase * (0.3 + 0.7 * hy))
            fx = cx + 0.5 + 0.38 * np.cos(ang)
            fy = cy + 0.5 + 0.38 * np.sin(ang)
            d = (x - fx) ** 2 + (y - fy) ** 2
            best = np.minimum(best, d)
    return np.clip(np.sqrt(best), 0.0, 1.0).astype(np.float32)


def plasma_field(xs, ys, t, scale):
    s = max(4.0, float(scale))
    cx = xs.max() / 2.0 if xs.size else 0.0
    cy = ys.max() / 2.0 if ys.size else 0.0
    v = (np.sin(xs / s + t)
         + np.sin(ys / (s * 0.9) + t * 1.3)
         + np.sin((xs + ys) / (s * 1.5) + t * 0.7)
         + np.sin(np.hypot(xs - cx, ys - cy) / s + t * 1.7))
    return ((v / 4.0) * 0.5 + 0.5).astype(np.float32)


__all__ = ['perm_table', 'perlin3', 'fbm3', 'cellular2', 'plasma_field']
