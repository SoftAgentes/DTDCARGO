/**
 * Breadcrumb dinámico del Studio (mostrado en la topbar).
 *
 * Reemplaza el "DTD Studio" estático que era redundante con la sidebar.
 * Muestra título de la página actual basado en el pathname.
 */

"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/studio/resumen": "Resumen",
  "/studio/tracking": "Tracking",
  "/studio/tracking/nuevo": "Tracking · Nuevo envío",
  "/studio/ajustes": "Ajustes",
};

export function Breadcrumb() {
  const pathname = usePathname() ?? "";
  const title = TITLES[pathname] ?? "Studio";

  return (
    <div
      style={{
        font: "700 11px/1 Archivo, sans-serif",
        color: "#6B6B6B",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      DoorTuDoor <span style={{ color: "#C9C5BE" }}>/</span>{" "}
      <span style={{ color: "#0F1E3D" }}>{title}</span>
    </div>
  );
}
