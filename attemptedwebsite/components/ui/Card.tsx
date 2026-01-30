import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

type CardProps = ComponentPropsWithoutRef<"div">;

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "card",
          className,
        )}
        {...props}
      />
    );
  },
);

Card.displayName = "Card";

export default Card;
