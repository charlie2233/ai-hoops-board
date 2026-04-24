export async function captureVisibleScreenshot(windowId: number | undefined): Promise<string> {
  if (windowId == null) {
    throw new Error("Active tab has no window id.");
  }

  return chrome.tabs.captureVisibleTab(windowId, { format: "png" });
}
