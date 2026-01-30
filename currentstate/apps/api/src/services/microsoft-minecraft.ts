/**
 * Microsoft OAuth + Xbox Live + Minecraft Services Integration
 *
 * Token chain:
 * 1. Microsoft OAuth (authorization code + PKCE) -> access_token + refresh_token
 * 2. Xbox Live token (using Microsoft access_token)
 * 3. XSTS token (using XBL token, RelyingParty = Minecraft)
 * 4. Minecraft Services token (using XSTS token)
 * 5. Check entitlements + fetch profile
 */

import crypto from "crypto";
import { prisma } from "@prismmtr/db";

import {
  encryptWithVersion,
  decryptWithVersion,
  getCurrentKeyVersion
} from "./key-management.js";

// Environment variables
const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET; // Optional for public clients
const MS_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI!;

// Microsoft OAuth endpoints
const MS_AUTHORIZE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

// Xbox Live endpoints
const XBL_USER_AUTHENTICATE_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTHORIZE_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";

// Minecraft Services endpoints
const MC_LOGIN_URL = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_ENTITLEMENTS_URL = "https://api.minecraftservices.com/entitlements/mcstore";
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";

// XSTS Relying Party for Minecraft
const MC_RELYING_PARTY = "rp://api.minecraftservices.com/";

// ============================================
// Token Encryption (AES-256-GCM) - Uses versioned key management
// ============================================

/**
 * Encrypt a token using current key version.
 * Returns encrypted data with key version for later decryption.
 */
export function encryptToken(token: string): { encrypted: string; iv: string; tag: string; keyVersion: number } {
  return encryptWithVersion(token);
}

/**
 * Decrypt a token using the specified key version.
 * Falls back to version 1 if not specified (for backward compatibility).
 */
export function decryptToken(encrypted: string, iv: string, tag: string, keyVersion: number = 1): string {
  return decryptWithVersion(encrypted, iv, tag, keyVersion);
}

// ============================================
// PKCE Helpers
// ============================================

export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// ============================================
// Microsoft OAuth
// ============================================

export interface MicrosoftAuthUrl {
  url: string;
  state: string;
  codeVerifier: string;
}

export function buildMicrosoftAuthUrl(): MicrosoftAuthUrl {
  const { verifier, challenge } = generatePKCE();
  const state = generateState();

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    scope: "XboxLive.signin XboxLive.offline_access",
    response_mode: "query",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  return {
    url: `${MS_AUTHORIZE_URL}?${params.toString()}`,
    state,
    codeVerifier: verifier
  };
}

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  idToken?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<MicrosoftTokens> {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: MS_REDIRECT_URI,
    code_verifier: codeVerifier
  });

  // Add client_secret if configured (for confidential clients)
  if (MS_CLIENT_SECRET) {
    params.set("client_secret", MS_CLIENT_SECRET);
  }

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Microsoft token exchange failed:", error);

    // Check for specific error codes
    if (error.error === "invalid_client") {
      throw new MicrosoftAuthError(
        "INVALID_APP",
        "Invalid app registration. If you see 'unauthorized_client', your app may need Minecraft API permission approval. " +
          "Visit https://aka.ms/mce-reviewappid to request access."
      );
    }

    throw new MicrosoftAuthError(
      "TOKEN_EXCHANGE_FAILED",
      error.error_description || "Failed to exchange authorization code"
    );
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    idToken: data.id_token
  };
}

export async function refreshMicrosoftAccessToken(
  refreshToken: string
): Promise<MicrosoftTokens> {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "XboxLive.signin XboxLive.offline_access"
  });

  if (MS_CLIENT_SECRET) {
    params.set("client_secret", MS_CLIENT_SECRET);
  }

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Microsoft token refresh failed:", error);
    throw new MicrosoftAuthError(
      "TOKEN_REFRESH_FAILED",
      error.error_description || "Failed to refresh Microsoft token"
    );
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // May not always rotate
    expiresIn: data.expires_in,
    idToken: data.id_token
  };
}

// ============================================
// Xbox Live Authentication
// ============================================

export interface XblToken {
  token: string;
  userHash: string;
}

export async function acquireXblToken(msAccessToken: string): Promise<XblToken> {
  const response = await fetch(XBL_USER_AUTHENTICATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT"
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("XBL authentication failed:", error);
    throw new MicrosoftAuthError(
      "XBL_AUTH_FAILED",
      "Failed to authenticate with Xbox Live"
    );
  }

  const data = await response.json();
  return {
    token: data.Token,
    userHash: data.DisplayClaims.xui[0].uhs
  };
}

export interface XstsToken {
  token: string;
  userHash: string;
  xuid: string;
  gamertag: string;
}

export async function acquireXstsToken(
  xblToken: string,
  relyingParty: string = MC_RELYING_PARTY
): Promise<XstsToken> {
  const response = await fetch(XSTS_AUTHORIZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblToken]
      },
      RelyingParty: relyingParty,
      TokenType: "JWT"
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("XSTS authorization failed:", error);

    // Check for specific Xbox error codes
    const xerr = error.XErr;
    if (xerr === 2148916233) {
      throw new MicrosoftAuthError(
        "NO_XBOX_ACCOUNT",
        "This Microsoft account has no Xbox Live account. Please create one first."
      );
    }
    if (xerr === 2148916238) {
      throw new MicrosoftAuthError(
        "CHILD_ACCOUNT",
        "This account is a child account. Adult verification is required."
      );
    }

    throw new MicrosoftAuthError(
      "XSTS_AUTH_FAILED",
      "Failed to authorize with XSTS"
    );
  }

  const data = await response.json();
  const xui = data.DisplayClaims.xui[0];

  return {
    token: data.Token,
    userHash: xui.uhs,
    xuid: xui.xid,
    gamertag: xui.gtg
  };
}

// ============================================
// Minecraft Services
// ============================================

export interface MinecraftToken {
  accessToken: string;
  expiresIn: number;
}

export async function loginMinecraftWithXsts(
  xstsToken: string,
  userHash: string
): Promise<MinecraftToken> {
  const response = await fetch(MC_LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${userHash};${xstsToken}`
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Minecraft login failed:", error);
    throw new MicrosoftAuthError(
      "MC_LOGIN_FAILED",
      "Failed to authenticate with Minecraft Services"
    );
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in
  };
}

export interface MinecraftEntitlements {
  hasJavaEdition: boolean;
  items: string[];
}

export async function getMinecraftEntitlements(
  mcAccessToken: string
): Promise<MinecraftEntitlements> {
  const response = await fetch(MC_ENTITLEMENTS_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${mcAccessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Minecraft entitlements check failed:", error);
    throw new MicrosoftAuthError(
      "MC_ENTITLEMENTS_FAILED",
      "Failed to check Minecraft entitlements"
    );
  }

  const data = await response.json();
  const items = (data.items || []).map((item: any) => item.name);

  // Check for Java Edition ownership
  // "product_minecraft" or "game_minecraft" indicates ownership
  const hasJavaEdition = items.some(
    (name: string) =>
      name === "product_minecraft" || name === "game_minecraft"
  );

  return { hasJavaEdition, items };
}

export interface MinecraftProfile {
  uuid: string;
  name: string;
}

export async function getMinecraftProfile(
  mcAccessToken: string
): Promise<MinecraftProfile | null> {
  const response = await fetch(MC_PROFILE_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${mcAccessToken}`,
      Accept: "application/json"
    }
  });

  if (response.status === 404) {
    // No profile means no game ownership or profile not created
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("Minecraft profile fetch failed:", error);
    throw new MicrosoftAuthError(
      "MC_PROFILE_FAILED",
      "Failed to fetch Minecraft profile"
    );
  }

  const data = await response.json();
  return {
    uuid: data.id,
    name: data.name
  };
}

// ============================================
// High-Level Verification Functions
// ============================================

export interface MinecraftVerificationResult {
  xuid: string;
  gamertag: string;
  mcUuid: string | null;
  mcName: string | null;
  hasMinecraftEntitlement: boolean;
}

/**
 * Full token chain: MS access_token -> XBL -> XSTS -> MC login -> entitlements + profile
 */
export async function verifyMinecraftAccessWithToken(
  msAccessToken: string
): Promise<MinecraftVerificationResult> {
  // 1. Get Xbox Live token
  const xblToken = await acquireXblToken(msAccessToken);

  // 2. Get XSTS token for Minecraft
  const xstsToken = await acquireXstsToken(xblToken.token);

  // 3. Login to Minecraft Services
  const mcToken = await loginMinecraftWithXsts(xstsToken.token, xstsToken.userHash);

  // 4. Check entitlements
  const entitlements = await getMinecraftEntitlements(mcToken.accessToken);

  // 5. Fetch profile (may be null if no ownership)
  let profile: MinecraftProfile | null = null;
  if (entitlements.hasJavaEdition) {
    profile = await getMinecraftProfile(mcToken.accessToken);
  }

  return {
    xuid: xstsToken.xuid,
    gamertag: xstsToken.gamertag,
    mcUuid: profile?.uuid ?? null,
    mcName: profile?.name ?? null,
    hasMinecraftEntitlement: entitlements.hasJavaEdition
  };
}

/**
 * Verify Minecraft access for a user with existing link.
 * Refreshes token if needed, runs verification chain, updates database.
 */
export async function verifyMinecraftAccess(userId: string): Promise<MinecraftVerificationResult> {
  const link = await prisma.microsoftLink.findUnique({
    where: { userId }
  });

  if (!link || !link.refreshTokenEnc || !link.refreshTokenIv || !link.refreshTokenTag) {
    throw new MicrosoftAuthError("NO_LINK", "No Microsoft account linked");
  }

  // Decrypt refresh token using the stored key version
  const refreshToken = decryptToken(
    link.refreshTokenEnc,
    link.refreshTokenIv,
    link.refreshTokenTag,
    link.keyVersion
  );

  // Refresh Microsoft access token
  const tokens = await refreshMicrosoftAccessToken(refreshToken);

  // If refresh token rotated, update it with current key version
  if (tokens.refreshToken !== refreshToken) {
    const { encrypted, iv, tag, keyVersion } = encryptToken(tokens.refreshToken);
    await prisma.microsoftLink.update({
      where: { userId },
      data: {
        refreshTokenEnc: encrypted,
        refreshTokenIv: iv,
        refreshTokenTag: tag,
        keyVersion
      }
    });
  }

  // Run verification chain
  const result = await verifyMinecraftAccessWithToken(tokens.accessToken);

  // Update link with verification results
  await prisma.microsoftLink.update({
    where: { userId },
    data: {
      xuid: result.xuid,
      gamertag: result.gamertag,
      mcUuid: result.mcUuid,
      mcName: result.mcName,
      hasMinecraftEntitlement: result.hasMinecraftEntitlement,
      verifiedAt: new Date()
    }
  });

  return result;
}

/**
 * Check if user needs re-verification (older than maxAge hours)
 */
export function needsReverification(
  verifiedAt: Date | null,
  maxAgeHours: number = 24
): boolean {
  if (!verifiedAt) return true;
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  return Date.now() - verifiedAt.getTime() > maxAge;
}

// ============================================
// Error Types
// ============================================

export class MicrosoftAuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "MicrosoftAuthError";
  }
}

// ============================================
// Decode ID Token (basic, for extracting sub)
// ============================================

export function decodeIdToken(idToken: string): { sub: string } | null {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    return { sub: payload.sub };
  } catch {
    return null;
  }
}

// ============================================
// Utility: Get Microsoft Subject from Link
// ============================================

export function extractMsSub(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const decoded = decodeIdToken(idToken);
  return decoded?.sub ?? null;
}
