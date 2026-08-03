"use client";

/**
 * NewOperarioDrawer — crea operario. Genera PIN auto-random (4 dígitos)
 * o permite que el admin lo tipee. Después de crear, muestra el PIN en
 * pantalla UNA vez (no se guarda en ningún lado más).
 */

import { startTransition, useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";
import { createOperarioAction } from "../actions";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  pinReveal?: string;
};

const initialState: State = {};

function randomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export function NewOperarioDrawer({
  warehouses,
  onClose,
}: {
  warehouses: WarehouseCN[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    createOperarioAction,
    initialState,
  );
  const [warehouseId, setWarehouseId] = useState<string>(
    warehouses[0]?.id ?? "",
  );
  const [displayName, setDisplayName] = useState("");
  const [displayNameCn, setDisplayNameCn] = useState("");
  const [role, setRole] = useState<"operario" | "supervisor">("operario");
  const [pin, setPin] = useState(() => randomPin());

  const canSubmit =
    !!warehouseId && displayName.trim().length > 0 && /^\d{4}$/.test(pin);

  // Si la action retornó ok, mostramos vista de éxito con el PIN.
  if (state.ok && state.pinReveal) {
    return (
      <PinRevealSuccess
        pin={state.pinReveal}
        displayName={displayName}
        onClose={onClose}
      />
    );
  }

  const handleSubmit = (fd: FormData) => {
    startTransition(() => formAction(fd));
  };

  return (
    <DrawerShell
      title="Nuevo operario"
      subtitle="PIN de 4 dígitos para entrar a la PWA mobile"
      onClose={onClose}
      pending={isPending}
      width={560}
    >
      <form
        id="new-operario-form"
        action={handleSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <label htmlFor="op-warehouse" className="studio-label">
            Warehouse <span style={{ color: "var(--wine-text)" }}>*</span>
          </label>
          <select
            id="op-warehouse"
            name="warehouse_id"
            className="studio-input"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
          >
            <option value="">Seleccionar…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.hub_name_es}
                {w.warehouse_name ? ` — ${w.warehouse_name}` : ""}
              </option>
            ))}
          </select>
          {state.fieldErrors?.warehouse_id && (
            <FieldError msg={state.fieldErrors.warehouse_id} />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label htmlFor="op-name" className="studio-label">
              Nombre <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <input
              id="op-name"
              name="display_name"
              type="text"
              className="studio-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Wang Hua"
              required
            />
            {state.fieldErrors?.display_name && (
              <FieldError msg={state.fieldErrors.display_name} />
            )}
          </div>
          <div>
            <label htmlFor="op-name-cn" className="studio-label">
              Nombre 中文 (opt)
            </label>
            <input
              id="op-name-cn"
              name="display_name_cn"
              type="text"
              className="studio-input"
              value={displayNameCn}
              onChange={(e) => setDisplayNameCn(e.target.value)}
              placeholder="王华"
              style={{ fontFamily: '"Noto Sans SC", var(--f-sans)' }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="op-role" className="studio-label">
            Rol <span style={{ color: "var(--wine-text)" }}>*</span>
          </label>
          <select
            id="op-role"
            name="role"
            className="studio-input"
            value={role}
            onChange={(e) => setRole(e.target.value as "operario" | "supervisor")}
          >
            <option value="operario">Operario</option>
            <option value="supervisor">Supervisor</option>
          </select>
          <p
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "4px 0 0",
            }}
          >
            {role === "operario"
              ? "Registra recepciones desde la PWA."
              : "Supervisor: mismo acceso + futuras acciones de aprobación."}
          </p>
        </div>

        <div>
          <label htmlFor="op-pin" className="studio-label">
            PIN <span style={{ color: "var(--wine-text)" }}>*</span>
            <button
              type="button"
              onClick={() => setPin(randomPin())}
              className="studio-btn studio-btn-ghost studio-btn-xs"
              style={{ marginLeft: 8 }}
            >
              ↻ Generar otro
            </button>
          </label>
          <input
            id="op-pin"
            name="pin"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            className="studio-input studio-input-mono"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="0000"
            required
            style={{ font: "700 18px/1 var(--f-mono)", letterSpacing: "0.12em" }}
          />
          {state.fieldErrors?.pin && <FieldError msg={state.fieldErrors.pin} />}
          <p
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "4px 0 0",
            }}
          >
            Muestra el PIN al operario apenas se cree. No se puede recuperar
            después (solo resetear).
          </p>
        </div>

        {state.error && (
          <p
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
              padding: "10px 12px",
              background: "var(--danger-bg, rgba(168,50,62,0.08))",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
              margin: 0,
            }}
          >
            {state.error}
          </p>
        )}
      </form>

      <DrawerFooter
        formId="new-operario-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Crear operario"
      />
    </DrawerShell>
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

// ─────────────────────────────────────────────────────────────
// Success view post-create: muestra PIN en grande UNA vez
// ─────────────────────────────────────────────────────────────

function PinRevealSuccess({
  pin,
  displayName,
  onClose,
}: {
  pin: string;
  displayName: string;
  onClose: () => void;
}) {
  return (
    <DrawerShell
      title="Operario creado"
      subtitle="Muéstrale este PIN al operario · no se puede recuperar después"
      onClose={onClose}
      pending={false}
      width={560}
    >
      <div
        style={{
          flex: 1,
          padding: "32px 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--success-bg, rgba(31,138,91,0.12))",
            color: "var(--success)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "900 28px/1 var(--f-display)",
          }}
        >
          ✓
        </div>
        <p
          style={{
            font: "600 14px/1.4 var(--f-sans)",
            color: "var(--ink)",
            margin: 0,
            textAlign: "center",
          }}
        >
          <strong>{displayName}</strong> ya puede entrar.
        </p>
        <div
          style={{
            padding: "20px 32px",
            background: "var(--bg-elevated)",
            border: "2px dashed var(--wine)",
            borderRadius: "var(--r-md)",
            font: "900 38px/1 var(--f-mono)",
            color: "var(--wine-text)",
            letterSpacing: "0.16em",
          }}
        >
          {pin}
        </div>
        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            textAlign: "center",
            maxWidth: 360,
            margin: 0,
          }}
        >
          Anótalo o díselo en persona. Si lo pierdes, vas a tener que resetearlo
          desde esta misma página.
        </p>
      </div>
      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          background: "var(--bg-surface)",
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onClose}
        >
          Listo
        </button>
      </footer>
    </DrawerShell>
  );
}
