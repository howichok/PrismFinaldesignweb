/**
 * Image Upload Module (Vanilla JS)
 *
 * Handles: compression → upload to Supabase Storage → public URL
 *
 * Buckets:
 * - company-logos
 * - project-images
 * - post-images
 * - user-avatars
 *
 * Dependencies:
 * - browser-image-compression (CDN or npm)
 * - Supabase client (window.supabase or PrismSupabase)
 *
 * Usage:
 *   const url = await PrismImageUpload.upload(file, 'user-avatars', 'user123/avatar');
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    // Default compression settings
    compression: {
      maxSizeMB: 5,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.85,
    },

    // Bucket-specific settings
    buckets: {
      'company-logos': {
        maxSizeMB: 2,
        maxWidthOrHeight: 512,
      },
      'project-images': {
        maxSizeMB: 5,
        maxWidthOrHeight: 2000,
      },
      'post-images': {
        maxSizeMB: 5,
        maxWidthOrHeight: 2000,
      },
      'user-avatars': {
        maxSizeMB: 1,
        maxWidthOrHeight: 256,
      },
    },

    // Supported image types
    supportedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
    ],

    // Max input file size (before compression)
    maxInputSizeMB: 50,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPABASE CLIENT
  // ═══════════════════════════════════════════════════════════════════════════

  function getSupabase() {
    // Try different ways to get Supabase client
    if (window.PrismSupabase?.getClient) {
      return window.PrismSupabase.getClient();
    }
    if (window.supabase) {
      return window.supabase;
    }
    throw new Error('Supabase client not found. Ensure supabase.js is loaded.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate an image file
   * @param {File} file
   * @returns {{ valid: boolean, error?: string }}
   */
  function validateFile(file) {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'File must be an image' };
    }

    if (!CONFIG.supportedTypes.includes(file.type)) {
      return { valid: false, error: `Unsupported format: ${file.type}` };
    }

    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > CONFIG.maxInputSizeMB) {
      return {
        valid: false,
        error: `File too large: ${sizeMB.toFixed(1)}MB (max ${CONFIG.maxInputSizeMB}MB)`,
      };
    }

    return { valid: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPRESSION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compress an image file
   * @param {File} file - Image file to compress
   * @param {Object} options - Compression options
   * @returns {Promise<File>} Compressed file
   */
  async function compressImage(file, options = {}) {
    // Check if browser-image-compression is available
    if (typeof imageCompression === 'undefined') {
      console.warn('[ImageUpload] browser-image-compression not loaded, skipping compression');
      return file;
    }

    const settings = {
      ...CONFIG.compression,
      ...options,
    };

    try {
      const compressedBlob = await imageCompression(file, {
        maxSizeMB: settings.maxSizeMB,
        maxWidthOrHeight: settings.maxWidthOrHeight,
        useWebWorker: settings.useWebWorker,
        fileType: settings.fileType,
        initialQuality: settings.initialQuality,
      });

      // Convert Blob to File with .webp extension
      const originalName = file.name.replace(/\.[^/.]+$/, '');
      const compressedFile = new File([compressedBlob], `${originalName}.webp`, {
        type: 'image/webp',
      });

      const originalMB = (file.size / 1024 / 1024).toFixed(2);
      const compressedMB = (compressedFile.size / 1024 / 1024).toFixed(2);
      console.log(`[ImageUpload] Compressed: ${originalMB}MB → ${compressedMB}MB`);

      return compressedFile;
    } catch (error) {
      console.error('[ImageUpload] Compression failed:', error);
      throw new Error(`Compression failed: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Upload a file to Supabase Storage
   * @param {Blob|File} file - File to upload
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in bucket
   * @returns {Promise<string>} Public URL
   */
  async function uploadToStorage(file, bucket, path) {
    const supabase = getSupabase();

    // Ensure path has correct extension
    const filePath = path.endsWith('.webp') ? path : `${path}.webp`;

    try {
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/webp',
      });

      if (error) {
        console.error('[ImageUpload] Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      console.log(`[ImageUpload] Uploaded: ${bucket}/${filePath}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error('[ImageUpload] Upload failed:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Complete upload flow: validate → compress → upload → return URL
   * @param {File} file - Image file
   * @param {string} bucket - Bucket name
   * @param {string} path - File path (without extension)
   * @param {Object} options - Optional compression settings
   * @returns {Promise<{ url: string, path: string, bucket: string }>}
   */
  async function upload(file, bucket, path, options = {}) {
    // Validate
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Get bucket-specific settings
    const bucketSettings = CONFIG.buckets[bucket] || {};
    const compressionOptions = { ...bucketSettings, ...options };

    // Compress
    const compressedFile = await compressImage(file, compressionOptions);

    // Upload
    const url = await uploadToStorage(compressedFile, bucket, path);

    return {
      url,
      path: path.endsWith('.webp') ? path : `${path}.webp`,
      bucket,
    };
  }

  /**
   * Generate a unique file path
   * @param {string} prefix - Path prefix
   * @param {string} userId - Optional user ID
   * @returns {string}
   */
  function generatePath(prefix = 'img', userId = null) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const userPart = userId ? `${userId}/` : '';
    return `${userPart}${prefix}_${timestamp}_${random}`;
  }

  /**
   * Delete an image from storage
   * @param {string} bucket - Bucket name
   * @param {string} path - File path
   * @returns {Promise<void>}
   */
  async function deleteImage(bucket, path) {
    const supabase = getSupabase();

    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error('[ImageUpload] Delete failed:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }

    console.log(`[ImageUpload] Deleted: ${bucket}/${path}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a file input and handle upload
   * @param {Object} options
   * @param {string} options.bucket - Bucket name
   * @param {string} options.path - File path (or auto-generate)
   * @param {Function} options.onSuccess - Callback with URL
   * @param {Function} options.onError - Error callback
   * @param {Function} options.onProgress - Progress callback
   * @returns {HTMLInputElement}
   */
  function createUploader(options) {
    const {
      bucket,
      path,
      pathPrefix = 'img',
      userId,
      onSuccess,
      onError,
      onProgress,
    } = options;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        onProgress?.('Compressing...');

        const uploadPath = path || generatePath(pathPrefix, userId);

        onProgress?.('Uploading...');

        const result = await upload(file, bucket, uploadPath);

        onSuccess?.(result.url, result);
      } catch (error) {
        console.error('[ImageUpload] Error:', error);
        onError?.(error);
      }

      // Reset input
      input.value = '';
    });

    return input;
  }

  /**
   * Open file picker and upload
   * @param {string} bucket
   * @param {string} path
   * @returns {Promise<string>} Public URL
   */
  function pickAndUpload(bucket, path) {
    return new Promise((resolve, reject) => {
      const input = createUploader({
        bucket,
        path,
        onSuccess: resolve,
        onError: reject,
      });
      input.click();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  window.PrismImageUpload = {
    // Main API
    upload,
    compress: compressImage,
    uploadToStorage,
    deleteImage,

    // Utilities
    validate: validateFile,
    generatePath,

    // UI Helpers
    createUploader,
    pickAndUpload,

    // Config (read-only reference)
    CONFIG,
  };

  console.log('[PrismImageUpload] Module loaded');
})();
