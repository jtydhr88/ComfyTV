import json
import math

import numpy as np

from .media import localize, fresh_output_path, path_to_view_url, get_video_info
from .media_filter import make_progress
from .media_torch import _warp_frame
from .track_solve import solve_robust
from .tracker import track_points
from .stabilize import _contrast

from fractions import Fraction

_OUT_TB = Fraction(1, 90000)


def _load_mask(mask_url):
    from PIL import Image
    p = localize(mask_url)
    img = Image.open(str(p)).convert('L')
    return np.asarray(img, dtype=np.float32) / 255.0


def _ref_gray(view_url, t_ref, device):
    import av
    import torch
    src = localize(view_url)
    with av.open(str(src)) as c:
        v = c.streams.video[0]
        if v.time_base and t_ref > 0:
            try:
                c.seek(int(t_ref / float(v.time_base)),
                       stream=v, any_frame=False, backward=True)
            except Exception:
                pass
        picked = None
        for frame in c.decode(v):
            picked = frame
            if frame.pts is not None and v.time_base and \
                    frame.pts * float(v.time_base) >= t_ref:
                break
        if picked is None:
            raise RuntimeError("mask propagate: no reference frame")
        arr = picked.to_ndarray(format='rgb24').astype(np.float32) / 255.0
        t = torch.from_numpy(arr).to(device)
        return t[..., 0] * 0.299 + t[..., 1] * 0.587 + t[..., 2] * 0.114


def select_points_in_mask(mask, gray, max_points=24, patch=12):
    h, w = mask.shape
    step = max(patch * 2, min(h, w) // 12)
    candidates = []
    for cy in range(patch + 2, h - patch - 2, step):
        for cx in range(patch + 2, w - patch - 2, step):
            if mask[cy, cx] < 0.5:
                continue
            c = _contrast(gray, cx, cy, patch)
            candidates.append((c, cx, cy))
    candidates.sort(reverse=True)
    picked = []
    for c, cx, cy in candidates:
        if c < 0.1:
            continue
        if all(abs(cx - px) + abs(cy - py) >= step for px, py in picked):
            picked.append((cx, cy))
        if len(picked) >= max_points:
            break
    return picked


def propagate_mask_video(view_url: str, mask_url: str, *, t_ref: float = 0.0,
                         model: str = 'similarity', max_points: int = 24,
                         invert: bool = False, progress=None) -> str:
    import av
    import torch

    if model not in ('translation', 'similarity', 'perspective'):
        raise RuntimeError(f"mask propagate: unknown model {model!r}")

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    info = get_video_info(view_url)
    w = info['width'] - (info['width'] % 2)
    h = info['height'] - (info['height'] % 2)
    fps = info['fps'] or 24

    mask = _load_mask(mask_url)
    if mask.shape != (info['height'], info['width']):
        from PIL import Image
        img = Image.fromarray((mask * 255).astype(np.uint8))
        mask = np.asarray(img.resize((info['width'], info['height'])),
                          dtype=np.float32) / 255.0

    gray = _ref_gray(view_url, t_ref, device)
    pts = select_points_in_mask(mask, gray, max_points=max_points)
    min_pts = {'translation': 1, 'similarity': 2, 'perspective': 4}[model]
    if len(pts) < min_pts:
        raise RuntimeError(
            f"mask propagate: only {len(pts)} trackable points inside the mask "
            f"({model} needs {min_pts}) — try a bigger mask or more texture"
        )

    track = json.loads(track_points(
        view_url, [{'x': px, 'y': py} for px, py in pts],
        t_start=t_ref, progress=progress))
    tracks = track['tracks']
    times = [k['t'] for k in tracks[0]['x']]
    ref = np.array([[tr['x'][0]['v'], tr['y'][0]['v']] for tr in tracks])

    mask_t = torch.from_numpy(mask[:h, :w]).to(device).unsqueeze(-1)
    out = fresh_output_path('.mp4')

    with av.open(str(out), 'w') as outp:
        enc = outp.add_stream('libx264', rate=round(fps))
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        enc.codec_context.time_base = _OUT_TB

        def _emit(frame_np, t):
            if invert:
                frame_np = 1.0 - frame_np
            arr = (frame_np * 255).byte().cpu().numpy()
            rgb = np.ascontiguousarray(np.repeat(arr[..., None], 3, axis=2))
            frame = av.VideoFrame.from_ndarray(rgb, format='rgb24')
            frame = frame.reformat(format='yuv420p')
            frame.pts = int(round(t / _OUT_TB))
            frame.time_base = _OUT_TB
            for pkt in enc.encode(frame):
                outp.mux(pkt)

        ref_np = mask_t[..., 0].clamp(0, 1)
        k = 0
        while k / fps < times[0] - 0.5 / fps:
            _emit(ref_np, k / fps)
            k += 1

        last_m = None
        report = make_progress(progress, len(times), "propagating")
        for i, t in enumerate(times):
            cur = np.array([[tr['x'][i]['v'], tr['y'][i]['v']] for tr in tracks])
            conf = np.array([tr['confidence'][i]['v'] for tr in tracks])
            good = conf >= 0.15
            if good.sum() >= min_pts:
                p_ref = ref[good]
                p_cur = cur[good]
                if model == 'perspective':
                    M = np.asarray(solve_robust(p_ref, p_cur, 'perspective'))
                else:
                    g = p_ref.mean(axis=0)
                    m = solve_robust(p_ref - g, p_cur - g, model)
                    c_, s_ = math.cos(m['rotation']), math.sin(m['rotation'])
                    cr = np.array([[c_, -s_], [s_, c_]]) * m['scale']
                    M = np.eye(3)
                    M[:2, :2] = cr
                    M[:2, 2] = np.array([m['tx'], m['ty']]) + g - cr @ g
                last_m = M
            elif last_m is not None:
                M = last_m
            else:
                M = np.eye(3)

            warped = _warp_frame(mask_t, np.linalg.inv(M), device)
            _emit(warped[..., 0].clamp(0, 1), t)
            report(i + 1)
        for pkt in enc.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


__all__ = ['propagate_mask_video', 'select_points_in_mask']
