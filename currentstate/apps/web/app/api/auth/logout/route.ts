import { NextRequest, NextResponse } from "next/server";

import { destroySession, getSessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("prism_session")?.value;
  await destroySession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("prism_session", "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
