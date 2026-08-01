import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(_HERE, "templates")


def discover_templates():
    if not os.path.isdir(TEMPLATES_DIR):
        return []
    names = []
    for entry in sorted(os.listdir(TEMPLATES_DIR)):
        if os.path.isfile(os.path.join(TEMPLATES_DIR, entry, "template.html")):
            names.append(entry)
    return names


def _meta(name):
    path = os.path.join(TEMPLATES_DIR, name, "meta.json")
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            pass
    return {}


def discover_templates_meta():
    out = []
    for name in discover_templates():
        m = _meta(name)
        out.append(
            {
                "name": name,
                "label": m.get("label", name),
                "image_slots": int(m.get("image_slots", 1)),
                "description": m.get("description", ""),
            }
        )
    return out
