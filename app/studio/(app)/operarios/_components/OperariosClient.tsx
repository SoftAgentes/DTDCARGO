"use client";

/**
 * OperariosClient — tabla + drawers Nuevo/Restablecer PIN/Editar (SDD-0028, SDD-0513)
 * y, desde SDD-0515, «Ver PIN» y «Reactivar» (un operario de baja vuelve con PIN nuevo).
 *
 * Cada fila dice por qué app entra el operario según su región («Entra por
 * dtdcargo.com/m/cn/login» o «…/m/ve/login»): el PIN de uno de China no sirve
 * en la de Venezuela, y al revés. La columna «Rol» muestra los cuatro roles de
 * la base (operario, supervisor, bodeguero, camionero); antes todo lo que no
 * era supervisor salía como «Operario».
 *
 * SDD-0520: las columnas se ajustan arrastrando el borde del encabezado (o con
 * las flechas sobre el asa) y el ancho queda guardado en este navegador. La
 * columna «Operario» tiene un mínimo que deja leer el nombre y «Entra por …»;
 * si la suma no cabe, la tabla hace scroll horizontal en vez de aplastar el
 * nombre. Los botones de la fila son `studio-btn-xs`.
 */

import { useState, type CSSProperties } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  ColumnResizeHandle,
  useColumnWidths,
  type ColumnWidthsController,
} from "@/app/studio/_components/ui/columns/ColumnResize";
import type { ColumnWidthSpec } from "@/app/studio/_components/ui/columns/column-widths";
import { Icon } from "@/app/studio/_components/icons";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";
import { operarioLoginLabel, operarioRolLabel } from "@/lib/studio/operario-pin";
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

/**
 * Columnas de la tabla (SDD-0520). Anchos en px, múltiplos de 4, MEDIDOS en
 * Chromium con la tipografía real (la tabla de medidas está en la spec): el
 * mínimo de cada columna deja leer su peor caso.
 *
 * - «Operario» absorbe el espacio libre mientras nadie la ajuste (como antes),
 *   pero con piso de 260 px: avatar 36 + gap 12 + «Entra por
 *   dtdcargo.com/m/cn/login», que mide 209,8 px con JetBrains Mono. Por debajo
 *   de eso la tabla hace scroll horizontal; ya no se aplasta a «L…».
 * - Si el usuario la ajusta, queda exacta y el espacio libre pasa a «Acciones»,
 *   que va al final y no se ajusta: «Ver PIN» + «Restablecer PIN» + lápiz en
 *   xs miden 223,4 px con sus gaps. Los botones no se parten (nowrap): si algún
 *   día no caben, se ve el desborde en vez de crecer la fila.
 * - Con los defaults la tabla pide 944 px: cabe en el contenido del Studio con
 *   una ventana de 1280 px (968 px útiles).
 */
export const OPERARIOS_COLUMNS: readonly ColumnWidthSpec[] = [
  { key: "operario", label: "Operario", defaultWidth: 260, minWidth: 260, maxWidth: 640, grow: true },
  { key: "warehouse", label: "Warehouse", defaultWidth: 88, minWidth: 72, maxWidth: 240 },
  { key: "rol", label: "Rol", defaultWidth: 104, minWidth: 88, maxWidth: 200 },
  { key: "ultimo_login", label: "Último login", defaultWidth: 96, minWidth: 80, maxWidth: 200 },
  { key: "activo", label: "Activo", defaultWidth: 64, minWidth: 48, maxWidth: 120 },
  {
    key: "acciones",
    label: "Acciones",
    defaultWidth: 232,
    minWidth: 232,
    maxWidth: 232,
    resizable: false,
    grow: true,
  },
];

/** Clave versionada: si cambia el formato de lo guardado, se sube a -v2. */
export const OPERARIOS_COLUMN_WIDTHS_KEY = "dtd-operarios-col-widths-v1";

const GRID_GAP = 12;
const PAD_X = 20;

export function OperariosClient({
  operarios,
  warehouses,
}: {
  operarios: OperarioRow[];
  warehouses: WarehouseCN[];
}) {
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [selected, setSelected] = useState<OperarioRow | null>(null);
  const columns = useColumnWidths(OPERARIOS_COLUMN_WIDTHS_KEY, OPERARIOS_COLUMNS);

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
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
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
          {/* Sólo aparece cuando hay algo que restablecer: un botón deshabilitado
              sin explicación no ayuda (BTN-01 §6). */}
          {operarios.length > 0 && columns.customized && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              onClick={columns.resetAll}
              title="Vuelve todas las columnas a su ancho original"
            >
              Restablecer columnas
            </button>
          )}
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
          columns={columns}
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

const HEADER_PAD_Y = 10;

function OperariosTable({
  operarios,
  columns,
  ...actions
}: { operarios: OperarioRow[]; columns: ColumnWidthsController } & RowActions) {
  // Piso de la tabla: si el contenedor es más angosto, scroll horizontal (el
  // nombre no se aplasta). Encabezado y filas usan el mismo `columns.template`.
  const minWidth =
    columns.totalWidth + GRID_GAP * (columns.specs.length - 1) + PAD_X * 2;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth }}>
          {/* Header columnas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: columns.template,
              gap: GRID_GAP,
              padding: `${HEADER_PAD_Y}px ${PAD_X}px`,
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
            }}
          >
            {columns.specs.map((spec) => (
              <div
                key={spec.key}
                style={{
                  position: "relative",
                  minWidth: 0,
                  textAlign: spec.key === "acciones" ? "right" : undefined,
                }}
              >
                <span
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {spec.label}
                </span>
                <ColumnResizeHandle
                  controller={columns}
                  columnKey={spec.key}
                  gap={GRID_GAP}
                  insetBlock={HEADER_PAD_Y}
                />
              </div>
            ))}
          </div>

          {operarios.map((op, i) => (
            <OperarioRowItem
              key={op.id}
              op={op}
              first={i === 0}
              template={columns.template}
              {...actions}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const ellipsis: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function OperarioRowItem({
  op,
  first,
  template,
  onResetPin,
  onReactivar,
  onVerPin,
  onEdit,
}: { op: OperarioRow; first: boolean; template: string } & RowActions) {
  const initials = op.display_name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  const lastLogin = op.last_login_at
    ? formatDateTime(op.last_login_at)
    : "Nunca";
  const fullName = op.display_name_cn
    ? `${op.display_name} · ${op.display_name_cn}`
    : op.display_name;
  const loginLabel = operarioLoginLabel(op.region);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: template,
        gap: GRID_GAP,
        padding: `12px ${PAD_X}px`,
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
          {/* Si el ancho no alcanza, el nombre completo queda en el title. */}
          <div
            title={fullName}
            style={{
              font: "700 13px/1.2 var(--f-sans)",
              color: "var(--ink)",
              ...ellipsis,
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
          <div
            title={`Entra por ${loginLabel}`}
            style={{
              font: "500 11.5px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 3,
              ...ellipsis,
            }}
          >
            Entra por{" "}
            <span style={{ font: "600 11.5px/1.3 var(--f-mono)", color: "var(--ink)" }}>
              {loginLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Warehouse */}
      <span
        title={op.warehouse_code ?? undefined}
        style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)", ...ellipsis }}
      >
        {op.warehouse_code ?? "—"}
      </span>

      {/* Rol */}
      <div style={{ minWidth: 0 }}>
        <Badge tone={op.role === "supervisor" ? "wine" : "neutral"} size="sm">
          {operarioRolLabel(op.role)}
        </Badge>
      </div>

      {/* Last login */}
      <span
        style={{
          font: "500 12px/1.2 var(--f-sans)",
          color: op.last_login_at ? "var(--ink-soft)" : "var(--ink-mute)",
          ...ellipsis,
        }}
      >
        {lastLogin}
      </span>

      {/* Active toggle */}
      <ActiveToggle op={op} onReactivar={onReactivar} />

      {/* Acciones · tamaño xs (SDD-0520): textos y nombres accesibles de siempre */}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
        <button
          type="button"
          onClick={() => onVerPin(op)}
          aria-label={`Ver PIN de ${op.display_name}`}
          className="studio-btn studio-btn-ghost studio-btn-xs"
        >
          Ver PIN
        </button>
        <button
          type="button"
          onClick={() => onResetPin(op)}
          aria-label={`Restablecer PIN de ${op.display_name}`}
          className="studio-btn studio-btn-ghost studio-btn-xs"
        >
          Restablecer PIN
        </button>
        <button
          type="button"
          onClick={() => onEdit(op)}
          aria-label="Editar"
          title="Editar"
          className="studio-btn studio-btn-ghost studio-btn-xs"
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
