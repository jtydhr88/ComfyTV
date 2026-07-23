
import math

import numpy as np

from .media import get_video_info, localize
from .media_torch import torch_process_video


def _stamp(mask: np.ndarray, cx: float, cy: float, radius: float,
           hardness: float):
    h, w = mask.shape
    r = max(1.0, radius)
    x0 = max(0, int(cx - r - 1))
    x1 = min(w, int(cx + r + 2))
    y0 = max(0, int(cy - r - 1))
    y1 = min(h, int(cy + r + 2))
    if x1 <= x0 or y1 <= y0:
        return
    ys, xs = np.mgrid[y0:y1, x0:x1]
    d = np.hypot(xs - cx, ys - cy) / r
    inner = max(0.0, min(0.99, hardness))
    a = np.clip((1.0 - d) / max(1e-6, 1.0 - inner), 0.0, 1.0)
    a[d <= inner] = 1.0
    np.maximum(mask[y0:y1, x0:x1], a.astype(np.float32),
               out=mask[y0:y1, x0:x1])


def rasterize_stroke(points, w, h, radius=20.0, hardness=0.5) -> np.ndarray:
    mask = np.zeros((h, w), dtype=np.float32)
    pts = [(float(p['x']), float(p['y']), float(p.get('p', 1.0)))
           for p in points or []]
    if not pts:
        return mask
    if len(pts) == 1:
        x, y, p = pts[0]
        _stamp(mask, x, y, radius * max(0.05, p), hardness)
        return mask
    for i in range(len(pts) - 1):
        x0, y0, p0 = pts[i]
        x1, y1, p1 = pts[i + 1]
        dist = math.hypot(x1 - x0, y1 - y0)
        spacing = max(1.0, radius * 0.25)
        n = max(1, int(dist / spacing))
        for k in range(n + 1):
            f = k / max(1, n)
            _stamp(mask,
                   x0 + (x1 - x0) * f, y0 + (y1 - y0) * f,
                   radius * max(0.05, p0 + (p1 - p0) * f), hardness)
    return mask


def _hex_rgb(s):
    s = (s or '#FF0000').lstrip('#')
    return tuple(int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def paint_video(view_url: str, strokes, *, t_start=0.0, t_end=-1.0,
                reveal_url: str = "", progress=None) -> str:
    import torch

    info = get_video_info(view_url)
    w, h = info['width'], info['height']
    prepared = []
    for s in strokes or []:
        pts = s.get('points') or []
        if not pts:
            continue
        mask_np = rasterize_stroke(
            pts, w, h,
            radius=min(300.0, max(1.0, float(s.get('radius') or 20))),
            hardness=float(s.get('hardness') or 0.5))
        prepared.append({
            'mode': str(s.get('mode') or 'clone'),
            'mask': mask_np,
            'dx': float(s.get('dx') or 0.0),
            'dy': float(s.get('dy') or 0.0),
            'sigma': min(50.0, max(0.5, float(s.get('sigma') or 8.0))),
            'color': _hex_rgb(s.get('color')),
            'time_offset': float(s.get('time_offset') or 0.0),
            'time_absolute': float(s.get('time_absolute', -1.0)),
            'life_start': float(s.get('life_start', -1.0)),
            'life_end': float(s.get('life_end', -1.0)),
        })
    if not prepared:
        raise RuntimeError("paint: no strokes")

    needs_reveal = any(s['mode'] == 'reveal' for s in prepared)
    if needs_reveal and not (reveal_url or '').strip():
        raise RuntimeError(
            "paint: a reveal stroke needs a reveal video — wire one in")
    reveal_state = {'decoder': None, 'container': None, 'last': None}
    if needs_reveal:
        import av
        reveal_state['container'] = av.open(str(localize(reveal_url)))
        reveal_state['decoder'] = reveal_state['container'].decode(
            reveal_state['container'].streams.video[0])

    fps = info['fps'] or 24
    max_back = max((-s['time_offset'] for s in prepared
                    if s['mode'] == 'clone' and s['time_offset'] < 0
                    and s['time_absolute'] < 0), default=0.0)
    for s in prepared:
        if s['mode'] == 'clone' and s['time_offset'] > 0 and s['time_absolute'] < 0:
            raise RuntimeError(
                "paint: positive clone time offsets aren't supported — "
                "use an absolute source time instead"
            )
    history_len = int(max_back * fps * 1.5) + 4 if max_back > 0 else 0

    abs_frames = {}
    abs_times = sorted({s['time_absolute'] for s in prepared
                        if s['mode'] == 'clone' and s['time_absolute'] >= 0})
    if abs_times:
        import av
        src_path = localize(view_url)
        with av.open(str(src_path)) as c:
            vstream = c.streams.video[0]
            for at in abs_times:
                if vstream.time_base:
                    try:
                        c.seek(int(at / float(vstream.time_base)),
                               stream=vstream, any_frame=False, backward=True)
                    except Exception:
                        pass
                picked = None
                for frame in c.decode(vstream):
                    picked = frame
                    if frame.pts is not None and vstream.time_base and \
                            frame.pts * float(vstream.time_base) >= at:
                        break
                if picked is None:
                    raise RuntimeError(f"paint: no frame at absolute time {at}")
                arr = picked.to_ndarray(format='rgb24')
                abs_frames[at] = arr

    masks_t = {}

    def _mask_for(s, device):
        key = id(s)
        if key not in masks_t:
            masks_t[key] = torch.from_numpy(s['mask']).to(device).unsqueeze(-1)
        return masks_t[key]

    def _gauss_blur(img, sigma):
        r = max(1, int(sigma * 3))
        xs = torch.arange(-r, r + 1, dtype=torch.float32, device=img.device)
        k = torch.exp(-(xs ** 2) / (2 * sigma * sigma))
        k = (k / k.sum()).view(1, 1, 1, -1)
        c = img.permute(2, 0, 1).unsqueeze(0)
        pad = (r, r, 0, 0)
        c = torch.nn.functional.conv2d(
            torch.nn.functional.pad(c, pad, mode='reflect'),
            k.expand(c.shape[1], 1, 1, 2 * r + 1), groups=c.shape[1])
        pad = (0, 0, r, r)
        c = torch.nn.functional.conv2d(
            torch.nn.functional.pad(c, pad, mode='reflect'),
            k.view(1, 1, -1, 1).expand(c.shape[1], 1, 2 * r + 1, 1),
            groups=c.shape[1])
        return c.squeeze(0).permute(1, 2, 0)

    end = float(t_end) if (t_end is not None and float(t_end) > 0) else 1e12
    from collections import deque
    history = deque(maxlen=max(1, history_len))
    abs_tensors = {}

    def _clone_source(s, img, t):
        if s['time_absolute'] >= 0:
            key = s['time_absolute']
            if key not in abs_tensors:
                abs_tensors[key] = torch.from_numpy(
                    abs_frames[key].copy()).to(img.device).float() / 255.0
            src = abs_tensors[key]
            if src.shape[:2] != img.shape[:2]:
                src = src[:img.shape[0], :img.shape[1]]
            return src
        if s['time_offset'] < 0:
            target = t + s['time_offset']
            best = None
            for ht, harr in history:
                if ht <= target + 1e-4:
                    best = harr
            if best is None and history:
                best = history[0][1]
            if best is not None:
                return best.to(img.device).float() / 255.0
        return img

    def _shift(t_frame, dx, dy):
        h, w = t_frame.shape[0], t_frame.shape[1]
        ys = torch.clamp(
            torch.arange(h, device=t_frame.device) - int(round(dy)), 0, h - 1)
        xs = torch.clamp(
            torch.arange(w, device=t_frame.device) - int(round(dx)), 0, w - 1)
        return t_frame[ys][:, xs]

    def _reveal_frame(img):
        dec = reveal_state['decoder']
        if dec is not None:
            try:
                frame = next(dec)
                arr = frame.to_ndarray(format='rgb24')
                reveal_state['last'] = torch.from_numpy(
                    arr.astype(np.float32) / 255.0).to(img.device)
            except StopIteration:
                pass
        rv = reveal_state['last']
        if rv is None:
            return img
        if rv.shape[:2] != img.shape[:2]:
            rv = torch.nn.functional.interpolate(
                rv.permute(2, 0, 1).unsqueeze(0), size=img.shape[:2],
                mode='bilinear', align_corners=False
            ).squeeze(0).permute(1, 2, 0)
            reveal_state['last'] = rv
        return rv

    def frame_fn(img, t):
        if history_len > 0 and t <= end + max_back:
            history.append((t, (img.clamp(0, 1) * 255).byte().cpu()))
        reveal_now = _reveal_frame(img) if needs_reveal else None
        if t < t_start or t > end:
            return img
        out = img
        for s in prepared:
            if s['life_start'] >= 0 and t < s['life_start'] - 1e-6:
                continue
            if s['life_end'] >= 0 and t > s['life_end'] + 1e-6:
                continue
            m = _mask_for(s, img.device)
            if s['mode'] == 'clone':
                base = _clone_source(s, img, t)
                src = _shift(base, s['dx'], s['dy'])
                out = src * m + out * (1 - m)
            elif s['mode'] == 'reveal':
                out = reveal_now * m + out * (1 - m)
            elif s['mode'] == 'blur':
                out = _gauss_blur(out, s['sigma']) * m + out * (1 - m)
            elif s['mode'] == 'color':
                col = torch.tensor(s['color'], device=img.device,
                                   dtype=out.dtype).view(1, 1, 3)
                out = col * m + out * (1 - m)
        return out

    try:
        return torch_process_video(view_url, frame_fn, progress=progress)
    finally:
        if reveal_state['container'] is not None:
            reveal_state['container'].close()


__all__ = ['rasterize_stroke', 'paint_video']
