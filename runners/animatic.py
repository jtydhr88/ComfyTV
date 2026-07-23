from fractions import Fraction

import numpy as np

from .media import fresh_output_path, localize, path_to_view_url

_OUT_TB = Fraction(1, 90000)

MAX_BOARDS = 500
MIN_BOARD_MS = 100
DEFAULT_BOARD_MS = 2000


_FONT_CANDIDATES = [
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/msyhbd.ttc',
    '/System/Library/Fonts/PingFang.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]


def _load_caption_font(size: int):
    from PIL import ImageFont
    for path in _FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def _wrap_caption(text: str, font, max_w: int) -> list[str]:
    lines: list[str] = []
    for para in text.splitlines():
        para = para.strip()
        if not para:
            continue
        cur = ''
        for ch in para:
            if font.getlength(cur + ch) > max_w and cur:
                lines.append(cur)
                cur = ch
            else:
                cur += ch
        if cur:
            lines.append(cur)
    return lines[:3]


def _burn_caption(rgb: np.ndarray, text: str) -> np.ndarray:
    from PIL import Image, ImageDraw
    h, w = rgb.shape[:2]
    size = max(12, h // 24)
    font = _load_caption_font(size)
    lines = _wrap_caption(text, font, int(w * 0.9))
    if not lines:
        return rgb
    im = Image.fromarray(rgb).convert('RGBA')
    band = Image.new('RGBA', im.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(band)
    line_h = int(size * 1.35)
    block_h = line_h * len(lines) + size // 2
    y0 = h - block_h - h // 40
    draw.rectangle([0, y0 - size // 4, w, y0 + block_h], fill=(0, 0, 0, 150))
    for i, line in enumerate(lines):
        lw = font.getlength(line)
        draw.text(((w - lw) / 2, y0 + i * line_h), line,
                  font=font, fill=(255, 255, 255, 255))
    out = Image.alpha_composite(im, band).convert('RGB')
    return np.ascontiguousarray(np.asarray(out))


def _board_frame(board: dict, w: int, h: int, blank: np.ndarray,
                 burn_captions: bool) -> np.ndarray:
    url = str(board.get('image_url') or '')
    rgb = _letterbox_rgb(localize(url), w, h) if url else blank
    if burn_captions:
        caption = str(board.get('caption') or '').strip()
        if caption:
            rgb = _burn_caption(rgb, caption)
    return rgb


def _board_duration_ms(board: dict) -> int:
    dur = int(board.get('duration_ms') or 0)
    if dur <= 0:
        dur = DEFAULT_BOARD_MS
    return max(MIN_BOARD_MS, dur)


def _validate(boards: list[dict], width: int, height: int, fps: int):
    if not boards:
        raise ValueError("no boards")
    if len(boards) > MAX_BOARDS:
        raise ValueError(f"too many boards ({len(boards)} > {MAX_BOARDS})")
    fps = min(60, max(1, int(fps)))
    w = max(64, min(4096, int(width))) // 2 * 2
    h = max(64, min(4096, int(height))) // 2 * 2
    return w, h, fps


def _letterbox_rgb(img_path, w: int, h: int) -> np.ndarray:
    from PIL import Image
    with Image.open(img_path) as im:
        im = im.convert('RGB')
        scale = min(w / im.width, h / im.height)
        nw = max(1, round(im.width * scale))
        nh = max(1, round(im.height * scale))
        im = im.resize((nw, nh), Image.LANCZOS)
        canvas = np.zeros((h, w, 3), np.uint8)
        x0 = (w - nw) // 2
        y0 = (h - nh) // 2
        canvas[y0:y0 + nh, x0:x0 + nw] = np.asarray(im)
    return np.ascontiguousarray(canvas)


def boards_to_animatic(boards: list[dict], *, width: int = 1280,
                       height: int = 720, fps: int = 24,
                       burn_captions: bool = False) -> str:
    import av
    from .media_filter import tag_bt709

    w, h, fps = _validate(boards, width, height, fps)
    blank = np.full((h, w, 3), 16, np.uint8)
    out = fresh_output_path('.mp4')
    with av.open(str(out), 'w') as outp:
        enc = outp.add_stream('libx264', rate=fps)
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        enc.codec_context.time_base = _OUT_TB
        tag_bt709(enc.codec_context)
        frame_idx = 0
        for b in boards:
            rgb = _board_frame(b, w, h, blank, burn_captions)
            n = max(1, round(_board_duration_ms(b) * fps / 1000))
            for _ in range(n):
                frame = av.VideoFrame.from_ndarray(rgb, format='rgb24')
                frame = frame.reformat(format='yuv420p', dst_colorspace='ITU709')
                frame.pts = int(round((frame_idx / fps) / _OUT_TB))
                frame.time_base = _OUT_TB
                for pkt in enc.encode(frame):
                    outp.mux(pkt)
                frame_idx += 1
        for pkt in enc.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


def boards_to_gif(boards: list[dict], *, width: int = 640, height: int = 360,
                  burn_captions: bool = False) -> str:
    from PIL import Image

    w, h, _ = _validate(boards, width, height, 24)
    blank = np.full((h, w, 3), 16, np.uint8)
    frames: list = []
    durations: list[int] = []
    for b in boards:
        rgb = _board_frame(b, w, h, blank, burn_captions)
        frames.append(Image.fromarray(rgb))
        durations.append(_board_duration_ms(b))

    out = fresh_output_path('.gif')
    frames[0].save(
        str(out), save_all=True, append_images=frames[1:],
        duration=durations, loop=0, optimize=True,
    )
    return path_to_view_url(out)
