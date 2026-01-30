import { NextRequest, NextResponse } from "next/server";

import {
  createCsrfToken,
  getCsrfCookieName,
  getCsrfCookieOptions,
} from "@/lib/security/csrf";

export async function GET(request: NextRequest) {
  const csrfCookieName = getCsrfCookieName();
  const existing = request.cookies.get(csrfCookieName)?.value;
  const token = existing ?? createCsrfToken();
  const response = NextResponse.json({ token });

  if (!existing) {
    response.cookies.set(csrfCookieName, token, getCsrfCookieOptions());
  }

  return response;
}
