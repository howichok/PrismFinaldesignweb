import type { DiscoveryItem } from "@/lib/discovery/types";
import CompanyCard from "@/components/discovery/cards/CompanyCard";
import PostCard from "@/components/discovery/cards/PostCard";
import ProjectCard from "@/components/discovery/cards/ProjectCard";

type AllCardProps = {
  item: DiscoveryItem;
};

export default function AllCard({ item }: AllCardProps) {
  if (item.type === "post") {
    return <PostCard item={item} showTypeBadge />;
  }
  if (item.type === "project") {
    return <ProjectCard item={item} showTypeBadge />;
  }
  return <CompanyCard item={item} showTypeBadge />;
}
