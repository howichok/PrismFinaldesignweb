import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Универсальное объединение классов с учётом конфликтов Tailwind.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

