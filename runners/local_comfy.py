import asyncio
import json
import logging
import random
import re
import urllib.parse
import uuid
from pathlib import Path
from typing import Any

from .base import Runner, RunnerContext


_log = logging.getLogger(__name__)

_UPSTREAM_PAT = re.compile(
    r'^upstream_(image|video|audio|text):(annotated|value|masked)(?:\[(\d+)\])?$'
)
_UPSTREAM_BUCKET_BY_KIND = {
    'image': 'images', 'video': 'videos', 'audio': 'audio', 'text': 'texts',
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

    out_dir = Path(folder_paths.get_input_directory()) / "painter"
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"comfytv-masked-{uuid.uuid4().hex[:8]}.png"
    rgb.save(out_dir / name, format="PNG", compress_level=4)
    return f"painter/{name} [input]"


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

def _split_runner_id(runner_id: str) -> tuple[str, str]:
    if "/" not in runner_id:
        raise RuntimeError(
            f"runner id {runner_id!r} must be 'kind/name' (e.g. 'image/local-sd15')"
        )
    kind, base = runner_id.split("/", 1)
    return kind, base

_BATCH_OUTPUT_KINDS = {
    'image',
    'shot-images',
    'multiview',
    'sequence',
}


def _auto_detect_result(workflow: dict, ctx_kind: str | None = None) -> dict:
    image_default = (
        'ui_save_batch' if ctx_kind in _BATCH_OUTPUT_KINDS else 'ui_save_url'
    )
    save_node_result = {
        'SaveImage':        image_default,
        'SaveAnimatedWEBP': image_default,
        'SaveAnimatedPNG':  image_default,
        'PreviewImage':     image_default,
        'SaveVideo':         'ui_save_url',
        'SaveAudio':         'ui_save_url',
        'SaveAudioMP3':      'ui_save_url',
        'SaveAudioOpus':     'ui_save_url',
        'SaveAudioAdvanced': 'ui_save_url',
        'VHS_VideoCombine':  'ui_save_url',
    }
    for node_id, node in workflow.items():
        if not isinstance(node, dict):
            continue
        ct = node.get("class_type")
        if isinstance(ct, str) and ct in save_node_result:
            return {"type": save_node_result[ct], "node": node_id}
    raise RuntimeError(
        "No save-class node found in workflow — declare `result` on the "
        "workflow row (sidebar editor doesn't expose this yet; set via DB)."
    )


def _apply_prunes(workflow: dict, config: dict, ctx: RunnerContext) -> set[str]:
    pruned: set[str] = set()
    rules = config.get("prune_when_missing") or []
    for rule in rules:
        when = str(rule.get("when") or "")
        m = _UPSTREAM_PAT.match(when)
        if not m:
            _log.warning("prune_when_missing: bad `when` %r — skipped", when)
            continue
        kind, _suffix, idx_str = m.group(1), m.group(2), m.group(3)
        idx = int(idx_str) if idx_str else 0
        upstream = ctx.upstream.get(_UPSTREAM_BUCKET_BY_KIND[kind]) or []
        if isinstance(upstream, str):
            upstream = [upstream]
        have = idx < len(upstream) and upstream[idx] not in (None, "")
        if have:
            continue
        for nid in rule.get("drop_nodes") or []:
            if nid in workflow:
                workflow.pop(nid)
                pruned.add(nid)
        for target in rule.get("drop_inputs") or []:
            node = workflow.get(target.get("node"))
            if node is None:
                continue
            node.get("inputs", {}).pop(target.get("input"), None)
    return pruned


def _apply_overrides(workflow: dict, config: dict, resolver: _Resolver,
                     pruned_nodes: set[str] | None = None) -> None:
    pruned_nodes = pruned_nodes or set()
    overrides = config.get("inputs") or {}
    orphaned: list[str] = []
    for node_id, fields in overrides.items():
        node = workflow.get(node_id)
        if node is None:
            if node_id not in pruned_nodes:
                orphaned.append(str(node_id))
                _log.warning(
                    "[ComfyTV/local-comfy] skipping override for missing workflow "
                    "node %r — workflow was likely re-saved with different node ids; "
                    "re-map this input in the Workflow Config sidebar if still needed.",
                    node_id,
                )
            continue
        node_inputs = node.setdefault("inputs", {})
        for input_name, spec in (fields or {}).items():
            where = f"node {node_id} input {input_name!r}"
            node_inputs[input_name] = resolver.resolve(where, spec)

    if orphaned:
        from .notify import notify_toast
        notify_toast(
            "warn",
            "Workflow input mapping skipped",
            f"{len(orphaned)} input mapping(s) point at nodes no longer in this "
            f"workflow ({', '.join(orphaned[:5])}). It ran with the workflow's own "
            f"defaults — re-map them in the Workflow Config sidebar.",
        )

def _view_url(filename: str, subfolder: str, type_: str) -> str:
    qs = urllib.parse.urlencode({
        "filename": filename, "subfolder": subfolder, "type": type_,
    })
    return f"/view?{qs}"

_NESTED_EXECUTOR = None

_NESTED_LOCK: asyncio.Lock | None = None


def _get_nested_lock() -> asyncio.Lock:
    global _NESTED_LOCK
    if _NESTED_LOCK is None:
        _NESTED_LOCK = asyncio.Lock()
    return _NESTED_LOCK


def _get_nested_executor():
    global _NESTED_EXECUTOR
    if _NESTED_EXECUTOR is not None:
        return _NESTED_EXECUTOR
    from execution import CacheType, PromptExecutor
    from server import PromptServer
    _NESTED_EXECUTOR = PromptExecutor(
        PromptServer.instance,
        cache_type=CacheType.CLASSIC,
        cache_args={"lru": 0, "ram": 0, "ram_inactive": 0},
    )
    return _NESTED_EXECUTOR


def _translate_subprompt_event(event, data, sub_prompt_id, outer_node_id, aggregate):
    if event == 'progress_state':
        nodes_dict = data.get('nodes') or {}
        if not nodes_dict:
            return []
        v, m = aggregate(nodes_dict)
        return [('progress', {
            'value':     v,
            'max':       m,
            'prompt_id': sub_prompt_id,
            'node':      str(outer_node_id),
        })]
    if event == 'progress':
        return [('progress', {**data, 'node': str(outer_node_id)})]
    if event == 'progress_text':
        return [('progress_text', {
            **data,
            'node_id': str(outer_node_id),
            'nodeId':  str(outer_node_id),
        })]
    return []


async def _run_subprompt(sub_prompt: dict, sub_prompt_id: str,
                          execute_outputs: list[str]):

    from server import PromptServer

    server = PromptServer.instance

    total_nodes = float(len(sub_prompt) or 1)

    def _aggregate(nodes_dict: dict) -> tuple[float, float]:
        finished = 0.0
        running_frac = 0.0
        for st in nodes_dict.values():
            if not isinstance(st, dict):
                continue
            stt = st.get('state')
            if stt in ('finished', 'cached'):
                finished += 1.0
            elif stt == 'running':
                try:
                    v = float(st.get('value') or 0)
                    m = float(st.get('max') or 1)
                    if m > 0:
                        running_frac += min(1.0, v / m)
                except (TypeError, ValueError):
                    pass
        return finished + running_frac, total_nodes

    loop = asyncio.get_running_loop()

    async with _get_nested_lock():
        executor = _get_nested_executor()

        outer_client_id = server.client_id
        outer_node_id = getattr(server, 'last_node_id', None)
        orig_send_sync = server.send_sync

        def wrapped_send_sync(event, data, sid=None):
            is_sub = (
                isinstance(data, dict)
                and data.get('prompt_id') == sub_prompt_id
            )
            if is_sub and outer_node_id is not None:
                try:
                    for ev, payload in _translate_subprompt_event(
                        event, data, sub_prompt_id, outer_node_id, _aggregate,
                    ):
                        orig_send_sync(ev, payload, sid)
                except Exception:
                    pass
                return None
            return orig_send_sync(event, data, sid)

        server.send_sync = wrapped_send_sync
        try:
            await loop.run_in_executor(
                None,
                lambda: executor.execute(
                    sub_prompt, sub_prompt_id,
                    extra_data={"client_id": outer_client_id},
                    execute_outputs=execute_outputs,
                ),
            )
        finally:
            server.send_sync = orig_send_sync
            server.client_id = outer_client_id

        if not executor.success:
            raise RuntimeError(
                f"Local workflow failed (sub_prompt_id={sub_prompt_id})"
            )
        return executor

_SAVE_UI_KEYS = ("images", "audio", "videos", "gifs", "video")


def _save_files_from(save_out: dict) -> list[dict]:
    if not isinstance(save_out, dict):
        return []
    for key in _SAVE_UI_KEYS:
        items = save_out.get(key)
        if items:
            return list(items)
    return []


async def _extract_result(executor, result_meta: dict) -> str:
    rtype = result_meta.get("type")
    node_id = result_meta.get("node")
    if not node_id:
        raise RuntimeError(
            "result.node is required (id of the save / output node to read)"
        )

    if rtype == "ui_save_url":
        outputs = (executor.history_result or {}).get("outputs", {})
        items = _save_files_from(outputs.get(node_id) or {})
        if not items:
            raise RuntimeError(f"save node {node_id!r} produced no files")
        first = items[0]
        return _view_url(
            filename=first.get("filename", ""),
            subfolder=first.get("subfolder", ""),
            type_=first.get("type", "output"),
        )

    if rtype == "ui_save_batch":
        outputs = (executor.history_result or {}).get("outputs", {})
        files: list[dict] = []
        ordered_ids = [node_id] + [k for k in outputs.keys() if k != node_id]
        for nid in ordered_ids:
            files.extend(_save_files_from(outputs.get(nid) or {}))
        if not files:
            raise RuntimeError("workflow produced no image files")
        images = [
            {
                "index": str(i + 1),
                "label": f"#{i + 1}",
                "image_url": _view_url(
                    filename=it.get("filename", ""),
                    subfolder=it.get("subfolder", ""),
                    type_=it.get("type", "output"),
                ),
            }
            for i, it in enumerate(files)
        ]
        return json.dumps({"images": images})

    if rtype == "graph_output_first":
        entry = await executor.caches.outputs.get(node_id)
        if entry is None or not getattr(entry, "outputs", None):
            raise RuntimeError(f"node {node_id!r} produced no graph output")
        slot = entry.outputs[0]
        if not slot:
            raise RuntimeError(f"node {node_id!r} output slot 0 was empty")
        return str(slot[0]) if slot[0] is not None else ""

    raise RuntimeError(f"unsupported result.type: {rtype!r}")


def _output_node_ids(prompt: dict, hinted: str) -> list[str]:
    import nodes as comfy_nodes
    ids = [hinted]
    for nid, node in prompt.items():
        if nid == hinted:
            continue
        cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(node.get("class_type"))
        if cls is not None and getattr(cls, "OUTPUT_NODE", False):
            ids.append(nid)
    return ids


class LocalComfyUIRunner(Runner):

    async def invoke(self, ctx: RunnerContext):
        from . import workflow_db
        kind, label = _split_runner_id(self.id)

        if ctx.kind not in self.kinds:
            raise NotImplementedError(
                f"{self.id} doesn't handle kind={ctx.kind!r} "
                f"(declared: {sorted(self.kinds)})"
            )

        config = workflow_db.get_workflow_for_invoke(kind, label)
        if config is None:
            raise RuntimeError(
                f"workflow {kind!r}/{label!r} not in DB — startup seed missed it?"
            )

        import copy
        workflow = copy.deepcopy(config["api_json"])

        pruned_nodes = _apply_prunes(workflow, config, ctx)
        resolver = _Resolver(config, ctx)
        _apply_overrides(workflow, config, resolver, pruned_nodes)

        result_meta = config.get("result") or {}
        if not result_meta.get("node"):
            result_meta = _auto_detect_result(workflow, ctx.kind)
        result_node = result_meta.get("node")
        if not result_node:
            raise RuntimeError(
                f"{self.id}: result.node missing — declare `result` in the "
                f"workflow's `_preset.json` (or re-export with a SaveImage)."
            )

        sub_prompt_id = f"comfytv-{uuid.uuid4().hex[:8]}"
        _log.info("[ComfyTV/%s] %s  overrides=%d node(s)",
                  self.id, sub_prompt_id,
                  len(config.get("inputs") or {}))

        execute_outputs = _output_node_ids(workflow, result_node)
        executor = await _run_subprompt(workflow, sub_prompt_id,
                                        execute_outputs=execute_outputs)
        return await _extract_result(executor, result_meta)
