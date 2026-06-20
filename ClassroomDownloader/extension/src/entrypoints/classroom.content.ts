import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { extractPageSnapshot } from "../lib/extractors/classroomPage";
import { inferExportItem } from "../lib/extractors/assignmentPage";

export default defineContentScript({
  matches: ["https://classroom.google.com/*"],
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message) => {
      if (message?.type !== "classroom_ai:extract_page") {
        return undefined;
      }

      const snapshot = extractPageSnapshot();
      return Promise.resolve({
        ok: true,
        snapshot,
        item: inferExportItem(snapshot)
      });
    });
  }
});
