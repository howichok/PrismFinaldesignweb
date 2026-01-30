"use client";

import AllCard from "@/components/discovery/cards/AllCard";
import CompanyCard from "@/components/discovery/cards/CompanyCard";
import PostCard from "@/components/discovery/cards/PostCard";
import ProjectCard from "@/components/discovery/cards/ProjectCard";
import Card from "@/components/ui/Card";
import type { DiscoveryItem, DiscoveryTab } from "@/lib/discovery/types";

type DiscoveryGridProps = {
  tab: DiscoveryTab;
  items: DiscoveryItem[];
  isLoading: boolean;
};

function SkeletonCard() {
  return (
    <Card className="h-44 animate-pulse bg-white/60">
      <div className="h-4 w-2/3 rounded-full bg-black/10" />
      <div className="mt-4 h-3 w-full rounded-full bg-black/10" />
      <div className="mt-2 h-3 w-5/6 rounded-full bg-black/10" />
    </Card>
  );
}

export default function DiscoveryGrid({
  tab,
  items,
  isLoading,
}: DiscoveryGridProps) {
  if (isLoading && items.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={`skeleton-${index}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        if (tab === "all") {
          return <AllCard key={`${item.type}-${item.id}`} item={item} />;
        }
        if (item.type === "post") {
          return <PostCard key={item.id} item={item} />;
        }
        if (item.type === "project") {
          return <ProjectCard key={item.id} item={item} />;
        }
        return <CompanyCard key={item.id} item={item} />;
      })}
    </div>
  );
}
