"use client";

/**
 * EditOperarioDrawer — edita nombre, nombre en chino, rol y almacén del operario.
 * NO toca el PIN (usar «Restablecer PIN»).
 *
 * SDD-0529: sirve para los de China y los de Venezuela.
 * - Los roles los da la base (`rolesPorRegion`, de operario_roles_por_region()
 *   en 0480): el cajón ofrece los de la región del operario y no tiene una
 *   lista propia. Si la base no los dio, no deja guardar.
 * - China lleva un almacén de China obligatorio; Venezuela no lleva (es
 *   despacho). Si uno de Venezuela tenía uno, el cajón avisa que al guardar se
 *   le quita.
 * - Nada cambia en silencio: si su rol de hoy no es de su región hay que
 *   elegir uno, y si el rol cambia el cajón lo dice antes de guardar. El nombre
 *   en chino de uno de Venezuela sólo se muestra si ya lo tiene, para que no se
 *   borre sin verlo.
 * - La región no se cambia aquí: la base valida con la de la fila.
 */

import { startTransition, useActionState, useEffect, useState, type CSSProperties } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import { operarioLoginLabel, operarioRolLabel } from "@/lib/studio/operario-pin";
import {
  OPERARIO_REGION,
  operarioRolOpciones,
  type OperarioRolesPorRegion,
} from "@/lib/studio/operario-edicion";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";
import { updateOperarioAction } from "../actions";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const initialState: State = {};

const fieldError: CSSProperties = {
  font: "500 11px/1.3 var(--f-sans)",
  color: "var(--danger-text)",
  margin: "4px 0 0",
};

const hint: CSSProperties = {
  font: "500 11.5px/1.4 var(--f-sans)",
  color: "var(--ink-soft)",
  margin: "6px 0 0",
};

export function EditOperarioDrawer({
  operario,
  warehouses,
  rolesPorRegion,
  onClose,
}: {
  operario: OperarioRow;
  warehouses: WarehouseCN[];
  /** Lo que devolvió operario_roles_por_region(); null si no llegó. */
  rolesPorRegion: OperarioRolesPorRegion | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    updateOperarioAction,
    initialState,
  );
  const china = operario.region === "cn";
  const region = OPERARIO_REGION[operario.region];
  const { opciones, actualValido } = operarioRolOpciones(
    rolesPorRegion,
    operario.region,
    operario.role,
  );

  // Sólo se usa con los de China: el cajón de Venezuela no tiene el campo.
  const [warehouseId, setWarehouseId] = useState(operario.warehouse_id ?? "");
  const [displayName, setDisplayName] = useState(operario.display_name);
  const [displayNameCn, setDisplayNameCn] = useState(
    operario.display_name_cn ?? "",
  );
  // Si su rol de hoy no es de su región, arranca sin rol: hay que elegir uno.
  const [role, setRole] = useState<string>(actualValido ? operario.role : "");

  // Al guardar: aviso con lo que pasó y cerrar (la tabla se revalida). Una
  // vez por respuesta: `state` es un objeto nuevo en cada respuesta, y un
  // re-render del padre (que recrea onClose) no debe repetir el aviso.
  useEffect(() => {
    if (!state.ok) return;
    toast.success(`Ficha de ${displayName.trim()} guardada`);
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // El almacén que tiene hoy, si no está entre los activos (se desactivó): se
  // ofrece igual para que guardar no se lo cambie.
  const almacenActualFueraDeLista =
    china &&
    !!operario.warehouse_id &&
    !warehouses.some((w) => w.id === operario.warehouse_id);
  const rolCambia = actualValido && role !== "" && role !== operario.role;
  const mostrarNombreCn = china || !!operario.display_name_cn;

  const canSubmit =
    displayName.trim().length > 0 &&
    opciones.some((r) => r === role) &&
    (!china || warehouseId !== "");

  const handleSubmit = (fd: FormData) => {
    startTransition(() => formAction(fd));
  };

  return (
    <DrawerShell
      title={`Editar · ${operario.display_name}`}
      subtitle="No toca el PIN. Usa «Restablecer PIN» si necesitas cambiarlo."
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
          <span className="studio-label">Región</span>
          <p style={{ font: "600 13px/1.4 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
            {region.label} · {region.ambito}
          </p>
          <p style={hint}>
            Entra por{" "}
            <span style={{ font: "600 11.5px/1.3 var(--f-mono)", color: "var(--ink)" }}>
              {operarioLoginLabel(operario.region)}
            </span>
            . La región no se cambia desde aquí.
          </p>
        </div>

        {china ? (
          <div>
            <label htmlFor="edit-warehouse" className="studio-label">
              Almacén de China <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <select
              id="edit-warehouse"
              name="warehouse_id"
              className="studio-input"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              aria-invalid={state.fieldErrors?.warehouse_id ? true : undefined}
              aria-describedby={state.fieldErrors?.warehouse_id ? "edit-warehouse-error" : undefined}
              required
            >
              {warehouseId === "" && (
                <option value="" disabled>
                  Elige un almacén
                </option>
              )}
              {almacenActualFueraDeLista && (
                <option value={operario.warehouse_id ?? ""}>
                  {operario.warehouse_code ?? "Almacén actual"}
                  {operario.warehouse_name_es ? ` · ${operario.warehouse_name_es}` : ""} (inactivo)
                </option>
              )}
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.hub_name_es}
                  {w.warehouse_name ? ` — ${w.warehouse_name}` : ""}
                </option>
              ))}
            </select>
            {state.fieldErrors?.warehouse_id && (
              <p id="edit-warehouse-error" style={fieldError}>
                {state.fieldErrors.warehouse_id}
              </p>
            )}
          </div>
        ) : (
          operario.warehouse_id && (
            <Aviso tono="atencion" compacto>
              Tiene asignado el almacén{" "}
              <strong>{operario.warehouse_code ?? "de China"}</strong>. Al guardar
              se le quita: los operarios de Venezuela no llevan almacén.
            </Aviso>
          )
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: mostrarNombreCn ? "1fr 1fr" : "1fr",
            gap: 12,
          }}
        >
          <div>
            <label htmlFor="edit-name" className="studio-label">
              Nombre <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <input
              id="edit-name"
              name="display_name"
              type="text"
              className="studio-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={state.fieldErrors?.display_name ? true : undefined}
              aria-describedby={state.fieldErrors?.display_name ? "edit-name-error" : undefined}
              required
            />
            {state.fieldErrors?.display_name && (
              <p id="edit-name-error" style={fieldError}>
                {state.fieldErrors.display_name}
              </p>
            )}
          </div>
          {mostrarNombreCn && (
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
          )}
        </div>

        <div>
          <label htmlFor="edit-role" className="studio-label">
            Rol <span style={{ color: "var(--wine-text)" }}>*</span>
          </label>
          <select
            id="edit-role"
            name="role"
            className="studio-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={opciones.length === 0}
            aria-invalid={state.fieldErrors?.role ? true : undefined}
            aria-describedby={state.fieldErrors?.role ? "edit-role-error" : undefined}
            required
          >
            {role === "" && (
              <option value="" disabled>
                Elige un rol
              </option>
            )}
            {opciones.map((r) => (
              <option key={r} value={r}>
                {operarioRolLabel(r)}
              </option>
            ))}
          </select>
          {opciones.length === 0 ? (
            <p role="alert" style={fieldError}>
              No se pudieron cargar los roles de cada región. Recarga la página
              para editar este operario.
            </p>
          ) : !actualValido ? (
            <div style={{ marginTop: 6 }}>
              <Aviso tono="atencion" compacto>
                Su rol de hoy, {operarioRolLabel(operario.role)}, no es de un
                operario de {region.label}. Elige uno para guardar.
              </Aviso>
            </div>
          ) : rolCambia ? (
            <p role="status" style={hint}>
              Vas a cambiar su rol de {operarioRolLabel(operario.role)} a{" "}
              {operarioRolLabel(role)}.
            </p>
          ) : null}
          {state.fieldErrors?.role && (
            <p id="edit-role-error" style={fieldError}>
              {state.fieldErrors.role}
            </p>
          )}
        </div>

        <ErrorAlert state={state} compact />
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
