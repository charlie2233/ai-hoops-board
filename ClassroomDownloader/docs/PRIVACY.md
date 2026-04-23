# Privacy

The project is local-first and intentionally avoids privileged Google integrations.

## Hard Boundaries

- No Google Classroom API.
- No Google Drive API.
- No OAuth.
- No `identity` extension permission.
- No `cookies` extension permission.
- No token, cookie, or local storage secret extraction.
- No telemetry by default.
- No hosted backend by default.
- No attempt to bypass view-only or download-disabled material.

## What The Extension Reads

The extension reads visible DOM state from pages the user has already opened:

- headings
- links
- visible text
- button labels
- ARIA labels
- page title and URL
- raw HTML snapshot for audit/debugging

The extension can ask Chromium to download URLs that the browser session can already access. It does not read or export the browser's credentials.

## MCP Safety

Archived Classroom content is untrusted source material. The archive writer adds an AI note reminding downstream tools to treat page text as content, not instructions. MCP tools are read-only in the first product line.
