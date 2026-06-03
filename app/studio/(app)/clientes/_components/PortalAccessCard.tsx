"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import type { ClientPortalAccess } from "@/lib/studio/client-queries";
import {
  approvePortalAction,
  invitePortalAction,
  revokePortalAction,
} from "../actions";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Acceso al Portal del Cliente (SDD-0042) — en el detalle del cliente.
 * Habilita/revoca el portal. El cliente luego entra solo en /portal/login con
 * su email (magic-link). Read-only de cara al cliente.
 */
export function PortalAccessCard({
  clientId,
  markbox,
  email,
  access,
  approvedAt,
}: {
  clientId: string;
  markbox: string;
  email: string | null;
  access: ClientPortalAccess | null;
  /** clients.portal_approved_at — null = pendiente de revisión (SDD-0042 Fase 5). */
  approvedAt?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const approved = approvedAt != null;

  const status = access?.status ?? null;
  const tone =
    status === "active" ? "success" : status === "invited" ? "info" : "neutral";
  const label =
    status === "active"
      ? "Activo"
      : status === "invited"
        ? "Invitado"
        : status === "revoked"
          ? "Revocado"
          : "Sin habilitar";

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
        <span className="studio-eyebrow">Acceso al portal</span>
        <Badge tone={tone} size="md">
          {label}
        </Badge>
      </div>

      {!email ? (
        <p style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Agregá un email al cliente para poder habilitar su acceso al portal.
        </p>
      ) : (
        <>
          <p
            style={{
              font: "500 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "0 0 14px",
            }}
          >
            {status === null && (
              <>
                Todavía no tiene acceso. Al invitarlo, podrá entrar en{" "}
                <b style={{ color: "var(--ink)" }}>/portal</b> con{" "}
                <b style={{ color: "var(--ink)" }}>{email}</b> y ver sus envíos.
              </>
            )}
            {status === "invited" && (
              <>
                Invitado el {fmt(access!.invitedAt)}. Esperando el primer ingreso
                con <b style={{ color: "var(--ink)" }}>{email}</b>.
              </>
            )}
            {status === "active" && (
              <>
                Activo. Último ingreso: {fmt(access!.lastLoginAt)}. Acceso de solo
                lectura a sus envíos.
              </>
            )}
            {status === "revoked" && (
              <>Acceso revocado. Podés volver a invitarlo cuando quieras.</>
            )}
          </p>

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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {status === null || status === "revoked" ? (
              <ActionButton
                variant="primary"
                size="sm"
                idleLabel={status === "revoked" ? "Volver a invitar" : "Invitar al portal"}
                loadingLabel="Habilitando…"
                successLabel="Portal habilitado"
                onAction={async () => {
                  setError(null);
                  return invitePortalAction(clientId, markbox);
                }}
                onSuccess={() => router.refresh()}
                onError={setError}
              />
            ) : (
              <ActionButton
                variant="danger"
                size="sm"
                idleLabel="Revocar acceso"
                loadingLabel="Revocando…"
                successLabel="Acceso revocado"
                onAction={async () => {
                  setError(null);
                  return revokePortalAction(clientId, markbox);
                }}
                onSuccess={() => router.refresh()}
                onError={setError}
              />
            )}
          </div>

          {/* ── Activación del dashboard (SDD-0042 Fase 5 · gate) ── */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span className="studio-eyebrow">Dashboard del cliente</span>
              <Badge tone={approved ? "success" : "warning"} size="md">
                {approved ? "Aprobada" : "Pendiente"}
              </Badge>
            </div>
            <p
              style={{
                font: "500 12.5px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "0 0 12px",
              }}
            >
              {approved ? (
                <>
                  Aprobada el {fmt(approvedAt!)}. Ve su dashboard completo (envíos,
                  KPIs, saldo) al entrar al portal.
                </>
              ) : (
                <>
                  Hasta aprobarla, el cliente entra al portal pero ve una pantalla
                  de espera. También se desbloquea sola con su{" "}
                  <b style={{ color: "var(--ink)" }}>primera carga</b>.
                </>
              )}
            </p>
            {!approved && (
              <ActionButton
                variant="dark"
                size="sm"
                idleLabel="Aprobar cuenta"
                loadingLabel="Aprobando…"
                successLabel="Cuenta aprobada"
                onAction={async () => {
                  setError(null);
                  return approvePortalAction(clientId, markbox);
                }}
                onSuccess={() => router.refresh()}
                onError={setError}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
