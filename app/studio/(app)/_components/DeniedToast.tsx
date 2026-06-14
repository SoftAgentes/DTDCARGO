"use client";

/**
 * DeniedToast — aviso cuando el RBAC redirige por falta de acceso (SDD-0085).
 *
 * `requireModuleView` redirige a `/studio/dashboard?denied=<id>` cuando un rol
 * entra por URL a un módulo que no puede ver. Sin esto el usuario aterrizaría
 * en el dashboard sin explicación (teleport silencioso). Lee el param una vez y
 * dispara un toast warning. Montado en el layout (cubre cualquier landing).
 *
 * Copy literal es-VE (TUTEO), igual que el resto de toasts del Studio. No se
 * nombra el módulo por su id crudo (sería jerga interna).
 */

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

export function DeniedToast() {
  const denied = useSearchParams().get("denied");
  const toast = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (denied && !fired.current) {
      fired.current = true;
      toast.warning(
        "No tienes acceso a ese módulo. Si lo necesitas, pídele acceso a un administrador.",
      );
    }
  }, [denied, toast]);

  return null;
}
