import os

import folder_paths

from .providers import (  # noqa: F401
    AgentProvider,
    BotEvent,
    ProviderCaps,
    ProviderStatus,
    TurnHandle,
    TurnRequest,
    TurnResult,
    get_provider,
    list_providers,
    register_provider,
)
from .claude_code import ClaudeCodeProvider  # noqa: F401
from .codex import CodexCodeProvider  # noqa: F401
from .comfyui_llm_provider import ComfyUiLlmProvider, shim_url  # noqa: F401
from .deepseek_harness import DeepSeekHarnessProvider  # noqa: F401
from .guide import HOST
from .hermes import HermesProvider  # noqa: F401
from .local_llm import LocalLlmProvider  # noqa: F401
from .qwen_code import QwenCodeProvider  # noqa: F401


def _home(name: str) -> str:
    return os.path.join(folder_paths.get_user_directory(), "comfytv", name)


def _setting(key: str) -> str:
    try:
        from .. import storage
        return str(storage.get_setting(key) or "").strip()
    except Exception:
        return ""


register_provider(ClaudeCodeProvider(host=HOST, home_dir=_home("bot-home")))
register_provider(CodexCodeProvider(host=HOST, home_dir=_home("bot-home-codex")))
register_provider(QwenCodeProvider(host=HOST, home_dir=_home("bot-home-qwen")))
register_provider(DeepSeekHarnessProvider(host=HOST, home_dir=_home("bot-home-deepseek-harness")))
register_provider(HermesProvider(host=HOST, home_dir=_home("bot-home-hermes"),
                                 ssh_host=lambda: _setting("bot-hermes-ssh-host"),
                                 profile=lambda: _setting("bot-hermes-profile")))
register_provider(LocalLlmProvider(host=HOST, base_url=lambda: _setting("bot-local-llm-url")))
register_provider(ComfyUiLlmProvider(host=HOST, base_url=shim_url))
