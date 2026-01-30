import { cn } from "@/lib/cn";

type TicketStatus = "OPEN" | "ANSWERED" | "CLOSED";

type TicketStatusBadgeProps = {
  status: TicketStatus;
  className?: string;
};

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "border-emerald-200 text-emerald-700 bg-emerald-50/70",
  ANSWERED: "border-sky-200 text-sky-700 bg-sky-50/70",
  CLOSED: "border-slate-200 text-slate-600 bg-slate-50/70",
};

const statusLabels: Record<TicketStatus, string> = {
  OPEN: "Open",
  ANSWERED: "Answered",
  CLOSED: "Closed",
};

export default function TicketStatusBadge({
  status,
  className,
}: TicketStatusBadgeProps) {
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
