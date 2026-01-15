import { promises as fs } from "fs";
import { join } from "path";
import { BundleStorage } from "../storage.js";

/**
 * Local filesystem storage implementation (development mode).
 */
export class LocalFileStorage implements BundleStorage {
  private basePath: string;

  constructor(basePath: string = "./storage/bundles") {
    this.basePath = basePath;
  }

  async store(bundleId: string, data: Buffer, metadata: Record<string, string>): Promise<string> {
    // Ensure directory exists
    await fs.mkdir(this.basePath, { recursive: true });

    // Store file
    const filePath = join(this.basePath, `${bundleId}.zip`);
    await fs.writeFile(filePath, data);

    // Store metadata as JSON file (optional)
    if (Object.keys(metadata).length > 0) {
      const metadataPath = join(this.basePath, `${bundleId}.meta.json`);
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }

    return filePath;
  }

  async retrieve(bundleId: string): Promise<Buffer | null> {
    try {
      const filePath = join(this.basePath, `${bundleId}.zip`);
      return await fs.readFile(filePath);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async delete(bundleId: string): Promise<void> {
    try {
      const filePath = join(this.basePath, `${bundleId}.zip`);
      await fs.unlink(filePath);

      // Delete metadata if it exists
      const metadataPath = join(this.basePath, `${bundleId}.meta.json`);
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Ignore if metadata doesn't exist
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  async getUrl(bundleId: string, expiresInSeconds: number = 3600): Promise<string> {
    // For local storage, return file:// URL (not presigned, but functional for dev)
    const filePath = join(this.basePath, `${bundleId}.zip`);
    return `file://${filePath}`;
  }
}
