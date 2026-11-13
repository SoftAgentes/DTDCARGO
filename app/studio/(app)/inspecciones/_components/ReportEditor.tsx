"use client";

/**
 * ReportEditor — editor completo de un reporte (SDD-0066 · Fase 2/3). Overlay a
 * pantalla casi-completa con 3 pestañas:
 *   - Detalle  · el builder del payload (PSI o fábrica) + cabecera (hidden) →
 *                updateInspectionReportAction con __builder=1.
 *   - Fotos    · PhotoManager (bucket privado inspections).
 *   - Vista    · ReportPreview con marca DTD + Imprimir/PDF + modo ejemplo.
 *
 * El form del builder lleva los campos de cabecera como hidden para que el
 * validador del action (que valida la cabecera) pase; el payload se reescribe
 * solo aquí (la marca __builder lo habilita).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import {
  inspectionTypeShort,
  type InspectionReport,
} from "@/lib/studio/inspecciones/types";
import type { InspectionActionState } from "@/lib/studio/inspecciones/validators";
import type { InspectionPhotoItem } from "@/lib/studio/inspecciones/photos";
import { updateInspectionReportAction } from "../actions";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { PsiBuilder } from "./PsiBuilder";
import { FactoryBuilder } from "./FactoryBuilder";
import { PhotoManager } from "./PhotoManager";
import { ReportPreview } from "./ReportPreview";

const FORM_ID = "inspection-builder-form";
const initialState: InspectionActionState = {};

type Tab = "detalle" | "fotos" | "vista";

export function ReportEditor({
  report,
  photos,
  canEdit,
  onClose,
}: {
  report: InspectionReport;
  photos: InspectionPhotoItem[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("detalle");
  const [sample, setSample] = useState(false);
  const isFactory = report.type === "factory_audit";

  const [state, formAction, isPending] = useActionState(
    updateInspectionReportAction.bind(null, report.id),
    initialState,
  );
  const router = useRouter();
  const toast = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, { onClose, pending: isPending });

  useEffect(() => {
    if (state.ok) {
      toast.success("Reporte guardado");
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        overflow: "auto",
        padding: "var(--s-6) var(--s-4)",
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 100%)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          minHeight: "min(88vh, 800px)",
          outline: "none",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ font: "700 16px/1.2 var(--f-display)", color: "var(--ink)" }}>
              {report.report_no} · {report.title}
            </div>
            <div
              style={{
                font: "500 12px/1.3 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 3,
              }}
            >
              {inspectionTypeShort(report.type)}
              {report.client_name ? ` · ${report.client_name}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        {/* Tabs */}
        <div
          role="group"
          aria-label="Secciones del informe"
          className="studio-tabs"
          style={{ margin: "10px 22px 0" }}
        >
          {(
            [
              ["detalle", "Detalle"],
              ["fotos", "Fotos"],
              ["vista", "Vista previa"],
            ] as [Tab, string][]
          ).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                data-activa={active ? "true" : undefined}
                onClick={() => setTab(id)}
                className="studio-tab"
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px" }}>
          {tab === "detalle" && (
            <>
              <form id={FORM_ID} action={formAction}>
                {/* Cabecera (hidden) para que el validador del action pase. */}
                <input type="hidden" name="__builder" value="1" />
                <input type="hidden" name="type" value={report.type} />
                <input type="hidden" name="title" value={report.title} />
                {report.client_id && (
                  <input type="hidden" name="client_id" value={report.client_id} />
                )}
                {report.product && (
                  <input type="hidden" name="product" value={report.product} />
                )}
                {report.inspection_date && (
                  <input type="hidden" name="inspection_date" value={report.inspection_date} />
                )}
                {report.duration_mandays != null && (
                  <input type="hidden" name="duration_mandays" value={report.duration_mandays} />
                )}
                {report.conclusion && (
                  <input type="hidden" name="conclusion" value={report.conclusion} />
                )}
                {report.provider_internal && (
                  <input type="hidden" name="provider_internal" value={report.provider_internal} />
                )}

                {isFactory ? (
                  <FactoryBuilder report={report} />
                ) : (
                  <PsiBuilder report={report} />
                )}
              </form>
              {state.error && (
                <p
                  role="alert"
                  style={{
                    font: "500 12px/1.4 var(--f-sans)",
                    color: "var(--danger)",
                    marginTop: 14,
                  }}
                >
                  {state.error}
                </p>
              )}
            </>
          )}

          {tab === "fotos" && (
            <PhotoManager reportId={report.id} photos={photos} />
          )}

          {tab === "vista" && (
            <div>
              <label
                style={{
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                  font: "500 12.5px/1 var(--f-sans)",
                  color: "var(--ink)",
                  marginBottom: 14,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={sample}
                  onChange={(e) => setSample(e.target.checked)}
                />
                Modo ejemplo (redacta datos del cliente / fábrica)
              </label>
              <ReportPreview report={report} photos={photos} sample={sample} />
            </div>
          )}
        </div>

        {/* Footer (solo en Detalle) */}
        {tab === "detalle" && canEdit && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              padding: "14px 22px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              className="studio-btn studio-btn-ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Cerrar
            </button>
            <button
              type="submit"
              form={FORM_ID}
              className="studio-btn studio-btn-primary"
              disabled={isPending}
            >
              {isPending ? "Guardando…" : "Guardar detalle"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
