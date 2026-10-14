"use client";

/**
 * NewOperarioDrawer — crea un operario de la app del teléfono.
 *
 * SDD-0515: el PIN ya no se sortea en el navegador. Igual que al restablecer
 * (SDD-0513), por defecto lo genera el SERVIDOR con crypto.randomInt; «Escribirlo
 * yo» deja escribir uno acordado. El alta pide un motivo de la lista (con texto
 * sólo para «Otro»), que va a la auditoría. Después de crear se muestra el PIN
 * y la app por la que entra (/m/cn/login: el alta del Studio es de China) para
 * pasárselo al operario; vive sólo en el estado de este cajón y desaparece al
 * cerrarlo.
 */

import { startTransition, useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { StatusIcon } from "@/components/StatusIcon";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";
import {
  OPERARIO_PIN_LENGTH,
  OPERARIO_PIN_PROBLEM_MESSAGE,
  operarioPinProblem,
  type OperarioRegion,
} from "@/lib/studio/operario-pin";
import { createOperarioAction } from "../actions";
import { MOTIVO_VACIO, MotivoField, motivoListo, type MotivoValue } from "./MotivoField";
import { PinRevealBlock } from "./PinRevealBlock";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  pinReveal?: string;
  region?: OperarioRegion;
};

type PinMode = "generar" | "manual";

const initialState: State = {};

const MODE_OPTIONS = [
  {
    value: "generar" as const,
    label: "Generar PIN",
    description: "El sistema crea uno difícil de adivinar.",
  },
  {
    value: "manual" as const,
    label: "Escribirlo yo",
    description: "Si ya acordaste uno con el operario.",
  },
];

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
  const [mode, setMode] = useState<PinMode>("generar");
  const [pin, setPin] = useState("");
  const [motivo, setMotivo] = useState<MotivoValue>(MOTIVO_VACIO);

  // Si la action retornó ok, mostramos vista de éxito con el PIN.
  if (state.ok && state.pinReveal) {
    return (
      <PinRevealSuccess
        pin={state.pinReveal}
        region={state.region ?? "cn"}
        displayName={displayName}
        onClose={onClose}
      />
    );
  }

  const manualProblem = mode === "manual" ? operarioPinProblem(pin) : null;
  const canSubmit =
    !!warehouseId &&
    displayName.trim().length > 0 &&
    (mode === "generar" || manualProblem === null) &&
    motivoListo(motivo, mode === "manual" ? pin : null);
  const liveError =
    pin.length === OPERARIO_PIN_LENGTH && manualProblem === "common"
      ? OPERARIO_PIN_PROBLEM_MESSAGE.common
      : null;
  const pinError = state.fieldErrors?.pin ?? liveError;

  const handleSubmit = (fd: FormData) => {
    startTransition(() => formAction(fd));
  };

  return (
    <DrawerShell
      title="Nuevo operario"
      subtitle="PIN de 4 dígitos para entrar a la app del teléfono"
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
        <input type="hidden" name="pin_mode" value={mode} />

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
              ? "Registra recepciones desde la app del teléfono."
              : "Supervisor: mismo acceso + futuras acciones de aprobación."}
          </p>
        </div>

        <div>
          <span className="studio-label" style={{ display: "block" }}>
            ¿Cómo quieres el PIN?
          </span>
          <SegmentedControl
            ariaLabel="Cómo quieres el PIN"
            value={mode}
            onChange={setMode}
            options={MODE_OPTIONS}
            columns={2}
            disabled={isPending}
          />
        </div>

        {mode === "generar" ? (
          <p
            style={{
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            Al crearlo verás el PIN, para que se lo pases al operario.
            {state.fieldErrors?.pin ? <FieldError msg={state.fieldErrors.pin} /> : null}
          </p>
        ) : (
          <div>
            <label htmlFor="op-pin" className="studio-label">
              PIN <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <input
              id="op-pin"
              name="pin"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              pattern="[0-9]{4}"
              maxLength={OPERARIO_PIN_LENGTH}
              className="studio-input studio-input-mono"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, OPERARIO_PIN_LENGTH))
              }
              aria-invalid={pinError ? true : undefined}
              aria-describedby="op-pin-hint"
              required
              style={{ font: "700 18px/1 var(--f-mono)", letterSpacing: "0.12em" }}
            />
            <p
              id="op-pin-hint"
              role={pinError ? "alert" : undefined}
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: pinError ? "var(--ink)" : "var(--ink-soft)",
                margin: "var(--s-1) 0 0",
              }}
            >
              {pinError ? (
                <>
                  <StatusIcon
                    tone="danger"
                    style={{
                      color: "var(--danger-text)",
                      display: "inline",
                      marginRight: "var(--s-1)",
                      verticalAlign: "middle",
                    }}
                  />
                  {pinError}
                </>
              ) : (
                "4 dígitos. No se aceptan los muy comunes, como 1234 o 0000."
              )}
            </p>
          </div>
        )}

        <MotivoField
          id="op-motivo"
          value={motivo}
          onChange={setMotivo}
          pin={mode === "manual" ? pin : null}
          serverError={state.fieldErrors?.motivo}
          disabled={isPending}
          placeholder="Ej.: entra al turno de la mañana"
        />

        <ErrorAlert state={state} compact />
      </form>

      <DrawerFooter
        formId="new-operario-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Crear operario"
        pendingLabel="Creando…"
      />
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <span
      role="alert"
      style={{
        display: "block",
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger-text, var(--danger))",
        margin: "4px 0 0",
      }}
    >
      {msg}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Vista de éxito: el PIN del operario nuevo
// ─────────────────────────────────────────────────────────────

function PinRevealSuccess({
  pin,
  region,
  displayName,
  onClose,
}: {
  pin: string;
  region: OperarioRegion;
  displayName: string;
  onClose: () => void;
}) {
  return (
    <DrawerShell
      title="Operario creado"
      subtitle="Pásale este PIN al operario"
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
        <PinRevealBlock pin={pin} region={region} />
        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            textAlign: "center",
            maxWidth: 360,
            margin: 0,
          }}
        >
          Díselo en persona. Si se le olvida, puedes verlo con «Ver PIN»; cada
          consulta queda en la auditoría.
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
