const FALLBACK_TITLE = "formative-practice";

export function pageFolderName(pageIndex: number): string {
  return `page_${String(pageIndex).padStart(3, "0")}`;
}

export function safeTitle(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || FALLBACK_TITLE;
}

export function timestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function makeArchiveFilename(title: string, date = new Date()): string {
  return `FormativeAIExport/${safeTitle(title)}-${timestampForFilename(date)}.zip`;
}
