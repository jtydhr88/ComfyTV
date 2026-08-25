from __future__ import annotations

import json
import re
from typing import Optional

_TOOLS_PREAMBLE = (
    "\n\n# Tools\n\n"
    "You may call one or more functions to assist with the user query.\n\n"
    "You are provided with function signatures within <tools></tools> "
    "XML tags:\n<tools>\n{tools}\n</tools>\n\n"
    "For each function call, return a json object with function name and "
    "arguments within <tool_call></tool_call> XML tags:\n"
    "<tool_call>\n"
    "{{\"name\": <function-name>, \"arguments\": <args-json-object>}}\n"
    "</tool_call>"
)
_THINK_RE = re.compile(r"<think>.*?(?:</think>|$)", re.DOTALL)
_TOOL_CALL_RE = re.compile(r"<tool_call>(.*?)</tool_call>", re.DOTALL)
_STOP_MARKER_RE = re.compile(
    r"(?:<\|im_end\|>|<\|endoftext\|>|<end_of_turn>|<turn\|>).*$", re.DOTALL)

_FAMILIES = {
    "chatml": ("<|im_start|>{role}\n", "<|im_end|>\n", "assistant",
               "<think>\n\n</think>\n\n"),
    "gemma3": ("<start_of_turn>{role}\n", "<end_of_turn>\n", "model", ""),
    "gemma4": ("<|turn>{role}\n", "<turn|>\n", "model", "<|channel>final\n"),
}


def _text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(str(p.get("text") or "") for p in content
                         if isinstance(p, dict) and p.get("type") == "text")
    return "" if content is None else str(content)


def _tool_call_blocks(msg: dict) -> list[str]:
    blocks = []
    for call in msg.get("tool_calls") or []:
        fn = call.get("function") or {}
        args = fn.get("arguments")
        if not isinstance(args, str):
            args = json.dumps(args or {}, ensure_ascii=False)
        call_json = (f'{{"name": {json.dumps(str(fn.get("name") or ""))}, '
                     f'"arguments": {args}}}')
        blocks.append(f"<tool_call>\n{call_json}\n</tool_call>")
    return blocks


def render_prompt(messages: list[dict], tools: Optional[list[dict]] = None,
                  thinking: bool = False, family: str = "chatml") -> str:
    open_fmt, close, assistant_role, gen_suffix = _FAMILIES[family]

    def turn(role: str, body: str) -> str:
        return open_fmt.format(role=role) + body + close

    out = []
    system = "\n\n".join(_text(m.get("content")) for m in messages
                         if m.get("role") == "system").strip()
    if tools:
        schemas = "\n".join(
            json.dumps(t, ensure_ascii=False, separators=(", ", ": "))
            for t in tools)
        system += _TOOLS_PREAMBLE.format(tools=schemas)
    if system:
        out.append(turn("system", system))

    pending_tool_results: list[str] = []

    def flush_tools() -> None:
        if pending_tool_results:
            blocks = "\n".join(f"<tool_response>\n{r}\n</tool_response>"
                               for r in pending_tool_results)
            out.append(turn("user", blocks))
            pending_tool_results.clear()

    for msg in messages:
        role = msg.get("role")
        if role == "tool":
            pending_tool_results.append(_text(msg.get("content")))
            continue
        flush_tools()
        if role == "user":
            out.append(turn("user", _text(msg.get("content"))))
        elif role == "assistant":
            parts = [_text(msg.get("content")).strip()]
            parts.extend(_tool_call_blocks(msg))
            out.append(turn(assistant_role, "\n".join(p for p in parts if p)))
    flush_tools()

    out.append(open_fmt.format(role=assistant_role))
    if not thinking:
        out.append(gen_suffix)
    return "".join(out)


def strip_stop_markers(text: str) -> str:
    return _STOP_MARKER_RE.sub("", text)


def parse_completion(text: str) -> tuple[str, list[dict]]:
    text = _THINK_RE.sub("", strip_stop_markers(text))
    tool_calls = []
    for match in _TOOL_CALL_RE.finditer(text):
        try:
            call = json.loads(match.group(1))
        except Exception:
            continue
        if not isinstance(call, dict) or not call.get("name"):
            continue
        args = call.get("arguments")
        if not isinstance(args, str):
            args = json.dumps(args if isinstance(args, dict) else {},
                              ensure_ascii=False)
        tool_calls.append({
            "id": f"call_{len(tool_calls)}",
            "type": "function",
            "function": {"name": str(call["name"]), "arguments": args},
        })
    content = _TOOL_CALL_RE.sub("", text).strip()
    return content, tool_calls
