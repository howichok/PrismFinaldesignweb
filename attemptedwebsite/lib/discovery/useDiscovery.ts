/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchDiscovery } from "@/lib/discovery/api";
import {
  clearInFlight,
  getCacheEntry,
  getCacheKey,
  getInFlight,
  getCacheTtlMs,
  isStale,
  setCacheEntry,
  setInFlight,
} from "@/lib/discovery/cache";
import type { DiscoveryItem, DiscoveryTab } from "@/lib/discovery/types";

type DiscoveryState = {
  items: DiscoveryItem[];
  nextCursor: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasLoadedMore: boolean;
};

const DEFAULT_LIMIT = 12;

function getItemKey(item: DiscoveryItem) {
  return `${item.type}:${item.id}`;
}

function mergeHead(
  headItems: DiscoveryItem[],
  existingItems: DiscoveryItem[],
) {
  const headKeys = new Set(headItems.map(getItemKey));
  const tailItems = existingItems.filter(
    (item) => !headKeys.has(getItemKey(item)),
  );
  return [...headItems, ...tailItems];
}

function mergeUnique(
  existingItems: DiscoveryItem[],
  newItems: DiscoveryItem[],
) {
  const seen = new Set(existingItems.map(getItemKey));
  const filtered = newItems.filter(
    (item) => !seen.has(getItemKey(item)),
  );
  return [...existingItems, ...filtered];
}

export function useDiscovery(params: {
  tab: DiscoveryTab;
  query: string;
  limit?: number;
}) {
  const limit = params.limit ?? DEFAULT_LIMIT;
  const normalizedQuery = params.query.trim();
  const effectiveQuery = normalizedQuery.length < 2 ? "" : normalizedQuery;
  const cacheKey = getCacheKey({
    tab: params.tab,
    query: effectiveQuery,
    limit,
  });

  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<DiscoveryState>(() => {
    const cached = getCacheEntry(cacheKey);
    if (cached) {
      return {
        items: cached.items,
        nextCursor: cached.nextCursor,
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        error: null,
        hasLoadedMore: cached.hasLoadedMore,
      };
    }
    return {
      items: [],
      nextCursor: null,
      isLoading: true,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      hasLoadedMore: false,
    };
  });

  const updateCache = useCallback(
    (items: DiscoveryItem[], nextCursor: string | null, hasLoadedMore: boolean) => {
      setCacheEntry(cacheKey, {
        items,
        nextCursor,
        lastFetchedAt: Date.now(),
        hasLoadedMore,
      });
    },
    [cacheKey],
  );

  const revalidate = useCallback(async () => {
    const existingInFlight = getInFlight(cacheKey);
    if (existingInFlight) {
      return existingInFlight;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({
      ...prev,
      isLoading: prev.items.length === 0,
      isRefreshing: prev.items.length > 0,
      error: null,
    }));

    const promise = fetchDiscovery<DiscoveryItem>({
      tab: params.tab,
      query: effectiveQuery,
      limit,
      signal: controller.signal,
    })
      .then((response) => {
        setState((prev) => {
          const mergedItems = mergeHead(response.items, prev.items);
          const nextCursor = prev.hasLoadedMore
            ? prev.nextCursor
            : response.nextCursor;
          updateCache(mergedItems, nextCursor, prev.hasLoadedMore);
          return {
            ...prev,
            items: mergedItems,
            nextCursor,
            isLoading: false,
            isRefreshing: false,
            error: null,
          };
        });

        return {
          items: response.items,
          nextCursor: response.nextCursor,
          lastFetchedAt: Date.now(),
          hasLoadedMore: false,
        };
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return Promise.reject(error);
        }
        console.error("Discovery revalidate failed", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: "Unable to load discovery content.",
        }));
        return Promise.reject(error);
      })
      .finally(() => {
        clearInFlight(cacheKey);
      });

    setInFlight(cacheKey, promise);
    return promise;
  }, [cacheKey, params.tab, effectiveQuery, limit, updateCache]);

  const loadMore = useCallback(async () => {
    if (!state.nextCursor || state.isLoadingMore) return;

    setState((prev) => ({
      ...prev,
      isLoadingMore: true,
      error: null,
    }));

    try {
      const response = await fetchDiscovery<DiscoveryItem>({
        tab: params.tab,
        query: effectiveQuery,
        limit,
        cursor: state.nextCursor,
      });

      setState((prev) => {
        const mergedItems = mergeUnique(prev.items, response.items);
        const nextCursor = response.nextCursor;
        updateCache(mergedItems, nextCursor, true);
        return {
          ...prev,
          items: mergedItems,
          nextCursor,
          isLoadingMore: false,
          hasLoadedMore: true,
        };
      });
    } catch (error) {
      console.error("Discovery load more failed", error);
      setState((prev) => ({
        ...prev,
        isLoadingMore: false,
        error: "Unable to load more results.",
      }));
    }
  }, [params.tab, effectiveQuery, limit, state.nextCursor, state.isLoadingMore, updateCache]);

  useEffect(() => {
    const cached = getCacheEntry(cacheKey);
    if (cached) {
      setState({
        items: cached.items,
        nextCursor: cached.nextCursor,
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        error: null,
        hasLoadedMore: cached.hasLoadedMore,
      });
      if (isStale(cached)) {
        revalidate();
      }
    } else {
      setState({
        items: [],
        nextCursor: null,
        isLoading: true,
        isRefreshing: false,
        isLoadingMore: false,
        error: null,
        hasLoadedMore: false,
      });
      revalidate();
    }

    return () => {
      abortRef.current?.abort();
    };
  }, [cacheKey, revalidate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      revalidate();
    }, getCacheTtlMs());
    return () => window.clearInterval(interval);
  }, [revalidate]);

  useEffect(() => {
    const handleFocus = () => {
      const cached = getCacheEntry(cacheKey);
      if (cached && isStale(cached)) {
        revalidate();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [cacheKey, revalidate]);

  return {
    items: state.items,
    nextCursor: state.nextCursor,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    isLoadingMore: state.isLoadingMore,
    error: state.error,
    loadMore,
    refresh: revalidate,
  };
}
