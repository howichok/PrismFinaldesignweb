# Uploads (Supabase Storage)

This project uses **Supabase Storage** with a **public** bucket named `assets`. Uploads are performed via **signed upload URLs** so the client can upload directly while all access checks happen server-side.

## 1. Required environment variables

Add these to Netlify **Site settings → Environment variables**:

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
```

Notes:
- `SUPABASE_SERVICE_KEY` must **never** be exposed to the client.
- Upload bucket and limits are enforced server-side with constants.

## 2. Bucket structure

Only the following paths are accepted:

```
company-logos/<companyId>/<uuid>.<ext>
project-covers/<projectId>/<uuid>.<ext>
post-covers/<postId>/<uuid>.<ext>
```

Allowed extensions: `.png`, `.jpg`, `.webp`

## 3. Upload flow

1. **Presign**: `POST /api/uploads/presign`
   - Checks auth, permissions, file size/mime
   - Returns `signedUrl`, `token`, and `publicUrl`
2. **Direct upload**: client uploads to `signedUrl` using `uploadToSignedUrl`
3. **Confirm**: `POST /api/uploads/confirm`
   - Re-validates permissions
   - Creates `FileAsset` and links it to the entity

## 4. Permissions

- **Company logo**: Trusted/Co-owner/Owner or creator
- **Project cover**: owner or Trusted+ in owning company
- **Post cover**: owner or Trusted+ in owning company

## 5. File size & MIME limits

- Max: **5MB**
- Allowed: `image/png`, `image/jpeg`, `image/webp`
- SVG is rejected
