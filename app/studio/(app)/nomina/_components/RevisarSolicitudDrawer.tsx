"use client";

/**
 * RevisarSolicitudDrawer — el admin aprueba o rechaza una solicitud de registro
 * (SDD-0113 Slice A). Aprobar materializa la ficha con el **sueldo que define la
 * empresa** (no el del candidato). Rechazar exige motivo. Dos server actions
 * bindeadas con el id de la solicitud. useActionState + fieldErrors.
 *
 * SDD-0652 fase 2 (N2): la bandeja ya no trae la cédula ni la cuenta. Este
 * panel pide los datos de la revisión al abrirse (`getRegistrationReviewAction`),
 * solo para una solicitud pendiente, y la cuenta llega enmascarada. Mientras
 * carga o si falla se dice: un error no se confunde con «no hay datos».
 *
 * Si el correo de la solicitud ya tenía una cuenta, la ficha se crea sin acceso
 * y el panel se queda abierto para decirlo (no se cierra solo).
 */

import { useActionState, useCallback, useEffect, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { bankAccountTypeLabel, type NominaActionState } from "@/lib/studio/nomina/employee-types";
import type { RegistrationListItem, RegistrationReview } from "@/lib/studio/nomina/registration-types";
import { approveRegistrationAction, getRegistrationReviewAction, rejectRegistrationAction } from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";
import { submitKeepingDraft } from "@/lib/shared/submit-keeping-draft";
import { DateField } from "@/app/studio/_components/ui/DateField";

const initial: NominaActionState = {};

type Carga = { kind: "cargando" } | { kind: "error"; msg: string } | { kind: "ok"; datos: RegistrationReview };

function DataRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
      <span style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>{label}</span>
      <span
        style={{
          font: `600 12.5px/1.3 var(${mono ? "--f-mono" : "--f-sans"})`,
          color: "var(--ink)",
          textAlign: "right",
          overflowWrap: "anywhere",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export function RevisarSolicitudDrawer({
  registration,
  onClose,
}: {
  registration: RegistrationListItem;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"aprobar" | "rechazar">("aprobar");
  const [carga, setCarga] = useState<Carga>({ kind: "cargando" });
  const [intento, setIntento] = useState(0);

  const approve = approveRegistrationAction.bind(null, registration.id);
  const reject = rejectRegistrationAction.bind(null, registration.id);
  const [aState, aAction, aPending] = useActionState(approve, initial);
  const [rState, rAction, rPending] = useActionState(reject, initial);

  useEffect(() => {
    let vivo = true;
    getRegistrationReviewAction(registration.id)
      .then((r) => {
        if (!vivo) return;
        setCarga("error" in r ? { kind: "error", msg: r.error } : { kind: "ok", datos: r.registration });
      })
      .catch(() => {
        if (vivo) setCarga({ kind: "error", msg: "No se pudo cargar la solicitud. Intenta de nuevo." });
      });
    return () => {
      vivo = false;
    };
  }, [registration.id, intento]);

  const reintentar = useCallback(() => {
    setCarga({ kind: "cargando" });
    setIntento((n) => n + 1);
  }, []);

  // Con aviso de acceso el panel no se cierra solo: hay algo que leer.
  const aprobadaConAviso = !!aState.ok && !!aState.accessWarning;
  useEffect(() => {
    if ((aState.ok && !aState.accessWarning) || rState.ok) onClose();
  }, [aState.ok, aState.accessWarning, rState.ok, onClose]);

  const isPending = aPending || rPending;
  const FORM_ID = mode === "aprobar" ? "aprobar-solicitud-form" : "rechazar-solicitud-form";

  if (aprobadaConAviso) {
    return (
      <DrawerShell title="Solicitud aprobada" subtitle={registration.full_name} onClose={onClose} pending={false} width={560}>
        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
          <Aviso tono="exito" titulo={aState.createdCode ? `Ficha ${aState.createdCode} creada` : "Ficha creada"}>
            La persona ya aparece en Empleados.
          </Aviso>
          <Aviso tono="atencion" titulo="Quedó sin acceso">
            {aState.accessWarning}
          </Aviso>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border)" }}>
          <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </DrawerShell>
    );
  }

  const datos = carga.kind === "ok" ? carga.datos : null;

  return (
    <DrawerShell
      title="Revisar solicitud"
      subtitle={registration.full_name}
      onClose={onClose}
      pending={isPending}
      width={560}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
        {carga.kind === "cargando" && (
          <p role="status" style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Cargando los datos de la solicitud…
          </p>
        )}
        {carga.kind === "error" && (
          <Aviso tono="error" accion={{ etiqueta: "Reintentar", onClick: reintentar }}>
            {carga.msg}
          </Aviso>
        )}

        {datos && (
          <>
            {/* Datos del candidato (solo lectura). La cuenta, enmascarada. */}
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <DataRow label="Cédula" value={datos.national_id} mono />
              <DataRow label="Correo" value={datos.email} />
              <DataRow label="Teléfono" value={datos.phone} mono />
              <DataRow label="Cargo propuesto" value={datos.cargo} />
              <DataRow label="Banco" value={datos.bank_name} />
              <DataRow
                label="Tipo de cuenta"
                value={datos.bank_account_type ? bankAccountTypeLabel(datos.bank_account_type) : null}
              />
              <DataRow label="Cuenta" value={datos.bank_account_masked} mono />
              <p style={{ font: "400 11.5px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: "4px 0 0" }}>
                Aquí se ven solo los últimos 4 dígitos. El número completo se consulta desde la ficha, con motivo.
              </p>
            </div>

            {/* Toggle aprobar / rechazar */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setMode("aprobar")}
                className={`studio-btn studio-btn-sm ${mode === "aprobar" ? "studio-btn-primary" : "studio-btn-ghost"}`}
              >
                Aprobar
              </button>
              <button
                type="button"
                onClick={() => setMode("rechazar")}
                className={`studio-btn studio-btn-sm ${mode === "rechazar" ? "studio-btn-danger" : "studio-btn-ghost"}`}
              >
                Rechazar
              </button>
            </div>

            {mode === "aprobar" ? (
              <form id="aprobar-solicitud-form" onSubmit={submitKeepingDraft(aAction, aPending)} style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
                <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
                  Al aprobar se crea la ficha del empleado. El <strong>sueldo lo defines tú</strong>, no el
                  candidato.
                </p>
                <Row>
                  <Field label="Sueldo mensual (USD)" error={aState.fieldErrors?.salary_usd} required>
                    <input name="salary_usd" type="number" min={0} step="0.01" className="studio-input studio-input-mono" placeholder="0.00" required />
                  </Field>
                  <Field label="Fecha de ingreso" error={aState.fieldErrors?.hire_date}>
                    <DateField name="hire_date" defaultValue={datos.start_date ?? undefined} />
                  </Field>
                </Row>
                {aState.error && <ErrorBox>{aState.error}</ErrorBox>}
              </form>
            ) : (
              <form id="rechazar-solicitud-form" onSubmit={submitKeepingDraft(rAction, rPending)} style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
                <Field label="Motivo del rechazo" error={rState.fieldErrors?.rejection_reason} required>
                  <textarea name="rejection_reason" className="studio-input" rows={3} style={{ resize: "vertical" }} placeholder="Por qué no procede esta solicitud" required />
                </Field>
                {rState.error && <ErrorBox>{rState.error}</ErrorBox>}
              </form>
            )}
          </>
        )}
      </div>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit={!!datos}
        submitLabel={mode === "aprobar" ? "Aprobar y crear ficha" : "Rechazar solicitud"}
      />
    </DrawerShell>
  );
}
