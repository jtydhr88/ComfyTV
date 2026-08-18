import hashlib
import os
import uuid
from pathlib import Path

import folder_paths

from .media import view_url_to_path

THUMB_SIZES = (256, 512, 1024)
THUMB_SUBFOLDER = 'comfytv/thumbs'
THUMB_SKIP_FACTOR = 1.25
THUMB_QUALITY = 85
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}


def thumb_dir() -> Path:
    d = Path(folder_paths.get_output_directory()) / THUMB_SUBFOLDER
    d.mkdir(parents=True, exist_ok=True)
    return d


def snap_size(max_edge: int) -> int:
    for size in THUMB_SIZES:
        if max_edge <= size:
            return size
    return THUMB_SIZES[-1]


def resolve_thumb(view_url: str, max_edge: int) -> Path:
    src = view_url_to_path(view_url)
    if src is None:
        raise FileNotFoundError(view_url)
    if src.suffix.lower() not in IMAGE_EXTS:
        return src

    size = snap_size(max_edge)
    st = src.stat()
    key = hashlib.sha1(
        f'{src}|{st.st_size}|{st.st_mtime_ns}|{size}'.encode()).hexdigest()
    dest = thumb_dir() / f'{key}.webp'
    if dest.is_file():
        return dest

    from PIL import Image, ImageOps

    with Image.open(src) as im:
        if getattr(im, 'is_animated', False):
            return src
        if max(im.size) <= size * THUMB_SKIP_FACTOR:
            return src
        im = ImageOps.exif_transpose(im)
        has_alpha = ('A' in im.getbands()) or ('transparency' in im.info)
        im = im.convert('RGBA' if has_alpha else 'RGB')
        im.thumbnail((size, size), Image.LANCZOS)
        tmp = dest.with_name(f'{dest.stem}.{uuid.uuid4().hex[:8]}.tmp')
        im.save(tmp, format='webp', quality=THUMB_QUALITY)
    os.replace(tmp, dest)
    return dest


__all__ = ['resolve_thumb', 'snap_size', 'thumb_dir', 'THUMB_SIZES',
           'THUMB_SUBFOLDER', 'THUMB_SKIP_FACTOR', 'THUMB_QUALITY',
           'IMAGE_EXTS']
