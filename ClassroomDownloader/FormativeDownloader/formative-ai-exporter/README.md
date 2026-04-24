# Formative AI Exporter

Export one visible Formative practice into an AI-readable local archive.

This is a Chrome/Chromium extension-only MVP. It does not use the Formative API, Google APIs, OAuth, cookies, token scraping, reverse-engineered network calls, or a native host. It captures only what the currently logged-in user can already see in the active browser tab.

## What It Captures

- Visible page text, headings, button labels, ARIA labels, alt text, and rendered math text when present.
- User-visible answer state from inputs, textareas, selects, contenteditable fields, textbox roles, checked controls, and selected ARIA controls.
- Image/media metadata from images, picture sources, inline SVG, canvas, CSS background images, iframes, embeds, and videos.
- One visible-tab screenshot per captured page as the visual fallback for graphing, drawing, drag/drop, hot spot, matching, media, canvas, and other complex question types.

## Boundaries

- No Formative API.
- No Google API.
- No OAuth.
- No cookies permission.
- No token scraping.
- No network API reverse engineering.
- No auto-submit, finish, turn-in, or answer-changing behavior.
- No LockDown Browser or secure/proctored-mode bypass attempts.

The exporter stops before Submit, Finish, Turn In, Done, or Complete actions. It is meant for local archiving of user-visible Formative content only.

## ZIP Output

```txt
FormativeAIExport/
  manifest.json
  practice.json
  practice.md
  pages/
    page_001/
      page.json
      page.md
      visible_text.txt
      answers.json
      images.jsonl
      links.jsonl
      screenshot.png
      raw.html
  index/
    documents.jsonl
    chunks.jsonl
```

The most useful AI inputs are `practice.md`, `pages/page_XXX/page.md`, `pages/page_XXX/screenshot.png`, and `pages/page_XXX/answers.json`.

## Build

```sh
cd extension
npm install
npm run typecheck
npm test -- --run
npm run build
```

## Load Unpacked

1. Build the extension with `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select `extension/.output/chrome-mv3`.

Open a Formative practice in Chrome, click the extension, then choose either `Capture Current Page` or `Capture Whole Practice`.
