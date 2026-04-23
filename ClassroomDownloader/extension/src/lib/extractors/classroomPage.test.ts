import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractPageSnapshot } from "./classroomPage";
import { inferExportItem } from "./assignmentPage";

describe("Classroom page extraction", () => {
  it("extracts a fixture assignment and classifies visible attachment links", () => {
    const html = readFileSync(
      resolve(__dirname, "../../../../tests/fixtures/classroom_assignment_page.html"),
      "utf-8"
    );
    document.documentElement.innerHTML = html;
    Object.defineProperty(document, "title", {
      configurable: true,
      value: "Derivative Practice - Google Classroom"
    });

    const location = new URL("https://classroom.google.com/c/abc/a/def/details") as unknown as Location;
    const snapshot = extractPageSnapshot(document, location);
    const item = inferExportItem(snapshot);

    expect(item.title).toBe("Derivative Practice");
    expect(item.course.name).toBe("AP Calculus");
    expect(item.points?.value).toBe(20);
    expect(item.attachments.map((attachment) => attachment.kind)).toEqual([
      "drive_file",
      "google_doc",
      "youtube"
    ]);
  });
});
