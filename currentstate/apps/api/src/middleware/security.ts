/**
 * Security Middleware
 *
 * Provides CSRF/Origin protection, rate limiting, and request tracking.
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// ============================================
// Request ID Middleware
// ============================================

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Adds a unique request ID to each request for tracing.
 * Also adds X-Request-ID header to response.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers["x-request-id"] as string || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

// ============================================
// Origin/CSRF Protection
// ============================================

// Parse allowed origins from env (comma-separated)
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";

  const origins = new Set<string>();

  // Always allow configured web origin
  origins.add(webOrigin);

  // Add localhost for dev
  origins.add("http://localhost:3000");

  // Add any custom origins from env
  if (envOrigins) {
    envOrigins.split(",").forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) origins.add(trimmed);
    });
  }

  return Array.from(origins);
}

function shouldAllowWildcard(pattern: string): boolean {
  const allowNetlify = process.env.ALLOW_NETLIFY_PREVIEWS === "true";
  return allowNetlify && pattern.includes("netlify.app") && pattern.includes("*");
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((pattern) => {
    if (!pattern.includes("*")) {
      return origin === pattern;
    }
    if (!shouldAllowWildcard(pattern)) {
      return false;
    }
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(origin);
  });
}

/**
 * CSRF/Origin protection for state-changing requests.
 * Rejects POST/PATCH/DELETE requests without valid Origin or Referer.
 */
export function originProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only check state-changing methods
  const method = req.method.toUpperCase();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    next();
    return;
  }

  // Skip for certain paths that need to work without origin (e.g., launcher exchange)
  const skipPaths = [
    "/launcher/exchange", // Called from desktop app
    "/health"
  ];

  if (skipPaths.some((p) => req.path === p || req.path.startsWith(p))) {
    next();
    return;
  }

  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Check Origin header first
  if (origin) {
    if (isOriginAllowed(origin, allowedOrigins)) {
      next();
      return;
    }
    console.warn(`[Security] Blocked request with invalid origin: ${origin}`, {
      requestId: req.requestId,
      path: req.path,
      method: req.method
    });
    res.status(403).json({
      error: "Invalid origin",
      code: "ORIGIN_NOT_ALLOWED"
    });
    return;
  }

  // Check Referer header as fallback
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (isOriginAllowed(refererOrigin, allowedOrigins)) {
        next();
        return;
      }
    } catch {
      // Invalid referer URL
    }
    console.warn(`[Security] Blocked request with invalid referer: ${referer}`, {
      requestId: req.requestId,
      path: req.path,
      method: req.method
    });
    res.status(403).json({
      error: "Invalid referer",
      code: "REFERER_NOT_ALLOWED"
    });
    return;
  }

  // No Origin or Referer - reject
  console.warn(`[Security] Blocked request without origin/referer`, {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    userAgent: req.headers["user-agent"]
  });
  res.status(403).json({
    error: "Origin or Referer header required",
    code: "MISSING_ORIGIN"
  });
}

// ============================================
// Rate Limiting
// ============================================

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

// In-memory rate limit storage
// In production, use Redis for distributed rate limiting
const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Configurable rate limits from env
export interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  keyPrefix: string;    // Prefix for bucket key
}

// Default rate limit configs (can be overridden via env)
export const RATE_LIMITS = {
  // Auth-related (stricter)
  AUTH_MICROSOFT: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MICROSOFT || "10", 10),
    keyPrefix: "auth:ms"
  },
  AUTH_LAUNCHER: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_LAUNCHER || "10", 10),
    keyPrefix: "auth:launcher"
  },

  // Content creation
  CONTENT_CREATE: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_CONTENT_CREATE || "20", 10),
    keyPrefix: "content:create"
  },
  CONTENT_SUBMIT: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_CONTENT_SUBMIT || "10", 10),
    keyPrefix: "content:submit"
  },

  // Moderation actions
  MODERATION: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MODERATION || "30", 10),
    keyPrefix: "mod"
  },

  // Tickets
  TICKET_CREATE: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_TICKET_CREATE || "5", 10),
    keyPrefix: "ticket:create"
  },
  TICKET_MESSAGE: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_TICKET_MESSAGE || "20", 10),
    keyPrefix: "ticket:msg"
  },

  // Company actions
  COMPANY_INVITE: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_COMPANY_INVITE || "20", 10),
    keyPrefix: "company:invite"
  },
  COMPANY_JOIN: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_COMPANY_JOIN || "10", 10),
    keyPrefix: "company:join"
  },

  // Admin actions
  ADMIN: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_ADMIN || "60", 10),
    keyPrefix: "admin"
  },

  // General API
  GENERAL: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_GENERAL || "100", 10),
    keyPrefix: "general"
  }
} as const;

/**
 * Check if a request should be rate limited.
 * Returns true if rate limited, false otherwise.
 */
function isRateLimited(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // Start new window
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + config.windowMs
    });
    return false;
  }

  if (bucket.count >= config.maxRequests) {
    return true;
  }

  bucket.count++;
  return false;
}

/**
 * Get rate limit info for response headers.
 */
function getRateLimitInfo(key: string, config: RateLimitConfig): {
  remaining: number;
  resetAt: number;
} {
  const bucket = rateLimitBuckets.get(key);
  if (!bucket) {
    return { remaining: config.maxRequests, resetAt: Date.now() + config.windowMs };
  }
  return {
    remaining: Math.max(0, config.maxRequests - bucket.count),
    resetAt: bucket.resetAt
  };
}

/**
 * Creates a rate limiting middleware with the specified config.
 * Uses both user ID (if authenticated) and IP address as keys.
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id;
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    // Check user-based rate limit (if authenticated)
    if (userId) {
      const userKey = `${config.keyPrefix}:user:${userId}`;
      if (isRateLimited(userKey, config)) {
        const info = getRateLimitInfo(userKey, config);
        res.setHeader("X-RateLimit-Remaining", info.remaining);
        res.setHeader("X-RateLimit-Reset", Math.ceil(info.resetAt / 1000));
        res.setHeader("Retry-After", Math.ceil((info.resetAt - Date.now()) / 1000));

        console.warn(`[RateLimit] User rate limited: ${userId}`, {
          requestId: req.requestId,
          path: req.path,
          keyPrefix: config.keyPrefix
        });

        res.status(429).json({
          error: "Too many requests. Please try again later.",
          code: "RATE_LIMITED",
          retryAfter: Math.ceil((info.resetAt - Date.now()) / 1000)
        });
        return;
      }
    }

    // Check IP-based rate limit (always)
    const ipKey = `${config.keyPrefix}:ip:${clientIp}`;
    if (isRateLimited(ipKey, config)) {
      const info = getRateLimitInfo(ipKey, config);
      res.setHeader("X-RateLimit-Remaining", info.remaining);
      res.setHeader("X-RateLimit-Reset", Math.ceil(info.resetAt / 1000));
      res.setHeader("Retry-After", Math.ceil((info.resetAt - Date.now()) / 1000));

      console.warn(`[RateLimit] IP rate limited: ${clientIp}`, {
        requestId: req.requestId,
        path: req.path,
        keyPrefix: config.keyPrefix
      });

      res.status(429).json({
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
        retryAfter: Math.ceil((info.resetAt - Date.now()) / 1000)
      });
      return;
    }

    // Add rate limit headers
    const info = getRateLimitInfo(userId ? `${config.keyPrefix}:user:${userId}` : ipKey, config);
    res.setHeader("X-RateLimit-Limit", config.maxRequests);
    res.setHeader("X-RateLimit-Remaining", info.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(info.resetAt / 1000));

    next();
  };
}

// Pre-configured rate limiters
export const rateLimiters = {
  authMicrosoft: createRateLimiter(RATE_LIMITS.AUTH_MICROSOFT),
  authLauncher: createRateLimiter(RATE_LIMITS.AUTH_LAUNCHER),
  contentCreate: createRateLimiter(RATE_LIMITS.CONTENT_CREATE),
  contentSubmit: createRateLimiter(RATE_LIMITS.CONTENT_SUBMIT),
  moderation: createRateLimiter(RATE_LIMITS.MODERATION),
  ticketCreate: createRateLimiter(RATE_LIMITS.TICKET_CREATE),
  ticketMessage: createRateLimiter(RATE_LIMITS.TICKET_MESSAGE),
  companyInvite: createRateLimiter(RATE_LIMITS.COMPANY_INVITE),
  companyJoin: createRateLimiter(RATE_LIMITS.COMPANY_JOIN),
  admin: createRateLimiter(RATE_LIMITS.ADMIN),
  general: createRateLimiter(RATE_LIMITS.GENERAL)
};

// ============================================
// Cleanup (for memory management)
// ============================================

/**
 * Periodically clean up expired rate limit buckets.
 * Call this on an interval to prevent memory leaks.
 */
export function cleanupRateLimitBuckets(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Clean up every 5 minutes
setInterval(() => {
  const cleaned = cleanupRateLimitBuckets();
  if (cleaned > 0) {
    console.log(`[RateLimit] Cleaned up ${cleaned} expired buckets`);
  }
}, 5 * 60 * 1000);
