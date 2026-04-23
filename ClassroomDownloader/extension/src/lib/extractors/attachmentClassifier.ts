import type { ExtractedLink } from "./classroomPage";

export type AttachmentKind =
  | "drive_file"
  | "google_doc"
  | "google_sheet"
  | "google_slide"
  | "drive_folder"
  | "youtube"
  | "external_link"
  | "unknown";

export interface AttachmentCandidate {
  id: string;
  title: string;
  kind: AttachmentKind;
  sourceUrl: string;
  browserDownloadUrl?: string;
  exportUrls: string[];
  downloadStatus: "queued" | "metadata_only";
  reason?: string;
}

function hashSeed(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function extractMatch(url: URL, regex: RegExp): string | undefined {
  const match = url.href.match(regex);
  return match?.[1];
}

function linkTitle(link: ExtractedLink): string {
  return link.text || link.ariaLabel || link.title || new URL(link.href).hostname || "attachment";
}

function driveFileDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

function docsExportUrls(kind: AttachmentKind, docId: string): string[] {
  if (kind === "google_doc") {
    return [
      `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=pdf`,
      `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=docx`
    ];
  }

  if (kind === "google_sheet") {
    return [
      `https://docs.google.com/spreadsheets/d/${encodeURIComponent(docId)}/export?format=xlsx`,
      `https://docs.google.com/spreadsheets/d/${encodeURIComponent(docId)}/export?format=pdf`
    ];
  }

  if (kind === "google_slide") {
    return [
      `https://docs.google.com/presentation/d/${encodeURIComponent(docId)}/export/pptx`,
      `https://docs.google.com/presentation/d/${encodeURIComponent(docId)}/export/pdf`
    ];
  }

  return [];
}

export function classifyAttachment(link: ExtractedLink): AttachmentCandidate {
  const url = new URL(link.href);
  const title = linkTitle(link);
  const base = {
    id: `attachment:ui:${hashSeed(`${title}:${url.href}`)}`,
    title,
    sourceUrl: url.href
  };

  const driveFileId = extractMatch(url, /drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (driveFileId) {
    return {
      ...base,
      kind: "drive_file",
      browserDownloadUrl: driveFileDownloadUrl(driveFileId),
      exportUrls: [],
      downloadStatus: "queued"
    };
  }

  const folderId = extractMatch(url, /drive\.google\.com\/drive\/folders\/([^/?#]+)/);
  if (folderId) {
    return {
      ...base,
      kind: "drive_folder",
      exportUrls: [],
      downloadStatus: "metadata_only",
      reason: "drive_folder_requires_visible_page_crawl"
    };
  }

  const docId = extractMatch(url, /docs\.google\.com\/document\/d\/([^/?#]+)/);
  if (docId) {
    return {
      ...base,
      kind: "google_doc",
      exportUrls: docsExportUrls("google_doc", docId),
      downloadStatus: "queued"
    };
  }

  const sheetId = extractMatch(url, /docs\.google\.com\/spreadsheets\/d\/([^/?#]+)/);
  if (sheetId) {
    return {
      ...base,
      kind: "google_sheet",
      exportUrls: docsExportUrls("google_sheet", sheetId),
      downloadStatus: "queued"
    };
  }

  const slideId = extractMatch(url, /docs\.google\.com\/presentation\/d\/([^/?#]+)/);
  if (slideId) {
    return {
      ...base,
      kind: "google_slide",
      exportUrls: docsExportUrls("google_slide", slideId),
      downloadStatus: "queued"
    };
  }

  if (url.hostname.includes("youtube.com") || url.hostname === "youtu.be") {
    return {
      ...base,
      kind: "youtube",
      exportUrls: [],
      downloadStatus: "metadata_only",
      reason: "external_media_saved_as_link"
    };
  }

  return {
    ...base,
    kind: url.protocol.startsWith("http") ? "external_link" : "unknown",
    exportUrls: [],
    downloadStatus: "metadata_only",
    reason: "no_browser_download_strategy"
  };
}

export function classifyAttachments(links: ExtractedLink[]): AttachmentCandidate[] {
  const candidates = links.map(classifyAttachment);
  const useful = candidates.filter(
    (candidate) => candidate.kind !== "external_link" || candidate.sourceUrl.includes("classroom.google.com")
  );
  return Array.from(new Map(useful.map((candidate) => [candidate.sourceUrl, candidate])).values());
}
