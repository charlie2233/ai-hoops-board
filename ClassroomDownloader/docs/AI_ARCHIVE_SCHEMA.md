# AI Archive Schema

The archive uses ordinary files so Codex, shell tools, and future local apps can inspect it without a proprietary database.

## Item JSON

```json
{
  "schema_version": "0.1",
  "entity_type": "coursework",
  "id": "classroom-ui:sha256:...",
  "course": {
    "id": "ui-course:...",
    "name": "AP Calculus"
  },
  "title": "Derivative Practice",
  "due": {
    "raw": "Due Apr 20, 11:59 PM",
    "timezone": "America/Los_Angeles",
    "parse_confidence": 0.45
  },
  "points": {
    "raw": "20 points",
    "value": 20
  },
  "instructions_text": "Visible page text...",
  "source_url": "https://classroom.google.com/...",
  "captured_at": "2026-04-23T15:20:00-07:00",
  "attachments": [],
  "crawler": {
    "method": "chromium_extension_dom",
    "confidence": 0.65,
    "raw_snapshot_path": "page.snapshot.html"
  }
}
```

Browser-download fallback attachment records use camelCase fields and may include:

```json
{
  "downloadStatus": "downloaded",
  "downloadAttemptUrl": "https://drive.google.com/uc?export=download&id=...",
  "browserDownloadFilename": "CourseBinder/AP_Calculus__Derivative_Practice__71908c7e/Derivative_Practice_PDF",
  "originalDownloadPath": "/Users/name/Downloads/CourseBinder/AP_Calculus__Derivative_Practice__71908c7e/Derivative_Practice_PDF",
  "bytes": 12345,
  "mime": "application/pdf"
}
```

Possible `downloadStatus` values are:

- `queued`: CourseBinder found a visible/downloadable-looking attachment link before a browser download attempt.
- `downloaded`: Chrome reported that the browser download completed.
- `failed`: Chrome could not complete the attempted browser download; the record should include `downloadError` when available.
- `metadata_only`: CourseBinder saved only the link/metadata, usually for external links, folders, media, or view-only/download-disabled material.

Native-host archive records may additionally include archive-owned paths and hashes such as `local_path`, `sha256`, and `extracted_text_path` after the local helper copies and processes completed downloads.

## Item Markdown

Every item gets an `item.md` with frontmatter, instructions, attachment references, attachment-status notes, and an AI safety note.

## Indexes

- `index/documents.jsonl` stores document-level metadata.
- `index/chunks.jsonl` stores rebuilt text chunks.
- `index/search.sqlite` stores FTS-backed local search.

The JSONL files are durable interchange files. SQLite is a fast local index that can be rebuilt.
