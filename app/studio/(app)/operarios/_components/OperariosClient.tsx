"use client";

/**
 * OperariosClient — tabla + drawers Nuevo/Restablecer PIN/Editar (SDD-0028, SDD-0513)
 * y, desde SDD-0515, «Ver PIN» y «Reactivar» (un operario de baja vuelve con PIN nuevo).
 */

import { useState, type CSSProperties } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";
import { setOperarioActiveAction } from "../actions";
import { NewOperarioDrawer } from "./NewOperarioDrawer";
import { ResetPinDrawer } from "./ResetPinDrawer";
import { EditOperarioDrawer } from "./EditOperarioDrawer";
import { PinViewDialog } from "./PinViewDialog";

type DrawerKind = null | "new" | "reset" | "reactivar" | "ver" | "edit";

type RowActions = {
  onResetPin: (op: OperarioRow) => void;
  onReactivar: (op: OperarioRow) => void;
  onVerPin: (op: OperarioRow) => void;
  onEdit: (op: OperarioRow) => void;
};

// La columna de acciones lleva «Ver PIN», «Restablecer PIN» y el lápiz. Los
// botones no se parten (nowrap): si algún día no caben, se ve el desborde en vez
// de crecer la fila en silencio.
const GRID_COLUMNS = "1fr 130px 130px 160px 90px 290px";

export function OperariosClient({
  operarios,
  warehouses,
}: {
  operarios: OperarioRow[];
  warehouses: WarehouseCN[];
}) {
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [selected, setSelected] = useState<OperarioRow | null>(null);

  const openNew = () => {
    setSelected(null);
    setDrawer("new");
  };
  const openFor = (kind: Exclude<DrawerKind, null | "new">) => (op: OperarioRow) => {
    setSelected(op);
    setDrawer(kind);
  };
  const close = () => {
    setDrawer(null);
    setSelected(null);
  };

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s-4)",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {operarios.length === 0
            ? "Aún no hay operarios."
            : `${operarios.length} ${operarios.length === 1 ? "operario" : "operarios"}`}
        </div>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={openNew}
        >
          + Nuevo operario
        </button>
      </div>

      {operarios.length === 0 ? (
        <EmptyState
          eyebrow="Catálogo vacío"
          title="Aún no hay operarios."
          description="Cada operario tiene un PIN de 4 dígitos para entrar a la app del teléfono. Crea el primero."
          action={
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={openNew}
            >
              + Nuevo operario
            </button>
          }
        />
      ) : (
        <OperariosTable
          operarios={operarios}
          onResetPin={openFor("reset")}
          onReactivar={openFor("reactivar")}
          onVerPin={openFor("ver")}
          onEdit={openFor("edit")}
        />
      )}

      {drawer === "new" && (
        <NewOperarioDrawer warehouses={warehouses} onClose={close} />
      )}
      {drawer === "reset" && selected && (
        <ResetPinDrawer operario={selected} onClose={close} />
      )}
      {drawer === "reactivar" && selected && (
        <ResetPinDrawer operario={selected} onClose={close} reactivar />
      )}
      {drawer === "ver" && selected && (
        <PinViewDialog operario={selected} onClose={close} />
      )}
      {drawer === "edit" && selected && (
        <EditOperarioDrawer
          operario={selected}
          warehouses={warehouses}
          onClose={close}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabla
// ─────────────────────────────────────────────────────────────

function OperariosTable({
  operarios,
  ...actions
}: { operarios: OperarioRow[] } & RowActions) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header columnas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID_COLUMNS,
          gap: 12,
          padding: "10px 20px",
          font: "700 9.5px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <span>Operario</span>
        <span>Warehouse</span>
        <span>Rol</span>
        <span>Último login</span>
        <span>Activo</span>
        <span style={{ textAlign: "right" }}>Acciones</span>
      </div>

      {operarios.map((op, i) => (
        <OperarioRowItem key={op.id} op={op} first={i === 0} {...actions} />
      ))}
    </div>
  );
}

function OperarioRowItem({
  op,
  first,
  onResetPin,
  onReactivar,
  onVerPin,
  onEdit,
}: { op: OperarioRow; first: boolean } & RowActions) {
  const initials = op.display_name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  const lastLogin = op.last_login_at
    ? formatDateTime(op.last_login_at)
    : "Nunca";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID_COLUMNS,
        gap: 12,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: op.active ? 1 : 0.55,
      }}
    >
      {/* Avatar + nombre */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", minWidth: 0 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--wine-tint, rgba(127,15,26,0.08))",
            color: "var(--wine-text)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "800 12px/1 var(--f-display)",
            flexShrink: 0,
          }}
        >
          {initials || "??"}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "700 13px/1.2 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {op.display_name}
            {op.display_name_cn ? (
              <span
                style={{
                  font: '500 12px/1.2 "Noto Sans SC", var(--f-sans)',
                  color: "var(--ink-soft)",
                  marginLeft: 6,
                }}
              >
                · {op.display_name_cn}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Warehouse */}
      <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}>
        {op.warehouse_code ?? "—"}
      </span>

      {/* Rol */}
      <Badge tone={op.role === "supervisor" ? "wine" : "neutral"} size="sm">
        {op.role === "supervisor" ? "Supervisor" : "Operario"}
      </Badge>

      {/* Last login */}
      <span
        style={{
          font: "500 12px/1.2 var(--f-sans)",
          color: op.last_login_at ? "var(--ink-soft)" : "var(--ink-mute)",
        }}
      >
        {lastLogin}
      </span>

      {/* Active toggle */}
      <ActiveToggle op={op} onReactivar={onReactivar} />

      {/* Acciones */}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
        <button
          type="button"
          onClick={() => onVerPin(op)}
          aria-label={`Ver PIN de ${op.display_name}`}
          className="studio-btn studio-btn-ghost studio-btn-sm"
        >
          Ver PIN
        </button>
        <button
          type="button"
          onClick={() => onResetPin(op)}
          aria-label={`Restablecer PIN de ${op.display_name}`}
          className="studio-btn studio-btn-ghost studio-btn-sm"
        >
          Restablecer PIN
        </button>
        <button
          type="button"
          onClick={() => onEdit(op)}
          aria-label="Editar"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ padding: "6px 10px" }}
        >
          {Icon.edit(13)}
        </button>
      </div>
    </div>
  );
}

/**
 * Activo → el toggle desactiva (el formulario de siempre). De baja → abre
 * «Reactivar», que le da un PIN nuevo: desde 0475 la base no deja reactivar sin
 * PIN nuevo, para que nadie vuelva con uno que otro operario activo ya usa.
 */
function ActiveToggle({
  op,
  onReactivar,
}: {
  op: OperarioRow;
  onReactivar: (op: OperarioRow) => void;
}) {
  if (!op.active) {
    return (
      <button
        type="button"
        onClick={() => onReactivar(op)}
        aria-label={`Reactivar a ${op.display_name} con un PIN nuevo`}
        style={toggleStyle(false)}
      >
        <span aria-hidden style={knobStyle(false)} />
      </button>
    );
  }
  return (
    <form action={setOperarioActiveAction}>
      <input type="hidden" name="operario_id" value={op.id} />
      <input type="hidden" name="active" value="false" />
      <button
        type="submit"
        aria-label={`Desactivar a ${op.display_name}`}
        style={toggleStyle(true)}
      >
        <span aria-hidden style={knobStyle(true)} />
      </button>
    </form>
  );
}

function toggleStyle(active: boolean): CSSProperties {
  return {
    width: 38,
    height: 24,
    borderRadius: 999,
    background: active ? "var(--success)" : "var(--ink-mute)",
    border: 0,
    position: "relative",
    cursor: "pointer",
    transition: "background var(--dur-fast) var(--ease)",
  };
}

function knobStyle(active: boolean): CSSProperties {
  return {
    position: "absolute",
    top: 3,
    left: active ? 18 : 2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#FFFFFF",
    transition: "left var(--dur-fast) var(--ease)",
  };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMin = Math.round((now - d.getTime()) / 60000);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD} d`;
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
