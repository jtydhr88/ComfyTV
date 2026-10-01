import asyncio
import json
import logging
import subprocess
import sys
from typing import Any, Awaitable, Callable, Optional

_log = logging.getLogger(__name__)

STREAM_LIMIT = 10 * 1024 * 1024
STDERR_CAP = 64 * 1024
DEFAULT_REQUEST_TIMEOUT_S = 60.0
_POLL_S = 1.0

CODE_LOCAL_TIMEOUT = -32001
CODE_PROTOCOL = -32603
CODE_METHOD_NOT_FOUND = -32601


class AcpError(RuntimeError):
    def __init__(self, code: int, message: str, data: Any = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data


class AcpProcessError(RuntimeError):
    pass


NotificationHandler = Callable[[str, dict], Awaitable[None]]
RequestHandler = Callable[[str, dict], Awaitable[Any]]


class AcpTransport:
    def __init__(self, argv: list[str], *, cwd: str, env: dict,
                 on_notification: NotificationHandler,
                 on_request: RequestHandler) -> None:
        self.argv = list(argv)
        self.cwd = cwd
        self.env = env
        self._on_notification = on_notification
        self._on_request = on_request
        self.proc: Optional[asyncio.subprocess.Process] = None
        self._pending: dict[int, asyncio.Future] = {}
        self._next_id = 0
        self._write_lock = asyncio.Lock()
        self._tasks: list[asyncio.Task] = []
        self._stderr = bytearray()
        self.last_activity = 0.0
        self.closed_reason = ""

    @property
    def returncode(self) -> Optional[int]:
        return self.proc.returncode if self.proc is not None else None

    async def start(self) -> None:
        kwargs: dict = {
            "stdin": asyncio.subprocess.PIPE,
            "stdout": asyncio.subprocess.PIPE,
            "stderr": asyncio.subprocess.PIPE,
            "cwd": self.cwd,
            "env": self.env,
            "limit": STREAM_LIMIT,
        }
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        self.last_activity = asyncio.get_running_loop().time()
        self.proc = await asyncio.create_subprocess_exec(*self.argv, **kwargs)
        self._tasks = [asyncio.create_task(self._read_loop()),
                       asyncio.create_task(self._drain_stderr())]

    def _note_stderr(self, data: bytes) -> None:
        room = STDERR_CAP - len(self._stderr)
        if room > 0:
            self._stderr += data[:room]

    async def _drain_stderr(self) -> None:
        while chunk := await self.proc.stderr.read(65536):
            self._note_stderr(chunk)

    async def _read_loop(self) -> None:
        loop = asyncio.get_running_loop()
        try:
            while True:
                try:
                    line = await self.proc.stdout.readline()
                except ValueError:
                    _log.warning("[ComfyTV/acp] oversized stdout line skipped")
                    continue
                if not line:
                    break
                self.last_activity = loop.time()
                text = line.decode("utf-8", "replace").strip()
                if not text:
                    continue
                try:
                    msg = json.loads(text)
                except ValueError:
                    msg = None
                if isinstance(msg, dict):
                    await self._dispatch(msg)
                else:
                    self._note_stderr(f"[non-protocol stdout] {text[:400]}\n".encode())
        except OSError as e:
            self.closed_reason = f"ACP read failed: {e}"
        finally:
            if not self.closed_reason:
                rc = self.proc.returncode
                self.closed_reason = ("ACP connection closed" if rc in (None, 0)
                                      else f"ACP process exited with code {rc}")
            self._fail_pending(self.closed_reason)

    async def _dispatch(self, msg: dict) -> None:
        if "id" in msg and ("result" in msg or "error" in msg):
            fut = self._pending.pop(msg["id"], None)
            if fut is None or fut.done():
                return
            error = msg.get("error")
            if isinstance(error, dict):
                fut.set_exception(AcpError(int(error.get("code") or CODE_PROTOCOL),
                                           str(error.get("message") or "ACP error"),
                                           error.get("data")))
            elif error is not None:
                fut.set_exception(AcpError(CODE_PROTOCOL, str(error)))
            else:
                fut.set_result(msg.get("result"))
            return
        method = msg.get("method")
        if not isinstance(method, str):
            return
        params = msg.get("params") or {}
        if "id" in msg:
            await self._answer(msg["id"], method, params)
            return
        try:
            await self._on_notification(method, params)
        except Exception:
            _log.exception("[ComfyTV/acp] notification handler failed for %s", method)

    async def _answer(self, rid: Any, method: str, params: dict) -> None:
        try:
            reply = {"result": await self._on_request(method, params)}
        except AcpError as e:
            reply = {"error": {"code": e.code, "message": e.message}}
        try:
            await self._send({"jsonrpc": "2.0", "id": rid, **reply})
        except AcpProcessError:
            _log.warning("[ComfyTV/acp] reply to %s could not be written", method)

    async def _send(self, obj: dict) -> None:
        proc = self.proc
        if proc is None or proc.returncode is not None:
            raise AcpProcessError(self.closed_reason or "ACP process is not running")
        data = (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")
        async with self._write_lock:
            try:
                proc.stdin.write(data)
                await proc.stdin.drain()
            except (OSError, RuntimeError) as e:
                raise AcpProcessError(f"ACP write failed: {e}") from e

    async def request(self, method: str, params: dict, *,
                      timeout: Optional[float] = DEFAULT_REQUEST_TIMEOUT_S,
                      idle_timeout: Optional[float] = None) -> Any:
        loop = asyncio.get_running_loop()
        self._next_id += 1
        rid = self._next_id
        fut = loop.create_future()
        self._pending[rid] = fut
        try:
            await self._send({"jsonrpc": "2.0", "id": rid, "method": method,
                              "params": params})
            started = loop.time()
            while not fut.done():
                now = loop.time()
                if timeout is not None and now - started > timeout:
                    raise AcpError(CODE_LOCAL_TIMEOUT,
                                   f"{method} timed out after {int(timeout)}s")
                if idle_timeout is not None and now - self.last_activity > idle_timeout:
                    raise AcpError(CODE_LOCAL_TIMEOUT,
                                   f"{method} timed out: no activity from the agent "
                                   f"for {int(idle_timeout)}s")
                await asyncio.wait({fut}, timeout=_POLL_S)
            return fut.result()
        finally:
            self._pending.pop(rid, None)

    async def notify(self, method: str, params: dict) -> None:
        await self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def _fail_pending(self, reason: str) -> None:
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(AcpProcessError(reason))
        self._pending.clear()

    async def wait_exit(self, timeout: float) -> bool:
        if self.proc is None or self.proc.returncode is not None:
            return True
        try:
            await asyncio.wait_for(self.proc.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    async def close(self, timeout: float) -> None:
        if self.proc is None:
            return
        if not self.proc.stdin.is_closing():
            self.proc.stdin.close()
        await self.wait_exit(timeout)

    async def dispose(self) -> None:
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._fail_pending(self.closed_reason or "ACP transport disposed")

    def error_detail(self) -> str:
        stderr = self._stderr.decode("utf-8", "replace").strip()
        return " | ".join(p for p in (self.closed_reason, stderr[-800:]) if p)
