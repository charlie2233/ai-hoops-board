import { describe, expect, it, beforeEach } from "vitest";
import { extractAnswers } from "../src/lib/capture/extractAnswers";

describe("extractAnswers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("handles input, textarea, checkbox, radio, select, contenteditable, and aria-selected state", () => {
    document.body.innerHTML = `
      <label for="name">Student name</label>
      <input id="name" type="text" />

      <label for="explain">Explain</label>
      <textarea id="explain"></textarea>

      <label><input id="choice-a" type="checkbox" value="A" checked /> Choice A</label>
      <label><input id="choice-b" type="radio" name="choice" value="B" checked /> Choice B</label>

      <label for="select-answer">Select answer</label>
      <select id="select-answer">
        <option value="one">One</option>
        <option value="two" selected>Two</option>
      </select>

      <div contenteditable="true" aria-label="Scratch work">x = 4</div>
      <div role="textbox" aria-label="Rich response">Typed in rich box</div>
      <div role="option" aria-selected="true" aria-label="Hot text selection">Selected hot text</div>
    `;

    (document.querySelector("#name") as HTMLInputElement).value = "Ada";
    (document.querySelector("#explain") as HTMLTextAreaElement).value = "Because it balances.";

    const answers = extractAnswers(document);

    expect(answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "text", value: "Ada", label_guess: "Student name" }),
        expect.objectContaining({ kind: "textarea", value: "Because it balances.", label_guess: "Explain" }),
        expect.objectContaining({ kind: "checkbox", checked: true, value: "A" }),
        expect.objectContaining({ kind: "radio", checked: true, value: "B" }),
        expect.objectContaining({ kind: "select", value: "two", selected_text: "Two" }),
        expect.objectContaining({ kind: "editable", value: "x = 4", label_guess: "Scratch work" }),
        expect.objectContaining({ kind: "editable", value: "Typed in rich box", label_guess: "Rich response" }),
        expect.objectContaining({
          kind: "aria-selected",
          text: "Selected hot text",
          ariaLabel: "Hot text selection"
        })
      ])
    );
  });
});
