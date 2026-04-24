import type { AnswerRecord } from "../archive/schema";

export type PageHashInput = {
  url: string;
  visibleText: string;
  answers: AnswerRecord[];
};

export function createPageHash(input: PageHashInput): string {
  const hashInput = stableStringify({
    url: normalizeUrl(input.url),
    visibleText: input.visibleText,
    answers: input.answers.map((answer) => ({
      kind: answer.kind,
      label_guess: answer.label_guess ?? "",
      value: answer.value ?? "",
      selected_text: answer.selected_text ?? "",
      text: answer.text ?? "",
      checked: answer.checked ?? null,
      ariaLabel: answer.ariaLabel ?? ""
    }))
  });

  return `fnv1a:${fnv1a(hashInput)}`;
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
