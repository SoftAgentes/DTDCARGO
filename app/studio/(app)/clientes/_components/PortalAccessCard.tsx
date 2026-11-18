"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import type { ClientPortalAccess } from "@/lib/studio/client-queries";
import {
  approvePortalAction,
  invitePortalAction,
  portalAccessLinkAction,
  registrationLinkAction,
  revokePortalAction,
} from "../actions";
import { registroLinkWhatsAppText } from "@/lib/portal/registro-link-types";

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
 * clic → adentro).
 *
 * "Compartir por WhatsApp" arma un enlace **corto y propio**
 * (`dtdcargo.com/entrar/<código>`, SDD-0253), no el magic-link crudo de Supabase:
 * ese lo quemaba el robot de vista previa de WhatsApp antes de que el cliente lo
 * tocara. El código dura 72 h, así que ya no hay que coordinar en vivo.
 */
export function PortalAccessCard({
  clientId,
  markbox,
  email,
  access,
  approvedAt,
  canEdit = true,
}: {
  clientId: string;
  markbox: string;
  email: string | null;
  access: ClientPortalAccess | null;
  /** clients.portal_approved_at — null = pendiente de revisión (SDD-0042 Fase 5). */
  approvedAt?: string | null;
  /** SDD-0646: el link de registro sólo se le ofrece a quien edita clientes. */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Enlace wa.me armado tras generar el acceso; se revela como link (no window.open
  // para no chocar con el bloqueo de popups tras el await).
  const [waLink, setWaLink] = useState<string | null>(null);
  // SDD-0646 D-1 · invitar a un correo que nunca se comprobó pide confirmación.
  const [confirmarInvitar, setConfirmarInvitar] = useState(false);
  const [invitando, setInvitando] = useState(false);
  const approved = approvedAt != null;

  const status = access?.status ?? null;

  /** Genera un acceso fresco y arma el wa.me con el enlace listo para enviar. */
  async function shareWhatsApp(): Promise<{ error: string } | void> {
    setError(null);
    setWaLink(null);
    const res = await portalAccessLinkAction(clientId);
    if (!res.ok) return { error: res.error };
    const msg = `Hola${res.name ? " " + res.name : ""}, este es tu acceso al portal de DTD Cargo. Ábrelo y toca "Entrar a mi portal": ${res.link}\n\nEs personal y de un solo uso — no lo reenvíes a nadie.`;
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

      {status !== "active" && canEdit && <RegistrationLinkBlock clientId={clientId} />}

      {!email ? (
        <p style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Sin correo no se le puede mandar la invitación por email. Mándale el link
          de registro: el cliente carga su correo y sus datos.
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
                  const res = await invitePortalAction(clientId, markbox);
                  // SDD-0646 D-1 · correo nunca comprobado: se pide confirmación
                  // explícita antes de mandarle un enlace de entrada.
                  if (res.requiereConfirmar) {
                    setConfirmarInvitar(true);
                    throw new Error(
                      "Este cliente nunca comprobó su correo. Confirma la invitación para enviarla.",
                    );
                  }
                  return res;
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
                es de un solo uso y vale por 72 horas.
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
      <ConfirmDialog
        open={confirmarInvitar}
        title="Este cliente nunca comprobó su correo"
        message="Se registró por link y todavía no confirmó que el correo de su ficha es suyo. Si lo invitas por correo, quien lea ese buzón entra a su portal. Confirma primero con el cliente, por WhatsApp, que el correo es el suyo; o dale el acceso por WhatsApp."
        confirmLabel="Invitar de todos modos"
        cancelLabel="Cancelar"
        pending={invitando}
        initialFocus="safe"
        onCancel={() => setConfirmarInvitar(false)}
        onConfirm={async () => {
          setInvitando(true);
          const res = await invitePortalAction(clientId, markbox, {
            confirmarCorreoSinComprobar: true,
          });
          setInvitando(false);
          setConfirmarInvitar(false);
          setError(res.error ?? res.warning ?? null);
          if (res.ok) router.refresh();
        }}
      />
    </section>
  );
}

/**
 * Link de registro por WhatsApp (SDD-0646) para el cliente que tiene ficha y
 * no tiene portal — sobre todo los del legado, que no tienen correo. El cliente
 * completa SU ficha con su código fijo; el link no lleva el Shipping Mark.
 */
function RegistrationLinkBlock({ clientId }: { clientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; wa: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generar(): Promise<{ error: string } | void> {
    setError(null);
    setCopied(false);
    const res = await registrationLinkAction(clientId);
    if (!res.ok) return { error: res.error };
    const text = encodeURIComponent(registroLinkWhatsAppText(res.name, res.link));
    setLink({
      url: res.link,
      wa: res.whatsappRaw
        ? `https://wa.me/${res.whatsappRaw}?text=${text}`
        : `https://wa.me/?text=${text}`,
      expiresAt: res.expiresAt,
    });
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setError("No se pudo copiar. Selecciona el link y cópialo a mano.");
    }
  }

  return (
    <div
      style={{
        marginBottom: 16,
        paddingBottom: 16,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <p
        style={{
          font: "500 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 10px",
        }}
      >
        <b style={{ color: "var(--ink)" }}>Link de registro.</b> El cliente completa sus
        datos con su código de siempre y entra a su portal. Es de un solo uso y vence en
        14 días; generar otro anula el anterior.
      </p>
      {error && (
        <p
          role="alert"
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
        variant={link ? "ghost" : "dark"}
        size="sm"
        idleLabel={link ? "Generar otro link" : "Generar link de registro"}
        loadingLabel="Generando link…"
        successLabel="Link generado"
        onAction={generar}
        onError={setError}
      />
      {link && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="studio-label" htmlFor={`registro-link-${clientId}`}>
            Link para el cliente
          </label>
          <input
            id={`registro-link-${clientId}`}
            className="studio-input studio-input-mono"
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={copiar}
            >
              {copied ? "Copiado" : "Copiar link"}
            </button>
            <a
              href={link.wa}
              target="_blank"
              rel="noopener noreferrer"
              className="studio-btn studio-btn-primary studio-btn-sm"
            >
              Abrir WhatsApp con el link →
            </a>
          </div>
          <p
            style={{
              font: "500 11.5px/1.45 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            Mándaselo <b>solo al cliente</b>: quien lo abra completa esta ficha.
            {link.expiresAt ? ` Vence el ${fmt(link.expiresAt)}.` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
