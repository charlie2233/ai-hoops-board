# Submission Checklist

Use this checklist for the Chrome Web Store unlisted, deferred-publish submission.

## Package

Chrome Web Store upload ZIP:

```txt
extension/.output/formative-ai-exporter-extension-0.1.0-chrome.zip
```

Build/package commands:

```sh
cd extension
npm run release:check
```

ZIP checksum command:

```sh
shasum -a 256 extension/.output/formative-ai-exporter-extension-0.1.0-chrome.zip
```

ZIP inspection command:

```sh
unzip -l extension/.output/formative-ai-exporter-extension-0.1.0-chrome.zip
```

## Manifest

Expected manifest version:

```txt
3
```

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

Expected host permissions:

```json
[
  "https://app.formative.com/*",
  "https://*.formative.com/*",
  "https://*.goformative.com/*"
]
```

Permissions that must not appear:

```txt
cookies
identity
webRequest
tabs
<all_urls>
Google API hosts
```

## Store Listing

Title:

```txt
Practice Snapshot for Formative
```

Short description:

```txt
Save a visible Formative practice as a local ZIP with text, answers, images, links, and screenshots.
```

Detailed description:

```txt
Practice Snapshot for Formative helps students save a local archive of a Formative practice they can already access in their browser.

The extension captures visible page text, answer fields, links, image metadata, and screenshots, then exports them into an AI-readable ZIP containing Markdown, JSON, text files, and screenshots.

It does not use Formative APIs, OAuth, cookies, token extraction, telemetry, ads, analytics, or a hosted backend. It only runs when the user clicks the capture button and only captures content visible to the currently logged-in user.

It does not submit answers, change answers, bypass locked/proctored modes, or access other users' work.

Practice Snapshot for Formative is an independent tool and is not affiliated with, endorsed by, or sponsored by Formative.
```

Category recommendation:

```txt
Productivity
```

Distribution:

```txt
Unlisted
```

Publishing:

```txt
Deferred publish
```

## Permission Justifications

`activeTab`:

```txt
Limits capture to a user-activated active tab.
```

`scripting`:

```txt
Injects the visible-page extractor and safe next-page helper after user action.
```

`downloads`:

```txt
Saves the generated ZIP archive locally through the browser download flow.
```

`offscreen`:

```txt
Builds ZIP Blob/ObjectURL output in an MV3 offscreen document.
```

`storage`:

```txt
Stores temporary capture progress while walking a practice.
```

Host permissions:

```txt
Allows capture on Formative pages the currently logged-in user can already access.
```

## Privacy

Privacy policy:

```txt
docs/PRIVACY_POLICY.md
```

Privacy tab single purpose:

```txt
Save a visible Formative practice as a local AI-readable ZIP archive.
```

Privacy tab data handling:

```txt
The extension processes visible Formative page content locally when the user clicks capture. This may include page text, visible answer fields, image metadata, links, screenshots, and truncated page HTML snapshots. Exports are saved locally as ZIP files through the browser download flow.
```

Data sharing:

```txt
No sharing with the developer, third parties, ad networks, analytics services, or a hosted backend.
```

Remote code:

```txt
No. Extension code is bundled in the submitted package.
```

Ads and analytics:

```txt
No.
```

OAuth, cookies, tokens, or API authentication:

```txt
No.
```

Safety boundary:

```txt
The extension does not submit answers, modify answers, finish practices, turn in practices, or bypass locked, proctored, secure, restricted, or LockDown Browser modes.
```

## Final Gate

- [ ] `npm run release:check` passes.
- [ ] `git diff --check` passes.
- [ ] ZIP SHA256 is recorded.
- [ ] ZIP has `manifest.json` at root.
- [ ] ZIP excludes tests, source maps, local env files, `node_modules`, and unrelated repo files.
- [ ] One real Formative smoke is recorded in `docs/SMOKE_TEST_REPORT.md`.
- [ ] Store listing and Privacy tab match `docs/PRIVACY_POLICY.md`.
- [ ] Distribution is set to `Unlisted`.
- [ ] Publishing is set to deferred/manual release.
