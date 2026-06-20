from __future__ import annotations

import re
import unicodedata
from pathlib import Path

_SAFE_CHARS = re.compile(r"[^A-Za-z0-9._ -]+")
_WHITESPACE = re.compile(r"\s+")


def safe_segment(value: str | None, fallback: str = "untitled", max_length: int = 90) -> str:
    """Return a stable path segment that cannot escape the archive root."""
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = _SAFE_CHARS.sub("_", ascii_value)
    cleaned = _WHITESPACE.sub("_", cleaned).strip("._- ")
    if not cleaned:
        cleaned = fallback
    return cleaned[:max_length].strip("._- ") or fallback


def ensure_relative_archive_path(path: str | Path) -> Path:
    candidate = Path(path)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError(f"Archive paths must be relative and stay inside the root: {path}")
    return candidate


def archive_join(root: Path, *parts: str | Path) -> Path:
    safe_parts = [ensure_relative_archive_path(part) for part in parts]
    joined = root.joinpath(*safe_parts).resolve()
    root_resolved = root.resolve()
    if root_resolved not in [joined, *joined.parents]:
        raise ValueError(f"Path escapes archive root: {joined}")
    return joined
