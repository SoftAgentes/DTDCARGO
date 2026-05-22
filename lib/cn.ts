import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Helper para combinar clases Tailwind sin colisiones.
 * Uso: `cn("p-4", isActive && "bg-wine", className)`
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
