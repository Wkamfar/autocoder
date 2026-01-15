import { BundleStorage } from "../storage.js";
import { LocalFileStorage } from "./localFileStorage.js";
import { S3Storage } from "./s3Storage.js";

/**
 * Get the appropriate storage implementation based on environment.
 */
export function getStorage(): BundleStorage {
  const storageType = process.env.STORAGE_TYPE || "local";

  switch (storageType) {
    case "s3":
      return new S3Storage();
    case "local":
    default:
      return new LocalFileStorage(process.env.STORAGE_PATH || "./storage/bundles");
  }
}
