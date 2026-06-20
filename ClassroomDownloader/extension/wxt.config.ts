import { defineConfig } from "wxt";
import react from "@vitejs/plugin-react";

const enableNativeMessaging = process.env.COURSEBINDER_ENABLE_NATIVE === "1";

export default defineConfig({
  srcDir: "src",
  modules: [],
  vite: () => ({
    plugins: [react()]
  }),
  manifest: {
    name: "CourseBinder – AI-Ready Google Classroom Exporter",
    description: "CourseBinder exports visible Google Classroom pages into local AI-readable archives.",
    version: "0.1.4",
    permissions: ["downloads", "storage", ...(enableNativeMessaging ? ["nativeMessaging"] : [])],
    host_permissions: ["https://classroom.google.com/*"],
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    },
    action: {
      default_title: "CourseBinder – AI-Ready Google Classroom Exporter",
      default_icon: {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png"
      }
    }
  }
});
