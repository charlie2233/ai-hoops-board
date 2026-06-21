# Manual Smoke Test

Use this checklist to verify the default Chrome Web Store build without the optional native host.

## What This Proves

This smoke test proves that CourseBinder can:

- Load as a Chrome extension with the default Web Store manifest.
- Read a user-opened Google Classroom page after the user clicks the extension.
- Export the current page through browser downloads.
- Save the expected AI-readable files under `Downloads/CourseBinder/<session>/`.

It does not prove native-host archive writing, hashing, extraction, indexing, MCP, or whole-class crawling. Those are optional/local-development paths.

## Automated Fixture Smoke Caveat

`npm run smoke:fixture` and `npm run smoke:zip` use a local Classroom-shaped HTML fixture, then let Chrome handle any Google Drive or Docs attachment download attempts through the real browser download stack. Because that fixture run is not logged in to Google, attachment attempts may report failures such as `SERVER_BAD_CONTENT` or interrupted Google HTML responses.

That is not a failure of the no-native page export. The automated smoke is considered passing when the extension loads, the popup works, all six browser-download archive files are written, and attachment failures are recorded clearly in `item.json` and `attachments.manifest.jsonl`. Real attachment success still needs a manual logged-in Classroom page with a small, non-sensitive, downloadable file.

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
10. Confirm `Last export` starts with `Downloads/CourseBinder/` and ends with `/item.md`.

## Verify Files

Open the browser downloads list or Finder and locate the folder shown by `Last export` in the popup under:

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

Quick terminal check. This finds the newest exported `item.json` file rather than the newest folder, because CourseBinder intentionally reuses stable folders and overwrites generated archive files on repeated exports:

```bash
LATEST_ITEM="$(find "$HOME/Downloads/CourseBinder" -name item.json -type f -print0 2>/dev/null | xargs -0 ls -t | head -1)"
EXPORT_DIR="$(dirname "$LATEST_ITEM")"
echo "$EXPORT_DIR"
ls -1 "$EXPORT_DIR"
python3 -m json.tool "$EXPORT_DIR/item.json" >/dev/null
test -s "$EXPORT_DIR/item.md"
test -s "$EXPORT_DIR/raw_text.txt"
test -s "$EXPORT_DIR/links.jsonl"
test -s "$EXPORT_DIR/attachments.manifest.jsonl"
test -s "$EXPORT_DIR/page.snapshot.html"
```

If `item.json` parses and all six files exist, the no-native current-page export is usable.

## Optional Export + Download Check

Only run this on a page with a small, non-sensitive, clearly downloadable attachment.

1. Click `Export + download`.
2. Confirm the popup reports how many browser downloads completed or failed.
3. Confirm completed attachment downloads are saved under the same `Downloads/CourseBinder/<session>/` folder as the exported archive files.
4. Reopen `item.json` or `attachments.manifest.jsonl` and confirm any attempted attachment downloads now show `downloadStatus` as `downloaded` or `failed`, not just `queued`.

The default Web Store build does not hash, extract, index, or copy downloaded attachments into a separate archive-owned mirror. That richer flow belongs to the optional native-host build.

## Troubleshooting

If the popup says `Open a Google Classroom page before exporting`, make sure the active tab URL starts with `https://classroom.google.com/`.

If the popup says CourseBinder could not reach the Classroom tab, reload the Classroom page after installing or updating the extension, then try `Export page` again.

If files are missing, check whether Chrome is configured to ask where each download should be saved. For a clean smoke test, temporarily disable `Ask where to save each file before downloading`.

If a managed school profile blocks unpacked extensions, test in Chrome for Testing or a personal Chromium-compatible profile.
