import type { AttachmentCandidate } from "../extractors/attachmentClassifier";
import { browser, type Browser } from "wxt/browser";

export interface DownloadJob {
  attachmentId: string;
  title: string;
  url: string;
  filename: string;
}

export interface DownloadResult {
  attachmentId: string;
  title: string;
  url: string;
  filename: string;
  ok: boolean;
  downloadId?: number;
  downloadStatus?: "downloaded" | "failed" | "in_progress";
  originalDownloadPath?: string;
  bytes?: number;
  mime?: string;
  error?: string;
}

export interface FinalizeDownloadResultsMessage {
  type: "finalize_download_results";
  item_dir: string;
  item_id: string;
  results: DownloadResult[];
}

function safeFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w .-]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "attachment";
}

function extensionForUrl(url: string): string {
  const parsed = new URL(url);
  const format = parsed.searchParams.get("format");
  if (format) return `.${format.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
  if (parsed.pathname.endsWith("/export/pdf")) return ".pdf";
  if (parsed.pathname.endsWith("/export/pptx")) return ".pptx";
  return "";
}

export function buildDownloadJobs(attachments: AttachmentCandidate[], sessionPrefix: string): DownloadJob[] {
  return attachments.flatMap((attachment) => {
    const urls = attachment.browserDownloadUrl ? [attachment.browserDownloadUrl] : attachment.exportUrls;
    return urls.map((url, index) => {
      const suffix = extensionForUrl(url);
      const baseName = safeFilename(attachment.title);
      return {
        attachmentId: attachment.id,
        title: attachment.title,
        url,
        filename: `ClassroomAIExporter/${safeFilename(sessionPrefix)}/${baseName}${index ? `_${index + 1}` : ""}${suffix}`
      };
    });
  });
}

export async function downloadJob(job: DownloadJob): Promise<number> {
  return browser.downloads.download({
    url: job.url,
    filename: job.filename,
    conflictAction: "uniquify",
    saveAs: false
  });
}

function timeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function finalizeDownloadResult(
  result: DownloadResult,
  item?: Browser.downloads.DownloadItem
): DownloadResult {
  if (!item) {
    return {
      ...result,
      ok: false,
      downloadStatus: "failed",
      error: result.error || "download item was not available"
    };
  }

  const complete = item.state === "complete";
  const finalized: DownloadResult = {
    ...result,
    ok: complete,
    downloadStatus: complete ? "downloaded" : "failed"
  };
  const originalDownloadPath = item.filename || result.originalDownloadPath;
  if (originalDownloadPath) {
    finalized.originalDownloadPath = originalDownloadPath;
  }
  const bytes = item.fileSize || item.bytesReceived || result.bytes;
  if (bytes) {
    finalized.bytes = bytes;
  }
  const mime = item.mime || result.mime;
  if (mime) {
    finalized.mime = mime;
  }
  const error = complete ? result.error : item.error || result.error || "download did not complete";
  if (error) finalized.error = error;
  return finalized;
}

async function waitForDownloadItem(downloadId: number, timeoutMs: number): Promise<Browser.downloads.DownloadItem> {
  const waitForChange = new Promise<void>((resolve, reject) => {
    const listener = (delta: Browser.downloads.DownloadDelta) => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === "complete" || delta.state?.current === "interrupted") {
        browser.downloads.onChanged.removeListener(listener);
        resolve();
      }
      if (delta.error?.current) {
        browser.downloads.onChanged.removeListener(listener);
        reject(new Error(delta.error.current));
      }
    };
    browser.downloads.onChanged.addListener(listener);
  });

  await timeout(waitForChange, timeoutMs, `Timed out waiting for download ${downloadId}`);
  const [item] = await browser.downloads.search({ id: downloadId });
  if (!item) {
    throw new Error(`Could not find completed download ${downloadId}`);
  }
  return item;
}

export async function downloadJobs(jobs: DownloadJob[], settleTimeoutMs = 300_000): Promise<DownloadResult[]> {
  const started: DownloadResult[] = [];
  for (const job of jobs) {
    try {
      started.push({
        ...job,
        ok: true,
        downloadId: await downloadJob(job),
        downloadStatus: "in_progress"
      });
    } catch (error) {
      started.push({
        ...job,
        ok: false,
        downloadStatus: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return Promise.all(
    started.map(async (result) => {
      if (!result.downloadId) return result;
      try {
        return finalizeDownloadResult(result, await waitForDownloadItem(result.downloadId, settleTimeoutMs));
      } catch (error) {
        return {
          ...result,
          ok: false,
          downloadStatus: "failed" as const,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );
}

export function buildFinalizeDownloadResultsMessage(
  itemId: string,
  itemDir: string,
  results: DownloadResult[]
): FinalizeDownloadResultsMessage {
  return {
    type: "finalize_download_results",
    item_id: itemId,
    item_dir: itemDir,
    results
  };
}
