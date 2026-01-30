import { NextRequest, NextResponse } from "next/server";

import { getDiscordAuthorizeUrl, sanitizeNextPath } from "@/lib/auth/discord";
import { logError, logInfo } from "@/lib/security/logger";
import {
  buildRateLimitKey,
  getClientIp,
  rateLimit,
} from "@/lib/security/rateLimit";

const OAUTH_COOKIE_MAX_AGE = 60 * 10;

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = await rateLimit({
    key: buildRateLimitKey(["auth", "start", ip]),
    limit: 30,
    windowSeconds: 600,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many login attempts." } },
      {
        status: 429,
        headers: { "Retry-After": rate.retryAfter.toString() },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const nextParam = sanitizeNextPath(searchParams.get("next"));
  const state = crypto.randomUUID();

  try {
    const response = NextResponse.redirect(getDiscordAuthorizeUrl(state));
    const cookieOptions = getCookieOptions();

    response.cookies.set("discord_oauth_state", state, cookieOptions);
    response.cookies.set(
      "discord_oauth_next",
      encodeURIComponent(nextParam),
      cookieOptions,
    );

    logInfo("auth_start", { ip }, request);

    return response;
  } catch (error) {
    logError(
      "auth_start_failed",
      {
        ip,
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
    return NextResponse.json(
      {
        error: {
          code: "AUTH_CONFIG",
          message: "Auth configuration is missing or invalid.",
        },
      },
      { status: 500 },
    );
  }
}
