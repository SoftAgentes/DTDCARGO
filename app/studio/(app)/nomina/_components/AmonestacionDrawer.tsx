"use client";

/**
 * AmonestacionDrawer — asistente por pasos para emitir una amonestación
 * (SDD-0103 · Slice C). Sigue el flujo del Norte: causa (Art. 79) → relato →
 * testigos → acta (revisión). Un solo <form id> HTML5 monta todos los campos;
 * los pasos solo controlan QUÉ se muestra (los inputs no montados conservan su
 * defaultValue porque el form no se desmonta). Submit en el footer del último
 * paso, sin requestSubmit. useActionState + fieldErrors del validador.
 */

import { useActionState, useEffect, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  ART79_CAUSES,
  WARNING_SEVERITY_OPTIONS,
  warningSeverityLabel,
  type WarningSeverity,
} from "@/lib/studio/nomina/warning-types";
import type { Employee } from "@/lib/studio/nomina/employee-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import { emitirAmonestacionAction } from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";

const FORM_ID = "amonestacion-form";
const initial: NominaActionState = {};

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ["Causa", "Relato", "Testigos", "Acta"];

const todayISO = () => new Date().toISOString().slice(0, 10);

export function AmonestacionDrawer({
  employees,
  onClose,
}: {
  employees: Employee[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(emitirAmonestacionAction, initial);
  const [step, setStep] = useState<Step>(0);

  // Estado controlado de los campos clave (para validar pasos + render del acta).
  const [employeeId, setEmployeeId] = useState<string>(employees[0]?.id ?? "");
  const [cause, setCause] = useState<string>(ART79_CAUSES[0]?.value ?? "");
  const [severity, setSeverity] = useState<WarningSeverity>("leve");
  const [issuedOn, setIssuedOn] = useState<string>(todayISO());
  const [narrative, setNarrative] = useState<string>("");
  const [witnesses, setWitnesses] = useState<string>("");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  const [handledFieldErrors, setHandledFieldErrors] = useState(state.fieldErrors);
  if (handledFieldErrors !== state.fieldErrors) {
    setHandledFieldErrors(state.fieldErrors);
    const fe = state.fieldErrors;
    if (fe?.employee_id || fe?.cause || fe?.severity || fe?.issued_on) setStep(0);
    else if (fe?.narrative) setStep(1);
  }

  const emp = employees.find((e) => e.id === employeeId);

  const canNext =
    step === 0
      ? !!employeeId && !!cause.trim()
      : step === 1
        ? !!narrative.trim()
        : true;

  const isLast = step === 3;

  const goNext = () => {
    if (!isLast && canNext) setStep((s) => (s + 1) as Step);
  };
  const goBack = () => {
    if (step > 0) setStep((s) => (s - 1) as Step);
  };

  return (
    <DrawerShell
      title="Nueva amonestación"
      subtitle={`Paso ${step + 1} de 4 · ${STEP_LABELS[step]}`}
      onClose={onClose}
      pending={isPending}
      width={640}
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
          gap: "var(--s-4)",
        }}
      >
        {/* Stepper visual */}
        <div style={{ display: "flex", gap: 6, marginBottom: "var(--s-2)" }}>
          {STEP_LABELS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={label} style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: done || active ? "var(--wine)" : "var(--border)",
                  }}
                />
                <div
                  style={{
                    font: `${active ? 700 : 500} 10px/1.4 var(--f-sans)`,
                    color: active ? "var(--ink)" : "var(--ink-mute)",
                    marginTop: 5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Paso 0 · Causa ─────────────────────────────────── */}
        {/* Hidden inputs siempre presentes: el form los manda en cualquier paso. */}
        <input type="hidden" name="employee_id" value={employeeId} />
        <input type="hidden" name="cause" value={cause} />
        <input type="hidden" name="severity" value={severity} />
        <input type="hidden" name="issued_on" value={issuedOn} />
        <input type="hidden" name="narrative" value={narrative} />
        <input type="hidden" name="witnesses" value={witnesses} />

        {step === 0 && (
          <>
            <Field label="Empleado" error={state.fieldErrors?.employee_id} required>
              <select
                className="studio-input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {employees.length === 0 && <option value="">Sin empleados</option>}
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} · {e.employee_code}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Causal (Art. 79 LOTTT)" error={state.fieldErrors?.cause} required>
              <select
                className="studio-input"
                value={ART79_CAUSES.some((c) => c.value === cause) ? cause : "__custom__"}
                onChange={(e) => {
                  if (e.target.value !== "__custom__") setCause(e.target.value);
                  else setCause("");
                }}
              >
                {ART79_CAUSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
                <option value="__custom__">Otra (escribir)</option>
              </select>
            </Field>

            {!ART79_CAUSES.some((c) => c.value === cause) && (
              <Field label="Describe la causal">
                <input
                  type="text"
                  className="studio-input"
                  value={cause}
                  maxLength={200}
                  placeholder="Falta de régimen interno…"
                  onChange={(e) => setCause(e.target.value)}
                />
              </Field>
            )}

            <Row>
              <Field label="Severidad" error={state.fieldErrors?.severity}>
                <select
                  className="studio-input"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as WarningSeverity)}
                >
                  {WARNING_SEVERITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha de emisión" error={state.fieldErrors?.issued_on}>
                <input
                  type="date"
                  className="studio-input"
                  value={issuedOn}
                  onChange={(e) => setIssuedOn(e.target.value)}
                />
              </Field>
            </Row>
          </>
        )}

        {/* ── Paso 1 · Relato ────────────────────────────────── */}
        {step === 1 && (
          <Field label="Relato del hecho" error={state.fieldErrors?.narrative} required>
            <textarea
              className="studio-input"
              rows={8}
              value={narrative}
              maxLength={2000}
              placeholder="Describe qué ocurrió, cuándo y dónde, con el mayor detalle posible."
              onChange={(e) => setNarrative(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </Field>
        )}

        {/* ── Paso 2 · Testigos ──────────────────────────────── */}
        {step === 2 && (
          <Field label="Testigos (opcional)">
            <textarea
              className="studio-input"
              rows={4}
              value={witnesses}
              placeholder="Nombre y cargo de quienes presenciaron el hecho."
              onChange={(e) => setWitnesses(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </Field>
        )}

        {/* ── Paso 3 · Acta (revisión) ───────────────────────── */}
        {step === 3 && (
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-3)",
            }}
          >
            <ActaRow label="Empleado" value={emp ? `${emp.full_name} · ${emp.employee_code}` : "—"} />
            <ActaRow label="Causal" value={cause || "—"} />
            <ActaRow label="Severidad" value={warningSeverityLabel(severity)} />
            <ActaRow label="Fecha" value={issuedOn} mono />
            <ActaRow label="Relato" value={narrative || "—"} block />
            <ActaRow label="Testigos" value={witnesses.trim() || "Sin testigos"} block />
            <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
              Al emitir, se genera un código AM-NNNN y queda como acta. Después solo
              puedes anularla (no se borra: queda el rastro).
            </p>
          </div>
        )}

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      {/* Footer: navegación de pasos · submit solo en el último. */}
      {isLast ? (
        <DrawerFooter
          formId={FORM_ID}
          onClose={goBack}
          isPending={isPending}
          canSubmit={!!employeeId && !!cause.trim() && !!narrative.trim()}
          submitLabel="Emitir amonestación"
          cancelLabel="Atrás"
          pendingLabel="Emitiendo…"
        />
      ) : (
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={step === 0 ? onClose : goBack}
            disabled={isPending}
          >
            {step === 0 ? "Cancelar" : "Atrás"}
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={goNext}
            disabled={!canNext}
          >
            Siguiente
          </button>
        </footer>
      )}
    </DrawerShell>
  );
}

function ActaRow({
  label,
  value,
  mono,
  block,
}: {
  label: string;
  value: string;
  mono?: boolean;
  block?: boolean;
}) {
  return (
    <div
      style={{
        display: block ? "block" : "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <span
        style={{
          font: "700 9.5px/1.4 var(--f-sans)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          display: block ? "block" : undefined,
          marginBottom: block ? 4 : undefined,
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: `${mono ? "600" : "500"} 12.5px/1.45 ${mono ? "var(--f-mono)" : "var(--f-sans)"}`,
          color: "var(--ink)",
          textAlign: block ? "left" : "right",
          whiteSpace: block ? "pre-wrap" : "normal",
        }}
      >
        {value}
      </span>
    </div>
  );
}
