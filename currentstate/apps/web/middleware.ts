import { NextRequest, NextResponse } from "next/server";

import { isModOrAdmin } from "@/lib/auth/guards";

type SessionPayload = {
  authed: boolean;
  user?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    siteRole: string;
  };
};

const authPaths = [
  /^\/dashboard(\/.*)?$/,
  /^\/company\/[^/]+\/hub(\/.*)?$/,
  /^\/help\/ticket(\/.*)?$/,
];

async function fetchSession(request: NextRequest) {
  const response = await fetch(new URL("/api/me", request.url), {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
      "x-request-id": request.headers.get("x-request-id") ?? "",
    },
    cache: "no-store",
  });

  let data: SessionPayload | null = null;
  try {
    data = (await response.json()) as SessionPayload;
  } catch (error) {
    console.error("Failed to parse session payload", error);
  }

  return {
    data,
    setCookie: response.headers.get("set-cookie"),
  };
}

function attachSetCookie(
  response: NextResponse,
  setCookie: string | null,
) {
  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const withRequestId = (response: NextResponse) => {
    response.headers.set("x-request-id", requestId);
    return response;
  };

  if (pathname.startsWith("/api")) {
    const method = request.method.toUpperCase();
    const csrfExempt =
      pathname.startsWith("/api/auth/discord") || pathname === "/api/csrf";

    if (["POST", "PATCH", "DELETE"].includes(method) && !csrfExempt) {
      const csrfCookie = request.cookies.get("prism_csrf")?.value;
      const csrfHeader = request.headers.get("x-csrf-token");
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return withRequestId(
          NextResponse.json(
            { error: { code: "CSRF", message: "Invalid CSRF token." } },
            { status: 403 },
          ),
        );
      }
    }

    return withRequestId(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  const requiresAuth = authPaths.some((pattern) => pattern.test(pathname));

  if (!requiresAuth) {
    return withRequestId(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  const sessionCookie = request.cookies.get("prism_session")?.value;
  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    url.searchParams.set("next", `${pathname}${search}`);
    return withRequestId(NextResponse.redirect(url));
  }

  const { data, setCookie } = await fetchSession(request);
  if (!data?.authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    url.searchParams.set("next", `${pathname}${search}`);
    return withRequestId(
      attachSetCookie(NextResponse.redirect(url), setCookie),
    );
  }

  if (pathname.startsWith("/dashboard/admin")) {
    if (!isModOrAdmin(data.user?.siteRole)) {
      const url = request.nextUrl.clone();
      url.pathname = "/forbidden";
      return withRequestId(
        attachSetCookie(NextResponse.redirect(url), setCookie),
      );
    }
  }

  return withRequestId(
    attachSetCookie(
      NextResponse.next({ request: { headers: requestHeaders } }),
      setCookie,
    ),
  );
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/company/:path*",
    "/help/ticket/:path*",
    "/api/:path*",
  ],
};
