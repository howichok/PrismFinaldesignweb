import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

type IconButtonSize = "sm" | "md" | "lg";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: IconButtonSize;
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-[color:var(--color-line)] bg-white/80 text-[color:var(--color-ink)] shadow-[var(--shadow-soft)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]",
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

IconButton.displayName = "IconButton";

export default IconButton;
