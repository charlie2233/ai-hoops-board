# Chrome Web Store Submission Packet

This packet is for an unlisted or deferred Chrome Web Store submission of Classroom AI Exporter.

## Short Description

Export visible Google Classroom pages into local AI-readable Markdown, JSON, snapshots, links, and attachment archives.

## Long Description

Classroom AI Exporter helps students and educators turn Google Classroom pages they can already see in their browser into a local, AI-readable archive.

With one click, the extension can export the current Classroom page into structured files such as Markdown, JSON, raw text, links, attachment manifests, and page snapshots. When available, it can also start browser downloads for visible/downloadable attachment links.

The extension is designed for local-first AI workflows. Exported files can be read by tools like Codex, GPT, local MCP servers, and other study or productivity systems.

Privacy boundary:

- No Google Classroom API
- No Google Drive API
- No OAuth
- No cookie access
- No token extraction
- No telemetry
- No ads
- No hosted backend

The optional native helper can be installed separately by the user to write richer local archives, hash/copy downloaded files, extract text, build indexes, and expose a local read-only MCP server. If the helper is not installed, the browser-download fallback still works.

Classroom AI Exporter only processes content the signed-in user can already see in their browser and does not bypass permissions, view-only restrictions, or access controls.

## Category Recommendation

Use `Education` if available. Otherwise use `Productivity`.

## Single Purpose Statement

Classroom AI Exporter lets users export Google Classroom page content they can already see in their logged-in browser into local AI-readable files, including Markdown, JSON, page snapshots, links, and downloadable attachments when the user requests it.

## Permission Justifications

`activeTab`

Used to run the export only on the currently active tab when the user clicks the extension. This lets the extension read the visible Classroom page the user intentionally opened without requesting broad access to all websites.

`downloads`

Used to save user-requested export files and downloadable attachments to the browser Downloads folder. Downloads are initiated only after the user chooses an export action.

`storage`

Used to store local extension state such as the last export result, native-helper health, archive root display, and download summary shown in the popup.

`scripting`

Used by the extension architecture to support controlled content-script execution on Google Classroom pages for user-requested export flows.

`nativeMessaging`

Used only for the optional local Python helper installed by the user. The helper writes structured archive files, hashes/copies downloaded files, extracts text, builds local indexes, and exposes a local read-only MCP server. If the helper is not installed, the extension still works through browser-download fallback.

`https://classroom.google.com/*`

Required to read visible Classroom page text, headings, links, button labels, page title, URL, and optional HTML snapshot when the user starts an export.

`https://drive.google.com/*`

Required to classify visible Google Drive attachment links and start user-requested browser downloads for visible/downloadable Drive files.

`https://docs.google.com/*`

Required to classify visible Google Docs, Sheets, and Slides attachment links and start user-requested browser export/download attempts where available.

## Remote Code Declaration

The extension does not use remote code. All extension JavaScript, content scripts, popup UI code, and assets are packaged inside the submitted extension zip.

The project does not load remote scripts, evaluate downloaded code, or use a hosted backend.

## Privacy And Data Use Notes

Dashboard data disclosure should not claim that no user data is processed. The extension locally processes website content after a user action.

Recommended data-use framing:

- Processes visible website content locally after the user clicks an export action.
- May process page URLs and link URLs for the exported Classroom page and visible attachments.
- May process user-generated Classroom content visible on the page.
- Does not sell user data.
- Does not transmit Classroom content to the developer or third parties.
- Does not use data for unrelated purposes, advertising, credit, or lending.
- Exported data stays on the user's device unless the user separately chooses to share, move, or upload it.

Privacy policy URL:

```txt
https://raw.githubusercontent.com/charlie2233/classroom-ai-exporter/main/docs/PRIVACY_POLICY.md
```

If the dashboard requires a rendered webpage instead of a raw Markdown file, publish the same policy text through GitHub Pages or another static page before final submission.

## Reviewer Test Instructions

No login credentials are provided by the developer.

To test:

1. Install the extension.
2. Open any Google Classroom page available to the reviewer, or use a Classroom page in a logged-in test account.
3. Click the Classroom AI Exporter toolbar button.
4. Use the current-page export action.
5. If the optional native host is not installed, the extension will use browser-download fallback and save export files under `Downloads/ClassroomAIExporter/<session>/`.
6. Confirm that `item.json`, `item.md`, `raw_text.txt`, `links.jsonl`, `attachments.manifest.jsonl`, and `page.snapshot.html` are created.

The extension does not require Google APIs, OAuth, cookies, or developer-provided credentials. The native host is optional and is not required for basic export functionality.

## Built Manifest Audit

Expected `extension/.output/chrome-mv3/manifest.json` values after `npm run build`:

- `manifest_version`: `3`
- `name`: `Classroom AI Exporter`
- `version`: `0.1.0`
- Permissions only: `activeTab`, `downloads`, `storage`, `scripting`, `nativeMessaging`
- Host permissions only: `https://classroom.google.com/*`, `https://drive.google.com/*`, `https://docs.google.com/*`
- Icons: `16`, `32`, `48`, and `128`
- Action default icons: `16`, `32`, `48`, and `128`
- No `identity` permission
- No `cookies` permission
- No `https://www.googleapis.com/*` host permission
- No externally hosted scripts or remote-code entries

## Remaining Manual Assets

Placeholder assets are included for first unlisted submission prep:

- `docs/store-assets/screenshot-1280x800.png`
- `docs/store-assets/small-promo-440x280.png`

Before a public launch, replace them with polished assets that still avoid real student, teacher, class, grade, or school data.
