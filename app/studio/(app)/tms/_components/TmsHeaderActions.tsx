"use client";

/**
 * TmsHeaderActions — botón contextual "+ Nuevo {entidad}" según tab activo.
 * Vive en el header de page.tsx para visibilidad cross-tab.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { parseTmsTab } from "@/lib/studio/tms-queries";

export function TmsHeaderActions() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const tab = parseTmsTab(params.get("tab"));

  // Incidents drawer diferido (SDD-0019.x) — botón disabled con tooltip
  // explícito en lugar de fantasma silencioso.
  const incidentsDisabled = tab === "incidents";

  const label =
    tab === "fleet"
      ? "Agregar camión"
      : tab === "drivers"
        ? "Agregar chofer"
        : tab === "incidents"
          ? "Registrar incidencia"
          : "Crear ruta";

  const viewName =
    tab === "fleet"
      ? "truck"
      : tab === "drivers"
        ? "driver"
        : tab === "incidents"
          ? "incident"
          : "route";

  const openCreate = () => {
    if (incidentsDisabled) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("view", viewName);
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  };

  return (
    <button
      type="button"
      className="studio-btn studio-btn-primary"
      onClick={openCreate}
      disabled={incidentsDisabled}
      title={
        incidentsDisabled
          ? "Registro de incidencias llega en SDD-0019.x"
          : undefined
      }
      style={incidentsDisabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
    >
      {label}
    </button>
  );
}
