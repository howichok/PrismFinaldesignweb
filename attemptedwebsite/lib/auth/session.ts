import "server-only";

import { cookies } from "next/headers";
import type { SessionData } from "@/lib/auth/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function getSessionById(sessionId?: string) {
  if (!sessionId) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data: session, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (error || !session) {
      return null;
    }

    const expiresAt = new Date(session.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      await supabase.from("sessions").delete().eq("id", sessionId);
      return null;
    }

    return {
      userId: session.userId,
      discordId: session.discordId,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      siteRole: session.siteRole,
      rolesVersion: session.rolesVersion,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error("Failed to read session from database", error);
    return null;
  }
}

export async function getSession() {
  const sessionId = cookies().get("prism_session")?.value;
  return getSessionById(sessionId);
}

export async function createSession(params: {
  userId: string;
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
  siteRole: SessionData["siteRole"];
  rolesVersion: number;
}) {
  const sessionId = crypto.randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + SESSION_TTL_SECONDS * 1000,
  );
  const sessionData: SessionData = {
    userId: params.userId,
    discordId: params.discordId,
    displayName: params.displayName,
    avatarUrl: params.avatarUrl,
    siteRole: params.siteRole,
    rolesVersion: params.rolesVersion,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("sessions").insert({
    id: sessionId,
    userId: params.userId,
    discordId: params.discordId,
    displayName: params.displayName,
    avatarUrl: params.avatarUrl,
    siteRole: params.siteRole,
    rolesVersion: params.rolesVersion,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  if (error) {
    console.error("Failed to create session in database", error.message);
    throw error;
  }

  return { sessionId, session: sessionData };
}

export async function destroySession(sessionId?: string) {
  if (!sessionId) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) {
    console.error("Failed to delete session from database", error.message);
  }
}
