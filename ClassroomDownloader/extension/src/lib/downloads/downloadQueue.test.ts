import { describe, expect, it } from "vitest";
import {
  buildFinalizeDownloadResultsMessage,
  finalizeDownloadResult,
  type DownloadResult
} from "./downloadQueue";

describe("download finalization", () => {
  const started: DownloadResult = {
    attachmentId: "attachment:1",
    title: "Worksheet",
    url: "https://drive.google.com/uc?export=download&id=1",
    filename: "CourseBinder/Worksheet.pdf",
    ok: true,
    downloadId: 42,
    downloadStatus: "in_progress"
  };

  it("marks completed Chrome downloads as archive-ready", () => {
    const result = finalizeDownloadResult(started, {
      id: 42,
      filename: "/Users/student/Downloads/Worksheet.pdf",
      state: "complete",
      fileSize: 1234,
      bytesReceived: 1234,
      mime: "application/pdf"
    } as any);

    expect(result.ok).toBe(true);
    expect(result.downloadStatus).toBe("downloaded");
    expect(result.originalDownloadPath).toBe("/Users/student/Downloads/Worksheet.pdf");
    expect(result.bytes).toBe(1234);
  });

  it("builds the native finalize payload", () => {
    const message = buildFinalizeDownloadResultsMessage("item:1", "courses/AP/classwork/Worksheet", [started]);
    expect(message).toEqual({
      type: "finalize_download_results",
      item_id: "item:1",
      item_dir: "courses/AP/classwork/Worksheet",
      results: [started]
    });
  });
});
