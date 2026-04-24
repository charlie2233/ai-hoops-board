import type { CapturedPage, PageText } from "../archive/schema";
import { SCHEMA_VERSION } from "../archive/schema";
import { extractAnswers } from "./extractAnswers";
import { extractImages } from "./extractImages";
import { extractLinks } from "./extractLinks";
import { normalizeSpace, textOf, visibleTextFromBody } from "./domUtils";

const MAX_RAW_HTML_LENGTH = 2_000_000;

export function extractPage(doc: Document = document): CapturedPage {
  const rawHtml = doc.documentElement.outerHTML;

  return {
    schema_version: SCHEMA_VERSION,
    source: "formative-ui",
    page_index: 0,
    title: doc.title || "Formative Practice",
    url: doc.location.href,
    captured_at: new Date().toISOString(),
    text: extractPageText(doc),
    answers: extractAnswers(doc),
    images: extractImages(doc),
    links: extractLinks(doc),
    visual_backup: {
      screenshot_path: "screenshot.png"
    },
    raw_html: rawHtml.slice(0, MAX_RAW_HTML_LENGTH),
    raw_html_truncated: rawHtml.length > MAX_RAW_HTML_LENGTH
  };
}

export function extractPageText(doc: Document = document): PageText {
  return {
    visible_text: visibleTextFromBody(doc),
    headings: uniqueTexts(doc.querySelectorAll("h1, h2, h3, h4, h5, h6")),
    buttons: uniqueTexts(
      doc.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'),
      buttonText
    ),
    aria_labels: uniqueStrings(
      Array.from(doc.querySelectorAll("[aria-label]")).map((element) =>
        normalizeSpace(element.getAttribute("aria-label"))
      )
    ),
    alt_texts: uniqueStrings(
      Array.from(doc.querySelectorAll("[alt]")).map((element) => normalizeSpace(element.getAttribute("alt")))
    ),
    math_texts: uniqueTexts(doc.querySelectorAll(".MathJax, .katex, [data-mathml], math"))
  };
}

function uniqueTexts(elements: NodeListOf<Element>, mapper: (element: Element) => string = textOf): string[] {
  return uniqueStrings(Array.from(elements).map(mapper));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeSpace).filter(Boolean)));
}

function buttonText(element: Element): string {
  if (element instanceof HTMLInputElement) {
    return normalizeSpace(element.value || element.getAttribute("aria-label") || element.title);
  }

  return normalizeSpace(element.getAttribute("aria-label") || element.getAttribute("title") || textOf(element));
}
