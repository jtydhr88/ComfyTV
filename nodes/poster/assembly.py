import json
import os
from string import Template

from .discovery import TEMPLATES_DIR, _meta, discover_templates
from .elements import (
    _added_elements,
    _apply_layout,
    _colors_from_layout,
    _effective_elements,
    _fonts_from_layout,
    _removed_ids,
    build_elements_html,
)
from .fonts import FALLBACK_SANS, FALLBACK_SERIF, _font_face
from .text import _placeholder_uri

_REF_H = 1754

_FIT_SCRIPT = """
<script>
window.__pmFit = function () {
  var els = document.querySelectorAll('[data-fit]');
  for (var k = 0; k < els.length; k++) {
    var el = els[k];
    var min = 8, max = parseFloat(getComputedStyle(el).fontSize) || 16;
    var fits = function (s) {
      el.style.fontSize = s + 'px';
      return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
    };
    if (fits(max)) { el.style.fontSize = max + 'px'; continue; }
    var lo = min, hi = max, best = min;
    for (var i = 0; i < 14; i++) {
      var mid = (lo + hi) / 2;
      if (fits(mid)) { best = mid; lo = mid; } else { hi = mid; }
    }
    el.style.fontSize = best + 'px';
  }
};
if (document.fonts && document.fonts.ready) { document.fonts.ready.then(window.__pmFit); }
else { window.__pmFit(); }
</script>
"""


def assemble_context(params, image_uris):
    title_face, title_family = _font_face(
        params.get("font_title"), "PM_Title", FALLBACK_SERIF
    )
    body_face, body_family = _font_face(
        params.get("font_body"), "PM_Body", FALLBACK_SANS
    )

    slots = int(params.get("image_slots", 1) or 1)
    img = list(image_uris or [])
    img_ctx = {}
    for i in range(max(slots, 3)):
        img_ctx[f"image_{i + 1}_src"] = img[i] if i < len(img) else ""

    ctx = {
        "primary_color": params.get("primary_color", "#1a1a1a"),
        "accent_color": params.get("accent_color", "#b8312f"),
        "bg_color": params.get("bg_color", "#f5f0e6"),
        "width": int(params.get("width", 1240)),
        "height": int(params.get("height", 1754)),
        "scale": max(0.1, int(params.get("height", 1754)) / _REF_H),
        "font_title_face": title_face,
        "font_body_face": body_face,
        "font_title_family": title_family,
        "font_body_family": body_family,
        "fallback_uri": _placeholder_uri(),
        "elements_html": "",
    }
    ctx.update(img_ctx)
    return ctx


def build_html(template_name, params, image_uris):
    names = discover_templates()
    if template_name not in names:
        template_name = names[0] if names else None
    if not template_name:
        return "<html><body style='font-family:sans-serif;padding:40px'>" \
               "ComfyTV Poster: no templates found.</body></html>"
    meta = _meta(template_name)
    params = dict(params)
    params.setdefault("image_slots", int(meta.get("image_slots", 1)))
    layout = params.get("layout", "")
    for _k, _v in _colors_from_layout(layout).items():
        params.setdefault(_k, _v)
    for _k, _v in _fonts_from_layout(layout).items():
        if _v:
            params.setdefault(_k, _v)
    labels = _grid_labels_from_layout(layout)
    if labels:
        params.setdefault("grid_labels", labels)
    with open(
        os.path.join(TEMPLATES_DIR, template_name, "template.html"),
        "r",
        encoding="utf-8",
    ) as fh:
        tpl = fh.read()
    ctx = assemble_context(params, image_uris)
    defs = _effective_elements(template_name, params) + _added_elements(layout)
    removed = _removed_ids(layout)
    if removed:
        defs = [d for d in defs if d.get("id") not in removed]
    if defs:
        elements = _apply_layout(defs, layout)
        ctx["elements_html"] = build_elements_html(elements, ctx, image_uris)
    out = Template(tpl).safe_substitute(ctx)
    return out.replace("</body>", _FIT_SCRIPT + "</body>", 1) if "</body>" in out else out + _FIT_SCRIPT


def _grid_labels_from_layout(layout_json):
    try:
        data = json.loads(layout_json) if layout_json else {}
        v = data.get("__grid_labels__", "")
    except Exception:
        return ""
    return v if isinstance(v, str) else ""


def build_html_from_request(data):
    uris = data.get("images")
    if not isinstance(uris, list):
        uris = []
    uris = [str(u) for u in uris if isinstance(u, str) and u]
    return build_html(data.get("template"), data, uris)


def elements_for_request(data):
    data = dict(data or {})
    labels = _grid_labels_from_layout(data.get("layout", ""))
    if labels:
        data.setdefault("grid_labels", labels)
    return _effective_elements(data.get("template", ""), data)
