import { defineBackground } from "wxt/utils/define-background";
import { browser, type Browser } from "wxt/browser";
import { inferExportItem } from "../lib/extractors/assignmentPage";
import type { PageSnapshot } from "../lib/extractors/classroomPage";
import {
  buildDownloadJobs,
  buildFinalizeDownloadResultsMessage,
  downloadJobs
} from "../lib/downloads/downloadQueue";
import { sendNativeMessage } from "../lib/native/nativeClient";

interface ExtractResponse {
  ok: boolean;
  snapshot?: PageSnapshot;
  item?: ReturnType<typeof inferExportItem>;
  error?: string;
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
  const item = extracted.item || inferExportItem(snapshot);
  const sessionPrefix = `${item.course.name}_${item.title}_${new Date().toISOString().slice(0, 10)}`;
  const jobs = downloadAttachments ? buildDownloadJobs(item.attachments, sessionPrefix) : [];

  const nativeResponse = await sendNativeMessage({
    type: "save_item",
    course_slug: item.course.name,
    item_slug: item.title,
    item,
    snapshot,
    download_jobs: jobs
  });

  const downloadResults = await downloadJobs(jobs);
  let downloadRecordResponse = null;
  if (nativeResponse.ok && nativeResponse.paths?.item_dir && downloadResults.length > 0) {
    downloadRecordResponse = await sendNativeMessage(
      buildFinalizeDownloadResultsMessage(item.id, nativeResponse.paths.item_dir, downloadResults)
    );
  }

  await browser.storage.session.set({
    lastExport: {
      exportedAt: new Date().toISOString(),
      item,
      nativeResponse,
      downloadRecordResponse,
      downloadResults
    }
  });

  return {
    ok: true,
    item,
    nativeResponse,
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
      return extractCurrentPage().catch((error: Error) => ({ ok: false, error: error.message }));
    }

    if (message?.type === "classroom_ai:native_health") {
      return nativeHealth().catch((error: Error) => ({ ok: false, error: error.message }));
    }

    if (message?.type === "classroom_ai:export_current") {
      return exportCurrentPage(Boolean(message.downloadAttachments)).catch((error: Error) => ({
        ok: false,
        error: error.message
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
