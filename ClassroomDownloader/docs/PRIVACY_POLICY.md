# Privacy Policy

Classroom AI Exporter is a local-first browser extension for exporting the Google Classroom content that is already visible to the signed-in user in their browser.

## Data the Extension Reads

When the user clicks an export action, the extension reads visible Google Classroom page content from the current tab, including:

- Page title and URL
- Visible page text
- Headings
- Links and link labels
- Button labels and accessible labels
- Optional HTML snapshot of the current page, truncated before export when it exceeds the configured safety limit

The extension does not read hidden Google account data, browser history, bookmarks, cookies, OAuth tokens, or localStorage secrets.

## How Downloads Are Used

The extension uses Chrome's `downloads` permission only for user-requested actions:

- Saving fallback archive files when the optional native host is not installed or unavailable
- Starting browser downloads for visible/downloadable attachments when the user chooses `Export + download`

Downloads are initiated through the browser session. The extension does not bypass file permissions, view-only restrictions, or access controls.

## Optional Native Host

The extension can connect to an optional local Python native host installed by the user. This native host is used only for local archive enhancements such as writing structured files, hashing downloaded files, extracting text, building local indexes, and exposing a local read-only MCP server.

If the native host is not installed, the extension still provides a browser-download fallback export.

## What the Extension Does Not Do

Classroom AI Exporter does not use:

- Google Classroom API
- Google Drive API
- OAuth
- Cookie access
- Token extraction
- Telemetry
- Ads
- Hosted backend services

The extension does not sell, share, upload, or transmit Classroom content to the developer or to any third-party service.

## Local Data

Exported data stays on the user's device unless the user separately chooses to share, move, upload, or otherwise export those local files.

## Contact

For questions or issues, use the project's GitHub repository: https://github.com/charlie2233/classroom-ai-exporter
