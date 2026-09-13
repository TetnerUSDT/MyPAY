const DEFAULT_ADMIN_PATH = "admin";

export function normalizeAdminPath(rawPath: string | undefined): string {
  const trimmedPath = rawPath?.trim() ?? "";
  const normalizedPath = trimmedPath.replace(/^\/+|\/+$/g, "");

  if (!normalizedPath) {
    return DEFAULT_ADMIN_PATH;
  }

  if (
    normalizedPath.includes("?") ||
    normalizedPath.includes("#") ||
    /[\u0000-\u001f\u007f\s]/.test(normalizedPath)
  ) {
    throw new Error(
      "ADMIN_URL must be a URL path without query strings, fragments, or whitespace",
    );
  }

  return normalizedPath;
}