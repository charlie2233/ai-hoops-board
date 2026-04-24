export type StablePageResult = {
  changed: boolean;
  reason: "stable" | "timeout" | "script_error";
  detail?: string;
};

export async function waitForStablePage(
  tabId: number,
  timeoutMs = 8000,
  quietMs = 600
): Promise<StablePageResult> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: waitForStablePageInPage,
      args: [timeoutMs, quietMs]
    });

    return (result?.result as StablePageResult | undefined) ?? {
      changed: false,
      reason: "script_error",
      detail: "No result returned from stable-page watcher."
    };
  } catch (error) {
    return {
      changed: true,
      reason: "script_error",
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function waitForStablePageInPage(timeoutMs: number, quietMs: number): Promise<StablePageResult> {
  return new Promise((resolve) => {
    let settled = false;
    let changed = false;
    let quietTimer: number | undefined;
    const startUrl = location.href;
    const startText = document.body?.innerText || "";

    const finish = (reason: StablePageResult["reason"], detail?: string) => {
      if (settled) {
        return;
      }

      settled = true;
      observer.disconnect();
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      if (quietTimer != null) {
        clearTimeout(quietTimer);
      }
      resolve({ changed, reason, detail });
    };

    const markChanged = () => {
      changed = true;
      if (quietTimer != null) {
        clearTimeout(quietTimer);
      }
      quietTimer = window.setTimeout(() => finish("stable"), quietMs);
    };

    const observer = new MutationObserver(markChanged);
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });

    const intervalId = window.setInterval(() => {
      const text = document.body?.innerText || "";
      if (location.href !== startUrl || text !== startText) {
        markChanged();
      }
    }, 150);

    const timeoutId = window.setTimeout(() => {
      finish("timeout", changed ? "Page changed but did not become quiet." : "No DOM or route change detected.");
    }, timeoutMs);
  });
}
