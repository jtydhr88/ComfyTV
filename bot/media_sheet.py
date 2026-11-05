import base64
import io
import math
from typing import Optional

import av
from PIL import Image, ImageDraw

JPEG_QUALITY = 85


def jpeg(im: Image.Image, max_px: int) -> dict:
    im = im.convert("RGB")
    im.thumbnail((max_px, max_px))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=JPEG_QUALITY)
    return {"data": base64.b64encode(buf.getvalue()).decode("ascii"), "media_type": "image/jpeg"}


def video_duration(container) -> float:
    stream = container.streams.video[0]
    if stream.duration and stream.time_base:
        return float(stream.duration * stream.time_base)
    return container.duration / av.time_base if container.duration else 0.0


def video_frames(path: str, count: int, start: float = 0.0,
                 end: Optional[float] = None) -> tuple[list[tuple[float, Image.Image]], float]:
    with av.open(path) as container:
        if not container.streams.video:
            raise ValueError("the file has no video stream")
        stream = container.streams.video[0]
        duration = video_duration(container)
        end = min(end if end is not None else duration, duration)
        start = max(0.0, min(start, end))
        frames = []
        for at in [start + (end - start) * (i + 0.5) / count for i in range(count)]:
            container.seek(int(at / stream.time_base), stream=stream)
            for frame in container.decode(stream):
                if frame.time is None or frame.time >= at - 0.05:
                    frames.append((at, frame.to_image()))
                    break
    if not frames:
        raise ValueError("video has no frames")
    return frames, duration


def contact_sheet(frames: list[tuple[float, Image.Image]], size: int) -> Image.Image:
    cols = math.ceil(math.sqrt(len(frames)))
    rows = math.ceil(len(frames) / cols)
    cell = size // cols
    w, h = frames[0][1].size
    ch = round(cell * h / w)
    sheet = Image.new("RGB", (cell * cols, ch * rows))
    draw = ImageDraw.Draw(sheet)
    for i, (at, im) in enumerate(frames):
        x, y = (i % cols) * cell, (i // cols) * ch
        sheet.paste(im.convert("RGB").resize((cell, ch)), (x, y))
        draw.rectangle((x, y, x + 52, y + 16), fill="black")
        draw.text((x + 4, y + 2), f"{at:.1f}s", fill="white")
    return sheet
