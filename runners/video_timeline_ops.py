from .media import get_video_info
from .media_torch import torch_process_video
from .keying import _SideSource, _luma


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


__all__ = ['luma_wipe_videos']
