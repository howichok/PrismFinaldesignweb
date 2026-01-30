'use client';

/**
 * ImageUploader Component
 *
 * React/Next.js component for uploading images to Supabase Storage
 * with automatic compression and WebP conversion.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  handleImageUpload,
  validateImageFile,
  generateImagePath,
  ImageBucket,
  CompressionOptions,
} from '@/lib/image-upload';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ImageUploaderProps {
  /** Supabase Storage bucket name */
  bucket: ImageBucket;
  /** Path/filename in the bucket (without extension) */
  path?: string;
  /** Callback when upload completes successfully */
  onUploaded: (url: string) => void;
  /** Callback when upload fails */
  onError?: (error: Error) => void;
  /** Callback when upload starts */
  onUploadStart?: () => void;
  /** Custom compression options */
  compressionOptions?: CompressionOptions;
  /** Accepted file types */
  accept?: string;
  /** Maximum file size in MB before compression */
  maxSizeMB?: number;
  /** Custom className for the container */
  className?: string;
  /** Custom className for the input */
  inputClassName?: string;
  /** Disable the uploader */
  disabled?: boolean;
  /** Show preview of selected image */
  showPreview?: boolean;
  /** Current image URL (for edit mode) */
  currentImageUrl?: string;
  /** Button/label text */
  label?: string;
  /** User ID for path generation */
  userId?: string;
  /** Path prefix for auto-generated paths */
  pathPrefix?: string;
}

type UploadState = 'idle' | 'compressing' | 'uploading' | 'success' | 'error';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ImageUploader({
  bucket,
  path,
  onUploaded,
  onError,
  onUploadStart,
  compressionOptions,
  accept = 'image/*',
  maxSizeMB = 50,
  className = '',
  inputClassName = '',
  disabled = false,
  showPreview = true,
  currentImageUrl,
  label = 'Upload Image',
  userId,
  pathPrefix = 'img',
}: ImageUploaderProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset state
      setErrorMessage(null);

      // Validate file
      const validation = validateImageFile(file, maxSizeMB);
      if (!validation.valid) {
        setErrorMessage(validation.error || 'Invalid file');
        setState('error');
        onError?.(new Error(validation.error));
        return;
      }

      // Show preview
      if (showPreview) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target?.result as string);
        reader.readAsDataURL(file);
      }

      try {
        // Start upload
        onUploadStart?.();
        setState('compressing');
        setProgress('Compressing image...');

        // Generate path if not provided
        const uploadPath = path || generateImagePath(pathPrefix, userId);

        setState('uploading');
        setProgress('Uploading...');

        // Upload with compression
        const result = await handleImageUpload(
          file,
          bucket,
          uploadPath,
          compressionOptions
        );

        // Success
        setState('success');
        setProgress('');
        setPreviewUrl(result.url);
        onUploaded(result.url);

        // Reset to idle after delay
        setTimeout(() => setState('idle'), 2000);

      } catch (error) {
        console.error('[ImageUploader] Error:', error);
        setState('error');
        const errorMsg = error instanceof Error ? error.message : 'Upload failed';
        setErrorMessage(errorMsg);
        setProgress('');
        onError?.(error instanceof Error ? error : new Error(errorMsg));
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [bucket, path, pathPrefix, userId, maxSizeMB, showPreview, compressionOptions, onUploaded, onError, onUploadStart]
  );

  // Trigger file input click
  const handleClick = () => {
    if (!disabled && state !== 'compressing' && state !== 'uploading') {
      inputRef.current?.click();
    }
  };

  // Handle drag and drop
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (disabled || state === 'compressing' || state === 'uploading') return;

      const file = event.dataTransfer.files?.[0];
      if (file && inputRef.current) {
        // Create a synthetic event
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputRef.current.files = dataTransfer.files;
        inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    [disabled, state]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const isProcessing = state === 'compressing' || state === 'uploading';

  return (
    <div
      className={`image-uploader ${className} ${isProcessing ? 'image-uploader--processing' : ''} ${disabled ? 'image-uploader--disabled' : ''}`}
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
        className={`image-uploader__input ${inputClassName}`}
        aria-label={label}
      />

      {/* Preview */}
      {showPreview && previewUrl && (
        <div className="image-uploader__preview">
          <img
            src={previewUrl}
            alt="Preview"
            className="image-uploader__preview-image"
          />
        </div>
      )}

      {/* Content */}
      <div className="image-uploader__content">
        {isProcessing ? (
          <>
            <div className="image-uploader__spinner" />
            <span className="image-uploader__progress">{progress}</span>
          </>
        ) : state === 'success' ? (
          <>
            <svg className="image-uploader__icon image-uploader__icon--success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="image-uploader__label">Uploaded!</span>
          </>
        ) : state === 'error' ? (
          <>
            <svg className="image-uploader__icon image-uploader__icon--error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="image-uploader__error">{errorMessage}</span>
          </>
        ) : (
          <>
            <svg className="image-uploader__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="image-uploader__label">{label}</span>
            <span className="image-uploader__hint">Click or drag image here</span>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECIALIZED UPLOADERS
// ═══════════════════════════════════════════════════════════════════════════

/** Uploader for company logos */
export function CompanyLogoUploader(props: Omit<ImageUploaderProps, 'bucket' | 'pathPrefix'> & { companyId: string }) {
  return (
    <ImageUploader
      {...props}
      bucket="company-logos"
      pathPrefix={`company_${props.companyId}`}
      label={props.label || 'Upload Logo'}
      compressionOptions={{
        maxSizeMB: 2,
        maxWidthOrHeight: 512,
        ...props.compressionOptions,
      }}
    />
  );
}

/** Uploader for project images */
export function ProjectImageUploader(props: Omit<ImageUploaderProps, 'bucket' | 'pathPrefix'> & { projectId: string }) {
  return (
    <ImageUploader
      {...props}
      bucket="project-images"
      pathPrefix={`project_${props.projectId}`}
      label={props.label || 'Upload Image'}
    />
  );
}

/** Uploader for post images */
export function PostImageUploader(props: Omit<ImageUploaderProps, 'bucket' | 'pathPrefix'>) {
  return (
    <ImageUploader
      {...props}
      bucket="post-images"
      pathPrefix="post"
      label={props.label || 'Add Image'}
    />
  );
}

/** Uploader for user avatars */
export function AvatarUploader(props: Omit<ImageUploaderProps, 'bucket' | 'pathPrefix'>) {
  return (
    <ImageUploader
      {...props}
      bucket="user-avatars"
      pathPrefix="avatar"
      label={props.label || 'Change Avatar'}
      compressionOptions={{
        maxSizeMB: 1,
        maxWidthOrHeight: 256,
        ...props.compressionOptions,
      }}
    />
  );
}

export default ImageUploader;
