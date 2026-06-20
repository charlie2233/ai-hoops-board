import { describe, expect, it } from "vitest";
import { errorMessage, userFacingExtractionError } from "./errors";

describe("runtime error messages", () => {
  it("turns missing content-script errors into a usable reload instruction", () => {
    expect(
      userFacingExtractionError(new Error("Could not establish connection. Receiving end does not exist."))
    ).toContain("Reload the Classroom page");
  });

  it("preserves unrelated error messages", () => {
    expect(userFacingExtractionError(new Error("Open a Google Classroom page before exporting."))).toBe(
      "Open a Google Classroom page before exporting."
    );
  });

  it("formats unknown thrown values", () => {
    expect(errorMessage("native host request failed")).toBe("native host request failed");
  });
});
