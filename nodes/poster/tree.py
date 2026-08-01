from .text import _esc


def _parse_tree(text):
    rows = []
    for line in str(text or "").replace("\r\n", "\n").split("\n"):
        stripped = line.lstrip(" \t")
        if not stripped.strip():
            continue
        indent = len(line) - len(stripped)
        rows.append((indent, stripped.strip()))

    out, stack = [], []
    for indent, label in rows:
        while stack and indent <= stack[-1]:
            stack.pop()
        out.append((len(stack), label))
        stack.append(indent)
    return out


def _tree_rows(depths):
    n = len(depths)
    rows = []
    for i, (d, label) in enumerate(depths):
        is_last = True
        for j in range(i + 1, n):
            if depths[j][0] < d:
                break
            if depths[j][0] == d:
                is_last = False
                break
        prefix = ""
        for a in range(d):
            cont = False
            for j in range(i + 1, n):
                if depths[j][0] < a:
                    break
                if depths[j][0] == a:
                    cont = True
                    break
            prefix += "│  " if cont else "   "
        if d > 0:
            prefix += "└─ " if is_last else "├─ "
        rows.append((d, label, prefix))
    return rows


def _render_tree(text, ctx):
    rows = _tree_rows(_parse_tree(text))
    if not rows:
        return ""
    accent = ctx["accent_color"]
    primary = ctx["primary_color"]
    fs = max(8, round(16 * ctx.get("scale", 1.0)))
    lines = []
    for _d, label, prefix in rows:
        lines.append(
            f'<div style="white-space:pre;font-size:{fs}px;line-height:1.75;">'
            f'<span style="color:{accent};">{_esc(prefix)}</span>'
            f'<span style="color:{primary};">{_esc(label)}</span></div>'
        )
    return (
        "<div style=\"font-family:'Cascadia Mono','Consolas','Courier New',"
        f"monospace;\">{''.join(lines)}</div>"
    )
