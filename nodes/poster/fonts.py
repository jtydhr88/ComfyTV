import base64
import os
from functools import lru_cache

SYSTEM_FONT = "(系统默认 System)"

FALLBACK_SANS = (
    "'Noto Sans SC','PingFang SC','Microsoft YaHei','Hiragino Sans GB',"
    "'Source Han Sans SC','WenQuanYi Micro Hei',sans-serif"
)
FALLBACK_SERIF = (
    "'Noto Serif SC','Songti SC','SimSun','STSong','Source Han Serif SC',serif"
)


def _resource_font_path(filename):
    try:
        from ...api.resources import resource_file
        return resource_file('font', filename)
    except Exception:
        return None


def discover_fonts():
    fonts = [SYSTEM_FONT]
    try:
        from ... import storage
        for row in storage.list_resources('font'):
            fonts.append(row['filename'])
    except Exception:
        pass
    return fonts


@lru_cache(maxsize=32)
def _font_b64(path, mtime):
    with open(path, "rb") as fh:
        return base64.b64encode(fh.read()).decode("ascii")


def _font_face(choice, alias, fallback):
    if not choice or choice == SYSTEM_FONT:
        return "", fallback
    path = _resource_font_path(str(choice))
    if path is None:
        return "", fallback
    path = str(path)
    b64 = _font_b64(path, os.path.getmtime(path))
    lower = path.lower()
    if lower.endswith(".woff2"):
        mime, fmt = "font/woff2", "woff2"
    elif lower.endswith(".woff"):
        mime, fmt = "font/woff", "woff"
    elif lower.endswith(".otf"):
        mime, fmt = "font/otf", "opentype"
    else:
        mime, fmt = "font/ttf", "truetype"
    face = (
        f"@font-face{{font-family:'{alias}';"
        f"src:url(data:{mime};base64,{b64}) format('{fmt}');"
        f"font-display:swap;}}"
    )
    return face, f"'{alias}',{fallback}"
