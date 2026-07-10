"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import type { ClientPortalAccess } from "@/lib/studio/client-queries";
import {
  approvePortalAction,
  invitePortalAction,
  portalAccessLinkAction,
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
 * Habilita/revoca el portal. La invitación por correo lleva un enlace DIRECTO (un
 * clic → adentro). Como ese enlace vence pronto (30 min), acá también se puede
 * "Compartir acceso por WhatsApp": genera un enlace fresco para mandarlo al
 * WhatsApp del cliente y coordinar en vivo (founder 2026-07-01).
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
  // Enlace wa.me armado tras generar el acceso; se revela como link (no window.open
  // para no chocar con el bloqueo de popups tras el await).
  const [waLink, setWaLink] = useState<string | null>(null);
  const approved = approvedAt != null;

  const status = access?.status ?? null;

  /** Genera un acceso fresco y arma el wa.me con el enlace listo para enviar. */
  async function shareWhatsApp(): Promise<{ error: string } | void> {
    setError(null);
    setWaLink(null);
    const res = await portalAccessLinkAction(clientId);
    if (!res.ok) return { error: res.error };
    const msg = `Hola${res.name ? " " + res.name : ""}, este es tu acceso directo al portal de DTD Cargo (un solo uso, vence pronto): ${res.link}`;
    setWaLink(
      res.whatsappRaw
        ? `https://wa.me/${res.whatsappRaw}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`,
    );
  }
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
          Agrega un email al cliente para poder habilitar su acceso al portal.
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
                Todavía no tiene acceso. Al invitarlo, le llega un correo a{" "}
                <b style={{ color: "var(--ink)" }}>{email}</b> con un{" "}
                <b style={{ color: "var(--ink)" }}>enlace directo</b>: un clic y
                entra a ver sus envíos.
              </>
            )}
            {status === "invited" && (
              <>
                Invitado el {fmt(access!.invitedAt)}. Le enviamos un correo con el
                enlace de acceso a <b style={{ color: "var(--ink)" }}>{email}</b>.
                ¿No entró? El enlace del correo vence pronto — compártele uno nuevo
                por WhatsApp.
              </>
            )}
            {status === "active" && (
              <>
                Activo. Último ingreso: {fmt(access!.lastLoginAt)}. Acceso de solo
                lectura a sus envíos.
              </>
            )}
            {status === "revoked" && (
              <>Acceso revocado. Puedes volver a invitarlo cuando quieras.</>
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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {status === null || status === "revoked" ? (
              <ActionButton
                variant="primary"
                size="sm"
                idleLabel={status === "revoked" ? "Volver a invitar" : "Invitar al portal"}
                loadingLabel="Enviando invitación…"
                successLabel="Invitación enviada"
                onAction={async () => {
                  setError(null);
                  return invitePortalAction(clientId, markbox);
                }}
                onSuccess={() => router.refresh()}
                onError={setError}
              />
            ) : (
              <>
                <ActionButton
                  variant="dark"
                  size="sm"
                  idleLabel="Compartir por WhatsApp"
                  loadingLabel="Generando acceso…"
                  successLabel="Acceso generado"
                  onAction={shareWhatsApp}
                  onError={setError}
                />
                {/* Destructivo separado del positivo (regla 8 de botones). */}
                <span style={{ marginLeft: "auto" }}>
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
                </span>
              </>
            )}
          </div>

          {/* Enlace de WhatsApp listo: el asesor lo abre y se lo manda al cliente. */}
          {waLink && (
            <div style={{ marginTop: 12 }}>
              {/* Botón del sistema en un <a> (navegación): studio-btn-primary da texto
                  claro sobre wine en ambos temas + focus/hover, sin bug de contraste. */}
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="studio-btn studio-btn-primary studio-btn-sm"
              >
                Abrir WhatsApp con el acceso →
              </a>
              <p
                style={{
                  font: "500 11.5px/1.45 var(--f-sans)",
                  color: "var(--ink-soft)",
                  margin: "var(--s-2) 0 0",
                }}
              >
                Se abre WhatsApp con el enlace listo. Envíaselo <b>solo al cliente</b>:
                entra con un clic, es de un solo uso y vence pronto.
              </p>
            </div>
          )}

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
