import JSZip from "jszip";
import type { CapturedPage, PageJson, PracticeArchive, PracticeJson } from "./schema";
import { ARCHIVE_ROOT, SCHEMA_VERSION } from "./schema";
import { buildPageMarkdown, buildPracticeMarkdown } from "./buildMarkdown";
import { pageFolderName } from "./filenames";

export async function buildZip(practice: PracticeArchive): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder(ARCHIVE_ROOT);

  if (!root) {
    throw new Error("Unable to create archive root folder.");
  }

  const practiceJson = toPracticeJson(practice);

  root.file("manifest.json", JSON.stringify(buildArchiveManifest(practice), null, 2));
  root.file("practice.json", JSON.stringify(practiceJson, null, 2));
  root.file("practice.md", buildPracticeMarkdown(practice));

  const pagesFolder = root.folder("pages");
  if (!pagesFolder) {
    throw new Error("Unable to create pages folder.");
  }

  for (const page of practice.pages) {
    const pageFolder = pagesFolder.folder(pageFolderName(page.page_index));
    if (!pageFolder) {
      throw new Error(`Unable to create folder for page ${page.page_index}.`);
    }

    const pageJson = toPageJson(page);
    pageFolder.file("page.json", JSON.stringify(pageJson, null, 2));
    pageFolder.file("page.md", buildPageMarkdown(page));
    pageFolder.file("visible_text.txt", page.text.visible_text);
    pageFolder.file("answers.json", JSON.stringify(page.answers, null, 2));
    pageFolder.file("images.jsonl", toJsonl(page.images));
    pageFolder.file("links.jsonl", toJsonl(page.links));
    pageFolder.file("raw.html", page.raw_html);

    if (page.screenshot_data_url) {
      pageFolder.file("screenshot.png", dataUrlToBase64(page.screenshot_data_url), { base64: true });
    }
  }

  const indexFolder = root.folder("index");
  if (!indexFolder) {
    throw new Error("Unable to create index folder.");
  }

  indexFolder.file("documents.jsonl", buildDocumentsJsonl(practice));
  indexFolder.file("chunks.jsonl", buildChunksJsonl(practice));

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

function buildArchiveManifest(practice: PracticeArchive) {
  return {
    schema_version: SCHEMA_VERSION,
    source: "formative-ui",
    generated_by: "Practice Snapshot for Formative",
    captured_at: practice.captured_at,
    title: practice.title,
    url: practice.url,
    page_count: practice.page_count,
    stop_reason: practice.stop_reason ?? ""
  };
}

function toPracticeJson(practice: PracticeArchive): PracticeJson {
  return {
    schema_version: practice.schema_version,
    source: practice.source,
    title: practice.title,
    url: practice.url,
    captured_at: practice.captured_at,
    page_count: practice.page_count,
    stop_reason: practice.stop_reason,
    pages: practice.pages.map(toPageJson)
  };
}

function toPageJson(page: CapturedPage): PageJson {
  const { raw_html: _rawHtml, screenshot_data_url: _screenshotDataUrl, ...rest } = page;

  return {
    ...rest,
    raw_html_path: "raw.html"
  };
}

function toJsonl(values: unknown[]): string {
  return `${values.map((value) => JSON.stringify(value)).join("\n")}${values.length ? "\n" : ""}`;
}

function dataUrlToBase64(dataUrl: string): string {
  const marker = ";base64,";
  const markerIndex = dataUrl.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error("Screenshot data URL is not base64 encoded.");
  }

  return dataUrl.slice(markerIndex + marker.length);
}

function buildDocumentsJsonl(practice: PracticeArchive): string {
  const documents = [
    {
      id: "practice",
      kind: "practice",
      title: practice.title,
      url: practice.url,
      path: "practice.md",
      captured_at: practice.captured_at
    },
    ...practice.pages.map((page) => ({
      id: `page_${page.page_index}`,
      kind: "page",
      title: page.text.headings[0] || `Page ${page.page_index}`,
      url: page.url,
      path: `pages/${pageFolderName(page.page_index)}/page.md`,
      screenshot_path: `pages/${pageFolderName(page.page_index)}/screenshot.png`,
      captured_at: page.captured_at
    }))
  ];

  return toJsonl(documents);
}

function buildChunksJsonl(practice: PracticeArchive): string {
  const chunks = practice.pages.flatMap((page) => chunkText(page.text.visible_text).map((text, index) => ({
    id: `page_${page.page_index}_chunk_${index + 1}`,
    document_id: `page_${page.page_index}`,
    page_index: page.page_index,
    chunk_index: index + 1,
    text,
    source_path: `pages/${pageFolderName(page.page_index)}/visible_text.txt`
  })));

  return toJsonl(chunks);
}

function chunkText(value: string, size = 4000): string[] {
  if (!value) {
    return [];
  }

  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }

  return chunks;
}
