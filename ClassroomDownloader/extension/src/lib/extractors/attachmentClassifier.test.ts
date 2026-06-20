import { describe, expect, it } from "vitest";
import { classifyAttachment } from "./attachmentClassifier";

describe("attachment classification", () => {
  it("keeps external links as metadata-only attachments", () => {
    const attachment = classifyAttachment({
      text: "Reference article",
      href: "https://example.edu/reference",
      ariaLabel: "",
      title: "",
      role: ""
    });

    expect(attachment.kind).toBe("external_link");
    expect(attachment.downloadStatus).toBe("metadata_only");
    expect(attachment.sourceUrl).toBe("https://example.edu/reference");
  });

  it("uses one best-effort export URL for Google editor attachments", () => {
    const doc = classifyAttachment({
      text: "Teacher notes",
      href: "https://docs.google.com/document/d/doc-123/edit",
      ariaLabel: "",
      title: "",
      role: ""
    });
    const sheet = classifyAttachment({
      text: "Scores",
      href: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
      ariaLabel: "",
      title: "",
      role: ""
    });
    const slide = classifyAttachment({
      text: "Lecture slides",
      href: "https://docs.google.com/presentation/d/slide-123/edit",
      ariaLabel: "",
      title: "",
      role: ""
    });

    expect(doc.exportUrls).toEqual(["https://docs.google.com/document/d/doc-123/export?format=pdf"]);
    expect(sheet.exportUrls).toEqual(["https://docs.google.com/spreadsheets/d/sheet-123/export?format=xlsx"]);
    expect(slide.exportUrls).toEqual(["https://docs.google.com/presentation/d/slide-123/export/pptx"]);
  });
});
