import { defineBackground } from "wxt/utils/define-background";
import { browser, type Browser } from "wxt/browser";
import { inferExportItem } from "../lib/extractors/assignmentPage";
import type { PageSnapshot } from "../lib/extractors/classroomPage";
import { buildDownloadJobs, downloadJob } from "../lib/downloads/downloadQueue";
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

  const nativeResponse = await sendNativeMessage({
    type: "save_item",
    course_slug: item.course.name,
    item_slug: item.title,
    item,
    snapshot
  });

  const jobs = downloadAttachments ? buildDownloadJobs(item.attachments, sessionPrefix) : [];
  const downloads = [];
  for (const job of jobs) {
    downloads.push({
      job,
      downloadId: await downloadJob(job)
    });
  }

  await browser.storage.session.set({
    lastExport: {
      exportedAt: new Date().toISOString(),
      item,
      nativeResponse,
      downloads
    }
  });

  return {
    ok: true,
    item,
    nativeResponse,
    downloads
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
