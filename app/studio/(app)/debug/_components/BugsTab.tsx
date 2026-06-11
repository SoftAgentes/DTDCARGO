/**
 * Pestaña "Bugs" de la torre de control (/studio/debug · SDD-0050 Slice A).
 *
 * Lista READ-ONLY de los últimos bugs del tenant — reusa las queries del Bug
 * Reporter (SDD-0036, `listBugsForAdmin`) sin reescribir nada. Multi-tenant: la
 * lista llega ya filtrada por RLS (la query usa el SupabaseClient del usuario
 * logueado en `page.tsx`). Para gestionar (tomar, conversar, resolver) se
 * enlaza al módulo completo `/studio/bugs`.
 *
 * Server component.
 */

import Link from "next/link";
import {
  BUG_STATE_LABELS,
  BUG_STATE_TONES,
  type BugReport,
} from "@/lib/studio/bug-types";
import { Badge } from "../../../_components/ui/Badge";
import { EmptyState } from "../../../_components/ui/EmptyState";

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-VE");
}

export type BugsTabProps = {
  bugs: BugReport[];
  /** true cuando el usuario es admin del tenant (ve todos los bugs). */
  isAdmin: boolean;
};

export function BugsTab({ bugs, isAdmin }: BugsTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-5) var(--s-6)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            margin: "0 0 var(--s-4) 0",
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {isAdmin ? "Bugs del tenant" : "Mis bugs"}
            {bugs.length > 0 ? ` (${bugs.length})` : ""}
          </h2>
          <Link
            href="/studio/bugs"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            style={{ textDecoration: "none" }}
          >
            Abrir Bug Tracker <span aria-hidden style={{ marginLeft: 4 }}>→</span>
          </Link>
        </div>

        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: 12.5,
            margin: "0 0 var(--s-4) 0",
            lineHeight: 1.5,
          }}
        >
          Vista read-only del Bug Reporter (SDD-0036). Para tomar, conversar o
          resolver un bug, abre el módulo completo.
        </p>

        {bugs.length === 0 ? (
          <EmptyState
            eyebrow="Bug Reporter"
            title="Sin bugs por ahora"
            description="Cuando se reporte un bug desde el FAB del Studio aparecerá acá."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {bugs.map((b) => (
              <Link
                key={b.id}
                href="/studio/bugs"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  alignItems: "center",
                  gap: "var(--s-4)",
                  padding: "var(--s-3) 0",
                  borderTop: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <code
                  style={{
                    fontFamily: "var(--f-mono)",
                    fontSize: 11.5,
                    color: "var(--ink-mute)",
                    background: "var(--bg-elevated)",
                    padding: "2px 6px",
                    borderRadius: "var(--r-xs)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.folio}
                </code>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--ink)",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={b.title}
                  >
                    {b.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-soft)",
                      marginTop: 2,
                    }}
                  >
                    {b.module}
                  </div>
                </div>
                <Badge tone={BUG_STATE_TONES[b.state]} size="md" dot>
                  {BUG_STATE_LABELS[b.state]}
                </Badge>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-soft)",
                    whiteSpace: "nowrap",
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {relativeDate(b.created_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
