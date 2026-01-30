/**
 * Image Upload Module for Supabase Storage
 *
 * Handles: compression → upload → public URL
 *
 * Buckets:
 * - company-logos
 * - project-images
 * - post-images
 * - user-avatars
 */

import imageCompression from 'browser-image-compression';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ImageBucket =
  | 'company-logos'
  | 'project-images'
  | 'post-images'
  | 'user-avatars';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
}

export interface UploadResult {
  url: string;
  path: string;
  bucket: ImageBucket;
}

export interface UploadError {
  message: string;
  code?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE COMPRESSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compress an image file
 * - Max size: 5 MB
 * - Max resolution: 2000px
 * - Output format: WebP
 */
export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  const defaultOptions: CompressionOptions = {
    maxSizeMB: 5,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
    fileType: 'image/webp',
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Validate input
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Invalid file: must be an image');
  }

  try {
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: mergedOptions.maxSizeMB!,
      maxWidthOrHeight: mergedOptions.maxWidthOrHeight!,
      useWebWorker: mergedOptions.useWebWorker!,
      fileType: mergedOptions.fileType,
      initialQuality: 0.85,
    });

    // Convert Blob to File with .webp extension
    const originalName = file.name.replace(/\.[^/.]+$/, '');
    const compressedFile = new File(
      [compressedBlob],
      `${originalName}.webp`,
      { type: 'image/webp' }
    );

    console.log(`[ImageUpload] Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

    return compressedFile;
  } catch (error) {
    console.error('[ImageUpload] Compression failed:', error);
    throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UPLOAD TO SUPABASE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upload a file to Supabase Storage
 * Returns the public URL
 */
export async function uploadImage(
  bucket: ImageBucket,
  path: string,
  file: Blob | File
): Promise<string> {
  const supabase = getSupabase();

  // Ensure path has correct extension
  const filePath = path.endsWith('.webp') ? path : `${path}.webp`;

  try {
    // Upload with upsert to replace existing files
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/webp',
      });

    if (error) {
      console.error('[ImageUpload] Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log(`[ImageUpload] Uploaded to ${bucket}/${filePath}`);
    return urlData.publicUrl;

  } catch (error) {
    console.error('[ImageUpload] Upload failed:', error);
    throw error instanceof Error ? error : new Error('Upload failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED HANDLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete image upload flow:
 * compress → upload → return public URL
 */
export async function handleImageUpload(
  file: File,
  bucket: ImageBucket,
  path: string,
  compressionOptions?: CompressionOptions
): Promise<UploadResult> {
  // Step 1: Compress
  const compressedFile = await compressImage(file, compressionOptions);

  // Step 2: Upload
  const url = await uploadImage(bucket, path, compressedFile);

  // Step 3: Return result
  return {
    url,
    path: path.endsWith('.webp') ? path : `${path}.webp`,
    bucket,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique file path
 */
export function generateImagePath(
  prefix: string,
  userId?: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const userPart = userId ? `${userId}/` : '';
  return `${userPart}${prefix}_${timestamp}_${random}`;
}

/**
 * Delete an image from storage
 */
export async function deleteImage(
  bucket: ImageBucket,
  path: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('[ImageUpload] Delete failed:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }

  console.log(`[ImageUpload] Deleted ${bucket}/${path}`);
}

/**
 * Validate file before upload
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number = 50
): { valid: boolean; error?: string } {
  // Check if it's an image
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check file size (before compression)
  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > maxSizeMB) {
    return { valid: false, error: `File too large: ${sizeMB.toFixed(1)}MB (max ${maxSizeMB}MB)` };
  }

  // Check supported formats
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
  if (!supportedTypes.includes(file.type)) {
    return { valid: false, error: `Unsupported format: ${file.type}` };
  }

  return { valid: true };
}
