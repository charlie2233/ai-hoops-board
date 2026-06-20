import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFinalizeDownloadResultsMessage,
  downloadJobs,
  finalizeDownloadResult,
  type DownloadResult
} from "./downloadQueue";

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

  beforeEach(() => {
    downloadMock.mockReset();
    searchMock.mockReset();
    addListenerMock.mockReset();
    removeListenerMock.mockReset();
  });

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

  it("finalizes downloads that completed before the change listener fires", async () => {
    downloadMock.mockResolvedValueOnce(42);
    searchMock.mockResolvedValueOnce([
      {
        id: 42,
        filename: "/Users/student/Downloads/CourseBinder/Worksheet.pdf",
        state: "complete",
        fileSize: 2048,
        bytesReceived: 2048,
        mime: "application/pdf"
      }
    ]);

    const results = await downloadJobs([
      {
        attachmentId: "attachment:1",
        title: "Worksheet",
        url: "https://drive.google.com/uc?export=download&id=1",
        filename: "CourseBinder/Worksheet.pdf"
      }
    ]);
    expect(results).toHaveLength(1);
    const result = results[0]!;

    expect(result.ok).toBe(true);
    expect(result.downloadStatus).toBe("downloaded");
    expect(result.originalDownloadPath).toBe("/Users/student/Downloads/CourseBinder/Worksheet.pdf");
    expect(result.bytes).toBe(2048);
    expect(addListenerMock).toHaveBeenCalledTimes(1);
    expect(removeListenerMock).toHaveBeenCalledTimes(1);
  });

  it("fails gracefully when a browser download does not settle", async () => {
    downloadMock.mockResolvedValueOnce(99);
    searchMock.mockResolvedValueOnce([
      {
        id: 99,
        filename: "/Users/student/Downloads/CourseBinder/Stuck.pdf",
        state: "in_progress",
        bytesReceived: 0
      }
    ]);

    const results = await downloadJobs(
      [
        {
          attachmentId: "attachment:stuck",
          title: "Stuck PDF",
          url: "https://drive.google.com/uc?export=download&id=stuck",
          filename: "CourseBinder/Stuck.pdf"
        }
      ],
      1
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      attachmentId: "attachment:stuck",
      ok: false,
      downloadStatus: "failed"
    });
    expect(results[0]?.error).toContain("Timed out waiting for download 99");
    expect(addListenerMock).toHaveBeenCalledTimes(1);
    expect(removeListenerMock).toHaveBeenCalledTimes(1);
  });
});
