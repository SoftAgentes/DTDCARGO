"use client";

/**
 * FiscalConfig — tab "Configuración" del módulo Fiscal/SENIAT (SDD-0073 §8).
 *
 * El CORAZÓN del módulo: el admin define acá las reglas tributarias del tenant
 * según la estructura canónica §8 (4 principios del founder + research SENIAT):
 *   A · master toggle (módulo ON/OFF · principio #1)
 *   B · contribuyente especial
 *   C · alícuotas (general/reducida/exportación/recargo suntuario)
 *   D · modo de IVA por defecto de facturas nuevas (principio #3)
 *   E · IGTF (sobre cobros en divisa)
 *   F · retención de IVA
 *   G · facturación digital (proveedor homologado asigna el nº de control)
 *   H · compras y período de declaración
 *
 * Los Libros de IVA y (cuando se active) la facturación LEEN esta config —
 * cambiar un valor cambia el comportamiento sin tocar código. Cero hardcode.
 *
 * Form submit estándar (useActionState + saveFiscalSettingsAction). Cada campo
 * lleva una nota "esto lo define tu contador". Admin-only: si el usuario no es
 * admin, el form se muestra deshabilitado con aviso (la action y la RLS también
 * lo gatean). Sin Zod, sin libs.
 */

import { useActionState, useEffect, useState } from "react";
import {
  INVOICE_IVA_MODES,
  PURCHASE_IVA_MODES,
  invoiceIvaModeLabel,
  purchaseIvaModeLabel,
  type FiscalSettings,
  type FiscalSettingsActionState,
} from "@/lib/studio/fiscal/config-types";
import { saveFiscalSettingsAction } from "../actions";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const initialState: FiscalSettingsActionState = {};

type FieldErrors = NonNullable<FiscalSettingsActionState["fieldErrors"]>;

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

const GROUP_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

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
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    setDirty(false);
  }

  useEffect(() => {
    if (state.ok) {
      toast.success(
        "Configuración fiscal guardada · los libros la toman de inmediato.",
      );
    }
  }, [state, toast]);

  const errFor = (k: keyof FieldErrors) =>
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
          padding: "var(--s-3) var(--s-4)",
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
          los <strong style={{ color: "var(--ink)" }}>valores</strong> (¿con IVA o
          sin IVA?, %, contribuyente especial, retención) los define tu{" "}
          <strong style={{ color: "var(--ink)" }}>contador</strong>. Con el módulo
          desactivado nada de esto se aplica: la facturación sigue normal.
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
          {/* ── A · Master toggle ── */}
          <Group title="Activación del módulo">
            <div
              style={{
                gridColumn: "1 / -1",
                background: settings.fiscal_module_enabled
                  ? "var(--bg-surface)"
                  : "var(--bg-elevated)",
                // Acento visible cuando está ON: es la decisión maestra del módulo.
                border: `1.5px solid ${
                  settings.fiscal_module_enabled ? "var(--success)" : "var(--border)"
                }`,
                borderRadius: "var(--r-md)",
                padding: "14px 16px",
              }}
            >
              <CheckRow
                id="fs-master"
                name="fiscal_module_enabled"
                defaultChecked={settings.fiscal_module_enabled}
                disabled={disabled}
                label="Activar el módulo Fiscal/SENIAT"
                hint="Con el módulo APAGADO no se generan libros ni se toca el IVA: la facturación funciona normal. Préndelo solo cuando tu contador confirme que vas a declarar IVA. Esta es la decisión maestra."
                strong
              />
            </div>
          </Group>

          {/* ── B · Condición frente al SENIAT ── */}
          <Group title="Condición frente al SENIAT">
            <div style={{ gridColumn: "1 / -1" }}>
              <CheckRow
                id="fs-special"
                name="is_special_taxpayer"
                defaultChecked={settings.is_special_taxpayer}
                disabled={disabled}
                label="Contribuyente especial (SPE)"
                hint="Marca si el SENIAT te designó Sujeto Pasivo Especial. Determina el IGTF y la retención de IVA. Lo confirma tu contador."
              />
            </div>
          </Group>

          {/* ── C · Alícuotas ── */}
          <Group title="Alícuotas de IVA (%)">
            <RateField id="fs-rg" name="iva_rate_general" label="General"
              defaultValue={settings.iva_rate_general} disabled={disabled} error={errFor("iva_rate_general")}
              hint="Alícuota general vigente (hoy 16%). El Ejecutivo la mueve en banda 8–16,5%." />
            <RateField id="fs-rr" name="iva_rate_reduced" label="Reducida"
              defaultValue={settings.iva_rate_reduced} disabled={disabled} error={errFor("iva_rate_reduced")}
              hint="Alícuota reducida (hoy 8%) para ciertos bienes/servicios." />
            <RateField id="fs-re" name="iva_rate_export" label="Exportación"
              defaultValue={settings.iva_rate_export} disabled={disabled} error={errFor("iva_rate_export")}
              hint="Exportación de bienes/servicios (tasa cero, 0%)." />
            <RateField id="fs-rl" name="iva_rate_luxury_surcharge" label="Recargo suntuario"
              defaultValue={settings.iva_rate_luxury_surcharge} disabled={disabled} error={errFor("iva_rate_luxury_surcharge")}
              hint="Recargo a bienes suntuarios (hoy +15%, total 31%)." />
          </Group>

          {/* ── D · Default de IVA por factura ── */}
          <Group title="Facturación">
            <div>
              <label className="studio-label" htmlFor="fs-defmode" style={{ display: "block", marginBottom: 6 }}>
                IVA por defecto en facturas nuevas
              </label>
              <select
                id="fs-defmode"
                name="default_invoice_iva_mode"
                className="studio-input"
                defaultValue={settings.default_invoice_iva_mode}
                disabled={disabled}
                aria-invalid={!!errFor("default_invoice_iva_mode")}
              >
                {INVOICE_IVA_MODES.map((m) => (
                  <option key={m} value={m}>{invoiceIvaModeLabel(m)}</option>
                ))}
              </select>
              <FieldHint error={errFor("default_invoice_iva_mode")}>
                Cada factura nace con este modo, pero puedes cambiarlo factura por
                factura. Hoy DTD factura “Sin IVA”.
              </FieldHint>
            </div>
          </Group>

          {/* ── E · IGTF ── */}
          <Group title="IGTF (cobros en divisa)">
            <div style={{ gridColumn: "1 / -1" }}>
              <CheckRow
                id="fs-igtf"
                name="igtf_enabled"
                defaultChecked={settings.igtf_enabled}
                disabled={disabled}
                label="Aplicar IGTF a cobros en divisa"
                hint="Impuesto a las Grandes Transacciones Financieras sobre pagos en moneda extranjera/cripto."
              />
            </div>
            <RateField id="fs-igtfrate" name="igtf_rate_fx" label="Tasa de IGTF (%)"
              defaultValue={settings.igtf_rate_fx} disabled={disabled} error={errFor("igtf_rate_fx")}
              hint="Hoy 3% (Art. 24). La fija el Ejecutivo por decreto." />
            <div style={{ alignSelf: "end" }}>
              <CheckRow
                id="fs-igtfagent"
                name="igtf_is_perception_agent"
                defaultChecked={settings.igtf_is_perception_agent}
                disabled={disabled}
                label="Agente de percepción de IGTF"
                hint="Solo si eres contribuyente especial. Lo confirma tu contador."
              />
            </div>
          </Group>

          {/* ── F · Retención de IVA ── */}
          <Group title="Retención de IVA">
            <div style={{ gridColumn: "1 / -1" }}>
              <CheckRow
                id="fs-agent"
                name="iva_withholding_agent"
                defaultChecked={settings.iva_withholding_agent}
                disabled={disabled}
                label="Agente de retención de IVA"
                hint="Marca si el SENIAT te designó agente de retención (solo si eres SPE). Prepara la columna de retención en los libros."
              />
            </div>
            <RateField id="fs-whpct" name="iva_withholding_pct" label="% de retención"
              defaultValue={settings.iva_withholding_pct} disabled={disabled} error={errFor("iva_withholding_pct")}
              hint="Porcentaje a retener (75% o 100% según el SENIAT). Lo define tu contador." />
          </Group>

          {/* ── G · Facturación digital ── */}
          <Group title="Facturación digital (SENIAT)">
            <div style={{ gridColumn: "1 / -1" }}>
              <CheckRow
                id="fs-digital"
                name="digital_invoicing_enabled"
                defaultChecked={settings.digital_invoicing_enabled}
                disabled={disabled}
                label="Facturación fiscal digital habilitada"
                hint="DTD NO está obligada hoy. Si algún día emites factura fiscal digital, el nº de control lo asigna un proveedor HOMOLOGADO — el sistema NO lo autogenera."
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="fs-provider" style={{ display: "block", marginBottom: 6 }}>
                Proveedor homologado
              </label>
              <input
                id="fs-provider"
                name="homologated_provider"
                type="text"
                className="studio-input"
                defaultValue={settings.homologated_provider ?? ""}
                disabled={disabled}
                placeholder="(ninguno)"
              />
              <FieldHint>
                Nombre del proveedor homologado por el SENIAT (cuando aplique). Déjalo
                vacío si no usas facturación digital.
              </FieldHint>
            </div>
          </Group>

          {/* ── H · Compras y declaración ── */}
          <Group title="Compras y declaración">
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
                  <option key={m} value={m}>{purchaseIvaModeLabel(m)}</option>
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
          </Group>
        </div>

        {!dirty && state.error && (
          <div style={{ marginTop: "var(--s-5)" }}>
            <Aviso tono="error">{state.error}</Aviso>
          </div>
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
        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "14px 0 0" }}>
          Última actualización:{" "}
          {new Date(settings.updated_at).toLocaleString("es-VE")}.
        </p>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="studio-eyebrow" style={{ marginBottom: 14, color: "var(--ink-soft)" }}>
        {title}
      </legend>
      <div style={GROUP_GRID}>{children}</div>
    </fieldset>
  );
}

/** Input numérico de porcentaje [0,100]. */
function RateField({
  id,
  name,
  label,
  defaultValue,
  disabled,
  error,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: number;
  disabled: boolean;
  error?: string;
  hint: string;
}) {
  return (
    <div>
      <label className="studio-label" htmlFor={id} style={{ display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        step="0.01"
        min={0}
        max={100}
        className="studio-input studio-input-mono"
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={!!error}
      />
      <FieldHint error={error}>{hint}</FieldHint>
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
  strong = false,
}: {
  id: string;
  name: string;
  defaultChecked: boolean;
  disabled: boolean;
  label: string;
  hint: string;
  strong?: boolean;
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
        {/* Disabled (no-admin) → texto atenuado pero legible, para que el bloqueo
            se note en todo el form y no solo en el banner superior. */}
        <span style={{ font: `${strong ? 700 : 600} ${strong ? 14.5 : 13.5}px/1.3 var(--f-sans)`, color: disabled ? "var(--ink-soft)" : "var(--ink)" }}>
          {label}
        </span>
      </label>
      <p style={{ font: "400 11.5px/1.45 var(--f-sans)", color: disabled ? "var(--ink-mute)" : "var(--ink-soft)", margin: "5px 0 0 26px" }}>
        {hint}
      </p>
    </div>
  );
}
