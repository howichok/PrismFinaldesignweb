import type { DiscoveryItem } from "@/lib/discovery/types";

export type DiscoveryCacheEntry = {
  items: DiscoveryItem[];
  nextCursor: string | null;
  lastFetchedAt: number;
  hasLoadedMore: boolean;
};

const CACHE_TTL_MS = 1000 * 60 * 2;

const discoveryCache = new Map<string, DiscoveryCacheEntry>();
const inflightRequests = new Map<string, Promise<DiscoveryCacheEntry>>();

export function getCacheKey(params: {
  tab: string;
  query: string;
  limit: number;
}) {
  const normalizedQuery = params.query.trim().toLowerCase();
  return `discovery:${params.tab}:q=${normalizedQuery}:limit=${params.limit}`;
}

export function getCacheEntry(key: string) {
  return discoveryCache.get(key) ?? null;
}

export function setCacheEntry(key: string, entry: DiscoveryCacheEntry) {
  discoveryCache.set(key, entry);
}

export function isStale(entry: DiscoveryCacheEntry) {
  return Date.now() - entry.lastFetchedAt > CACHE_TTL_MS;
}

export function getInFlight(key: string) {
  return inflightRequests.get(key) ?? null;
}

export function setInFlight(key: string, promise: Promise<DiscoveryCacheEntry>) {
  inflightRequests.set(key, promise);
}

export function clearInFlight(key: string) {
  inflightRequests.delete(key);
}

export function getCacheTtlMs() {
  return CACHE_TTL_MS;
}
