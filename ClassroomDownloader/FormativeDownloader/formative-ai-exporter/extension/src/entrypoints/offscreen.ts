import { buildZip } from "../lib/archive/buildZip";
import type { PracticeArchive } from "../lib/archive/schema";

type OffscreenMessage = {
  type: "OFFSCREEN_BUILD_ZIP" | "OFFSCREEN_REVOKE_URL";
  practice?: PracticeArchive;
  objectUrl?: string;
};

chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_BUILD_ZIP") {
    void buildObjectUrl(message.practice)
      .then((objectUrl) => sendResponse({ ok: true, objectUrl }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );

    return true;
  }

  if (message.type === "OFFSCREEN_REVOKE_URL" && message.objectUrl) {
    URL.revokeObjectURL(message.objectUrl);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function buildObjectUrl(practice: PracticeArchive | undefined): Promise<string> {
  if (!practice) {
    throw new Error("Missing practice payload for ZIP creation.");
  }

  const zipBlob = await buildZip(practice);
  return URL.createObjectURL(zipBlob);
}
