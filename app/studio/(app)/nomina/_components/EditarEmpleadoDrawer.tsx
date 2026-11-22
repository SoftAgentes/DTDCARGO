"use client";

/**
 * Editar un empleado desde la lista de Nómina (SDD-0652 F1).
 *
 * La lista ya no trae la cédula, el sueldo ni la cuenta bancaria: este panel
 * pide la ficha al servidor al abrirse (`getEmployeeEditViewAction`) y después
 * abre el formulario de siempre. La cuenta llega enmascarada.
 *
 * Mientras carga o si falla, se ve un panel con su estado: un error nunca se
 * confunde con «no hay datos» (§5.3).
 */

import { useCallback, useEffect, useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import type { EmployeeEditView } from "@/lib/studio/nomina/employee-types";
import type { Position } from "@/lib/studio/nomina/position-types";
import { getEmployeeEditViewAction } from "../actions";
import { EmpleadoDrawer } from "./EmpleadoDrawer";

type Estado =
  | { kind: "cargando" }
  | { kind: "error"; msg: string }
  | { kind: "ok"; employee: EmployeeEditView };

export function EditarEmpleadoDrawer({
  employeeId,
  positions,
  onClose,
}: {
  employeeId: string;
  positions: Position[];
  onClose: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ kind: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    getEmployeeEditViewAction(employeeId)
      .then((r) => {
        if (!vivo) return;
        setEstado("error" in r ? { kind: "error", msg: r.error } : { kind: "ok", employee: r.employee });
      })
      .catch(() => {
        if (vivo) setEstado({ kind: "error", msg: "No se pudo cargar la ficha. Intenta de nuevo." });
      });
    return () => {
      vivo = false;
    };
  }, [employeeId, intento]);

  const reintentar = useCallback(() => {
    setEstado({ kind: "cargando" });
    setIntento((n) => n + 1);
  }, []);

  if (estado.kind === "ok") {
    // En edición no hay alta unificada: el acceso se gestiona en Usuarios.
    return (
      <EmpleadoDrawer employee={estado.employee} positions={positions} canManageUsers={false} onClose={onClose} />
    );
  }

  return (
    <DrawerShell title="Editar empleado" onClose={onClose} pending={estado.kind === "cargando"} width={640}>
      <div style={{ flex: 1, overflow: "auto", padding: "20px 22px" }}>
        {estado.kind === "cargando" ? (
          <p role="status" style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Cargando la ficha…
          </p>
        ) : (
          <Aviso tono="error" accion={{ etiqueta: "Reintentar", onClick: reintentar }}>
            {estado.msg}
          </Aviso>
        )}
      </div>
    </DrawerShell>
  );
}
