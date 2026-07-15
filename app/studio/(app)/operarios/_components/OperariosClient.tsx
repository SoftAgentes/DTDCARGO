"use client";

/**
 * OperariosClient — tabla + drawers Nuevo/Reset PIN/Editar (SDD-0028).
 */

import { useState } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import type { WarehouseCN } from "@/lib/studio/warehouse-cn-types";
import { setOperarioActiveAction } from "../actions";
import { NewOperarioDrawer } from "./NewOperarioDrawer";
import { ResetPinDrawer } from "./ResetPinDrawer";
import { EditOperarioDrawer } from "./EditOperarioDrawer";

type DrawerKind = null | "new" | "reset" | "edit";

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
  const openReset = (op: OperarioRow) => {
    setSelected(op);
    setDrawer("reset");
  };
  const openEdit = (op: OperarioRow) => {
    setSelected(op);
    setDrawer("edit");
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
          description="Cada operario tiene un PIN de 4 dígitos para entrar a la PWA mobile. Crea el primero."
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
          onResetPin={openReset}
          onEdit={openEdit}
        />
      )}

      {drawer === "new" && (
        <NewOperarioDrawer warehouses={warehouses} onClose={close} />
      )}
      {drawer === "reset" && selected && (
        <ResetPinDrawer operario={selected} onClose={close} />
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
  onResetPin,
  onEdit,
}: {
  operarios: OperarioRow[];
  onResetPin: (op: OperarioRow) => void;
  onEdit: (op: OperarioRow) => void;
}) {
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
          gridTemplateColumns: "1fr 130px 130px 160px 90px 200px",
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
        <OperarioRowItem
          key={op.id}
          op={op}
          first={i === 0}
          onResetPin={onResetPin}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function OperarioRowItem({
  op,
  first,
  onResetPin,
  onEdit,
}: {
  op: OperarioRow;
  first: boolean;
  onResetPin: (op: OperarioRow) => void;
  onEdit: (op: OperarioRow) => void;
}) {
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
        gridTemplateColumns: "1fr 130px 130px 160px 90px 200px",
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
      <ActiveToggle op={op} />

      {/* Acciones */}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => onResetPin(op)}
          className="studio-btn studio-btn-ghost studio-btn-sm"
        >
          Reset PIN
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

function ActiveToggle({ op }: { op: OperarioRow }) {
  return (
    <form action={setOperarioActiveAction}>
      <input type="hidden" name="operario_id" value={op.id} />
      <input type="hidden" name="active" value={op.active ? "false" : "true"} />
      <button
        type="submit"
        aria-label={op.active ? "Desactivar operario" : "Activar operario"}
        style={{
          width: 38,
          height: 24,
          borderRadius: 999,
          background: op.active ? "var(--success)" : "var(--ink-mute)",
          border: 0,
          position: "relative",
          cursor: "pointer",
          transition: "background var(--dur-fast) var(--ease)",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            left: op.active ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#FFFFFF",
            transition: "left var(--dur-fast) var(--ease)",
          }}
        />
      </button>
    </form>
  );
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
