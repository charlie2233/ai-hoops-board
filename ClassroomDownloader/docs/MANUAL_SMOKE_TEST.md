# Manual Smoke Test

Use this checklist to verify the default Chrome Web Store build without the optional native host.

## What This Proves

This smoke test proves that CourseBinder can:

- Load as a Chrome extension with the default Web Store manifest.
- Read a user-opened Google Classroom page after the user clicks the extension.
- Export the current page through browser downloads.
- Save the expected AI-readable files under `Downloads/CourseBinder/<session>/`.

It does not prove native-host archive writing, hashing, extraction, indexing, MCP, or whole-class crawling. Those are optional/local-development paths.

## Preflight

From the repository root, build the extension:

```bash
(cd extension && npm run build && npm run zip)
```

From the repository root, confirm the built manifest is the default Web Store build:

```bash
python3 - <<'PY'
import json

with open("extension/.output/chrome-mv3/manifest.json", "r", encoding="utf-8") as handle:
    manifest = json.load(handle)

print(json.dumps({
    "version": manifest.get("version"),
    "permissions": manifest.get("permissions"),
    "host_permissions": manifest.get("host_permissions"),
}, indent=2))

for forbidden in ["scripting", "activeTab", "nativeMessaging", "identity", "cookies"]:
    assert forbidden not in manifest.get("permissions", []), forbidden
assert manifest.get("permissions") == ["downloads", "storage"]
assert manifest.get("host_permissions") == ["https://classroom.google.com/*"]
PY
```

Expected result:

```txt
permissions: downloads, storage
host_permissions: https://classroom.google.com/*
```

## Load The Unpacked Extension

1. Open Chrome or Chrome for Testing.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select `extension/.output/chrome-mv3`.
6. Confirm the extension name is `CourseBinder – AI-Ready Google Classroom Exporter`.

Do not install or configure the native host for this default Web Store smoke test.

## Run Export Page

1. Open `https://classroom.google.com/`.
2. If Chrome asks for login, complete login manually. Do not share credentials with tools or agents.
3. Open one already-visible Classroom assignment, material, or stream page.
4. Avoid grades, private comments, other students' submissions, or sensitive pages.
5. Click the CourseBinder toolbar icon.
6. Confirm the popup shows `Archive mode` as `Browser downloads`.
7. Click `Export page`.
8. Wait until the popup shows `Saved browser-download archive files.`
9. Confirm the popup shows `Downloads` as `No downloads queued`.

## Verify Files

Open the browser downloads list or Finder and locate the newest folder under:

```txt
Downloads/CourseBinder/
```

The session folder should contain:

- `item.json`
- `item.md`
- `raw_text.txt`
- `links.jsonl`
- `attachments.manifest.jsonl`
- `page.snapshot.html`

Quick terminal check:

```bash
LATEST="$(ls -td "$HOME/Downloads/CourseBinder"/* 2>/dev/null | head -1)"
echo "$LATEST"
ls -1 "$LATEST"
python3 -m json.tool "$LATEST/item.json" >/dev/null
test -s "$LATEST/item.md"
test -s "$LATEST/raw_text.txt"
test -s "$LATEST/links.jsonl"
test -s "$LATEST/attachments.manifest.jsonl"
test -s "$LATEST/page.snapshot.html"
```

If `item.json` parses and all six files exist, the no-native current-page export is usable.

## Optional Export + Download Check

Only run this on a page with a small, non-sensitive, clearly downloadable attachment.

1. Click `Export + download`.
2. Confirm the popup reports how many browser downloads completed or failed.
3. Confirm any attachment download remains in Chrome's normal Downloads area.

The default Web Store build does not copy downloaded attachments into an archive-owned folder. That richer flow belongs to the optional native-host build.

## Troubleshooting

If the popup says `Open a Google Classroom page before exporting`, make sure the active tab URL starts with `https://classroom.google.com/`.

If the popup says CourseBinder could not reach the Classroom tab, reload the Classroom page after installing or updating the extension, then try `Export page` again.

If files are missing, check whether Chrome is configured to ask where each download should be saved. For a clean smoke test, temporarily disable `Ask where to save each file before downloading`.

If a managed school profile blocks unpacked extensions, test in Chrome for Testing or a personal Chromium-compatible profile.
