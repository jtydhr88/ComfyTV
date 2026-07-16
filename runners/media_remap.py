
from fractions import Fraction

from .media import (
    localize, fresh_output_path, path_to_view_url, get_video_info,
    trim_video, concat_videos,
)
from .media_filter import filter_video, xfade_videos, XFADE_TRANSITIONS
from .keyframes import KeyframeCurve

_OUT_TB = Fraction(1, 90000)

SPEED_MIN = 0.05
SPEED_MAX = 20.0


def _speed_curve(keyframes, fallback=1.0) -> KeyframeCurve:
    keys = []
    for k in keyframes or []:
        try:
            keys.append({
                't': float(k['t']),
                'v': min(SPEED_MAX, max(SPEED_MIN, float(k.get('v', fallback)))),
                'interp': str(k.get('interp', 'smooth')),
            })
        except (TypeError, ValueError, KeyError):
            continue
    if not keys:
        keys = [{'t': 0.0, 'v': min(SPEED_MAX, max(SPEED_MIN, fallback)),
                 'interp': 'constant'}]
    return KeyframeCurve(keys, extrapolate='constant')


def _output_duration(curve: KeyframeCurve, src_duration: float) -> float:
    lo, hi = 0.0, src_duration / SPEED_MIN + 1.0
    for _ in range(64):
        mid = (lo + hi) / 2
        if curve.integrate(0.0, mid) < src_duration:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-4:
            break
    return (lo + hi) / 2


def time_remap(view_url: str, speed_keyframes, *, smooth_fps: int = 0,
               progress=None) -> str:
    import av

    if smooth_fps and smooth_fps > 0:
        view_url = filter_video(
            view_url, [('minterpolate', f'fps={int(smooth_fps)}:mi_mode=mci')],
            out_fps=int(smooth_fps), keep_audio=False, progress=progress)

    src = localize(view_url)
    info = get_video_info(view_url)
    fps = info['fps'] or 24
    curve = _speed_curve(speed_keyframes)
    out_dur = _output_duration(curve, info['duration'])
    n_out = max(1, int(out_dur * fps))
    out = fresh_output_path('.mp4')

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        w = in_v.width - (in_v.width % 2)
        h = in_v.height - (in_v.height % 2)
        enc = outp.add_stream('libx264', rate=round(fps))
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        enc.codec_context.time_base = _OUT_TB

        decoder = inp.decode(in_v)
        cur_frame = None
        cur_t = -1e9

        def _advance_to(target_t):
            nonlocal cur_frame, cur_t
            while cur_t < target_t - 1e-6:
                try:
                    f = next(decoder)
                except StopIteration:
                    break
                cur_t = float(f.pts * f.time_base) if f.pts is not None \
                    else cur_t + 1.0 / fps
                cur_frame = f
            return cur_frame

        src_t = 0.0
        prev_out_t = 0.0
        for i in range(n_out):
            t_out = i / fps
            src_t += curve.integrate(prev_out_t, t_out)
            prev_out_t = t_out
            f = _advance_to(min(src_t, info['duration']))
            if f is None:
                break
            nf = f.reformat(width=w, height=h, format='yuv420p')
            nf.pts = int(round(t_out / _OUT_TB))
            nf.time_base = _OUT_TB
            for pkt in enc.encode(nf):
                outp.mux(pkt)
            if progress is not None and i % 30 == 0:
                progress(i, n_out, "remapping")
        for pkt in enc.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


def render_sequence(segments, *, progress=None) -> str:
    segs = []
    for s in segments or []:
        url = (s.get('url') or '').strip()
        if not url:
            continue
        segs.append({
            'url': url,
            'in_s': max(0.0, float(s.get('in_s') or 0.0)),
            'out_s': float(s.get('out_s') or 0.0),
            'transition': str(s.get('transition') or 'cut'),
            'trans_dur': min(5.0, max(0.1, float(s.get('trans_dur') or 1.0))),
        })
    if not segs:
        raise RuntimeError("sequence: no segments")

    total = len(segs) * 2
    step = 0

    def _tick(text):
        nonlocal step
        step += 1
        if progress is not None:
            progress(min(step, total), total, text)

    clips = []
    for i, s in enumerate(segs):
        info = get_video_info(s['url'])
        out_s = s['out_s'] if s['out_s'] > s['in_s'] else float(info['duration'])
        if out_s - s['in_s'] < 0.05:
            raise RuntimeError(f"sequence: segment {i + 1} is shorter than 0.05s")
        if s['in_s'] <= 0.01 and out_s >= float(info['duration']) - 0.01:
            clips.append(s['url'])
        else:
            clips.append(trim_video(s['url'], s['in_s'], out_s))
        _tick(f"trim {i + 1}/{len(segs)}")

    groups = [[clips[0]]]
    joins = []
    for i in range(1, len(segs)):
        tr = segs[i]['transition']
        if tr == 'cut' or tr not in XFADE_TRANSITIONS:
            groups[-1].append(clips[i])
        else:
            joins.append((tr, segs[i]['trans_dur']))
            groups.append([clips[i]])

    def _render_group(g):
        if len(g) == 1:
            return g[0]
        return concat_videos(g)

    result = _render_group(groups[0])
    _tick("concat")
    for gi in range(1, len(groups)):
        tr, dur = joins[gi - 1]
        nxt = _render_group(groups[gi])
        result = xfade_videos(result, nxt, transition=tr, duration=dur)
        _tick(f"transition {gi}/{len(groups) - 1}")

    if result in (clips[0],) and len(groups) == 1 and len(groups[0]) == 1 \
            and result == segs[0]['url']:
        result = trim_video(result, 0.0,
                            float(get_video_info(result)['duration']))
    return result


__all__ = ['time_remap', 'render_sequence', 'SPEED_MIN', 'SPEED_MAX']
