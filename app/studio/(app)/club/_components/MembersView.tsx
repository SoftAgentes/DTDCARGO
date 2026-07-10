"use client";

/**
 * Vista Miembros del Club (SDD-0116, Slice A). KPIs + tabla de miembros + drawer
 * de alta/edición + baja (soft delete con confirm). Trazabilidad: highlight warm
 * de la row recién creada (useRowHighlight) + toasts. Solo tokens var(--*).
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
  planLabel,
  planBadgeTone,
  memberStatusLabel,
  memberStatusTone,
  sourceLabel,
  type ClubMemberRow,
  type ClubStats,
} from "@/lib/studio/club/club-member-types";
import { ClubMemberDrawer } from "./ClubMemberDrawer";
import { softDeleteClubMemberAction } from "../actions";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function MembersView({ stats, members }: { stats: ClubStats; members: ClubMemberRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const flashClassFor = useRowHighlight();

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ClubMemberRow | null>(null);
  const [toDelete, setToDelete] = useState<ClubMemberRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const r = await softDeleteClubMemberAction(toDelete.id);
    setDeleting(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(`${toDelete.person_name} dado de baja del Club`);
    setToDelete(null);
    router.refresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={() => setShowNew(true)}
        >
          + Nuevo miembro
        </button>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard value={stats.miembros} label="Miembros" sub="vivos" />
        <KpiCard
          value={stats.activos}
          label="Activos"
          valueColor={stats.activos > 0 ? "var(--success)" : "var(--ink)"}
          sub="membresía activa"
        />
        <KpiCard value={stats.importadores} label="Importadores" sub="plan" />
        <KpiCard
          value={stats.mayoristas}
          label="Mayoristas"
          valueColor={stats.mayoristas > 0 ? "var(--wine)" : "var(--ink)"}
          sub="plan"
        />
      </div>

      {members.length === 0 ? (
        <EmptyState
          eyebrow="Club DTD"
          title="Aún no hay miembros"
          description="Da de alta al primer miembro del Club. Se ancla a una persona por su cédula; si ya es cliente o alumno, se reusa su identidad."
          action={
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={() => setShowNew(true)}
            >
              + Nuevo miembro
            </button>
          }
        />
      ) : (
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
              <tr style={{ background: "var(--surface)" }}>
                {["Miembro", "Cédula", "Plan", "Estado", "Carga", "Academia", "Alta", ""].map(
                  (h, i) => (
                    <th
                      key={h || `act-${i}`}
                      style={{
                        textAlign: i >= 2 && i <= 5 ? "center" : "left",
                        padding: "10px 14px",
                        font: "700 11px/1 var(--f-sans)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--ink-soft)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  data-row-id={m.id}
                  className={flashClassFor(m.id)}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                      {m.person_name}
                    </span>
                    {m.source && (
                      <span
                        style={{
                          font: "500 11px/1 var(--f-sans)",
                          color: "var(--ink-soft)",
                          display: "block",
                          marginTop: 2,
                        }}
                      >
                        {sourceLabel(m.source)}
                      </span>
                    )}
                  </td>
                  <td
                    className="studio-input-mono"
                    style={{
                      padding: "10px 14px",
                      font: "500 12px/1 var(--f-mono)",
                      color: "var(--ink-soft)",
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    {m.person_national_id ?? "—"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <Badge tone={planBadgeTone(m.plan)} size="sm">
                      {planLabel(m.plan)}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <Badge tone={memberStatusTone(m.status)} size="sm">
                      {memberStatusLabel(m.status)}
                    </Badge>
                  </td>
                  <td
                    className="studio-input-mono"
                    style={{
                      padding: "10px 14px",
                      textAlign: "center",
                      font: "500 12px/1 var(--f-mono)",
                      color: m.cargo_markbox ? "var(--ink-soft)" : "var(--ink-mute)",
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    {m.cargo_markbox ?? "—"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    {m.is_academy_member ? (
                      <Badge tone="success" size="sm">
                        Alumno
                      </Badge>
                    ) : (
                      <span style={{ font: "500 12px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
                        —
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      font: "500 12px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtDate(m.joined_at)}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="studio-btn studio-btn-ghost studio-btn-xs"
                      onClick={() => setEditing(m)}
                    >
                      Editar
                    </button>{" "}
                    <button
                      type="button"
                      className="studio-btn studio-btn-danger studio-btn-xs"
                      onClick={() => setToDelete(m)}
                    >
                      Baja
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <ClubMemberDrawer onClose={() => setShowNew(false)} />}
      {editing && <ClubMemberDrawer member={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        title="Dar de baja al miembro"
        message={
          toDelete
            ? `¿Dar de baja a ${toDelete.person_name} del Club? La persona y su identidad se conservan; solo se cierra la membresía.`
            : ""
        }
        confirmLabel="Dar de baja"
        danger
        pending={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
