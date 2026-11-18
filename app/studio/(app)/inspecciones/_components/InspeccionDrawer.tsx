"use client";

/**
 * InspeccionDrawer — crear / editar la CABECERA de un reporte de inspección
 * (SDD-0066 · Fase 1). El builder completo del payload llega en Fase 2/3.
 *
 * DrawerShell + DrawerFooter compartidos. useActionState con
 * createInspectionReportAction / updateInspectionReportAction. El número
 * DTD-QC/FA-NNNN se asigna al crear (RPC). El proveedor tercero va en un campo
 * INTERNO, rotulado como tal — nunca se renderiza al cliente (white-label).
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INSPECTION_TYPE_OPTIONS,
  INSPECTION_CONCLUSION_OPTIONS,
  inspectionTypeShort,
  type InspectionType,
  type InspectionReport,
} from "@/lib/studio/inspecciones/types";
import type { InspectionActionState } from "@/lib/studio/inspecciones/validators";
import type { InspectionClientOption } from "@/lib/studio/inspecciones/queries";
import {
  createInspectionReportAction,
  updateInspectionReportAction,
} from "../actions";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const FORM_ID = "inspection-drawer-form";
const initialState: InspectionActionState = {};

interface Props {
  mode: "create" | "edit";
  report?: InspectionReport;
  clients: InspectionClientOption[];
  onClose: () => void;
}

export function InspeccionDrawer({ mode, report, clients, onClose }: Props) {
  const action =
    mode === "edit" && report
      ? updateInspectionReportAction.bind(null, report.id)
      : createInspectionReportAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const router = useRouter();
  const toast = useToast();

  const [type, setType] = useState<InspectionType>(
    report?.type ?? "product_psi",
  );

  useEffect(() => {
    if (!state.ok) return;
    if (mode === "create" && state.createdNo) {
      const no = state.createdNo;
      toast.success(`Reporte ${no} creado`, {
        link: {
          href: `/studio/inspecciones?highlight=${encodeURIComponent(no)}&hl-tone=warm`,
          label: "Ver en listado",
        },
      });
      router.push(
        `/studio/inspecciones?highlight=${encodeURIComponent(no)}&hl-tone=warm`,
      );
    } else {
      toast.success("Reporte actualizado");
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.createdNo]);

  const title =
    mode === "create" ? "Nuevo reporte de inspección" : "Editar reporte";
  const subtitle =
    mode === "edit" && report
      ? report.report_no
      : "El número DTD-QC / DTD-FA se asigna al crear.";

  const isFactory = type === "factory_audit";

  return (
    <DrawerShell
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      pending={isPending}
      width={580}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Tipo */}
        <div>
          <label className="studio-label" htmlFor="ins-type">
            Tipo de inspección <span style={{ color: "var(--wine-text)" }}>*</span>
          </label>
          <select
            id="ins-type"
            name="type"
            className="studio-input"
            value={type}
            onChange={(e) => setType(e.target.value as InspectionType)}
            required
            autoFocus
          >
            {INSPECTION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.type && (
            <FieldError msg={state.fieldErrors.type} />
          )}
        </div>

        {/* Cliente (opcional) */}
        <div>
          <label className="studio-label" htmlFor="ins-client">
            Cliente{" "}
            <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
              (opcional)
            </span>
          </label>
          <select
            id="ins-client"
            name="client_id"
            className="studio-input"
            defaultValue={report?.client_id ?? ""}
          >
            <option value="">Sin cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.markbox} · {c.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.client_id && (
            <FieldError msg={state.fieldErrors.client_id} />
          )}
        </div>

        {/* Título */}
        <div>
          <label className="studio-label" htmlFor="ins-title">
            Título <span style={{ color: "var(--wine-text)" }}>*</span>
          </label>
          <input
            id="ins-title"
            name="title"
            type="text"
            className="studio-input"
            defaultValue={report?.title ?? ""}
            placeholder={
              isFactory
                ? "Auditoría de fábrica · Proveedor X"
                : "Inspección de producto · PO-12345"
            }
            required
            autoComplete="off"
          />
          {state.fieldErrors?.title && (
            <FieldError msg={state.fieldErrors.title} />
          )}
        </div>

        {/* Producto + Fecha */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label className="studio-label" htmlFor="ins-product">
              Producto{" "}
              <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                (opcional)
              </span>
            </label>
            <input
              id="ins-product"
              name="product"
              type="text"
              className="studio-input"
              defaultValue={report?.product ?? ""}
              placeholder="Termo de acero 500 ml"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="studio-label" htmlFor="ins-date">
              Fecha de inspección
            </label>
            <input
              id="ins-date"
              name="inspection_date"
              type="date"
              className="studio-input"
              defaultValue={report?.inspection_date ?? ""}
            />
            {state.fieldErrors?.inspection_date && (
              <FieldError msg={state.fieldErrors.inspection_date} />
            )}
          </div>
        </div>

        {/* Días-hombre + Puntaje (solo fábrica) */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label className="studio-label" htmlFor="ins-mandays">
              Días-hombre
            </label>
            <input
              id="ins-mandays"
              name="duration_mandays"
              type="number"
              min={0}
              step="0.5"
              className="studio-input studio-input-mono"
              defaultValue={report?.duration_mandays ?? ""}
              placeholder="1"
            />
            {state.fieldErrors?.duration_mandays && (
              <FieldError msg={state.fieldErrors.duration_mandays} />
            )}
          </div>
          <div>
            <label className="studio-label" htmlFor="ins-score">
              Puntaje /100{" "}
              {!isFactory && (
                <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
                  (solo fábrica)
                </span>
              )}
            </label>
            <input
              id="ins-score"
              name="score"
              type="number"
              min={0}
              max={100}
              className="studio-input studio-input-mono"
              defaultValue={report?.score ?? ""}
              placeholder={isFactory ? "85" : "—"}
              disabled={!isFactory}
            />
            {state.fieldErrors?.score && (
              <FieldError msg={state.fieldErrors.score} />
            )}
          </div>
        </div>

        {/* Conclusión */}
        <div>
          <label className="studio-label" htmlFor="ins-conclusion">
            Conclusión{" "}
            <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
              (opcional)
            </span>
          </label>
          <select
            id="ins-conclusion"
            name="conclusion"
            className="studio-input"
            defaultValue={report?.conclusion ?? ""}
          >
            <option value="">Sin determinar</option>
            {INSPECTION_CONCLUSION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.conclusion && (
            <FieldError msg={state.fieldErrors.conclusion} />
          )}
        </div>

        {/* Proveedor INTERNO (white-label) */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
          }}
        >
          <label className="studio-label" htmlFor="ins-provider">
            Proveedor de inspección{" "}
            <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
              (interno)
            </span>
          </label>
          <input
            id="ins-provider"
            name="provider_internal"
            type="text"
            className="studio-input"
            defaultValue={report?.provider_internal ?? ""}
            placeholder="Tercero que ejecutó la inspección"
            autoComplete="off"
          />
          <p
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "6px 0 0",
            }}
          >
            Solo uso interno. Nunca aparece en el reporte que ve el cliente.
          </p>
        </div>

        <p
          style={{
            font: "500 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {inspectionTypeShort(type)} · esta fase captura la cabecera; los
          campos de detalle se completan en el reporte.
        </p>

        {state.error && (
          <Aviso tono="error" compacto>
            {state.error}
          </Aviso>
        )}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel={mode === "create" ? "Crear reporte" : "Guardar cambios"}
      />
    </DrawerShell>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
