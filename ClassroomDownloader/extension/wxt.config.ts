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
    action: {
      default_title: "Classroom AI Exporter"
    }
  }
});
