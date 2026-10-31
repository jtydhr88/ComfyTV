from ....runners import RUNNER_REGISTRY, workflow_db


def labels_for(kind: str) -> list[str]:
    labels = RUNNER_REGISTRY.labels_for_kind(kind)
    try:
        chosen = workflow_db.get_default_label(kind)
        favorites = workflow_db.get_favorite_labels().get(kind, [])
    except Exception:
        chosen, favorites = None, []
    pinned = [label for label in labels if label in favorites]
    pinned.sort(key=lambda label: label != chosen)
    return pinned + [label for label in labels if label not in favorites]


def default_for(kind: str) -> str:
    labels = labels_for(kind)
    return labels[0] if labels else ""
