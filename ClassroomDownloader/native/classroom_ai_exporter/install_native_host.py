from __future__ import annotations

import argparse
import json
import os
import stat
import sys
from pathlib import Path

HOST_NAME = "com.classroom_ai_exporter.host"


def chrome_manifest_dir() -> Path:
    return Path("~/Library/Application Support/Google/Chrome/NativeMessagingHosts").expanduser()


def repo_native_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def write_wrapper(path: Path, archive_root: Path, python: str) -> None:
    native_dir = repo_native_dir()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "#!/bin/sh\n"
        f"export CLASSROOM_AI_ROOT={json.dumps(str(archive_root.expanduser()))}\n"
        f"export PYTHONPATH={json.dumps(str(native_dir))}${{PYTHONPATH:+:$PYTHONPATH}}\n"
        f"exec {json.dumps(python)} -m classroom_ai_exporter.host\n",
        encoding="utf-8",
    )
    mode = path.stat().st_mode
    path.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def write_manifest(path: Path, wrapper_path: Path, extension_id: str) -> None:
    if not extension_id or extension_id == "EXTENSION_ID":
        raise ValueError("Pass the loaded extension id with --extension-id.")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "name": HOST_NAME,
                "description": "CourseBinder – AI-Ready Google Classroom Exporter native host",
                "path": str(wrapper_path),
                "type": "stdio",
                "allowed_origins": [f"chrome-extension://{extension_id}/"],
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Install the CourseBinder – AI-Ready Google Classroom Exporter Chrome native host manifest.")
    parser.add_argument("--extension-id", required=True, help="Chrome extension id from chrome://extensions.")
    parser.add_argument(
        "--archive-root",
        default=os.environ.get("CLASSROOM_AI_ROOT", "~/CourseBinderArchive"),
        help="Local archive root exposed to the native host.",
    )
    parser.add_argument(
        "--manifest-dir",
        default=str(chrome_manifest_dir()),
        help="Chrome NativeMessagingHosts directory.",
    )
    parser.add_argument("--python", default=sys.executable, help="Python executable used by the native host wrapper.")
    return parser


def install(args: argparse.Namespace) -> dict[str, str]:
    archive_root = Path(args.archive_root).expanduser()
    generated_dir = repo_native_dir() / ".native-host"
    wrapper_path = generated_dir / "coursebinder-host"
    manifest_path = Path(args.manifest_dir).expanduser() / f"{HOST_NAME}.json"

    write_wrapper(wrapper_path, archive_root, args.python)
    write_manifest(manifest_path, wrapper_path, args.extension_id)

    return {
        "host": HOST_NAME,
        "archive_root": str(archive_root),
        "wrapper": str(wrapper_path),
        "manifest": str(manifest_path),
    }


def main() -> int:
    result = install(build_parser().parse_args())
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
