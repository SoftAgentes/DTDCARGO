"use client";

/**
 * Tab "Plan de cuentas" (SDD-0040).
 *
 * Árbol del CoA (expand/collapse), badge de tipo y saldo por cuenta (con
 * rollup). "+ Cuenta" abre el drawer para agregar una hoja. Click en una
 * cuenta postable la abre para editar.
 */

import { useMemo, useState } from "react";
import {
  acctTypeBadgeTone,
  acctTypeLabel,
  accountDepth,
  buildAccountTree,
  flattenTree,
  type Account,
  type AccountNode,
} from "@/lib/studio/account-types";
import type { AccountBalanceMap } from "@/lib/studio/account-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import { fmtSigned } from "./format";
import { AccountDrawer } from "./AccountDrawer";

export function PlanCuentasTab({
  accounts,
  balances,
  showCreate,
  onOpenCreate,
  onCloseCreate,
}: {
  accounts: Account[];
  balances: AccountBalanceMap;
  showCreate: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
}) {
  const tree = useMemo(() => buildAccountTree(accounts), [accounts]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  // Por defecto colapsamos los nodos de profundidad ≥2 para no abrumar.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const n of flat) {
      if (n.children.length > 0 && accountDepth(n.code) >= 1) init.add(n.id);
    }
    return init;
  });
  const [editing, setEditing] = useState<Account | null>(null);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Filtrar a las filas visibles: una fila se muestra si ninguno de sus
  // ancestros está colapsado.
  const visibleRows = useMemo(() => {
    const out: AccountNode[] = [];
    const walk = (nodes: AccountNode[], hidden: boolean) => {
      for (const n of nodes) {
        if (!hidden) out.push(n);
        const childHidden = hidden || collapsed.has(n.id);
        walk(n.children, childHidden);
      }
    };
    walk(tree, false);
    return out;
  }, [tree, collapsed]);

  if (accounts.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin plan de cuentas"
        title="Aún no hay cuentas."
        description="El plan de cuentas se siembra con la migración. Si quieres, agrega una cuenta manual."
        action={
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={onOpenCreate}
          >
            + Cuenta
          </button>
        }
      />
    );
  }

  const GRID = "1.6fr 130px 120px 120px 120px";

  return (
    <>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        {/* Head */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            gap: 12,
            padding: "var(--s-3) var(--s-5)",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
          }}
        >
          <span>Cuenta</span>
          <span>Tipo</span>
          <span style={{ textAlign: "right" }}>Debe</span>
          <span style={{ textAlign: "right" }}>Haber</span>
          <span style={{ textAlign: "right" }}>Saldo</span>
        </div>

        {visibleRows.map((node, i) => {
          const depth = accountDepth(node.code);
          const bal = balances[node.id];
          const hasChildren = node.children.length > 0;
          const isCollapsed = collapsed.has(node.id);
          const isGroup = !node.is_postable;
          return (
            <div
              key={node.id}
              className={isGroup ? undefined : "studio-tracking-row"}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 12,
                padding: "11px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
                background: isGroup ? "var(--bg-elevated)" : "transparent",
              }}
            >
              {/* Cuenta (indentada por depth) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingLeft: depth * 18,
                  minWidth: 0,
                }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggle(node.id)}
                    aria-label={isCollapsed ? "Expandir" : "Colapsar"}
                    aria-expanded={!isCollapsed}
                    style={{
                      width: 24,
                      height: 24,
                      display: "grid",
                      placeItems: "center",
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                      color: "var(--ink-soft)",
                      flexShrink: 0,
                      transform: isCollapsed ? "rotate(-90deg)" : "none",
                      transition: "transform var(--dur-fast, 0.12s) ease",
                    }}
                  >
                    {Icon.chevD(11)}
                  </button>
                ) : (
                  <span style={{ width: 18, flexShrink: 0 }} />
                )}
                <span
                  style={{
                    font: "700 11.5px/1 var(--f-mono)",
                    color: "var(--wine-text)",
                    flexShrink: 0,
                    minWidth: 52,
                  }}
                >
                  {node.code}
                </span>
                <button
                  type="button"
                  onClick={() => node.is_postable && setEditing(node)}
                  title={node.is_postable ? "Editar cuenta" : undefined}
                  style={{
                    font: `${isGroup ? "700" : "500"} 12.5px/1.3 var(--f-sans)`,
                    color: "var(--ink)",
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    textAlign: "left",
                    cursor: node.is_postable ? "pointer" : "default",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {node.name}
                </button>
              </div>

              <span>
                <Badge tone={acctTypeBadgeTone(node.type)} size="sm">
                  {acctTypeLabel(node.type)}
                </Badge>
              </span>

              <span
                style={{
                  font: "500 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                }}
              >
                {bal && bal.debit > 0 ? fmtSigned(bal.debit) : "—"}
              </span>
              <span
                style={{
                  font: "500 11.5px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                }}
              >
                {bal && bal.credit > 0 ? fmtSigned(bal.credit) : "—"}
              </span>
              <span
                style={{
                  font: "800 12px/1 var(--f-mono)",
                  color:
                    bal && bal.balance !== 0 ? "var(--ink)" : "var(--ink-mute)",
                  textAlign: "right",
                }}
              >
                {bal ? fmtSigned(bal.balance) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {(showCreate || editing) && (
        <AccountDrawer
          mode={editing ? "edit" : "create"}
          account={editing ?? undefined}
          accounts={accounts}
          onClose={() => {
            setEditing(null);
            onCloseCreate();
          }}
        />
      )}
    </>
  );
}
