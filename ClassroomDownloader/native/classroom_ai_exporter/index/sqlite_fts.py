from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Iterable

from .chunker import chunk_text


def _iter_documents(root: Path) -> Iterable[dict[str, Any]]:
    documents_path = root / "index" / "documents.jsonl"
    if documents_path.exists():
        seen: set[str] = set()
        with documents_path.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                document = json.loads(line)
                document_id = str(document.get("id") or document.get("path") or "")
                if document_id and document_id not in seen:
                    seen.add(document_id)
                    yield document
        return

    for markdown_path in root.glob("courses/*/*/*/item.md"):
        yield {
            "id": markdown_path.parent.name,
            "title": markdown_path.parent.name.replace("_", " "),
            "path": markdown_path.relative_to(root).as_posix(),
            "text_path": markdown_path.relative_to(root).as_posix(),
            "course": {"name": markdown_path.parents[2].name.replace("_", " ")},
        }


def rebuild_index(root: str | Path) -> dict[str, int | str]:
    archive_root = Path(root).expanduser().resolve()
    index_dir = archive_root / "index"
    index_dir.mkdir(parents=True, exist_ok=True)
    sqlite_path = index_dir / "search.sqlite"
    chunks_path = index_dir / "chunks.jsonl"

    connection = sqlite3.connect(sqlite_path)
    connection.execute("DROP TABLE IF EXISTS documents")
    connection.execute("DROP TABLE IF EXISTS chunks")
    connection.execute("DROP TABLE IF EXISTS chunks_fts")
    connection.execute(
        "CREATE TABLE documents (id TEXT PRIMARY KEY, title TEXT, course TEXT, path TEXT, source_url TEXT)"
    )
    connection.execute(
        "CREATE TABLE chunks (id TEXT PRIMARY KEY, document_id TEXT, chunk_index INTEGER, text TEXT)"
    )
    connection.execute(
        "CREATE VIRTUAL TABLE chunks_fts USING fts5(id UNINDEXED, document_id UNINDEXED, title, course, text)"
    )

    document_count = 0
    chunk_count = 0
    with chunks_path.open("w", encoding="utf-8") as chunks_file:
        for document in _iter_documents(archive_root):
            text_path = archive_root / document.get("text_path", document.get("path", ""))
            text = text_path.read_text(encoding="utf-8", errors="ignore") if text_path.exists() else ""
            title = str(document.get("title") or "")
            course_name = str((document.get("course") or {}).get("name") or "")
            document_id = str(document.get("id") or document.get("path") or title)
            path = str(document.get("path") or "")
            source_url = str(document.get("source_url") or "")

            connection.execute(
                "INSERT OR REPLACE INTO documents (id, title, course, path, source_url) VALUES (?, ?, ?, ?, ?)",
                (document_id, title, course_name, path, source_url),
            )
            document_count += 1

            for chunk in chunk_text(text):
                chunk_id = f"{document_id}#{chunk.index}"
                record = {
                    "id": chunk_id,
                    "document_id": document_id,
                    "chunk_index": chunk.index,
                    "title": title,
                    "course": course_name,
                    "path": path,
                    "text": chunk.text,
                }
                chunks_file.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
                connection.execute(
                    "INSERT OR REPLACE INTO chunks (id, document_id, chunk_index, text) VALUES (?, ?, ?, ?)",
                    (chunk_id, document_id, chunk.index, chunk.text),
                )
                connection.execute(
                    "INSERT INTO chunks_fts (id, document_id, title, course, text) VALUES (?, ?, ?, ?, ?)",
                    (chunk_id, document_id, title, course_name, chunk.text),
                )
                chunk_count += 1

    connection.commit()
    connection.close()
    return {
        "sqlite": str(sqlite_path),
        "chunks": str(chunks_path),
        "documents": document_count,
        "chunks_count": chunk_count,
    }
