from .text import _esc


def _resolve_color(token, ctx, default):
    if not token:
        return default
    table = {
        "accent": ctx["accent_color"], "primary": ctx["primary_color"],
        "bg": ctx["bg_color"], "muted": "#6b6255", "none": "transparent",
    }
    return table.get(token, token)


def _parse_chart_data(text):
    out = []
    for line in str(text or "").replace("\r\n", "\n").split("\n"):
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        val = None
        if len(parts) > 1:
            try:
                val = float(parts[1])
            except ValueError:
                val = None
        out.append((parts[0], val, line))
    return out


def _render_bars(text, ctx):
    items = _parse_chart_data(text)
    if not items:
        return ""
    vals = [v for (_l, v, _r) in items if v is not None]
    mx = max(vals) if vals else 1.0
    accent = ctx["accent_color"]
    s = ctx.get("scale", 1.0)
    lf = max(8, round(14 * s))
    vf = max(8, round(13 * s))
    bh = max(6, round(14 * s))
    rd = max(3, round(7 * s))
    rows = []
    for label, val, _raw in items:
        pct = (val / mx * 100.0) if (val is not None and mx) else 0.0
        valtxt = f"{val:g}" if val is not None else ""
        rows.append(
            '<div style="display:flex;align-items:center;gap:10px;margin:5px 0;">'
            f'<span style="flex:0 0 32%;text-align:right;font-size:{lf}px;'
            'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
            f'{_esc(label)}</span>'
            f'<span style="flex:1;height:{bh}px;background:rgba(0,0,0,.07);'
            f'border-radius:{rd}px;overflow:hidden;">'
            f'<span style="display:block;height:100%;width:{pct:.1f}%;'
            f'background:{accent};border-radius:{rd}px;"></span></span>'
            f'<span style="flex:0 0 auto;font-size:{vf}px;color:#6b6255;'
            f'min-width:{max(16, round(26 * s))}px;">{_esc(valtxt)}</span></div>'
        )
    return (
        '<div style="display:flex;flex-direction:column;justify-content:center;'
        f'height:100%;font-family:{ctx["font_body_family"]};'
        f'color:{ctx["primary_color"]};">{"".join(rows)}</div>'
    )
