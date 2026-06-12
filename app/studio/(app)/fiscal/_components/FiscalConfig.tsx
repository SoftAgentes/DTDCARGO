"use client";

/**
 * FiscalConfig — tab "Configuración" del módulo Fiscal/SENIAT (SDD-0073).
 *
 * El CORAZÓN del módulo: el admin define acá las reglas tributarias del tenant
 * (calificación del servicio, alícuota, contribuyente especial, agente de
 * retención, % de retención, modo de IVA de compras, periodicidad). Los Libros
 * de IVA LEEN esta config — cambiar un valor cambia los libros sin tocar código.
 *
 * Form submit estándar (useActionState + saveFiscalSettingsAction). Cada campo
 * lleva una nota "esto lo define tu contador". Admin-only: si el usuario no es
 * admin, el form se muestra deshabilitado con aviso (la action y la RLS también
 * lo gatean). Sin Zod, sin libs.
 */

import { useActionState, useEffect, useState } from "react";
import {
  PURCHASE_IVA_MODES,
  SERVICE_IVA_TREATMENTS,
  purchaseIvaModeLabel,
  serviceIvaTreatmentLabel,
  type FiscalSettings,
  type FiscalSettingsActionState,
} from "@/lib/studio/fiscal/config-types";
import { saveFiscalSettingsAction } from "../actions";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";

const initialState: FiscalSettingsActionState = {};

function FieldHint({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <p
      style={{
        font: "400 11.5px/1.45 var(--f-sans)",
        color: error ? "var(--danger)" : "var(--ink-soft)",
        margin: "5px 0 0",
      }}
    >
      {error ?? children}
    </p>
  );
}

export function FiscalConfig({
  settings,
  canEdit,
}: {
  settings: FiscalSettings;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    saveFiscalSettingsAction,
    initialState,
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(false);
  }, [state]);

  useEffect(() => {
    if (state.ok) {
      toast.success(
        "Configuración fiscal guardada · los libros la toman de inmediato.",
      );
    }
  }, [state, toast]);

  const errFor = (k: keyof NonNullable<FiscalSettingsActionState["fieldErrors"]>) =>
    dirty ? undefined : state.fieldErrors?.[k];

  const disabled = isPending || !canEdit;
  const usingDefaults = settings.tenant_id == null;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Disclaimer honesto: no es asesoría fiscal (spec) */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "12px 16px",
          marginBottom: 20,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        <span style={{ color: "var(--ink-soft)", flexShrink: 0, marginTop: 1, display: "inline-flex" }}>
          {Icon.info(15)}
        </span>
        <p style={{ font: "400 12.5px/1.55 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Esto NO es asesoría fiscal. El sistema fija el{" "}
          <strong style={{ color: "var(--ink)" }}>andamiaje configurable</strong>;
          los <strong style={{ color: "var(--ink)" }}>valores</strong> (¿exento o
          gravado?, %, periodicidad) los define tu{" "}
          <strong style={{ color: "var(--ink)" }}>contador</strong>. Los Libros de
          Ventas y Compras se generan a partir de lo que configures acá.
          {usingDefaults && (
            <> Todavía no guardaste la configuración — el módulo usa valores por defecto.</>
          )}
        </p>
      </div>

      {!canEdit && (
        <div
          role="note"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "10px 14px",
            marginBottom: 20,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          <span style={{ color: "var(--ink-soft)", display: "inline-flex" }}>{Icon.lock(15)}</span>
          <span style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            Solo un administrador puede editar la configuración fiscal. Puedes verla,
            pero no guardarla.
          </span>
        </div>
      )}

      <form action={formAction} onChange={() => setDirty(true)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* ── Calificación del servicio ── */}
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="studio-eyebrow" style={{ marginBottom: 14, color: "var(--ink-soft)" }}>
              Calificación tributaria
            </legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div>
                <label className="studio-label" htmlFor="fs-treatment" style={{ display: "block", marginBottom: 6 }}>
                  Calificación del servicio
                </label>
                <select
                  id="fs-treatment"
                  name="service_iva_treatment"
                  className="studio-input"
                  defaultValue={settings.service_iva_treatment}
                  disabled={disabled}
                  aria-invalid={!!errFor("service_iva_treatment")}
                >
                  {SERVICE_IVA_TREATMENTS.map((t) => (
                    <option key={t} value={t}>
                      {serviceIvaTreatmentLabel(t)}
                    </option>
                  ))}
                </select>
                <FieldHint error={errFor("service_iva_treatment")}>
                  Cómo tributa tu servicio. Define si el Libro de Ventas cobra IVA
                  (gravado) o no (exento). Lo decide tu contador.
                </FieldHint>
              </div>

              <div>
                <label className="studio-label" htmlFor="fs-rate" style={{ display: "block", marginBottom: 6 }}>
                  Alícuota general (%)
                </label>
                <input
                  id="fs-rate"
                  name="iva_rate"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  className="studio-input studio-input-mono"
                  defaultValue={settings.iva_rate}
                  disabled={disabled}
                  aria-invalid={!!errFor("iva_rate")}
                />
                <FieldHint error={errFor("iva_rate")}>
                  Alícuota de IVA vigente (hoy 16% en Venezuela). La fija tu contador.
                </FieldHint>
              </div>
            </div>
          </fieldset>

          {/* ── Condición frente al SENIAT ── */}
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="studio-eyebrow" style={{ marginBottom: 14, color: "var(--ink-soft)" }}>
              Condición frente al SENIAT
            </legend>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <CheckRow
                id="fs-special"
                name="is_special_taxpayer"
                defaultChecked={settings.is_special_taxpayer}
                disabled={disabled}
                label="Contribuyente especial"
                hint="Marca si el SENIAT te designó contribuyente especial. Lo confirma tu contador."
              />
              <CheckRow
                id="fs-agent"
                name="is_iva_withholding_agent"
                defaultChecked={settings.is_iva_withholding_agent}
                disabled={disabled}
                label="Agente de retención de IVA"
                hint="Marca si retienes IVA a tus proveedores. Prepara la columna de retención en los libros."
              />
              <div style={{ maxWidth: 280 }}>
                <label className="studio-label" htmlFor="fs-whpct" style={{ display: "block", marginBottom: 6 }}>
                  % de retención de IVA
                </label>
                <input
                  id="fs-whpct"
                  name="iva_withholding_pct"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  className="studio-input studio-input-mono"
                  defaultValue={settings.iva_withholding_pct}
                  disabled={disabled}
                  aria-invalid={!!errFor("iva_withholding_pct")}
                />
                <FieldHint error={errFor("iva_withholding_pct")}>
                  Porcentaje a retener (75% o 100% según el SENIAT). Lo define tu contador.
                </FieldHint>
              </div>
            </div>
          </fieldset>

          {/* ── Compras y declaración ── */}
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="studio-eyebrow" style={{ marginBottom: 14, color: "var(--ink-soft)" }}>
              Compras y declaración
            </legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div>
                <label className="studio-label" htmlFor="fs-pmode" style={{ display: "block", marginBottom: 6 }}>
                  Fuente del IVA de compras
                </label>
                <select
                  id="fs-pmode"
                  name="purchase_iva_mode"
                  className="studio-input"
                  defaultValue={settings.purchase_iva_mode}
                  disabled={disabled}
                  aria-invalid={!!errFor("purchase_iva_mode")}
                >
                  {PURCHASE_IVA_MODES.map((m) => (
                    <option key={m} value={m}>
                      {purchaseIvaModeLabel(m)}
                    </option>
                  ))}
                </select>
                <FieldHint error={errFor("purchase_iva_mode")}>
                  De dónde sale el IVA del Libro de Compras. Hoy las compras no
                  discriminan IVA: la columna queda en “—” hasta que se capture.
                </FieldHint>
              </div>

              <div>
                <label className="studio-label" htmlFor="fs-period" style={{ display: "block", marginBottom: 6 }}>
                  Periodicidad de declaración
                </label>
                <select
                  id="fs-period"
                  name="declaration_period"
                  className="studio-input"
                  defaultValue={settings.declaration_period}
                  disabled={disabled}
                  aria-invalid={!!errFor("declaration_period")}
                >
                  <option value="mensual">Mensual</option>
                </select>
                <FieldHint error={errFor("declaration_period")}>
                  El IVA se declara por mes. La periodicidad la fija el SENIAT.
                </FieldHint>
              </div>
            </div>
          </fieldset>
        </div>

        {!dirty && state.error && (
          <p
            role="alert"
            style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--danger)", margin: "20px 0 0" }}
          >
            {state.error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 12,
            marginTop: 28,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          <button
            type="submit"
            className="studio-btn studio-btn-primary"
            disabled={disabled}
            aria-busy={isPending}
          >
            {isPending ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </form>

      {settings.updated_at && (
        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: "14px 0 0" }}>
          Última actualización:{" "}
          {new Date(settings.updated_at).toLocaleString("es-VE")}.
        </p>
      )}
    </div>
  );
}

/**
 * Checkbox con hidden "0" previo (mismo name) para que un desmarcado llegue como
 * false a la action (HTML no postea checkboxes desmarcados).
 */
function CheckRow({
  id,
  name,
  defaultChecked,
  disabled,
  label,
  hint,
}: {
  id: string;
  name: string;
  defaultChecked: boolean;
  disabled: boolean;
  label: string;
  hint: string;
}) {
  return (
    <div>
      <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: disabled ? "default" : "pointer" }}>
        <input type="hidden" name={name} value="0" />
        <input
          id={id}
          name={name}
          type="checkbox"
          value="1"
          defaultChecked={defaultChecked}
          disabled={disabled}
          style={{ width: 16, height: 16, accentColor: "var(--wine)" }}
        />
        <span style={{ font: "600 13.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>{label}</span>
      </label>
      <p style={{ font: "400 11.5px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: "5px 0 0 26px" }}>
        {hint}
      </p>
    </div>
  );
}
