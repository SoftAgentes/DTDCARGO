"use client";

/**
 * Vista Compras grupales del Club (SDD-0116, Slice B). KPIs + lista de rondas
 * (tarjetas) con su barra de volumen comprometido (DERIVADO) y la grilla de
 * participantes (intención, D7). Alta/edición de ronda y de participantes vía
 * drawers; baja con confirm. Trazabilidad: highlight warm de la ronda creada.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import {
  groupBuyStatusLabel,
  groupBuyStatusTone,
  participantStatusLabel,
  participantStatusTone,
  type GroupBuyDetail,
  type GroupBuyStats,
  type ParticipantRow,
} from "@/lib/studio/club/group-buy-types";
import type { EligibleMember } from "@/lib/studio/club/group-buy-queries";
import { GroupBuyDrawer } from "./GroupBuyDrawer";
import { ParticipantDrawer } from "./ParticipantDrawer";
import { softDeleteGroupBuyAction, removeParticipantAction } from "../actions";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso: string | null): string {
  if (!iso) return "sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sin fecha";
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtCbm(n: number | null): string {
  if (n == null) return "—";
  return `${(Math.round(n * 1000) / 1000).toLocaleString("es-VE")} m³`;
}

export function GroupBuysView({
  stats,
  groupBuys,
  eligibleMembers,
}: {
  stats: GroupBuyStats;
  groupBuys: GroupBuyDetail[];
  eligibleMembers: EligibleMember[];
}) {
  const router = useRouter();
  const toast = useToast();
  const flashClassFor = useRowHighlight();

  const [showNew, setShowNew] = useState(false);
  const [editingGb, setEditingGb] = useState<GroupBuyDetail | null>(null);
  const [toDeleteGb, setToDeleteGb] = useState<GroupBuyDetail | null>(null);
  const [deletingGb, setDeletingGb] = useState(false);

  // Sumar/editar participante: guardamos la ronda + (opcional) el participante.
  const [participantCtx, setParticipantCtx] = useState<{
    gb: GroupBuyDetail;
    participant: ParticipantRow | null;
  } | null>(null);
  const [toRemove, setToRemove] = useState<ParticipantRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleDeleteGb = async () => {
    if (!toDeleteGb) return;
    setDeletingGb(true);
    const r = await softDeleteGroupBuyAction(toDeleteGb.id);
    setDeletingGb(false);
    if (r.error) return toast.error(r.error);
    toast.success(`Compra grupal "${toDeleteGb.title}" eliminada`);
    setToDeleteGb(null);
    router.refresh();
  };

  const handleRemoveParticipant = async () => {
    if (!toRemove) return;
    setRemoving(true);
    const r = await removeParticipantAction(toRemove.id);
    setRemoving(false);
    if (r.error) return toast.error(r.error);
    toast.success(`${toRemove.member_name} quitado de la ronda`);
    setToRemove(null);
    router.refresh();
  };

  return (
    <div>
      {/* El primary del header se oculta en estado vacío: ahí manda el del
          EmptyState (evita dos primary en el mismo contexto · regla 8). */}
      {groupBuys.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => setShowNew(true)}
          >
            + Nueva compra grupal
          </button>
        </div>
      )}

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard
          value={stats.abiertas}
          label="Rondas abiertas"
          valueColor={stats.abiertas > 0 ? "var(--success)" : "var(--ink)"}
          sub="reciben volumen"
        />
        <KpiCard
          value={stats.enConsolidacion}
          label="En consolidación"
          valueColor={stats.enConsolidacion > 0 ? "var(--wine)" : "var(--ink)"}
          sub="rondas cerradas"
        />
        <KpiCard value={fmtCbm(stats.cbmAbierto)} label="CBM comprometido" sub="en rondas abiertas" />
      </div>

      {groupBuys.length === 0 ? (
        <EmptyState
          eyebrow="Compra grupal"
          title="Aún no hay compras grupales"
          description="Abre la primera ronda de consolidación comunitaria. Los miembros suman volumen (CBM); al cerrarla se liga a una consolidación real."
          action={
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowNew(true)}
            >
              + Nueva compra grupal
            </button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groupBuys.map((g) => (
            <GroupBuyCard
              key={g.id}
              g={g}
              flashClassFor={flashClassFor}
              onEdit={() => setEditingGb(g)}
              onDelete={() => setToDeleteGb(g)}
              onAddParticipant={() => setParticipantCtx({ gb: g, participant: null })}
              onEditParticipant={(p) => setParticipantCtx({ gb: g, participant: p })}
              onRemoveParticipant={(p) => setToRemove(p)}
            />
          ))}
        </div>
      )}

      {showNew && <GroupBuyDrawer onClose={() => setShowNew(false)} />}
      {editingGb && <GroupBuyDrawer groupBuy={editingGb} onClose={() => setEditingGb(null)} />}
      {participantCtx && (
        <ParticipantDrawer
          groupBuyId={participantCtx.gb.id}
          groupBuyTitle={participantCtx.gb.title}
          participant={participantCtx.participant}
          eligibleMembers={eligibleMembers}
          takenMemberIds={participantCtx.gb.participants.map((p) => p.member_id)}
          onClose={() => setParticipantCtx(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDeleteGb}
        title="Eliminar compra grupal"
        message={
          toDeleteGb
            ? `¿Eliminar la compra grupal "${toDeleteGb.title}"? Sus participaciones también se ocultan. No afecta consolidaciones ya ligadas.`
            : ""
        }
        confirmLabel="Eliminar"
        danger
        pending={deletingGb}
        onCancel={() => setToDeleteGb(null)}
        onConfirm={handleDeleteGb}
      />

      <ConfirmDialog
        open={!!toRemove}
        title="Quitar participante"
        message={toRemove ? `¿Quitar a ${toRemove.member_name} de esta compra grupal?` : ""}
        confirmLabel="Quitar"
        danger
        pending={removing}
        onCancel={() => setToRemove(null)}
        onConfirm={handleRemoveParticipant}
      />
    </div>
  );
}

function GroupBuyCard({
  g,
  flashClassFor,
  onEdit,
  onDelete,
  onAddParticipant,
  onEditParticipant,
  onRemoveParticipant,
}: {
  g: GroupBuyDetail;
  flashClassFor: (id: string | null | undefined) => string;
  onEdit: () => void;
  onDelete: () => void;
  onAddParticipant: () => void;
  onEditParticipant: (p: ParticipantRow) => void;
  onRemoveParticipant: (p: ParticipantRow) => void;
}) {
  const route = [g.origin, g.destination].filter(Boolean).join(" → ");
  const pct =
    g.target_cbm && g.target_cbm > 0
      ? Math.min(100, Math.round((g.committed_cbm / g.target_cbm) * 100))
      : null;

  return (
    <div
      data-row-id={g.id}
      className={flashClassFor(g.id)}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
      {/* Header de la tarjeta */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", flexWrap: "wrap" }}>
            <span style={{ font: "700 15px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              {g.title}
            </span>
            <Badge tone={groupBuyStatusTone(g.status)} size="sm">
              {groupBuyStatusLabel(g.status)}
            </Badge>
          </div>
          <div
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: "var(--s-1)",
            }}
          >
            {route || "Ruta por definir"} · cierra {fmtDate(g.closes_at)} ·{" "}
            {g.participants_count} {g.participants_count === 1 ? "participante" : "participantes"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="studio-btn studio-btn-danger studio-btn-xs" onClick={onDelete}>
            Eliminar
          </button>
        </div>
      </div>

      {g.summary && (
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "8px 0 0" }}>
          {g.summary}
        </p>
      )}

      {/* Volumen comprometido vs meta */}
      <div style={{ marginTop: "var(--s-3)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            font: "600 12px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            marginBottom: "var(--s-1)",
          }}
        >
          <span>
            Comprometido: <strong style={{ color: "var(--ink)" }}>{fmtCbm(g.committed_cbm)}</strong>
            {g.target_cbm != null && ` de ${fmtCbm(g.target_cbm)}`}
          </span>
          {pct != null && <span>{pct}%</span>}
        </div>
        {pct != null && (
          <div
            role="progressbar"
            aria-label="Volumen comprometido"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              height: 6,
              background: "var(--surface)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: pct >= 100 ? "var(--success)" : "var(--wine)",
              }}
            />
          </div>
        )}
      </div>

      {/* Participantes */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--s-2)",
          }}
        >
          <span className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
            Participantes
          </span>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-xs"
            onClick={onAddParticipant}
          >
            + Sumar miembro
          </button>
        </div>

        {g.participants.length === 0 ? (
          <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Sin participantes todavía.
          </p>
        ) : (
          <table
            aria-label="Participantes de la ronda"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <tbody>
              {g.participants.map((p) => (
                <tr
                  key={p.id}
                  data-row-id={p.id}
                  className={flashClassFor(p.id)}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "8px 6px" }}>
                    <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                      {p.member_name}
                    </span>
                    {p.note && (
                      <span
                        style={{
                          font: "500 11px/1.3 var(--f-sans)",
                          color: "var(--ink-soft)",
                          display: "block",
                          marginTop: 2,
                        }}
                      >
                        {p.note}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "center" }}>
                    <Badge tone={participantStatusTone(p.status)} size="sm">
                      {participantStatusLabel(p.status)}
                    </Badge>
                  </td>
                  <td
                    style={{
                      padding: "8px 6px",
                      textAlign: "right",
                      font: "600 12px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtCbm(p.estimated_cbm)}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => onEditParticipant(p)}
                    >
                      Editar
                    </button>{" "}
                    <button
                      type="button"
                      className="studio-btn studio-btn-danger studio-btn-xs"
                      onClick={() => onRemoveParticipant(p)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
