def _curves(master="", red="", green="", blue=""):
    return {
        "preset": "none",
        "master_pts": master,
        "red_pts": red,
        "green_pts": green,
        "blue_pts": blue,
    }


BUILTIN_PRESETS: dict[str, tuple[dict, ...]] = {
    "ComfyTV.VideoCurvesStage": (
        {"name": "color_negative", "config": _curves(
            red="[[0.129,1],[0.466,0.498],[0.725,0]]",
            green="[[0.109,1],[0.301,0.498],[0.517,0]]",
            blue="[[0.098,1],[0.235,0.498],[0.423,0]]",
        )},
        {"name": "cross_process", "config": _curves(
            red="[[0,0],[0.25,0.156],[0.501,0.501],[0.686,0.745],[1,1]]",
            green="[[0,0],[0.25,0.188],[0.38,0.501],[0.745,0.815],[1,0.815]]",
            blue="[[0,0],[0.231,0.094],[0.709,0.874],[1,1]]",
        )},
        {"name": "darker", "config": _curves(
            master="[[0,0],[0.5,0.4],[1,1]]",
        )},
        {"name": "increase_contrast", "config": _curves(
            master="[[0,0],[0.149,0.066],[0.831,0.905],[0.905,0.98],[1,1]]",
        )},
        {"name": "lighter", "config": _curves(
            master="[[0,0],[0.4,0.5],[1,1]]",
        )},
        {"name": "linear_contrast", "config": _curves(
            master="[[0,0],[0.305,0.286],[0.694,0.713],[1,1]]",
        )},
        {"name": "medium_contrast", "config": _curves(
            master="[[0,0],[0.286,0.219],[0.639,0.643],[1,1]]",
        )},
        {"name": "negative", "config": _curves(
            master="[[0,1],[1,0]]",
        )},
        {"name": "strong_contrast", "config": _curves(
            master="[[0,0],[0.301,0.196],[0.592,0.6],[0.686,0.737],[1,1]]",
        )},
        {"name": "vintage", "config": _curves(
            red="[[0,0.11],[0.42,0.51],[1,0.95]]",
            green="[[0,0],[0.5,0.48],[1,1]]",
            blue="[[0,0.22],[0.49,0.44],[1,0.8]]",
        )},
    ),
}


def builtin_preset_rows(kind: str | None = None) -> list[dict]:
    rows: list[dict] = []
    for k, entries in BUILTIN_PRESETS.items():
        if kind and k != kind:
            continue
        for entry in entries:
            rows.append({
                "id": f"builtin:{k}:{entry['name']}",
                "kind": k,
                "name": entry["name"],
                "config": entry["config"],
                "builtin": True,
                "created_at": None,
            })
    return rows


def builtin_preset_names(kind: str) -> set[str]:
    return {entry["name"] for entry in BUILTIN_PRESETS.get(kind, ())}
