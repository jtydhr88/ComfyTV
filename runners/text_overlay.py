
import os
import re
from pathlib import Path

import numpy as np

from .media_torch import torch_process_video

_ASSET_FONTS = Path(__file__).resolve().parent.parent / 'assets' / 'fonts'

_WINDOWS_FONTS = [
    ('msyh', r'C:\Windows\Fonts\msyh.ttc'),
    ('simhei', r'C:\Windows\Fonts\simhei.ttf'),
    ('arial', r'C:\Windows\Fonts\arial.ttf'),
    ('times', r'C:\Windows\Fonts\times.ttf'),
    ('impact', r'C:\Windows\Fonts\impact.ttf'),
]


def list_fonts() -> list:
    out = []
    if _ASSET_FONTS.exists():
        out += sorted(p.stem for p in _ASSET_FONTS.glob('*.ttf'))
    out += [name for name, path in _WINDOWS_FONTS if os.path.exists(path)]
    return out or ['default']


def _font_path(name: str):
    if name:
        p = _ASSET_FONTS / f'{name}.ttf'
        if p.exists():
            return str(p)
        for fname, path in _WINDOWS_FONTS:
            if fname == name and os.path.exists(path):
                return path
    for p in sorted(_ASSET_FONTS.glob('*.ttf')):
        return str(p)
    for _, path in _WINDOWS_FONTS:
        if os.path.exists(path):
            return path
    return None


def render_text_rgba(text: str, *, font='', size=48, color='#FFFFFF',
                     stroke=0, stroke_color='#000000',
                     align='center', max_width=0) -> np.ndarray:
    from PIL import Image, ImageDraw, ImageFont

    path = _font_path(font)
    fnt = ImageFont.truetype(path, size=int(size)) if path \
        else ImageFont.load_default()

    probe = Image.new('RGBA', (8, 8))
    d = ImageDraw.Draw(probe)
    box = d.multiline_textbbox((0, 0), text, font=fnt, align=align,
                               stroke_width=int(stroke))
    w = max(2, box[2] - box[0] + 4)
    h = max(2, box[3] - box[1] + 4)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(img).multiline_text(
        (2 - box[0], 2 - box[1]), text, font=fnt, fill=color, align=align,
        stroke_width=int(stroke), stroke_fill=stroke_color)
    return np.asarray(img, dtype=np.uint8)


_ANCHORS = ('top-left', 'top', 'top-right', 'left', 'center', 'right',
            'bottom-left', 'bottom', 'bottom-right')


def _place(anchor, fw, fh, tw, th, margin=0.05):
    mx, my = int(fw * margin), int(fh * margin)
    xs = {'left': mx, 'center': (fw - tw) // 2, 'right': fw - tw - mx}
    ys = {'top': my, 'middle': (fh - th) // 2, 'bottom': fh - th - my}
    ax = 'center' if anchor in ('top', 'center', 'bottom') else \
        ('left' if 'left' in anchor else 'right')
    ay = 'top' if 'top' in anchor else ('bottom' if 'bottom' in anchor else 'middle')
    return xs[ax], ys[ay]


def _overlay_fn_factory(device):
    import torch

    def overlay(bg, rgba_np, x, y, opacity=1.0):
        th, tw = rgba_np.shape[0], rgba_np.shape[1]
        fh, fw = bg.shape[0], bg.shape[1]
        x0, y0 = max(0, int(x)), max(0, int(y))
        x1, y1 = min(fw, int(x) + tw), min(fh, int(y) + th)
        if x1 <= x0 or y1 <= y0:
            return bg
        sub = torch.from_numpy(
            rgba_np[y0 - int(y):y1 - int(y), x0 - int(x):x1 - int(x)].copy()
        ).to(device).float() / 255.0
        a = sub[..., 3:4] * opacity
        region = bg[y0:y1, x0:x1]
        bg[y0:y1, x0:x1] = sub[..., :3] * a + region * (1 - a)
        return bg

    return overlay


_TOKEN_RE = re.compile(r'#(timecode|frame|shorttimecode)#')


def _resolve_tokens(text, t, fps):
    def sub(m):
        name = m.group(1)
        total = int(round(t * fps))
        if name == 'frame':
            return str(total)
        hh = int(t // 3600)
        mm = int(t % 3600 // 60)
        ss = int(t % 60)
        ff = int(round((t - int(t)) * fps)) % max(1, int(round(fps)))
        if name == 'shorttimecode':
            return f'{mm:02d}:{ss:02d}'
        return f'{hh:02d}:{mm:02d}:{ss:02d}:{ff:02d}'
    return _TOKEN_RE.sub(sub, text)


def _typewriter_slice(text, t, t_start, mode, step_s):
    if mode not in ('char', 'word', 'line') or step_s <= 0:
        return text
    steps = max(0, int((t - t_start) / step_s))
    if mode == 'char':
        units = list(text)
        return ''.join(units[:steps])
    if mode == 'word':
        parts = re.split(r'(\s+)', text)
        words = [p for p in parts if p.strip()]
        shown = min(steps, len(words))
        count = 0
        out = []
        for p in parts:
            if p.strip():
                count += 1
                if count > shown:
                    break
            out.append(p)
        return ''.join(out)
    lines = text.split('\n')
    return '\n'.join(lines[:steps])


def title_video(view_url: str, text: str, *, font='', size=48,
                color='#FFFFFF', stroke=0, stroke_color='#000000',
                anchor='bottom', t_start=0.0, t_end=-1.0,
                fade_s=0.0, typewriter='', type_step: float = 0.1,
                progress=None) -> str:
    from .media import get_video_info

    if not (text or '').strip():
        raise RuntimeError("title: empty text")
    dynamic = bool(_TOKEN_RE.search(text)) or typewriter in (
        'char', 'word', 'line')
    fps = get_video_info(view_url)['fps'] or 24 if dynamic else 24
    t_end = None if t_end is None else float(t_end)
    cache = {}

    def rgba_for(txt):
        if txt not in cache:
            if len(cache) > 512:
                cache.clear()
            cache[txt] = render_text_rgba(
                txt, font=font, size=size, color=color,
                stroke=stroke, stroke_color=stroke_color)
        return cache[txt]

    static_rgba = None if dynamic else rgba_for(text)

    def frame_fn(bg, t):
        end = t_end if (t_end is not None and t_end > 0) else 1e12
        if t < t_start or t > end:
            return bg
        op = 1.0
        if fade_s > 0:
            op = min(op, (t - t_start) / fade_s)
            if end < 1e11:
                op = min(op, (end - t) / fade_s)
            op = max(0.0, min(1.0, op))
        if dynamic:
            txt = _resolve_tokens(text, t, fps)
            txt = _typewriter_slice(txt, t, t_start, typewriter,
                                    float(type_step))
            if not txt.strip():
                return bg
            rgba = rgba_for(txt)
        else:
            rgba = static_rgba
        overlay = _overlay_fn_factory(bg.device)
        x, y = _place(anchor, bg.shape[1], bg.shape[0],
                      rgba.shape[1], rgba.shape[0])
        return overlay(bg.clone(), rgba, x, y, op)

    return torch_process_video(view_url, frame_fn, progress=progress)


def parse_subtitles(raw: str) -> list:
    cues = []
    cur = None
    for line in (raw or '').replace('\r\n', '\n').split('\n'):
        line = line.strip('﻿').rstrip()
        if '-->' in line:
            m = re.findall(r'(?:(\d+):)?(\d\d):(\d\d)[,.](\d{1,3})', line)
            if len(m) >= 2:
                def to_s(g):
                    hh = int(g[0]) if g[0] else 0
                    return hh * 3600 + int(g[1]) * 60 + int(g[2]) \
                        + int(g[3].ljust(3, '0')) / 1000.0
                cur = {'start': to_s(m[0]), 'end': to_s(m[1]), 'text': ''}
                cues.append(cur)
            continue
        if cur is not None:
            if not line:
                cur = None
            elif not (line.isdigit() and not cur['text']):
                clean = re.sub(r'<[^>]+>', '', line)
                cur['text'] = (cur['text'] + '\n' + clean).strip()
    return [c for c in cues if c['text']]


def burn_subtitles(view_url: str, subs_raw: str, *, font='', size=36,
                   color='#FFFFFF', stroke=2, stroke_color='#000000',
                   anchor='bottom', progress=None) -> str:
    cues = parse_subtitles(subs_raw)
    if not cues:
        raise RuntimeError("subtitles: no cues parsed — check the SRT/VTT text")
    cache = {}

    def rgba_for(text):
        if text not in cache:
            cache[text] = render_text_rgba(
                text, font=font, size=size, color=color,
                stroke=stroke, stroke_color=stroke_color)
        return cache[text]

    def frame_fn(bg, t):
        active = next((c for c in cues if c['start'] <= t <= c['end']), None)
        if active is None:
            return bg
        rgba = rgba_for(active['text'])
        overlay = _overlay_fn_factory(bg.device)
        x, y = _place(anchor, bg.shape[1], bg.shape[0],
                      rgba.shape[1], rgba.shape[0])
        return overlay(bg.clone(), rgba, x, y, 1.0)

    return torch_process_video(view_url, frame_fn, progress=progress)


__all__ = ['list_fonts', 'render_text_rgba', 'title_video',
           'parse_subtitles', 'burn_subtitles']
