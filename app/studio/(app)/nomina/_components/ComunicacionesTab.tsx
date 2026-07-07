"use client";

/**
 * ComunicacionesTab — RRHH ve las comunicaciones enviadas a los empleados y su
 * estado de acuse (SDD-0113 Slice B). Botón "Enviar comunicación" abre el drawer.
 * El valor legal-light: rastro de quién leyó/confirmó y cuándo.
 */

import { useState } from "react";
import type { Employee } from "@/lib/studio/nomina/employee-types";
import {
  commTypeLabel,
  commTypeTone,
  commNeedsAck,
  type EmployeeComm,
} from "@/lib/studio/nomina/comms-types";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { EnviarComunicacionDrawer } from "./EnviarComunicacionDrawer";

function fmtDate(s: string | null): string {
  return s ? new Date(s).toLocaleString("es-VE") : "—";
}

export function ComunicacionesTab({
  comms,
  employees,
}: {
  comms: EmployeeComm[];
  employees: Employee[];
}) {
  const [open, setOpen] = useState(false);
  const nameById = new Map(employees.map((e) => [e.id, `${e.full_name} · ${e.employee_code}`]));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--s-4)" }}>
        <button type="button" className="studio-btn studio-btn-primary" onClick={() => setOpen(true)}>
          Enviar comunicación
        </button>
      </div>

      {comms.length === 0 ? (
        <EmptyState
          title="Sin comunicaciones"
          description="Envía recibos, avisos, llamados de atención o amonestaciones a tus empleados."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {comms.map((c) => (
            <div
              key={c.id}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "12px 14px",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                  <Badge tone={commTypeTone(c.type)}>{commTypeLabel(c.type)}</Badge>
                  <span style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{c.title}</span>
                </div>
                <div style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {nameById.get(c.employee_id) ?? c.employee_id}
                </div>
              </div>
              <div style={{ textAlign: "right", font: "400 11px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
                <div>Leído: {fmtDate(c.read_at)}</div>
                {c.requires_ack ? (
                  c.acked_at ? (
                    <div style={{ color: "var(--success)", fontWeight: 600 }}>Confirmado: {fmtDate(c.acked_at)}</div>
                  ) : (
                    <div style={{ color: "var(--warning)", fontWeight: 600 }}>Sin confirmar</div>
                  )
                ) : (
                  <div>No requiere acuse</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <EnviarComunicacionDrawer employees={employees} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
