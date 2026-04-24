# Architecture

Classroom AI Exporter is built around one constraint: it exports only content already visible to the signed-in browser user. The browser extension observes the page, the native host owns durable local storage, and MCP exposes the local archive to AI tools.

```txt
Google Classroom tab
  -> content script DOM snapshot
  -> background controller
  -> browser download queue
  -> native messaging host
  -> archive writer + indexer
  -> local read-only MCP server
```

## Extension

The extension runs on `https://classroom.google.com/*` and extracts stable page signals:

- URL, title, capture time.
- `h1`, `h2`, `h3`, and `role=heading`.
- `a[href]` text, target URL, title, role, and ARIA label.
- visible button text and ARIA labels.
- visible body text.
- raw HTML snapshot.

The first exporter action handles the current page. Later milestones will add class-level crawling, queue persistence, tab orchestration, and Drive folder page crawling.

## Native Host

The native host receives extension messages over Chrome Native Messaging and writes ordinary files under `CLASSROOM_AI_ROOT`:

```txt
manifest.json
README.ai.md
courses/<course>/classwork/<item>/
  item.json
  item.md
  raw_text.txt
  page.snapshot.html
  links.jsonl
  attachments/manifest.jsonl
index/documents.jsonl
index/chunks.jsonl
index/search.sqlite
logs/crawl_runs.jsonl
```

The native side owns the durable queue and indexing work because MV3 service workers are not a reliable place for long-running state.

Completed browser downloads are finalized by the native host. The extension sends Chrome's completed download path, and the native host copies the file into the archive, hashes it, mirrors it under `files/by_hash/`, extracts text when supported, and rebuilds the local index.

## MCP

The MCP server is read-only over the archive. Its first tools are intentionally data-source shaped:

- `search_archive(query, limit)`
- `fetch_document(document_id, max_chars)`
- `list_courses()`
- `list_assignments(course, due_before)`
- `list_due_soon(days)`
- `read_attachment(id_or_path, max_chars)`
- `show_export_health()`
- `rebuild_index()`

`rebuild_index` writes local index files only; it does not touch Classroom.
