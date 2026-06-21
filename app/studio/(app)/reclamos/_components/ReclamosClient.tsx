"use client";

/**
 * Orquestador client del módulo Reclamos (SDD-0101 · Slice A).
 *
 * KPIs + filtros (URL state) + tabla + detalle inline con stepper de 3 fases +
 * avance de estado (máquina, ActionButton + toast) + drawer crear/editar.
 * Fiel al handoff del Norte (docs/design/studio/_norte/reclamos/reclamos.jsx).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState, useTransition, type CSSProperties } from "react";
import {
  CLAIM_FILTERS,
  CLAIM_FLOW_STEPS,
  CLAIM_TRANSITION_LABEL,
  claimMatchesFilter,
  claimNextStatuses,
  claimStatusLabel,
  claimStatusStep,
  claimStatusTone,
  claimTypeLabel,
  claimTypeTone,
  computeClaimKpis,
  isClaimFilter,
  type ClaimFilter,
  type ClaimStatus,
  type ClientClaim,
} from "@/lib/studio/reclamos/claims-types";
import type {
  ClaimClientOption,
  ClaimShipmentOption,
} from "@/lib/studio/reclamos/claims-queries";
import {
  advanceClaimStatusAction,
  softDeleteClaimAction,
} from "../actions";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import { ClaimDrawer } from "./ClaimDrawer";

type DrawerState = null | { mode: "create" } | { mode: "edit"; claim: ClientClaim };

const USD = (n: number) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Oculto visualmente, accesible a lectores de pantalla (no hay clase .sr-only). */
const SR_ONLY: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function ReclamosClient({
  claims,
  clients,
  shipments,
  canEdit,
}: {
  claims: ClientClaim[];
  clients: ClaimClientOption[];
  shipments: ClaimShipmentOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();
  const flashClassFor = useRowHighlight();

  const filter: ClaimFilter = isClaimFilter(params.get("filter"))
    ? (params.get("filter") as ClaimFilter)
    : "todos";

  const kpis = computeClaimKpis(claims);
  const rows = claims.filter((c) => claimMatchesFilter(c, filter));

  const pushFilter = (next: ClaimFilter) => {
    const s = new URLSearchParams();
    if (next !== "todos") s.set("filter", next);
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/reclamos?${qs}` : "/studio/reclamos");
    });
  };

  const selectedClaim = selected
    ? rows.find((c) => c.id === selected) ?? claims.find((c) => c.id === selected) ?? null
    : null;

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación · Post-venta</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Reclamos y siniestros.
          </h1>
          <p
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "66ch",
            }}
          >
            Incidencias de carga — daños, faltantes y retrasos — atadas a la orden
            y al Shipping Mark, con seguimiento de la cobertura de seguro.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setDrawer({ mode: "create" })}
          >
            + Nuevo reclamo
          </button>
        )}
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <KpiCard
          label="Reclamos abiertos"
          value={kpis.open_count}
          sub="en evaluación o aprobados"
          valueColor={kpis.open_count > 0 ? "var(--warning)" : "var(--ink)"}
        />
        <KpiCard
          label="Monto expuesto"
          value={USD(kpis.exposed_usd)}
          sub="reclamos abiertos"
          valueColor="var(--wine)"
          highlightWhenPositive={false}
        />
        <KpiCard
          label="Con seguro"
          value={`${kpis.insured_count} / ${kpis.total_count}`}
          sub="cubiertos por póliza"
        />
        <KpiCard
          label="Pagado"
          value={USD(kpis.paid_usd)}
          sub="indemnizaciones"
          valueColor={kpis.paid_usd > 0 ? "var(--success)" : "var(--ink)"}
          highlightWhenPositive={false}
        />
      </div>

      {/* Filtros */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.12s",
        }}
      >
        {CLAIM_FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              className={`studio-btn studio-btn-sm ${
                active ? "studio-btn-dark" : "studio-btn-ghost"
              }`}
              aria-pressed={active}
              onClick={() => pushFilter(f.value)}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Tabla o empty */}
      {rows.length === 0 ? (
        claims.length === 0 ? (
          <EmptyState
            eyebrow="Sin reclamos"
            title="No hay reclamos registrados."
            description="Cuando un cliente reporte un daño, faltante o retraso, créalo aquí para seguir su evaluación y resolución."
            action={
              canEdit ? (
                <button
                  type="button"
                  className="studio-btn studio-btn-primary"
                  onClick={() => setDrawer({ mode: "create" })}
                >
                  + Nuevo reclamo
                </button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            eyebrow="Sin resultados"
            title="Ningún reclamo coincide con este filtro."
            description="Prueba con otro filtro o vuelve a Todos."
          />
        )
      ) : (
        <ClaimsTable
          rows={rows}
          selected={selected}
          onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
          flashClassFor={flashClassFor}
        />
      )}

      {/* Detalle inline del seleccionado */}
      {selectedClaim && (
        <ClaimDetail
          claim={selectedClaim}
          canEdit={canEdit}
          onEdit={() => setDrawer({ mode: "edit", claim: selectedClaim })}
          onAdvanced={(to) =>
            toast.success(
              `Reclamo ${selectedClaim.claim_code} · ${claimStatusLabel(to)}`,
            )
          }
          onDeleted={() => {
            toast.success(`Reclamo ${selectedClaim.claim_code} eliminado`);
            setSelected(null);
          }}
        />
      )}

      {drawer && (
        <ClaimDrawer
          mode={drawer.mode}
          claim={drawer.mode === "edit" ? drawer.claim : undefined}
          clients={clients}
          shipments={shipments}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

// ── Tabla ───────────────────────────────────────────────────────
function ClaimsTable({
  rows,
  selected,
  onSelect,
  flashClassFor,
}: {
  rows: ClientClaim[];
  selected: string | null;
  onSelect: (id: string) => void;
  flashClassFor: (id: string) => string;
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
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-elevated)" }}>
            {[
              "Reclamo",
              "Shipping Mark",
              "Cliente",
              "Tipo",
              "Descripción",
              "Monto",
              "Seguro",
              "Estado",
            ].map((h, i) => (
              <th
                key={h}
                style={{
                  font: "700 10px/1.2 var(--f-sans)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                  textAlign: i === 5 ? "right" : "left",
                  padding: "11px 14px",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const active = selected === c.id;
            return (
              <tr
                key={c.id}
                data-row-id={c.claim_code}
                onClick={() => onSelect(c.id)}
                className={flashClassFor(c.claim_code)}
                style={{
                  borderBottom:
                    i < rows.length - 1 ? "1px solid var(--border)" : "0",
                  cursor: "pointer",
                  background: active ? "var(--wine-tint)" : "transparent",
                }}
              >
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 12px/1 var(--f-mono)",
                    color: "var(--wine)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.claim_code}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 12px/1 var(--f-mono)",
                    color: "var(--ink)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.client_markbox ?? "—"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 13px/1.2 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  {c.client_name ?? "—"}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={claimTypeTone(c.claim_type)} size="sm">
                    {claimTypeLabel(c.claim_type)}
                  </Badge>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "400 12.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    maxWidth: 220,
                  }}
                >
                  {c.description}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    font: "600 12.5px/1 var(--f-mono)",
                    color: "var(--ink)",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.amount_usd ? USD(c.amount_usd) : "—"}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {c.insured ? (
                    <Badge tone="success" size="sm">
                      Sí
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      No
                    </Badge>
                  )}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge tone={claimStatusTone(c.status)} size="sm">
                    {claimStatusLabel(c.status)}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Detalle inline ──────────────────────────────────────────────
function ClaimDetail({
  claim,
  canEdit,
  onEdit,
  onAdvanced,
  onDeleted,
}: {
  claim: ClientClaim;
  canEdit: boolean;
  onEdit: () => void;
  onAdvanced: (to: ClaimStatus) => void;
  onDeleted: () => void;
}) {
  const step = claimStatusStep(claim.status);
  const nextStatuses = claimNextStatuses(claim.status);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  return (
    <div
      style={{
        marginTop: 24,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Cabecera del detalle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "700 16px/1.2 var(--f-display)",
              color: "var(--ink)",
            }}
          >
            {claim.claim_code} · {claim.client_name ?? "Cliente"}
          </div>
          <div
            style={{
              font: "500 12.5px/1.5 var(--f-mono)",
              color: "var(--ink-soft)",
              marginTop: 4,
            }}
          >
            {claim.client_markbox ?? "—"}
            {claim.shipment_code ? ` · ${claim.shipment_code}` : ""}
            {claim.container_code ? ` · ${claim.container_code}` : ""}
            {` · ${fmtDate(claim.created_at)}`}
          </div>
          <div
            style={{
              font: "400 13px/1.5 var(--f-sans)",
              color: "var(--ink)",
              marginTop: 8,
              maxWidth: "56ch",
            }}
          >
            {claim.description}
          </div>
          {claim.resolution_note && (
            <div
              style={{
                font: "400 12.5px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 8,
                padding: "8px 12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-sm)",
                maxWidth: "56ch",
              }}
            >
              <span style={{ fontWeight: 700 }}>Resolución:</span>{" "}
              {claim.resolution_note}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              font: "600 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
            }}
          >
            Monto reclamado
          </div>
          <div
            style={{
              font: "800 26px/1 var(--f-display)",
              color: "var(--wine)",
              marginTop: 6,
            }}
          >
            {claim.amount_usd ? USD(claim.amount_usd) : "Sin monto"}
          </div>
          <div style={{ marginTop: 8 }}>
            {claim.insured ? (
              <Badge tone="success" size="sm">
                Cubierto por seguro
              </Badge>
            ) : (
              <Badge tone="neutral" size="sm">
                Sin cobertura
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stepper de 3 fases · estado accesible + visual decorativo */}
      <span style={SR_ONLY}>
        Estado del reclamo: {claimStatusLabel(claim.status)} — fase {step} de 3
        ({CLAIM_FLOW_STEPS[step - 1]}).
      </span>
      <div
        aria-hidden="true"
        style={{ display: "flex", alignItems: "center", marginTop: 22 }}
      >
        {CLAIM_FLOW_STEPS.map((label, i) => {
          const reached = i + 1 <= step;
          return (
            <Fragment key={label}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    margin: "0 auto",
                    background: reached ? "var(--wine)" : "var(--bg-elevated)",
                    color: reached ? "var(--ink-inv)" : "var(--ink-soft)",
                    font: "700 13px/30px var(--f-display)",
                    textAlign: "center",
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    font: "600 11.5px/1.2 var(--f-sans)",
                    color: reached ? "var(--ink)" : "var(--ink-soft)",
                    marginTop: 7,
                  }}
                >
                  {label}
                </div>
              </div>
              {i < CLAIM_FLOW_STEPS.length - 1 && (
                <div
                  style={{
                    flex: "0 0 50px",
                    height: 2,
                    background: i + 1 < step ? "var(--wine)" : "var(--border)",
                  }}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Avance de estado + acciones */}
      {canEdit && (
        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid var(--border)",
          }}
        >
          {nextStatuses.length > 0 ? (
            <>
              <label
                className="studio-label"
                htmlFor={`claim-note-${claim.id}`}
              >
                Nota de resolución{" "}
                <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>
                  (opcional)
                </span>
              </label>
              <textarea
                id={`claim-note-${claim.id}`}
                className="studio-input"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo del rechazo, detalle de la indemnización, acuerdo con el cliente…"
                style={{ resize: "vertical", marginBottom: 12 }}
              />
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {nextStatuses.map((to) => (
                  <ActionButton
                    key={to}
                    variant={to === "rechazado" ? "danger" : "dark"}
                    size="sm"
                    idleLabel={CLAIM_TRANSITION_LABEL[to]}
                    loadingLabel="Actualizando…"
                    successLabel={claimStatusLabel(to)}
                    onAction={async () => {
                      setError(null);
                      const r = await advanceClaimStatusAction(
                        claim.id,
                        to,
                        note.trim() || undefined,
                      );
                      if (r.error) throw new Error(r.error);
                    }}
                    onSuccess={() => {
                      setNote("");
                      onAdvanced(to);
                    }}
                    onError={setError}
                  />
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              Reclamo cerrado · sin más transiciones.
            </div>
          )}

          {/* Editar + eliminar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              marginTop: 16,
            }}
          >
            <div>
              {confirmDelete ? (
                <div
                  style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
                >
                  <span
                    style={{
                      font: "500 12px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    ¿Seguro?
                  </span>
                  <button
                    type="button"
                    className="studio-btn studio-btn-danger studio-btn-sm"
                    disabled={isDeleting}
                    onClick={() =>
                      startDelete(async () => {
                        const r = await softDeleteClaimAction(claim.id);
                        if (r.error) setError(r.error);
                        else onDeleted();
                      })
                    }
                  >
                    {isDeleting ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                  <button
                    type="button"
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setConfirmDelete(true)}
                >
                  Eliminar
                </button>
              )}
            </div>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={onEdit}
            >
              Editar
            </button>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: "12px 0 0",
              }}
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
