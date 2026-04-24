# Chrome Web Store Readiness

This document is the release-prep packet for an unlisted, deferred-publish Chrome Web Store submission.

## Suggested Listing

Title:

```txt
Formative AI Exporter
```

Short description:

```txt
Export a visible Formative practice into a local AI-readable ZIP with text, answers, images, links, and screenshots.
```

Detailed description:

```txt
Formative AI Exporter helps students save a local archive of a Formative practice they can already access in their browser.

The extension captures visible page text, answer fields, links, image metadata, and screenshots, then exports them into an AI-readable ZIP containing Markdown, JSON, text files, and screenshots.

It does not use Formative APIs, OAuth, cookies, token extraction, telemetry, ads, analytics, or a hosted backend. It only runs when the user clicks the capture button and only captures content visible to the currently logged-in user.

It does not submit answers, change answers, bypass locked/proctored modes, or access other users' work.
```

Category:

```txt
Productivity
```

Visibility:

```txt
Unlisted
```

Publishing mode:

```txt
Deferred publish
```

## Permission Justifications

Expected permissions:

```json
[
  "activeTab",
  "scripting",
  "downloads",
  "offscreen",
  "storage"
]
```

Justifications:

- `activeTab`: capture only starts from a user-clicked active tab.
- `scripting`: injects the visible-page extractor and safe next-page helper after user action.
- `downloads`: saves the generated ZIP archive locally.
- `offscreen`: builds ZIP Blob/ObjectURL output in an MV3 offscreen document.
- `storage`: stores temporary capture progress while walking a practice.

Expected host permissions:

```json
[
  "https://app.formative.com/*",
  "https://*.formative.com/*",
  "https://*.goformative.com/*"
]
```

Host permission justification:

```txt
The extension only needs access to Formative pages opened by the currently logged-in user so it can extract visible page text, visible answer state, image/link metadata, and screenshots after the user starts capture.
```

Permissions and hosts intentionally not used:

```txt
cookies
identity
webRequest
tabs
<all_urls>
Google API hosts
remote code
```

## Privacy Tab Answers

Single purpose:

```txt
Export one visible Formative practice into a local AI-readable archive.
```

Data usage disclosure:

```txt
The extension processes visible Formative page content locally when the user clicks capture. This may include page text, visible answer fields, image metadata, links, screenshots, and truncated page HTML snapshots. Exports are saved locally as ZIP files through the browser download flow.
```

Data transfer:

```txt
The extension does not transmit captured content to the developer, analytics providers, advertising providers, a hosted backend, Formative APIs, Google APIs, or any third-party service.
```

Remote code:

```txt
No remote code is used. Extension code is bundled in the submitted package.
```

Authentication and tokens:

```txt
The extension does not use OAuth, cookies permission, token extraction, or API authentication.
```

User activity and screenshots:

```txt
Screenshots are captured only after user action and are written into the local ZIP archive. They are not uploaded.
```

Safety boundary:

```txt
The extension does not submit answers, modify answers, finish practices, turn in practices, or bypass locked, proctored, secure, restricted, or LockDown Browser modes.
```

## Manual Smoke Test Checklist

Run this on one real short Formative practice before submitting:

1. Build the extension with `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select `extension/.output/chrome-mv3`.
6. Open a Formative practice the current user can already access.
7. Click the extension and run `Capture Current Page`.
8. Confirm a ZIP downloads under `FormativeAIExport/`.
9. Open the ZIP and verify:
   - `FormativeAIExport/manifest.json`
   - `FormativeAIExport/practice.md`
   - `FormativeAIExport/pages/page_001/page.json`
   - `FormativeAIExport/pages/page_001/page.md`
   - `FormativeAIExport/pages/page_001/visible_text.txt`
   - `FormativeAIExport/pages/page_001/answers.json`
   - `FormativeAIExport/pages/page_001/images.jsonl`
   - `FormativeAIExport/pages/page_001/links.jsonl`
   - `FormativeAIExport/pages/page_001/screenshot.png`
10. Run `Capture Whole Practice` on a short 2-5 page practice.
11. Confirm one screenshot is present for each captured page.
12. Confirm text and answer state are readable in `practice.md`, `page.md`, and `answers.json`.
13. Confirm the walker stops before Submit, Finish, Turn In, Done, or Complete.
14. Confirm no answers were changed and the practice was not submitted.

## Submission Steps

1. `cd extension`
2. `npm run typecheck`
3. `npm test -- --run`
4. `npm run build`
5. `npm run zip`
6. Inspect the generated ZIP contents.
7. Open the Chrome Developer Dashboard.
8. Add a new item or upload a new package.
9. Upload the generated Chrome ZIP.
10. Fill Store Listing using the text above.
11. Fill the Privacy tab using the answers above and `docs/PRIVACY_POLICY.md`.
12. Set Distribution to `Unlisted`.
13. Submit for review with deferred publishing.

## Release Gate

Do not publish publicly until at least one real Formative practice smoke passes end to end. Prefer one or two successful real practices before switching from unlisted to public.
