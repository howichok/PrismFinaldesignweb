import { NextResponse } from "next/server";

import { requireModOrAdmin } from "@/lib/auth/api";
import { moderateRequest } from "@/lib/moderation/decision";
import { apiError, rateLimitError } from "@/lib/api/errors";
import {
  buildRateLimitKey,
  rateLimit,
} from "@/lib/security/rateLimit";
import { logError, logInfo } from "@/lib/security/logger";
import { getRequestId } from "@/lib/security/request";

export async function POST(
  request: Request,
  context: { params: { requestId: string } },
) {
  const params = context.params;
  const auth = await requireModOrAdmin();
  if (auth.response) return auth.response;

  const rate = await rateLimit({
    key: buildRateLimitKey([
      "moderation",
      "approve",
      auth.session!.userId,
    ]),
    limit: 30,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return rateLimitError(rate.retryAfter);
  }

  try {
    const result = await moderateRequest({
      requestId: params.requestId,
      reviewerId: auth.session!.userId,
      decision: "APPROVE",
    });
    logInfo(
      "moderation_approve",
      {
        reviewerId: auth.session!.userId,
        moderationRequestId: params.requestId,
      },
      request,
    );
    return NextResponse.json({ request: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return apiError(404, "NOT_FOUND", "Request not found.");
      }
      if (error.message === "TARGET_NOT_FOUND") {
        return apiError(404, "NOT_FOUND", "Target not found.");
      }
      if (error.message === "NOT_PENDING") {
        return apiError(409, "ALREADY_REVIEWED", "Request already reviewed.");
      }
    }
    logError(
      "moderation_approve_failed",
      {
        reviewerId: auth.session!.userId,
        moderationRequestId: params.requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
    return apiError(500, "SERVER_ERROR", "Unable to approve request.");
  }
}
