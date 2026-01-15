/**
 * Storage abstraction for audit bundles.
 * 
 * Supports multiple backends:
 * - LocalFileStorage: Development mode (filesystem)
 * - S3Storage: Production AWS S3
 * - GCSStorage: Production Google Cloud Storage (future)
 */

export interface BundleStorage {
  /**
   * Store a bundle archive.
   * @param bundleId - Unique bundle identifier
   * @param data - Bundle archive data (Buffer)
   * @param metadata - Additional metadata (Content-Type, etc.)
   * @returns Storage reference (path/URL)
   */
  store(bundleId: string, data: Buffer, metadata: Record<string, string>): Promise<string>;

  /**
   * Retrieve a bundle archive.
   * @param bundleId - Bundle identifier
   * @returns Bundle data or null if not found
   */
  retrieve(bundleId: string): Promise<Buffer | null>;

  /**
   * Delete a bundle archive.
   * @param bundleId - Bundle identifier
   */
  delete(bundleId: string): Promise<void>;

  /**
   * Get a presigned URL for downloading a bundle.
   * @param bundleId - Bundle identifier
   * @param expiresInSeconds - URL expiration time (default: 3600)
   * @returns Presigned URL
   */
  getUrl(bundleId: string, expiresInSeconds?: number): Promise<string>;
}
