"use client";

/**
 * El botón que abre el drawer del lead (SDD-0256 · Fases 4 y 5).
 *
 * Vive acá y no dentro de cada vista por el mismo motivo que `StageControl`: lo
 * usan LAS DOS —la fila del worklist (Asesor) y la tarjeta del Tablero— y el
 * Tablero es un server component, que no puede sostener el estado de un drawer.
 * Encapsular botón + drawer en un componente client hace que las dos vistas lo
 * monten igual, y evita que una quede operable y la otra no. Ése error ya pasó
 * una vez con el verbo de etapa y el diagnóstico fue "el ERP no escribe al CRM".
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import type { OwnerSlice } from "@/lib/studio/kommo-analytics";
import type { StaleOp } from "@/lib/studio/kommo-writeback";
import { LeadDrawer } from "./LeadDrawer";

export function LeadActionsButton({
  lead,
  asesores,
  staleOps = [],
  canEdit,
  variant = "row",
  onDone,
}: {
  lead: { id: number; name: string; ownerId: number | null };
  asesores: OwnerSlice[];
  /** Órdenes de este lead que el chequeo optimista frenó (A1). */
  staleOps?: StaleOp[];
  /**
   * Del MISMO predicado que aplica la acción (`moduleEditDenial`) — nunca una
   * regla propia por rol. Es cosmético: el candado real está en el servidor.
   */
  canEdit: boolean;
  /** `row` = fila de la tabla · `card` = tarjeta del kanban. */
  variant?: "row" | "card";
  /** Quién reporta. Sin esto el control se refresca solo (caso del Tablero). */
  onDone?: (msg: string, error?: boolean) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<{ msg: string; error: boolean } | null>(null);

  // Sin permiso de edición no se ofrece el verbo. Mostrarlo y que después el
  // servidor diga que no enseña que la pantalla no sirve.
  if (!canEdit) return null;

  const reportar = (msg: string, error?: boolean) => {
    if (onDone) {
      onDone(msg, error);
      return;
    }
    setAviso({ msg, error: Boolean(error) });
    startTransition(() => router.refresh());
  };

  if (aviso) {
    return (
      <span
        role="status"
        style={{
          font: "600 11px/1.3 var(--f-sans)",
          color: aviso.error ? "var(--danger)" : "var(--ink-soft)",
        }}
      >
        {aviso.msg}
      </span>
    );
  }

  const frenadas = staleOps.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Asesor, etiquetas, nota y tarea"
        className={variant === "card" ? "studio-link-quiet" : "studio-btn studio-btn-ghost studio-btn-sm"}
        style={
          variant === "card"
            ? {
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
                font: "600 11px/1.2 var(--f-sans)",
                color: "var(--ink-soft)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }
            : { display: "inline-flex", alignItems: "center", gap: 6 }
        }
      >
        {variant === "card" ? "Acciones →" : "Acciones"}
        {frenadas > 0 && (
          // El aviso viaja hasta la fila: si sólo viviera dentro del drawer,
          // habría que abrirlo lead por lead para enterarse de que algo no se
          // mandó — o sea, no se enteraría nadie.
          <Badge tone="warning" size="sm">
            {frenadas === 1 ? "1 frenada" : `${frenadas} frenadas`}
          </Badge>
        )}
      </button>

      {abierto && (
        <LeadDrawer
          lead={lead}
          asesores={asesores}
          staleOps={staleOps}
          onClose={() => setAbierto(false)}
          onDone={reportar}
        />
      )}
    </>
  );
}
