import { z } from "zod";

import { apiError } from "@/lib/api/errors";

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return {
      data: null,
      error: apiError(400, "INVALID_JSON", "Invalid JSON payload."),
    } as const;
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      data: null,
      error: apiError(400, "VALIDATION_ERROR", "Invalid payload.", {
        issues: parsed.error.flatten(),
      }),
    } as const;
  }

  return { data: parsed.data, error: null } as const;
}
