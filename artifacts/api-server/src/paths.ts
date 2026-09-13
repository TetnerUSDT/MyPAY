import path from "node:path";

export const apiArtifactRoot = path.resolve(import.meta.dirname, "..");

const legacyUploadsDir = path.join(apiArtifactRoot, "public", "uploads");
const defaultProductionUploadsDir = "/var/lib/swiftx/uploads";

export function resolvePublicUploadsDir(
  nodeEnv = process.env.NODE_ENV,
  configuredUploadsDir = process.env.SWIFTX_UPLOADS_DIR?.trim(),
): string {
  if (configuredUploadsDir && !path.isAbsolute(configuredUploadsDir)) {
    throw new Error(
      "SWIFTX_UPLOADS_DIR must be an absolute path so uploads are not tied to the release checkout.",
    );
  }

  const publicUploadsDir = path.resolve(
    configuredUploadsDir ||
      (nodeEnv === "production"
        ? defaultProductionUploadsDir
        : legacyUploadsDir),
  );

  if (nodeEnv === "production") {
    assertProductionUploadsDirIsPersistent(publicUploadsDir);
  }

  return publicUploadsDir;
}

function assertProductionUploadsDirIsPersistent(publicUploadsDir: string): void {
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

export const publicUploadsDir = resolvePublicUploadsDir();

export function toPublicUploadPath(uploadedFilePath: string): string {
  const relativeUploadPath = path.relative(publicUploadsDir, uploadedFilePath);
  return `/uploads/${relativeUploadPath.split(path.sep).join("/")}`;
}