import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportItem } from "../extractors/assignmentPage";
import type { PageSnapshot } from "../extractors/classroomPage";
import {
  buildFallbackExportFiles,
  buildFallbackSessionName,
  downloadFallbackExport,
  filenameForFallbackFile
} from "./fallbackExport";

const downloadMock = vi.hoisted(() => vi.fn());

vi.mock("wxt/browser", () => ({
  browser: {
    downloads: {
      download: downloadMock
    }
  }
}));

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
  beforeEach(() => {
    downloadMock.mockReset();
  });

  it("builds a safe Downloads session path", () => {
    const sessionName = buildFallbackSessionName(item);
    const filename = filenameForFallbackFile(sessionName, "item.json");

    expect(sessionName).toContain("2026-04-24");
    expect(sessionName).not.toContain("/");
    expect(filename).toBe(`CourseBinder/${sessionName}/item.json`);
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

  it("queues every fallback archive file through Chrome downloads", async () => {
    downloadMock.mockResolvedValueOnce(101);
    downloadMock.mockResolvedValueOnce(102);
    downloadMock.mockResolvedValueOnce(103);
    downloadMock.mockResolvedValueOnce(104);
    downloadMock.mockResolvedValueOnce(105);
    downloadMock.mockResolvedValueOnce(106);

    const result = await downloadFallbackExport(item, snapshot);
    const filenames = downloadMock.mock.calls.map(([options]) => options.filename);

    expect(result.ok).toBe(true);
    expect(result.downloadIds).toEqual([101, 102, 103, 104, 105, 106]);
    expect(downloadMock).toHaveBeenCalledTimes(6);
    expect(filenames).toEqual([
      `${result.root.replace("Downloads/", "")}/item.json`,
      `${result.root.replace("Downloads/", "")}/item.md`,
      `${result.root.replace("Downloads/", "")}/raw_text.txt`,
      `${result.root.replace("Downloads/", "")}/links.jsonl`,
      `${result.root.replace("Downloads/", "")}/attachments.manifest.jsonl`,
      `${result.root.replace("Downloads/", "")}/page.snapshot.html`,
    ]);
    expect(downloadMock.mock.calls.every(([options]) => options.url.startsWith("data:"))).toBe(true);
    expect(downloadMock.mock.calls.every(([options]) => options.saveAs === false)).toBe(true);
  });
});
