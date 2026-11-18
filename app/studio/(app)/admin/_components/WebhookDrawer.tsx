"use client";

/**
 * WebhookDrawer — crear/editar un webhook saliente (SDD-0128).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { deleteWebhookAction, saveWebhookAction } from "../api-integration-actions";
import {
  WEBHOOK_EVENTS,
  type ApiIntegrationActionState,
  type Webhook,
} from "@/lib/studio/api-integration-types";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const FORM_ID = "webhook-form";
const INITIAL: ApiIntegrationActionState = {};

export function WebhookDrawer({
  mode,
  webhook,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  webhook: Webhook | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(webhook?.name ?? "");
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [events, setEvents] = useState<string[]>(webhook?.events ?? []);
  const [active, setActive] = useState(webhook?.active ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [state, formAction, isPending] = useActionState(saveWebhookAction, INITIAL);
  const [delState, delAction, delPending] = useActionState(deleteWebhookAction, INITIAL);

  const handledSave = useRef<ApiIntegrationActionState | null>(null);
  const handledDel = useRef<ApiIntegrationActionState | null>(null);
  useEffect(() => {
    if (state?.ok && handledSave.current !== state) {
      handledSave.current = state;
      onSaved(mode === "create" ? "Webhook creado" : "Webhook actualizado");
      onClose();
    }
  }, [state, mode, onSaved, onClose]);
  useEffect(() => {
    if (delState?.ok && handledDel.current !== delState) {
      handledDel.current = delState;
      onSaved("Webhook eliminado");
      onClose();
    }
  }, [delState, onSaved, onClose]);

  const fe = state?.fieldErrors ?? {};
  const busy = isPending || delPending;
  const canSubmit = name.trim() && /^https:\/\/.+/i.test(url) && events.length > 0;

  const toggleEvent = (key: string) =>
    setEvents((prev) => (prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]));

  return (
    <DrawerShell
      title={mode === "create" ? "Nuevo webhook" : `Editar ${webhook?.name ?? ""}`}
      subtitle="Endpoint saliente para sincronizar eventos"
      onClose={onClose}
      pending={busy}
      width={580}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        {mode === "edit" && webhook && <input type="hidden" name="id" value={webhook.id} />}
        <input type="hidden" name="active" value={active ? "true" : "false"} />
        {events.map((e) => (
          <input key={e} type="hidden" name="events" value={e} />
        ))}

        <div>
          <label className="studio-label" htmlFor="wh-name">Nombre</label>
          <input id="wh-name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="studio-input" placeholder="Sync a BI" style={{ marginTop: 6 }} />
          <FieldError msg={fe.name} />
        </div>

        <div>
          <label className="studio-label" htmlFor="wh-url">URL (https)</label>
          <input id="wh-url" name="url" value={url} onChange={(e) => setUrl(e.target.value)} className="studio-input studio-input-mono" placeholder="https://ejemplo.com/webhooks/dtd" style={{ marginTop: 6 }} />
          <FieldError msg={fe.url} />
        </div>

        <div>
          <label className="studio-label">Eventos</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {WEBHOOK_EVENTS.map((ev) => (
              <label
                key={ev.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "var(--s-2) var(--s-3)",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  font: "500 12.5px/1 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                <input type="checkbox" checked={events.includes(ev.key)} onChange={() => toggleEvent(ev.key)} style={{ accentColor: "var(--wine)" }} />
                <span style={{ flex: 1 }}>{ev.label}</span>
                <code style={{ font: "600 10.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}>{ev.key}</code>
              </label>
            ))}
          </div>
          <FieldError msg={fe.events} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, font: "600 12.5px/1 var(--f-sans)", color: "var(--ink)", cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ accentColor: "var(--wine)" }} />
          <span>Activo</span>
        </label>

        {mode === "edit" && webhook && (
          <div>
            <label className="studio-label">Secreto de firma</label>
            <code style={{ display: "block", marginTop: 6, padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", font: "600 11.5px/1.4 var(--f-mono)", color: "var(--ink-soft)", wordBreak: "break-all" }}>
              {webhook.secret}
            </code>
            <p style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "6px 0 0" }}>
              Configura este secreto del lado del receptor para verificar la firma HMAC.
            </p>
          </div>
        )}

        {state?.error && <FormError msg={state.error} />}
        {delState?.error && <FormError msg={delState.error} />}
      </form>

      <footer style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 10, background: "var(--bg-surface)", flexShrink: 0 }}>
        {mode === "edit" && webhook ? (
          <button type="button" className="studio-btn studio-btn-ghost" disabled={busy} style={{ color: "var(--danger)" }} onClick={() => setConfirmDelete(true)}>
            Eliminar
          </button>
        ) : (
          <div />
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="studio-btn studio-btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" form={FORM_ID} className="studio-btn studio-btn-primary" disabled={busy || !canSubmit}>
            {isPending ? "Guardando…" : mode === "create" ? "Crear webhook" : "Guardar"}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmDelete && !!webhook}
        danger
        title="¿Eliminar webhook?"
        message={`"${webhook?.name ?? "Este webhook"}" dejará de recibir eventos.`}
        confirmLabel="Eliminar"
        pending={delPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!webhook) return;
          setConfirmDelete(false);
          const fd = new FormData();
          fd.set("id", webhook.id);
          delAction(fd);
        }}
      />
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--danger)", margin: "6px 0 0" }}>{msg}</p>;
}
function FormError({ msg }: { msg: string }) {
  return <Aviso tono="error">{msg}</Aviso>;
}
