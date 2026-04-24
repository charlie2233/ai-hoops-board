import { defineConfig } from "wxt";
import react from "@vitejs/plugin-react";

export default defineConfig({
  srcDir: "src",
  modules: [],
  vite: () => ({
    plugins: [react()]
  }),
  manifest: {
    name: "Classroom AI Exporter",
    description: "Export visible Google Classroom pages into a local AI-readable archive.",
    version: "0.1.0",
    permissions: ["activeTab", "downloads", "storage", "scripting", "nativeMessaging"],
    host_permissions: [
      "https://classroom.google.com/*",
      "https://drive.google.com/*",
      "https://docs.google.com/*"
    ],
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    action: {
      default_title: "Classroom AI Exporter",
      default_icon: {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png"
      }
    }
  }
});
