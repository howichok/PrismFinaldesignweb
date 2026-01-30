/**
 * Key Management Service
 *
 * Provides versioned encryption key support for token encryption.
 * Supports key rotation without breaking existing encrypted tokens.
 *
 * Environment Variables:
 * - MICROSOFT_TOKEN_KEY_V1: First (or current) encryption key (64 hex chars)
 * - MICROSOFT_TOKEN_KEY_V2: Second encryption key (for rotation)
 * - MICROSOFT_TOKEN_KEY_V3: Third encryption key (for future rotation)
 * - MICROSOFT_TOKEN_CURRENT_VERSION: Which version to use for new encryptions (default: 1)
 *
 * For backward compatibility, MICROSOFT_TOKEN_KEY is treated as V1.
 */

import crypto from "crypto";

// ============================================
// Key Storage
// ============================================

interface EncryptionKey {
  version: number;
  key: Buffer;
}

const keyCache = new Map<number, Buffer>();

/**
 * Get the encryption key for a specific version.
 * Keys are loaded lazily and cached.
 */
function getKeyForVersion(version: number): Buffer {
  const cached = keyCache.get(version);
  if (cached) return cached;

  // Try versioned key first, then fall back to legacy key for V1
  let keyHex: string | undefined;

  if (version === 1) {
    keyHex = process.env.MICROSOFT_TOKEN_KEY_V1 || process.env.MICROSOFT_TOKEN_KEY;
  } else {
    keyHex = process.env[`MICROSOFT_TOKEN_KEY_V${version}`];
  }

  if (!keyHex) {
    throw new Error(`Encryption key V${version} not configured. Set MICROSOFT_TOKEN_KEY_V${version} in environment.`);
  }

  if (keyHex.length !== 64) {
    throw new Error(`Encryption key V${version} must be 64 hex characters (32 bytes). Got ${keyHex.length} characters.`);
  }

  const key = Buffer.from(keyHex, "hex");
  keyCache.set(version, key);
  return key;
}

/**
 * Get the current key version for new encryptions.
 */
export function getCurrentKeyVersion(): number {
  const versionStr = process.env.MICROSOFT_TOKEN_CURRENT_VERSION || "1";
  const version = parseInt(versionStr, 10);
  if (isNaN(version) || version < 1) {
    return 1;
  }
  return version;
}

/**
 * Check if a specific key version is available.
 */
export function isKeyVersionAvailable(version: number): boolean {
  try {
    getKeyForVersion(version);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all available key versions.
 */
export function getAvailableKeyVersions(): number[] {
  const versions: number[] = [];

  // Check V1-V10 (practical limit)
  for (let v = 1; v <= 10; v++) {
    if (isKeyVersionAvailable(v)) {
      versions.push(v);
    }
  }

  return versions;
}

// ============================================
// Encryption/Decryption with Versioning
// ============================================

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

/**
 * Encrypt a token using the current key version.
 */
export function encryptWithVersion(plaintext: string): EncryptedData {
  const keyVersion = getCurrentKeyVersion();
  const key = getKeyForVersion(keyVersion);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    keyVersion
  };
}

/**
 * Decrypt a token using the specified key version.
 */
export function decryptWithVersion(
  encrypted: string,
  iv: string,
  tag: string,
  keyVersion: number
): string {
  const key = getKeyForVersion(keyVersion);

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Re-encrypt data with the current key version.
 * Used during key rotation.
 */
export function reencrypt(
  encrypted: string,
  iv: string,
  tag: string,
  oldKeyVersion: number
): EncryptedData {
  // Decrypt with old key
  const plaintext = decryptWithVersion(encrypted, iv, tag, oldKeyVersion);

  // Re-encrypt with current key
  return encryptWithVersion(plaintext);
}

// ============================================
// Key Rotation Support
// ============================================

export interface RotationResult {
  userId: string;
  success: boolean;
  oldVersion: number;
  newVersion: number;
  error?: string;
}

/**
 * Rotate encryption key for a single Microsoft link record.
 * Returns the result of the rotation attempt.
 */
export async function rotateKeyForLink(
  prisma: any,
  link: {
    userId: string;
    refreshTokenEnc: string | null;
    refreshTokenIv: string | null;
    refreshTokenTag: string | null;
    keyVersion: number;
  }
): Promise<RotationResult> {
  const currentVersion = getCurrentKeyVersion();

  // Skip if already on current version or no token
  if (link.keyVersion === currentVersion) {
    return {
      userId: link.userId,
      success: true,
      oldVersion: link.keyVersion,
      newVersion: currentVersion
    };
  }

  if (!link.refreshTokenEnc || !link.refreshTokenIv || !link.refreshTokenTag) {
    return {
      userId: link.userId,
      success: true,
      oldVersion: link.keyVersion,
      newVersion: link.keyVersion
    };
  }

  try {
    const reencrypted = reencrypt(
      link.refreshTokenEnc,
      link.refreshTokenIv,
      link.refreshTokenTag,
      link.keyVersion
    );

    await prisma.microsoftLink.update({
      where: { userId: link.userId },
      data: {
        refreshTokenEnc: reencrypted.encrypted,
        refreshTokenIv: reencrypted.iv,
        refreshTokenTag: reencrypted.tag,
        keyVersion: reencrypted.keyVersion
      }
    });

    return {
      userId: link.userId,
      success: true,
      oldVersion: link.keyVersion,
      newVersion: reencrypted.keyVersion
    };
  } catch (error) {
    return {
      userId: link.userId,
      success: false,
      oldVersion: link.keyVersion,
      newVersion: link.keyVersion,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Rotate all tokens from oldVersion to the current version.
 * Returns results for each link.
 */
export async function rotateAllKeys(
  prisma: any,
  fromVersion?: number
): Promise<{
  total: number;
  rotated: number;
  failed: number;
  results: RotationResult[];
}> {
  const currentVersion = getCurrentKeyVersion();

  // Get all links that need rotation
  const whereClause = fromVersion !== undefined
    ? { keyVersion: fromVersion }
    : { keyVersion: { not: currentVersion } };

  const links = await prisma.microsoftLink.findMany({
    where: whereClause,
    select: {
      userId: true,
      refreshTokenEnc: true,
      refreshTokenIv: true,
      refreshTokenTag: true,
      keyVersion: true
    }
  });

  const results: RotationResult[] = [];
  let rotated = 0;
  let failed = 0;

  for (const link of links) {
    const result = await rotateKeyForLink(prisma, link);
    results.push(result);

    if (result.success && result.oldVersion !== result.newVersion) {
      rotated++;
    } else if (!result.success) {
      failed++;
    }
  }

  return {
    total: links.length,
    rotated,
    failed,
    results
  };
}

// ============================================
// Validation
// ============================================

/**
 * Validate that required encryption keys are configured.
 * Call during startup to fail fast if keys are missing.
 */
export function validateKeyConfiguration(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const currentVersion = getCurrentKeyVersion();
  const availableVersions = getAvailableKeyVersions();

  if (availableVersions.length === 0) {
    errors.push("No encryption keys configured. Set MICROSOFT_TOKEN_KEY or MICROSOFT_TOKEN_KEY_V1.");
  }

  if (!availableVersions.includes(currentVersion)) {
    errors.push(`Current key version (${currentVersion}) is not available. Configure MICROSOFT_TOKEN_KEY_V${currentVersion}.`);
  }

  // Warn if there are gaps in versions
  if (availableVersions.length > 1) {
    const max = Math.max(...availableVersions);
    const min = Math.min(...availableVersions);
    const expected = max - min + 1;

    if (availableVersions.length !== expected) {
      warnings.push("There are gaps in key versions. This is unusual and may indicate a configuration issue.");
    }
  }

  // Warn if using legacy key naming
  if (process.env.MICROSOFT_TOKEN_KEY && !process.env.MICROSOFT_TOKEN_KEY_V1) {
    warnings.push("Using legacy MICROSOFT_TOKEN_KEY. Consider migrating to MICROSOFT_TOKEN_KEY_V1 for clarity.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
