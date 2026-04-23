from __future__ import annotations

import json
import os
import struct
import sys
from pathlib import Path
from typing import Any, BinaryIO

from .archive.writer import ArchiveWriter
from .index.sqlite_fts import rebuild_index


def default_archive_root() -> Path:
    return Path(os.environ.get("CLASSROOM_AI_ROOT", "~/ClassroomAIExport")).expanduser()


def read_message(stdin: BinaryIO = sys.stdin.buffer) -> dict[str, Any] | None:
    length_bytes = stdin.read(4)
    if not length_bytes:
        return None
    if len(length_bytes) != 4:
        raise ValueError("Native message length prefix was truncated.")
    length = struct.unpack("<I", length_bytes)[0]
    payload = stdin.read(length)
    if len(payload) != length:
        raise ValueError("Native message payload was truncated.")
    return json.loads(payload.decode("utf-8"))


def write_message(message: dict[str, Any], stdout: BinaryIO = sys.stdout.buffer) -> None:
    payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
    stdout.write(struct.pack("<I", len(payload)))
    stdout.write(payload)
    stdout.flush()


def handle_message(message: dict[str, Any], root: Path | None = None) -> dict[str, Any]:
    archive_root = root or default_archive_root()
    message_type = message.get("type")

    if message_type == "ping":
        return {"ok": True, "root": str(archive_root)}

    if message_type == "save_item":
        writer = ArchiveWriter(archive_root)
        paths = writer.save_item(
            course_slug=str(message.get("course_slug") or ""),
            item_slug=str(message.get("item_slug") or ""),
            item=dict(message.get("item") or {}),
            markdown=message.get("markdown") if isinstance(message.get("markdown"), str) else None,
            snapshot=message.get("snapshot") if isinstance(message.get("snapshot"), dict) else None,
            download_jobs=[
                job for job in message.get("download_jobs", []) if isinstance(job, dict)
            ],
            area=str(message.get("area") or "classwork"),
        )
        index = rebuild_index(archive_root)
        return {"ok": True, "root": str(archive_root), "paths": paths, "index": index}

    if message_type == "record_download_results":
        writer = ArchiveWriter(archive_root)
        paths = writer.record_download_results(
            item_dir=str(message.get("item_dir") or ""),
            item_id=str(message.get("item_id") or ""),
            results=[result for result in message.get("results", []) if isinstance(result, dict)],
        )
        return {"ok": True, "root": str(archive_root), "paths": paths}

    if message_type == "rebuild_index":
        index = rebuild_index(archive_root)
        return {"ok": True, "root": str(archive_root), "index": index}

    if message_type == "show_export_health":
        documents = archive_root / "index" / "documents.jsonl"
        sqlite_index = archive_root / "index" / "search.sqlite"
        document_count = 0
        if documents.exists():
            with documents.open(encoding="utf-8") as handle:
                document_count = sum(1 for line in handle if line.strip())
        return {
            "ok": True,
            "root": str(archive_root),
            "exists": archive_root.exists(),
            "documents_index": str(documents),
            "documents_index_exists": documents.exists(),
            "documents": document_count,
            "sqlite_index": str(sqlite_index),
            "sqlite_index_exists": sqlite_index.exists(),
        }

    return {"ok": False, "error": f"Unsupported native host message type: {message_type}"}


def main() -> int:
    while True:
        try:
            message = read_message()
            if message is None:
                return 0
            write_message(handle_message(message))
        except Exception as exc:  # Native hosts must answer instead of crashing Chrome's pipe.
            write_message({"ok": False, "error": str(exc)})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
