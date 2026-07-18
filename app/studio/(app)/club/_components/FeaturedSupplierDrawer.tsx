"use client";

/**
 * Drawer de alta/edición del "Proveedor del mes" (SDD-0116, Slice D). D8: se liga
 * a una inspección verificada (SDD-0066). WHITE-LABEL: supplier_name es curado por
 * DTD, NUNCA el proveedor de inspección crudo. Patrón espejo de GroupBuyDrawer.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Field, FormError } from "./Field";
import {
  FEATURED_SUPPLIER_STATUSES,
  featuredSupplierStatusLabel,
  currentPeriod,
  type FeaturedSupplier,
  type FeaturedSupplierInput,
  type FeaturedSupplierStatus,
} from "@/lib/studio/club/featured-supplier-types";
import type { EligibleInspection } from "@/lib/studio/club/featured-supplier-queries";
import {
  createFeaturedSupplierAction,
  updateFeaturedSupplierAction,
} from "../actions";

export function FeaturedSupplierDrawer({
  supplier,
  eligibleInspections,
  onClose,
}: {
  supplier?: FeaturedSupplier | null;
  eligibleInspections: EligibleInspection[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!supplier;

  const [period, setPeriod] = useState(supplier?.period ?? currentPeriod());
  const [supplierName, setSupplierName] = useState(supplier?.supplierName ?? "");
  const [inspectionId, setInspectionId] = useState(supplier?.inspectionId ?? "");
  const [category, setCategory] = useState(supplier?.category ?? "");
  const [blurb, setBlurb] = useState(supplier?.blurb ?? "");
  const [status, setStatus] = useState<FeaturedSupplierStatus>(supplier?.status ?? "borrador");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = supplierName.trim().length > 0 && /^\d{4}-\d{2}$/.test(period) && !pending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);

    const payload: Partial<FeaturedSupplierInput> = {
      period: period.trim(),
      supplierName: supplierName.trim(),
      inspectionId: inspectionId.trim() || null,
      category: category.trim() || null,
      blurb: blurb.trim() || null,
      coverPath: supplier?.coverPath ?? null,
      status,
    };

    const r = isEdit
      ? await updateFeaturedSupplierAction(supplier!.id, payload)
      : await createFeaturedSupplierAction(payload);
    setPending(false);
    if (r.error) return setError(r.error);
    if (r.fieldErrors) return setError(Object.values(r.fieldErrors)[0] ?? "Revisa los datos.");

    toast.success(isEdit ? "Proveedor del mes actualizado" : "Proveedor del mes creado");
    onClose();
    if (!isEdit && r.createdId) {
      router.push(`/studio/club?highlight=${r.createdId}&hl-tone=warm`);
    } else {
      router.refresh();
    }
  };

  return (
    <DrawerShell
      title={isEdit ? "Editar proveedor del mes" : "Nuevo proveedor del mes"}
      subtitle="Club DTD · fábrica destacada de la comunidad"
      onClose={onClose}
      pending={pending}
      width={560}
    >
      <form
        id="featured-supplier-form"
        onSubmit={handleSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {error && <FormError message={error} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Período">
            <input
              className="studio-input"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </Field>
          <Field label="Estado">
            <select
              className="studio-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as FeaturedSupplierStatus)}
            >
              {FEATURED_SUPPLIER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {featuredSupplierStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Nombre del proveedor (público)">
          <input
            className="studio-input"
            placeholder="Fábrica verificada · Yiwu"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            autoFocus
          />
        </Field>
        <p style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "-6px 0 0" }}>
          Nombre curado por DTD (white-label). No pongas el proveedor de inspección crudo.
        </p>

        <Field label="Inspección que la respalda" optional>
          <select
            className="studio-input"
            value={inspectionId}
            onChange={(e) => setInspectionId(e.target.value)}
          >
            <option value="">Sin inspección ligada…</option>
            {eligibleInspections.map((i) => (
              <option key={i.id} value={i.id}>
                {i.reportNo} · {i.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Categoría" optional>
          <input
            className="studio-input"
            placeholder="Textil · Electrónica · Ferretería…"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </Field>

        <Field label="Por qué se destaca" optional>
          <textarea
            className="studio-input"
            rows={3}
            placeholder="Curaduría: qué hace especial a esta fábrica para la comunidad DTD…"
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </Field>
      </form>

      <DrawerFooter
        formId="featured-supplier-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel={isEdit ? "Guardar cambios" : "Crear"}
        pendingLabel={isEdit ? "Guardando…" : "Creando…"}
      />
    </DrawerShell>
  );
}
