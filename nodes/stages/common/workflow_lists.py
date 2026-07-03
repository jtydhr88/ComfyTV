from ....runners import RUNNER_REGISTRY


def labels_for(kind: str) -> list[str]:
    return RUNNER_REGISTRY.labels_for_kind(kind)


def default_for(kind: str) -> str:
    labels = RUNNER_REGISTRY.labels_for_kind(kind)
    return labels[0] if labels else ""
