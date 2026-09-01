from .media import fresh_output_path, localize, path_to_view_url
from ._audio_io import _AUDIO_RATE, _decode_audio_to_array
from .animatic import _load_caption_font

_CANVAS_W = 1568
_MARGIN = 24
_HEADER_H = 36
_THUMB_H_CAP = 260
_WAVE_H = 130
_RULER_H = 34
_GAP = 4

_BG = (18, 18, 22)
_FG = (235, 235, 235)
_DIM = (110, 110, 120)
_WAVE_BG = (28, 28, 34)
_WAVE = (140, 180, 255)
_SILENCE = (50, 80, 120, 120)

_SILENCE_MIN_S = 0.35
_SILENCE_ENV_RATE = 50


def _grab_frames(src, times):
    import av
    imgs = []
    with av.open(str(src)) as c:
        v = c.streams.video[0] if c.streams.video else None
        if v is None:
            raise RuntimeError(f"no video stream in {src}")
        tb = float(v.time_base) if v.time_base else 0.0
        for t in times:
            if tb:
                try:
                    c.seek(int(t / tb), stream=v, any_frame=False, backward=True)
                except Exception:
                    pass
            picked = None
            for frame in c.decode(v):
                picked = frame
                if frame.pts is None:
                    continue
                if tb and frame.pts * tb >= t:
                    break
            if picked is None:
                raise RuntimeError(f"no decodable frame at {t:.2f}s in {src}")
            imgs.append(picked.to_image())
    return imgs


def _rms_envelope(mono, samples):
    import numpy as np
    n = mono.shape[0]
    if n == 0 or samples < 1:
        return np.zeros(max(1, samples), dtype=np.float32)
    window = max(1, n // samples)
    usable = (n // window) * window
    env = np.sqrt((mono[:usable].reshape(-1, window) ** 2).mean(axis=1))
    if env.size < samples:
        env = np.pad(env, (0, samples - env.size))
    return env[:samples]


def _detect_silences(mono, start_s):
    env = _rms_envelope(mono, max(1, mono.shape[0] // (_AUDIO_RATE // _SILENCE_ENV_RATE)))
    peak = float(env.max())
    if peak <= 0:
        return []
    thr = max(0.004, peak * 0.05)
    quiet = env < thr
    step = 1.0 / _SILENCE_ENV_RATE
    spans, run_start = [], None
    for i, q in enumerate(quiet):
        if q and run_start is None:
            run_start = i
        elif not q and run_start is not None:
            if (i - run_start) * step >= _SILENCE_MIN_S:
                spans.append((start_s + run_start * step, start_s + i * step))
            run_start = None
    if run_start is not None and (quiet.size - run_start) * step >= _SILENCE_MIN_S:
        spans.append((start_s + run_start * step, start_s + quiet.size * step))
    return [(round(a, 2), round(b, 2)) for a, b in spans]


def _words_in_range(words, start, end):
    out = []
    for w in words or []:
        if not isinstance(w, dict):
            continue
        text = str(w.get('text') or '').strip()
        try:
            ws, we = float(w['start']), float(w['end'])
        except (KeyError, TypeError, ValueError):
            continue
        if text and we > start and ws < end:
            out.append((ws, we, text))
    return sorted(out)


def render_timeline_image(view_url, start=0.0, end=None, n_frames=10,
                          words=None):
    import numpy as np
    from PIL import Image, ImageDraw
    from .media import get_video_info

    src = localize(view_url)
    info = get_video_info(view_url)
    duration = float(info['duration'] or 0.0)
    start = max(0.0, float(start or 0.0))
    end = duration if end is None else float(end)
    if duration > 0:
        end = min(end, duration)
    if end <= start:
        raise RuntimeError(
            f"timeline: end ({end:.2f}s) must be > start ({start:.2f}s)")
    n_frames = max(2, min(int(n_frames or 10), 16))

    step = (end - start) / (n_frames - 1)
    pad = min(step / 2, 0.04)
    times = [min(start + i * step, end - pad) for i in range(n_frames)]
    thumbs = _grab_frames(src, times)

    mono = None
    if info['has_audio']:
        arr = _decode_audio_to_array(src)
        a0 = int(start * _AUDIO_RATE)
        a1 = min(arr.shape[1], int(end * _AUDIO_RATE))
        if a1 > a0:
            mono = arr[:, a0:a1].mean(axis=0)
    silences = _detect_silences(mono, start) if mono is not None else []

    span = _CANVAS_W - 2 * _MARGIN
    cell_w = (span - (n_frames - 1) * _GAP) // n_frames
    aspect = thumbs[0].width / thumbs[0].height
    thumb_h = min(int(round(cell_w / aspect)), _THUMB_H_CAP)
    thumb_w = min(int(round(thumb_h * aspect)), cell_w)

    word_rows = _words_in_range(words, start, end)
    label_h = 20 if word_rows else 0
    wave_y = _HEADER_H + thumb_h + 10 + label_h
    canvas_h = wave_y + _WAVE_H + _RULER_H
    canvas = Image.new('RGB', (_CANVAS_W, canvas_h), _BG)
    draw = ImageDraw.Draw(canvas, 'RGBA')
    header_font = _load_caption_font(19)
    small_font = _load_caption_font(13)

    name = getattr(src, 'name', str(src))
    draw.text((_MARGIN, 8),
              f"{name}   {start:.2f}s → {end:.2f}s   "
              f"({end - start:.2f}s, {n_frames} frames)",
              fill=_FG, font=header_font)

    for i, img in enumerate(thumbs):
        cell_x = _MARGIN + i * (cell_w + _GAP)
        scaled = img.convert('RGB').resize((thumb_w, thumb_h), Image.LANCZOS)
        canvas.paste(scaled, (cell_x + (cell_w - thumb_w) // 2, _HEADER_H))

    def time_to_x(t):
        return _MARGIN + int((t - start) / (end - start) * span)

    draw.rectangle((_MARGIN, wave_y, _MARGIN + span, wave_y + _WAVE_H),
                   fill=_WAVE_BG)
    for a, b in silences:
        draw.rectangle((time_to_x(a), wave_y, time_to_x(b), wave_y + _WAVE_H),
                       fill=_SILENCE)

    if mono is not None:
        env = _rms_envelope(mono, span)
        if env.max() > 0:
            env = env / env.max()
        mid_y = wave_y + _WAVE_H // 2
        max_amp = _WAVE_H // 2 - 6
        top = [(_MARGIN + x, mid_y - int(v * max_amp)) for x, v in enumerate(env)]
        bot = [(_MARGIN + x, mid_y + int(v * max_amp)) for x, v in enumerate(env)]
        draw.polygon(top + bot[::-1], fill=(*_WAVE, 60))
        draw.line(top, fill=_WAVE, width=1)
        draw.line(bot, fill=_WAVE, width=1)
    else:
        draw.text((_MARGIN + 8, wave_y + _WAVE_H // 2 - 8), 'no audio',
                  fill=_DIM, font=small_font)

    last_x = -9999
    for ws, we, text in word_rows:
        cx = (time_to_x(max(ws, start)) + time_to_x(min(we, end))) // 2
        if cx - last_x < 28:
            continue
        draw.line((cx, wave_y - 4, cx, wave_y), fill=_DIM, width=1)
        draw.text((cx + 2, wave_y - label_h), text, fill=_FG, font=small_font)
        last_x = cx

    ruler_y = wave_y + _WAVE_H + 2
    for i in range(7):
        frac = i / 6
        x = _MARGIN + int(frac * span)
        draw.line((x, ruler_y, x, ruler_y + 6), fill=_DIM, width=1)
        draw.text((max(_MARGIN, x - 20), ruler_y + 8),
                  f"{start + frac * (end - start):.2f}s",
                  fill=_DIM, font=small_font)

    out = fresh_output_path('.png', subfolder='comfytv/frames')
    canvas.save(str(out), 'PNG', optimize=True)
    return {
        'url': path_to_view_url(out),
        'start': round(start, 3),
        'end': round(end, 3),
        'n_frames': n_frames,
        'silences': [list(s) for s in silences],
    }


__all__ = ['render_timeline_image']
