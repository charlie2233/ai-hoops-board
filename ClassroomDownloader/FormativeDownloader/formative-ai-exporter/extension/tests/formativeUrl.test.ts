import { describe, expect, it } from "vitest";
import { ALLOWED_FORMATIVE_HOST_PERMISSIONS, isAllowedFormativeUrl } from "../src/lib/browser/formativeUrl";

describe("formativeUrl", () => {
  it("allows Formative app and root entry domains", () => {
    expect(isAllowedFormativeUrl("https://app.formative.com/student/practice/abc")).toBe(true);
    expect(isAllowedFormativeUrl("https://goformative.com/student/practice/abc")).toBe(true);
    expect(isAllowedFormativeUrl("https://formative.com/join")).toBe(true);
    expect(isAllowedFormativeUrl("https://accounts.goformative.com/login")).toBe(true);
  });

  it("rejects non-HTTPS and lookalike domains", () => {
    expect(isAllowedFormativeUrl("http://app.formative.com/student/practice/abc")).toBe(false);
    expect(isAllowedFormativeUrl("https://formative.com.evil.example/student/practice/abc")).toBe(false);
    expect(isAllowedFormativeUrl("https://example.com")).toBe(false);
    expect(isAllowedFormativeUrl("not a url")).toBe(false);
  });

  it("declares Chrome host permissions for bare domains and subdomains", () => {
    expect(ALLOWED_FORMATIVE_HOST_PERMISSIONS).toContain("https://formative.com/*");
    expect(ALLOWED_FORMATIVE_HOST_PERMISSIONS).toContain("https://*.formative.com/*");
    expect(ALLOWED_FORMATIVE_HOST_PERMISSIONS).toContain("https://goformative.com/*");
    expect(ALLOWED_FORMATIVE_HOST_PERMISSIONS).toContain("https://*.goformative.com/*");
  });
});
