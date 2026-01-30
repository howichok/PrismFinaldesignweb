import "server-only";

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

const DISCORD_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_ME_URL = "https://discord.com/api/users/@me";

function getDiscordConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const baseUrl = process.env.PRISM_BASE_URL?.replace(/\/+$/, "");

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error(
      "Missing Discord OAuth environment variables (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, PRISM_BASE_URL).",
    );
  }

  const redirectUri = `${baseUrl}/api/auth/discord/callback`;

  return { clientId, clientSecret, redirectUri };
}

export function sanitizeNextPath(nextParam: string | null) {
  if (!nextParam) return "/";
  if (nextParam.startsWith("http")) return "/";
  if (nextParam.startsWith("//")) return "/";
  if (!nextParam.startsWith("/")) return "/";
  return nextParam;
}

export function getDiscordAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = getDiscordConfig();
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeDiscordCode(code: string) {
  const { clientId, clientSecret, redirectUri } = getDiscordConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord token exchange failed: ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchDiscordUser(accessToken: string) {
  const response = await fetch(DISCORD_ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord user fetch failed: ${errorText}`);
  }

  return (await response.json()) as DiscordUser;
}

export function getDiscordDisplayName(user: DiscordUser) {
  return user.global_name ?? user.username;
}

export function getDiscordAvatarUrl(user: DiscordUser) {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }
  return "https://cdn.discordapp.com/embed/avatars/0.png";
}
