import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

type ContainerProps = ComponentPropsWithoutRef<"div">;

export default function Container({ className, ...props }: ContainerProps) {
  return (
    <div
      className={cn("container", className)}
      {...props}
    />
  );
}
