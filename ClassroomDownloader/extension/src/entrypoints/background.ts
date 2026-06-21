import { defineBackground } from "wxt/utils/define-background";
import { browser, type Browser } from "wxt/browser";
import { inferExportItem, type ExportItem } from "../lib/extractors/assignmentPage";
import type { PageSnapshot } from "../lib/extractors/classroomPage";
import {
  buildDownloadJobs,
  buildFinalizeDownloadResultsMessage,
  downloadJobs,
  type DownloadResult
} from "../lib/downloads/downloadQueue";
import {
  buildFallbackSessionName,
  downloadFallbackExport,
  type FallbackExportResult
} from "../lib/fallback/fallbackExport";
import { sendNativeMessage } from "../lib/native/nativeClient";
import { userFacingExtractionError } from "../lib/runtime/errors";

interface ExtractResponse {
  ok: boolean;
  snapshot?: PageSnapshot;
  item?: ExportItem;
  error?: string;
}

function mergeDownloadResultsIntoItem(item: ExportItem, results: DownloadResult[]): ExportItem {
  if (!results.length) return item;

  const resultsByAttachment = new Map<string, DownloadResult>();
  for (const result of results) {
    if (!resultsByAttachment.has(result.attachmentId)) {
      resultsByAttachment.set(result.attachmentId, result);
    }
  }

  return {
    ...item,
    attachments: item.attachments.map((attachment) => {
      const result = resultsByAttachment.get(attachment.id);
      if (!result) return attachment;

      const updatedAttachment = {
        ...attachment,
        downloadStatus: result.downloadStatus || (result.ok ? "downloaded" : "failed"),
        downloadAttemptUrl: result.url,
        browserDownloadFilename: result.filename,
      };
      if (result.originalDownloadPath) updatedAttachment.originalDownloadPath = result.originalDownloadPath;
      if (result.bytes) updatedAttachment.bytes = result.bytes;
      if (result.mime) updatedAttachment.mime = result.mime;
      if (result.error) updatedAttachment.downloadError = result.error;
      if (result.downloadId) updatedAttachment.downloadId = result.downloadId;
      return updatedAttachment;
    })
  };
}

async function activeClassroomTab(): Promise<Browser.tabs.Tab> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://classroom.google.com/")) {
    throw new Error("Open a Google Classroom page before exporting.");
  }
  return tab;
}

async function extractCurrentPage(): Promise<ExtractResponse> {
  const tab = await activeClassroomTab();
  const response = (await browser.tabs.sendMessage(tab.id!, {
    type: "classroom_ai:extract_page"
  })) as ExtractResponse;

  if (!response?.ok || !response.snapshot) {
    throw new Error(response?.error || "Could not extract the current Classroom page.");
  }

  return response;
}

async function exportCurrentPage(downloadAttachments: boolean) {
  const extracted = await extractCurrentPage();
  const snapshot = extracted.snapshot!;
  let item = extracted.item || inferExportItem(snapshot);
  const fallbackSessionName = buildFallbackSessionName(item);
  const jobs = downloadAttachments ? buildDownloadJobs(item.attachments, fallbackSessionName) : [];

  const nativeResponse = await sendNativeMessage({
    type: "save_item",
    course_slug: item.course.name,
    item_slug: item.title,
    item,
    snapshot,
    download_jobs: jobs
  });
  let fallbackResponse: FallbackExportResult | null = null;
  if (!nativeResponse.ok) {
    try {
      fallbackResponse = await downloadFallbackExport(item, snapshot, fallbackSessionName);
    } catch (error) {
      fallbackResponse = {
        ok: false,
        root: "Downloads/CourseBinder",
        paths: {},
        downloadIds: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  if (!nativeResponse.ok && !fallbackResponse?.ok) {
    throw new Error(
      `Browser-download export failed: ${fallbackResponse?.error || nativeResponse.error || "unknown error"}`
    );
  }

  const downloadResults = await downloadJobs(jobs);
  let downloadRecordResponse = null;
  if (nativeResponse.ok && nativeResponse.paths?.item_dir && downloadResults.length > 0) {
    downloadRecordResponse = await sendNativeMessage(
      buildFinalizeDownloadResultsMessage(item.id, nativeResponse.paths.item_dir, downloadResults)
    );
  }

  if (!nativeResponse.ok && fallbackResponse?.ok && downloadResults.length > 0) {
    item = mergeDownloadResultsIntoItem(item, downloadResults);
    try {
      fallbackResponse = await downloadFallbackExport(item, snapshot, fallbackSessionName);
    } catch (error) {
      fallbackResponse = {
        ...fallbackResponse,
        error: `Saved initial archive files, but could not update attachment download results: ${
          error instanceof Error ? error.message : String(error)
        }`
      };
    }
  }

  await browser.storage.session.set({
    lastExport: {
      exportedAt: new Date().toISOString(),
      item,
      nativeResponse,
      fallbackResponse,
      downloadRecordResponse,
      downloadResults
    }
  });

  return {
    ok: true,
    item,
    nativeResponse,
    fallbackResponse,
    downloadRecordResponse,
    downloads: {
      requested: jobs.length,
      succeeded: downloadResults.filter((result) => result.ok).length,
      failed: downloadResults.filter((result) => !result.ok).length,
      results: downloadResults
    }
  };
}

async function nativeHealth() {
  const ping = await sendNativeMessage({ type: "ping" });
  const health = ping.ok ? await sendNativeMessage({ type: "show_export_health" }) : ping;
  const lastExport = await browser.storage.session.get("lastExport");
  return {
    ok: true,
    native: {
      connected: ping.ok,
      root: ping.root || health.root || null,
      error: ping.ok ? health.error || null : ping.error || null,
      health
    },
    lastExport: lastExport.lastExport ?? null
  };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "classroom_ai:ping") {
      return Promise.resolve({ ok: true });
    }

    if (message?.type === "classroom_ai:extract_current") {
      return extractCurrentPage().catch((error: unknown) => ({ ok: false, error: userFacingExtractionError(error) }));
    }

    if (message?.type === "classroom_ai:native_health") {
      return nativeHealth().catch((error: Error) => ({ ok: false, error: error.message }));
    }

    if (message?.type === "classroom_ai:export_current") {
      return exportCurrentPage(Boolean(message.downloadAttachments)).catch((error: unknown) => ({
        ok: false,
        error: userFacingExtractionError(error)
      }));
    }

    if (message?.type === "classroom_ai:last_export") {
      return browser.storage.session
        .get("lastExport")
        .then((value) => ({ ok: true, lastExport: value.lastExport ?? null }));
    }

    return undefined;
  });
});
