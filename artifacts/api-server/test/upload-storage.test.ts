import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import {
  apiArtifactRoot,
  publicUploadsDir,
  resolvePublicUploadsDir,
  toPublicUploadPath,
} from "../src/paths";

test("uses the persistent production uploads default", () => {
  assert.equal(
    resolvePublicUploadsDir("production", undefined),
    "/var/lib/swiftx/uploads",
  );
});

test("uses an explicit persistent uploads directory override", () => {
  assert.equal(
    resolvePublicUploadsDir("production", "/mnt/swiftx/uploads"),
    "/mnt/swiftx/uploads",
  );
});

test("uses the checkout-local uploads directory outside production", () => {
  assert.equal(
    resolvePublicUploadsDir("development", undefined),
    path.join(apiArtifactRoot, "public", "uploads"),
  );
});

test("rejects checkout-local uploads directories in production", () => {
  const checkoutLocalUploadsDir = path.join(
    apiArtifactRoot,
    "runtime",
    "uploads",
  );

  assert.throws(
    () => resolvePublicUploadsDir("production", checkoutLocalUploadsDir),
    /outside the disposable API checkout/,
  );
});

test("converts uploaded file paths to public uploads URLs", () => {
  const uploadedFilePath = path.join(
    publicUploadsDir,
    "system",
    "reaction-image.png",
  );

  const publicPath = toPublicUploadPath(uploadedFilePath);

  assert.equal(publicPath, "/uploads/system/reaction-image.png");
  assert.equal(publicPath.includes(publicUploadsDir), false);
});