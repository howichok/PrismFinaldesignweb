'use client';

/**
 * Example Usage of ImageUploader
 *
 * This file demonstrates how to use the ImageUploader component
 * in different scenarios.
 */

import React, { useState } from 'react';
import {
  ImageUploader,
  CompanyLogoUploader,
  ProjectImageUploader,
  PostImageUploader,
  AvatarUploader,
} from '@/components/ImageUploader';

// Don't forget to import the styles in your layout or page:
// import '@/styles/image-uploader.css';

// ═══════════════════════════════════════════════════════════════════════════
// BASIC USAGE
// ═══════════════════════════════════════════════════════════════════════════

export function BasicExample() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  return (
    <div>
      <h3>Basic Image Upload</h3>

      <ImageUploader
        bucket="post-images"
        path="my-custom-path"
        onUploaded={(url) => {
          console.log('Uploaded:', url);
          setImageUrl(url);
        }}
        onError={(error) => {
          console.error('Upload failed:', error);
        }}
      />

      {imageUrl && (
        <div style={{ marginTop: 16 }}>
          <p>Uploaded image:</p>
          <img src={imageUrl} alt="Uploaded" style={{ maxWidth: 300 }} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY LOGO
// ═══════════════════════════════════════════════════════════════════════════

export function CompanyLogoExample() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const companyId = 'abc123'; // From your data

  return (
    <div>
      <h3>Company Logo Upload</h3>

      <CompanyLogoUploader
        companyId={companyId}
        onUploaded={setLogoUrl}
        currentImageUrl={logoUrl || undefined}
        className="image-uploader--small"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// USER AVATAR
// ═══════════════════════════════════════════════════════════════════════════

export function AvatarExample() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const userId = 'user123';

  return (
    <div>
      <h3>Avatar Upload</h3>

      <AvatarUploader
        userId={userId}
        onUploaded={(url) => {
          setAvatarUrl(url);
          // Update user profile in database
          // await updateUserAvatar(userId, url);
        }}
        currentImageUrl={avatarUrl || undefined}
        className="image-uploader--circular"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT IMAGES (Multiple)
// ═══════════════════════════════════════════════════════════════════════════

export function ProjectImagesExample() {
  const [images, setImages] = useState<string[]>([]);
  const projectId = 'project456';

  const handleImageUploaded = (url: string) => {
    setImages((prev) => [...prev, url]);
  };

  return (
    <div>
      <h3>Project Images</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {images.map((url, index) => (
          <img
            key={index}
            src={url}
            alt={`Project image ${index + 1}`}
            style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8 }}
          />
        ))}

        <ProjectImageUploader
          projectId={projectId}
          onUploaded={handleImageUploaded}
          className="image-uploader--large"
          label="Add Project Image"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// POST WITH IMAGE
// ═══════════════════════════════════════════════════════════════════════════

export function PostEditorExample() {
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  return (
    <div>
      <h3>Create Post</h3>

      <textarea
        value={postContent}
        onChange={(e) => setPostContent(e.target.value)}
        placeholder="What's on your mind?"
        style={{ width: '100%', minHeight: 100, marginBottom: 16 }}
      />

      {postImage ? (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <img
            src={postImage}
            alt="Post"
            style={{ maxWidth: '100%', borderRadius: 8 }}
          />
          <button
            onClick={() => setPostImage(null)}
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            Remove
          </button>
        </div>
      ) : (
        <PostImageUploader
          onUploaded={setPostImage}
          onUploadStart={() => setIsUploading(true)}
          onError={() => setIsUploading(false)}
        />
      )}

      <button
        disabled={!postContent || isUploading}
        onClick={() => {
          // Submit post with postContent and postImage
          console.log('Submit:', { content: postContent, image: postImage });
        }}
      >
        {isUploading ? 'Uploading...' : 'Post'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM COMPRESSION
// ═══════════════════════════════════════════════════════════════════════════

export function CustomCompressionExample() {
  return (
    <div>
      <h3>High Quality Upload (for print)</h3>

      <ImageUploader
        bucket="project-images"
        onUploaded={(url) => console.log('Uploaded:', url)}
        compressionOptions={{
          maxSizeMB: 10,           // Allow larger files
          maxWidthOrHeight: 4000,  // Higher resolution
          fileType: 'image/webp',
        }}
        maxSizeMB={100} // Allow up to 100MB input
        label="Upload High-Res Image"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FULL PAGE EXAMPLE
// ═══════════════════════════════════════════════════════════════════════════

export default function ImageUploadExamplePage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1>Image Upload Examples</h1>

      <section style={{ marginBottom: 48 }}>
        <BasicExample />
      </section>

      <section style={{ marginBottom: 48 }}>
        <CompanyLogoExample />
      </section>

      <section style={{ marginBottom: 48 }}>
        <AvatarExample />
      </section>

      <section style={{ marginBottom: 48 }}>
        <ProjectImagesExample />
      </section>

      <section style={{ marginBottom: 48 }}>
        <PostEditorExample />
      </section>

      <section style={{ marginBottom: 48 }}>
        <CustomCompressionExample />
      </section>
    </div>
  );
}
