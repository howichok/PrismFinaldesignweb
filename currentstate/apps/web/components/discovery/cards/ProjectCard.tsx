import Link from "next/link";

import Card from "@/components/ui/Card";
import { formatDate, formatProjectStatus } from "@/lib/discovery/format";
import type { ProjectItem } from "@/lib/discovery/types";
import { cn } from "@/lib/cn";

type ProjectCardProps = {
  item: ProjectItem;
  showTypeBadge?: boolean;
};

const statusStyles: Record<ProjectItem["projectStatus"], string> = {
  IN_PROGRESS: "border-[color:var(--color-line)] text-[color:var(--color-muted)]",
  RELEASED: "border-green-200 text-green-700 bg-green-50/60",
  FROZEN: "border-blue-200 text-blue-700 bg-blue-50/60",
};

export default function ProjectCard({ item, showTypeBadge }: ProjectCardProps) {
  const dateLabel = formatDate(item.publishedAt ?? item.updatedAt);

  return (
    <Link href={`/project/${item.id}`} className="group">
      <Card className="flex h-full flex-col gap-3 transition-colors group-hover:border-[color:var(--color-brand)]">
        <div className="flex items-center justify-between">
          {showTypeBadge ? (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              Project
            </span>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              {item.ownerDisplay}
            </span>
          )}
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              statusStyles[item.projectStatus],
            )}
          >
            {formatProjectStatus(item.projectStatus)}
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{item.name}</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            {item.excerpt}
          </p>
        </div>
        <div className="mt-auto text-xs text-[color:var(--color-muted)]">
          {showTypeBadge ? item.ownerDisplay : dateLabel}{" "}
          {showTypeBadge ? `· ${dateLabel}` : null}
        </div>
      </Card>
    </Link>
  );
}
