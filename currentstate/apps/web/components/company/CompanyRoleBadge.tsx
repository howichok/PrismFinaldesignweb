import { cn } from "@/lib/cn";
import {
  companyRoleLabels,
  type CompanyRoleValue,
} from "@/lib/company/roles";

type CompanyRoleBadgeProps = {
  role: CompanyRoleValue;
  className?: string;
};

const roleStyles: Record<CompanyRoleValue, string> = {
  OWNER: "border-amber-200 text-amber-700 bg-amber-50/70",
  CO_OWNER: "border-orange-200 text-orange-700 bg-orange-50/70",
  TRUSTED: "border-blue-200 text-blue-700 bg-blue-50/70",
  MEMBER: "border-slate-200 text-slate-600 bg-slate-50/70",
};

export default function CompanyRoleBadge({
  role,
  className,
}: CompanyRoleBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        roleStyles[role],
        className,
      )}
    >
      {companyRoleLabels[role]}
    </span>
  );
}
