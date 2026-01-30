import type { ComponentPropsWithoutRef } from "react";
import Image from "next/image";

import { cn } from "@/lib/cn";

type AvatarSize = "sm" | "md" | "lg";

type AvatarProps = ComponentPropsWithoutRef<"div"> & {
  label?: string;
  size?: AvatarSize;
  src?: string | null;
};

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

const pixelSizes: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
};

function getInitials(label?: string) {
  if (!label) return "PM";
  const parts = label.trim().split(/\s+/);
  const initials = parts
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "PM";
}

export default function Avatar({
  className,
  label,
  size = "md",
  src,
  ...props
}: AvatarProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink)] shadow-[var(--shadow-soft)]",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <Image
          src={src}
          alt={label ?? "User avatar"}
          width={pixelSizes[size]}
          height={pixelSizes[size]}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-semibold">{getInitials(label)}</span>
      )}
    </div>
  );
}
