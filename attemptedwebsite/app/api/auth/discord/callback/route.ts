import { NextRequest, NextResponse } from "next/server";

import {
  exchangeDiscordCode,
  fetchDiscordUser,
  getDiscordAvatarUrl,
  getDiscordDisplayName,
  sanitizeNextPath,
} from "@/lib/auth/discord";
import { createSession, getSessionCookieOptions } from "@/lib/auth/session";
import { logError, logInfo } from "@/lib/security/logger";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildRateLimitKey,
  getClientIp,
  rateLimit,
} from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

function getOauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function getRedirectTarget(pathname: string, authStatus?: string) {
  const url = new URL(pathname, process.env.PRISM_BASE_URL ?? "http://localhost:3000");
  if (authStatus) {
    url.searchParams.set("auth", authStatus);
  }
  return url.toString();
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = await rateLimit({
    key: buildRateLimitKey(["auth", "callback", ip]),
    limit: 10,
    windowSeconds: 600,
  });
  if (!rate.allowed) {
    return NextResponse.redirect(getRedirectTarget("/", "rate_limited"));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const stateCookie = request.cookies.get("discord_oauth_state")?.value;
  const nextCookie = request.cookies.get("discord_oauth_next")?.value;

  if (!code || !state || !stateCookie || stateCookie !== state) {
    logError("auth_callback_state_mismatch", { ip }, request);
    return NextResponse.redirect(getRedirectTarget("/", "invalid"));
  }

  let userData: Awaited<ReturnType<typeof fetchDiscordUser>>;
  try {
    const accessToken = await exchangeDiscordCode(code);
    userData = await fetchDiscordUser(accessToken);
  } catch (error) {
    logError(
      "auth_callback_failed",
      {
        ip,
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
    return NextResponse.redirect(getRedirectTarget("/", "failed"));
  }

  const displayName = getDiscordDisplayName(userData);
  const avatarUrl = getDiscordAvatarUrl(userData);

  const supabase = getSupabaseAdmin();
  let user: {
    id: string;
    discordId: string;
    displayName: string;
    avatarUrl: string | null;
    siteRole: "USER" | "MOD" | "ADMIN";
    rolesVersion: number;
    status: "ACTIVE" | "SUSPENDED" | "BANNED";
  };
  try {
    const usersTable = supabase.from("users") as unknown as {
      select: (value: string) => any;
      update: (values: Record<string, unknown>) => any;
      insert: (values: Record<string, unknown>) => any;
    };

    const { data: existingUser, error: userLookupError } = await usersTable
      .select("*")
      .eq("discordId", userData.id)
      .maybeSingle();
    if (userLookupError) {
      throw new Error(userLookupError.message);
    }

    if (existingUser) {
      const { data: updatedUser, error: updateError } = await usersTable
        .update({
          displayName,
          avatarUrl,
        })
        .eq("id", existingUser.id)
        .select("*")
        .single();
      if (updateError || !updatedUser) {
        throw new Error(updateError?.message ?? "User update failed.");
      }
      user = updatedUser;
    } else {
      const { data: createdUser, error: insertError } = await usersTable
        .insert({
          discordId: userData.id,
          displayName,
          avatarUrl,
        })
        .select("*")
        .single();
      if (insertError || !createdUser) {
        throw new Error(insertError?.message ?? "User create failed.");
      }
      user = createdUser;
    }

    const connectionsTable = supabase.from("account_connections") as unknown as {
      select: (value: string) => any;
      update: (values: Record<string, unknown>) => any;
      insert: (values: Record<string, unknown>) => any;
    };

    const { data: existingConnection, error: connectionLookupError } =
      await connectionsTable
        .select("*")
        .eq("provider", "DISCORD")
        .eq("providerUserId", userData.id)
        .maybeSingle();
    if (connectionLookupError) {
      throw new Error(connectionLookupError.message);
    }

    if (existingConnection) {
      const { error: updateConnError } = await connectionsTable
        .update({
          userId: user.id,
          profileData: userData as unknown as object,
        })
        .eq("id", existingConnection.id);
      if (updateConnError) {
        throw new Error(updateConnError.message);
      }
    } else {
      const { error: insertConnError } = await connectionsTable
        .insert({
          provider: "DISCORD",
          providerUserId: userData.id,
          userId: user.id,
          profileData: userData as unknown as object,
        });
      if (insertConnError) {
        throw new Error(insertConnError.message);
      }
    }
  } catch (error) {
    logError(
      "auth_callback_user_upsert_failed",
      {
        ip,
        error: error instanceof Error ? error.message : String(error),
      },
      request,
    );
    return NextResponse.redirect(getRedirectTarget("/", "failed"));
  }

  if (user.status === "BANNED") {
    logInfo("auth_callback_banned", { userId: user.id }, request);
    return NextResponse.redirect(getRedirectTarget("/", "banned"));
  }

  const { sessionId } = await createSession({
    userId: user.id,
    discordId: user.discordId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    siteRole: user.siteRole,
    rolesVersion: user.rolesVersion,
  });

  const redirectTarget = sanitizeNextPath(
    nextCookie ? decodeURIComponent(nextCookie) : "/",
  );

  const response = NextResponse.redirect(
    getRedirectTarget(redirectTarget),
  );

  response.cookies.set("prism_session", sessionId, getSessionCookieOptions());
  const oauthClearOptions = {
    ...getOauthCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  };
  response.cookies.set("discord_oauth_state", "", oauthClearOptions);
  response.cookies.set("discord_oauth_next", "", oauthClearOptions);

  logInfo(
    "auth_callback_success",
    {
      userId: user.id,
      discordId: user.discordId,
    },
    request,
  );

  return response;
}
