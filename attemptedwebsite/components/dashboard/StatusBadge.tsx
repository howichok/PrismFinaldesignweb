import { cn } from "@/lib/cn";

type StatusValue =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED";

type StatusBadgeProps = {
  status: StatusValue;
  className?: string;
};

const statusStyles: Record<StatusValue, string> = {
  DRAFT: "border-slate-200 text-slate-600 bg-slate-50/70",
  PENDING: "border-amber-200 text-amber-700 bg-amber-50/70",
  APPROVED: "border-green-200 text-green-700 bg-green-50/70",
  REJECTED: "border-red-200 text-red-700 bg-red-50/70",
  PUBLISHED: "border-green-200 text-green-700 bg-green-50/70",
};

const statusLabels: Record<StatusValue, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PUBLISHED: "Published",
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        statusStyles[status],
        className,
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
