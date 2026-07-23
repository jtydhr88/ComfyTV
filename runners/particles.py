import json
import math

import numpy as np

PARTICLE_EMITTERS = ['point', 'line', 'rect', 'circle', 'mask_edge']
PARTICLE_SPRITES = ['glow', 'spark', 'star']
PARTICLE_RENDERERS = ['sprite', 'stretched', 'trail']
PARTICLE_BLENDS = ['additive', 'over']
PARTICLE_COLLIDES = ['none', 'bounce', 'die']
PARTICLE_SUB_MODES = ['none', 'on_death', 'on_collide']

TRAIL_LEN = 5
_SPRITE_BASE = 64
_PYRAMID_SIZES = [3, 5, 7, 9, 13, 17, 23, 31, 41, 55, 73, 97, 129]

_FIELDS = ('x', 'y', 'vx', 'vy', 'age', 'life', 'size0', 'size1', 'hue',
           'kind') + tuple(f'hx{i}' for i in range(1, TRAIL_LEN + 1)) \
    + tuple(f'hy{i}' for i in range(1, TRAIL_LEN + 1))


def _hash_u(ids, seed, k):
    h = (ids.astype(np.uint64) * np.uint64(2654435761)
         ^ np.uint64((int(seed) + 1) * 40503)
         ^ np.uint64((k + 1) * 2246822519))
    h = (h ^ (h >> np.uint64(13))) * np.uint64(0x5bd1e995)
    h = h ^ (h >> np.uint64(15))
    return (h & np.uint64(0xffffff)).astype(np.float64) / float(0xffffff)


def _sprite_texture(kind: str, size: int) -> np.ndarray:
    r = size / 2.0
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    dx = (xs - r + 0.5) / r
    dy = (ys - r + 0.5) / r
    d = np.sqrt(dx * dx + dy * dy)
    if kind == 'spark':
        core = np.exp(-(d * 3.2) ** 2)
        halo = np.exp(-(d * 1.4) ** 2) * 0.25
        tex = core + halo
    elif kind == 'star':
        ang = np.arctan2(dy, dx)
        spikes = np.abs(np.cos(ang * 2)) ** 6
        tex = np.exp(-(d * 2.0) ** 2) * (0.35 + 0.65 * spikes)
    else:
        tex = np.exp(-(d * 1.8) ** 2)
    tex = np.clip(tex, 0, 1)
    tex[d > 1.0] = 0.0
    return tex.astype(np.float32)


def _sprite_pyramid(kind: str):
    return {s: _sprite_texture(kind, s) for s in _PYRAMID_SIZES}


def _hex_rgb(s):
    s = (s or '#ffffff').lstrip('#')
    return np.array([int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4)],
                    dtype=np.float32)


def parse_curve(raw):
    if isinstance(raw, list):
        keys = raw
    else:
        try:
            keys = json.loads(raw) if (raw or '').strip() else []
        except (ValueError, TypeError):
            keys = []
    out = []
    for k in keys if isinstance(keys, list) else []:
        try:
            out.append((float(k['t']), float(k['v'])))
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(out) if len(out) >= 2 else None


def sample_curve(keys, frac):
    if frac <= keys[0][0]:
        return keys[0][1]
    if frac >= keys[-1][0]:
        return keys[-1][1]
    for i in range(len(keys) - 1):
        t0, v0 = keys[i]
        t1, v1 = keys[i + 1]
        if t0 <= frac <= t1:
            u = (frac - t0) / max(1e-9, t1 - t0)
            s = u * u * (3 - 2 * u)
            return v0 + (v1 - v0) * s
    return keys[-1][1]


def _curve_lut(keys, n=64):
    return np.array([sample_curve(keys, i / (n - 1)) for i in range(n)],
                    dtype=np.float64)


class ParticleSim:
    def __init__(self, params, w, h, fps):
        self.p = params
        self.w = w
        self.h = h
        self.fps = max(1.0, float(fps))
        self.dt = 1.0 / self.fps
        self.t = None
        self.next_id = 0
        self.emit_acc = 0.0
        self.parts = {k: np.zeros(0, dtype=np.float64) for k in _FIELDS}
        self.seed = int(params.get('seed', 7))
        from .procedural import perm_table
        self.perm = perm_table(self.seed)
        self.sprites = _sprite_pyramid(params.get('sprite') or 'glow')
        self.c0 = _hex_rgb(params.get('color0') or '#FFD27A')
        self.c1 = _hex_rgb(params.get('color1') or '#FF5A2A')
        self.sub_c = _hex_rgb(params.get('sub_color') or '#FFF2B0')
        self.mask_pts = None
        size_keys = parse_curve(params.get('size_curve'))
        self.size_lut = _curve_lut(size_keys) if size_keys else None
        op_keys = parse_curve(params.get('opacity_curve'))
        self.op_lut = _curve_lut(op_keys) if op_keys else None

    def set_mask_edges(self, pts):
        self.mask_pts = pts if pts is not None and len(pts) else None

    def _append(self, st, n):
        for k in _FIELDS:
            if k in st:
                v = st[k]
            elif k.startswith('hx'):
                v = st['x'].copy()
            elif k.startswith('hy'):
                v = st['y'].copy()
            else:
                v = np.zeros(n, dtype=np.float64)
            self.parts[k] = np.concatenate([self.parts[k], v])

    def _emit(self, n):
        if n <= 0:
            return
        p = self.p
        ids = np.arange(self.next_id, self.next_id + n, dtype=np.int64)
        self.next_id += n
        u = [_hash_u(ids, self.seed, k) for k in range(8)]
        w, h = self.w, self.h
        emitter = p.get('emitter') or 'point'
        x0 = float(p.get('e_x0', 0.5)) * w
        y0 = float(p.get('e_y0', 0.85)) * h
        x1 = float(p.get('e_x1', 0.5)) * w
        y1 = float(p.get('e_y1', 0.85)) * h
        if emitter == 'line':
            x = x0 + (x1 - x0) * u[0]
            y = y0 + (y1 - y0) * u[0]
        elif emitter == 'rect':
            xa, xb = min(x0, x1), max(x0, x1)
            ya, yb = min(y0, y1), max(y0, y1)
            x = xa + (xb - xa) * u[0]
            y = ya + (yb - ya) * u[1]
        elif emitter == 'circle':
            radius = max(1.0, math.hypot(x1 - x0, y1 - y0))
            ang0 = u[0] * 2 * math.pi
            x = x0 + np.cos(ang0) * radius
            y = y0 + np.sin(ang0) * radius
        elif emitter == 'mask_edge' and self.mask_pts is not None:
            idx = np.minimum((u[0] * len(self.mask_pts)).astype(np.int64),
                             len(self.mask_pts) - 1)
            x = self.mask_pts[idx, 0].astype(np.float64)
            y = self.mask_pts[idx, 1].astype(np.float64)
        else:
            x = np.full(n, x0)
            y = np.full(n, y0)
        speed = float(p.get('speed', 120.0)) * (0.5 + u[2])
        direction = math.radians(float(p.get('direction', -90.0)))
        spread = math.radians(max(0.0, float(p.get('spread', 30.0))))
        ang = direction + (u[3] - 0.5) * spread * 2
        life = max(0.1, float(p.get('lifetime', 2.0))) * (0.6 + 0.8 * u[4])
        base_size = max(1.0, float(p.get('size', 12.0)))
        s0 = base_size * (0.6 + 0.8 * u[5])
        s1 = s0 * float(p.get('size_end_ratio', 0.4))
        self._append({'x': x, 'y': y,
                      'vx': np.cos(ang) * speed, 'vy': np.sin(ang) * speed,
                      'age': np.zeros(n), 'life': life,
                      'size0': s0, 'size1': s1, 'hue': u[6],
                      'kind': np.zeros(n)}, n)

    def _emit_sub(self, px, py):
        n_src = len(px)
        if not n_src:
            return
        p = self.p
        count = max(0, min(30, int(p.get('sub_count', 8))))
        if count <= 0:
            return
        total = n_src * count
        ids = np.arange(self.next_id, self.next_id + total, dtype=np.int64)
        self.next_id += total
        u = [_hash_u(ids, self.seed, k + 20) for k in range(5)]
        x = np.repeat(px, count)
        y = np.repeat(py, count)
        speed = float(p.get('sub_speed', 120.0)) * (0.5 + u[0])
        ang = u[1] * 2 * math.pi
        life = max(0.1, float(p.get('sub_lifetime', 0.6))) \
            * (0.6 + 0.8 * u[2])
        base = max(1.0, float(p.get('size', 12.0))) \
            * float(p.get('sub_size_ratio', 0.5))
        s0 = base * (0.6 + 0.8 * u[3])
        self._append({'x': x, 'y': y,
                      'vx': np.cos(ang) * speed, 'vy': np.sin(ang) * speed,
                      'age': np.zeros(total), 'life': life,
                      'size0': s0, 'size1': s0 * 0.3, 'hue': u[4],
                      'kind': np.ones(total)}, total)

    def _filter(self, keep):
        for k in self.parts:
            self.parts[k] = self.parts[k][keep]

    def _step(self):
        p = self.p
        dt = self.dt
        self.emit_acc += float(p.get('rate', 120.0)) * dt
        n = int(self.emit_acc)
        self.emit_acc -= n
        self._emit(n)
        pt = self.parts
        sub_mode = p.get('sub_mode') or 'none'
        if pt['x'].size:
            pt['age'] += dt
            dead = pt['age'] >= pt['life']
            if sub_mode == 'on_death':
                dying = dead & (pt['kind'] < 0.5)
                if dying.any():
                    dx = pt['x'][dying].copy()
                    dy = pt['y'][dying].copy()
                    self._filter(~dead)
                    self._emit_sub(dx, dy)
                else:
                    self._filter(~dead)
            else:
                self._filter(~dead)
        if pt['x'].size:
            turb = float(p.get('turbulence', 0.0))
            if turb > 0:
                from .procedural import fbm3
                ts = max(8.0, float(p.get('turb_scale', 120.0)))
                fx = fbm3(pt['x'] / ts, pt['y'] / ts,
                          np.float64(self.t * 0.5), self.perm, octaves=2)
                fy = fbm3(pt['x'] / ts + 31.7, pt['y'] / ts + 17.3,
                          np.float64(self.t * 0.5 + 11.0), self.perm,
                          octaves=2)
                pt['vx'] += fx * turb * dt
                pt['vy'] += fy * turb * dt
            att = float(p.get('attract_strength', 0.0))
            swirl = float(p.get('swirl', 0.0))
            if att or swirl:
                ax = float(p.get('attract_x', 0.5)) * self.w
                ay = float(p.get('attract_y', 0.5)) * self.h
                rad = max(1.0, float(p.get('attract_radius', 0.5))
                          * min(self.w, self.h))
                dx = ax - pt['x']
                dy = ay - pt['y']
                d = np.sqrt(dx * dx + dy * dy)
                safe = np.maximum(d, 1e-6)
                factor = np.clip(1.0 - d / rad, 0.0, 1.0)
                ux = dx / safe
                uy = dy / safe
                pt['vx'] += ux * att * factor * dt
                pt['vy'] += uy * att * factor * dt
                if swirl:
                    pt['vx'] += -uy * swirl * factor * dt
                    pt['vy'] += ux * swirl * factor * dt
            pt['vx'] += float(p.get('wind', 0.0)) * dt
            pt['vy'] += float(p.get('gravity', 60.0)) * dt
            drag = min(0.99, max(0.0, float(p.get('drag', 0.1))))
            damp = max(0.0, 1.0 - drag * dt)
            pt['vx'] *= damp
            pt['vy'] *= damp
            for i in range(TRAIL_LEN, 1, -1):
                pt[f'hx{i}'] = pt[f'hx{i - 1}']
                pt[f'hy{i}'] = pt[f'hy{i - 1}']
            pt['hx1'] = pt['x'].copy()
            pt['hy1'] = pt['y'].copy()
            pt['x'] += pt['vx'] * dt
            pt['y'] += pt['vy'] * dt
            collide = p.get('collide') or 'none'
            if collide != 'none':
                floor = float(p.get('floor_y', 0.9)) * self.h
                hit = (pt['y'] >= floor) & (pt['vy'] > 0)
                if hit.any():
                    main_hit = hit & (pt['kind'] < 0.5)
                    hx = pt['x'][main_hit].copy()
                    hy = np.full(int(main_hit.sum()), floor)
                    if collide == 'bounce':
                        bounce = min(1.0, max(0.0,
                                              float(p.get('bounce', 0.5))))
                        pt['y'][hit] = 2 * floor - pt['y'][hit]
                        pt['vy'][hit] = -pt['vy'][hit] * bounce
                        pt['vx'][hit] *= 0.8
                    else:
                        keep = ~hit
                        self._filter(keep)
                    if sub_mode == 'on_collide':
                        self._emit_sub(hx, hy)
        self.t += dt

    def advance_to(self, t):
        if self.t is None:
            warmup = min(10.0, max(0.0, float(self.p.get('warmup', 1.0))))
            self.t = t - warmup
            steps = int(round(warmup / self.dt))
            for _ in range(steps):
                self._step()
        guard = 0
        while self.t < t - self.dt / 2 and guard < 240:
            self._step()
            guard += 1

    def snapshot(self):
        pt = self.parts
        frac = np.clip(pt['age'] / np.maximum(1e-6, pt['life']), 0, 1)
        if self.size_lut is not None:
            idx = np.minimum((frac * (len(self.size_lut) - 1)).astype(int),
                             len(self.size_lut) - 1)
            sizes = pt['size0'] * self.size_lut[idx]
        else:
            sizes = pt['size0'] + (pt['size1'] - pt['size0']) * frac
        if self.op_lut is not None:
            idx = np.minimum((frac * (len(self.op_lut) - 1)).astype(int),
                             len(self.op_lut) - 1)
            opac = np.clip(self.op_lut[idx], 0, 1)
        else:
            op0 = float(self.p.get('opacity_start', 1.0))
            op1 = float(self.p.get('opacity_end', 0.0))
            opac = np.clip(op0 + (op1 - op0) * frac, 0, 1)
        is_sub = pt['kind'] >= 0.5
        colors = (self.c0[None, :] * (1 - frac[:, None])
                  + self.c1[None, :] * frac[:, None])
        colors[is_sub] = self.sub_c[None, :]
        jitter = 0.85 + 0.3 * pt['hue'][:, None]
        colors = np.clip(colors * jitter, 0, 1)
        return frac, sizes, opac, colors

    def _stamp(self, layer, cx, cy, size_px, opac, color):
        tex = self.sprites[size_px]
        half = size_px // 2
        x0 = int(round(cx)) - half
        y0 = int(round(cy)) - half
        x1 = x0 + size_px
        y1 = y0 + size_px
        h, w = layer.shape[:2]
        sx0 = max(0, -x0)
        sy0 = max(0, -y0)
        sx1 = size_px - max(0, x1 - w)
        sy1 = size_px - max(0, y1 - h)
        if sx1 <= sx0 or sy1 <= sy0:
            return
        patch = tex[sy0:sy1, sx0:sx1, None] * opac * color
        layer[max(0, y0):max(0, y0) + (sy1 - sy0),
              max(0, x0):max(0, x0) + (sx1 - sx0)] += patch

    def render_layer(self, h, w):
        layer = np.zeros((h, w, 3), dtype=np.float32)
        pt = self.parts
        n = pt['x'].size
        if not n:
            return layer
        frac, sizes, opac, colors = self.snapshot()
        renderer = self.p.get('renderer') or 'sprite'
        stretch = min(3.0, max(0.0, float(self.p.get('stretch', 1.0))))
        trail_n = max(2, min(TRAIL_LEN, int(self.p.get('trail_len', 4))))
        keys = np.array(_PYRAMID_SIZES)
        for i in range(n):
            s = sizes[i]
            if s < 1.0 or opac[i] <= 0.003:
                continue
            size_px = int(keys[np.argmin(np.abs(keys - s * 2))])
            if renderer == 'stretched':
                vx = pt['vx'][i]
                vy = pt['vy'][i]
                sub = 3
                for k in range(sub + 1):
                    f = k / sub
                    self._stamp(layer,
                                pt['x'][i] - vx * self.dt * stretch * f * 2,
                                pt['y'][i] - vy * self.dt * stretch * f * 2,
                                size_px, opac[i] / (sub + 1) * 1.6,
                                colors[i])
            elif renderer == 'trail':
                self._stamp(layer, pt['x'][i], pt['y'][i], size_px,
                            opac[i], colors[i])
                for k in range(1, trail_n + 1):
                    fall = 1.0 - k / (trail_n + 1)
                    tsize = int(keys[np.argmin(
                        np.abs(keys - s * 2 * (0.4 + 0.6 * fall)))])
                    self._stamp(layer, pt[f'hx{k}'][i], pt[f'hy{k}'][i],
                                tsize, opac[i] * fall * 0.45, colors[i])
            else:
                self._stamp(layer, pt['x'][i], pt['y'][i], size_px,
                            opac[i], colors[i])
        return layer


def mask_edge_points(mask, threshold=0.5, cap=4000):
    m = mask > threshold
    if not m.any():
        return None
    inner = m.copy()
    inner[1:-1, 1:-1] = (m[1:-1, 1:-1] & m[:-2, 1:-1] & m[2:, 1:-1]
                         & m[1:-1, :-2] & m[1:-1, 2:])
    edge = m & ~inner
    ys, xs = np.nonzero(edge)
    if not len(xs):
        return None
    pts = np.stack([xs, ys], axis=1).astype(np.float64)
    if len(pts) > cap:
        step = len(pts) / cap
        idx = (np.arange(cap) * step).astype(np.int64)
        pts = pts[idx]
    return pts


def build_particles_fn(params, ctx=None):
    import torch

    info = (ctx or {}).get('info') or {}
    fps = float(info.get('fps') or 24.0)
    sims = {}

    def fn(img, t):
        key = (img.shape[0], img.shape[1])
        if key not in sims:
            sims[key] = ParticleSim(params, key[1], key[0], fps)
        sim = sims[key]
        sim.advance_to(float(t))
        layer = torch.from_numpy(sim.render_layer(key[0], key[1])
                                 ).to(img.device)
        if (params.get('blend') or 'additive') == 'over':
            a = layer.max(dim=-1, keepdim=True).values.clamp(0, 1)
            return (img * (1 - a) + layer.clamp(0, 1)).clamp(0, 1)
        return (img + layer).clamp(0, 1)

    return fn


def particles_video(view_url: str, mask_url: str, params, *,
                    mask_is_video=False, progress=None) -> str:
    import torch
    from PIL import Image
    import av as _av
    from .media import localize, get_video_info
    from .media_torch import torch_process_video

    info = get_video_info(view_url)
    fps = float(info.get('fps') or 24.0)
    sims = {}
    state = {'pts': None, 'container': None, 'decoder': None}

    if mask_is_video:
        state['container'] = _av.open(str(localize(mask_url)))
        state['decoder'] = state['container'].decode(
            state['container'].streams.video[0])
    else:
        src = Image.open(str(localize(mask_url))).convert('L')
        arr = np.asarray(src, dtype=np.float32) / 255.0
        state['static'] = arr

    def _mask_for(shape):
        if mask_is_video:
            try:
                frame = next(state['decoder'])
                arr = frame.to_ndarray(format='rgb24').astype(np.float32)
                state['last'] = arr.mean(axis=-1) / 255.0
            except StopIteration:
                pass
            m = state.get('last')
        else:
            m = state['static']
        if m is None:
            return None
        if m.shape != shape:
            img = Image.fromarray((m * 255).astype(np.uint8), mode='L')
            m = np.asarray(img.resize((shape[1], shape[0])),
                           dtype=np.float32) / 255.0
            if not mask_is_video:
                state['static'] = m
        return m

    def fn(img, t):
        key = (img.shape[0], img.shape[1])
        if key not in sims:
            sims[key] = ParticleSim(params, key[1], key[0], fps)
        sim = sims[key]
        m = _mask_for(key)
        if m is not None:
            sim.set_mask_edges(mask_edge_points(m))
        sim.advance_to(float(t))
        layer = torch.from_numpy(sim.render_layer(key[0], key[1])
                                 ).to(img.device)
        if (params.get('blend') or 'additive') == 'over':
            a = layer.max(dim=-1, keepdim=True).values.clamp(0, 1)
            return (img * (1 - a) + layer.clamp(0, 1)).clamp(0, 1)
        return (img + layer).clamp(0, 1)

    try:
        return torch_process_video(view_url, fn, progress=progress)
    finally:
        if state['container'] is not None:
            state['container'].close()


__all__ = ['PARTICLE_EMITTERS', 'PARTICLE_SPRITES', 'PARTICLE_RENDERERS',
           'PARTICLE_BLENDS', 'PARTICLE_COLLIDES', 'PARTICLE_SUB_MODES',
           'ParticleSim', 'build_particles_fn', 'particles_video',
           'mask_edge_points', 'parse_curve', 'sample_curve']
