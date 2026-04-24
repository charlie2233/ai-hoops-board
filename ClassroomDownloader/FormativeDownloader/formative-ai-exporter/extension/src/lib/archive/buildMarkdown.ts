import type { AnswerRecord, CapturedPage, ImageRecord, LinkRecord, PracticeArchive } from "./schema";
import { AI_NOTE } from "./schema";
import { pageFolderName } from "./filenames";

export function buildPracticeMarkdown(practice: PracticeArchive): string {
  const lines = [
    "---",
    "source: formative-ui",
    `captured_at: ${practice.captured_at}`,
    `page_count: ${practice.page_count}`,
    "---",
    "",
    `# ${practice.title || "Formative Practice"}`,
    "",
    `Source URL: ${practice.url}`,
    "",
    "## Pages",
    "",
    ...practice.pages.map((page) => {
      const folder = pageFolderName(page.page_index);
      const heading = page.text.headings[0] || `Page ${page.page_index}`;
      return `- Page ${page.page_index}: ${heading} (${folder}/page.md, ${folder}/screenshot.png)`;
    }),
    "",
    "## Notes for AI",
    "",
    AI_NOTE,
    ""
  ];

  if (practice.stop_reason) {
    lines.splice(lines.length - 3, 0, `Capture stop reason: ${practice.stop_reason}`, "");
  }

  return lines.join("\n");
}

export function buildPageMarkdown(page: CapturedPage): string {
  return [
    "---",
    "source: formative-ui",
    `page_index: ${page.page_index}`,
    `url: ${page.url}`,
    `captured_at: ${page.captured_at}`,
    "screenshot: screenshot.png",
    "---",
    "",
    `# Page ${page.page_index}`,
    "",
    "## Visible Text",
    "",
    page.text.visible_text || "_No visible text captured._",
    "",
    "## User Answers",
    "",
    ...formatAnswers(page.answers),
    "",
    "## Images",
    "",
    ...formatImages(page.images),
    "- Screenshot: `screenshot.png`",
    "",
    "## Links",
    "",
    ...formatLinks(page.links),
    "",
    "## Notes for AI",
    "",
    AI_NOTE,
    ""
  ].join("\n");
}

function formatAnswers(answers: AnswerRecord[]): string[] {
  if (answers.length === 0) {
    return ["- No user-answer DOM state captured."];
  }

  return answers.map((answer) => {
    const label = answer.label_guess ? `${answer.label_guess}: ` : "";
    if (answer.kind === "checkbox" || answer.kind === "radio") {
      return `- ${answer.kind} ${label}${answer.checked ? "checked" : "not checked"}${
        answer.value ? ` (${answer.value})` : ""
      }`;
    }

    if (answer.kind === "select") {
      return `- Select ${label}${answer.selected_text || answer.value || ""}`;
    }

    return `- ${answer.kind} ${label}${answer.value ?? answer.text ?? answer.ariaLabel ?? ""}`;
  });
}

function formatImages(images: ImageRecord[]): string[] {
  if (images.length === 0) {
    return ["- No image/media DOM metadata captured."];
  }

  return images.map((image, index) => {
    const size = image.width || image.height ? `, ${image.width ?? "?"}x${image.height ?? "?"}` : "";
    const label = image.alt || image.text || image.src || image.srcset || image.poster || "visual element";
    return `- Image ${index + 1}: ${image.kind}, ${label}${size}`;
  });
}

function formatLinks(links: LinkRecord[]): string[] {
  if (links.length === 0) {
    return ["- No links captured."];
  }

  return links.map((link) => `- ${link.text || link.aria_label || link.href}: ${link.href}`);
}
