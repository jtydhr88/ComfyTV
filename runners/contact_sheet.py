from .media import localize, get_video_info, fresh_output_path, \
    path_to_view_url
from .media_filter import make_progress


def _format_tc(t, fps):
    frames = int(round((t - int(t)) * fps))
    s = int(t)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}.{frames:02d}"


def contact_sheet_image(view_url: str, *, cols: int = 4, rows: int = 4,
                        sheet_width: int = 1920, timecode: bool = True,
                        progress=None) -> str:
    import av
    from PIL import Image, ImageDraw

    c = max(1, min(12, int(cols)))
    r = max(1, min(12, int(rows)))
    n = c * r
    info = get_video_info(view_url)
    duration = float(info.get('duration') or 0.0)
    fps = info.get('fps') or 24
    if duration <= 0:
        raise RuntimeError("contact sheet: source has no duration")

    targets = [(i + 0.5) / n * duration for i in range(n)]
    sw = max(320, min(8192, int(sheet_width)))
    cell_w = sw // c
    cell_h = max(2, int(round(cell_w * info['height'] / info['width'])))
    pad = 2
    sheet = Image.new('RGB', (cell_w * c + pad * (c + 1),
                              cell_h * r + pad * (r + 1)), (16, 16, 16))
    draw = ImageDraw.Draw(sheet)

    src = localize(view_url)
    report = make_progress(progress, n, "sampling")
    grabbed = 0
    with av.open(str(src)) as container:
        stream = container.streams.video[0]
        for frame in container.decode(stream):
            if grabbed >= n:
                break
            t = (float(frame.pts * frame.time_base)
                 if frame.pts is not None else grabbed / fps)
            if t + 1e-6 < targets[grabbed]:
                continue
            img = frame.to_image().resize((cell_w, cell_h))
            col = grabbed % c
            row = grabbed // c
            x = pad + col * (cell_w + pad)
            y = pad + row * (cell_h + pad)
            sheet.paste(img, (x, y))
            if timecode:
                label = _format_tc(t, fps)
                tx, ty = x + 4, y + cell_h - 14
                draw.rectangle((tx - 2, ty - 1, tx + 6 * len(label) + 2,
                                ty + 11), fill=(0, 0, 0))
                draw.text((tx, ty), label, fill=(230, 230, 230))
            grabbed += 1
            report(grabbed)

    if grabbed == 0:
        raise RuntimeError("contact sheet: no frames decoded")
    out = fresh_output_path('.png')
    sheet.save(str(out))
    return path_to_view_url(out)


__all__ = ['contact_sheet_image']
