import type { BoundingBox } from "../archive/schema";

const MAX_LABEL_LENGTH = 220;

export function normalizeSpace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function textOf(element: Element | null | undefined): string {
  if (!element) {
    return "";
  }

  const htmlElement = element as HTMLElement;
  return normalizeSpace(htmlElement.innerText || element.textContent || "");
}

export function visibleTextFromBody(doc: Document = document): string {
  const bodyText = doc.body?.innerText || doc.body?.textContent || "";

  return bodyText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function getBoundingBox(element: Element): BoundingBox {
  const rect = element.getBoundingClientRect();

  return {
    x: roundNumber(rect.x),
    y: roundNumber(rect.y),
    width: roundNumber(rect.width),
    height: roundNumber(rect.height)
  };
}

export function selectorHint(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${cssEscape(element.id)}` : "";
  const classes = Array.from(element.classList)
    .slice(0, 3)
    .map((className) => `.${cssEscape(className)}`)
    .join("");

  return `${tagName}${id}${classes}`;
}

export function guessLabel(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return trimLabel(ariaLabel);
  }

  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  if (ariaLabelledBy) {
    const labelledText = ariaLabelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id))
      .map(textOf)
      .filter(Boolean)
      .join(" ");

    if (labelledText) {
      return trimLabel(labelledText);
    }
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    if (element.labels?.length) {
      return trimLabel(Array.from(element.labels).map(textOf).filter(Boolean).join(" "));
    }

    if (element.id) {
      const label = element.ownerDocument.querySelector(`label[for="${cssString(element.id)}"]`);
      const labelText = textOf(label);
      if (labelText) {
        return trimLabel(labelText);
      }
    }
  }

  const closestLabel = element.closest("label");
  const closestLabelText = textOf(closestLabel);
  if (closestLabelText) {
    return trimLabel(closestLabelText);
  }

  const previousText = textOf(previousElementSibling(element));
  if (previousText) {
    return trimLabel(previousText);
  }

  const parentText = textOf(element.parentElement);
  return trimLabel(parentText);
}

function previousElementSibling(element: Element): Element | null {
  let current = element.previousElementSibling;

  while (current) {
    const text = textOf(current);
    if (text) {
      return current;
    }
    current = current.previousElementSibling;
  }

  return null;
}

function trimLabel(value: string): string {
  const normalized = normalizeSpace(value);
  return normalized.length > MAX_LABEL_LENGTH ? `${normalized.slice(0, MAX_LABEL_LENGTH)}...` : normalized;
}

function roundNumber(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function cssEscape(value: string): string {
  if (globalThis.CSS?.escape) {
    return globalThis.CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function cssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
