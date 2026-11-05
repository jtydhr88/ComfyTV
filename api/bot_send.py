import asyncio
import json
import mimetypes
import os
from typing import Optional
from urllib.parse import quote

from .. import storage
from . import bot_turns
from ..bot.documents import DOC_ERRORS, read_text
from .bot_docs import DOC_EXT, document_line
from .bot_media import _SHEET_NOTE, _prepare_attachment, _render_attachment, _render_video_sheet
from .bot_turns import ACTIVE_TURNS, QUEUED, RUNNER

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
            block = _render_video_sheet(view_url)
        except Exception:
            pass
        seen = _SHEET_NOTE if block else ""
        return block, f"[Attached video: input/{name} — use media_probe for facts.{seen}]"
    if path.lower().endswith(DOC_EXT):
        try:
            return None, document_line(f"input/{name}", read_text(path))
        except DOC_ERRORS as e:
            return None, f"[Attached document: input/{name} — could not read its text ({e})]"
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


def queue_or_begin(chat: dict, *, text: str, provider_text: str,
                   attachments: list[dict], display_blocks: list[dict]) -> tuple[dict, Optional[dict]]:
    if chat["id"] in ACTIVE_TURNS:
        user_msg = storage.create_bot_message(
            chat_id=chat["id"], role="user",
            content=json.dumps(display_blocks), status="queued",
        )
        QUEUED.setdefault(chat["id"], []).append({
            "user_msg": user_msg,
            "text": text,
            "provider_text": provider_text,
            "attachments": attachments,
        })
        bot_turns._broadcast("message_queued", {
            "chat_id": chat["id"], "user_message": user_msg,
        })
        return user_msg, None
    user_msg = storage.create_bot_message(
        chat_id=chat["id"], role="user", content=json.dumps(display_blocks))
    assistant_msg = RUNNER.begin(
        chat, text=text, provider_text=provider_text,
        attachments=attachments, user_msg=user_msg)
    return user_msg, assistant_msg
