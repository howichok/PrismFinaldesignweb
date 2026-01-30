import "server-only";

import type { NextRequest } from "next/server";

import { logWarn } from "@/lib/security/logger";

type RateLimitConfig = {
  key: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore?: RateLimitStore;
};

const rateLimitStore: RateLimitStore =
  globalForRateLimit.rateLimitStore ?? new Map();

if (!globalForRateLimit.rateLimitStore) {
  globalForRateLimit.rateLimitStore = rateLimitStore;
}

export async function rateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;
  const entry = rateLimitStore.get(key);
  const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt };
  current.count += 1;
  rateLimitStore.set(key, current);

  const remaining = Math.max(0, limit - current.count);
  const retryAfter = Math.max(
    1,
    Math.ceil((current.resetAt - now) / 1000),
  );

  if (current.count > limit) {
    logWarn("rate_limit_blocked", { key, limit, windowSeconds }, undefined);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining, retryAfter };
}

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.ip ?? "unknown";
}

export function buildRateLimitKey(parts: string[]) {
  return `rl:${parts.filter(Boolean).join(":")}`;
}
