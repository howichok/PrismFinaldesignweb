"use client";

import type {
  DiscoveryResponse,
  DiscoveryTab,
  DiscoveryItem,
} from "@/lib/discovery/types";

type FetchParams = {
  tab: DiscoveryTab;
  query: string;
  limit: number;
  cursor?: string | null;
  signal?: AbortSignal;
};

export async function fetchDiscovery<T extends DiscoveryItem>({
  tab,
  query,
  limit,
  cursor,
  signal,
}: FetchParams): Promise<DiscoveryResponse<T>> {
  const params = new URLSearchParams();
  if (query) {
    params.set("query", query);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  params.set("limit", String(limit));

  const response = await fetch(
    `/api/discovery/${tab}?${params.toString()}`,
    {
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Discovery request failed.");
  }

  return (await response.json()) as DiscoveryResponse<T>;
}
