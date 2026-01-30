"use client";

import { useEffect, useRef, useState } from "react";

import Avatar from "@/components/ui/Avatar";
import MiniProfilePopover from "@/components/users/MiniProfilePopover";

type UserChipProps = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  viewerId?: string | null;
  size?: "sm" | "md";
  className?: string;
};

export default function UserChip({
  userId,
  displayName,
  avatarUrl,
  viewerId,
  size = "sm",
  className,
}: UserChipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-line)] bg-white/80 px-2 py-1 text-xs font-semibold text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] transition-colors hover:border-[color:var(--color-brand)]"
      >
        <Avatar
          size={size}
          label={displayName}
          src={avatarUrl ?? undefined}
        />
        <span className="truncate">{displayName}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2">
          <MiniProfilePopover
            userId={userId}
            viewerId={viewerId}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
