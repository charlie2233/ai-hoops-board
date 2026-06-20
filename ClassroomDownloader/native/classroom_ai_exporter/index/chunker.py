from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str


def chunk_text(text: str, max_chars: int = 1800, overlap: int = 160) -> list[Chunk]:
    clean = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if not clean:
        return []

    chunks: list[Chunk] = []
    start = 0
    while start < len(clean):
        end = min(start + max_chars, len(clean))
        chunks.append(Chunk(index=len(chunks), text=clean[start:end].strip()))
        if end == len(clean):
            break
        start = max(end - overlap, start + 1)
    return chunks
