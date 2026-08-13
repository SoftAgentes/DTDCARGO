"use client";

/**
 * El control que mueve un lead de etapa (Fase 4 · SDD-0256).
 *
 * Vive acá y no dentro de la tabla porque lo usan las DOS vistas: la fila del
 * worklist (Asesor) y la tarjeta del Tablero. Tenerlo en un solo lugar es lo que
 * evita que una vista quede operable y la otra no — que fue exactamente lo que
 * pasó: el kanban se quedó de sólo lectura y el asesor clickeaba una tarjeta que
 * no hacía nada.
 *
 * Mientras la orden viaja, el control muestra "En camino": el ERP nunca escribe
 * el espejo (guardrail 0107), así que hasta que Kommo re-espeje por webhook la
 * pantalla sigue diciendo la etapa vieja. Sin ese aviso el asesor cree que el
 * clic no hizo nada y vuelve a clickear.
 *
 * ⚠️ `stages` tiene que venir de `stageTargets()` (en `kommo-types`): Kommo
 * devuelve `400 NotSupportedChoice` si se intenta mover un lead HACIA la
 * bandeja de entrada (`type === 1`), que la gobierna `unsorted`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import type { KommoStatusRow } from "@/lib/studio/kommo-types";
import { moveLeadStageAction } from "../actions";

export function StageControl({
  leadId,
  etapa,
  stages,
  enCamino,
  variant = "chip",
  onDone,
}: {
  leadId: number;
  /** Nombre de la etapa actual. Sólo lo pinta la variante `chip`. */
  etapa?: string;
  stages: KommoStatusRow[];
  enCamino: boolean;
  /**
   * `chip` = la celda Etapa de la tabla (el nombre ES el botón).
   * `card` = la tarjeta del kanban, donde la etapa ya la dice la columna.
   */
  variant?: "chip" | "card";
  /**
   * Quién reporta el resultado. Si no viene, el control se reporta a sí mismo y
   * refresca solo — que es el caso del Tablero, que no tiene barra de avisos.
   */
  onDone?: (msg: string, error?: boolean) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ msg: string; error: boolean } | null>(null);

  if (enCamino) {
    return (
      <Badge tone="info" size="sm" dot>
        En camino
      </Badge>
    );
  }

  // Sólo se llena cuando nadie más escucha (Tablero); en la tabla lo pinta la
  // barra de avisos de arriba.
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

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Mover de etapa"
        className="studio-link-quiet"
        style={{
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          font: variant === "card" ? "600 11px/1.2 var(--f-sans)" : "inherit",
          color: variant === "card" ? "var(--ink-soft)" : undefined,
        }}
      >
        {variant === "card" ? (
          <>Mover de etapa →</>
        ) : (
          <Badge tone="neutral" size="sm">
            {etapa}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <select
      className="studio-input"
      style={{
        font: "500 12px/1 var(--f-sans)",
        padding: "4px 6px",
        maxWidth: variant === "card" ? "100%" : 170,
        width: variant === "card" ? "100%" : undefined,
      }}
      autoFocus
      disabled={enviando}
      defaultValue=""
      onBlur={() => setAbierto(false)}
      onChange={async (e) => {
        const statusId = Number(e.target.value);
        if (!Number.isFinite(statusId) || statusId <= 0) return;
        setEnviando(true);
        const res = await moveLeadStageAction(leadId, statusId);
        setEnviando(false);
        setAbierto(false);
        const msg = res.error ?? "Etapa en camino al CRM";
        const error = Boolean(res.error);
        if (onDone) {
          onDone(msg, error);
          return;
        }
        setAviso({ msg, error });
        startTransition(() => router.refresh());
      }}
    >
      <option value="" disabled>
        Mover a…
      </option>
      {stages.map((s) => (
        <option key={s.id} value={String(s.id)}>
          {s.name ?? `#${s.id}`}
        </option>
      ))}
    </select>
  );
}
