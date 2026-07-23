import math

import numpy as np

from .media import localize, get_video_info
from .media_filter import make_progress
from .media_torch import torch_process_video


def _analyze_shifts(src, info, analyze_width=480):
    import av
    import cv2

    shifts = []
    prev = None
    scale_w = min(analyze_width, info['width'])
    scale_h = max(2, int(round(scale_w * info['height'] / info['width'])))
    with av.open(str(src)) as c:
        stream = c.streams.video[0]
        for frame in c.decode(stream):
            arr = frame.to_ndarray(format='rgb24')
            gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
            gray = cv2.resize(gray, (scale_w, scale_h),
                              interpolation=cv2.INTER_AREA)
            gray = np.float32(gray)
            if prev is None:
                shifts.append((0.0, 0.0))
            else:
                (dx, dy), _resp = cv2.phaseCorrelate(prev, gray)
                shifts.append((float(dx), float(dy)))
            prev = gray
    if not shifts:
        raise RuntimeError("360 stabilize: no frames decoded")
    yaw_d = np.array([-s[0] / scale_w * 2.0 * math.pi for s in shifts])
    pitch_d = np.array([s[1] / scale_h * math.pi for s in shifts])
    return np.cumsum(yaw_d), np.cumsum(pitch_d)


def _smooth_path(path, radius):
    if radius <= 0:
        return path.copy()
    xs = np.arange(-radius * 3, radius * 3 + 1)
    k = np.exp(-(xs * xs) / (2.0 * radius * radius))
    k = k / k.sum()
    padded = np.pad(path, (len(xs) // 2, len(xs) // 2), mode='edge')
    return np.convolve(padded, k, mode='valid')


def _rotation_grid(h, w, yaw, pitch, device, dtype):
    import torch

    xs = (torch.arange(w, device=device, dtype=dtype) + 0.5) / w
    ys = (torch.arange(h, device=device, dtype=dtype) + 0.5) / h
    gy, gx = torch.meshgrid(ys, xs, indexing='ij')
    lon = gx * 2.0 * math.pi - math.pi
    lat = math.pi / 2.0 - gy * math.pi

    cl = torch.cos(lat)
    vx = cl * torch.sin(lon)
    vy = torch.sin(lat)
    vz = cl * torch.cos(lon)

    cp, sp = math.cos(pitch), math.sin(pitch)
    vy2 = vy * cp - vz * sp
    vz2 = vy * sp + vz * cp
    cy, sy = math.cos(yaw), math.sin(yaw)
    vx3 = vx * cy + vz2 * sy
    vz3 = -vx * sy + vz2 * cy

    lon_s = torch.atan2(vx3, vz3)
    lat_s = torch.asin(vy2.clamp(-1.0, 1.0))
    u = (lon_s + math.pi) / (2.0 * math.pi)
    v = (math.pi / 2.0 - lat_s) / math.pi
    sx = (u % 1.0) * 2.0 - 1.0
    sy_ = v.clamp(0.0, 1.0) * 2.0 - 1.0
    return torch.stack([sx, sy_], dim=-1)


def stabilize_360_video(view_url: str, *, smoothing: int = 15,
                        strength: float = 1.0, progress=None) -> str:
    import torch

    info = get_video_info(view_url)
    src = localize(view_url)
    report = make_progress(progress,
                           max(1, int(info['duration'] * (info['fps'] or 24))),
                           "analyzing")
    yaw_path, pitch_path = _analyze_shifts(src, info)
    report(len(yaw_path) // 4)

    radius = max(1, min(120, int(smoothing)))
    k = max(0.0, min(1.0, float(strength)))
    yaw_corr = (_smooth_path(yaw_path, radius) - yaw_path) * k
    pitch_corr = (_smooth_path(pitch_path, radius) - pitch_path) * k

    counter = {'i': 0}

    def frame_fn(img, t):
        i = min(counter['i'], len(yaw_corr) - 1)
        counter['i'] += 1
        yaw = float(yaw_corr[i])
        pitch = float(pitch_corr[i])
        if abs(yaw) < 1e-6 and abs(pitch) < 1e-6:
            return img
        grid = _rotation_grid(img.shape[0], img.shape[1], yaw, pitch,
                              img.device, img.dtype)
        srcp = img.permute(2, 0, 1).unsqueeze(0)
        out = torch.nn.functional.grid_sample(
            srcp, grid.unsqueeze(0), mode='bilinear',
            padding_mode='border', align_corners=False)
        return out.squeeze(0).permute(1, 2, 0).clamp(0, 1)

    return torch_process_video(view_url, frame_fn, progress=progress)


__all__ = ['stabilize_360_video']
