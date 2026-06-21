import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportItem } from "../extractors/assignmentPage";
import type { PageSnapshot } from "../extractors/classroomPage";
import { buildDownloadJobs } from "../downloads/downloadQueue";
import {
  buildFallbackExportFiles,
  buildFallbackSessionName,
  downloadFallbackExport,
  filenameForFallbackFile
} from "./fallbackExport";

const downloadMock = vi.hoisted(() => vi.fn());
const searchMock = vi.hoisted(() => vi.fn());
const addListenerMock = vi.hoisted(() => vi.fn());
const removeListenerMock = vi.hoisted(() => vi.fn());

vi.mock("wxt/browser", () => ({
  browser: {
    downloads: {
      download: downloadMock,
      search: searchMock,
      onChanged: {
        addListener: addListenerMock,
        removeListener: removeListenerMock
      }
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
    searchMock.mockReset();
    addListenerMock.mockReset();
    removeListenerMock.mockReset();
  });

  it("builds a safe Downloads session path", () => {
    const sessionName = buildFallbackSessionName(item);
    const filename = filenameForFallbackFile(sessionName, "item.json");

    expect(sessionName).toContain("AP_Calculus");
    expect(sessionName).toContain("Derivative_Practice");
    expect(sessionName).not.toContain("/");
    expect(filename).toBe(`CourseBinder/${sessionName}/item.json`);
  });

  it("keeps the Downloads session path stable across repeated exports", () => {
    const firstSessionName = buildFallbackSessionName(item);
    const secondSessionName = buildFallbackSessionName({
      ...item,
      captured_at: "2026-04-25T18:30:00.000Z"
    });

    expect(firstSessionName).toBe(secondSessionName);
  });

  it("emits all fallback files with raw HTML truncation metadata", () => {
    const files = buildFallbackExportFiles(item, snapshot);
    const names = files.map((file) => file.name);
    const itemJson = JSON.parse(files.find((file) => file.name === "item.json")!.text);
    const itemMarkdown = files.find((file) => file.name === "item.md")!.text;

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
    expect(itemMarkdown).toContain('course: "AP Calculus / Section A"');
    expect(itemMarkdown).toContain('title: "Derivative Practice: Unit 5"');
    expect(files.find((file) => file.name === "attachments.manifest.jsonl")!.text).toContain(
      "https://example.edu/derivative-reference"
    );
  });

  it("writes attachment download outcomes into Markdown, JSON, and manifest files", () => {
    const itemWithResults: ExportItem = {
      ...item,
      attachments: [
        {
          id: "attachment:downloaded",
          title: "Downloaded PDF",
          kind: "drive_file",
          sourceUrl: "https://drive.google.com/file/d/downloaded/view",
          browserDownloadUrl: "https://drive.google.com/uc?export=download&id=downloaded",
          exportUrls: [],
          downloadStatus: "downloaded",
          browserDownloadFilename: "CourseBinder/AP/Downloaded_PDF",
          originalDownloadPath: "/Users/student/Downloads/CourseBinder/AP/Downloaded_PDF",
          bytes: 2048,
          mime: "application/pdf",
          downloadId: 42
        },
        {
          id: "attachment:failed",
          title: "Failed PDF",
          kind: "drive_file",
          sourceUrl: "https://drive.google.com/file/d/failed/view",
          browserDownloadUrl: "https://drive.google.com/uc?export=download&id=failed",
          exportUrls: [],
          downloadStatus: "failed",
          browserDownloadFilename: "CourseBinder/AP/Failed_PDF",
          downloadError: "SERVER_BAD_CONTENT",
          downloadId: 43
        }
      ]
    };
    const files = buildFallbackExportFiles(itemWithResults, snapshot);
    const itemJson = JSON.parse(files.find((file) => file.name === "item.json")!.text);
    const itemMarkdown = files.find((file) => file.name === "item.md")!.text;
    const manifestRows = files
      .find((file) => file.name === "attachments.manifest.jsonl")!
      .text.trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(itemJson.attachments[0].downloadStatus).toBe("downloaded");
    expect(itemJson.attachments[1].downloadStatus).toBe("failed");
    expect(itemMarkdown).toContain("downloaded");
    expect(itemMarkdown).toContain("SERVER_BAD_CONTENT");
    expect(itemMarkdown).toContain("Attachment download statuses are best-effort browser results.");
    expect(itemMarkdown).toContain("does not bypass view-only");
    expect(manifestRows.map((row) => row.downloadStatus)).toEqual(["downloaded", "failed"]);
  });

  it("queues every fallback archive file through Chrome downloads", async () => {
    downloadMock.mockResolvedValueOnce(101);
    downloadMock.mockResolvedValueOnce(102);
    downloadMock.mockResolvedValueOnce(103);
    downloadMock.mockResolvedValueOnce(104);
    downloadMock.mockResolvedValueOnce(105);
    downloadMock.mockResolvedValueOnce(106);
    searchMock.mockImplementation(({ id }) =>
      Promise.resolve([
        {
          id,
          filename: `/Users/student/Downloads/CourseBinder/export-${id}`,
          state: "complete",
          fileSize: 10,
          bytesReceived: 10
        }
      ])
    );

    const result = await downloadFallbackExport(item, snapshot);
    const filenames = downloadMock.mock.calls.map(([options]) => options.filename);

    expect(result.ok).toBe(true);
    expect(result.downloadIds).toEqual([101, 102, 103, 104, 105, 106]);
    expect(downloadMock).toHaveBeenCalledTimes(6);
    expect(searchMock).toHaveBeenCalledTimes(6);
    expect(filenames).toEqual([
      `${result.root.replace("Downloads/", "")}/item.json`,
      `${result.root.replace("Downloads/", "")}/item.md`,
      `${result.root.replace("Downloads/", "")}/raw_text.txt`,
      `${result.root.replace("Downloads/", "")}/links.jsonl`,
      `${result.root.replace("Downloads/", "")}/attachments.manifest.jsonl`,
      `${result.root.replace("Downloads/", "")}/page.snapshot.html`,
    ]);
    expect(downloadMock.mock.calls.every(([options]) => options.url.startsWith("data:"))).toBe(true);
    expect(downloadMock.mock.calls.every(([options]) => options.conflictAction === "overwrite")).toBe(true);
    expect(downloadMock.mock.calls.every(([options]) => options.saveAs === false)).toBe(true);
  });

  it("does not report fallback success until generated archive downloads settle", async () => {
    downloadMock.mockResolvedValueOnce(101);
    downloadMock.mockResolvedValueOnce(102);
    downloadMock.mockResolvedValueOnce(103);
    downloadMock.mockResolvedValueOnce(104);
    downloadMock.mockResolvedValueOnce(105);
    downloadMock.mockResolvedValueOnce(106);
    searchMock.mockResolvedValue([
      {
        id: 101,
        filename: "/Users/student/Downloads/CourseBinder/still-writing",
        state: "in_progress"
      }
    ]);

    await expect(downloadFallbackExport(item, snapshot, buildFallbackSessionName(item), 1)).rejects.toThrow(
      "Timed out waiting for download 101"
    );
  });

  it("uses the same session folder for fallback files and attachment download jobs", () => {
    const itemWithDownload: ExportItem = {
      ...item,
      attachments: [
        {
          id: "attachment:pdf",
          title: "Derivative Practice PDF",
          kind: "drive_file",
          sourceUrl: "https://drive.google.com/file/d/drive-file-123/view",
          browserDownloadUrl: "https://drive.google.com/uc?export=download&id=drive-file-123",
          exportUrls: [],
          downloadStatus: "queued",
        },
      ],
    };
    const sessionName = buildFallbackSessionName(itemWithDownload);
    const sessionFolder = `CourseBinder/${sessionName}/`;
    const jobs = buildDownloadJobs(itemWithDownload.attachments, sessionName);

    expect(filenameForFallbackFile(sessionName, "item.json")).toBe(`${sessionFolder}item.json`);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.filename).toBe(`${sessionFolder}Derivative_Practice_PDF`);
  });
});
