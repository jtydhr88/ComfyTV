import json


def make_workflow(tmp_path, name="sd15", kind="image", preset=None):
    kind_dir = tmp_path / kind
    kind_dir.mkdir(parents=True, exist_ok=True)
    (kind_dir / f"{name}.json").write_text(json.dumps({"nodes": []}))
    if preset is not None:
        (kind_dir / f"{name}_preset.json").write_text(json.dumps(preset))
    return str(kind_dir), name
