import { createPageHash } from "../lib/capture/pageHash";
import { makeArchiveFilename } from "../lib/archive/filenames";
import type { CapturedPage, PracticeArchive } from "../lib/archive/schema";
import { SCHEMA_VERSION } from "../lib/archive/schema";
import { injectClickNext, injectExtractPage } from "../lib/browser/inject";
import { captureVisibleScreenshot } from "../lib/browser/screenshot";
import { waitForStablePage } from "../lib/browser/waitForStablePage";
import { defineBackground } from "wxt/utils/define-background";

const DEFAULT_MAX_PAGES = 100;
const RUN_STATE_KEY = "formativeAiExporterRun";

type PopupMessage = {
  type: "CAPTURE_CURRENT_PAGE" | "CAPTURE_WHOLE_PRACTICE";
};

type CaptureResponse = {
  ok: boolean;
  pages?: number;
  filename?: string;
  stopReason?: string;
  error?: string;
};

type OffscreenBuildResponse =
  | {
      ok: true;
      objectUrl: string;
    }
  | {
      ok: false;
      error: string;
    };

export default defineBackground({
  type: "module",
  main() {
    chrome.runtime.onMessage.addListener((message: PopupMessage, _sender, sendResponse) => {
      if (message.type !== "CAPTURE_CURRENT_PAGE" && message.type !== "CAPTURE_WHOLE_PRACTICE") {
        return false;
      }

      void handlePopupMessage(message)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          } satisfies CaptureResponse)
        );

      return true;
    });
  }
});

async function handlePopupMessage(message: PopupMessage): Promise<CaptureResponse> {
  const tab = await getActiveTab();

  if (!tab.id) {
    throw new Error("No active tab id found.");
  }

  if (!isAllowedFormativeUrl(tab.url ?? "")) {
    throw new Error("Open a Formative practice tab before starting capture.");
  }

  if (message.type === "CAPTURE_CURRENT_PAGE") {
    const page = await captureOnePage(tab, 1);
    const practice = buildPractice([page], "current_page_only");
    return downloadPractice(practice);
  }

  const { pages, stopReason } = await captureWholePractice(tab.id, tab.windowId, DEFAULT_MAX_PAGES);
  const practice = buildPractice(pages, stopReason);
  return downloadPractice(practice);
}

async function captureWholePractice(
  tabId: number,
  windowId: number | undefined,
  maxPages: number
): Promise<{ pages: CapturedPage[]; stopReason: string }> {
  const pages: CapturedPage[] = [];
  const seenHashes = new Set<string>();
  let stopReason = "max_pages_reached";

  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
    await setRunState({ status: "capturing", pageIndex, maxPages });

    const page = await captureOnePage({ id: tabId, windowId } as chrome.tabs.Tab, pageIndex);

    if (!isAllowedFormativeUrl(page.url)) {
      stopReason = "left_formative_site";
      break;
    }

    if (!page.page_hash) {
      page.page_hash = hashPage(page);
    }

    if (seenHashes.has(page.page_hash)) {
      stopReason = "repeated_page_hash";
      break;
    }

    seenHashes.add(page.page_hash);
    pages.push(page);

    if (pageIndex >= maxPages) {
      stopReason = "max_pages_reached";
      break;
    }

    const clickResult = await injectClickNext(tabId);
    if (!clickResult.clicked) {
      stopReason = clickResult.label ? `${clickResult.reason}: ${clickResult.label}` : clickResult.reason;
      break;
    }

    await setRunState({
      status: "waiting",
      pageIndex,
      maxPages,
      clicked: clickResult.label
    });

    const stableResult = await waitForStablePage(tabId);
    if (!stableResult.changed) {
      stopReason = "no_dom_change_after_click";
      break;
    }
  }

  if (pages.length === 0) {
    throw new Error("No Formative pages were captured.");
  }

  await setRunState({ status: "complete", pageCount: pages.length, stopReason });
  return { pages, stopReason };
}

async function captureOnePage(tab: Pick<chrome.tabs.Tab, "id" | "windowId">, pageIndex: number): Promise<CapturedPage> {
  if (!tab.id) {
    throw new Error("Missing tab id for capture.");
  }

  const page = await injectExtractPage(tab.id);
  page.page_index = pageIndex;
  page.visual_backup = {
    ...page.visual_backup,
    screenshot_path: "screenshot.png"
  };
  page.page_hash = hashPage(page);

  try {
    page.screenshot_data_url = await captureVisibleScreenshot(tab.windowId);
  } catch (error) {
    page.visual_backup.screenshot_error = error instanceof Error ? error.message : String(error);
  }

  return page;
}

function buildPractice(pages: CapturedPage[], stopReason?: string): PracticeArchive {
  const firstPage = pages[0];

  return {
    schema_version: SCHEMA_VERSION,
    source: "formative-ui",
    title: firstPage?.title || "Formative Practice",
    url: firstPage?.url || "",
    captured_at: new Date().toISOString(),
    page_count: pages.length,
    pages,
    stop_reason: stopReason
  };
}

async function downloadPractice(practice: PracticeArchive): Promise<CaptureResponse> {
  await ensureOffscreenDocument();

  const buildResponse = (await chrome.runtime.sendMessage({
    type: "OFFSCREEN_BUILD_ZIP",
    practice
  })) as OffscreenBuildResponse;

  if (!buildResponse?.ok) {
    throw new Error(buildResponse?.error || "Offscreen ZIP builder failed.");
  }

  const filename = makeArchiveFilename(practice.title);
  await chrome.downloads.download({
    url: buildResponse.objectUrl,
    filename,
    saveAs: false,
    conflictAction: "uniquify"
  });

  globalThis.setTimeout(() => {
    void chrome.runtime.sendMessage({
      type: "OFFSCREEN_REVOKE_URL",
      objectUrl: buildResponse.objectUrl
    });
  }, 60_000);

  return {
    ok: true,
    pages: practice.pages.length,
    filename,
    stopReason: practice.stop_reason
  };
}

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  if (await hasOffscreenDocument(offscreenUrl)) {
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: "Build ZIP Blob URLs for local Formative exports."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Only a single offscreen document")) {
      throw error;
    }
  }
}

async function hasOffscreenDocument(offscreenUrl: string): Promise<boolean> {
  const runtimeWithContexts = chrome.runtime as typeof chrome.runtime & {
    getContexts?: (filter: {
      contextTypes: ["OFFSCREEN_DOCUMENT"];
      documentUrls: string[];
    }) => Promise<unknown[]>;
  };

  if (runtimeWithContexts.getContexts) {
    const contexts = await runtimeWithContexts.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
  }

  const offscreenWithHasDocument = chrome.offscreen as typeof chrome.offscreen & {
    hasDocument?: () => Promise<boolean>;
  };

  return offscreenWithHasDocument.hasDocument ? offscreenWithHasDocument.hasDocument() : false;
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    throw new Error("No active tab found.");
  }

  return tab;
}

function hashPage(page: CapturedPage): string {
  return createPageHash({
    url: page.url,
    visibleText: page.text.visible_text,
    answers: page.answers
  });
}

function isAllowedFormativeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "app.formative.com" ||
        url.hostname.endsWith(".formative.com") ||
        url.hostname.endsWith(".goformative.com"))
    );
  } catch {
    return false;
  }
}

async function setRunState(value: Record<string, unknown>): Promise<void> {
  try {
    await chrome.storage.session.set({
      [RUN_STATE_KEY]: {
        updatedAt: new Date().toISOString(),
        ...value
      }
    });
  } catch {
    await chrome.storage.local.set({
      [RUN_STATE_KEY]: {
        updatedAt: new Date().toISOString(),
        ...value
      }
    });
  }
}
