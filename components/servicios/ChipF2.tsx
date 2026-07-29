import type { ReactNode } from "react";

/**
 * Chip del hero de una ficha de servicio (f2chip).
 * Handoff Cloud Design · Servicios · DTD-Cargo.html.
 *
 * - default: chip translúcido sobre navy.
 * - `on`: prepende un dot verde (servicio activo).
 * - `wine`: contorno/tinta wine-soft (para "Para empresas", "carga: 2 modalidades", …).
 */
export function ChipF2({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: "on" | "wine";
}) {
  const cls = ["f2chip", variant === "on" && "on", variant === "wine" && "wine"]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{children}</span>;
}
