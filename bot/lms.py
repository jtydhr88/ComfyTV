import asyncio
import logging
import os
import shutil
import sys
from pathlib import Path

from ._cli_common import run_command

_log = logging.getLogger(__name__)


def lms_bin() -> str:
    executable = "lms.exe" if os.name == "nt" else "lms"
    candidates = [
        os.getenv("LMSTUDIO_LMS_PATH", ""),
        str(Path.home() / ".lmstudio" / "bin" / executable),
        "/Applications/LM Studio.app/Contents/Resources/app/.webpack/lms"
        if sys.platform == "darwin" else "",
        shutil.which("lms") or "",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    return ""


async def _run(args: list[str], timeout: float = 600) -> str:
    binary = lms_bin()
    if not binary:
        raise RuntimeError("lms executable not found")
    try:
        code, stdout, stderr = await run_command([binary, *args], timeout=timeout)
    except asyncio.TimeoutError:
        raise RuntimeError(f"lms {' '.join(args)} timed out")
    if code != 0:
        detail = "\n".join(part for part in (
            stdout.decode("utf-8", "replace").strip(),
            stderr.decode("utf-8", "replace").strip()) if part)
        raise RuntimeError(f"lms {' '.join(args)} failed: {detail}")
    return stdout.decode("utf-8", "replace").strip()


async def unload_models() -> bool:
    try:
        await _run(["unload", "--all"], timeout=60)
        return True
    except (OSError, RuntimeError) as e:
        _log.warning("[LM Studio] model unload failed: %s", e)
        return False


async def load_model(model: str) -> None:
    if not model:
        return
    try:
        await _run(["load", model, "--identifier", model, "--gpu", "max", "--yes"])
    except (OSError, RuntimeError) as e:
        _log.warning("[LM Studio] model reload failed: %s", e)
