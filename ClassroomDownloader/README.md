# CourseBinder – AI-Ready Google Classroom Exporter

CourseBinder – AI-Ready Google Classroom Exporter turns the Google Classroom content a user can already see in a logged-in Chromium tab into a local, AI-readable archive. It is a browser-visible-content exporter, not a Google API downloader.

```txt
Logged-in Google Classroom tab
        -> Chromium extension / content scripts
        -> Extension controller + download queue
        -> Native host (optional)
        -> AI-readable archive folder
        -> Local MCP server
        -> Codex / GPT search, summarize, cite
```

## Privacy Boundary

This project deliberately avoids the Google Classroom API, Drive API, OAuth, token extraction, and cookie access. The extension reads visible DOM text, headings, links, ARIA labels, and browser-downloadable URLs from pages the user has already opened.

The first version is local-only:

- No `identity` permission.
- No `cookies` permission.
- No `https://www.googleapis.com/*` host access.
- No telemetry or hosted backend.
- MCP tools read the local archive and do not mutate Classroom.

See [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md) for the Chrome Web Store privacy-policy draft.

## What Exists Now

This scaffold implements the first useful product slice:

- MV3/WXT extension structure with a popup, background controller, and Classroom content script.
- DOM snapshot extraction that prefers semantic signals over random Google CSS classes.
- Attachment classification for Drive files, Docs, Sheets, Slides, Drive folders, YouTube, and external links.
- Browser-download fallback export when the optional Python native host is not installed.
- Raw HTML snapshot truncation before native-host transfer or fallback download.
- Best-effort browser download job creation without bypassing UI restrictions.
- Python native host archive writer for `item.json`, `item.md`, `raw_text.txt`, `page.snapshot.html`, `links.jsonl`, and archive indexes.
- Read-only local MCP server skeleton with `search`, `fetch`, `list_courses`, `list_assignments`, `list_due_soon`, `read_attachment`, `show_export_health`, and `rebuild_index`.

## Repository Layout

```txt
extension/      Chromium extension, WXT + React + TypeScript
native/         Python native host, archive writer, indexer, MCP server
tests/          Native tests and HTML fixtures
docs/           Architecture, privacy, schema, and install notes
```

## Build Order

1. Single assignment exporter.
2. Attachment downloader.
3. Markdown/JSON archive writer.
4. Current class deep crawl.
5. Native host installation.
6. File text extraction.
7. SQLite/JSONL index.
8. MCP search/fetch.
9. Takeout importer.
10. All visible classes.
11. Robustness and packaging.

## Native Test

```sh
python3 -m unittest discover -s tests/native
```

## Extension Development

```sh
cd extension
npm install
npm run dev
```

The extension is intentionally scoped to `classroom.google.com`, `drive.google.com`, and `docs.google.com`.

## License

MIT License. Free to use, copy, modify, merge, publish, distribute, sublicense, and sell, as long as the copyright and permission notice are included.
