import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BundleStorage } from "../storage.js";

/**
 * AWS S3 storage implementation (production mode).
 * 
 * Requires environment variables:
 * - AWS_REGION
 * - AWS_ACCESS_KEY_ID (or use IAM role)
 * - AWS_SECRET_ACCESS_KEY (or use IAM role)
 * - STORAGE_BUCKET
 */
export class S3Storage implements BundleStorage {
  private s3Client: S3Client;
  private bucket: string;

  constructor(bucket?: string, region?: string) {
    this.bucket = bucket || process.env.STORAGE_BUCKET || "wire-bundles";
    const awsRegion = region || process.env.AWS_REGION || "us-east-1";

    this.s3Client = new S3Client({
      region: awsRegion,
      // Credentials will be picked up from env vars or IAM role automatically
    });
  }

  async store(bundleId: string, data: Buffer, metadata: Record<string, string>): Promise<string> {
    const key = `bundles/${bundleId}.zip`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: metadata["Content-Type"] || "application/zip",
      Metadata: Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [`x-${k.toLowerCase()}`, v])
      ),
      // Enable WORM (Write-Once-Read-Many) via object lock if configured
      // ObjectLockMode: "GOVERNANCE", // Requires bucket versioning + object lock
    });

    await this.s3Client.send(command);
    return `s3://${this.bucket}/${key}`;
  }

  async retrieve(bundleId: string): Promise<Buffer | null> {
    try {
      const key = `bundles/${bundleId}.zip`;
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      if (!response.Body) {
        return null;
      }

      // Convert stream to Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async delete(bundleId: string): Promise<void> {
    const key = `bundles/${bundleId}.zip`;
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
    } catch (error: any) {
      // Ignore if already deleted
      if (error.name !== "NoSuchKey") {
        throw error;
      }
    }
  }

  async getUrl(bundleId: string, expiresInSeconds: number = 3600): Promise<string> {
    const key = `bundles/${bundleId}.zip`;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }
}
