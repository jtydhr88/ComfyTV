from ..bot.documents import capped

DOC_EXT = (".docx", ".md", ".markdown", ".txt")


def document_line(label: str, text: str) -> str:
    return f'[Attached document {label}. Its text:]\n{capped(text)}\n[End of {label}]'
