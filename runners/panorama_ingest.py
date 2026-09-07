import logging

from ._media_paths import fresh_output_path, localize, path_to_view_url

_log = logging.getLogger(__name__)

EQUIRECT_ASPECT = 2.0
ASPECT_TOLERANCE = 0.02


def ensure_equirect(view_url: str) -> tuple[str, str | None]:
    """Pad a panorama to a 2:1 frame so the sphere viewer maps it correctly.

    Returns (url, note); url is unchanged (and note None) when the image is
    already 2:1 or cannot be read."""
    try:
        from PIL import Image
        src = localize(view_url)
        with Image.open(str(src)) as im:
            w, h = im.size
            aspect = w / h if h else 0
            if not aspect or abs(aspect - EQUIRECT_ASPECT) <= ASPECT_TOLERANCE:
                return view_url, None
            if aspect < EQUIRECT_ASPECT:
                W, H = round(h * EQUIRECT_ASPECT), h
            else:
                W, H = w, round(w / EQUIRECT_ASPECT)
            canvas = Image.new("RGB", (W, H), (0, 0, 0))
            canvas.paste(im.convert("RGB"), ((W - w) // 2, (H - h) // 2))
            out = fresh_output_path(".png", "comfytv/panorama")
            canvas.save(out, format="PNG", compress_level=4)
    except Exception as e:  # noqa: BLE001
        _log.info("[ComfyTV/panorama] 2:1 check skipped for %s: %s", view_url, e)
        return view_url, None
    note = (f"panorama came back {w}x{h} ({aspect:.3f}:1), not the 2:1 equirectangular "
            f"frame the sphere viewer needs — letterboxed to {W}x{H}; the black band "
            f"marks the part of the sphere the workflow did not cover")
    return path_to_view_url(out), note
