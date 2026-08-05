import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { loadEnvironment } from '@pratto/config';
import type { StoredFile, StorageService, UploadInput } from '@pratto/contracts';

@Injectable()
export class MinioStorageService implements StorageService {
  private readonly environment = loadEnvironment();
  private readonly client = new S3Client({
    endpoint: this.environment.MINIO_ENDPOINT,
    region: this.environment.MINIO_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: this.environment.MINIO_ACCESS_KEY,
      secretAccessKey: this.environment.MINIO_SECRET_KEY,
    },
  });

  async upload(input: UploadInput): Promise<StoredFile> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.environment.MINIO_BUCKET,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
    );

    return {
      key: input.key,
      contentType: input.contentType,
      contentLength: input.contentLength,
      publicUrl: this.getPublicUrl(input.key),
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.environment.MINIO_BUCKET, Key: key }),
    );
  }

  getPublicUrl(key: string): string {
    return `${this.environment.MINIO_PUBLIC_URL}/${encodeURIComponent(key)}`;
  }

  async health(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.environment.MINIO_BUCKET }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.environment.MINIO_BUCKET }));
    }
  }
}
