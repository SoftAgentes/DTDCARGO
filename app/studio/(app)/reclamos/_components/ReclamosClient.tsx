"use client";

/**
 * Orquestador client del módulo Reclamos (SDD-0101 · Slice A).
 *
 * KPIs + filtros (URL state) + tabla + detalle inline con stepper de 3 fases +
 * avance de estado (máquina, ActionButton + toast) + drawer crear/editar.
 * Fiel al handoff del Norte (docs/design/studio/_norte/reclamos/reclamos.jsx).
 */

import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
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
  faultPartyLabel,
  FAULT_PARTY_OPTIONS,
  CLAIM_PAYMENT_METHOD_OPTIONS,
  type ClaimActionState,
  type ClaimFilter,
  type ClaimStatus,
  type ClaimFinancials,
  type ClientClaim,
} from "@/lib/studio/reclamos/claims-types";
import { claimOffsetStatusLabel } from "@/lib/studio/partner-finance/types";
import type {
  ClaimClientOption,
  ClaimShipmentOption,
  ClaimOffsetOption,
} from "@/lib/studio/reclamos/claims-queries";
import type { ClaimEvidenceItem } from "@/lib/studio/reclamos/claim-evidence";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import {
  advanceClaimStatusAction,
  softDeleteClaimAction,
  uploadStudioClaimEvidenceAction,
  deleteClaimEvidenceAction,
  updateClaimFinancialsAction,
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
  evidence,
  offsets,
  financials,
  entryCodes,
  canEdit,
  canFinance,
}: {
  claims: ClientClaim[];
  clients: ClaimClientOption[];
  shipments: ClaimShipmentOption[];
  evidence: Record<string, ClaimEvidenceItem[]>;
  offsets: ClaimOffsetOption[];
  financials: Record<string, ClaimFinancials>;
  entryCodes: Record<string, string>;
  canEdit: boolean;
  canFinance: boolean;
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
          evidence={evidence[selectedClaim.id] ?? []}
          offsets={offsets}
          financials={financials[selectedClaim.id] ?? null}
          entryCode={entryCodes[selectedClaim.id] ?? null}
          canEdit={canEdit}
          canFinance={canFinance}
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
  evidence,
  offsets,
  financials,
  entryCode,
  canEdit,
  canFinance,
  onEdit,
  onAdvanced,
  onDeleted,
}: {
  claim: ClientClaim;
  evidence: ClaimEvidenceItem[];
  offsets: ClaimOffsetOption[];
  financials: ClaimFinancials | null;
  entryCode: string | null;
  canEdit: boolean;
  canFinance: boolean;
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
              color: "var(--ink-soft)",
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

      {/* Evidencia (fotos / documentos) · SDD-0101 B2 */}
      <div
        style={{
          marginTop: 22,
          paddingTop: 18,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
          Evidencia
        </div>
        {evidence.length === 0 ? (
          <div
            style={{
              font: "500 12.5px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginBottom: canEdit ? 12 : 0,
            }}
          >
            Sin fotos ni documentos todavía.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: canEdit ? 14 : 0,
            }}
          >
            {evidence.map((e) => (
              <StudioEvidenceThumb key={e.id} item={e} canEdit={canEdit} />
            ))}
          </div>
        )}
        {canEdit && <EvidenceUpload claimId={claim.id} />}
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
                <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
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
                color: "var(--ink-soft)",
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

      {canFinance && (
        <ClaimFinancials
          claim={claim}
          fin={financials}
          offsets={offsets}
          entryCode={entryCode}
        />
      )}
    </div>
  );
}

// ── Resolución financiera (Slice C) ─────────────────────────────
function ClaimFinancials({
  claim,
  fin,
  offsets,
  entryCode,
}: {
  claim: ClientClaim;
  fin: ClaimFinancials | null;
  offsets: ClaimOffsetOption[];
  entryCode: string | null;
}) {
  const [state, action, pending] = useActionState(
    updateClaimFinancialsAction.bind(null, claim.id),
    {} as ClaimActionState,
  );
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!state.ok) return;
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(t);
  }, [state.ok]);

  const noOffsets = offsets.length === 0;

  return (
    <div
      style={{
        marginTop: 22,
        paddingTop: 18,
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <div className="studio-eyebrow">Resolución financiera</div>
        {entryCode && (
          <span
            style={{
              font: "600 11px/1 var(--f-mono)",
              color: "var(--success)",
              background: "var(--success-bg)",
              border: "1px solid transparent",
              borderRadius: "var(--r-pill)",
              padding: "4px 10px",
            }}
            title="Asiento contable de la indemnización"
          >
            Asiento {entryCode}
          </span>
        )}
      </div>
      <p
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 12px",
          maxWidth: "62ch",
        }}
      >
        Solo Contabilidad. Al marcar la indemnización como pagada se asienta el
        desembolso (DR siniestros / CR caja-banco) por el medio de pago elegido.
      </p>
      <form action={action} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor={`fin-fault-${claim.id}`}>
              Parte responsable
            </label>
            <select
              id={`fin-fault-${claim.id}`}
              name="fault_party"
              className="studio-input"
              defaultValue={fin?.fault_party ?? ""}
            >
              <option value="">Sin determinar</option>
              {FAULT_PARTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor={`fin-offset-${claim.id}`}>
              Recupero del proveedor
            </label>
            <select
              id={`fin-offset-${claim.id}`}
              name="supplier_claim_offset_id"
              className="studio-input"
              defaultValue={fin?.supplier_claim_offset_id ?? ""}
              disabled={noOffsets}
            >
              <option value="">
                {noOffsets ? "No hay recuperos cargados" : "Sin vincular"}
              </option>
              {offsets.map((o) => (
                <option key={o.id} value={o.id}>
                  {USD(o.amount_usd)} · {claimOffsetStatusLabel(o.status)} ·{" "}
                  {fmtDate(o.claimed_on)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor={`fin-insured-${claim.id}`}>
              Monto cubierto
            </label>
            <NumericInput
              id={`fin-insured-${claim.id}`}
              name="insured_amount_usd"
              type="currency"
              min={0}
              placeholder="0.00"
              defaultValue={fin?.insured_amount_usd ?? null}
            />
            {state.fieldErrors?.insured_amount_usd && (
              <FinErr msg={state.fieldErrors.insured_amount_usd} />
            )}
          </div>
          <div>
            <label className="studio-label" htmlFor={`fin-deduct-${claim.id}`}>
              Deducible
            </label>
            <NumericInput
              id={`fin-deduct-${claim.id}`}
              name="policy_deductible_usd"
              type="currency"
              min={0}
              placeholder="0.00"
              defaultValue={fin?.policy_deductible_usd ?? null}
            />
            {state.fieldErrors?.policy_deductible_usd && (
              <FinErr msg={state.fieldErrors.policy_deductible_usd} />
            )}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor={`fin-method-${claim.id}`}>
              Medio de pago de la indemnización
            </label>
            <select
              id={`fin-method-${claim.id}`}
              name="payment_method"
              className="studio-input"
              defaultValue={fin?.payment_method ?? "transfer"}
            >
              {CLAIM_PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor={`fin-ref-${claim.id}`}>
              Referencia de la aseguradora
            </label>
            <input
              id={`fin-ref-${claim.id}`}
              name="insurer_claim_ref"
              type="text"
              className="studio-input"
              defaultValue={fin?.insurer_claim_ref ?? ""}
              placeholder="Nº de certificado / reclamo"
              autoComplete="off"
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="submit"
            className="studio-btn studio-btn-dark studio-btn-sm"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar resolución"}
          </button>
          {justSaved && (
            <span
              role="status"
              aria-live="polite"
              style={{ font: "600 12px/1 var(--f-sans)", color: "var(--success)" }}
            >
              Guardado
            </span>
          )}
          {state.error && (
            <span
              role="alert"
              style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--danger)" }}
            >
              {state.error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function FinErr({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "4px 0 0",
      }}
    >
      {msg}
    </p>
  );
}

// ── Evidencia (B2) ──────────────────────────────────────────────
function StudioEvidenceThumb({
  item,
  canEdit,
}: {
  item: ClaimEvidenceItem;
  canEdit: boolean;
}) {
  const [isDeleting, startDelete] = useTransition();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  const thumb =
    item.isImage && item.url ? (
      <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.fileName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.fileName}
          loading="lazy"
          style={{
            width: 72,
            height: 72,
            objectFit: "cover",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--border)",
            display: "block",
          }}
        />
      </a>
    ) : (
      <a
        href={item.url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        title={item.fileName}
        style={{
          display: "flex",
          alignItems: "center",
          height: 72,
          padding: "0 12px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          font: "600 11.5px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          maxWidth: 150,
          textDecoration: "none",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.fileName}
        </span>
      </a>
    );

  return (
    <div style={{ position: "relative" }}>
      {thumb}
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            startDelete(async () => {
              await deleteClaimEvidenceAction(item.id);
            });
          }}
          disabled={isDeleting}
          aria-label={confirm ? "Confirmar eliminar evidencia" : "Eliminar evidencia"}
          title={confirm ? "Toca de nuevo para eliminar" : "Eliminar"}
          style={{
            position: "absolute",
            top: -7,
            right: -7,
            width: confirm ? "auto" : 20,
            height: 20,
            padding: confirm ? "0 8px" : 0,
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: confirm ? "var(--danger)" : "var(--bg-surface)",
            color: confirm ? "var(--ink-inv)" : "var(--danger)",
            font: "700 11px/1 var(--f-sans)",
            cursor: isDeleting ? "wait" : "pointer",
            display: "grid",
            placeItems: "center",
            boxShadow: "var(--shadow-xs)",
            whiteSpace: "nowrap",
          }}
        >
          {confirm ? (isDeleting ? "…" : "Eliminar") : "×"}
        </button>
      )}
    </div>
  );
}

function EvidenceUpload({ claimId }: { claimId: string }) {
  const [state, action, pending] = useActionState(
    uploadStudioClaimEvidenceAction.bind(null, claimId),
    {} as { ok?: boolean; error?: string },
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={ref}
      action={action}
      style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
    >
      <input
        type="file"
        name="evidence"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        disabled={pending}
        className="studio-file"
        style={{ flex: "1 1 240px" }}
      />
      <button
        type="submit"
        className="studio-btn studio-btn-dark studio-btn-sm"
        disabled={pending}
      >
        {pending ? "Subiendo…" : "Subir evidencia"}
      </button>
      {state.error && (
        <span
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            flexBasis: "100%",
          }}
        >
          {state.error}
        </span>
      )}
    </form>
  );
}
