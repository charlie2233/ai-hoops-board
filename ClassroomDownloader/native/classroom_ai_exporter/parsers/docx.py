from __future__ import annotations

from pathlib import Path


def extract_docx_text(path: str | Path) -> str:
    from docx import Document

    document = Document(str(path))
    return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
