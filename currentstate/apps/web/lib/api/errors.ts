import { NextResponse } from "next/server";

type ErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const payload: { error: ErrorPayload } = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return NextResponse.json(payload, { status });
}

export function rateLimitError(retryAfter: number) {
  return NextResponse.json(
    { error: { code: "RATE_LIMIT", message: "Too many requests." } },
    {
      status: 429,
      headers: { "Retry-After": retryAfter.toString() },
    },
  );
}
