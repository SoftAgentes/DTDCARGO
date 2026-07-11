"use client";

/**
 * PortalBackfillSection — invitación por lotes al portal (adopción · 2026-07-11).
 *
 * Lista los clientes SIN acceso al portal que tienen email válido (candidatos),
 * el admin los filtra (excluir demos), selecciona y los invita por tandas. Manda
 * correos REALES → tope de 20 por tanda (lo fuerza el server). Solo tokens var(--*).
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import type {
  PortalInviteCandidate,
  PortalAdoptionStats,
} from "@/lib/studio/client-queries";
import {
  bulkInvitePortalAction,
  type BulkInviteState,
} from "../portal-backfill-actions";

const MAX_PER_BATCH = 20;

function pct(n: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((n / total) * 100)}%`;
}

function AdoptionFunnel({ stats }: { stats: PortalAdoptionStats }) {
  const steps = [
    { label: "Clientes", value: stats.totalClients, sub: "total" },
    {
      label: "Con acceso",
      value: stats.withAccess,
      sub: pct(stats.withAccess, stats.totalClients),
    },
    {
      label: "Entraron",
      value: stats.loggedIn,
      sub: pct(stats.loggedIn, stats.totalClients),
    },
    {
      label: "Anunciaron compra",
      value: stats.announced,
      sub: pct(stats.announced, stats.totalClients),
    },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 10,
      }}
    >
      {steps.map((s) => (
        <div
          key={s.label}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              font: "800 24px/1.1 var(--f-mono)",
              color: "var(--ink)",
              marginTop: 6,
            }}
          >
            {s.value}
          </div>
          <div
            style={{
              font: "600 11px/1 var(--f-mono)",
              color: "var(--wine)",
              marginTop: 3,
            }}
          >
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PortalBackfillSection({
  candidates,
  stats,
}: {
  candidates: PortalInviteCandidate[];
  stats: PortalAdoptionStats | null;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState<BulkInviteState, FormData>(
    bulkInvitePortalAction,
    {},
  );

  // Al volver un resultado OK, limpiar selección (los invitados ya no están en la lista).
  useEffect(() => {
    if (state.ok) setSelected(new Set());
  }, [state.ok]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.markbox.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [candidates, search]);

  // "Seleccionar todos" IGNORA los posibles demo (protección del masivo): nunca
  // los agarra en bloque; hay que marcarlos uno por uno a propósito.
  const selectableFiltered = useMemo(
    () => filtered.filter((c) => !c.isLikelyDemo),
    [filtered],
  );
  const demoInList = useMemo(
    () => candidates.filter((c) => c.isLikelyDemo).length,
    [candidates],
  );
  const allFilteredSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((c) => selected.has(c.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected)
        selectableFiltered.forEach((c) => next.delete(c.id));
      else selectableFiltered.forEach((c) => next.add(c.id));
      return next;
    });

  const selectedIds = [...selected];
  const willProcess = Math.min(selectedIds.length, MAX_PER_BATCH);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {stats && <AdoptionFunnel stats={stats} />}
      {stats && stats.withoutEmail > 0 && (
        <div
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "10px 13px",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>{stats.withoutEmail}</strong>{" "}
          clientes sin acceso NO tienen correo válido → no aparecen abajo. El
          equipo debe capturarles el correo (o teléfono) para poder invitarlos.
        </div>
      )}

      {candidates.length === 0 ? (
        <EmptyState
          eyebrow="Sin candidatos con correo"
          title="No hay clientes con email pendientes de invitar."
          description="Todos los que tienen correo válido ya recibieron acceso. Los que faltan no tienen correo — captúralo primero."
        />
      ) : (
        <>
      {/* Aviso: correos reales */}
      <div
        style={{
          font: "500 12.5px/1.5 var(--f-sans)",
          color: "var(--ink)",
          background: "var(--warning-tint, var(--bg-elevated))",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--warning)",
          borderRadius: "var(--r-sm)",
          padding: "11px 14px",
        }}
      >
        Esto envía <strong>correos reales</strong> de invitación. Se invita en
        tandas de <strong>{MAX_PER_BATCH}</strong> — corre el botón varias veces
        para el resto.
        {demoInList > 0 ? (
          <>
            {" "}
            Marcamos <strong>{demoInList}</strong> como posible demo (badge{" "}
            <em>demo?</em>): <strong>no</strong> entran en “seleccionar todos” —
            márcalos a mano solo si de verdad quieres invitarlos.
          </>
        ) : null}
      </div>

      {/* Resultado de la última tanda */}
      {state.ok && (
        <div
          role="status"
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--success)",
            borderRadius: "var(--r-sm)",
            padding: "11px 14px",
          }}
        >
          <strong>{state.invited ?? 0}</strong> invitados con correo.
          {state.emailFailed
            ? ` ${state.emailFailed} con acceso creado pero sin correo (reintentá).`
            : ""}
          {state.failed ? ` ${state.failed} no se pudieron habilitar.` : ""}
          {state.remaining
            ? ` Quedaron ${state.remaining} seleccionados sin procesar — corré de nuevo.`
            : ""}
          {state.details ? (
            <span style={{ color: "var(--ink-soft)" }}> · {state.details}</span>
          ) : null}
        </div>
      )}
      {state.error && (
        <div
          role="alert"
          style={{
            font: "600 12.5px/1.5 var(--f-sans)",
            color: "var(--danger)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            padding: "11px 14px",
          }}
        >
          {state.error}
        </div>
      )}

      {/* Toolbar: búsqueda + acción */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-2)",
            flex: "1 1 240px",
            minWidth: 200,
            maxWidth: 420,
            height: 34,
            padding: "0 10px",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-sm)",
          }}
        >
          <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
            {Icon.search(13)}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar / excluir por nombre, Shipping Mark o correo…"
            aria-label="Buscar candidatos"
            style={{
              flex: 1,
              height: "100%",
              border: 0,
              background: "transparent",
              font: "500 12.5px/1 var(--f-sans)",
              color: "var(--ink)",
            }}
          />
        </div>

        <span
          style={{
            font: "600 12px/1 var(--f-mono)",
            color: "var(--ink-soft)",
            marginLeft: "auto",
          }}
        >
          {selected.size} seleccionados · {candidates.length} candidatos
        </span>

        <form action={formAction}>
          <input type="hidden" name="client_ids" value={selectedIds.join(",")} />
          <button
            type="submit"
            disabled={pending || selectedIds.length === 0}
            className="studio-btn studio-btn-primary studio-btn-sm"
          >
            {pending
              ? "Invitando…"
              : `Invitar ${willProcess}${
                  selectedIds.length > MAX_PER_BATCH ? ` (de ${selectedIds.length})` : ""
                }`}
          </button>
        </form>
      </div>

      {/* Tabla de candidatos */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "34px minmax(140px,1.4fr) 120px minmax(160px,1.6fr)",
            gap: "var(--s-3)",
            padding: "var(--s-3) var(--s-5)",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAllFiltered}
            aria-label="Seleccionar todos los visibles"
            style={{ cursor: "pointer", width: 15, height: 15 }}
          />
          <span>Cliente</span>
          <span>Shipping Mark</span>
          <span>Correo</span>
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              padding: "20px",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-mute)",
              textAlign: "center",
            }}
          >
            Nada coincide con tu búsqueda.
          </div>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map((c, i) => {
              const on = selected.has(c.id);
              return (
                <label
                  key={c.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "34px minmax(140px,1.4fr) 120px minmax(160px,1.6fr)",
                    gap: "var(--s-3)",
                    padding: "11px 20px",
                    borderTop: i > 0 ? "1px solid var(--border)" : 0,
                    alignItems: "center",
                    cursor: "pointer",
                    background: on ? "var(--wine-tint)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(c.id)}
                    aria-label={`Seleccionar ${c.name}`}
                    style={{ cursor: "pointer", width: 15, height: 15 }}
                  />
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        font: "600 12.5px/1.3 var(--f-sans)",
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name || "—"}
                    </span>
                    {c.isLikelyDemo && (
                      <span
                        title="Parece cliente de prueba — revísalo antes de invitar"
                        style={{
                          flexShrink: 0,
                          font: "700 9px/1 var(--f-sans)",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "var(--warning)",
                          background: "var(--warning-tint, var(--bg-elevated))",
                          border: "1px solid var(--warning)",
                          borderRadius: "var(--r-pill)",
                          padding: "2px 6px",
                        }}
                      >
                        demo?
                      </span>
                    )}
                  </span>
                  <code
                    style={{
                      font: "600 11.5px/1.2 var(--f-mono)",
                      color: "var(--wine)",
                    }}
                  >
                    {c.markbox || "—"}
                  </code>
                  <span
                    style={{
                      font: "500 12px/1.3 var(--f-mono)",
                      color: "var(--ink-soft)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.email}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
