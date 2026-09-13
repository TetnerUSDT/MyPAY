import path from "node:path";

export const apiArtifactRoot = path.resolve(import.meta.dirname, "..");

const legacyUploadsDir = path.join(apiArtifactRoot, "public", "uploads");
const defaultProductionUploadsDir = "/var/lib/swiftx/uploads";
const configuredUploadsDir = process.env.SWIFTX_UPLOADS_DIR?.trim();

if (configuredUploadsDir && !path.isAbsolute(configuredUploadsDir)) {
  throw new Error(
    "SWIFTX_UPLOADS_DIR must be an absolute path so uploads are not tied to the release checkout.",
  );
}

export const publicUploadsDir = path.resolve(
  configuredUploadsDir ||
    (process.env.NODE_ENV === "production"
      ? defaultProductionUploadsDir
      : legacyUploadsDir),
);

if (process.env.NODE_ENV === "production") {
  const relativeToArtifact = path.relative(apiArtifactRoot, publicUploadsDir);
  const isInsideArtifact =
    relativeToArtifact === "" ||
    (!relativeToArtifact.startsWith(`..${path.sep}`) &&
      relativeToArtifact !== ".." &&
      !path.isAbsolute(relativeToArtifact));

  if (isInsideArtifact) {
    throw new Error(
      `SWIFTX_UPLOADS_DIR must be outside the disposable API checkout: ${publicUploadsDir}`,
    );
  }
}