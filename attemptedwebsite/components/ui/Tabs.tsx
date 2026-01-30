"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

type TabsProps = {
  items: string[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
};

export default function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? items[0] ?? "",
  );
  const activeValue = value ?? internalValue;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-full border border-[color:var(--color-line)] bg-white/70 p-1 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item === activeValue;
        return (
          <button
            key={item}
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
              isActive
                ? "bg-[color:var(--color-brand)] text-white shadow-[var(--shadow-soft)]"
                : "text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]",
            )}
            onClick={() => {
              setInternalValue(item);
              onChange?.(item);
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
