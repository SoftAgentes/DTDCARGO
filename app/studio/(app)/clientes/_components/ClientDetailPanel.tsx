"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";

/** La lista permanece montada; volver recupera su entrada de historial. */
export function ClientDetailPanel({ children, listadoHref = "/studio/clientes", title = "Ficha del cliente" }: { children: ReactNode; listadoHref?: string; title?: string }) {
  const router = useRouter();
  return (
    <DrawerShell title={title} onClose={() => router.back()} pending={false} width={1100} closeOnBackdrop={false}>
      <div style={{ overflow: "auto", minWidth: 0, padding: "var(--s-5)" }}>
        <a href={listadoHref} className="studio-btn studio-btn-ghost" style={{ minHeight: 44 }}
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            router.back();
          }}>Volver al listado</a>
        {children}
      </div>
    </DrawerShell>
  );
}
