"use client";

/**
 * PermissionsSection — sección "Permisos por rol" del admin (SDD-0124 →
 * SDD-0252: matriz editable en DB).
 *
 * Celdas NO bloqueadas: click cicla Ø → Ver → Ver+Editar → Ø (Ø vía
 * `studio_set_role_module_access(false,false)` — un desvío EXPLÍCITO, no un
 * "sin override"). `support` cicla Ø → Ver → Ø (nunca edita, es read-only V1
 * inmutable). Una celda con override activo muestra un punto y, al pasar el
 * mouse, un botón "×" que la vuelve al default de código
 * (`studio_reset_role_module_access`).
 *
 * Celdas bloqueadas (candado de gobernanza — dinero ∪ admin-only) y la
 * columna `admin` NO son clickeables: el candado real vive en el RPC (y en un
 * CHECK de la tabla), esto es sólo UX que no lo intenta.
 */

import { useState, useTransition } from "react";
import { MODULES, type Group } from "@/lib/studio/modules";
import {
  LOCKED_MODULES,
  canAccessModule,
  canEditModule,
  type RoleModuleOverrides,
} from "@/lib/studio/rbac";
import { Icon } from "@/app/studio/_components/icons";
import {
  STUDIO_USER_ROLES,
  ROLE_LABELS,
  type StudioUserRole,
} from "@/lib/studio/user-types";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  resetRoleModuleAccessAction,
  setRoleModuleAccessAction,
} from "../actions";

const GROUP_ORDER: Group[] = ["OPERACIÓN", "COMERCIAL", "FINANZAS", "MARKETING", "SISTEMA"];

type Cell = { label: string; bg: string; fg: string };

function cellFor(
  role: StudioUserRole,
  moduleId: string,
  overrides: RoleModuleOverrides,
): Cell {
  if (role === "admin") return { label: "TOTAL", bg: "var(--wine)", fg: "#fff" };
  const view = canAccessModule(role, moduleId, overrides);
  if (!view) return { label: "—", bg: "var(--bg-elevated)", fg: "var(--ink-mute)" };
  const edit = canEditModule(role, moduleId, overrides);
  return edit
    ? { label: "V·E", bg: "var(--success-bg)", fg: "var(--success)" }
    : { label: "V", bg: "var(--info-bg)", fg: "var(--info)" };
}

/** Siguiente estado del ciclo — support nunca pasa por V·E (read-only V1). */
function nextState(
  role: StudioUserRole,
  current: { view: boolean; edit: boolean },
): { view: boolean; edit: boolean } {
  if (!current.view) return { view: true, edit: false };
  if (!current.edit) {
    if (role === "support") return { view: false, edit: false };
    return { view: true, edit: true };
  }
  return { view: false, edit: false };
}

export function PermissionsSection({
  initialOverrides = {},
}: {
  initialOverrides?: RoleModuleOverrides;
}) {
  const [overrides, setOverrides] = useState<RoleModuleOverrides>(initialOverrides);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: MODULES.filter((m) => m.group === g),
  })).filter((x) => x.items.length > 0);

  const handleCycle = (role: StudioUserRole, moduleId: string) => {
    const key = `${role}:${moduleId}`;
    if (pendingKey) return;
    const current = overrides[key] ?? {
      view: canAccessModule(role, moduleId),
      edit: canEditModule(role, moduleId),
    };
    const next = nextState(role, current);
    setPendingKey(key);
    const previous = overrides;
    setOverrides({ ...overrides, [key]: next });
    startTransition(async () => {
      const res = await setRoleModuleAccessAction(role, moduleId, next.view, next.edit);
      setPendingKey(null);
      if (res.error) {
        setOverrides(previous);
        toast.error(res.error);
      }
    });
  };

  const handleReset = (role: StudioUserRole, moduleId: string) => {
    const key = `${role}:${moduleId}`;
    if (pendingKey) return;
    setPendingKey(key);
    const previous = overrides;
    const rest = { ...overrides };
    delete rest[key];
    setOverrides(rest);
    startTransition(async () => {
      const res = await resetRoleModuleAccessAction(role, moduleId);
      setPendingKey(null);
      if (res.error) {
        setOverrides(previous);
        toast.error(res.error);
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Leyenda */}
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-4) var(--s-5)",
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          alignItems: "center",
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
        }}
      >
        <b style={{ color: "var(--ink)" }}>Códigos:</b>
        <span><b style={{ color: "var(--wine-text)" }}>TOTAL</b> admin (todo)</span>
        <span><b style={{ color: "var(--success)" }}>V·E</b> ver + editar</span>
        <span><b style={{ color: "var(--info)" }}>V</b> solo ver</span>
        <span><b style={{ color: "var(--ink-mute)" }}>—</b> sin acceso</span>
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-1)", color: "var(--ink-soft)" }}
          title="Candado de gobernanza — solo se cambia en código (dinero = Contabilidad · solo admin)"
          role="img"
          aria-label="Candado de gobernanza"
        >
          {Icon.lock(12)} candado de gobernanza
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--wine)" }} />
          desvío del default — click × para quitarlo
        </span>
        <span style={{ marginLeft: "auto", font: "600 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
          Click en una celda para cambiarla
        </span>
      </section>

      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: "var(--bg-elevated)" }}>
              <th
                style={{
                  padding: "var(--s-3) var(--s-4)",
                  textAlign: "left",
                  font: "700 10px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  position: "sticky",
                  left: 0,
                  background: "var(--bg-elevated)",
                  zIndex: 2,
                }}
              >
                Módulo
              </th>
              {STUDIO_USER_ROLES.map((r) => (
                <th
                  key={r}
                  style={{
                    padding: "var(--s-3) var(--s-2)",
                    font: "700 10px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ group, items }) => (
              <GroupRows
                key={group}
                group={group}
                items={items}
                overrides={overrides}
                pendingKey={pendingKey}
                onCycle={handleCycle}
                onReset={handleReset}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function GroupRows({
  group,
  items,
  overrides,
  pendingKey,
  onCycle,
  onReset,
}: {
  group: Group;
  items: typeof MODULES;
  overrides: RoleModuleOverrides;
  pendingKey: string | null;
  onCycle: (role: StudioUserRole, moduleId: string) => void;
  onReset: (role: StudioUserRole, moduleId: string) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={1 + STUDIO_USER_ROLES.length}
          style={{
            padding: "10px 16px 4px",
            font: "700 9.5px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "var(--bg-surface)",
          }}
        >
          {group}
        </td>
      </tr>
      {items.map((m) => {
        const locked = LOCKED_MODULES.has(m.id);
        return (
          <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
            <td
              style={{
                padding: "10px 16px",
                font: "600 12.5px/1.2 var(--f-sans)",
                color: "var(--ink)",
                position: "sticky",
                left: 0,
                background: "var(--bg-surface)",
                borderRight: "1px solid var(--border)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {m.label}
                {locked && (
                  <span
                    style={{ color: "var(--ink-mute)", display: "inline-flex" }}
                    title="Candado de gobernanza — solo se cambia en código"
                    role="img"
                    aria-label="Candado de gobernanza"
                  >
                    {Icon.lock(12)}
                  </span>
                )}
              </span>
            </td>
            {STUDIO_USER_ROLES.map((r) => {
              if (r === "admin" || locked) {
                const c = cellFor(r, m.id, overrides);
                return (
                  <td key={r} style={{ padding: "8px 6px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        minWidth: 42,
                        padding: "5px 8px",
                        borderRadius: "var(--r-sm)",
                        background: c.bg,
                        color: c.fg,
                        font: "700 10.5px/1 var(--f-mono)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {c.label}
                    </span>
                  </td>
                );
              }
              const key = `${r}:${m.id}`;
              const overridden = key in overrides;
              const c = cellFor(r, m.id, overrides);
              const pending = pendingKey === key;
              return (
                <td key={r} style={{ padding: "8px 6px", textAlign: "center" }}>
                  <span
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onCycle(r, m.id)}
                      disabled={pending}
                      title="Click para cambiar"
                      className="studio-permcell"
                      style={{
                        minWidth: 42,
                        padding: "5px 8px",
                        borderRadius: "var(--r-sm)",
                        background: c.bg,
                        color: c.fg,
                        font: "700 10.5px/1 var(--f-mono)",
                        letterSpacing: "0.04em",
                        border: 0,
                        cursor: pending ? "wait" : "pointer",
                        opacity: pending ? 0.55 : 1,
                      }}
                    >
                      {c.label}
                    </button>
                    {overridden && (
                      <>
                        <span
                          aria-hidden
                          style={{
                            position: "absolute",
                            top: -3,
                            right: -3,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--wine)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => onReset(r, m.id)}
                          disabled={pending}
                          title="Quitar desvío — vuelve al default"
                          aria-label={`Quitar desvío de ${ROLE_LABELS[r]} sobre ${m.label}`}
                          className="studio-permcell-reset"
                          style={{
                            marginLeft: 3,
                            width: 16,
                            height: 16,
                            display: "inline-grid",
                            placeItems: "center",
                            borderRadius: "50%",
                            background: "transparent",
                            color: "var(--ink-mute)",
                            border: "1px solid var(--border)",
                            cursor: pending ? "wait" : "pointer",
                            font: "700 9px/1 var(--f-sans)",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </span>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
