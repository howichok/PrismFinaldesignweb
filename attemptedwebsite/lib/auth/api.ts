import "server-only";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import type { SessionData } from "@/lib/auth/types";
import { isAdmin, isModOrAdmin } from "@/lib/auth/guards";
import { apiError } from "@/lib/api/errors";

type AuthResult = {
  session: SessionData | null;
  response: NextResponse | null;
};

export async function requireAuth(): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: apiError(401, "UNAUTHORIZED", "Unauthorized"),
    };
  }

  return { session, response: null };
}

export async function requireModOrAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.response) {
    return result;
  }

  if (!result.session || !isModOrAdmin(result.session.siteRole)) {
    return {
      session: null,
      response: apiError(403, "FORBIDDEN", "Forbidden"),
    };
  }

  return result;
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.response) {
    return result;
  }

  if (!result.session || !isAdmin(result.session.siteRole)) {
    return {
      session: null,
      response: apiError(403, "FORBIDDEN", "Forbidden"),
    };
  }

  return result;
}
