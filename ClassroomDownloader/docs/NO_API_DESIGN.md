# No-API Design

CourseBinder – AI-Ready Google Classroom Exporter is not an API sync tool. It uses the user's active browser session and visible page content as the source of truth.

## Why

Classroom and Drive API access would require OAuth, scopes, token handling, revocation flows, and school-admin edge cases. This project's first goal is smaller and cleaner: export what the user can already see and download from the UI into a local AI archive.

## Extension Permissions

Allowed first-version permissions:

```json
{
  "permissions": [
    "downloads",
    "storage"
  ],
  "host_permissions": [
    "https://classroom.google.com/*"
  ]
}
```

Intentionally absent:

```txt
identity
cookies
history
bookmarks
nativeMessaging in the default Chrome Web Store build
https://drive.google.com/*
https://docs.google.com/*
https://www.googleapis.com/*
oauth2
```

The optional native host is still available for local developer builds with `COURSEBINDER_ENABLE_NATIVE=1`.

## Attachment Strategy

- Drive file links become best-effort browser-session download jobs.
- Docs, Sheets, and Slides get best-effort export URLs.
- Drive folders are saved as metadata until folder-page crawling exists.
- YouTube and external sites are saved as links and metadata.
- Download-disabled or view-only files stay metadata-only.
