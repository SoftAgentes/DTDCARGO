"use client";

/**
 * SolicitudesTab — bandeja de onboarding (SDD-0113 Slice A): invitaciones activas
 * (link a copiar + revocar) + solicitudes de registro (aprobar/rechazar). El
 * detalle de revisión vive en RevisarSolicitudDrawer. Patrón de tabla a mano con
 * grid, igual al resto de NominaClient.
 */

import { useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  inviteStatusLabel,
  inviteStatusTone,
  type EmployeeInvite,
} from "@/lib/studio/nomina/invite-types";
import {
  registrationStatusLabel,
  registrationStatusTone,
  type EmployeeRegistration,
} from "@/lib/studio/nomina/registration-types";
import { revokeInviteAction } from "../actions";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

const INV_COLS = "minmax(160px,1.3fr) 110px 130px 150px";
const REG_COLS = "minmax(200px,1.4fr) minmax(160px,1fr) 110px 130px";

export function SolicitudesTab({
  invites,
  registrations,
  onNewInvite,
  onReview,
}: {
  invites: EmployeeInvite[];
  registrations: EmployeeRegistration[];
  onNewInvite: () => void;
  onReview: (r: EmployeeRegistration) => void;
}) {
  const activeInvites = invites.filter((i) => i.status === "activa");
  const pending = registrations.filter((r) => r.status === "pendiente");
  const reviewed = registrations.filter((r) => r.status !== "pendiente");

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s-4)",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {pending.length === 0
            ? "Sin solicitudes pendientes."
            : `${pending.length} solicitud${pending.length === 1 ? "" : "es"} por revisar`}
        </div>
        <button type="button" className="studio-btn studio-btn-primary" onClick={onNewInvite}>
          + Generar invitación
        </button>
      </div>

      {/* Solicitudes */}
      {registrations.length === 0 ? (
        <EmptyState
          eyebrow="Sin solicitudes"
          title="Aún no hay solicitudes de registro."
          description="Genera una invitación y compártela por WhatsApp. Cuando el candidato envíe sus datos, aparece acá para que lo apruebes (defines tú el sueldo) o lo rechaces."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={onNewInvite}>
              + Generar invitación
            </button>
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            marginBottom: "var(--s-6)",
          }}
        >
          <TableHeader cols={REG_COLS}>
            <span>Candidato · Cédula</span>
            <span>Correo</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </TableHeader>
          {[...pending, ...reviewed].map((r, i) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: REG_COLS,
                gap: 12,
                padding: "var(--s-3) var(--s-5)",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid var(--border)",
                opacity: r.status === "rechazada" ? 0.6 : 1,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.full_name}
                </div>
                <div style={{ font: "600 11px/1.3 var(--f-mono)", color: "var(--ink-soft)" }}>
                  {r.national_id}
                </div>
              </div>
              <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.email}
              </span>
              <Badge tone={registrationStatusTone(r.status)} size="sm">
                {registrationStatusLabel(r.status)}
              </Badge>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                {r.status === "pendiente" && (
                  <button type="button" onClick={() => onReview(r)} className="studio-btn studio-btn-primary studio-btn-sm" style={{ padding: "6px 12px" }}>
                    Revisar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invitaciones activas */}
      <h2 className="studio-display" style={{ fontSize: 16, margin: "0 0 var(--s-3)", color: "var(--ink)" }}>
        Invitaciones activas
      </h2>
      {activeInvites.length === 0 ? (
        <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          No hay invitaciones activas. Genera una para que un candidato se registre.
        </p>
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <TableHeader cols={INV_COLS}>
            <span>Cargo · Área</span>
            <span>Estado</span>
            <span>Vence</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </TableHeader>
          {activeInvites.map((inv, i) => (
            <InviteRow key={inv.id} inv={inv} first={i === 0} />
          ))}
        </div>
      )}
    </>
  );
}

function InviteRow({ inv, first }: { inv: EmployeeInvite; first: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}/m/emp/registro?inv=${inv.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sin clipboard */
    }
  };

  const revoke = () => {
    startTransition(async () => {
      await revokeInviteAction(inv.id);
    });
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: INV_COLS,
        gap: 12,
        padding: "var(--s-3) var(--s-5)",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
          {inv.cargo ?? "Sin cargo sugerido"}
        </div>
        <div style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
          {inv.department ?? "—"}
        </div>
      </div>
      <Badge tone={inviteStatusTone(inv.status)} size="sm">
        {inviteStatusLabel(inv.status)}
      </Badge>
      <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
        {fmtDate(inv.expires_at)}
      </span>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        <button type="button" onClick={copy} className="studio-btn studio-btn-ghost studio-btn-sm" style={{ padding: "6px 10px" }}>
          {copied ? "Copiado" : "Copiar link"}
        </button>
        <button type="button" onClick={revoke} disabled={isPending} className="studio-btn studio-btn-ghost studio-btn-sm" style={{ padding: "6px 10px" }}>
          {isPending ? "…" : "Revocar"}
        </button>
      </div>
    </div>
  );
}

function TableHeader({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 12,
        padding: "10px 20px",
        font: "700 9.5px/1 var(--f-sans)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
      }}
    >
      {children}
    </div>
  );
}
