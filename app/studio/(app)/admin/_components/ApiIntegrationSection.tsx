"use client";

/**
 * ApiIntegrationSection — sección "API keys & webhooks" del admin (SDD-0128).
 *
 * Gestión de credenciales de integración. El token de una key nueva se muestra
 * UNA sola vez (viene en el state de la action). El consumo real (auth de
 * requests, dispatcher de webhooks) es follow-up de otra spec.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { WebhookDrawer } from "./WebhookDrawer";
import { createApiKeyAction, revokeApiKeyAction } from "../api-integration-actions";
import {
  type ApiIntegrationActionState,
  type ApiIntegrationData,
  type ApiKey,
  type Webhook,
} from "@/lib/studio/api-integration-types";

const INITIAL: ApiIntegrationActionState = {};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

export function ApiIntegrationSection({ data }: { data: ApiIntegrationData }) {
  const toast = useToast();

  const [name, setName] = useState("");
  const [createState, createAction, creating] = useActionState(createApiKeyAction, INITIAL);
  const [revokeState, revokeAction, revoking] = useActionState(revokeApiKeyAction, INITIAL);

  const [revealToken, setRevealToken] = useState<string | null>(null);
  const handledCreate = useRef<ApiIntegrationActionState | null>(null);
  const handledRevoke = useRef<ApiIntegrationActionState | null>(null);

  useEffect(() => {
    if (createState?.ok && handledCreate.current !== createState) {
      handledCreate.current = createState;
      if (createState.token) setRevealToken(createState.token);
      setName("");
      toast.success("API key creada");
    }
  }, [createState, toast]);

  useEffect(() => {
    if (revokeState?.ok && handledRevoke.current !== revokeState) {
      handledRevoke.current = revokeState;
      toast.success("API key revocada");
    }
  }, [revokeState, toast]);

  const [webhookDrawer, setWebhookDrawer] = useState<
    { mode: "create" | "edit"; webhook: Webhook | null } | null
  >(null);
  const [toRevoke, setToRevoke] = useState<ApiKey | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Aviso de estado */}
      <div
        style={{
          padding: "var(--s-3) var(--s-4)",
          background: "var(--warning-bg)",
          color: "var(--warning)",
          borderRadius: "var(--r-md)",
          font: "600 12px/1.4 var(--f-sans)",
        }}
      >
        Estas credenciales se administran acá, pero todavía no hay un endpoint que autentique con la key ni un
        dispatcher que dispare los webhooks (follow-up). Sirven para dejar la integración lista.
      </div>

      {/* ── API keys ── */}
      <Card>
        <CardEyebrow>API keys</CardEyebrow>

        {revealToken && (
          <div
            style={{
              padding: 14,
              background: "var(--success-bg)",
              border: "1px solid var(--success)",
              borderRadius: "var(--r-md)",
              marginBottom: 14,
            }}
          >
            <div style={{ font: "700 12px/1.3 var(--f-sans)", color: "var(--success)", marginBottom: "var(--s-2)" }}>
              Copia este token ahora — no se vuelve a mostrar.
            </div>
            <code style={{ display: "block", padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "var(--r-sm)", font: "600 12px/1.5 var(--f-mono)", color: "var(--ink)", wordBreak: "break-all" }}>
              {revealToken}
            </code>
            <div style={{ display: "flex", gap: "var(--s-2)", marginTop: 10 }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(revealToken).then(
                    () => toast.success("Token copiado"),
                    () => toast.error("No se pudo copiar"),
                  );
                }}
              >
                Copiar
              </button>
              <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={() => setRevealToken(null)}>
                Ya lo copié
              </button>
            </div>
          </div>
        )}

        <form action={createAction} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: "var(--s-4)", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="studio-label" htmlFor="ak-name">Nombre de la key</label>
            <input id="ak-name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="studio-input" placeholder="Integración BI" style={{ marginTop: 6 }} />
            {createState?.fieldErrors?.name && (
              <p style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "6px 0 0" }}>{createState.fieldErrors.name}</p>
            )}
          </div>
          <button type="submit" className="studio-btn studio-btn-primary" disabled={creating || !name.trim()}>
            {creating ? "Creando…" : "Crear key"}
          </button>
        </form>

        {createState?.error && <FormError msg={createState.error} />}
        {revokeState?.error && <FormError msg={revokeState.error} />}

        {data.apiKeys.length === 0 ? (
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>Sin API keys todavía.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            {data.apiKeys.map((k) => (
              <div key={k.id} style={{ display: "grid", gridTemplateColumns: "1fr 180px 120px 90px", gap: "var(--s-3)", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", alignItems: "center" }}>
                <div>
                  <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{k.name}</div>
                  <code style={{ font: "600 11px/1.3 var(--f-mono)", color: "var(--ink-soft)" }}>{k.keyPrefix}…</code>
                </div>
                <code style={{ font: "500 11px/1.3 var(--f-mono)", color: "var(--ink-soft)" }}>creada {fmtDate(k.createdAt)}</code>
                {k.revokedAt ? (
                  <Badge tone="danger" size="sm">Revocada</Badge>
                ) : (
                  <Badge tone="success" size="sm">Activa</Badge>
                )}
                {!k.revokedAt ? (
                  <button type="button" onClick={() => setToRevoke(k)} disabled={revoking} style={{ font: "600 11.5px/1 var(--f-sans)", color: "var(--danger)", justifySelf: "end", background: "transparent", border: 0, cursor: "pointer" }}>
                    Revocar
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Webhooks ── */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <CardEyebrow noMargin>Webhooks salientes</CardEyebrow>
          <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={() => setWebhookDrawer({ mode: "create", webhook: null })}>
            + Nuevo webhook
          </button>
        </div>
        {data.webhooks.length === 0 ? (
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>Sin webhooks configurados.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            {data.webhooks.map((w) => (
              <div key={w.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px", gap: "var(--s-3)", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{w.name}</div>
                  <code style={{ font: "500 11px/1.3 var(--f-mono)", color: "var(--ink-soft)", wordBreak: "break-all" }}>{w.url}</code>
                  <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{w.events.length} evento{w.events.length === 1 ? "" : "s"}</div>
                </div>
                {w.active ? <Badge tone="success" size="sm">Activo</Badge> : <Badge tone="neutral" size="sm">Inactivo</Badge>}
                <button type="button" onClick={() => setWebhookDrawer({ mode: "edit", webhook: w })} style={{ font: "600 11.5px/1 var(--f-sans)", color: "var(--wine)", justifySelf: "end", background: "transparent", border: 0, cursor: "pointer" }}>
                  Editar →
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {webhookDrawer && (
        <WebhookDrawer
          mode={webhookDrawer.mode}
          webhook={webhookDrawer.webhook}
          onClose={() => setWebhookDrawer(null)}
          onSaved={(msg) => toast.success(msg)}
        />
      )}

      <ConfirmDialog
        open={!!toRevoke}
        danger
        title="¿Revocar API key?"
        message={`"${toRevoke?.name ?? "Esta key"}" dejará de funcionar de inmediato. No se puede deshacer.`}
        confirmLabel="Revocar"
        pending={revoking}
        onCancel={() => setToRevoke(null)}
        onConfirm={() => {
          if (!toRevoke) return;
          const fd = new FormData();
          fd.set("id", toRevoke.id);
          setToRevoke(null);
          revokeAction(fd);
        }}
      />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "22px 24px" }}>
      {children}
    </section>
  );
}
function CardEyebrow({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: noMargin ? 0 : 14 }}>
      {children}
    </div>
  );
}
function FormError({ msg }: { msg: string }) {
  return <div style={{ padding: "var(--s-3)", background: "var(--danger-bg)", color: "var(--danger)", borderRadius: "var(--r-md)", font: "600 13px/1.3 var(--f-sans)", marginBottom: "var(--s-3)" }}>{msg}</div>;
}
