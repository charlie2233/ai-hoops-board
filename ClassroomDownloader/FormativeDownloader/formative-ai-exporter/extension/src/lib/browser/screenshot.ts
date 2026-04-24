const MIN_CAPTURE_INTERVAL_MS = 550;

let lastCaptureAt = 0;
let captureQueue = Promise.resolve();

export async function captureVisibleScreenshot(windowId: number | undefined): Promise<string> {
  if (windowId == null) {
    throw new Error("Active tab has no window id.");
  }

  const capture = captureQueue.then(async () => {
    const waitMs = Math.max(0, MIN_CAPTURE_INTERVAL_MS - (Date.now() - lastCaptureAt));
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const screenshot = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    lastCaptureAt = Date.now();
    return screenshot;
  });

  captureQueue = capture.then(
    () => undefined,
    () => undefined
  );

  return capture;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
