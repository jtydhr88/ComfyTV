import json

import pytest

from ComfyTV.nodes.poster import assembly, charts, discovery, elements, fonts, text, tree


def test_esc_and_paragraphs():
    assert text._esc("<b>&") == "&lt;b&gt;&amp;"
    assert text._paragraphs("") == ""
    assert text._paragraphs("a\n\nb") == "<p>a</p><p>b</p>"
    assert text._paragraphs("a\nb") == "<p>a<br>b</p>"


def test_placeholder_uri_is_data_png():
    assert text._placeholder_uri().startswith("data:image/png;base64,")


def test_parse_chart_data():
    rows = charts._parse_chart_data("a | 3\nb|1.5\nc\n\n")
    assert [(r[0], r[1]) for r in rows] == [("a", 3.0), ("b", 1.5), ("c", None)]


def test_render_bars_scales_to_max():
    ctx = {"accent_color": "#f00", "primary_color": "#000",
           "font_body_family": "sans-serif", "scale": 1.0}
    html = charts._render_bars("a | 2\nb | 1", ctx)
    assert "width:100.0%" in html
    assert "width:50.0%" in html
    assert charts._render_bars("", ctx) == ""


def test_resolve_color_tokens():
    ctx = {"accent_color": "#a", "primary_color": "#p", "bg_color": "#b"}
    assert charts._resolve_color("accent", ctx, "#d") == "#a"
    assert charts._resolve_color("none", ctx, "#d") == "transparent"
    assert charts._resolve_color("#123456", ctx, "#d") == "#123456"
    assert charts._resolve_color("", ctx, "#d") == "#d"


def test_tree_parse_and_guides():
    rows = tree._parse_tree("root\n  a\n    a1\n  b")
    assert rows == [(0, "root"), (1, "a"), (2, "a1"), (1, "b")]
    guided = tree._tree_rows(rows)
    assert guided[1][2].endswith("├─ ")
    assert guided[3][2].endswith("└─ ")
    html = tree._render_tree("x\n  y", {"accent_color": "#a", "primary_color": "#p", "scale": 1.0})
    assert "└─" in html and "y" in html


def test_discover_templates_and_meta():
    names = discovery.discover_templates()
    assert "hero" in names and "sidebar" in names and "infographic" in names
    metas = discovery.discover_templates_meta()
    hero = next(m for m in metas if m["name"] == "hero")
    assert hero["label"]
    assert hero["image_slots"] == 1


def test_effective_elements_static():
    els = elements.discover_elements("hero")
    ids = [e["id"] for e in els]
    assert "title" in ids and "visual" in ids


def test_apply_layout_overrides():
    defs = [{"id": "a", "type": "text", "x": 0.1, "font_size": 10}]
    merged = elements._apply_layout(defs, json.dumps({"a": {"x": 0.5, "font_size": 40}}))
    assert merged[0]["x"] == 0.5
    assert merged[0]["font_size"] == 40
    assert elements._apply_layout(defs, "junk")[0]["x"] == 0.1


def test_added_and_removed_elements():
    layout = json.dumps({
        "__added__": [{"id": "u1", "type": "shape"}, {"bad": 1}],
        "__removed__": ["visual"],
    })
    assert [e["id"] for e in elements._added_elements(layout)] == ["u1"]
    assert elements._removed_ids(layout) == {"visual"}
    assert elements._added_elements("junk") == []
    assert elements._removed_ids("junk") == set()


def test_colors_and_fonts_from_layout():
    layout = json.dumps({
        "__colors__": {"bg_color": "#ffffff", "accent_color": "red"},
        "__fonts__": {"font_title": "A.ttf", "font_body": 3},
    })
    colors = elements._colors_from_layout(layout)
    assert colors["bg_color"] == "#ffffff"
    assert colors["accent_color"] == elements.DEFAULT_COLORS["accent_color"]
    fonts_map = elements._fonts_from_layout(layout)
    assert fonts_map["font_title"] == "A.ttf"
    assert fonts_map["font_body"] == ""


def test_generate_grid_elements_uses_labels(tmp_path, monkeypatch):
    monkeypatch.setattr(discovery, "TEMPLATES_DIR", str(tmp_path))
    d = tmp_path / "grid"
    d.mkdir()
    (d / "template.html").write_text("<html><body>${elements_html}</body></html>", encoding="utf-8")
    (d / "meta.json").write_text(json.dumps({"dynamic": "grid", "grid": {"cols": 3}}), encoding="utf-8")
    els = elements.discover_elements("grid", {"grid_labels": "一\n二\n三\n四"})
    cells = [e for e in els if e["type"] == "cell"]
    assert len(cells) == 4
    assert cells[0]["label"] == "一"


def test_build_elements_html_variants():
    ctx = assembly.assemble_context({"width": 1000, "height": 1754}, ["data:image/png;base64,AA"])
    els = [
        {"id": "t", "type": "text", "text": "hi", "font": "title", "font_size": 20, "align": "center"},
        {"id": "nofit", "type": "text", "text": "x", "fit": False},
        {"id": "img", "type": "image", "slot": 0, "img_scale": 2, "img_x": 0.1},
        {"id": "img2", "type": "image", "slot": 5},
        {"id": "line", "type": "shape", "shape": "line", "w": 0.5, "h": 0.01},
        {"id": "ell", "type": "shape", "shape": "ellipse", "fill": "accent"},
        {"id": "cell", "type": "cell", "slot": 0, "label": "cap"},
        {"id": "bars", "type": "bars", "data": "a | 1"},
        {"id": "tr", "type": "tree", "data": "a\n  b"},
    ]
    html = elements.build_elements_html(els, ctx, ["data:image/png;base64,AA"])
    assert 'data-el="t"' in html and "data-fit" in html
    rot_html = elements.build_elements_html(
        [{"id": "r", "type": "text", "text": "x", "rot": 15}], ctx, [])
    assert "rotate(15.000deg)" in rot_html
    merged = elements._apply_layout(
        [{"id": "r", "type": "text"}], json.dumps({"r": {"rot": 30}}))
    assert merged[0]["rot"] == 30
    assert 'data-el="nofit"' in html
    assert html.count("data-fit") == 1
    assert "scale(2)" in html
    assert 'data-el="img2"' in html and html.count("<img") == 1
    assert "border-radius:50%" in html
    assert "cap" in html


def test_build_html_substitutes_and_appends_fit():
    layout = json.dumps({"__colors__": {"bg_color": "#123456"}})
    html = assembly.build_html("hero", {"width": 800, "height": 1200, "layout": layout}, [])
    assert "#123456" in html
    assert "__pmFit" in html
    assert "${" not in html
    assert 'data-el="title"' in html


def test_build_html_unknown_template_falls_back():
    html = assembly.build_html("nope", {"width": 800, "height": 1200}, [])
    assert "<html" in html


def test_build_html_from_request_uses_images_list():
    uri = "data:image/png;base64,QQ=="
    html = assembly.build_html_from_request({
        "template": "hero", "width": 800, "height": 1200,
        "layout": "{}", "images": [uri, 42, None],
    })
    assert uri in html


def test_grid_labels_flow_from_layout(tmp_path, monkeypatch):
    monkeypatch.setattr(discovery, "TEMPLATES_DIR", str(tmp_path))
    monkeypatch.setattr(assembly, "TEMPLATES_DIR", str(tmp_path))
    d = tmp_path / "grid"
    d.mkdir()
    (d / "template.html").write_text("<html><body>${elements_html}</body></html>", encoding="utf-8")
    (d / "meta.json").write_text(json.dumps({"dynamic": "grid", "grid": {"cols": 2}}), encoding="utf-8")
    layout = json.dumps({"__grid_labels__": "甲\n乙"})
    els = assembly.elements_for_request({"template": "grid", "layout": layout})
    cells = [e for e in els if e["type"] == "cell"]
    assert [c["label"] for c in cells] == ["甲", "乙"]
    html = assembly.build_html("grid", {"width": 800, "height": 800, "layout": layout}, [])
    assert "甲" in html


def test_font_face_system_fallback():
    face, family = fonts._font_face(None, "PM_Title", fonts.FALLBACK_SERIF)
    assert face == ""
    assert family == fonts.FALLBACK_SERIF
    face, family = fonts._font_face(fonts.SYSTEM_FONT, "PM_Title", fonts.FALLBACK_SERIF)
    assert face == ""


def test_font_face_embeds_resource(tmp_path, monkeypatch):
    p = tmp_path / "My Font.ttf"
    p.write_bytes(b"\x00\x01fontdata")
    monkeypatch.setattr(fonts, "_resource_font_path", lambda name: p if name == "My Font.ttf" else None)
    face, family = fonts._font_face("My Font.ttf", "PM_Body", fonts.FALLBACK_SANS)
    assert "@font-face" in face
    assert "font/ttf" in face
    assert family.startswith("'PM_Body',")
    face2, family2 = fonts._font_face("missing.ttf", "PM_Body", fonts.FALLBACK_SANS)
    assert face2 == "" and family2 == fonts.FALLBACK_SANS


def test_discover_fonts_lists_resources(monkeypatch):
    import ComfyTV.storage as storage
    monkeypatch.setattr(storage, "list_resources",
                        lambda kind: [{"filename": "A.ttf"}, {"filename": "B.otf"}] if kind == "font" else [])
    out = fonts.discover_fonts()
    assert out[0] == fonts.SYSTEM_FONT
    assert "A.ttf" in out and "B.otf" in out


def test_poster_stage_execute(monkeypatch, tmp_path):
    from ComfyTV.nodes.stages import poster as poster_stage

    src = tmp_path / "in.png"
    src.write_bytes(b"\x89PNG\r\n\x1a\nfake")

    monkeypatch.setattr(poster_stage, "view_url_to_path",
                        lambda url: src if url == "/view?filename=in.png" else None)

    rendered = {}

    class _Worker:
        def render(self, html, width, height, scale=1):
            rendered["html"] = html
            rendered["size"] = (width, height)
            return b"pngbytes"

    monkeypatch.setattr(poster_stage.poster_lib, "get_worker", lambda: _Worker())
    monkeypatch.setattr(poster_stage, "_save_poster_png", lambda png: "/view?filename=out.png&type=output")

    emitted = {}

    def _fake_emit(cls, **kw):
        emitted.update(kw)
        return "NODE_OUTPUT"

    monkeypatch.setattr(poster_stage, "_stage_emit_auto", _fake_emit)

    out = poster_stage.PosterStage.execute(
        project_id="p1", template="hero", width=800, height=1200,
        layout="{}", images={"image0": "/view?filename=in.png", "image1": None},
    )
    assert out == "NODE_OUTPUT"
    assert emitted["payload_str"] == "/view?filename=out.png&type=output"
    assert emitted["params"]["template"] == "hero"
    assert rendered["size"] == (800, 1200)
    assert "data:image/png;base64," in rendered["html"]


def test_renderer_guard_message():
    from ComfyTV.nodes.poster import renderer

    w = object.__new__(renderer._RenderWorker)
    w._err = RuntimeError("no playwright")
    with pytest.raises(RuntimeError, match="playwright"):
        w._guard()
