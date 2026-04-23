import type { AttachmentCandidate } from "../extractors/attachmentClassifier";
import { browser } from "wxt/browser";

export interface DownloadJob {
  attachmentId: string;
  title: string;
  url: string;
  filename: string;
}

function safeFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w .-]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "attachment";
}

function extensionForUrl(url: string): string {
  const parsed = new URL(url);
  const format = parsed.searchParams.get("format");
  if (format) return `.${format.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
  if (parsed.pathname.endsWith("/export/pdf")) return ".pdf";
  if (parsed.pathname.endsWith("/export/pptx")) return ".pptx";
  return "";
}

export function buildDownloadJobs(attachments: AttachmentCandidate[], sessionPrefix: string): DownloadJob[] {
  return attachments.flatMap((attachment) => {
    const urls = attachment.browserDownloadUrl ? [attachment.browserDownloadUrl] : attachment.exportUrls;
    return urls.map((url, index) => {
      const suffix = extensionForUrl(url);
      const baseName = safeFilename(attachment.title);
      return {
        attachmentId: attachment.id,
        title: attachment.title,
        url,
        filename: `ClassroomAIExporter/${safeFilename(sessionPrefix)}/${baseName}${index ? `_${index + 1}` : ""}${suffix}`
      };
    });
  });
}

export async function downloadJob(job: DownloadJob): Promise<number> {
  return browser.downloads.download({
    url: job.url,
    filename: job.filename,
    conflictAction: "uniquify",
    saveAs: false
  });
}
