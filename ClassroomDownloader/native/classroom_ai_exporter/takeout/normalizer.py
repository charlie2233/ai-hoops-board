from __future__ import annotations

from pathlib import Path


def discover_takeout_files(path: str | Path) -> list[Path]:
    root = Path(path).expanduser()
    if root.is_file():
        return [root]
    return sorted(
        candidate
        for candidate in root.rglob("*")
        if candidate.is_file() and candidate.suffix.lower() in {".json", ".html", ".txt", ".csv", ".pdf"}
    )
