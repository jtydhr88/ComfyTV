import logging
import random
import re
import urllib.parse
import uuid
from pathlib import Path
from typing import Any

from .base import RunnerContext

_log = logging.getLogger(__name__)


_UPSTREAM_PAT = re.compile(
    r'^upstream_(image|video|audio|text|model):(annotated|value|masked)(?:\[(\d+)\])?$'
)


_UPSTREAM_BUCKET_BY_KIND = {
    'image': 'images', 'video': 'videos', 'audio': 'audio', 'text': 'texts',
    'model': 'models',
}


def _aspect_ratio_value(s: str) -> float:
    try:
        a, b = s.split(":")
        return int(a) / int(b)
    except (ValueError, ZeroDivisionError, AttributeError):
        return 1.0


_SHORT_SIDE_BY_TIER = {
    "480P": 480, "720P": 720, "1K": 1024, "1080P": 1080,
    "1440P": 1440, "2K": 2048, "2160P": 2160, "4K": 4096,
}


def _resolve_wh(sizing: dict, options: dict) -> tuple[int, int]:
    snap = int(sizing.get("snap") or 8)
    tiers = sizing.get("short_side_by_tier") or _SHORT_SIDE_BY_TIER
    short = int(tiers.get(options.get("resolution"))
                or sizing.get("base")
                or next(iter(tiers.values()), 512))
    ar = _aspect_ratio_value(options.get("aspect_ratio") or "1:1")
    if ar >= 1.0:
        h = short
        w = int(round(short * ar))
    else:
        w = short
        h = int(round(short / ar))
    floor = max(snap, 16)
    return max(floor, (w // snap) * snap), max(floor, (h // snap) * snap)


def _resolve_length(sizing: dict, options: dict) -> int:
    fps = int(sizing.get("fps") or 24)
    div = int(sizing.get("frames_divisor") or 1)
    raw = max(1, int(options.get("duration_s") or 4) * fps)
    if div <= 1:
        return raw
    rem = (raw - 1) % div
    return raw + (div - rem) if rem else raw


def _view_url_to_annotated(url: str) -> str:
    if not isinstance(url, str) or not url.startswith("/view?"):
        raise RuntimeError(
            f"i2i source image must be a ComfyUI /view? URL; got {url!r}"
        )
    qs = urllib.parse.urlparse(url).query
    params = dict(urllib.parse.parse_qsl(qs))
    filename = params.get("filename", "")
    subfolder = params.get("subfolder", "")
    type_ = params.get("type", "output").lower()
    if not filename:
        raise RuntimeError(f"i2i source URL has no filename: {url!r}")
    if type_ not in ("output", "input", "temp"):
        raise RuntimeError(f"i2i source URL has unknown type={type_!r}")
    path = f"{subfolder}/{filename}" if subfolder else filename
    return f"{path} [{type_}]"


def _composite_masked_image(image_url: str, mask_annotated: str) -> str:
    import folder_paths
    import node_helpers
    from PIL import Image, ImageOps

    image_annotated = _view_url_to_annotated(image_url)
    img_path = folder_paths.get_annotated_filepath(image_annotated)
    mask_path = folder_paths.get_annotated_filepath(mask_annotated)

    img = node_helpers.pillow(Image.open, img_path)
    img = node_helpers.pillow(ImageOps.exif_transpose, img)
    rgb = img.convert("RGB")

    mask_img = node_helpers.pillow(Image.open, mask_path)
    if "A" not in mask_img.getbands():
        raise RuntimeError(
            f"mask {mask_annotated!r} has no alpha channel — "
            f"expected a painter-exported PNG"
        )
    alpha = mask_img.getchannel("A")
    if alpha.size != rgb.size:
        alpha = alpha.resize(rgb.size, Image.Resampling.BILINEAR)
    rgb.putalpha(alpha)

    out_dir = Path(folder_paths.get_input_directory()) / "comfytv" / "painter"
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"comfytv-masked-{uuid.uuid4().hex[:8]}.png"
    rgb.save(out_dir / name, format="PNG", compress_level=4)
    return f"comfytv/painter/{name} [input]"


def _cast(value: Any, cast: str | None) -> Any:
    if cast is None:
        return value
    if cast == "int":   return int(value)
    if cast == "float": return float(value)
    if cast == "str":   return str(value)
    if cast == "bool":
        if isinstance(value, bool): return value
        s = str(value).strip().lower()
        return s in ("true", "1", "yes", "on")
    raise RuntimeError(f"unknown cast {cast!r}")


def _resolve_default(default: Any) -> Any:
    if default == "random_int31":
        return random.randint(0, 2**31 - 1)
    return default


class _Resolver:
    def __init__(self, config: dict, ctx: RunnerContext):
        self.ctx = ctx
        self.sizing = config.get("sizing") or {}
        self._wh: tuple[int, int] | None = None
        self._length: int | None = None
        self._masked: dict[str, str] = {}

    def _wh_cached(self) -> tuple[int, int]:
        if self._wh is None:
            self._wh = _resolve_wh(self.sizing, self.ctx.options)
        return self._wh

    def _length_cached(self) -> int:
        if self._length is None:
            self._length = _resolve_length(self.sizing, self.ctx.options)
        return self._length

    def _masked_cached(self, url: str) -> str:
        if url not in self._masked:
            mask = str(self.ctx.options.get("mask_data") or "")
            if not mask:
                return ""  # falls through to default / required handling
            self._masked[url] = _composite_masked_image(url, mask)
        return self._masked[url]

    def resolve(self, where: str, spec: dict) -> Any:
        src = str(spec.get("from") or "")
        cast = spec.get("cast")
        default = _resolve_default(spec.get("default"))
        value: Any = None

        if src == "main_prompt":
            value = (self.ctx.main_prompt or "").strip()
            _log.info("[ComfyTV] %s: main_prompt = %r", where, value)
        elif src.startswith("option:"):
            key = src.split(":", 1)[1]
            v = self.ctx.options.get(key)
            value = v if v not in (None, "") else None
        elif src == "computed:width":
            value = self._wh_cached()[0]
        elif src == "computed:height":
            value = self._wh_cached()[1]
        elif src == "computed:length":
            value = self._length_cached()
        elif (m := _UPSTREAM_PAT.match(src)):
            kind, suffix, idx_str = m.group(1), m.group(2), m.group(3)
            idx = int(idx_str) if idx_str else 0
            upstream = self.ctx.upstream.get(_UPSTREAM_BUCKET_BY_KIND[kind]) or []
            if isinstance(upstream, str):  # audio may be a single string
                upstream = [upstream]
            if suffix == "masked" and kind != "image":
                raise RuntimeError(
                    f"{where}: `masked` is only valid for upstream_image"
                )
            if idx >= len(upstream):
                value = None
            elif suffix == "annotated":
                src_val = upstream[idx]
                value = _view_url_to_annotated(src_val) if src_val else None
            elif suffix == "masked":
                src_val = upstream[idx]
                value = self._masked_cached(src_val) if src_val else None
            else:
                value = upstream[idx]
        elif src.startswith("literal:"):
            value = src.split(":", 1)[1]
        else:
            raise RuntimeError(f"{where}: unknown `from` source {src!r}")

        if (value is None or value == "") and default is not None:
            value = default

        if value is None or value == "":
            if spec.get("required"):
                raise RuntimeError(
                    spec.get("error") or f"{where}: required but empty"
                )
            value = ""

        prefix = spec.get("prefix")
        suffix = spec.get("suffix")
        if (prefix or suffix) and isinstance(value, str):
            value = (str(prefix) if prefix else "") + value + (str(suffix) if suffix else "")

        return _cast(value, cast)
