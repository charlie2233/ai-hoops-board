import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractPageSnapshot, truncateRawHtml } from "./classroomPage";
import { inferExportItem } from "./assignmentPage";

describe("Classroom page extraction", () => {
  it("extracts a fixture assignment and classifies visible attachment links", () => {
    const html = readFileSync(
      resolve(__dirname, "../../../../tests/fixtures/classroom_assignment_page.html"),
      "utf-8"
    );
    document.documentElement.innerHTML = html;
    Object.defineProperty(document, "title", {
      configurable: true,
      value: "Derivative Practice - Google Classroom"
    });

    const location = new URL("https://classroom.google.com/c/abc/a/def/details") as unknown as Location;
    const snapshot = extractPageSnapshot(document, location);
    const item = inferExportItem(snapshot);

    expect(item.title).toBe("Derivative Practice");
    expect(item.course.name).toBe("AP Calculus");
    expect(item.points?.value).toBe(20);
    expect(item.attachments.map((attachment) => attachment.kind)).toEqual([
      "drive_file",
      "google_doc",
      "youtube",
      "external_link"
    ]);
    expect(item.attachments.some((attachment) => attachment.sourceUrl.includes("classroom.google.com"))).toBe(false);
    expect(item.attachments.at(-1)?.sourceUrl).toBe("https://example.edu/derivative-reference");
  });

  it("truncates raw HTML and records storage metadata", () => {
    const truncated = truncateRawHtml("abcdefghij", 4);

    expect(truncated.rawHtml).toBe("abcd");
    expect(truncated.rawHtmlTruncated).toBe(true);
    expect(truncated.rawHtmlOriginalChars).toBe(10);
    expect(truncated.rawHtmlStoredChars).toBe(4);
  });

  it("keeps item IDs stable across repeated exports of the same page", () => {
    const baseSnapshot = {
      url: "https://classroom.google.com/c/abc/a/def/details",
      title: "Derivative Practice - Google Classroom",
      capturedAt: "2026-04-24T18:30:00.000Z",
      headings: ["Derivative Practice"],
      links: [],
      buttons: [],
      bodyText: "AP Calculus\nStream\nClasswork\nDerivative Practice\nComplete problems 1-20.",
      rawHtml: "<html></html>",
      rawHtmlTruncated: false,
      rawHtmlOriginalChars: 13,
      rawHtmlStoredChars: 13
    };

    const first = inferExportItem(baseSnapshot);
    const second = inferExportItem({
      ...baseSnapshot,
      capturedAt: "2026-04-25T18:30:00.000Z"
    });

    expect(first.id).toBe(second.id);
    expect(first.captured_at).not.toBe(second.captured_at);
  });
});
