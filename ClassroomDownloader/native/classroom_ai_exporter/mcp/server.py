from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from ..index.sqlite_fts import rebuild_index as rebuild_sqlite_index

try:
    from fastmcp import FastMCP
except Exception:  # The CLI fallback keeps tests and local inspection dependency-light.
    FastMCP = None  # type: ignore[assignment]


def archive_root() -> Path:
    return Path(os.environ.get("CLASSROOM_AI_ROOT", "~/CourseBinderArchive")).expanduser().resolve()


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                records.append(json.loads(line))
    return records


def _documents(root: Path) -> list[dict[str, Any]]:
    documents = _read_jsonl(root / "index" / "documents.jsonl")
    if documents:
        return documents
    fallback = []
    for path in root.glob("courses/*/*/*/item.md"):
        fallback.append(
            {
                "id": path.parent.name,
                "title": path.parent.name.replace("_", " "),
                "path": path.relative_to(root).as_posix(),
                "course": {"name": path.parents[2].name.replace("_", " ")},
                "source_url": "",
            }
        )
    return fallback


def search_archive(query: str, limit: int = 10) -> list[dict[str, Any]]:
    root = archive_root()
    sqlite_path = root / "index" / "search.sqlite"
    if sqlite_path.exists():
        connection = sqlite3.connect(sqlite_path)
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT document_id, title, course, snippet(chunks_fts, 4, '[', ']', '...', 16) AS snippet
            FROM chunks_fts
            WHERE chunks_fts MATCH ?
            LIMIT ?
            """,
            (query, limit),
        ).fetchall()
        connection.close()
        return [dict(row) for row in rows]

    lowered = query.lower()
    results = []
    for document in _documents(root):
        path = root / str(document.get("path", ""))
        text = path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""
        haystack = f"{document.get('title', '')}\n{text}".lower()
        if lowered in haystack:
            results.append(
                {
                    "id": document.get("id"),
                    "title": document.get("title"),
                    "course": (document.get("course") or {}).get("name"),
                    "path": document.get("path"),
                    "snippet": text[:400],
                }
            )
        if len(results) >= limit:
            break
    return results


def fetch_document(document_id: str, max_chars: int = 12000) -> dict[str, Any]:
    root = archive_root()
    for document in _documents(root):
        if document.get("id") == document_id or document.get("path") == document_id:
            path = root / str(document.get("text_path") or document.get("path"))
            text = path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""
            return {"document": document, "text": text[:max_chars], "truncated": len(text) > max_chars}
    return {"error": f"Document not found: {document_id}"}


def list_courses() -> list[dict[str, Any]]:
    courses: dict[str, dict[str, Any]] = {}
    for document in _documents(archive_root()):
        course = document.get("course") or {}
        name = str(course.get("name") or "Unknown course")
        courses.setdefault(name, {"name": name, "documents": 0})
        courses[name]["documents"] += 1
    return sorted(courses.values(), key=lambda row: row["name"])


def list_assignments(course: str | None = None, due_before: str | None = None) -> list[dict[str, Any]]:
    root = archive_root()
    assignments = []
    for document in _documents(root):
        doc_course = str((document.get("course") or {}).get("name") or "")
        if course and course.lower() not in doc_course.lower():
            continue
        item_json = root / str(document.get("path", "")).replace("item.md", "item.json")
        item = json.loads(item_json.read_text(encoding="utf-8")) if item_json.exists() else document
        if item.get("entity_type") not in {"coursework", "assignment", "page"}:
            continue
        due_raw = (item.get("due") or {}).get("raw", "") if isinstance(item.get("due"), dict) else ""
        if due_before and due_raw and due_raw > due_before:
            continue
        assignments.append(
            {
                "id": item.get("id"),
                "title": item.get("title"),
                "course": doc_course,
                "due": due_raw,
                "path": document.get("path"),
            }
        )
    return assignments


def list_due_soon(days: int = 7) -> list[dict[str, Any]]:
    return list_assignments()[: max(days, 0) * 10]


def read_attachment(id_or_path: str, max_chars: int = 12000) -> dict[str, Any]:
    root = archive_root()
    candidate = (root / id_or_path).resolve()
    if root not in [candidate, *candidate.parents]:
        return {"error": "Attachment path escapes archive root."}
    if not candidate.exists():
        return {"error": f"Attachment not found: {id_or_path}"}
    if candidate.is_dir():
        return {"error": "Attachment path is a directory."}
    text = candidate.read_text(encoding="utf-8", errors="ignore")
    return {"path": id_or_path, "text": text[:max_chars], "truncated": len(text) > max_chars}


def show_export_health() -> dict[str, Any]:
    root = archive_root()
    documents = _documents(root)
    return {
        "root": str(root),
        "exists": root.exists(),
        "documents": len(documents),
        "sqlite_index": str(root / "index" / "search.sqlite"),
        "sqlite_index_exists": (root / "index" / "search.sqlite").exists(),
    }


def rebuild_index() -> dict[str, Any]:
    return rebuild_sqlite_index(archive_root())


if FastMCP is not None:
    mcp = FastMCP("classroom_ai")
    mcp.tool()(search_archive)
    mcp.tool()(fetch_document)
    mcp.tool()(list_courses)
    mcp.tool()(list_assignments)
    mcp.tool()(list_due_soon)
    mcp.tool()(read_attachment)
    mcp.tool()(show_export_health)
    mcp.tool()(rebuild_index)
else:
    mcp = None


def main() -> int:
    if mcp is None:
        print(json.dumps(show_export_health(), indent=2))
        return 0
    mcp.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
