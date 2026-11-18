"use client";

/**
 * ReglasDrawer — editar los parámetros LOTTT (SDD-0103 · Slice B).
 * Es CONFIG, no cálculo: solo lee/guarda params. Form HTML5 (form="id" + submit
 * en el footer, sin requestSubmit). useActionState + fieldErrors del validador.
 * Guardar archiva el ruleset vigente y crea una versión nueva (lo hace la action).
 *
 * SDD-0653 A2b (migración 0556): vigencia y fuente legal, monedas de los bonos, ingreso
 * mínimo integral, aportes del patrono y escalas por antigüedad. Sin la 0556 esos campos
 * salen deshabilitados con un aviso y no se guardan (`ampliada: false`).
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  PAY_FREQUENCY_OPTIONS,
  DAY_METHOD_OPTIONS,
  PAYROLL_RULES_DEFAULTS,
  AJUSTES_LIQUIDACION_BASE,
  METODO_PRESTACIONES_OPTIONS,
  resolverAjustesLiquidacion,
  hoyCaracas,
  VIGENTE_DESDE_MIN,
  type PayrollRules,
} from "@/lib/studio/nomina/payroll-rules-types";
import type { NominaActionState } from "@/lib/studio/nomina/employee-types";
import { savePayrollRulesAction } from "../actions";
import { Field, Row, ErrorBox } from "./form-bits";
import { submitKeepingDraft } from "@/lib/shared/submit-keeping-draft";
import { PistaLey } from "./PistaLey";
import { DateField } from "@/app/studio/_components/ui/DateField";

const FORM_ID = "reglas-form";
const initial: NominaActionState = {};

/** Valor por defecto del campo: el del ruleset vigente o el default LOTTT. */
function val(rules: PayrollRules | null, key: keyof typeof PAYROLL_RULES_DEFAULTS): string {
  const fallback = PAYROLL_RULES_DEFAULTS[key];
  let v = rules ? (rules as unknown as Record<string, unknown>)[key] : fallback;
  // Un campo de la 0556 que la versión no trae (se guardó antes de la migración): el default.
  if (v === undefined) v = fallback;
  if (v == null) return "";
  if (Array.isArray(v)) return "";
  return String(v);
}

/**
 * Lo que la versión guardó en un campo de la 0556; vacío si no lo configuró (null) o no lo trae
 * (undefined). NUNCA la propuesta de la norma: lo que no se confirma no viaja como valor (SDD-0653 A2b).
 */
function valor0556(rules: PayrollRules | null, key: keyof typeof PAYROLL_RULES_DEFAULTS): string {
  const v = rules ? (rules as unknown as Record<string, unknown>)[key] : undefined;
  return v === null || v === undefined ? "" : String(v);
}

/** La propuesta de la norma conocida para un campo de la 0556 (vacía si no hay: el ingreso mínimo es un anuncio). */
function propuesta(key: keyof typeof PAYROLL_RULES_DEFAULTS): string {
  const p = PAYROLL_RULES_DEFAULTS[key];
  return p === null || p === undefined ? "" : String(p);
}

type Campo0556 = keyof typeof PAYROLL_RULES_DEFAULTS;

/**
 * «Usar la propuesta»: copia la propuesta de la norma a los campos VACÍOS del grupo. Es la única forma de que
 * esos valores se guarden como confirmados: sin pulsarlo, los campos se envían vacíos (null = sin configurar).
 */
function UsarPropuesta({ campos, etiqueta, disabled }: { campos: Campo0556[]; etiqueta: string; disabled: boolean }) {
  return (
    <div>
      <button
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-xs"
        disabled={disabled}
        aria-label={`Usar la propuesta: ${etiqueta}`}
        onClick={(e) => {
          const form = e.currentTarget.form;
          if (!form) return;
          for (const name of campos) {
            const el = form.elements.namedItem(name);
            if (el instanceof HTMLInputElement && el.value.trim() === "") {
              el.value = propuesta(name);
              // Asignar `value` no dispara nada: el evento hace que el texto «Sin configurar» se actualice.
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        }}
      >
        Usar la propuesta
      </button>
    </div>
  );
}

const MONEDA_OPCIONES = [
  { value: "USD", label: "USD" },
  { value: "VES", label: "Bs" },
];

/**
 * Un número de la 0556. Si el campo está vacío y hay propuesta de la norma, un texto VISIBLE debajo dice
 * «Sin configurar · propuesta: N» y queda enlazado con `aria-describedby` (no se depende del color del
 * placeholder). El texto desaparece en cuanto el campo tiene un valor.
 */
function Numero0556({
  name,
  label,
  inicial,
  espera,
  error,
  step,
  min,
  max,
}: {
  name: Campo0556;
  label: string;
  inicial: string;
  espera: boolean;
  error?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  const [vacio, setVacio] = useState(inicial.trim() === "");
  const p = propuesta(name);
  const ayuda = !espera && vacio && p !== "" ? `Sin configurar · propuesta: ${p}` : undefined;
  return (
    <Field label={label} error={error} ayuda={ayuda}>
      <input
        name={name}
        type="number"
        step={step ?? "0.01"}
        min={min ?? "0"}
        max={max}
        disabled={espera}
        className="studio-input studio-input-mono"
        defaultValue={espera ? "" : inicial}
        onInput={(e) => setVacio(e.currentTarget.value.trim() === "")}
      />
    </Field>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        font: "700 9.5px/1 var(--f-sans)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        marginTop: "var(--s-2)",
      }}
    >
      {children}
    </div>
  );
}

export function ReglasDrawer({
  rules,
  ampliada,
  onClose,
}: {
  rules: PayrollRules | null;
  /** ¿La base tiene la migración 0556? Sin ella, los campos nuevos no se guardan. */
  ampliada: boolean;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(savePayrollRulesAction, initial);
  const hoy = useMemo(() => hoyCaracas(), []);
  // SDD-0658: lo de la versión vigente (o los valores de fábrica de la 0179 si no los trae).
  const ajustes = resolverAjustesLiquidacion(
    { prestaciones_method: null, prestaciones_interest_pct: null, ajena_78_incluye_92: null },
    rules,
  );
  const espera = !ampliada;

  /** Un número de la 0556: deshabilitado mientras la migración esté en espera. */
  const num0556 = (
    name: keyof typeof PAYROLL_RULES_DEFAULTS,
    label: string,
    opts: { step?: string; min?: string; max?: string } = {},
  ) => (
    <Numero0556
      name={name}
      label={label}
      inicial={valor0556(rules, name)}
      espera={espera}
      error={state.fieldErrors?.[name]}
      step={opts.step}
      min={opts.min}
      max={opts.max}
    />
  );
  const moneda0556 = (name: "cestaticket_moneda" | "bono_guerra_moneda", label: string) => (
    <Field label={label} error={state.fieldErrors?.[name]}>
      <select name={name} className="studio-input" disabled={espera} defaultValue={val(rules, name) || "USD"}>
        {MONEDA_OPCIONES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <DrawerShell
      title="Reglas de cálculo"
      subtitle={
        rules
          ? `Versión ${rules.version} vigente · al guardar se crea la v${rules.version + 1}`
          : "Parámetros LOTTT — define la primera versión"
      }
      onClose={onClose}
      pending={isPending}
      width={680}
    >
      <form
        id={FORM_ID}
        onSubmit={submitKeepingDraft(formAction, isPending)}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        <p style={{ font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Estos parámetros son la fuente de verdad de la nómina del período. Acá no se
          calcula ningún recibo: el contador ajusta los valores y el motor de cálculo los
          consume después.
        </p>

        {espera && (
          <Aviso tono="info" titulo="Campos nuevos en espera" compacto>
            La base todavía no tiene la migración 0556: la vigencia, la fuente, las monedas de los bonos, el ingreso mínimo
            integral, los aportes del patrono y las escalas no se guardan hasta que se aplique.
          </Aviso>
        )}

        {/* Vigencia y fuente legal (D2) */}
        <GroupTitle>Vigencia de esta versión</GroupTitle>
        <Row>
          <Field label="Rige desde (informativa)" error={state.fieldErrors?.vigente_desde}>
            <DateField name="vigente_desde" min={VIGENTE_DESDE_MIN} max={hoy} disabled={espera} defaultValue={hoy} />
          </Field>
          <Field label="Fuente legal" error={state.fieldErrors?.fuente_legal}>
            <input
              name="fuente_legal"
              type="text"
              maxLength={200}
              disabled={espera}
              placeholder="G.O. N° 6.691 Ext., Decreto 4.653"
              className="studio-input"
              defaultValue=""
            />
          </Field>
        </Row>
        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "-8px 0 0" }}>
          «Rige desde» es la fecha desde la que rige esta versión de las reglas. Es informativa: el corte de nómina usa siempre
          la versión vigente, y la fecha no puede ser posterior a hoy. Cada cambio legal es una versión nueva: la anterior se
          conserva y los cortes ya hechos no cambian.
        </p>

        {/* Frecuencia y método de días */}
        <GroupTitle>Frecuencia y días</GroupTitle>
        <Row>
          <Field label="Frecuencia de pago" error={state.fieldErrors?.pay_frequency}>
            <select
              name="pay_frequency"
              className="studio-input"
              defaultValue={val(rules, "pay_frequency") || "mensual"}
            >
              {PAY_FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Método de días" error={state.fieldErrors?.day_method}>
            <select
              name="day_method"
              className="studio-input"
              defaultValue={val(rules, "day_method") || "30"}
            >
              {DAY_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </Row>

        {/* Montos base: el salario mínimo en Bs; los bonos, en la moneda que elijas (D4) */}
        <GroupTitle>Montos base</GroupTitle>
        <PistaLey campos={["min_salary", "ingreso_minimo_integral_usd", "cestaticket", "bono_guerra"]} />
        <Row>
          <Field label="Salario mínimo (Bs)" error={state.fieldErrors?.min_salary}>
            <input
              name="min_salary"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "min_salary")}
            />
          </Field>
          <Field label="Cestaticket" error={state.fieldErrors?.cestaticket}>
            <input
              name="cestaticket"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "cestaticket")}
            />
          </Field>
          <Field label="Bono de guerra" error={state.fieldErrors?.bono_guerra}>
            <input
              name="bono_guerra"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "bono_guerra")}
            />
          </Field>
        </Row>
        <Row>
          {moneda0556("cestaticket_moneda", "Moneda del cestaticket")}
          {moneda0556("bono_guerra_moneda", "Moneda del bono de guerra")}
          {num0556("ingreso_minimo_integral_usd", "Ingreso mínimo integral (USD)")}
        </Row>

        {/* Deducciones (%) */}
        <GroupTitle>Deducciones del empleado (%)</GroupTitle>
        <PistaLey campos={["sso_pct", "rpe_pct", "faov_pct", "inces_utilidades_pct"]} />
        <Row>
          <Field label="SSO / IVSS" error={state.fieldErrors?.sso_pct}>
            <input
              name="sso_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "sso_pct")}
            />
          </Field>
          <Field label="RPE" error={state.fieldErrors?.rpe_pct}>
            <input
              name="rpe_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "rpe_pct")}
            />
          </Field>
          <Field label="FAOV" error={state.fieldErrors?.faov_pct}>
            <input
              name="faov_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "faov_pct")}
            />
          </Field>
          {num0556("inces_utilidades_pct", "INCES sobre utilidades", { max: "100" })}
        </Row>
        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "-8px 0 0" }}>
          El INCES sobre utilidades lo retiene el patrono al trabajador (es una retención, no un aporte del patrono).
          Si esta versión no lo tenía configurado, el campo queda vacío y debajo se muestra la propuesta de la norma, por confirmar con el contador.
        </p>
        <UsarPropuesta campos={["inces_utilidades_pct"]} etiqueta="INCES sobre utilidades" disabled={espera} />

        {/* Topes (nº de SM) */}
        <GroupTitle>Topes de cotización (nº de salarios mínimos)</GroupTitle>
        <PistaLey campos={["sso_cap_sm", "rpe_cap_sm"]} />
        <Row>
          <Field label="Tope IVSS" error={state.fieldErrors?.sso_cap_sm}>
            <input
              name="sso_cap_sm"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "sso_cap_sm")}
            />
          </Field>
          <Field label="Tope RPE" error={state.fieldErrors?.rpe_cap_sm}>
            <input
              name="rpe_cap_sm"
              type="number"
              step="0.01"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "rpe_cap_sm")}
            />
          </Field>
        </Row>

        {/* Recargos (%) */}
        <GroupTitle>Recargos (%)</GroupTitle>
        <PistaLey campos={["overtime_pct", "night_pct", "holiday_pct"]} />
        <Row>
          <Field label="Hora extra diurna" error={state.fieldErrors?.overtime_pct}>
            <input
              name="overtime_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "overtime_pct")}
            />
          </Field>
          <Field label="Bono nocturno" error={state.fieldErrors?.night_pct}>
            <input
              name="night_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "night_pct")}
            />
          </Field>
          <Field label="Día feriado" error={state.fieldErrors?.holiday_pct}>
            <input
              name="holiday_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "holiday_pct")}
            />
          </Field>
        </Row>

        {/* Aportes del patrono (%): costo de la nómina, no se descuentan al trabajador (D5) */}
        <GroupTitle>Aportes del patrono (%)</GroupTitle>
        <PistaLey
          campos={[
            "sso_patronal_pct",
            "rpe_patronal_pct",
            "faov_patronal_pct",
            "inces_patronal_pct",
            "pension_contrib_pct",
          ]}
        />
        <Row>
          {num0556("sso_patronal_pct", "IVSS del patrono", { max: "100" })}
          {num0556("rpe_patronal_pct", "RPE del patrono", { max: "100" })}
          {num0556("faov_patronal_pct", "FAOV del patrono", { max: "100" })}
        </Row>
        <Row>
          {num0556("inces_patronal_pct", "INCES del patrono", { max: "100" })}
          {num0556("pension_contrib_pct", "Contribución de pensiones", { max: "15" })}
        </Row>
        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "-8px 0 0" }}>
          Solo para calcular el costo de la nómina: no se descuentan al trabajador. La contribución de pensiones tiene un tope
          legal de 15 %. Los campos que la versión no tenía configurados quedan vacíos y debajo muestran la propuesta de la
          norma conocida, por confirmar con el contador. «Usar la propuesta» la copia a los campos vacíos; si no lo haces, se guardan
          vacíos («sin configurar»).
        </p>
        <UsarPropuesta
          campos={["sso_patronal_pct", "rpe_patronal_pct", "faov_patronal_pct", "inces_patronal_pct", "pension_contrib_pct"]}
          etiqueta="aportes del patrono"
          disabled={espera}
        />

        {/* Provisiones (días) */}
        <GroupTitle>Provisiones / prestaciones (días)</GroupTitle>
        <PistaLey
          campos={[
            "utilidades_days",
            "bono_vacacional_days",
            "vacaciones_days",
            "vacaciones_extra_max",
            "bono_vacacional_max_days",
          ]}
        />
        <Row>
          <Field label="Utilidades" error={state.fieldErrors?.utilidades_days}>
            <input
              name="utilidades_days"
              type="number"
              step="1"
              min="30"
              max="120"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "utilidades_days")}
            />
          </Field>
          <Field label="Bono vacacional" error={state.fieldErrors?.bono_vacacional_days}>
            <input
              name="bono_vacacional_days"
              type="number"
              step="1"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "bono_vacacional_days")}
            />
          </Field>
          <Field label="Vacaciones" error={state.fieldErrors?.vacaciones_days}>
            <input
              name="vacaciones_days"
              type="number"
              step="1"
              min="0"
              className="studio-input studio-input-mono"
              defaultValue={val(rules, "vacaciones_days")}
            />
          </Field>
        </Row>
        <Row>
          {num0556("vacaciones_extra_max", "Vacaciones: máx. días adicionales", { step: "1" })}
          {num0556("bono_vacacional_max_days", "Bono vacacional: máx. de días", { step: "1" })}
        </Row>
        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "-8px 0 0" }}>
          Utilidades: entre 30 y 120 días (LOTTT Art. 131). Los máximos son los de la escala por antigüedad (Arts. 190 y 192).
          Si no están configurados quedan vacíos; debajo se muestra la propuesta, por confirmar con el contador.
        </p>
        <UsarPropuesta
          campos={["vacaciones_extra_max", "bono_vacacional_max_days"]}
          etiqueta="escalas por antigüedad"
          disabled={espera}
        />

        {/* Liquidación (SDD-0658 · columnas de la 0179): siempre se envían, con lo de la versión vigente. */}
        <GroupTitle>Liquidación (finiquito)</GroupTitle>
        <Row>
          <Field label="Cómo se calculan las prestaciones" error={state.fieldErrors?.prestaciones_method}>
            <select name="prestaciones_method" className="studio-input" defaultValue={ajustes.prestaciones_method}>
              {METODO_PRESTACIONES_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Interés sobre prestaciones (%)" error={state.fieldErrors?.prestaciones_interest_pct}>
            <input
              name="prestaciones_interest_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="studio-input studio-input-mono"
              defaultValue={String(ajustes.prestaciones_interest_pct)}
            />
          </Field>
          <Field
            label="Despido por causa ajena (Art. 78): ¿suma la indemnización del Art. 92?"
            error={state.fieldErrors?.ajena_78_incluye_92}
          >
            <select
              name="ajena_78_incluye_92"
              className="studio-input"
              defaultValue={ajustes.ajena_78_incluye_92 ? "true" : "false"}
            >
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </Field>
        </Row>
        <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "-8px 0 0" }}>
          Se usan al calcular un finiquito y quedan congelados en él. El interés se aplica una vez sobre el total de
          prestaciones. Los valores de fábrica son «el mayor de los dos», {AJUSTES_LIQUIDACION_BASE.prestaciones_interest_pct} % de
          interés y sin Art. 92: confírmalos con el contador antes del próximo finiquito.
        </p>

        <Field label="Notas">
          <textarea
            name="notes"
            className="studio-input"
            rows={2}
            defaultValue={rules?.notes ?? ""}
            style={{ resize: "vertical" }}
          />
        </Field>

        {state.error && <ErrorBox>{state.error}</ErrorBox>}
      </form>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Guardar reglas"
      />
    </DrawerShell>
  );
}
