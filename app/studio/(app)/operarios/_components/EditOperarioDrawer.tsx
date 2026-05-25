"use client";

/**
 * EditOperarioDrawer — edita nombre, rol y warehouse del operario.
 * NO toca PIN (usar ResetPinDrawer).
 */

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";
import { updateOperarioAction } from "../actions";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const initialState: State = {};

export function EditOperarioDrawer({
  operario,
  warehouses,
  onClose,
}: {
  operario: OperarioRow;
  warehouses: WarehouseCN[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateOperarioAction,
    initialState,
  );
  const [warehouseId, setWarehouseId] = useState(operario.warehouse_id);
  const [displayName, setDisplayName] = useState(operario.display_name);
  const [displayNameCn, setDisplayNameCn] = useState(
    operario.display_name_cn ?? "",
  );
  const [role, setRole] = useState<"operario" | "supervisor">(operario.role);

  // Auto-cerrar al éxito
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const canSubmit = !!warehouseId && displayName.trim().length > 0;

  const handleSubmit = (fd: FormData) => {
    startTransition(() => formAction(fd));
  };

  return (
    <DrawerShell
      title={`Editar · ${operario.display_name}`}
      subtitle="No toca el PIN. Usá Reset PIN si necesitás cambiarlo."
      onClose={onClose}
      pending={isPending}
      width={560}
    >
      <form
        id="edit-operario-form"
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
        <input type="hidden" name="operario_id" value={operario.id} />

        <div>
          <label htmlFor="edit-warehouse" className="studio-label">
            Warehouse <span style={{ color: "var(--wine)" }}>*</span>
          </label>
          <select
            id="edit-warehouse"
            name="warehouse_id"
            className="studio-input"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.hub_name_es}
                {w.warehouse_name ? ` — ${w.warehouse_name}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label htmlFor="edit-name" className="studio-label">
              Nombre <span style={{ color: "var(--wine)" }}>*</span>
            </label>
            <input
              id="edit-name"
              name="display_name"
              type="text"
              className="studio-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            {state.fieldErrors?.display_name && (
              <p
                style={{
                  font: "500 11px/1.3 var(--f-sans)",
                  color: "var(--danger)",
                  margin: "4px 0 0",
                }}
              >
                {state.fieldErrors.display_name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="edit-name-cn" className="studio-label">
              Nombre 中文 (opt)
            </label>
            <input
              id="edit-name-cn"
              name="display_name_cn"
              type="text"
              className="studio-input"
              value={displayNameCn}
              onChange={(e) => setDisplayNameCn(e.target.value)}
              style={{ fontFamily: '"Noto Sans SC", var(--f-sans)' }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="edit-role" className="studio-label">
            Rol <span style={{ color: "var(--wine)" }}>*</span>
          </label>
          <select
            id="edit-role"
            name="role"
            className="studio-input"
            value={role}
            onChange={(e) => setRole(e.target.value as "operario" | "supervisor")}
          >
            <option value="operario">Operario</option>
            <option value="supervisor">Supervisor</option>
          </select>
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
        formId="edit-operario-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Guardar cambios"
      />
    </DrawerShell>
  );
}
