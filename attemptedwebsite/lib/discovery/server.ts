"server-only";

type CursorPayload = {
  updatedAt: string;
  id: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;

export function normalizeQuery(query: string | null) {
  const trimmed = query?.trim() ?? "";
  if (trimmed.length < 2) return "";
  return trimmed;
}

export function parseLimit(limitParam: string | null) {
  const parsed = Number(limitParam);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

export function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decodeCursor(cursorParam: string | null) {
  if (!cursorParam) return null;
  try {
    const decoded = Buffer.from(cursorParam, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as CursorPayload;
    if (!parsed?.updatedAt || !parsed?.id) return null;
    return parsed;
  } catch (error) {
    console.error("Failed to decode cursor", error);
    return null;
  }
}

export function getCursorFilter(cursor: CursorPayload | null) {
  if (!cursor) return null;
  const cursorDate = new Date(cursor.updatedAt);
  return {
    OR: [
      {
        updatedAt: {
          lt: cursorDate,
        },
      },
      {
        updatedAt: cursorDate,
        id: {
          lt: cursor.id,
        },
      },
    ],
  };
}

export function createExcerpt(text: string, maxLength = 140) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
}
