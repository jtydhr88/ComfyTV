from pathlib import Path


def test_only_main_js_is_a_plain_js_file_under_js():
    root = Path(__file__).resolve().parents[1] / "js"
    plain = sorted(p.relative_to(root).as_posix() for p in root.rglob("*.js"))
    assert plain == ["main.js"], (
        "ComfyUI auto-imports every js/**/*.js as an extension entry; "
        f"emit workers and chunks as .mjs instead: {plain}")
