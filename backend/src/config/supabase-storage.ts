import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'celestix-files';

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

/**
 * Returns true when Supabase storage env vars are present and usable.
 * Routes can fall back to local disk when this returns false.
 */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Create the storage bucket if it does not already exist.
 */
export async function initStorage(): Promise<void> {
  if (!isSupabaseConfigured()) {
    logger.warn('Supabase storage not configured — skipping bucket init (local disk mode)');
    return;
  }

  const client = getClient();
  const { data: buckets, error: listErr } = await client.storage.listBuckets();

  if (listErr) {
    logger.error({ err: listErr }, 'Failed to list Supabase buckets');
    return;
  }

  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error: createErr } = await client.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 524_288_000, // 500 MB
    });
    if (createErr) {
      logger.error({ err: createErr }, `Failed to create bucket "${BUCKET}"`);
    } else {
      logger.info(`Supabase bucket "${BUCKET}" created`);
    }
  } else {
    logger.info(`Supabase bucket "${BUCKET}" already exists`);
  }
}

/**
 * Upload a file buffer to Supabase Storage.
 * @returns { url, path } where url is the public URL and path is the storage key.
 */
export async function uploadFile(
  filePath: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<{ url: string; path: string }> {
  const client = getClient();

  const { error } = await client.storage
    .from(BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(filePath);

  return { url: urlData.publicUrl, path: filePath };
}

/**
 * Download a file from Supabase Storage and return its contents as a Buffer.
 */
export async function downloadFile(filePath: string): Promise<Buffer> {
  const client = getClient();

  const { data, error } = await client.storage.from(BUCKET).download(filePath);

  if (error || !data) {
    throw new Error(`Supabase download failed: ${error?.message ?? 'no data'}`);
  }

  // data is a Blob — convert to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate a time-limited signed URL for private file access.
 * @param expiresIn seconds until the URL expires (default 3600 = 1 hour)
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getClient();

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Supabase signed URL failed: ${error?.message ?? 'no url'}`);
  }

  return data.signedUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  const client = getClient();

  const { error } = await client.storage.from(BUCKET).remove([filePath]);

  if (error) {
    logger.error({ err: error }, `Supabase delete failed for ${filePath}`);
    return false;
  }

  return true;
}

/**
 * List files under a given prefix (folder path) in the bucket.
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const client = getClient();

  const { data, error } = await client.storage.from(BUCKET).list(prefix);

  if (error) {
    throw new Error(`Supabase list failed: ${error.message}`);
  }

  return (data ?? []).map((f) => `${prefix}/${f.name}`);
}
