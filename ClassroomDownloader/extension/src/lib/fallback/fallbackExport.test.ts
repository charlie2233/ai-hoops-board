import { describe, expect, it } from "vitest";
import type { ExportItem } from "../extractors/assignmentPage";
import type { PageSnapshot } from "../extractors/classroomPage";
import { buildFallbackExportFiles, buildFallbackSessionName, filenameForFallbackFile } from "./fallbackExport";

const item: ExportItem = {
  schema_version: "0.1",
  entity_type: "coursework",
  id: "classroom-ui:sha256:abc12345",
  course: {
    id: "ui-course:ap",
    name: "AP Calculus / Section A",
  },
  title: "Derivative Practice: Unit 5",
  instructions_text: "Complete the visible assignment.",
  source_url: "https://classroom.google.com/c/abc/a/def/details",
  captured_at: "2026-04-24T18:30:00.000Z",
  attachments: [
    {
      id: "attachment:external",
      title: "Reference article",
      kind: "external_link",
      sourceUrl: "https://example.edu/derivative-reference",
      exportUrls: [],
      downloadStatus: "metadata_only",
      reason: "no_browser_download_strategy",
    },
  ],
  crawler: {
    method: "chromium_extension_dom",
    confidence: 0.65,
    raw_snapshot_path: "page.snapshot.html",
    raw_html_truncated: true,
    raw_html_original_chars: 2_500_000,
    raw_html_stored_chars: 2_000_000,
  },
};

const snapshot: PageSnapshot = {
  url: item.source_url,
  title: item.title,
  capturedAt: item.captured_at,
  headings: [item.title],
  links: [
    {
      text: "Reference article",
      href: "https://example.edu/derivative-reference",
      ariaLabel: "",
      title: "",
      role: "",
    },
  ],
  buttons: [],
  bodyText: "Derivative Practice\nComplete the visible assignment.",
  rawHtml: "<html><body>truncated snapshot</body></html>",
  rawHtmlTruncated: true,
  rawHtmlOriginalChars: 2_500_000,
  rawHtmlStoredChars: 2_000_000,
};

describe("fallback browser-download export", () => {
  it("builds a safe Downloads session path", () => {
    const sessionName = buildFallbackSessionName(item);
    const filename = filenameForFallbackFile(sessionName, "item.json");

    expect(sessionName).toContain("2026-04-24");
    expect(sessionName).not.toContain("/");
    expect(filename).toBe(`ClassroomAIExporter/${sessionName}/item.json`);
  });

  it("emits all fallback files with raw HTML truncation metadata", () => {
    const files = buildFallbackExportFiles(item, snapshot);
    const names = files.map((file) => file.name);
    const itemJson = JSON.parse(files.find((file) => file.name === "item.json")!.text);

    expect(names).toEqual([
      "item.json",
      "item.md",
      "raw_text.txt",
      "links.jsonl",
      "attachments.manifest.jsonl",
      "page.snapshot.html",
    ]);
    expect(itemJson.crawler.raw_html_truncated).toBe(true);
    expect(itemJson.crawler.raw_html_original_chars).toBe(2_500_000);
    expect(itemJson.crawler.raw_html_stored_chars).toBe(2_000_000);
    expect(files.find((file) => file.name === "attachments.manifest.jsonl")!.text).toContain(
      "https://example.edu/derivative-reference"
    );
  });
});
