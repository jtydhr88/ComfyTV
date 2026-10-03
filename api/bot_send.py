import asyncio
import json
import mimetypes
import os
from typing import Optional
from urllib.parse import quote

from .. import storage
from . import bot_turns
from .bot_media import _prepare_attachment, _render_attachment
from .bot_turns import ACTIVE_TURNS, QUEUED, _begin_turn

_INPUT_MAX_COUNT = 6


def _input_path(name: str) -> str:
    import folder_paths
    root = os.path.abspath(folder_paths.get_input_directory())
    path = os.path.abspath(os.path.join(root, name.replace("\\", "/")))
    if not path.startswith(root + os.sep) or not os.path.isfile(path):
        raise ValueError(f"input file {name!r} not found")
    return path


def _prepare_input_file(name: str) -> tuple[Optional[dict], str]:
    path = _input_path(name)
    view_url = f"/view?filename={quote(name)}&type=input"
    mime = mimetypes.guess_type(path)[0] or ""
    if mime.startswith("image/"):
        return _render_attachment(view_url), f"[Attached image: input/{name}]"
    if mime.startswith("video/"):
        block = None
        try:
            from ..runners import media
            block = _render_attachment(media.extract_frame(view_url, "middle"))
        except Exception:
            pass
        seen = " The image below is its middle frame." if block else ""
        return block, f"[Attached video: input/{name} — use media_probe for facts.{seen}]"
    return None, f"[Attached file: input/{name} ({mime or 'unknown type'})]"


def _input_media_type(name: str) -> str:
    mime = mimetypes.guess_type(name)[0] or ""
    return mime.split("/")[0] if mime.split("/")[0] in ("image", "video", "audio") else "image"


def split_attachment_refs(raw) -> tuple[list[dict], list[str]]:
    if raw is None:
        return [], []
    if not isinstance(raw, list):
        raise ValueError("attachments must be an array")
    refs = [str(a) for a in raw if isinstance(a, str) and a.strip()]
    if len(refs) > _INPUT_MAX_COUNT:
        raise ValueError(f"at most {_INPUT_MAX_COUNT} attachments per message")
    asset_ids, names = [], []
    for ref in refs:
        if ref.startswith("asset:") and ref[6:].isdigit():
            asset_ids.append({"asset_id": int(ref[6:])})
        else:
            names.append(ref)
    from .bot_media import _resolve_attachment_assets
    return _resolve_attachment_assets(asset_ids), names


async def prepare_attachments(attachment_assets: list[dict],
                              input_files: list[str]) -> tuple[list[dict], list[str], list[dict]]:
    attachments: list[dict] = []
    manifest: list[str] = []
    display: list[dict] = []
    for a in attachment_assets:
        try:
            block, line = await asyncio.to_thread(_prepare_attachment, a)
        except Exception as e:
            raise ValueError(f"could not read asset {a['id']} ({e})") from e
        if block is not None:
            attachments.append(block)
        manifest.append(line)
        display.append({"type": a["media_type"], "url": a["payload_url"], "asset_id": a["id"],
                        "name": a.get("name") or ""})
    for name in input_files:
        try:
            block, line = await asyncio.to_thread(_prepare_input_file, name)
        except Exception as e:
            raise ValueError(f"could not read input file {name!r} ({e})") from e
        if block is not None:
            attachments.append(block)
        manifest.append(line)
        display.append({"type": _input_media_type(name),
                        "url": f"/api/view?filename={quote(name)}&type=input",
                        "input_name": name})
    return attachments, manifest, display


def compose_provider_text(chat: dict, text: str, *, skill_name: str = "",
                          ref_lines: list[str], manifest_lines: list[str],
                          extra_lines: list[str] = ()) -> str:
    provider_text = text or (
        "Look at the attached media and report what you can determine about "
        "it (for audio/video use media_probe and the manifest facts).")
    if skill_name:
        provider_text = (
            f"Use the ComfyTV skill {skill_name!r} for this task: first call "
            f"the comfytv MCP tool skill with action='read' and "
            f"name={skill_name!r}, then follow those instructions.\n\n"
            + provider_text)
    for lines in (ref_lines, manifest_lines, list(extra_lines)):
        if lines:
            provider_text += "\n\n" + "\n".join(lines)
    prefs = chat.get("prefs") or []
    if prefs:
        provider_text = (
            "Saved chat preferences (via remember; follow unless the user "
            "overrides):\n" + "\n".join(f"- {p}" for p in prefs)
            + "\n\n" + provider_text)
    return provider_text


def validate_image_ref_context(chat, body, text):
    """Validate before image preparation; unsupported transports keep v1 policy."""
    from ..bot import get_provider
    provider = get_provider(chat["provider"])
    if provider and provider.capabilities().attachment_mixed_context:
        from .task_context import capture
        return capture(chat, body, text)
    def nonempty(value):
        if isinstance(value, dict):
            return any(nonempty(v) for v in value.values())
        if isinstance(value, list):
            # A selection/reference collection with any member is real context,
            # including node ID 0. Never discard malformed false-valued members.
            return len(value) != 0
        if isinstance(value, str):
            return bool(value.strip())
        # Only null is an absent scalar default; numeric/boolean inputs are not
        # valid empty context and must take the same actionable rejection path.
        return value is not None

    unsupported = [key for key in ('refs', 'selection', 'skill', 'workflow_id',
                   'workflow_references', 'draft', 'tabs', 'prefs')
                   if nonempty(body.get(key))]
    if nonempty(chat.get('prefs')):
        unsupported.append('saved chat preferences')
    if isinstance(text, str):
        from .agent_routes import _split_skill
        if _split_skill(text.strip())[0]:
            unsupported.append('slash skill')
    if unsupported:
        raise ValueError('Image references with ' + ', '.join(unsupported)
                         + ' are unsupported. Send without images to keep this context, '
                         'or use a separate chat without saved preferences and without '
                         'selection, skills or workflow context. Nothing was cleared.')


async def prepare_image_refs(chat, raw, text, *, native=False, body=None):
    from .image_refs import parse_refs
    from .media_refs import build_manifest
    from .task_context import canonical
    from .task_context_store import get_store
    from ..bot import get_provider
    import secrets
    provider = get_provider(chat['provider'])
    caps = provider.capabilities()
    options = {'model': bot_turns._provider_model(chat['provider'])}
    if hasattr(provider, 'config_fingerprint'):
        options['config_fingerprint'] = provider.config_fingerprint()
    provider_options_json = json.dumps(options)
    if not caps.attachments:
        raise ValueError('image reference attachments are disabled')
    if not isinstance(text, str):
        raise ValueError('user text must be a string')
    context = validate_image_ref_context(chat, body or {}, text)
    ids = parse_refs(raw, native=native)
    if not ids:
        raise ValueError('image references required')
    # Freeze and reserve before the first await; all later work uses only bytes.
    store = get_store() if context is not None else None
    token = store.reserve(chat.get('id') or secrets.token_urlsafe(24), context) if store else None
    try:
        if len(canonical(text)) > 8192:
            raise ValueError('task input exceeds 8 KiB')
        if hasattr(provider, 'preflight_input'):
            provider.preflight_input(text, options['model'])
        manifest = await asyncio.to_thread(build_manifest, ids)
        ref = store.commit(token) if store else None
        task = None
        if ref:
            task = canonical({'schema': 'comfytv.task-input.v2', 'user_text': text, 'attachment_manifest': manifest, 'context_ref': ref}).decode('utf-8')
            if len(task.encode('utf-8')) > 8192:
                raise ValueError('task input exceeds 8 KiB')
        checked_input = task or canonical({'schema': 'comfytv.task-input.v1', 'user_text': text, 'attachment_manifest': manifest}).decode('utf-8')
        if len(checked_input.encode('utf-8')) > 8192:
            raise ValueError('task input exceeds 8 KiB')
        if hasattr(provider, 'preflight_input'):
            provider.preflight_input(checked_input, options['model'])
        display = [{'type': a['media_type'], 'asset_id': a['asset_id'],
                    'url': f"/comfytv/assets/{a['asset_id']}/payload",
                    'name': a['media_type'].capitalize() + ' reference (not inspected)'} for a in manifest['assets']]
        display.extend([{'type': 'text', 'text': text}, {'type': 'attachment_manifest', 'manifest': manifest}])
        if ref:
            display.append({'type': 'notice', 'text': 'Workflow context captured, not yet inspected/applied.',
                            'context_receipt': {k: v for k, v in ref.items() if k != 'id'}})
        return {'text': text, 'provider_text': text, 'attachments': [], 'display_blocks': display,
                'attachment_manifest': manifest, 'task_input_json': task,
                'provider_options_json': provider_options_json}
    except BaseException:
        if store and token:
            store.release(token)
        raise


def release_prepared(prepared):
    if prepared.get('task_input_json'):
        from .task_context_store import get_store
        get_store().release(json.loads(prepared['task_input_json'])['context_ref']['id'])


def admit_image_refs(chat, prepared, *, native=False):
    # No awaits from the busy recheck through ACTIVE_TURNS insertion: serialized
    # on the server event loop, so native concurrent preparations cannot enqueue.
    if native and chat['id'] in ACTIVE_TURNS:
        release_prepared(prepared)
        return {}, None
    try:
        current = storage.get_bot_chat(chat['id'])
        if current is None or current['provider'] != chat['provider']:
            raise ValueError('chat was deleted or provider changed during image preparation')
        from ..bot import get_provider
        if not get_provider(chat['provider']).capabilities().attachments:
            raise ValueError('image references disabled during preparation')
        return queue_or_begin({**chat, 'resume_token': current.get('resume_token')}, **prepared)
    except BaseException:
        release_prepared(prepared)
        raise


async def submit_image_refs(chat, raw, text, *, native=False, body=None):
    prepared = await prepare_image_refs(chat, raw, text, native=native, body=body)
    return admit_image_refs(chat, prepared, native=native)


def bind_submission(chat, user_msg, task_input_json):
    if task_input_json:
        from .task_context_store import get_store
        ref = json.loads(task_input_json)['context_ref']
        try:
            get_store().bind(ref['id'], chat['id'], user_msg['id'], task_input_json)
        except BaseException:
            from ..storage.bot import discard_bot_submission
            discard_bot_submission(user_msg['id'])
            raise


def queue_or_begin(chat: dict, *, text: str, provider_text: str,
                   attachments: list[dict], display_blocks: list[dict],
                   attachment_manifest: dict | None = None,
                   task_input_json: str | None = None,
                   provider_options_json: str | None = None) -> tuple[dict, Optional[dict]]:
    if chat["id"] in ACTIVE_TURNS:
        user_msg = storage.create_bot_message(
            chat_id=chat["id"], role="user",
            content=json.dumps(display_blocks), status="queued",
        )
        bind_submission(chat, user_msg, task_input_json)
        QUEUED.setdefault(chat["id"], []).append({
            "user_msg": user_msg,
            "text": text,
            "provider_text": provider_text,
            "attachments": attachments,
            "attachment_manifest": attachment_manifest,
            "task_input_json": task_input_json,
            "provider_options_json": provider_options_json,
        })
        bot_turns._broadcast("message_queued", {
            "chat_id": chat["id"], "user_message": user_msg,
        })
        return user_msg, None
    user_msg = storage.create_bot_message(
        chat_id=chat["id"], role="user", content=json.dumps(display_blocks))
    bind_submission(chat, user_msg, task_input_json)
    try:
        assistant_msg = _begin_turn(
            chat, text=text, provider_text=provider_text,
            attachments=attachments, user_msg=user_msg, attachment_manifest=attachment_manifest,
            task_input_json=task_input_json, provider_options_json=provider_options_json)
    except BaseException:
        from ..storage.bot import discard_bot_submission
        discard_bot_submission(user_msg['id'])
        raise
    return user_msg, assistant_msg
