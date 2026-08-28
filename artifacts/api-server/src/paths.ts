import path from "node:path";

export const apiArtifactRoot = path.resolve(import.meta.dirname, "..");
export const publicUploadsDir = path.join(apiArtifactRoot, "public", "uploads");