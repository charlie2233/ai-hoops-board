import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  manifest: {
    name: "Practice Snapshot for Formative",
    version: "0.1.0",
    description: "Save a visible Formative practice as a local ZIP with text, answers, images, links, and screenshots.",
    permissions: ["activeTab", "scripting", "downloads", "offscreen", "storage"],
    host_permissions: [
      "https://app.formative.com/*",
      "https://*.formative.com/*",
      "https://*.goformative.com/*"
    ],
    action: {
      default_title: "Practice Snapshot for Formative"
    }
  },
  hooks: {
    "entrypoints:found": (_, entrypoints) => {
      const offscreenScriptIndex = entrypoints.findIndex((entrypoint) =>
        entrypoint.inputPath.endsWith("/offscreen.ts")
      );

      if (offscreenScriptIndex >= 0) {
        entrypoints.splice(offscreenScriptIndex, 1);
      }
    }
  },
  vite: () => ({
    plugins: [react()]
  })
});
