from __future__ import annotations

import json
from pathlib import Path

from .normalizer import discover_takeout_files


def import_takeout_manifest(path: str | Path) -> dict[str, object]:
    files = discover_takeout_files(path)
    return {
        "source": str(Path(path).expanduser()),
        "file_count": len(files),
        "files": [str(file) for file in files[:500]],
        "status": "discovered",
    }


def write_takeout_manifest(path: str | Path, output: str | Path) -> Path:
    manifest = import_takeout_manifest(path)
    destination = Path(output).expanduser()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination
