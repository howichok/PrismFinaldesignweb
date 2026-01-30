import "server-only";

import type { NextRequest } from "next/server";

const CSRF_COOKIE = "prism_csrf";
const CSRF_TTL_SECONDS = 60 * 60 * 24 * 7;

export function getCsrfCookieName() {
  return CSRF_COOKIE;
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CSRF_TTL_SECONDS,
  };
}

export function createCsrfToken() {
  return crypto.randomUUID();
}

export function readCsrfToken(request: NextRequest) {
  return request.cookies.get(CSRF_COOKIE)?.value ?? null;
}

export function hasValidCsrf(request: NextRequest) {
  const cookieToken = readCsrfToken(request);
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}
