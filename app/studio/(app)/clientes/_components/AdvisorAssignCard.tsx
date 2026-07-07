"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { roleLabel } from "@/lib/studio/user-types";
import type { TenantAdvisorOption } from "@/lib/studio/user-types";
import { assignAdvisorAction } from "../actions";

/** Iniciales (máx 2) del nombre del asesor; "?" si no hay nombre cargado. */
function advisorInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** Etiqueta de una opción del selector: nombre real o "Sin nombre · Rol". */
function advisorOptionLabel(a: TenantAdvisorOption): string {
  if (a.name) return a.name;
  return `Sin nombre · ${roleLabel(a.role)}`;
}

/**
 * Asesor asignado del cliente (ERP→Norte · clients.advisor_id). El portal lo
 * muestra como "Tu asesor" en /portal/mensajes y rutea su contacto. Sin asignar →
 * el portal degrada al contacto público (CRM). Asigna/desasigna entre los miembros
 * activos del tenant.
 */
export function AdvisorAssignCard({
  clientId,
  markbox,
  currentAdvisorId,
  advisors,
}: {
  clientId: string;
  markbox: string;
  currentAdvisorId: string | null;
  advisors: TenantAdvisorOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(currentAdvisorId ?? "");

  const current = advisors.find((a) => a.userId === currentAdvisorId) ?? null;
  const assigned = current != null;
  const dirty = selected !== (currentAdvisorId ?? "");
  const selectedOption = advisors.find((a) => a.userId === selected) ?? null;

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span className="studio-eyebrow">Asesor asignado</span>
        <Badge tone={assigned ? "success" : "neutral"} size="md">
          {assigned ? "Asignado" : "Sin asignar"}
        </Badge>
      </div>

      {assigned && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <Avatar initials={advisorInitials(current!.name)} color="info" size={38} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                font: "600 14px/1.3 var(--f-sans)",
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {current!.name ?? `Sin nombre · ${roleLabel(current!.role)}`}
            </div>
            <div style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
              {current!.positionLabel ?? roleLabel(current!.role)}
            </div>
          </div>
        </div>
      )}

      <p
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 12px",
        }}
      >
        {assigned ? (
          <>
            El cliente ve a este asesor como{" "}
            <b style={{ color: "var(--ink)" }}>Tu asesor</b> en el portal y le
            escribe directo. Sin asignar, ve el contacto público.
          </>
        ) : (
          <>
            Asigna un asesor para que el cliente lo vea como{" "}
            <b style={{ color: "var(--ink)" }}>Tu asesor</b> en el portal. Sin
            asignar, ve el contacto público (CRM).
          </>
        )}
      </p>

      {advisors.length === 0 ? (
        <p style={{ font: "500 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          No hay miembros del equipo para asignar todavía.
        </p>
      ) : (
        <>
          <label
            htmlFor="advisor-select"
            className="studio-label"
            style={{ display: "block", marginBottom: 6 }}
          >
            Asesor
          </label>
          <select
            id="advisor-select"
            className="studio-input"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setError(null);
            }}
            style={{ width: "100%", marginBottom: 12 }}
          >
            <option value="">Sin asignar</option>
            {advisors.map((a) => (
              <option key={a.userId} value={a.userId}>
                {advisorOptionLabel(a)}
              </option>
            ))}
          </select>

          {error && (
            <p
              style={{
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: "0 0 10px",
              }}
            >
              {error}
            </p>
          )}

          <ActionButton
            variant="dark"
            size="sm"
            idleLabel={selected === "" ? "Quitar asesor" : "Guardar asesor"}
            loadingLabel="Guardando…"
            successLabel="Asesor actualizado"
            disabled={!dirty}
            onAction={async () => {
              setError(null);
              return assignAdvisorAction(clientId, markbox, selected || null);
            }}
            onSuccess={() => {
              toast.success(
                selected === ""
                  ? `Asesor quitado de ${markbox}`
                  : `${
                      selectedOption?.name ?? "Asesor"
                    } asignado a ${markbox}`,
              );
              router.refresh();
            }}
            onError={setError}
          />
        </>
      )}
    </section>
  );
}
