import json
import logging
import uuid
from typing import Awaitable, Callable, Optional

from aiohttp import web

_log = logging.getLogger(__name__)

SUPPORTED_PROTOCOL_VERSIONS = ("2024-11-05", "2025-03-26", "2025-06-18")
DEFAULT_PROTOCOL_VERSION = "2025-06-18"


def rpc_result(msg_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def rpc_error(msg_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def payload_to_content(payload) -> list[dict]:
    images = payload.pop("_images", None) if isinstance(payload, dict) else None
    blocks = [{"type": "text", "text": json.dumps(payload, ensure_ascii=False, default=str)}]
    for img in images or []:
        blocks.append({"type": "image", "data": img["data"], "mimeType": img["mime"]})
    return blocks


class McpServer:
    def __init__(self, *, name: str, title: str, version: str, instructions: str, tools: dict,
                 tool_visible: Callable[[str], bool] = lambda name: True,
                 prompts: Optional[Callable[[], list[dict]]] = None,
                 get_prompt: Optional[Callable[[str], Optional[dict]]] = None) -> None:
        self.name = name
        self.title = title
        self.version = version
        self.instructions = instructions
        self.tools = tools
        self.tool_visible = tool_visible
        self.prompts = prompts
        self.get_prompt = get_prompt

    def initialize(self, params: dict) -> dict:
        requested = params.get("protocolVersion")
        version = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else DEFAULT_PROTOCOL_VERSION
        capabilities: dict = {"tools": {}}
        if self.prompts is not None:
            capabilities["prompts"] = {}
        return {
            "protocolVersion": version,
            "capabilities": capabilities,
            "serverInfo": {"name": self.name, "title": self.title, "version": self.version},
            "instructions": self.instructions,
        }

    def tools_list(self) -> dict:
        tools = []
        for name, spec in self.tools.items():
            if not self.tool_visible(name):
                continue
            describe = spec.get("describe")
            tools.append({"name": name, "description": describe() if describe else spec["description"],
                          "inputSchema": spec["inputSchema"]})
        return {"tools": tools}

    async def tools_call(self, params: dict) -> Optional[dict]:
        name = params.get("name")
        spec = self.tools.get(name)
        if spec is None or not self.tool_visible(name):
            return None
        arguments = params.get("arguments") or {}
        if not isinstance(arguments, dict):
            arguments = {}
        handler: Callable[[dict], Awaitable] = spec["handler"]
        try:
            return {"content": payload_to_content(await handler(arguments)), "isError": False}
        except (ValueError, TypeError, KeyError) as e:
            return {"content": [{"type": "text", "text": f"{type(e).__name__}: {e}"}], "isError": True}
        except Exception as e:
            _log.exception("[%s] tool %s failed", self.name, name)
            return {"content": [{"type": "text", "text": f"{type(e).__name__}: {e}"}], "isError": True}

    async def dispatch(self, msg: dict) -> Optional[dict]:
        if "id" not in msg:
            return None
        method = msg.get("method")
        msg_id = msg.get("id")
        params = msg.get("params")
        if params is None:
            params = {}
        if not isinstance(params, dict):
            return rpc_error(msg_id, -32602, "params must be an object")
        if method == "initialize":
            return rpc_result(msg_id, self.initialize(params))
        if method == "ping":
            return rpc_result(msg_id, {})
        if method == "tools/list":
            return rpc_result(msg_id, self.tools_list())
        if method == "tools/call":
            outcome = await self.tools_call(params)
            if outcome is None:
                return rpc_error(msg_id, -32602, f"unknown tool {params.get('name')!r}")
            return rpc_result(msg_id, outcome)
        if method == "resources/list":
            return rpc_result(msg_id, {"resources": []})
        if method == "resources/templates/list":
            return rpc_result(msg_id, {"resourceTemplates": []})
        if method == "prompts/list":
            return rpc_result(msg_id, {"prompts": self.prompts() if self.prompts is not None else []})
        if method == "prompts/get" and self.get_prompt is not None:
            outcome = self.get_prompt(str(params.get("name") or ""))
            if outcome is None:
                return rpc_error(msg_id, -32602, f"unknown prompt {params.get('name')!r}")
            return rpc_result(msg_id, outcome)
        return rpc_error(msg_id, -32601, f"method not found: {method}")

    async def respond(self, request: web.Request) -> web.Response:
        try:
            msg = await request.json()
        except ValueError:
            return web.json_response(rpc_error(None, -32700, "parse error"), status=400)
        if isinstance(msg, list):
            return web.json_response(rpc_error(None, -32600, "batch requests are not supported"), status=400)
        if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0":
            return web.json_response(rpc_error(None, -32600, "invalid JSON-RPC 2.0 message"), status=400)
        response = await self.dispatch(msg)
        if response is None:
            return web.Response(status=202)
        http_response = web.json_response(response)
        if msg.get("method") == "initialize" and "result" in response:
            http_response.headers["Mcp-Session-Id"] = uuid.uuid4().hex
        return http_response
