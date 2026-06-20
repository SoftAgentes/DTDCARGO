"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/Icon";

/**
 * Sección plegable del hub de Finanzas (founder 2026-06-20). El contenido lo
 * renderiza el server (page.tsx) y se pasa como `children`; este componente solo
 * maneja el abrir/cerrar. Cada sección abre/cierra independiente (Facturas nace
 * abierta por `defaultOpen`). El `summary` se ve siempre (abierto o cerrado) para
 * que el cliente vea de un vistazo lo importante (ej. su saldo) sin desplegar.
 */
export function FinanzaSection({
  title,
  icon,
  summary,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  summary?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-shadow-static bg-white border border-grey-200 rounded-[18px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-4 text-left hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset"
      >
        <div className="w-10 h-10 rounded-[12px] bg-paper grid place-items-center text-wine flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-ink">{title}</span>
            {badge}
          </div>
          {summary && (
            <div className="mt-0.5 text-[12.5px] text-grey-500 leading-[1.4]">
              {summary}
            </div>
          )}
        </div>
        <ChevronDownIcon
          size={18}
          className={`flex-shrink-0 text-grey-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-5 sm:px-6 pb-6 pt-4 border-t border-grey-200">
          {children}
        </div>
      )}
    </div>
  );
}
