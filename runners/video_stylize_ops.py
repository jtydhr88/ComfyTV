import math

import numpy as np

from .media import get_video_info
from .media_torch import torch_process_video, _warp_frame, mat_transform_canonical
from .video_color_ops import LUMA_R, LUMA_G, LUMA_B

INT_MAX = 2147483647


def _gauss(img, sigma):
    import torch
    r = max(1, int(sigma * 2.5))
    xs = torch.arange(-r, r + 1, dtype=torch.float32, device=img.device)
    k = torch.exp(-(xs ** 2) / (2 * sigma * sigma))
    k = k / k.sum()
    c = img.permute(2, 0, 1).unsqueeze(0)
    c = torch.nn.functional.conv2d(
        torch.nn.functional.pad(c, (r, r, 0, 0), mode='reflect'),
        k.view(1, 1, 1, -1).expand(c.shape[1], 1, 1, 2 * r + 1),
        groups=c.shape[1])
    c = torch.nn.functional.conv2d(
        torch.nn.functional.pad(c, (0, 0, r, r), mode='reflect'),
        k.view(1, 1, -1, 1).expand(c.shape[1], 1, 2 * r + 1, 1),
        groups=c.shape[1])
    return c.squeeze(0).permute(1, 2, 0)


def glow_math(img, *, threshold=0.7, size=4.0, bloom_ratio=2.0,
              bloom_count=5, gain=1.0, mix=1.0):
    import torch

    thr = max(0.0, min(0.99, float(threshold)))
    count = max(1, min(8, int(bloom_count)))
    ratio = max(1.1, min(4.0, float(bloom_ratio)))
    base = max(0.5, min(50.0, float(size)))
    luma = (img[..., 0] * LUMA_R + img[..., 1] * LUMA_G
            + img[..., 2] * LUMA_B)
    m = ((luma - thr) / max(1e-6, 1.0 - thr)).clamp(0, 1).unsqueeze(-1)
    src = img * m
    bloom = torch.zeros_like(img)
    for i in range(count):
        bloom = bloom + _gauss(src, base * (ratio ** i))
    out = (img + bloom * (float(gain) / count)).clamp(0, 1)
    mv = max(0.0, min(1.0, float(mix)))
    return img * (1 - mv) + out * mv


def glow_video(view_url: str, *, threshold: float = 0.7, size: float = 4.0,
               bloom_ratio: float = 2.0, bloom_count: int = 5,
               gain: float = 1.0, mix: float = 1.0, progress=None) -> str:
    def frame_fn(img, t):
        return glow_math(img, threshold=threshold, size=size,
                         bloom_ratio=bloom_ratio, bloom_count=bloom_count,
                         gain=gain, mix=mix)

    return torch_process_video(view_url, frame_fn, progress=progress)


def god_rays_setup(width, height, *, translate_x=0.0, translate_y=0.0,
                   scale=1.4, rotate_deg=0.0, steps=5, decay=0.3):
    cx, cy = width / 2.0, height / 2.0
    n = 1 << max(1, min(7, int(steps)))
    col1 = 1.0
    col2 = max(0.001, min(1.0, float(decay)))
    weights = [col1 * (col2 / col1) ** (i / n) for i in range(n)]

    mats = []
    base_scale = max(0.2, float(scale))
    for i in range(n):
        f = i / n
        s = base_scale ** f
        m = mat_transform_canonical(
            float(translate_x) * f, -float(translate_y) * f, s, s, 0.0, 0.0,
            -math.radians(float(rotate_deg) * f), cx, cy)
        mats.append(np.linalg.inv(m))
    return mats, weights


def god_rays_frame(img, mats, weights, *, max_mode=False, mix=1.0):
    import torch

    acc = None
    for i, mat in enumerate(mats):
        wf = _warp_frame(img, mat, img.device) * weights[i]
        if max_mode:
            acc = wf if acc is None else torch.maximum(acc, wf)
        else:
            acc = wf if acc is None else acc + wf
    rays = acc if max_mode else acc / len(mats)
    mv = max(0.0, min(1.0, float(mix)))
    return (img * (1 - mv) + rays.clamp(0, 1) * mv)


def god_rays_video(view_url: str, *, translate_x: float = 0.0,
                   translate_y: float = 0.0, scale: float = 1.4,
                   rotate_deg: float = 0.0, steps: int = 5,
                   decay: float = 0.3, max_mode: bool = False,
                   mix: float = 1.0, progress=None) -> str:
    info = get_video_info(view_url)
    mats, weights = god_rays_setup(
        info['width'], info['height'], translate_x=translate_x,
        translate_y=translate_y, scale=scale, rotate_deg=rotate_deg,
        steps=steps, decay=decay)

    def frame_fn(img, t):
        return god_rays_frame(img, mats, weights, max_mode=max_mode, mix=mix)

    return torch_process_video(view_url, frame_fn, progress=progress)


class _MltRand:
    def __init__(self, init):
        init = int(init) & 0xffffffff
        self.x = (521288629 + init - ((init << 16) & 0xffffffff)) & 0xffffffff
        self.y = (362436069 - init + ((init << 16) & 0xffffffff)) & 0xffffffff

    def next(self):
        self.x = (18000 * (self.x & 65535) + (self.x >> 16)) & 0xffffffff
        self.y = (30903 * (self.y & 65535) + (self.y >> 16)) & 0xffffffff
        r = ((self.x << 16) & 0xffffffff) + (self.y & 65535)
        if r >= 0x80000000:
            r -= 0x100000000
        return abs(r)


class _CRand:
    def __init__(self, seed):
        self.state = int(seed) & 0xffffffff

    def next(self):
        self.state = (self.state * 1103515245 + 12345) & 0xffffffff
        return (self.state >> 16) & 0x7fff


def old_film_frame(img, t, *, duration, fps, line_state,
               delta: int = 14, every: int = 20,
               brightness_up: int = 20, brightness_down: int = 30,
               brightness_every: int = 70, develop_up: int = 60,
               develop_down: int = 20, develop_duration: int = 70,
               lines_num: int = 5, line_width: int = 2,
               lines_darker: int = 40, lines_lighter: int = 40):
    import torch

    h, w = img.shape[0], img.shape[1]
    pos = min(1.0, max(0.0, t / duration))
    frame_idx = int(round(t * fps))
    out = img

    rng = _CRand(int(pos * 10000))
    diffpic = 0
    d = max(1, int(delta))
    if delta:
        diffpic = rng.next() % d * 2 - d
    brightdelta = 0
    if (brightness_up + brightness_down) != 0:
        brightdelta = (rng.next() % (brightness_up + brightness_down)
                       - brightness_down)
    if rng.next() % 100 > every:
        diffpic = 0
    if rng.next() % 100 > brightness_every:
        brightdelta = 0
    develop_delta = 0.0
    if develop_duration > 0:
        uval = math.sin(2 * math.pi * ((frame_idx % develop_duration)
                                       / develop_duration))
        develop_delta = uval * (develop_up if uval > 0 else develop_down)

    if diffpic:
        shifted = torch.zeros_like(out)
        if diffpic > 0:
            shifted[:h - diffpic] = out[diffpic:]
        else:
            shifted[-diffpic:] = out[:h + diffpic]
        out = shifted
    adj = (brightdelta + develop_delta) / 255.0
    if adj:
        out = (out + adj).clamp(0, 1)

    if lines_num > 0 and line_width >= 1:
        out = out.clone()
        lighter = float(lines_lighter)
        darker = float(lines_darker)
        for ln in range(int(lines_num) - 1, -1, -1):
            mr = _MltRand(int(pos * 10000) + ln)
            ltype_fresh = mr.next() % 3 + 1
            xmid_fresh = int(w * mr.next() / INT_MAX)
            dx = mr.next() % max(1, int(line_width))
            ystart = mr.next() % h
            yend = mr.next() % h
            lighter += mr.next() % 30 - 15
            darker += mr.next() % 30 - 15
            if ln not in line_state:
                line_state[ln] = [xmid_fresh, ltype_fresh]
            xmid, ltype = line_state[ln]
            xmid += mr.next() % 11 - 5
            line_state[ln][0] = xmid
            if yend < ystart:
                yend = h
            if dx <= 0:
                continue
            x0 = max(0, xmid - dx)
            x1 = min(w, xmid + dx)
            if x1 <= x0 or yend <= ystart:
                continue
            xs = torch.arange(x0, x1, device=out.device,
                              dtype=torch.float32)
            diff = (1.0 - (xs - xmid).abs() / dx).clamp(0, 1)
            seg = out[ystart:yend, x0:x1]
            if ltype == 1:
                fac = 1.0 - diff.view(1, -1, 1) * (darker / 100.0)
                out[ystart:yend, x0:x1] = (seg * fac).clamp(0, 1)
            elif ltype == 2:
                dd = diff.view(1, -1, 1) * (lighter / 100.0)
                out[ystart:yend, x0:x1] = (seg + (1 - seg) * dd).clamp(0, 1)
            else:
                dd = diff.view(1, -1) * (lighter / 100.0)
                g = seg[..., 1]
                seg[..., 1] = (g + (1 - g) * dd).clamp(0, 1)
                out[ystart:yend, x0:x1] = seg
    return out


def old_film_video(view_url: str, *, delta: int = 14, every: int = 20,
                   brightness_up: int = 20, brightness_down: int = 30,
                   brightness_every: int = 70, develop_up: int = 60,
                   develop_down: int = 20, develop_duration: int = 70,
                   lines_num: int = 5, line_width: int = 2,
                   lines_darker: int = 40, lines_lighter: int = 40,
                   progress=None) -> str:
    info = get_video_info(view_url)
    duration = max(1e-6, float(info['duration']))
    fps = info['fps'] or 24
    line_state = {}

    def frame_fn(img, t):
        return old_film_frame(
            img, t, duration=duration, fps=fps, line_state=line_state,
            delta=delta, every=every, brightness_up=brightness_up,
            brightness_down=brightness_down,
            brightness_every=brightness_every, develop_up=develop_up,
            develop_down=develop_down, develop_duration=develop_duration,
            lines_num=lines_num, line_width=line_width,
            lines_darker=lines_darker, lines_lighter=lines_lighter)

    return torch_process_video(view_url, frame_fn, progress=progress)


__all__ = ['glow_video', 'god_rays_video', 'old_film_video',
           'glow_math', 'god_rays_setup', 'god_rays_frame', 'old_film_frame']
