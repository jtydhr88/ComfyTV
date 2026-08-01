import json
import math

from .charts import _render_bars, _resolve_color
from .discovery import _meta
from .text import _esc, _paragraphs
from .tree import _render_tree


def _grid_label_list(params):
    return [
        ln.strip()
        for ln in str(params.get("grid_labels", "")).replace("\r\n", "\n").split("\n")
        if ln.strip()
    ]


def generate_grid_elements(template_name, params):
    g = _meta(template_name).get("grid", {})
    pad = float(g.get("pad", 0.06))
    header = float(g.get("header", 0.15))
    gap = float(g.get("gap", 0.018))
    labels = _grid_label_list(params)
    n = len(labels) or int(g.get("default_n", 12))
    cols = int(g.get("cols", 0)) or max(1, math.ceil(math.sqrt(n)))
    rows = max(1, math.ceil(n / cols))

    cx, cw = pad, 1 - 2 * pad
    cy, ch = pad + header, 1 - (pad + header) - pad
    cell_w = (cw - gap * (cols - 1)) / cols
    cell_h = (ch - gap * (rows - 1)) / rows

    els = [
        {"id": "title", "type": "text", "bind": "title", "label": "标题",
         "x": pad, "y": pad * 0.5, "w": cw * 0.62, "h": header * 0.62,
         "font": "title", "font_size": 64, "align": "left"},
        {"id": "subtitle", "type": "text", "bind": "subtitle", "label": "副标题",
         "x": pad + cw * 0.64, "y": pad * 0.7, "w": cw * 0.36, "h": header * 0.5,
         "font": "title", "font_size": 24, "align": "right", "color": "accent"},
    ]
    for i in range(n):
        r, c = divmod(i, cols)
        els.append({
            "id": f"cell{i}", "type": "cell", "slot": i,
            "label": labels[i] if i < len(labels) else f"图位 {i + 1}",
            "x": cx + c * (cell_w + gap), "y": cy + r * (cell_h + gap),
            "w": cell_w, "h": cell_h,
        })
    return els


def _effective_elements(template_name, params):
    meta = _meta(template_name)
    if meta.get("dynamic") == "grid":
        return generate_grid_elements(template_name, params)
    return meta.get("elements", [])


def discover_elements(template_name, params=None):
    return _effective_elements(template_name, params or {})


def _apply_layout(defs, layout_json):
    try:
        overrides = json.loads(layout_json) if layout_json else {}
    except Exception:
        overrides = {}
    merged = []
    for d in defs:
        el = dict(d)
        ov = overrides.get(d.get("id")) or {}
        for k in ("x", "y", "w", "h", "z", "rot", "slot", "data", "label", "text",
                  "shape", "fill", "stroke", "align", "font_size", "font", "color", "fit",
                  "columns", "img_scale", "img_x", "img_y"):
            if k in ov:
                el[k] = ov[k]
        merged.append(el)
    return merged


def _added_elements(layout_json):
    try:
        data = json.loads(layout_json) if layout_json else {}
        added = data.get("__added__", [])
    except Exception:
        return []
    if not isinstance(added, list):
        return []
    return [el for el in added if isinstance(el, dict) and el.get("id") and el.get("type")]


def _removed_ids(layout_json):
    try:
        data = json.loads(layout_json) if layout_json else {}
        rm = data.get("__removed__", [])
    except Exception:
        return set()
    return set(rm) if isinstance(rm, list) else set()


DEFAULT_COLORS = {
    "primary_color": "#1f1b16",
    "accent_color": "#9c2b2b",
    "bg_color": "#f4ece0",
}


def _colors_from_layout(layout_json):
    try:
        data = json.loads(layout_json) if layout_json else {}
        c = data.get("__colors__", {})
    except Exception:
        c = {}
    if not isinstance(c, dict):
        c = {}
    out = {}
    for k, dflt in DEFAULT_COLORS.items():
        v = c.get(k)
        out[k] = v if isinstance(v, str) and v.startswith("#") else dflt
    return out


def _fonts_from_layout(layout_json):
    try:
        data = json.loads(layout_json) if layout_json else {}
        f = data.get("__fonts__", {})
    except Exception:
        f = {}
    if not isinstance(f, dict):
        f = {}
    out = {}
    for k in ("font_title", "font_body"):
        v = f.get(k)
        out[k] = v if isinstance(v, str) else ""
    return out


def build_elements_html(elements, ctx, image_uris):
    parts = []
    s = ctx.get("scale", 1.0)
    for el in elements:
        x = float(el.get("x", 0)); y = float(el.get("y", 0))
        w = float(el.get("w", 0.2)); h = float(el.get("h", 0.2))
        style = (
            f"position:absolute;left:{x * 100:.3f}%;top:{y * 100:.3f}%;"
            f"width:{w * 100:.3f}%;height:{h * 100:.3f}%;"
            f"z-index:{int(el.get('z', 1))};overflow:hidden;"
        )
        try:
            rot_deg = float(el.get("rot", 0) or 0)
        except (TypeError, ValueError):
            rot_deg = 0.0
        if rot_deg:
            style += (f"transform:rotate({rot_deg:.3f}deg);"
                      "transform-origin:center center;")
        bind = el.get("bind", "")
        etype = el.get("type", "text")
        inner = ""
        if etype == "cell":
            slot = int(el.get("slot", 0) or 0)
            uri = image_uris[slot] if 0 <= slot < len(image_uris) else ""
            cap = _esc(el.get("label", ""))
            style += "display:flex;flex-direction:column;"
            box = (
                "flex:1 1 auto;border-radius:2px;min-height:0;"
                + ("background:#d8cebd center/cover no-repeat;background-image:url('"
                   + uri + "');" if uri
                   else "background:#e7ddcd;border:1.5px dashed #b9ad97;")
            )
            inner = (
                f'<div style="{box}"></div>'
                f'<div style="flex:0 0 auto;margin-top:6px;text-align:center;'
                f'font-size:{max(8, round(15 * s))}px;line-height:1.25;'
                f'font-family:{ctx["font_body_family"]};">{cap}</div>'
            )
        elif etype == "image":
            slot = el.get("slot")
            if slot is None:
                slot = int(bind.split(":")[1]) if bind.startswith("image:") else 0
            slot = int(slot)
            uri = image_uris[slot] if 0 <= slot < len(image_uris) else ""
            style += "background:#d8cebd;border-radius:2px;"
            if uri:
                isc = float(el.get("img_scale", 1) or 1)
                ix = float(el.get("img_x", 0) or 0) * 100
                iy = float(el.get("img_y", 0) or 0) * 100
                inner = (
                    f'<img src="{uri}" draggable="false" style="position:absolute;'
                    f'left:0;top:0;width:100%;height:100%;object-fit:cover;'
                    f'object-position:center;pointer-events:none;transform-origin:center center;'
                    f'transform:translate({ix:.3f}%,{iy:.3f}%) scale({isc:g});" />'
                )
        elif etype == "shape":
            shp = el.get("shape", "rect")
            sw = float(el.get("stroke_width", 3)) * s
            stroke_tok = el.get("stroke", "primary")
            stroke = _resolve_color(stroke_tok, ctx, ctx["primary_color"])
            if shp == "line":
                style += "display:flex;align-items:center;justify-content:center;"
                if w >= h:
                    inner = (f'<div style="width:100%;height:{sw:g}px;'
                             f'background:{stroke};border-radius:{sw:g}px;"></div>')
                else:
                    inner = (f'<div style="height:100%;width:{sw:g}px;'
                             f'background:{stroke};border-radius:{sw:g}px;"></div>')
            else:
                fill = _resolve_color(el.get("fill", "none"), ctx, "transparent")
                radius = "50%" if shp == "ellipse" else f"{float(el.get('radius', 0)) * s:g}px"
                border = "none" if stroke_tok == "none" else f"{sw:g}px solid {stroke}"
                style += f"background:{fill};border:{border};border-radius:{radius};"
        elif etype == "bars":
            inner = _render_bars(el.get("data", ""), ctx)
        elif etype == "tree":
            inner = _render_tree(el.get("data", ""), ctx)
        else:
            inner = _paragraphs(el["text"]) if "text" in el else ctx.get(bind or "title", "")
            fam = el.get("font", "body")
            style += "font-family:" + (
                ctx["font_title_family"] if fam == "title" else ctx["font_body_family"]
            ) + ";"
            if el.get("font_size"):
                style += f"font-size:{max(8, round(el['font_size'] * s))}px;"
            if el.get("line_height"):
                style += f"line-height:{el['line_height']};"
            if el.get("align"):
                style += f"text-align:{el['align']};"
            if el.get("columns"):
                style += f"columns:{int(el['columns'])};column-gap:{round(40 * s)}px;"
            if el.get("letter_spacing"):
                style += f"letter-spacing:{el['letter_spacing']};"
            if el.get("uppercase"):
                style += "text-transform:uppercase;"
            if el.get("center"):
                style += "display:flex;align-items:center;justify-content:center;text-align:center;"
            if el.get("border"):
                bw = max(1, round(float(el.get("border_width", 3)) * s))
                style += f"border:{bw}px solid {_resolve_color(el['border'], ctx, ctx['primary_color'])};"
                if el.get("radius"):
                    style += f"border-radius:{round(float(el['radius']) * s)}px;"
            if el.get("color") == "accent":
                style += f"color:{ctx['accent_color']};"
            elif el.get("color") == "muted":
                style += "color:#6b6255;"
        fit_attr = ' data-fit="1"' if etype == "text" and el.get("fit", True) else ""
        parts.append(
            f'<div class="pm-el pm-{etype}" style="{style}" '
            f'data-el="{el.get("id")}"{fit_attr}>{inner}</div>'
        )
    return "\n".join(parts)
