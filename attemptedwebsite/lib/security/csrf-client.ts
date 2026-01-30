"use client";

const CSRF_COOKIE = "prism_csrf";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export async function getCsrfToken() {
  let token = readCookie(CSRF_COOKIE);
  if (token) return token;

  await fetch("/api/csrf", { method: "GET", cache: "no-store" });
  token = readCookie(CSRF_COOKIE);
  return token;
}

export async function csrfFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return fetch(input, init);
  }

  const token = await getCsrfToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("x-csrf-token", token);
  }

  return fetch(input, { ...init, headers });
}

export function getErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const error = (data as { error?: unknown }).error;
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
