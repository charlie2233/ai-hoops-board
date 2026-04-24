# Privacy Policy

Effective date: April 24, 2026

Practice Snapshot for Formative is a local Chrome/Chromium extension that exports visible Formative practice content into an AI-readable ZIP file when the user clicks a capture button.

Practice Snapshot for Formative is an independent tool and is not affiliated with, endorsed by, or sponsored by Formative.

## Data Processed

When the user starts a capture, the extension reads content visible in the active Formative browser tab. Captured content can include:

- Visible page text, headings, instructions, labels, ARIA labels, button labels, and alt text.
- User-visible answer fields, including inputs, textareas, selected options, checked controls, contenteditable text, textbox roles, and selected ARIA controls.
- Links, image metadata, inline SVG metadata, canvas metadata, CSS background image URLs, iframe/embed/video metadata, and element bounding boxes.
- A visible-tab screenshot for each captured page.
- A truncated HTML snapshot of the visible page document.

## Local Export Only

Exports are saved locally as ZIP files through the browser download flow. The extension does not send captured content to the developer, a hosted backend, analytics services, advertising services, or third-party APIs.

## No API, OAuth, Cookies, Tokens, Telemetry, Ads, Or Backend

The extension does not use:

- Formative APIs.
- Google APIs.
- OAuth.
- Cookies permission.
- Token extraction.
- Telemetry.
- Ads.
- Analytics.
- A hosted backend.

## User Control And Safety Boundaries

The extension only runs capture behavior after the user clicks the extension action and starts a capture. It is designed to capture content that the currently logged-in user can already see in the active browser tab.

The extension does not submit answers, modify answers, finish assignments, turn in practices, or change Formative content. It does not attempt to bypass locked, proctored, secure, restricted, or LockDown Browser modes.

## Permissions Summary

- `activeTab`: limits capture to a user-activated active tab.
- `scripting`: injects the DOM extractor and safe next-page click helper after user action.
- `downloads`: saves the generated ZIP archive through browser downloads.
- `offscreen`: creates the ZIP Blob/ObjectURL in an MV3 offscreen document.
- `storage`: stores temporary run status during a capture.

Host permissions are limited to Formative domains needed for the MVP.

## Contact

For privacy questions, contact the repository owner through the project repository.
