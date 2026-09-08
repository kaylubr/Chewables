/**
 * S3-compatible object-storage adapter for saved photobooth images.
 *
 * Local dev uses MinIO (see compose.yml); any S3-compatible endpoint works.
 * The backend always generates storage keys — clients never choose paths.
 */
import {
	S3Client,
	CreateBucketCommand,
	DeleteObjectCommand,
	HeadBucketCommand,
	PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../config.js';

export class StorageError extends Error {
	override name = 'StorageError';
}

export interface Storage {
	ensureBucket(): Promise<void>;
	put(key: string, body: Uint8Array, contentType: string): Promise<void>;
	delete(key: string): Promise<void>;
	url(key: string): Promise<string>;
}

class S3Storage implements Storage {
	private readonly client: S3Client;
	private readonly bucket: string;

	constructor() {
		this.bucket = config.s3.bucket;
		this.client = new S3Client({
			endpoint: config.s3.endpointUrl,
			region: config.s3.region,
			credentials: {
				accessKeyId: config.s3.accessKey,
				secretAccessKey: config.s3.secretKey,
			},
			forcePathStyle: true, // required for MinIO
		});
	}

	async ensureBucket(): Promise<void> {
		try {
			await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
		} catch {
			await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
		}
	}

	async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
		try {
			await this.client.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: key,
					Body: body,
					ContentType: contentType,
				}),
			);
		} catch (error) {
			throw new StorageError(`object storage put failed for ${key}`, { cause: error });
		}
	}

	async delete(key: string): Promise<void> {
		try {
			await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
		} catch (error) {
			throw new StorageError(`object storage delete failed for ${key}`, { cause: error });
		}
	}

	async url(key: string): Promise<string> {
		try {
			return await getSignedUrl(
				this.client,
				new GetObjectCommand({ Bucket: this.bucket, Key: key }),
				{ expiresIn: 3600 },
			);
		} catch (error) {
			throw new StorageError(`object storage url generation failed for ${key}`, { cause: error });
		}
	}
}

/** Singleton storage service. Tests may swap this for a fake. */
export const storage: Storage = new S3Storage();