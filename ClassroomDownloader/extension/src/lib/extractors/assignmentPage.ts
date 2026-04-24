import type { PageSnapshot } from "./classroomPage";
import { classifyAttachments, type AttachmentCandidate } from "./attachmentClassifier";

export interface ExportItem {
  schema_version: "0.1";
  entity_type: "coursework" | "announcement" | "material" | "question" | "page";
  id: string;
  course: {
    id: string;
    name: string;
  };
  title: string;
  topic?: string;
  due?: {
    raw: string;
    date?: string;
    time?: string;
    timezone?: string;
    parse_confidence: number;
  };
  points?: {
    raw: string;
    value?: number;
  };
  instructions_text: string;
  source_url: string;
  captured_at: string;
  attachments: AttachmentCandidate[];
  crawler: {
    method: "chromium_extension_dom";
    confidence: number;
    raw_snapshot_path: string;
    raw_html_truncated: boolean;
    raw_html_original_chars: number;
    raw_html_stored_chars: number;
  };
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 33) ^ value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function firstUsefulHeading(snapshot: PageSnapshot): string {
  return snapshot.headings.find((heading) => !/google classroom/i.test(heading)) || snapshot.title || "Classroom page";
}

function inferCourseName(snapshot: PageSnapshot): string {
  const lines = snapshot.bodyText.split("\n").map((line) => line.trim()).filter(Boolean);
  const navMatch = snapshot.bodyText.replace(/\s+/g, " ").match(/^(.+?)\s+Stream\s+Classwork\b/i);
  if (navMatch?.[1]) {
    return navMatch[1].trim();
  }

  const classworkIndex = lines.findIndex((line) => /^stream$|^classwork$|^people$|^grades$/i.test(line));
  if (classworkIndex > 0) {
    const previous = lines[classworkIndex - 1] || "";
    if (/^stream$|^classwork$|^people$|^grades$/i.test(previous) && classworkIndex > 1) {
      return lines[classworkIndex - 2] || "Unknown course";
    }
    return previous || "Unknown course";
  }
  return snapshot.title.replace(/\s+-\s+Google Classroom$/i, "").trim() || "Unknown course";
}

function inferEntityType(snapshot: PageSnapshot): ExportItem["entity_type"] {
  const text = `${snapshot.url}\n${snapshot.bodyText}`.toLowerCase();
  if (text.includes("assignment") || text.includes("due ")) return "coursework";
  if (text.includes("material")) return "material";
  if (text.includes("question")) return "question";
  if (text.includes("announcement")) return "announcement";
  return "page";
}

function inferDue(snapshot: PageSnapshot): ExportItem["due"] | undefined {
  const match = snapshot.bodyText.match(/\bDue\s+([^\n]+)/i);
  if (!match?.[0]) return undefined;
  return {
    raw: match[0].trim(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    parse_confidence: 0.45
  };
}

function inferPoints(snapshot: PageSnapshot): ExportItem["points"] | undefined {
  const match = snapshot.bodyText.match(/\b(\d+(?:\.\d+)?)\s+points?\b/i);
  if (!match?.[0]) return undefined;
  return {
    raw: match[0],
    value: Number(match[1])
  };
}

function summarizeInstructions(snapshot: PageSnapshot): string {
  const lines = snapshot.bodyText.split("\n").map((line) => line.trim()).filter(Boolean);
  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 160)
    .join("\n");
}

export function inferExportItem(snapshot: PageSnapshot): ExportItem {
  const courseName = inferCourseName(snapshot);
  const title = firstUsefulHeading(snapshot);
  const identity = `${snapshot.url}:${title}:${snapshot.capturedAt}`;
  const attachments = classifyAttachments(snapshot.links).filter((attachment) => {
    const host = new URL(attachment.sourceUrl).hostname;
    return host !== "classroom.google.com";
  });

  const item: ExportItem = {
    schema_version: "0.1",
    entity_type: inferEntityType(snapshot),
    id: `classroom-ui:sha256:${stableHash(identity)}`,
    course: {
      id: `ui-course:${stableHash(courseName)}`,
      name: courseName
    },
    title,
    instructions_text: summarizeInstructions(snapshot),
    source_url: snapshot.url,
    captured_at: snapshot.capturedAt,
    attachments,
    crawler: {
      method: "chromium_extension_dom",
      confidence: 0.65,
      raw_snapshot_path: "page.snapshot.html",
      raw_html_truncated: snapshot.rawHtmlTruncated,
      raw_html_original_chars: snapshot.rawHtmlOriginalChars,
      raw_html_stored_chars: snapshot.rawHtmlStoredChars
    }
  };

  const due = inferDue(snapshot);
  const points = inferPoints(snapshot);
  if (due) item.due = due;
  if (points) item.points = points;
  return item;
}
