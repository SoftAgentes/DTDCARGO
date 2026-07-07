/**
 * PermissionsSection — sección "Permisos por rol" del admin (SDD-0124).
 *
 * Matriz READ-ONLY rol × módulo, derivada de la config RBAC estática
 * (`ROLE_MODULE_ACCESS` + `canAccessModule`/`canEditModule`, SDD-0085). Los
 * permisos viven en código (no en DB), así que acá se visualizan, no se editan.
 *
 * Server-safe (sin hooks): la config es data pura importable.
 */

import { MODULES, type Group } from "@/lib/studio/modules";
import { LOCKED_MODULES, canAccessModule, canEditModule } from "@/lib/studio/rbac";
import { Icon } from "@/app/studio/_components/icons";
import {
  STUDIO_USER_ROLES,
  ROLE_LABELS,
  type StudioUserRole,
} from "@/lib/studio/user-types";

const GROUP_ORDER: Group[] = ["OPERACIÓN", "COMERCIAL", "FINANZAS", "MARKETING", "SISTEMA"];

type Cell = { label: string; bg: string; fg: string };

function cellFor(role: StudioUserRole, moduleId: string): Cell {
  if (role === "admin") return { label: "TOTAL", bg: "var(--wine)", fg: "#fff" };
  const view = canAccessModule(role, moduleId);
  if (!view) return { label: "—", bg: "var(--bg-elevated)", fg: "var(--ink-mute)" };
  const edit = canEditModule(role, moduleId);
  return edit
    ? { label: "V·E", bg: "var(--success-bg)", fg: "var(--success)" }
    : { label: "V", bg: "var(--info-bg)", fg: "var(--info)" };
}

export function PermissionsSection() {
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: MODULES.filter((m) => m.group === g),
  })).filter((x) => x.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Leyenda */}
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "16px 20px",
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          alignItems: "center",
          font: "500 12px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
        }}
      >
        <b style={{ color: "var(--ink)" }}>Códigos:</b>
        <span><b style={{ color: "var(--wine)" }}>TOTAL</b> admin (todo)</span>
        <span><b style={{ color: "var(--success)" }}>V·E</b> ver + editar</span>
        <span><b style={{ color: "var(--info)" }}>V</b> solo ver</span>
        <span><b style={{ color: "var(--ink-mute)" }}>—</b> sin acceso</span>
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink-soft)" }}
          title="Candado de gobernanza — solo se cambia en código (dinero = Contabilidad · solo admin)"
          role="img"
          aria-label="Candado de gobernanza"
        >
          {Icon.lock(12)} candado de gobernanza
        </span>
        <span style={{ marginLeft: "auto", font: "600 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
          Definido en código (SDD-0085/0139) · read-only
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
                  padding: "12px 16px",
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
                    padding: "12px 8px",
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
              <GroupRows key={group} group={group} items={items} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function GroupRows({ group, items }: { group: Group; items: typeof MODULES }) {
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
      {items.map((m) => (
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
              {LOCKED_MODULES.has(m.id) && (
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
            const c = cellFor(r, m.id);
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
          })}
        </tr>
      ))}
    </>
  );
}
