"use client";

/**
 * AccountDrawer (SDD-0040) — crear / editar una cuenta del plan.
 *
 * En "create" pedimos code, name, type, cuenta padre (opcional) y si es
 * postable (hoja). En "edit" el code no se cambia (es la identidad del árbol);
 * sí name/type/postable/notes.
 */

import { useActionState, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ACCT_TYPE_OPTIONS,
  ACCT_SUBTYPES,
  compareCodes,
  type Account,
  type AccountActionState,
  type AcctType,
} from "@/lib/studio/account-types";
import { createAccount, updateAccount } from "../actions";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";

interface Props {
  mode: "create" | "edit";
  account?: Account;
  accounts: Account[];
  onClose: () => void;
}

const initialState: AccountActionState = {};

export function AccountDrawer({ mode, account, accounts, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const action =
    mode === "edit" && account
      ? updateAccount.bind(null, account.id)
      : createAccount;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AcctType>(account?.type ?? "G");
  const [subtype, setSubtype] = useState(account?.subtype ?? "");
  const [parentId, setParentId] = useState(account?.parent_id ?? "");
  const [isPostable, setIsPostable] = useState(account?.is_postable ?? true);
  const [notes, setNotes] = useState(account?.notes ?? "");

  useEffect(() => {
    if (!state.ok) return;
    if (mode === "create" && state.createdCode) {
      toast.success(`Cuenta ${state.createdCode} creada`);
    } else if (mode === "edit" && account) {
      toast.success(`Cuenta ${account.code} actualizada`);
    }
    router.refresh();
    onClose();
  }, [state.ok, state.createdCode, mode, account, router, toast, onClose]);

  // Cuentas candidatas a padre: grupos (no postables), ordenadas por code.
  const parentOptions = accounts
    .filter((a) => !a.is_postable && a.id !== account?.id)
    .sort((a, b) => compareCodes(a.code, b.code));

  const title = mode === "create" ? "Nueva cuenta" : "Editar cuenta";
  const canSubmit = code.trim().length > 0 && name.trim().length > 0;

  const panelRef = useRef<HTMLElement>(null);
  useDialogA11y(panelRef, { onClose, pending: isPending });

  return (
    <div
      onClick={() => !isPending && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="acct-drawer-title"
        tabIndex={-1}
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
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <h2
            id="acct-drawer-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: isPending ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="acct-drawer-form"
          action={formAction}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="subtype" value={subtype} />
          <input type="hidden" name="parent_id" value={parentId} />
          <input
            type="hidden"
            name="is_postable"
            value={isPostable ? "true" : "false"}
          />

          <div
            style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="acct-code">
                Código <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="acct-code"
                name="code"
                type="text"
                className="studio-input studio-input-mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6.20"
                readOnly={mode === "edit"}
                required
              />
              {state.fieldErrors?.code && (
                <FieldError msg={state.fieldErrors.code} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="acct-name">
                Nombre <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="acct-name"
                name="name"
                type="text"
                className="studio-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gastos de representación"
                required
              />
              {state.fieldErrors?.name && (
                <FieldError msg={state.fieldErrors.name} />
              )}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="acct-type">
                Tipo
              </label>
              <select
                id="acct-type"
                className="studio-input"
                value={type}
                onChange={(e) => {
                  const nt = e.target.value as AcctType;
                  setType(nt);
                  // Cascada: si el subtipo actual no aplica al nuevo tipo, limpiarlo.
                  if (!ACCT_SUBTYPES[nt].some((s) => s.value === subtype)) {
                    setSubtype("");
                  }
                }}
              >
                {ACCT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.type && (
                <FieldError msg={state.fieldErrors.type} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="acct-subtype">
                Subtipo{" "}
                <span style={{ color: "var(--ink-soft)" }}>(opcional)</span>
              </label>
              <select
                id="acct-subtype"
                className="studio-input"
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
              >
                <option value="">— Sin subtipo —</option>
                {ACCT_SUBTYPES[type].map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="studio-label" htmlFor="acct-parent">
              Cuenta padre (grupo)
            </label>
            <select
              id="acct-parent"
              className="studio-input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">— Sin padre (raíz) —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              font: "600 12.5px/1.3 var(--f-sans)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isPostable}
              onChange={(e) => setIsPostable(e.target.checked)}
              style={{ accentColor: "var(--wine)" }}
            />
            Postable (hoja donde se asienta · si no, es un grupo que solo agrega)
          </label>

          <div>
            <label className="studio-label" htmlFor="acct-notes">
              Notas
            </label>
            <input
              id="acct-notes"
              name="notes"
              type="text"
              className="studio-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referencia, mapeo fiscal…"
            />
          </div>

          {state.error && (
            <Aviso tono="error" compacto>{state.error}</Aviso>
          )}

          <div style={{ flex: 1, minHeight: 8 }} />
        </form>

        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
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
            form="acct-drawer-form"
            className="studio-btn studio-btn-primary"
            disabled={isPending || !canSubmit}
          >
            {isPending
              ? mode === "create"
                ? "Creando…"
                : "Guardando…"
              : mode === "create"
                ? "Crear cuenta"
                : "Guardar cambios"}
          </button>
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
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
