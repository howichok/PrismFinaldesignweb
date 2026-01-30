import * as React from "react";

import { cn } from "../lib/cn";

export type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  hoverable?: boolean;
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverable = true, ...props }, ref) => {
    // Базовые классы стеклянной карточки с токенами из Tailwind-пресета.
    const baseClasses =
      "rounded-glass border border-glass bg-glass shadow-glass backdrop-blur-glass";

    // Небольшое интерактивное поведение при наведении можно отключить.
    const hoverClasses = hoverable
      ? "transition-transform duration-300 ease-out hover:-translate-y-1 hover:shadow-glow"
      : undefined;

    return (
      <div ref={ref} className={cn(baseClasses, hoverClasses, className)} {...props} />
    );
  },
);

GlassCard.displayName = "GlassCard";

