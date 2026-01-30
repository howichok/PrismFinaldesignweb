import { NextRequest, NextResponse } from "next/server";

import {
  getSessionById,
  getSessionCookieOptions,
} from "@/lib/auth/session";
import {
  createCsrfToken,
  getCsrfCookieName,
  getCsrfCookieOptions,
} from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("prism_session")?.value;
  const csrfCookieName = getCsrfCookieName();
  const csrfToken =
    request.cookies.get(csrfCookieName)?.value ?? createCsrfToken();

  if (!sessionId) {
    const response = NextResponse.json({ authed: false });
    if (!request.cookies.get(csrfCookieName)?.value) {
      response.cookies.set(csrfCookieName, csrfToken, getCsrfCookieOptions());
    }
    return response;
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    const response = NextResponse.json({ authed: false });
    response.cookies.set("prism_session", "", {
      ...getSessionCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    });
    if (!request.cookies.get(csrfCookieName)?.value) {
      response.cookies.set(csrfCookieName, csrfToken, getCsrfCookieOptions());
    }
    return response;
  }

  const response = NextResponse.json({
    authed: true,
    user: {
      id: session.userId,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      siteRole: session.siteRole,
    },
  });
  if (!request.cookies.get(csrfCookieName)?.value) {
    response.cookies.set(csrfCookieName, csrfToken, getCsrfCookieOptions());
  }
  return response;
}
