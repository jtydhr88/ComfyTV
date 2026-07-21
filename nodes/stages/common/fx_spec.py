import json

from comfy_api.latest import io


def build_fx_spec(kind: str, label: str, domain: str, specs,
                  params=None, out_fps_mult=None) -> str:
    entry = {
        'v': 1,
        'kind': kind,
        'label': label,
        'domain': domain,
        'specs': [[name, args] for name, args in specs],
    }
    if params:
        entry['params'] = params
    if out_fps_mult and out_fps_mult != 1:
        entry['out_fps_mult'] = out_fps_mult
    return json.dumps(entry)


def build_torch_fx_spec(kind: str, label: str, domain: str, op: str,
                        params: dict) -> str:
    return json.dumps({
        'v': 1,
        'kind': kind,
        'label': label,
        'domain': domain,
        'engine': 'torch',
        'op': op,
        'params': params,
        'specs': [],
    })


FX_VIDEO_KEY = '__fxvideo__'


def pack_fx_video(url: str, entries: list) -> str:
    return json.dumps({FX_VIDEO_KEY: {'url': url, 'chain': entries}})


def unpack_fx_video(video) -> tuple:
    raw = (video or '').strip() if isinstance(video, str) else ''
    if not raw.startswith('{'):
        return raw, []
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return raw, []
    inner = data.get(FX_VIDEO_KEY) if isinstance(data, dict) else None
    if not isinstance(inner, dict):
        return raw, []
    url = str(inner.get('url') or '')
    chain = inner.get('chain')
    entries = [e for e in chain if _valid_entry(e)] \
        if isinstance(chain, list) else []
    return url, entries


def fx_video_url(video) -> str:
    return unpack_fx_video(video)[0]


def bake_fx_video(video, progress=None) -> str:
    url, entries = unpack_fx_video(video)
    if not entries:
        return url
    from ....runners.fx_chain_exec import run_fx_chain
    return run_fx_chain(url, entries, progress=progress)


def _fx_spec_only(fx_spec: str) -> 'io.NodeOutput':
    return io.NodeOutput("", fx_spec)


def _fx_passthrough(video: str, own_spec: str) -> 'io.NodeOutput':
    url, entries = unpack_fx_video(video)
    if not url:
        raise RuntimeError(
            "This FX stage needs an upstream video — wire one into the "
            "video input."
        )
    merged = entries + [json.loads(own_spec)]
    return io.NodeOutput(pack_fx_video(url, merged), ui={"output": [url]})


def _fx_identity(video) -> 'io.NodeOutput':
    url, _entries = unpack_fx_video(video)
    if not url:
        raise RuntimeError(
            "This FX stage needs an upstream video — wire one into the "
            "video input."
        )
    v = video if isinstance(video, str) and video.strip() else url
    return io.NodeOutput(v, ui={"output": [url]})


def _valid_entry(data) -> bool:
    if not (isinstance(data, dict)
            and data.get('domain') in ('video', 'audio')
            and isinstance(data.get('specs'), list)):
        return False
    if data.get('engine') == 'torch':
        return bool(data.get('op')) and isinstance(data.get('params'), dict)
    return (len(data['specs']) > 0
            and all(isinstance(e, (list, tuple)) and len(e) == 2
                    and isinstance(e[0], str) for e in data['specs']))


def parse_fx_chain(raw: str, slot_label: str) -> list:
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        data = None
    if isinstance(data, dict) and isinstance(data.get('chain'), list):
        entries = data['chain']
    else:
        entries = [data]
    if not entries or not all(_valid_entry(e) for e in entries):
        raise RuntimeError(
            f"FX Chain: {slot_label} is not a valid FX spec — "
            f"wire it from an FX stage's fx_spec output."
        )
    return entries


def parse_fx_spec(raw: str, slot_label: str) -> dict:
    entries = parse_fx_chain(raw, slot_label)
    if len(entries) == 1:
        return entries[0]
    specs = []
    for e in entries:
        specs.extend(e['specs'])
    return {
        'v': 1,
        'kind': entries[-1]['kind'],
        'label': entries[-1]['label'],
        'domain': entries[-1]['domain'],
        'specs': specs,
    }
