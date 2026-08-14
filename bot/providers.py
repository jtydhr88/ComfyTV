from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional


@dataclass
class ProviderStatus:
    available: bool
    version: str = ""
    logged_in: Optional[bool] = None
    detail: str = ""


@dataclass
class ProviderCaps:
    stateful: bool = True
    tools: str = "mcp"


@dataclass
class TurnRequest:
    chat_id: str
    user_text: str
    resume_token: Optional[str] = None
    history: Optional[list[dict]] = None
    mcp_endpoint: str = ""
    allowed_tools: list[str] = field(default_factory=list)


@dataclass
class BotEvent:
    t: str
    text: str = ""
    name: str = ""
    input: Optional[dict] = None
    detail: str = ""


@dataclass
class TurnResult:
    resume_token: Optional[str] = None
    error: str = ""
    aborted: bool = False


class TurnHandle:
    def __init__(self) -> None:
        self.process: Any = None
        self.stop_requested = False


EmitFn = Callable[[BotEvent], Awaitable[None]]


class AgentProvider(ABC):
    id: str = ""
    label: str = ""

    @abstractmethod
    async def probe(self) -> ProviderStatus: ...

    @abstractmethod
    def capabilities(self) -> ProviderCaps: ...

    @abstractmethod
    async def send(self, turn: TurnRequest, emit: EmitFn,
                   handle: TurnHandle) -> TurnResult: ...

    @abstractmethod
    async def stop(self, handle: TurnHandle) -> None: ...


_REGISTRY: dict[str, AgentProvider] = {}


def register_provider(provider: AgentProvider) -> None:
    _REGISTRY[provider.id] = provider


def get_provider(provider_id: str) -> Optional[AgentProvider]:
    return _REGISTRY.get(provider_id)


def list_providers() -> list[AgentProvider]:
    return list(_REGISTRY.values())
