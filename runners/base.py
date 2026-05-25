from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Literal


StageKind = Literal[
    'text', 'image', 'video', 'storyboard', 'shot-images', 'shot-picker',
    'timeline', 'upscale', 'outpaint', 'inpaint', 'erase', 'image-edit', 'multiangle',
    'relight', 'cutout', 'multiview', 'sequence', 'audio-vocal', 'audio-bg',
]


@dataclass
class RunnerContext:
    kind: StageKind
    main_prompt: str = ''
    upstream: dict[str, Any] = field(default_factory=dict)
    options: dict[str, Any] = field(default_factory=dict)
    progress: Any = None

OutputPayload = Any


class Runner:

    def __init__(self, id: str, label: str, kinds: set[StageKind]):
        self.id = id
        self.label = label
        self.kinds = frozenset(kinds)

    async def invoke(self, ctx: RunnerContext) -> OutputPayload:
        raise NotImplementedError(
            f"Runner '{self.id}' has no invoke implementation yet. "
            "Subclass Runner and override invoke() to make this real."
        )

    def __repr__(self) -> str:
        return f"<Runner {self.id} kinds={{{', '.join(sorted(self.kinds))}}}>"


class RunnerRegistry:

    def __init__(self) -> None:
        self._runners: dict[str, Runner] = {}

    def register(self, runner: Runner) -> None:
        if runner.id in self._runners:
            raise ValueError(f"Runner id collision: {runner.id!r}")
        self._runners[runner.id] = runner

    def register_all(self, runners: Iterable[Runner]) -> None:
        for r in runners:
            self.register(r)

    def get(self, runner_id: str) -> Runner | None:
        return self._runners.get(runner_id)

    def for_kind(self, kind: StageKind) -> list[Runner]:
        return [r for r in self._runners.values() if kind in r.kinds]

    def labels_for_kind(self, kind: StageKind) -> list[str]:
        return [r.label for r in self.for_kind(kind)]

    def by_label(self, label: str, kind: StageKind) -> Runner | None:
        for r in self.for_kind(kind):
            if r.label == label:
                return r
        return None

    def all(self) -> list[Runner]:
        return list(self._runners.values())
