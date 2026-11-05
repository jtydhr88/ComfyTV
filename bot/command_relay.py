import asyncio
import uuid
from typing import Callable, Optional


class CommandRelay:
    def __init__(self, event: str, send: Callable[[str, dict, Optional[str]], None]) -> None:
        self.event = event
        self.send = send
        self.pending: dict[str, asyncio.Future] = {}

    async def submit(self, message: dict, *, sid: Optional[str], timeout: float) -> dict:
        command_id = uuid.uuid4().hex
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self.pending[command_id] = future
        try:
            self.send(self.event, {"id": command_id, **message}, sid)
            return await asyncio.wait_for(future, timeout)
        finally:
            self.pending.pop(command_id, None)

    def resolve(self, body: dict, failed: str) -> tuple[dict, int]:
        command_id = str(body.get("command_id") or "")
        if not command_id:
            return {"error": "command_id required"}, 400
        future = self.pending.get(command_id)
        if future is None or future.done():
            return {"ok": False, "reason": "unknown or expired command"}, 200
        if body.get("ok"):
            result = body.get("result")
            future.set_result(result if isinstance(result, dict) else {"result": result})
        else:
            future.set_exception(ValueError(str(body.get("error") or failed)))
        return {"ok": True}, 200

    def clear(self) -> None:
        for future in self.pending.values():
            if not future.done():
                future.cancel()
        self.pending.clear()
