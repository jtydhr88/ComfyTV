from ....runners import RUNNER_REGISTRY, workflow_db


def labels_for(kind: str) -> list[str]:
    return RUNNER_REGISTRY.labels_for_kind(kind)


def default_for(kind: str) -> str:
    labels = RUNNER_REGISTRY.labels_for_kind(kind)
    if not labels:
        return ""
    try:
        chosen = workflow_db.get_default_label(kind)
    except Exception:
        chosen = None
    if chosen and chosen in labels:
        return chosen
    return labels[0]
