# Chrome Web Store Rejection Response

This note is for resubmitting CourseBinder after the Chrome Web Store rejection:

- Violation reference ID: `Purple Potassium`
- Rejected version: `0.1.0`
- Rejection reason: requesting but not using the `scripting` permission
- Fixed version: `0.1.11`

## What Changed

Version `0.1.11` removes the rejected `scripting` permission from the default Chrome Web Store manifest.

The default Web Store build now requests only:

- `downloads`
- `storage`

The default Web Store build now requests only this host permission:

- `https://classroom.google.com/*`

The default Web Store build does not request:

- `scripting`
- `activeTab`
- `nativeMessaging`
- `identity`
- `cookies`
- `https://drive.google.com/*`
- `https://docs.google.com/*`
- `https://www.googleapis.com/*`

## Resubmission Notes

Upload the newly built `0.1.11` zip from:

```txt
extension/.output/coursebinder-ai-ready-google-classroom-exporter-0.1.11-chrome.zip
```

Do not re-upload any older `0.1.0` package.

## Suggested Reviewer Note

```txt
This resubmission fixes the prior permission rejection. The previous draft requested the scripting permission, but the current version 0.1.11 removes scripting from the default Chrome Web Store manifest.

The extension now requests only downloads and storage, plus host access limited to https://classroom.google.com/*. It does not request scripting, activeTab, nativeMessaging, identity, cookies, Drive/Docs host access, or googleapis.com access.

CourseBinder exports only visible Google Classroom page content after the user clicks an export action. It does not use Google APIs, OAuth, cookies, token extraction, telemetry, ads, or a hosted backend.
```

## Verification Commands

Run these before uploading if the package is rebuilt:

```bash
cd extension
npm run typecheck
npm test -- --run
npm run build
npm run smoke:fixture
npm run zip
npm run smoke:zip
npm run release:handoff
npm audit --omit=dev
cd ..
python3 -m unittest discover -s tests/native
python3 -m compileall -q native/classroom_ai_exporter
git diff --check
```

Then inspect the packaged manifest:

```bash
python3 - <<'PY'
import json, zipfile

zip_path = "extension/.output/coursebinder-ai-ready-google-classroom-exporter-0.1.11-chrome.zip"
with zipfile.ZipFile(zip_path) as z:
    manifest = json.loads(z.read("manifest.json"))

print(json.dumps({
    "version": manifest.get("version"),
    "permissions": manifest.get("permissions"),
    "host_permissions": manifest.get("host_permissions"),
    "forbidden_permissions": [
        p for p in ["scripting", "activeTab", "nativeMessaging", "identity", "cookies"]
        if p in manifest.get("permissions", [])
    ],
}, indent=2))
PY
```
