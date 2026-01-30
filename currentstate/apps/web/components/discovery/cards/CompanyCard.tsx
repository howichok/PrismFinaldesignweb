import Link from "next/link";

import Card from "@/components/ui/Card";
import type { CompanyItem } from "@/lib/discovery/types";

type CompanyCardProps = {
  item: CompanyItem;
  showTypeBadge?: boolean;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function CompanyCard({
  item,
  showTypeBadge,
}: CompanyCardProps) {
  const categories = item.categories.slice(0, 3);
  const initials = getInitials(item.name);
  const logoStyle = item.logoUrl
    ? {
        backgroundImage: `url(${item.logoUrl})`,
      }
    : undefined;

  return (
    <Link href={`/company/${item.id}`} className="group">
      <Card className="flex h-full flex-col gap-4 transition-colors group-hover:border-[color:var(--color-brand)]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--color-line)] bg-white bg-cover bg-center text-xs font-semibold text-[color:var(--color-ink)]"
            style={logoStyle}
            aria-label={item.name}
          >
            {item.logoUrl ? null : initials}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{item.name}</h3>
            {showTypeBadge ? (
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                Company
              </span>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-[color:var(--color-muted)]">
          {item.excerpt}
        </p>
        {categories.length ? (
          <div className="mt-auto flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            {categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-[color:var(--color-line)] px-2 py-1"
              >
                {category}
              </span>
            ))}
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
