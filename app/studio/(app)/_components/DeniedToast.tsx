"use client";

/**
 * DeniedToast — aviso cuando el servidor te rebota al dashboard (SDD-0085).
 *
 * Dos motivos distintos, dos avisos distintos:
 *
 *  - `?denied=<id>` · `requireModuleView` — tu ROL no puede ver ese módulo.
 *    El camino es pedirle acceso a un administrador.
 *  - `?off=<id>` · `requireFeatureEnabled` (SDD-0240) — el módulo está
 *    APAGADO para esta empresa. No es un permiso: un admin lo prende solo.
 *
 * Sin esto el usuario aterrizaría en el dashboard sin explicación (teleport
 * silencioso). Lee el param una vez y dispara un toast. Montado en el layout
 * (cubre cualquier landing).
 *
 * Copy literal es-VE (TUTEO), igual que el resto de toasts del Studio. No se
 * nombra el módulo por su id crudo (sería jerga interna).
 */

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

export function DeniedToast() {
  const params = useSearchParams();
  const denied = params.get("denied");
  const off = params.get("off");
  const toast = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (denied) {
      fired.current = true;
      toast.warning(
        "No tienes acceso a ese módulo. Si lo necesitas, pídele acceso a un administrador.",
      );
    } else if (off) {
      fired.current = true;
      toast.warning(
        "Ese módulo está desactivado para tu empresa. Un administrador puede encenderlo en Ajustes › Feature flags.",
      );
    }
  }, [denied, off, toast]);

  return null;
}
