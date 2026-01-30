import "server-only";

import type { NextRequest } from "next/server";

import { getRequestId } from "./request";

type LogMeta = Record<string, unknown>;

function log(
  level: "info" | "warn" | "error",
  message: string,
  meta?: LogMeta,
  request?: NextRequest | Request,
) {
  const requestId = request ? getRequestId(request) : undefined;
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(requestId ? { requestId } : {}),
    ...(meta ?? {}),
  };
  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export function logInfo(
  message: string,
  meta?: LogMeta,
  request?: NextRequest | Request,
) {
  log("info", message, meta, request);
}

export function logWarn(
  message: string,
  meta?: LogMeta,
  request?: NextRequest | Request,
) {
  log("warn", message, meta, request);
}

export function logError(
  message: string,
  meta?: LogMeta,
  request?: NextRequest | Request,
) {
  log("error", message, meta, request);
}
