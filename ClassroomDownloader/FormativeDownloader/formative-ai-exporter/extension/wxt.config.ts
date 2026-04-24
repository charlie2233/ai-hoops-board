import react from "@vitejs/plugin-react";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  manifest: {
    name: "Formative AI Exporter",
    version: "0.1.0",
    description: "Export a visible Formative practice into an AI-readable local archive.",
    permissions: ["activeTab", "scripting", "downloads", "offscreen", "storage"],
    host_permissions: [
      "https://app.formative.com/*",
      "https://*.formative.com/*",
      "https://*.goformative.com/*"
    ],
    action: {
      default_title: "Formative AI Exporter"
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
