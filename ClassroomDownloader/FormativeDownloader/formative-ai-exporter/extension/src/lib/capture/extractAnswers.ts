import type { AnswerRecord } from "../archive/schema";
import { getBoundingBox, guessLabel, normalizeSpace, selectorHint, textOf } from "./domUtils";

const IGNORED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);

export function extractAnswers(root: ParentNode = document): AnswerRecord[] {
  const answers: AnswerRecord[] = [];
  const seen = new WeakSet<Element>();

  for (const input of Array.from(root.querySelectorAll("input"))) {
    const type = input.type || "input";

    if (IGNORED_INPUT_TYPES.has(type)) {
      continue;
    }

    seen.add(input);

    if (type === "radio" || type === "checkbox") {
      answers.push({
        kind: type,
        checked: input.checked,
        value: input.value,
        label_guess: guessLabel(input),
        selector_hint: selectorHint(input),
        bounding_box: getBoundingBox(input)
      });
      continue;
    }

    answers.push({
      kind: type,
      value: input.value,
      label_guess: guessLabel(input),
      selector_hint: selectorHint(input),
      bounding_box: getBoundingBox(input)
    });
  }

  for (const textarea of Array.from(root.querySelectorAll("textarea"))) {
    seen.add(textarea);
    answers.push({
      kind: "textarea",
      value: textarea.value,
      label_guess: guessLabel(textarea),
      selector_hint: selectorHint(textarea),
      bounding_box: getBoundingBox(textarea)
    });
  }

  for (const select of Array.from(root.querySelectorAll("select"))) {
    seen.add(select);
    answers.push({
      kind: "select",
      value: select.value,
      selected_text: normalizeSpace(select.selectedOptions?.[0]?.textContent),
      label_guess: guessLabel(select),
      selector_hint: selectorHint(select),
      bounding_box: getBoundingBox(select)
    });
  }

  for (const element of Array.from(root.querySelectorAll('[contenteditable="true"], [role="textbox"]'))) {
    if (seen.has(element)) {
      continue;
    }

    seen.add(element);
    answers.push({
      kind: "editable",
      value: textOf(element),
      label_guess: guessLabel(element),
      selector_hint: selectorHint(element),
      bounding_box: getBoundingBox(element)
    });
  }

  for (const element of Array.from(root.querySelectorAll('[aria-checked="true"], [aria-selected="true"]'))) {
    if (seen.has(element)) {
      continue;
    }

    answers.push({
      kind: "aria-selected",
      text: textOf(element),
      ariaLabel: element.getAttribute("aria-label") || "",
      label_guess: guessLabel(element),
      selector_hint: selectorHint(element),
      bounding_box: getBoundingBox(element)
    });
  }

  return answers;
}
