import { normalizeSpace, textOf } from "./domUtils";

export const NEXT_PATTERNS = [/^next$/i, /continue/i, /next question/i, /next page/i, /forward/i];
export const STOP_PATTERNS = [/submit/i, /turn in/i, /finish/i, /^done$/i, /complete/i];

export type NextButtonResult =
  | {
      kind: "next";
      element: HTMLElement;
      label: string;
    }
  | {
      kind: "stop";
      label: string;
      reason: string;
    }
  | {
      kind: "none";
      reason: string;
    };

export function findNextButton(root: ParentNode = document): NextButtonResult {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>('button, [role="button"], a[href], input[type="button"], input[type="submit"]')
  ).filter(isActionable);

  for (const candidate of candidates) {
    const label = getActionLabel(candidate);
    if (looksLikeStop(label)) {
      return {
        kind: "stop",
        label,
        reason: "stop_button"
      };
    }
  }

  const next = candidates.find((candidate) => looksLikeNext(getActionLabel(candidate)));
  if (!next) {
    return {
      kind: "none",
      reason: "no_next_button"
    };
  }

  return {
    kind: "next",
    element: next,
    label: getActionLabel(next)
  };
}

export function getActionLabel(element: HTMLElement): string {
  if (element instanceof HTMLInputElement) {
    return normalizeSpace(element.value || element.getAttribute("aria-label") || element.title);
  }

  return normalizeSpace(
    element.getAttribute("aria-label") || element.getAttribute("title") || textOf(element)
  );
}

export function looksLikeNext(label: string): boolean {
  return NEXT_PATTERNS.some((pattern) => pattern.test(label));
}

export function looksLikeStop(label: string): boolean {
  return STOP_PATTERNS.some((pattern) => pattern.test(label));
}

function isActionable(element: HTMLElement): boolean {
  const disabled =
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    (element instanceof HTMLButtonElement && element.disabled) ||
    (element instanceof HTMLInputElement && element.disabled);

  return !disabled && Boolean(getActionLabel(element));
}
