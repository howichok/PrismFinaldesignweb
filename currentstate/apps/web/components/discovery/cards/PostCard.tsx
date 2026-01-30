import Link from "next/link";

import Card from "@/components/ui/Card";
import { formatDate } from "@/lib/discovery/format";
import type { PostItem } from "@/lib/discovery/types";

type PostCardProps = {
  item: PostItem;
  showTypeBadge?: boolean;
};

export default function PostCard({ item, showTypeBadge }: PostCardProps) {
  const dateLabel = formatDate(item.publishedAt ?? item.updatedAt);

  return (
    <Link href={`/post/${item.id}`} className="group">
      <Card className="flex h-full flex-col gap-3 transition-colors group-hover:border-[color:var(--color-brand)]">
        {showTypeBadge ? (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Post
          </span>
        ) : null}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{item.title}</h3>
          <p className="text-sm text-[color:var(--color-muted)]">
            {item.excerpt}
          </p>
        </div>
        <div className="mt-auto text-xs text-[color:var(--color-muted)]">
          {item.ownerDisplay} · {dateLabel}
        </div>
      </Card>
    </Link>
  );
}
