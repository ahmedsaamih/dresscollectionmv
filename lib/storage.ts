import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { put as blobPut } from '@vercel/blob';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Storage abstraction with pluggable drivers, selected per bucket.
 *
 * In production every bucket defaults to Vercel Blob (`STORAGE_DRIVER=blob`).
 * Any bucket can be overridden independently via `STORAGE_DRIVER_<BUCKET>`
 * (e.g. `STORAGE_DRIVER_PRODUCT=r2`) — this is how `product` moves to
 * Cloudflare R2 later purely by env var + redeploy, no code change. In local
 * dev every bucket maps to the LocalDriver, which writes under
 * LOCAL_STORAGE_DIR and serves files via /api/files/<bucket>/<name>.
 */
export type Bucket = 'site' | 'product' | 'receipt' | 'pdf';
type DriverKind = 'local' | 'blob' | 'r2';

export interface PutOptions {
  bucket: Bucket;
  filename: string;
  data: Buffer;
  contentType: string;
}

export interface StorageDriver {
  put(opts: PutOptions): Promise<{ url: string }>;
}

const ROOT = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || './storage');

function safeName(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const stem = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'file';
  const rand = crypto.randomBytes(4).toString('hex');
  return `${stem}-${rand}${ext}`;
}

class LocalDriver implements StorageDriver {
  async put({ bucket, filename, data }: PutOptions): Promise<{ url: string }> {
    const name = safeName(filename);
    const dir = path.join(ROOT, bucket);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), data);
    return { url: `/api/files/${bucket}/${name}` };
  }
}

class BlobDriver implements StorageDriver {
  async put({ bucket, filename, data, contentType }: PutOptions): Promise<{ url: string }> {
    const name = `${bucket}/${safeName(filename)}`;
    const blob = await blobPut(name, data, { access: 'public', contentType });
    return { url: blob.url };
  }
}

/** Cloudflare R2 via its S3-compatible API. Dormant until a bucket's driver is set to 'r2'. */
class R2Driver implements StorageDriver {
  private client: S3Client;
  private bucketName: string;
  private publicBaseUrl: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    this.bucketName = process.env.R2_BUCKET || '';
    this.publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucketName || !this.publicBaseUrl) {
      throw new Error('R2 storage driver selected but R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_PUBLIC_BASE_URL are not fully configured.');
    }
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put({ bucket, filename, data, contentType }: PutOptions): Promise<{ url: string }> {
    const key = `${bucket}/${safeName(filename)}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: data,
      ContentType: contentType,
    }));
    return { url: `${this.publicBaseUrl}/${key}` };
  }
}

const driverInstances = new Map<DriverKind, StorageDriver>();

function driverInstance(kind: DriverKind): StorageDriver {
  let instance = driverInstances.get(kind);
  if (!instance) {
    instance = kind === 'blob' ? new BlobDriver() : kind === 'r2' ? new R2Driver() : new LocalDriver();
    driverInstances.set(kind, instance);
  }
  return instance;
}

function driverKindFor(bucket: Bucket): DriverKind {
  const override = process.env[`STORAGE_DRIVER_${bucket.toUpperCase()}`];
  const kind = (override || process.env.STORAGE_DRIVER || 'local').toLowerCase();
  return kind === 'blob' || kind === 'r2' ? kind : 'local';
}

export const storage: StorageDriver = {
  put(opts: PutOptions) {
    return driverInstance(driverKindFor(opts.bucket)).put(opts);
  },
};
export const STORAGE_ROOT = ROOT;

/** Read a stored file for the dev file-server. Guards against path traversal. */
export async function readStored(bucket: string, name: string): Promise<Buffer | null> {
  const buckets: Bucket[] = ['site', 'product', 'receipt', 'pdf'];
  if (!buckets.includes(bucket as Bucket)) return null;
  const target = path.join(ROOT, bucket, path.basename(name));
  if (!target.startsWith(path.join(ROOT, bucket) + path.sep)) return null;
  try {
    return await fs.readFile(target);
  } catch {
    return null;
  }
}
