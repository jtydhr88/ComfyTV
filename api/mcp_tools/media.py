import asyncio
import re

from .stages import _normalize_stage_class


async def _media_probe(args: dict) -> dict:
    url = str(args.get("url") or "")
    if not url:
        raise ValueError("url is required (a /view?… payload_url)")
    from ...runners import media
    return await asyncio.to_thread(media.get_video_info, url)

async def _media_frame(args: dict) -> dict:
    url = str(args.get("url") or "")
    if not url:
        raise ValueError("url is required (a /view?… payload_url)")
    position = args.get("position", "middle")
    from ...runners import media
    image = await asyncio.to_thread(media.extract_frame, url, position)
    return {"image": image}

async def _media_waveform(args: dict) -> dict:
    url = str(args.get("url") or "")
    if not url:
        raise ValueError("url is required (a /view?… payload_url)")
    width = max(200, min(int(args.get("width", 1200)), 4000))
    height = max(100, min(int(args.get("height", 480)), 2000))
    from ...runners import audio_render
    image = await asyncio.to_thread(
        audio_render.render_waveform_image, url, width, height)
    return {"image": image}

_VIEW_MAX_PX_DEFAULT = 768

_VIEW_MAX_PX_CAP = 1200

_VIEW_JPEG_QUALITY = 80

def _render_view_image(url: str, max_px: int) -> dict:
    import base64
    import io

    from PIL import Image

    from ...runners.media import localize

    src = localize(url)
    with Image.open(str(src)) as im:
        source_w, source_h = im.size
        im = im.convert("RGB")
        im.thumbnail((max_px, max_px))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=_VIEW_JPEG_QUALITY)
        return {
            "url": url,
            "source_width": source_w,
            "source_height": source_h,
            "width": im.width,
            "height": im.height,
            "_images": [{
                "data": base64.b64encode(buf.getvalue()).decode("ascii"),
                "mime": "image/jpeg",
            }],
        }

async def _view_image(args: dict) -> dict:
    url = str(args.get("url") or "")
    if not url:
        raise ValueError("url is required (a /view?… image URL)")
    try:
        max_px = int(args.get("max_px", _VIEW_MAX_PX_DEFAULT))
    except (TypeError, ValueError):
        raise ValueError("max_px must be an integer")
    max_px = max(256, min(max_px, _VIEW_MAX_PX_CAP))
    try:
        return await asyncio.to_thread(_render_view_image, url, max_px)
    except Exception as e:
        raise ValueError(
            f"could not open {url!r} as an image ({e}) — for videos, "
            "extract a frame with media_frame first")

_FX_PREVIEW_WINDOW_DEFAULT = 1.2

_FX_PREVIEW_WINDOW_MIN = 0.4

_FX_PREVIEW_WINDOW_MAX = 3.0

async def _fx_preview(args: dict) -> dict:
    node_class = _normalize_stage_class(str(args.get("node_class") or ""))
    if node_class.removeprefix("ComfyTV.") == "FXChainStage":
        raise ValueError(
            "FXChainStage renders the whole chain — preview individual FX "
            "stages here, then run the chain node for the final output")
    url = str(args.get("video") or "")
    if not url:
        raise ValueError("video is required (a /view?… video payload_url)")
    params = args.get("params") or {}
    if not isinstance(params, dict):
        raise ValueError("params must be an object of widget values")
    try:
        t = float(args.get("t", 0.0) or 0.0)
    except (TypeError, ValueError):
        raise ValueError("t must be a number (seconds into the video)")
    try:
        window = float(args.get("window") or _FX_PREVIEW_WINDOW_DEFAULT)
    except (TypeError, ValueError):
        raise ValueError("window must be a number (seconds)")
    window = max(_FX_PREVIEW_WINDOW_MIN,
                 min(_FX_PREVIEW_WINDOW_MAX, window))

    from ..fx_preview import _render_preview, _spec_from_stage
    from ..presets import _stage_class_map
    stage_cls = (await _stage_class_map()).get(node_class)
    if stage_cls is None:
        raise ValueError(f"unknown node_class {node_class!r}")
    try:
        data = _spec_from_stage(node_class, stage_cls, params, url)
    except Exception as e:
        raise ValueError(f"{node_class} does not support fx preview: {e}")
    result = await asyncio.to_thread(_render_preview, url, data, t, window)

    from ...runners import media
    frame_url = await asyncio.to_thread(
        media.extract_frame, result["url"], "middle")
    frame = await asyncio.to_thread(
        _render_view_image, frame_url, _VIEW_MAX_PX_DEFAULT)
    return {
        "url": result["url"],
        "t0": result["t0"],
        "t1": result["t1"],
        "frame_url": frame_url,
        "_images": frame["_images"],
    }


TOOLS: dict[str, dict] = {
    "media_probe": {
        "description": (
            "Probe a video file's metadata: duration (seconds), fps, width, "
            "height, has_audio. url is a /view?… payload_url from outputs, "
            "assets or wait_stage results. Use to verify a render's length "
            "and resolution before wiring it downstream."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"url": {"type": "string"}},
            "required": ["url"],
            "additionalProperties": False,
        },
        "handler": _media_probe,
    },
    "media_frame": {
        "description": (
            "Extract a single frame from a video as a PNG and return its "
            "/view URL. Pair with view_image to actually look at the frame "
            "(media_frame alone only returns a URL). position: 'first', "
            "'middle', 'last', a percentage like '25%', or seconds. url is a "
            "/view?… payload_url."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "position": {},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "handler": _media_frame,
    },
    "media_waveform": {
        "description": (
            "Render an audio file's waveform to a PNG (RMS overlay + "
            "clipping markers) and return its /view URL — quick visual QC "
            "for generated audio: silence, clipping, envelope shape. url is "
            "a /view?… payload_url; optional width/height."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "width": {"type": "integer"},
                "height": {"type": "integer"},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "handler": _media_waveform,
    },
    "view_image": {
        "description": (
            "Actually SEE an image: returns the image itself (downscaled "
            "JPEG, default max 768px, cap 1200) so you can inspect "
            "composition, identity and quality with your own eyes — the "
            "only tool that returns visual content rather than a URL. url "
            "is any /view?… image URL (asset payload_url, an output's "
            "image, a media_frame result). For video QC: media_frame to "
            "pull a frame, then view_image on it. Use this before judging "
            "or picking outputs — never guess what an image looks like "
            "from its filename."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "max_px": {"type": "integer"},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
        "handler": _view_image,
    },
    "fx_preview": {
        "description": (
            "Cheap look at what ONE FX stage would do to a video before "
            "running anything: renders a short window (default 1.2s, max "
            "3s, downscaled to 640px) of the video through that stage's "
            "real filter chain and returns the preview clip URL plus its "
            "middle frame as an actual image you can see. node_class is an "
            "FX stage from stage_catalog (VideoColorStage, "
            "VideoCurvesStage, CDLStage…), params are its widget values "
            "(same names as set_stage widgets — read current ones with "
            "get_stage), video is the source /view?… payload_url, t is "
            "where in the video to look. Iterate params here until the "
            "frame looks right, THEN set_stage + run the FXChainStage for "
            "the full render — two orders of magnitude cheaper than "
            "re-rendering the whole video per attempt. Not for "
            "FXChainStage itself."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "node_class": {"type": "string"},
                "video": {"type": "string"},
                "params": {"type": "object"},
                "t": {"type": "number"},
                "window": {"type": "number"},
            },
            "required": ["node_class", "video"],
            "additionalProperties": False,
        },
        "handler": _fx_preview,
    },
}
