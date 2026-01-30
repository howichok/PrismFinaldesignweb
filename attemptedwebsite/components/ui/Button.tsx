import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "outline" | "ghost" | "soft";
type ButtonSize = "sm" | "md" | "lg";

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleProps) {
  // Map internal variant names to legacy CSS modifier classes
  const variants: Record<ButtonVariant, string> = {
    primary: "btn--primary",
    outline: "btn--outline",
    ghost: "btn--ghost",
    soft: "btn--ghost", // Mapping soft to ghost as closest match
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "btn--sm",
    md: "", // Default size
    lg: "btn--lg",
  };

  return cn("btn", variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyleProps;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonStyles({ variant, size, className })}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export default Button;
