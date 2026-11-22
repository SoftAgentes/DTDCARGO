"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EVENTO_ABRIR_GUIA, PARAM_GUIA, RUTA_INICIO } from "@/lib/portal/simple/eventos";

/**
 * SDD-0654 §6.2 · «Guía». En el inicio simple la abre al instante; desde otra
 * pantalla lleva al inicio con `?guia=1`, que la arranca al cargar. Lo usan la
 * barra superior (pantalla ancha) y el panel del selector (teléfono).
 */
export function BotonGuia({ className = "", onAbrir }: { className?: string; onAbrir?: () => void }) {
  const enInicio = (usePathname() ?? "") === RUTA_INICIO;
  return (
    <Link
      href={`${RUTA_INICIO}?${PARAM_GUIA}=1`}
      onClick={(e) => {
        onAbrir?.();
        if (!enInicio) return;
        e.preventDefault();
        window.dispatchEvent(new Event(EVENTO_ABRIR_GUIA));
      }}
      className={`min-h-[44px] items-center rounded-full border border-grey-200 px-3 text-[13px] font-bold text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
    >
      Guía
    </Link>
  );
}
