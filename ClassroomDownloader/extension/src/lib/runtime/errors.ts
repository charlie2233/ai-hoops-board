const MISSING_CONTENT_SCRIPT_PATTERNS = [
  /receiving end does not exist/i,
  /could not establish connection/i,
  /no tab with id/i,
];

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

export function userFacingExtractionError(error: unknown): string {
  const message = errorMessage(error);
  if (MISSING_CONTENT_SCRIPT_PATTERNS.some((pattern) => pattern.test(message))) {
    return "CourseBinder could not reach this Classroom tab yet. Reload the Classroom page after installing or updating the extension, then try Export page again.";
  }
  return message;
}
