from typing import Any


def _combine_prompt(main_prompt: str, extras: list, sep: str = ", ") -> str:
    parts: list[str] = []
    mp = (main_prompt or "").strip()
    if mp:
        parts.append(mp)
    for x in extras or []:
        s = str(x or "").strip()
        if s:
            parts.append(s)
    return sep.join(parts)


_MULTIANGLE_AZIMUTHS = [
    (0,   "front view"),
    (45,  "front-right quarter view"),
    (90,  "right side view"),
    (135, "back-right quarter view"),
    (180, "back view"),
    (225, "back-left quarter view"),
    (270, "left side view"),
    (315, "front-left quarter view"),
]


def _multiangle_prompt(horizontal: int, vertical: int, zoom: float,
                       extra: str = "") -> str:

    az = int(horizontal or 0) % 360
    az_kw = min(_MULTIANGLE_AZIMUTHS,
                key=lambda kv: min(abs(az - kv[0]), 360 - abs(az - kv[0])))[1]

    el = int(vertical or 0)
    if el <= -15:   el_kw = "low-angle shot"
    elif el <= 15:  el_kw = "eye-level shot"
    elif el <= 45:  el_kw = "elevated shot"
    else:           el_kw = "high-angle shot"

    z = float(zoom or 0)
    if   z >= 7.0: dist_kw = "close-up"
    elif z >= 3.0: dist_kw = "medium shot"
    else:          dist_kw = "wide shot"

    base = f"<sks> {az_kw} {el_kw} {dist_kw}"
    extra = (extra or "").strip()
    return f"{base}, {extra}" if extra else base


def _relight_prompt(brightness: int, color: str, rim_light: bool,
                    extra: str = "", has_reference: bool = False) -> str:

    parts: list[str] = []
    parts.append("transfer the lighting from the reference image onto the subject"
                 if has_reference else "relight the image")

    b = int(brightness if brightness is not None else 50)
    if   b < 25: parts.append("with dim, low-light atmosphere")
    elif b < 50: parts.append("with soft, muted lighting")
    elif b < 75: parts.append("with bright, natural lighting")
    else:        parts.append("with bright, high-key lighting")

    color = (color or "#ffffff").strip().lower()
    if color not in ("#ffffff", "#fff", ""):
        parts.append(f"tinted with light color {color}")

    if rim_light:
        parts.append("with a subtle rim light separating the subject from the background")

    extra = (extra or "").strip()
    if extra:
        parts.append(extra)

    return (", ".join(parts) +
            ". Preserve the subject's identity, geometry, and details; "
            "only change lighting and shadows.")
