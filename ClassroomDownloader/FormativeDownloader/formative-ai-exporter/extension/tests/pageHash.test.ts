import { describe, expect, it } from "vitest";
import { createPageHash } from "../src/lib/capture/pageHash";

describe("pageHash", () => {
  it("changes when answer values change", () => {
    const base = {
      url: "https://app.formative.com/student/practice#slide-1",
      visibleText: "Question 1",
      answers: [
        {
          kind: "textarea",
          value: "first answer",
          label_guess: "Explain"
        }
      ]
    };

    const changed = {
      ...base,
      answers: [
        {
          kind: "textarea",
          value: "second answer",
          label_guess: "Explain"
        }
      ]
    };

    expect(createPageHash(base)).not.toEqual(createPageHash(changed));
  });

  it("ignores URL hash fragments for stable page identity", () => {
    const first = createPageHash({
      url: "https://app.formative.com/student/practice#one",
      visibleText: "Question 1",
      answers: []
    });
    const second = createPageHash({
      url: "https://app.formative.com/student/practice#two",
      visibleText: "Question 1",
      answers: []
    });

    expect(first).toEqual(second);
  });
});
