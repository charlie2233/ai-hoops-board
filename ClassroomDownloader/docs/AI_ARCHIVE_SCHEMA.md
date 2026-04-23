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

## Item Markdown

Every item gets an `item.md` with frontmatter, instructions, attachment references, and an AI safety note.

## Indexes

- `index/documents.jsonl` stores document-level metadata.
- `index/chunks.jsonl` stores rebuilt text chunks.
- `index/search.sqlite` stores FTS-backed local search.

The JSONL files are durable interchange files. SQLite is a fast local index that can be rebuilt.
