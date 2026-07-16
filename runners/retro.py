import math

from .media import get_video_info
from .media_torch import torch_process_video
from .keying import _SideSource, _luma

INT_MAX = 2147483647


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


def old_film_video(view_url: str, *, delta: int = 14, every: int = 20,
                   brightness_up: int = 20, brightness_down: int = 30,
                   brightness_every: int = 70, develop_up: int = 60,
                   develop_down: int = 20, develop_duration: int = 70,
                   lines_num: int = 5, line_width: int = 2,
                   lines_darker: int = 40, lines_lighter: int = 40,
                   progress=None) -> str:
    import torch

    info = get_video_info(view_url)
    duration = max(1e-6, float(info['duration']))
    fps = info['fps'] or 24
    line_state = {}

    def frame_fn(img, t):
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

    return torch_process_video(view_url, frame_fn, progress=progress)


def luma_wipe_videos(url_a: str, url_b: str, luma_url: str, *,
                     duration: float = 1.0, softness: float = 0.1,
                     invert: bool = False, progress=None) -> str:
    from .media import trim_video, concat_videos

    info_a = get_video_info(url_a)
    info_b = get_video_info(url_b)
    dur_a = max(0.1, float(info_a['duration'] or 0.1))
    dur_b = max(0.1, float(info_b['duration'] or 0.1))
    wipe_dur = max(0.1, min(float(duration), dur_a, dur_b))
    t0 = dur_a - wipe_dur
    soft = max(0.0, min(1.0, float(softness)))

    seg_a = trim_video(url_a, t0, dur_a) if t0 > 0.05 else url_a
    b_src = _SideSource(url_b)
    luma_src = _SideSource(luma_url)

    def frame_fn(img, t):
        import torch
        hw = (img.shape[0], img.shape[1])
        pos = min(1.0, max(0.0, t / wipe_dur))
        bt = b_src.at(t, img.device, hw)[..., :3]
        lm = luma_src.at(t, img.device, hw)
        weight = _luma(lm)
        if invert:
            weight = 1 - weight
        x = pos * (1.0 + soft)
        a = ((x - weight) / max(soft, 1e-6)).clamp(0, 1)
        value = a * a * (3 - 2 * a)
        v = value.unsqueeze(-1)
        return img * (1 - v) + bt * v

    try:
        wiped = torch_process_video(seg_a, frame_fn, progress=progress)
    finally:
        b_src.close()
        luma_src.close()

    parts = []
    if t0 > 0.05:
        parts.append(trim_video(url_a, 0.0, t0))
    parts.append(wiped)
    if dur_b - wipe_dur > 0.05:
        parts.append(trim_video(url_b, wipe_dur, dur_b))
    if len(parts) == 1:
        return parts[0]
    return concat_videos(parts)


__all__ = ['old_film_video', 'luma_wipe_videos']
