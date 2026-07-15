"use client";

/**
 * Vista "Proveedor del mes" del Club (SDD-0116, Slice D). KPIs + lista de
 * proveedores destacados (tarjetas) por período. Publicar/despublicar + baja con
 * confirm. Alta/edición vía drawer. Trazabilidad: highlight warm del creado.
 * White-label: nunca se muestra el proveedor de inspección crudo.
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
  featuredSupplierStatusLabel,
  featuredSupplierStatusTone,
  periodLabel,
  type FeaturedSupplier,
  type FeaturedSupplierStats,
} from "@/lib/studio/club/featured-supplier-types";
import type { EligibleInspection } from "@/lib/studio/club/featured-supplier-queries";
import { FeaturedSupplierDrawer } from "./FeaturedSupplierDrawer";
import {
  setFeaturedSupplierStatusAction,
  softDeleteFeaturedSupplierAction,
} from "../actions";

export function SuppliersView({
  stats,
  suppliers,
  eligibleInspections,
}: {
  stats: FeaturedSupplierStats;
  suppliers: FeaturedSupplier[];
  eligibleInspections: EligibleInspection[];
}) {
  const router = useRouter();
  const toast = useToast();
  const flashClassFor = useRowHighlight();

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<FeaturedSupplier | null>(null);
  const [toDelete, setToDelete] = useState<FeaturedSupplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const r = await softDeleteFeaturedSupplierAction(toDelete.id);
    setDeleting(false);
    if (r.error) return toast.error(r.error);
    toast.success(`Proveedor de ${periodLabel(toDelete.period)} eliminado`);
    setToDelete(null);
    router.refresh();
  };

  const handleToggle = async (s: FeaturedSupplier) => {
    const next = s.status === "publicado" ? "borrador" : "publicado";
    const r = await setFeaturedSupplierStatusAction(s.id, next);
    if (r.error) return toast.error(r.error);
    toast.success(next === "publicado" ? "Proveedor publicado" : "Proveedor despublicado");
    router.refresh();
  };

  return (
    <div>
      {suppliers.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button type="button" className="studio-btn studio-btn-primary" onClick={() => setShowNew(true)}>
            + Nuevo proveedor del mes
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: "var(--s-5)",
        }}
      >
        <KpiCard
          value={stats.publicados}
          label="Publicados"
          valueColor={stats.publicados > 0 ? "var(--success)" : "var(--ink)"}
          sub="visibles en el portal"
        />
        <KpiCard value={stats.total} label="Total" sub="vivos" />
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          eyebrow="Proveedor del mes"
          title="Aún no hay proveedores destacados"
          description="Destaca una fábrica verificada de la comunidad. Ligala a una inspección (SDD-0066) y publícala para el portal del miembro."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={() => setShowNew(true)}>
              + Nuevo proveedor del mes
            </button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {suppliers.map((s) => (
            <SupplierCard
              key={s.id}
              s={s}
              flashClassFor={flashClassFor}
              onEdit={() => setEditing(s)}
              onDelete={() => setToDelete(s)}
              onToggle={() => handleToggle(s)}
            />
          ))}
        </div>
      )}

      {showNew && (
        <FeaturedSupplierDrawer
          eligibleInspections={eligibleInspections}
          onClose={() => setShowNew(false)}
        />
      )}
      {editing && (
        <FeaturedSupplierDrawer
          supplier={editing}
          eligibleInspections={eligibleInspections}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar proveedor del mes"
        message={toDelete ? `¿Eliminar el proveedor destacado de ${periodLabel(toDelete.period)}?` : ""}
        confirmLabel="Eliminar"
        danger
        pending={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function SupplierCard({
  s,
  flashClassFor,
  onEdit,
  onDelete,
  onToggle,
}: {
  s: FeaturedSupplier;
  flashClassFor: (id: string | null | undefined) => string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const meta = [periodLabel(s.period), s.category, s.inspectionReportNo]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      data-row-id={s.id}
      className={flashClassFor(s.id)}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
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
            <span style={{ font: "700 15px/1.2 var(--f-sans)", color: "var(--ink)" }}>{s.supplierName}</span>
            <Badge tone={featuredSupplierStatusTone(s.status)} size="sm">
              {featuredSupplierStatusLabel(s.status)}
            </Badge>
          </div>
          <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: "var(--s-1)" }}>
            {meta}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" onClick={onToggle}>
            {s.status === "publicado" ? "Despublicar" : "Publicar"}
          </button>
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-xs" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="studio-btn studio-btn-danger studio-btn-xs" onClick={onDelete}>
            Eliminar
          </button>
        </div>
      </div>

      {s.blurb && (
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "8px 0 0" }}>
          {s.blurb}
        </p>
      )}
    </div>
  );
}
