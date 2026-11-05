import hashlib
import json
from pathlib import Path

BOT = Path(__file__).resolve().parents[1] / "bot"


def test_agentkit_copies_match_the_lock():
    lock = json.loads((BOT / "agentkit.lock").read_text(encoding="utf-8"))
    edited = [name for name, expected in lock["files"].items()
              if hashlib.sha256((BOT / name).read_bytes().replace(b"\r\n", b"\n")).hexdigest() != expected]
    assert not edited, f"{edited} are copies from comfy-agent-kit: change them there and run its sync.py"
