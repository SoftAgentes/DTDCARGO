"use client";

/**
 * ClientDrawer — crear/editar cliente (SDD-0010).
 *
 * Drawer lateral derecho 560px. Mode "create" o "edit" según props.
 * useActionState con createClientAction / updateClientAction.
 * Soft delete button en footer (solo mode edit) con confirmación inline.
 * En mode create: MARKBOX se autogenera al submit (no input).
 * En mode edit: MARKBOX visible read-only.
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  CLIENT_TIER_OPTIONS,
  type Client,
  type ClientActionState,
  type ClientTier,
} from "@/lib/studio/client-types";
import {
  createClientAction,
  softDeleteClientAction,
  updateClientAction,
} from "../actions";
import { Icon } from "@/app/studio/_components/icons";

interface Props {
  mode: "create" | "edit";
  client?: Client;
  onClose: () => void;
}

const initialState: ClientActionState = {};

export function ClientDrawer({ mode, client, onClose }: Props) {
  const action =
    mode === "edit" && client
      ? updateClientAction.bind(null, client.markbox)
      : createClientAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [tier, setTier] = useState<ClientTier>(client?.tier ?? "regular");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  // Cerrar drawer en success
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const title = mode === "create" ? "Nuevo cliente" : "Editar cliente";

  return (
    <div
      onClick={() => !isPending && !isDeleting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 30, 61, 0.55)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <h2
              id="client-drawer-title"
              className="studio-display"
              style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
            >
              {title}
            </h2>
            {mode === "edit" && client && (
              <div
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.02em",
                }}
              >
                {client.markbox}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={isPending || isDeleting}
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              cursor: isPending || isDeleting ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          action={formAction}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {mode === "create" && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              El MARKBOX se asigna automáticamente al crear el cliente.
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="studio-label" htmlFor="cl-name">
              Nombre <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <input
              id="cl-name"
              name="name"
              type="text"
              className="studio-input"
              defaultValue={client?.name ?? ""}
              placeholder="Empresa Demo S.A."
              required
              autoFocus
            />
            {state.fieldErrors?.name && <FieldError msg={state.fieldErrors.name} />}
          </div>

          {/* Tier */}
          <div>
            <label className="studio-label" htmlFor="cl-tier">
              Tier <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <select
              id="cl-tier"
              name="tier"
              className="studio-input"
              value={tier}
              onChange={(e) => setTier(e.target.value as ClientTier)}
              required
            >
              {CLIENT_TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.tier && <FieldError msg={state.fieldErrors.tier} />}
          </div>

          {/* Email + Teléfono */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="cl-email">
                Email
              </label>
              <input
                id="cl-email"
                name="email"
                type="email"
                className="studio-input"
                defaultValue={client?.email ?? ""}
                placeholder="compras@empresa.com"
                autoComplete="off"
              />
              {state.fieldErrors?.email && <FieldError msg={state.fieldErrors.email} />}
            </div>
            <div>
              <label className="studio-label" htmlFor="cl-phone">
                Teléfono
              </label>
              <input
                id="cl-phone"
                name="phone"
                type="text"
                className="studio-input"
                defaultValue={client?.phone ?? ""}
                placeholder="+58 414 1234567"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="studio-label" htmlFor="cl-address">
              Dirección
            </label>
            <input
              id="cl-address"
              name="address"
              type="text"
              className="studio-input"
              defaultValue={client?.address ?? ""}
              placeholder="Av. Bolívar, Edif Centro, Piso 4, Valencia"
              autoComplete="off"
            />
          </div>

          {/* RIF */}
          <div>
            <label className="studio-label" htmlFor="cl-rif">
              RIF{" "}
              <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>
                (opcional)
              </span>
            </label>
            <input
              id="cl-rif"
              name="rif"
              type="text"
              className="studio-input studio-input-mono"
              defaultValue={client?.rif ?? ""}
              placeholder="J-12345678-9"
              autoComplete="off"
            />
            {state.fieldErrors?.rif && <FieldError msg={state.fieldErrors.rif} />}
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
                margin: "4px 0 0",
              }}
            >
              Formato: V/E/J/G/P + 8 dígitos + verificador.
            </p>
          </div>

          {/* Notas */}
          <div>
            <label className="studio-label" htmlFor="cl-notes">
              Notas
            </label>
            <textarea
              id="cl-notes"
              name="notes"
              rows={3}
              className="studio-input"
              defaultValue={client?.notes ?? ""}
              placeholder="Volumen mensual, observaciones del contrato, agentes asignados…"
              style={{ resize: "vertical" }}
            />
          </div>

          {state.error && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: 0,
                padding: "10px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {state.error}
            </p>
          )}

          <div style={{ flex: 1, minHeight: 12 }} />
        </form>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <div>
            {mode === "edit" && client && (
              confirmDelete ? (
                <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <span
                    style={{
                      font: "500 12px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    ¿Seguro?
                  </span>
                  <button
                    type="button"
                    className="studio-btn studio-btn-danger studio-btn-sm"
                    disabled={isDeleting}
                    onClick={() => {
                      startDelete(async () => {
                        const result = await softDeleteClientAction(client.markbox);
                        if (result.ok) onClose();
                      });
                    }}
                  >
                    {isDeleting ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setConfirmDelete(true)}
                >
                  Eliminar
                </button>
              )
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="studio-btn studio-btn-primary"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                const form = (e.currentTarget.closest("aside") as HTMLElement)?.querySelector("form");
                if (form) (form as HTMLFormElement).requestSubmit();
              }}
            >
              {isPending
                ? mode === "create"
                  ? "Creando…"
                  : "Guardando…"
                : mode === "create"
                  ? "Crear cliente"
                  : "Guardar cambios"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "4px 0 0",
      }}
    >
      {msg}
    </p>
  );
}
