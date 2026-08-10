import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Optional

import folder_paths


def strip_filename_annotation(filename: str, type_: str) -> tuple[str, str]:
    for suffix in ('[output]', '[input]', '[temp]'):
        if filename.endswith(suffix):
            return filename[: -(len(suffix) + 1)], suffix[1:-1]
    return filename, type_


def view_url_to_path(view_url: str) -> Optional[Path]:
    if not view_url or not isinstance(view_url, str):
        return None

    if view_url.startswith('http://') or view_url.startswith('https://'):
        return None
    try:
        u = urllib.parse.urlparse(view_url)
        q = urllib.parse.parse_qs(u.query)
    except Exception:
        return None
    filename = (q.get('filename') or [''])[0]
    if not filename:
        return None
    subfolder = (q.get('subfolder') or [''])[0]
    type_ = (q.get('type') or ['output'])[0]
    filename, type_ = strip_filename_annotation(filename, type_)
    if not filename:
        return None
    base = folder_paths.get_directory_by_type(type_)
    if not base:
        return None
    p = Path(base) / subfolder / filename if subfolder else Path(base) / filename

    base_resolved = Path(base).resolve()
    p_resolved = p.resolve()
    try:
        p_resolved.relative_to(base_resolved)
    except ValueError:
        raise ValueError(
            f"view URL escapes {type_!r} directory: {view_url!r}"
        )

    return p_resolved if p_resolved.exists() else None


def path_to_view_url(p: Path, type_: str = 'output') -> str:
    base = Path(folder_paths.get_directory_by_type(type_))
    try:
        rel = p.relative_to(base)
    except ValueError:
        rel = Path(p.name)
    parts = rel.parts
    filename = parts[-1]
    subfolder = '/'.join(parts[:-1])
    params = {'filename': filename, 'type': type_}
    if subfolder:
        params['subfolder'] = subfolder
    return '/view?' + urllib.parse.urlencode(params)


def _ensure_subdir(base: Path, sub: str) -> Path:
    out = base / sub
    out.mkdir(parents=True, exist_ok=True)
    return out


def fresh_output_path(suffix: str, subfolder: str = 'comfytv/video') -> Path:
    base = Path(folder_paths.get_output_directory())
    out_dir = _ensure_subdir(base, subfolder)
    return out_dir / f"{uuid.uuid4().hex[:12]}{suffix}"


def _strip_fx_envelope(view_url):
    if not isinstance(view_url, str) or not view_url.lstrip().startswith('{'):
        return view_url
    import json
    try:
        data = json.loads(view_url)
    except (ValueError, TypeError):
        return view_url
    inner = data.get('__fxvideo__') if isinstance(data, dict) else None
    if isinstance(inner, dict) and inner.get('url'):
        return str(inner['url'])
    return view_url


def localize(view_url: str) -> Path:
    view_url = _strip_fx_envelope(view_url)
    p = view_url_to_path(view_url)
    if p is not None:
        return p

    if isinstance(view_url, str) and (view_url.startswith('http://') or view_url.startswith('https://')):
        suffix = Path(urllib.parse.urlparse(view_url).path).suffix or '.mp4'
        dl_dir = _ensure_subdir(Path(folder_paths.get_temp_directory()), 'comfytv/dl')
        dest = dl_dir / f"{uuid.uuid4().hex[:12]}{suffix}"
        try:
            urllib.request.urlretrieve(view_url, dest)
            return dest
        except Exception as e:
            raise RuntimeError(f"failed to download {view_url!r}: {e}") from e
    raise RuntimeError(f"can't resolve view URL to a local file: {view_url!r}")
