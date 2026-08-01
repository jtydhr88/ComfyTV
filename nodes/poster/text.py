import html as _html


def _esc(text):
    return _html.escape(str(text or ""))


def _paragraphs(text):
    text = str(text or "").replace("\r\n", "\n").strip()
    if not text:
        return ""
    blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
    return "".join(
        "<p>" + _esc(b).replace("\n", "<br>") + "</p>" for b in blocks
    )


def _placeholder_uri():
    return (
        "data:image/png;base64,"
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
