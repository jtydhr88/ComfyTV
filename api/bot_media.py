from .. import storage

_ATTACHABLE_TYPES = ("image", "video", "audio")

_ATTACH_MAX_PX = 1024
_ATTACH_JPEG_QUALITY = 85
_ATTACH_MAX_COUNT = 6


def _render_attachment(url: str) -> dict:
    import base64
    import io

    from PIL import Image

    from ..runners.media import localize

    src = localize(url)
    with Image.open(str(src)) as im:
        im = im.convert("RGB")
        im.thumbnail((_ATTACH_MAX_PX, _ATTACH_MAX_PX))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=_ATTACH_JPEG_QUALITY)
    return {
        "data": base64.b64encode(buf.getvalue()).decode("ascii"),
        "media_type": "image/jpeg",
    }



_REFS_MAX = 12


def _resolve_refs(raw) -> tuple[list[dict], list[str]]:
    if raw is None:
        return [], []
    if not isinstance(raw, list):
        raise ValueError("refs must be an array")
    if len(raw) > _REFS_MAX:
        raise ValueError(f"at most {_REFS_MAX} refs per message")
    items: list[dict] = []
    lines: list[str] = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValueError(f"refs[{i}] must be an object")
        kind = item.get("kind")
        if kind == "stage":
            uid = str(item.get("uid") or "")
            gid = str(item.get("graph_node_id") or "")
            if not uid and not gid:
                raise ValueError(f"refs[{i}]: stage ref needs uid or graph_node_id")
            title = str(item.get("title") or "")
            stage_class = str(item.get("stage_class") or "")
            items.append({"kind": "stage", "uid": uid, "graph_node_id": gid,
                          "title": title, "stage_class": stage_class})
            target = uid or f"graph node {gid}"
            if stage_class:
                target += f" ({stage_class})"
            if title:
                target += f' "{title}"'
            lines.append(
                f"[Referenced stage: {target} — inspect with get_stage, "
                f"target it with set_stage/run_stage]")
            continue
        if kind == "asset":
            aid = item.get("asset_id")
            if not isinstance(aid, int):
                raise ValueError(f"refs[{i}]: asset ref needs a numeric asset_id")
            asset = storage.get_asset(aid)
            if asset is None:
                raise ValueError(f"refs[{i}]: asset {aid} not found")
            name = asset.get("name") or "unnamed"
            media_type = asset.get("media_type") or ""
            items.append({"kind": "asset", "asset_id": aid, "name": name,
                          "media_type": media_type})
            lines.append(
                f"[Referenced asset: #{aid} \"{name}\" ({media_type}) — pass "
                f"asset_refs [{{\"asset_id\": {aid}}}] to a stage; preview "
                f"images with view_image]")
            continue
        raise ValueError(f"refs[{i}]: kind must be 'stage' or 'asset'")
    return items, lines


def _resolve_attachment_assets(raw) -> list[dict]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("attachments must be an array of {asset_id} objects")
    if len(raw) > _ATTACH_MAX_COUNT:
        raise ValueError(f"at most {_ATTACH_MAX_COUNT} attachments per message")
    rows = []
    for i, item in enumerate(raw):
        aid = item.get("asset_id") if isinstance(item, dict) else None
        if not isinstance(aid, int):
            raise ValueError(f"attachments[{i}] needs a numeric asset_id")
        asset = storage.get_asset(aid)
        if asset is None:
            raise ValueError(f"attachments[{i}]: asset {aid} not found")
        if asset.get("media_type") not in _ATTACHABLE_TYPES:
            raise ValueError(
                f"attachments[{i}]: asset {aid} is {asset.get('media_type')!r}; "
                f"attachable types: {', '.join(_ATTACHABLE_TYPES)}")
        rows.append(asset)
    return rows


def _audio_duration_s(url: str) -> float | None:
    import av

    from ..runners.media import localize
    try:
        with av.open(str(localize(url))) as c:
            if c.duration:
                return round(c.duration / 1_000_000, 2)
            stream = c.streams.audio[0] if c.streams.audio else None
            if stream is not None and stream.duration and stream.time_base:
                return round(float(stream.duration * stream.time_base), 2)
    except Exception:
        return None
    return None


def _prepare_attachment(asset: dict) -> tuple[dict | None, str]:
    from ..runners import audio_render, media

    aid = asset["id"]
    url = asset["payload_url"]
    name = asset.get("name") or "unnamed"
    tail = (f"already in the asset library; to use it on a stage pass "
            f"asset_refs [{{\"asset_id\": {aid}}}] or select it in an asset "
            f"loader]")
    media_type = asset.get("media_type")

    if media_type == "image":
        return (_render_attachment(url),
                f"[Attached image: asset #{aid} ({name}) — {url} — {tail}")

    if media_type == "video":
        facts = ""
        block = None
        try:
            info = media.get_video_info(url)
            facts = (f" {info['duration']:.2f}s {info['width']}x"
                     f"{info['height']} @{info['fps']:.0f}fps"
                     f"{' with audio' if info.get('has_audio') else ''} —")
        except Exception:
            pass
        try:
            frame_url = media.extract_frame(url, "middle")
            block = _render_attachment(frame_url)
        except Exception:
            pass
        seen = (" The image below is its middle frame."
                if block else "")
        return (block,
                f"[Attached video: asset #{aid} ({name}) —{facts} {url} — "
                f"{tail}{seen}")

    facts = ""
    dur = _audio_duration_s(url)
    if dur is not None:
        facts = f" {dur:.2f}s —"
    block = None
    try:
        wave_url = audio_render.render_waveform_image(url, 1200, 320)
        block = _render_attachment(wave_url)
    except Exception:
        pass
    seen = (" The image below is its waveform (RMS + clipping markers) — "
            "use it to see the track's structure." if block else "")
    return (block,
            f"[Attached audio: asset #{aid} ({name}) —{facts} {url} — "
            f"{tail}{seen}")
