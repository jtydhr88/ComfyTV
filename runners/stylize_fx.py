import math

from .media_torch import torch_process_video

ARTFX_MODES = ('cartoon', 'charcoal', 'emboss', 'halftone')
WATER_PHYSICS = ('water', 'jelly', 'sludge', 'super_sludge')
WAVE_ENVELOPES = ('parabolic', 'uniform')
WAVE_AXES = ('both', 'horizontal', 'vertical')

_MASK64 = (1 << 64) - 1
_LUMA = (0.2126, 0.7152, 0.0722)


def _mix64(z):
    z = (z + 0x9E3779B97F4A7C15) & _MASK64
    z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
    z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & _MASK64
    return (z ^ (z >> 31)) & _MASK64


def _rint(seed, frame, k, lo, hi):
    if hi <= lo:
        return lo
    h = _mix64((int(seed) + 1) * 0x9E3779B97F4A7C15)
    h = _mix64(h ^ ((int(frame) + 1) * 0xBF58476D1CE4E5B9))
    h = _mix64(h ^ ((int(k) + 1) * 0x94D049BB133111EB))
    return lo + h % (hi - lo + 1)


def _shift2(t, dy, dx):
    import torch
    return torch.roll(t, shifts=(dy, dx), dims=(0, 1))


def _luma_of(img):
    return (img[..., 0] * _LUMA[0] + img[..., 1] * _LUMA[1]
            + img[..., 2] * _LUMA[2])


def cartoon_frame(img, *, threshold=0.12, levels=8, diff_space=1):
    import torch

    d = max(1, min(4, int(diff_space)))
    pairs = ((0, -d, 0, d), (-d, 0, d, 0), (-d, -d, d, d), (-d, d, d, -d))
    max_err = torch.zeros_like(img[..., 0])
    for y1, x1, y2, x2 in pairs:
        diff = _shift2(img, y1, x1) - _shift2(img, y2, x2)
        max_err = torch.maximum(max_err, (diff * diff).sum(dim=-1))
    thr = max(0.001, float(threshold)) ** 2 * 3.0
    edge = (max_err > thr)
    n = max(2, min(32, int(levels)))
    flat = torch.floor(img * n) / n
    return torch.where(edge.unsqueeze(-1), torch.zeros_like(img), flat)


def charcoal_frame(img, *, scale=1.5, scatter=1, mix=0.0, invert=False):
    import torch

    d = max(1, min(4, int(scatter)))
    y = _luma_of(img)

    def at(dy, dx):
        return torch.roll(y, shifts=(-dy, -dx), dims=(0, 1))

    gy = (at(d, -d) + 2 * at(d, 0) + at(d, d)) \
        - (at(-d, -d) + 2 * at(-d, 0) + at(-d, d))
    gx = (at(-d, d) + 2 * at(0, d) + at(d, d)) \
        - (at(-d, -d) + 2 * at(0, -d) + at(d, -d))
    edge = (float(scale) * torch.sqrt(gy * gy + gx * gx)).clamp(0, 1)
    gray = edge if invert else 1.0 - edge
    m = max(0.0, min(1.0, float(mix)))
    chroma = img[..., :3] - y.unsqueeze(-1)
    return (gray.unsqueeze(-1) + chroma * m).clamp(0, 1)


def emboss_frame(img, *, azimuth_deg=135.0, elevation_deg=30.0, width=10.0):
    import torch

    az = math.radians(float(azimuth_deg) % 360.0)
    el = math.radians(max(0.0, min(90.0, float(elevation_deg))))
    w45 = max(1.0, min(40.0, float(width)))
    lx = math.cos(az) * math.cos(el)
    ly = math.sin(az) * math.cos(el)
    lz = math.sin(el)
    nz = 6.0 / w45
    y = _luma_of(img)

    def at(dy, dx):
        return torch.roll(y, shifts=(-dy, -dx), dims=(0, 1))

    nx = (at(-1, -1) + at(0, -1) + at(1, -1)
          - at(-1, 1) - at(0, 1) - at(1, 1))
    ny = (at(1, -1) + at(1, 0) + at(1, 1)
          - at(-1, -1) - at(-1, 0) - at(-1, 1))
    ndotl = nx * lx + ny * ly + nz * lz
    mag = torch.sqrt(nx * nx + ny * ny + nz * nz).clamp(min=1e-6)
    shade = (ndotl / mag).clamp(min=0.0)
    flat = (nx.abs() < 1e-6) & (ny.abs() < 1e-6)
    shade = torch.where(flat, torch.full_like(shade, lz), shade)
    return shade.unsqueeze(-1).expand_as(img).clamp(0, 1)


def halftone_frame(img, *, dot_radius=4.0, angle_c=15.0, angle_m=45.0,
                   angle_y=0.0):
    import torch

    h, w = img.shape[0], img.shape[1]
    device = img.device
    rad = max(1.0, min(10.0, float(dot_radius)))
    grid = 2.0 * rad * 1.414
    half = grid / 2.0
    ys = torch.arange(h, device=device, dtype=img.dtype)
    xs = torch.arange(w, device=device, dtype=img.dtype)
    gy, gx = torch.meshgrid(ys, xs, indexing='ij')
    out = torch.empty_like(img)
    neighbors = ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1))

    for ch, ang_deg in enumerate((angle_c, angle_m, angle_y)):
        a = math.radians(float(ang_deg))
        ca, sa = math.cos(a), math.sin(a)
        tx = gx * ca + gy * sa
        ty = -gx * sa + gy * ca
        tx0 = tx - torch.remainder(tx - half, grid) + half
        ty0 = ty - torch.remainder(ty - half, grid) + half
        f = torch.ones_like(tx)
        for mx, my in neighbors:
            ttx = tx0 + mx * grid
            tty = ty0 + my * grid
            ntx = ttx * ca - tty * sa
            nty = ttx * sa + tty * ca
            ix = ntx.long().clamp(0, w - 1)
            iy = nty.long().clamp(0, h - 1)
            val = img[..., ch][iy, ix]
            l = (1.0 - val * val) * half * 1.414
            r = torch.sqrt((gx - ntx) ** 2 + (gy - nty) ** 2)
            tt = ((l - r).clamp(0.0, 1.0))
            f2 = 1.0 - tt * tt * (3.0 - 2.0 * tt)
            f = torch.minimum(f, f2)
        out[..., ch] = f
    return out.clamp(0, 1)


def build_artfx_fn(params):
    mode = params.get('mode') or 'cartoon'
    if mode not in ARTFX_MODES:
        raise RuntimeError(f"artfx: unknown mode {mode!r}")

    def fn(img, t):
        if mode == 'cartoon':
            return cartoon_frame(
                img, threshold=float(params.get('threshold', 0.12)),
                levels=int(params.get('levels', 8)),
                diff_space=int(params.get('diff_space', 1)))
        if mode == 'charcoal':
            return charcoal_frame(
                img, scale=float(params.get('edge_scale', 1.5)),
                scatter=int(params.get('scatter', 1)),
                mix=float(params.get('color_mix', 0.0)),
                invert=bool(params.get('invert', False)))
        if mode == 'emboss':
            return emboss_frame(
                img, azimuth_deg=float(params.get('azimuth', 135.0)),
                elevation_deg=float(params.get('elevation', 30.0)),
                width=float(params.get('emboss_width', 10.0)))
        return halftone_frame(
            img, dot_radius=float(params.get('dot_radius', 4.0)),
            angle_c=float(params.get('angle_c', 15.0)),
            angle_m=float(params.get('angle_m', 45.0)),
            angle_y=float(params.get('angle_y', 0.0)))

    return fn


def glitch_frame(img, frame_idx, *, seed=7, chance=0.5, block_h=0.2,
                 shift=0.2, color_intensity=3):
    import torch

    h, w = img.shape[0], img.shape[1]
    max_block = max(1, int(h * max(0.01, min(1.0, float(block_h)))))
    max_shift = max(1, int(w * max(0.01, min(1.0, float(shift)))))
    ci = max(0, min(4, int(color_intensity)))
    pct = int(max(0.0, min(1.0, float(chance))) * 100)
    img8 = (img[..., :3] * 255.0).round().to(dtype=torch.uint8)
    y = 0
    blk = 0
    while y < h:
        bh = _rint(seed, frame_idx, blk * 8, 1, max_block)
        y2 = min(h, y + bh)
        if _rint(seed, frame_idx, blk * 8 + 1, 1, 100) <= pct:
            sh = _rint(seed, frame_idx, blk * 8 + 2, 1, max_shift)
            rows = torch.roll(img8[y:y2], shifts=sh, dims=1)
            how = _rint(seed, frame_idx, blk * 8 + 3, 0, ci)
            if how == 1:
                rows = 255 - rows
            elif how in (2, 3, 4):
                sc = torch.tensor(
                    [_rint(seed, frame_idx, blk * 8 + 4 + i, 0, 255)
                     for i in range(3)],
                    dtype=torch.uint8, device=img.device)
                if how == 2:
                    rows = rows | sc
                elif how == 3:
                    rows = rows ^ sc
                else:
                    rows = rows & sc
            img8[y:y2] = rows
        y = y2
        blk += 1
    return img8.to(dtype=img.dtype) / 255.0


def build_glitch_fn(params):
    state = {}

    def fn(img, t):
        key = (img.shape[0], img.shape[1], str(img.device))
        s = state.setdefault(key, {'frame': 0})
        idx = s['frame']
        s['frame'] = idx + 1
        return glitch_frame(
            img, idx, seed=int(params.get('seed', 7)),
            chance=float(params.get('chance', 0.5)),
            block_h=float(params.get('block_h', 0.2)),
            shift=float(params.get('shift', 0.2)),
            color_intensity=int(params.get('color_intensity', 3)))

    return fn


def kaleido_grid(h, w, *, segments=6, angle_deg=0.0, source_deg=0.0,
                 center_x=0.5, center_y=0.5, device='cpu'):
    import torch

    n = max(1, min(64, int(segments)))
    seg = 2.0 * math.pi / n
    start = math.radians(float(angle_deg))
    src_off = math.radians(float(source_deg))
    cx = float(center_x) * w
    cy = float(center_y) * h
    ys = torch.arange(h, device=device, dtype=torch.float32)
    xs = torch.arange(w, device=device, dtype=torch.float32)
    gy, gx = torch.meshgrid(ys, xs, indexing='ij')
    px = gx - cx
    py = gy - cy
    r = torch.sqrt(px * px + py * py)
    theta = torch.atan2(py, px) - start
    theta = torch.remainder(theta, 2.0 * math.pi)
    k = torch.remainder(theta, 2.0 * seg)
    folded = torch.where(k < seg, k, 2.0 * seg - k)
    phi = folded + start + src_off
    sx = (cx + r * torch.cos(phi)) / max(1, w - 1) * 2.0 - 1.0
    sy = (cy + r * torch.sin(phi)) / max(1, h - 1) * 2.0 - 1.0
    return torch.stack([sx, sy], dim=-1)


def build_kaleido_fn(params):
    import torch

    cache = {}

    def fn(img, t):
        key = (img.shape[0], img.shape[1], str(img.device))
        if key not in cache:
            cache[key] = kaleido_grid(
                img.shape[0], img.shape[1],
                segments=int(params.get('segments', 6)),
                angle_deg=float(params.get('angle', 0.0)),
                source_deg=float(params.get('source_angle', 0.0)),
                center_x=float(params.get('center_x', 0.5)),
                center_y=float(params.get('center_y', 0.5)),
                device=str(img.device))
        grid = cache[key].to(dtype=img.dtype)
        src = img.permute(2, 0, 1).unsqueeze(0)
        out = torch.nn.functional.grid_sample(
            src, grid.unsqueeze(0), mode='bilinear',
            padding_mode='reflection', align_corners=True)
        return out.squeeze(0).permute(1, 2, 0).clamp(0, 1)

    return fn


def wave_warp_frame(img, t, *, amplitude=16.0, frequency=3.0, speed=0.5,
                    axis='both', envelope='parabolic'):
    import torch

    h, w = img.shape[0], img.shape[1]
    device = img.device
    amp = max(0.0, min(200.0, float(amplitude)))
    freq = max(0.1, min(40.0, float(frequency)))
    ph = 2.0 * math.pi * float(speed) * t
    ys = torch.arange(h, device=device, dtype=img.dtype)
    xs = torch.arange(w, device=device, dtype=img.dtype)
    gy, gx = torch.meshgrid(ys, xs, indexing='ij')
    u = gx / max(1, w - 1)
    v = gy / max(1, h - 1)
    if envelope == 'parabolic':
        env_x = 4.0 * u * (1.0 - u)
        env_y = 4.0 * v * (1.0 - v)
    else:
        env_x = torch.ones_like(u)
        env_y = torch.ones_like(v)
    dx = torch.zeros_like(u)
    dy = torch.zeros_like(v)
    if axis in ('both', 'horizontal'):
        dx = amp * env_x * torch.sin(2.0 * math.pi * freq * v + ph)
    if axis in ('both', 'vertical'):
        dy = amp * env_y * torch.sin(2.0 * math.pi * freq * u + ph)
    sx = (gx + dx) / max(1, w - 1) * 2.0 - 1.0
    sy = (gy + dy) / max(1, h - 1) * 2.0 - 1.0
    grid = torch.stack([sx, sy], dim=-1)
    src = img.permute(2, 0, 1).unsqueeze(0)
    out = torch.nn.functional.grid_sample(
        src, grid.unsqueeze(0), mode='bilinear', padding_mode='reflection',
        align_corners=True)
    return out.squeeze(0).permute(1, 2, 0).clamp(0, 1)


def build_wave_warp_fn(params):
    axis = params.get('axis') or 'both'
    envelope = params.get('envelope') or 'parabolic'
    if axis not in WAVE_AXES:
        raise RuntimeError(f"wave warp: unknown axis {axis!r}")
    if envelope not in WAVE_ENVELOPES:
        raise RuntimeError(f"wave warp: unknown envelope {envelope!r}")

    def fn(img, t):
        return wave_warp_frame(
            img, t, amplitude=float(params.get('amplitude', 16.0)),
            frequency=float(params.get('frequency', 3.0)),
            speed=float(params.get('speed', 0.5)), axis=axis,
            envelope=envelope)

    return fn


_WATER_DENSITY = {'water': 4, 'jelly': 3, 'sludge': 6, 'super_sludge': 8}


def _blob_mask(h, w, cx, cy, radius, device, dtype):
    import torch

    ys = torch.arange(h, device=device, dtype=dtype)
    xs = torch.arange(w, device=device, dtype=dtype)
    gy, gx = torch.meshgrid(ys, xs, indexing='ij')
    return ((gx - cx) ** 2 + (gy - cy) ** 2 < radius * radius).to(dtype)


def build_water_fn(params):
    import torch

    physics = params.get('physics') or 'water'
    if physics not in WATER_PHYSICS:
        raise RuntimeError(f"water: unknown physics {physics!r}")
    density = _WATER_DENSITY[physics]
    damp = 1.0 - 2.0 ** (-density)
    rain = bool(params.get('rain', True))
    swirl = bool(params.get('swirl', False))
    rain_every = max(1, min(24, int(params.get('rain_every', 4))))
    amp = max(0.0, min(1.0, float(params.get('amplitude', 0.5))))
    height = amp * 600.0
    seed = int(params.get('seed', 7))
    state = {}

    def st_for(img):
        key = (img.shape[0], img.shape[1], str(img.device))
        if key not in state:
            z = torch.zeros(img.shape[0], img.shape[1], device=img.device,
                            dtype=img.dtype)
            state[key] = {'h0': z.clone(), 'h1': z.clone(), 'frame': 0,
                          'angle': 0.0}
        return state[key]

    def neighbor_sum(hf):
        acc = None
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                sh = torch.roll(hf, shifts=(dy, dx), dims=(0, 1))
                acc = sh if acc is None else acc + sh
        return acc

    def fn(img, t):
        s = st_for(img)
        h, w = img.shape[0], img.shape[1]
        radius = max(2.0, min(h, w) * 0.03)
        cur, prev = s['h0'], s['h1']
        f = s['frame']
        s['frame'] = f + 1

        if rain and f % rain_every == 0:
            cx = _rint(seed, f, 0, int(radius) + 1,
                       max(int(radius) + 2, w - int(radius) - 1))
            cy = _rint(seed, f, 1, int(radius) + 1,
                       max(int(radius) + 2, h - int(radius) - 1))
            cur += _blob_mask(h, w, cx, cy, radius * 0.5, img.device,
                              img.dtype) * height
        if swirl:
            ang = s['angle']
            cx = w / 2.0 + math.cos(ang) * 25.0 \
                + (float(params.get('swirl_x', 0.0))) * w
            cy = h / 2.0 + math.sin(ang) * 25.0 \
                + (float(params.get('swirl_y', 0.0))) * h
            s['angle'] = ang + 50.0 * math.pi / 1024.0
            cur += _blob_mask(h, w, cx, cy, radius * 0.5, img.device,
                              img.dtype) * height

        dx = cur - torch.roll(cur, shifts=-1, dims=1)
        dy = cur - torch.roll(cur, shifts=-1, dims=0)
        ys = torch.arange(h, device=img.device, dtype=img.dtype)
        xs = torch.arange(w, device=img.device, dtype=img.dtype)
        gy, gx = torch.meshgrid(ys, xs, indexing='ij')
        sx = (gx + dx / 8.0).clamp(0, w - 1) / max(1, w - 1) * 2.0 - 1.0
        sy = (gy + dy / 8.0).clamp(0, h - 1) / max(1, h - 1) * 2.0 - 1.0
        grid = torch.stack([sx, sy], dim=-1)
        src = img.permute(2, 0, 1).unsqueeze(0)
        out = torch.nn.functional.grid_sample(
            src, grid.unsqueeze(0), mode='bilinear', padding_mode='border',
            align_corners=True)

        new_h = neighbor_sum(cur) / 4.0 - prev
        new_h = new_h * damp
        s['h1'] = cur
        s['h0'] = new_h
        return out.squeeze(0).permute(1, 2, 0).clamp(0, 1)

    return fn


def build_light_graffiti_fn(params):
    import torch

    threshold = max(0.0, min(1.0, float(params.get('threshold', 0.9))))
    sum_thr = max(0.0, min(3.0, float(params.get('sum_threshold', 2.2))))
    decay = max(0.0, min(1.0, float(params.get('decay', 0.0))))
    gain = max(0.1, min(4.0, float(params.get('gain', 1.0))))
    state = {}

    def fn(img, t):
        key = (img.shape[0], img.shape[1], str(img.device))
        s = state.setdefault(key, {'mask': None})
        rgb = img[..., :3]
        hot = (rgb.max(dim=-1).values >= threshold) \
            & (rgb.sum(dim=-1) >= sum_thr)
        lit = rgb * hot.unsqueeze(-1)
        if s['mask'] is None:
            s['mask'] = lit
        else:
            s['mask'] = torch.maximum(s['mask'] * (1.0 - decay), lit)
        return torch.maximum(rgb, (s['mask'] * gain).clamp(0, 1))

    return fn


def _grain_blur(noise, size):
    import torch
    if size <= 0.05:
        return noise
    r = max(1, int(round(size * 2)))
    xs = torch.arange(-r, r + 1, dtype=noise.dtype, device=noise.device)
    k = torch.exp(-(xs * xs) / (2.0 * size * size))
    k = k / k.sum()
    src = noise.permute(2, 0, 1).unsqueeze(0)
    src = torch.nn.functional.conv2d(
        src, k.view(1, 1, 1, -1).expand(3, 1, 1, -1), padding=(0, r),
        groups=3)
    src = torch.nn.functional.conv2d(
        src, k.view(1, 1, -1, 1).expand(3, 1, -1, 1), padding=(r, 0),
        groups=3)
    out = src.squeeze(0).permute(1, 2, 0)
    return out / out.std().clamp(min=1e-6)


def build_regrain_fn(params):
    import torch

    size = max(0.0, min(4.0, float(params.get('grain_size', 0.8))))
    shadows = max(0.0, min(1.0, float(params.get('shadows', 0.3))))
    mids = max(0.0, min(1.0, float(params.get('midtones', 0.15))))
    highs = max(0.0, min(1.0, float(params.get('highlights', 0.05))))
    saturation = max(0.0, min(1.0, float(params.get('grain_sat', 0.4))))
    seed = int(params.get('seed', 7))
    state = {}

    def fn(img, t):
        key = (img.shape[0], img.shape[1], str(img.device))
        s = state.setdefault(key, {'frame': 0})
        frame = s['frame']
        s['frame'] = frame + 1
        gen = torch.Generator().manual_seed(
            _rint(seed, frame, 0, 0, (1 << 31) - 1))
        noise = torch.randn(img.shape[0], img.shape[1], 3, generator=gen)
        noise = noise.to(device=img.device, dtype=img.dtype)
        noise = _grain_blur(noise, size)
        mono = noise.mean(dim=-1, keepdim=True)
        noise = mono + (noise - mono) * saturation
        luma = _luma_of(img).unsqueeze(-1)
        band = (shadows * (1.0 - 2.0 * luma).clamp(min=0.0)
                + mids * (1.0 - (2.0 * luma - 1.0).abs())
                + highs * (2.0 * luma - 1.0).clamp(min=0.0))
        return (img[..., :3] + noise * band * 0.18).clamp(0, 1)

    return fn


def regrain_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_regrain_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


def artfx_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_artfx_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


def glitch_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_glitch_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


def kaleido_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_kaleido_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


def wave_warp_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_wave_warp_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


def water_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_water_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


def light_graffiti_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_light_graffiti_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


__all__ = ['ARTFX_MODES', 'WATER_PHYSICS', 'WAVE_ENVELOPES', 'WAVE_AXES',
           'cartoon_frame', 'charcoal_frame', 'emboss_frame',
           'halftone_frame', 'glitch_frame', 'kaleido_grid',
           'wave_warp_frame',
           'build_artfx_fn', 'build_glitch_fn', 'build_kaleido_fn',
           'build_wave_warp_fn', 'build_water_fn',
           'build_light_graffiti_fn', 'build_regrain_fn',
           'artfx_video', 'glitch_video', 'kaleido_video',
           'wave_warp_video', 'water_video', 'light_graffiti_video',
           'regrain_video']
