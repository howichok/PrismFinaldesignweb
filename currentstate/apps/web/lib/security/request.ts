import "server-only";

import type { NextRequest } from "next/server";

export function getRequestId(request?: NextRequest | Request) {
  const headerValue = request?.headers.get("x-request-id");
  return headerValue ?? crypto.randomUUID();
}
