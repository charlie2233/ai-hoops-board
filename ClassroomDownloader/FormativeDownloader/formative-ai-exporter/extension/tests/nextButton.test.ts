import { beforeEach, describe, expect, it } from "vitest";
import { findNextButton, looksLikeNext, looksLikeStop } from "../src/lib/capture/nextButton";

describe("nextButton", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detects Next and Continue actions", () => {
    document.body.innerHTML = `<button>Next</button>`;

    expect(findNextButton(document)).toEqual(
      expect.objectContaining({
        kind: "next",
        label: "Next"
      })
    );
    expect(looksLikeNext("Continue")).toBe(true);
    expect(looksLikeNext("Next question")).toBe(true);
  });

  it("rejects Submit, Finish, and Turn In actions", () => {
    for (const label of ["Submit", "Finish", "Turn In", "Done", "Complete"]) {
      document.body.innerHTML = `<button>${label}</button>`;
      expect(findNextButton(document)).toEqual(
        expect.objectContaining({
          kind: "stop",
          label
        })
      );
      expect(looksLikeStop(label)).toBe(true);
    }
  });

  it("uses accessible labels and skips disabled buttons", () => {
    document.body.innerHTML = `
      <button disabled>Next</button>
      <div role="button" aria-label="Continue"></div>
    `;

    expect(findNextButton(document)).toEqual(
      expect.objectContaining({
        kind: "next",
        label: "Continue"
      })
    );
  });
});
